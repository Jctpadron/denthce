import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { ClinicalAttachmentEntity, AttachmentOwnerType } from './clinical-attachment.entity';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { ClinicalPresupuesto } from '../clinica-finanzas/clinical-presupuesto.entity';
import { ClinicalEvidenceAuditEntity, EvidenceAuditAction } from './clinical-evidence-audit.entity';
import { ActorCtx } from './odontology-patient-signature.service';
import { EvidenceStorageService } from './evidence-storage.service';

// Whitelist de tipos + magic-bytes (no confiar en el Content-Type del cliente).
const MAGIC: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
};
const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' };

@Injectable()
export class ClinicalAttachmentService {
  constructor(
    @InjectRepository(ClinicalAttachmentEntity)
    private readonly attachRepo: Repository<ClinicalAttachmentEntity>,
    @InjectRepository(OdontologyResourceEntity)
    private readonly resourceRepo: Repository<OdontologyResourceEntity>,
    @InjectRepository(ClinicalPresupuesto)
    private readonly presupuestoRepo: Repository<ClinicalPresupuesto>,
    @InjectRepository(ClinicalEvidenceAuditEntity)
    private readonly auditRepo: Repository<ClinicalEvidenceAuditEntity>,
    private readonly storage: EvidenceStorageService,
  ) {}

  private async audit(
    action: EvidenceAuditAction,
    ctx: ActorCtx,
    params: { patientId?: string | null; entityId?: string | null; payload?: any },
  ): Promise<void> {
    const e = new ClinicalEvidenceAuditEntity();
    e.tenantId = ctx.tenantId;
    e.patientId = params.patientId ?? null;
    e.entityType = 'clinical_attachment';
    e.entityId = params.entityId ?? null;
    e.action = action;
    e.actorId = ctx.actorId;
    e.actorName = ctx.actorName ?? null;
    e.sourceIp = ctx.sourceIp ?? null;
    e.payload = params.payload ?? null;
    await this.auditRepo.save(e);
  }

  /** Valida que el owner exista en el tenant y devuelve el patient_id derivado (nunca del cliente). */
  private async resolveOwner(tenantId: string, ownerType: AttachmentOwnerType, ownerId: string): Promise<string> {
    if (ownerType === 'procedure') {
      const res = await this.resourceRepo.findOne({ where: { id: ownerId, tenantId } });
      if (!res) throw new NotFoundException('Prestación no encontrada.');
      return res.patientId;
    }
    if (ownerType === 'presupuesto') {
      const pres = await this.presupuestoRepo.findOne({ where: { id: ownerId, tenantId } });
      if (!pres) throw new NotFoundException('Presupuesto no encontrado.');
      return pres.patientId;
    }
    throw new BadRequestException('owner_type inválido.');
  }

  async upload(
    ctx: ActorCtx,
    ownerType: AttachmentOwnerType,
    ownerId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    opts?: { kind?: string },
  ): Promise<any> {
    if (!file?.buffer?.length) throw new BadRequestException('No se recibió ningún archivo.');
    const mime = file.mimetype;
    const magic = MAGIC[mime];
    if (!magic) throw new BadRequestException(`Tipo no permitido: ${mime}. Se aceptan JPG, PNG y PDF.`);
    // Magic-bytes: el contenido real debe coincidir con el MIME declarado.
    const head = Array.from(file.buffer.subarray(0, magic.length));
    if (!magic.every((b, i) => head[i] === b)) {
      throw new BadRequestException('El contenido del archivo no coincide con su tipo declarado.');
    }

    const patientId = await this.resolveOwner(ctx.tenantId, ownerType, ownerId);
    const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const storageKey = `att-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[mime]}`;
    await this.storage.put('attachments', ctx.tenantId, storageKey, file.buffer, mime);

    const row = this.attachRepo.create({
      tenantId: ctx.tenantId,
      patientId,
      ownerType,
      ownerId,
      storageBackend: this.storage.backend(),
      storageKey,
      filename: (file.originalname || 'archivo').slice(0, 255),
      mimeType: mime,
      sizeBytes: file.size,
      kind: opts?.kind ?? (mime === 'application/pdf' ? 'documento' : 'rx'),
      contentHash,
      hashAlgo: 'SHA-256',
      uploadedBy: ctx.actorId,
      uploadedByName: ctx.actorName ?? null,
    });
    const saved = await this.attachRepo.save(row);
    await this.audit('ATTACH_UPLOAD', ctx, { patientId, entityId: saved.id, payload: { ownerType, ownerId, mime, contentHash } });
    return this.project(saved);
  }

  /** Lista los adjuntos vigentes (no borrados) de un owner. */
  async list(tenantId: string, ownerType: AttachmentOwnerType, ownerId: string): Promise<any[]> {
    const rows = await this.attachRepo.find({
      where: { tenantId, ownerType, ownerId, deletedAt: IsNull() },
      order: { uploadedAt: 'DESC' },
    });
    return rows.map((r) => this.project(r));
  }

  /** Todos los adjuntos vigentes del paciente (batch para la Ficha, evita N+1). Opcional filtrar por ownerType. */
  async listByPatient(tenantId: string, patientId: string, ownerType?: AttachmentOwnerType): Promise<any[]> {
    const where: any = { tenantId, patientId, deletedAt: IsNull() };
    if (ownerType) where.ownerType = ownerType;
    const rows = await this.attachRepo.find({ where, order: { uploadedAt: 'DESC' } });
    return rows.map((r) => this.project(r));
  }

  /** Stream del adjunto (+ mime/filename), validando tenant y auditando la descarga (ePHI). */
  async download(ctx: ActorCtx, id: string): Promise<{ stream: Readable; mimeType: string; filename: string }> {
    const row = await this.attachRepo.findOne({ where: { id, tenantId: ctx.tenantId, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException('Adjunto no encontrado.');
    const stream = await this.storage.getStream(row.storageBackend, 'attachments', row.tenantId, row.storageKey);
    await this.audit('ATTACH_DOWNLOAD', ctx, { patientId: row.patientId, entityId: id, payload: { ownerType: row.ownerType } });
    return { stream, mimeType: row.mimeType, filename: row.filename };
  }

  /** Soft-delete: marca deleted_at (el blob no se borra, por trazabilidad de ePHI). */
  async softDelete(ctx: ActorCtx, id: string): Promise<{ ok: true }> {
    const row = await this.attachRepo.findOne({ where: { id, tenantId: ctx.tenantId, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException('Adjunto no encontrado.');
    row.deletedAt = new Date();
    row.deletedBy = ctx.actorId;
    row.docStatus = 'entered-in-error';
    await this.attachRepo.save(row);
    await this.audit('ATTACH_DELETE', ctx, { patientId: row.patientId, entityId: id, payload: { ownerType: row.ownerType } });
    return { ok: true };
  }

  private project(r: ClinicalAttachmentEntity): any {
    return {
      id: r.id,
      ownerType: r.ownerType,
      ownerId: r.ownerId,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      kind: r.kind,
      contentHash: r.contentHash,
      uploadedByName: r.uploadedByName,
      uploadedAt: r.uploadedAt,
      downloadUrl: `/odontology/attachment/${r.id}/download`,
    };
  }
}
