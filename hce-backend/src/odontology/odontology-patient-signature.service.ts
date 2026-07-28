import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { join } from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyPatientSignatureEntity } from './odontology-patient-signature.entity';
import { ClinicalEvidenceAuditEntity, EvidenceAuditAction } from './clinical-evidence-audit.entity';

/** Directorio PRIVADO (fuera de la estática pública /uploads) para blobs de ePHI. */
const PRIVATE_DIR = join(process.cwd(), 'private-uploads', 'signatures');

export interface ActorCtx {
  tenantId: string;
  actorId: string;
  actorName?: string;
  sourceIp?: string;
}

@Injectable()
export class OdontologyPatientSignatureService {
  constructor(
    @InjectRepository(OdontologyPatientSignatureEntity)
    private readonly sigRepo: Repository<OdontologyPatientSignatureEntity>,
    @InjectRepository(OdontologyResourceEntity)
    private readonly resourceRepo: Repository<OdontologyResourceEntity>,
    @InjectRepository(ClinicalEvidenceAuditEntity)
    private readonly auditRepo: Repository<ClinicalEvidenceAuditEntity>,
  ) {}

  private async audit(
    action: EvidenceAuditAction,
    ctx: ActorCtx,
    params: { patientId?: string | null; entityId?: string | null; payload?: any },
  ): Promise<void> {
    const entry = new ClinicalEvidenceAuditEntity();
    entry.tenantId = ctx.tenantId;
    entry.patientId = params.patientId ?? null;
    entry.entityType = 'patient_signature';
    entry.entityId = params.entityId ?? null;
    entry.action = action;
    entry.actorId = ctx.actorId;
    entry.actorName = ctx.actorName ?? null;
    entry.sourceIp = ctx.sourceIp ?? null;
    entry.payload = params.payload ?? null;
    await this.auditRepo.save(entry);
  }

  /** Construye el snapshot inmutable de lo firmado a partir del Procedure. */
  private buildSnapshot(res: OdontologyResourceEntity): any {
    const p = res.payload || {};
    return {
      resourceId: res.id,
      snomedCode: p.code?.coding?.[0]?.code ?? null,
      snomedDisplay: p.code?.text ?? null,
      codigoNomenclador: p.code?.coding?.find((c: any) => c?.system?.includes('nomenclador'))?.code ?? null,
      diente: p.bodySite?.coding?.[0]?.code ?? null,
      cara: p.bodySite?.coding?.[1]?.code ?? null,
      performedDateTime: p.performedDateTime ?? null,
    };
  }

  /**
   * Registra la firma de conformidad del paciente para una prestación (Procedure completed).
   * Valida pertenencia al tenant, congela el snapshot, calcula hash y persiste en almacén privado.
   */
  async register(
    ctx: ActorCtx,
    patientId: string,
    resourceId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    opts?: { encounterId?: string; deviceInfo?: string },
  ): Promise<any> {
    if (!file?.buffer?.length) throw new BadRequestException('No se recibió la imagen de la firma.');
    if (file.mimetype !== 'image/png') throw new BadRequestException('La firma debe ser PNG.');
    // Magic-bytes PNG: 89 50 4E 47 0D 0A 1A 0A (no confiar en el Content-Type del cliente).
    const sig = file.buffer.subarray(0, 8);
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!sig.equals(PNG_MAGIC)) throw new BadRequestException('El archivo no es un PNG válido.');

    // El recurso debe existir, pertenecer al paciente/tenant, ser Procedure y estar completado.
    const res = await this.resourceRepo.findOne({ where: { id: resourceId, patientId, tenantId: ctx.tenantId } });
    if (!res) throw new NotFoundException('Prestación no encontrada.');
    if (res.resourceType !== 'Procedure' || res.payload?.status !== 'completed') {
      throw new BadRequestException('Solo se puede firmar una prestación realizada (Procedure completado).');
    }

    // Una sola firma vigente por prestación.
    const vigente = await this.sigRepo.findOne({ where: { tenantId: ctx.tenantId, resourceId, supersededBy: IsNull() } });
    if (vigente) throw new ConflictException('La prestación ya tiene una firma de conformidad vigente.');

    const snapshot = this.buildSnapshot(res);
    const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const snapshotHash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

    if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR, { recursive: true });
    const storageKey = `sig-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.png`;
    fs.writeFileSync(join(PRIVATE_DIR, storageKey), file.buffer);

    const row = this.sigRepo.create({
      tenantId: ctx.tenantId,
      patientId,
      resourceId,
      encounterId: opts?.encounterId || res.encounterId || null,
      storageBackend: 'local',
      storageKey,
      mimeType: 'image/png',
      sizeBytes: file.size,
      contentHash,
      hashAlgo: 'SHA-256',
      signedContentSnapshot: snapshot,
      snapshotHash,
      signedAt: new Date(),
      capturedById: ctx.actorId,
      capturedByName: ctx.actorName ?? null,
      deviceInfo: opts?.deviceInfo ?? null,
      sourceIp: ctx.sourceIp ?? null,
    });
    const saved = await this.sigRepo.save(row);
    await this.audit('PATIENT_SIGN', ctx, {
      patientId,
      entityId: saved.id,
      payload: { resourceId, contentHash, snapshotHash },
    });
    return this.project(saved, patientId);
  }

  /** Firma vigente de una prestación (o null). Para armar la Ficha. */
  async getByResource(tenantId: string, patientId: string, resourceId: string): Promise<any | null> {
    const row = await this.sigRepo.findOne({ where: { tenantId, patientId, resourceId, supersededBy: IsNull() } });
    return row ? this.project(row, patientId) : null;
  }

  /** Todas las firmas vigentes de una visita (Ficha de Atención completa, sin N+1). */
  async getByEncounter(tenantId: string, patientId: string, encounterId: string): Promise<any[]> {
    const rows = await this.sigRepo.find({ where: { tenantId, patientId, encounterId, supersededBy: IsNull() } });
    return rows.map((r) => this.project(r, patientId));
  }

  /**
   * Devuelve el binario de la firma (ruta + mime) tras validar el tenant, y AUDITA la descarga (ePHI).
   */
  async getImage(ctx: ActorCtx, patientId: string, id: string): Promise<{ path: string; mimeType: string }> {
    const row = await this.sigRepo.findOne({ where: { id, tenantId: ctx.tenantId, patientId } });
    if (!row) throw new NotFoundException('Firma no encontrada.');
    const path = join(PRIVATE_DIR, row.storageKey);
    if (!fs.existsSync(path)) throw new NotFoundException('Imagen de la firma no disponible.');
    await this.audit('PATIENT_SIGN_VIEW', ctx, { patientId, entityId: id, payload: { resourceId: row.resourceId } });
    return { path, mimeType: row.mimeType };
  }

  /** Proyección para el frontend: nunca expone el blob, solo la URL del endpoint autenticado. */
  private project(r: OdontologyPatientSignatureEntity, patientId: string): any {
    return {
      id: r.id,
      resourceId: r.resourceId,
      encounterId: r.encounterId,
      signedAt: r.signedAt,
      contentHash: r.contentHash,
      hashAlgo: r.hashAlgo,
      capturedByName: r.capturedByName,
      storageBackend: r.storageBackend,
      snapshot: r.signedContentSnapshot,
      imageUrl: `/odontology/patient/${patientId}/signature/${r.id}/image`,
    };
  }
}
