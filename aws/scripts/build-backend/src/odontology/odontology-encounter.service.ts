import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OdontologyEncounterEntity } from './odontology-encounter.entity';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyEncounterAuditService } from './odontology-encounter-audit.service';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';

interface UserCtx { userId: string; userName: string; }

/**
 * Ciclo de vida de la VISITA / ENCUENTRO odontológico (módulo aislado).
 * Diseño: docs/design/encuentro-odontologico-modelo.md + encuentro-odontologico-fhir.md.
 *
 * Abrir (in-progress) → asociar prestaciones (encounter_id) → Finalizar+firmar
 * (finished, inmutable) → el turno asociado pasa a 'fulfilled'. Correcciones por addenda.
 * Todo tenant-scoped (Zero Trust).
 */
@Injectable()
export class OdontologyEncounterService {
  constructor(
    @InjectRepository(OdontologyEncounterEntity)
    private readonly encounterRepo: Repository<OdontologyEncounterEntity>,
    @InjectRepository(OdontologyResourceEntity)
    private readonly resourceRepo: Repository<OdontologyResourceEntity>,
    @InjectRepository(PatientEntity)
    private readonly patientRepo: Repository<PatientEntity>,
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    private readonly audit: OdontologyEncounterAuditService,
  ) {}

  private async assertPatient(patientId: string, tenantId: string): Promise<void> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId, tenantId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado en tu consultorio.');
  }

  /** Proyección FHIR del encuentro (lo que consume el front). */
  private toFhir(e: OdontologyEncounterEntity): any {
    return {
      ...(e.payload || {}),
      id: e.id,
      status: e.status,
      appointmentId: e.appointmentId,
      reasonText: e.reasonText,
      start: e.startDate,
      end: e.endDate,
      signedBy: e.signedBy,
      signedById: e.signedById,
      signedAt: e.signedAt,
      contentHash: e.contentHash,
      addenda: e.addenda || [],
    };
  }

  /**
   * Abre una visita. Idempotente: si ya hay una in-progress para el paciente,
   * la devuelve en vez de crear otra (invariante: una visita activa por paciente/tenant).
   */
  async open(
    patientId: string,
    body: { appointmentId?: string | null; classCode?: string; reasonText?: string },
    tenantId: string,
    userCtx: UserCtx,
  ): Promise<any> {
    await this.assertPatient(patientId, tenantId);

    const existing = await this.encounterRepo.findOne({
      where: { patientId, tenantId, status: 'in-progress' },
      order: { startDate: 'DESC' },
    });
    if (existing) return this.toFhir(existing);

    const now = new Date();
    const appointmentId = body?.appointmentId || null;
    const classCode = body?.classCode || 'AMB';
    const reasonText = body?.reasonText?.trim() || null;

    const entity = new OdontologyEncounterEntity();
    entity.tenantId = tenantId;
    entity.patientId = patientId;
    entity.appointmentId = appointmentId;
    entity.status = 'in-progress';
    entity.classCode = classCode;
    entity.reasonText = reasonText;
    entity.startDate = now;
    entity.addenda = [];
    entity.payload = {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: classCode, display: classCode === 'AMB' ? 'Ambulatorio' : classCode },
      type: [{ coding: [{ system: 'http://snomed.info/sct', code: '53110001', display: 'Consulta odontológica' }] }],
      serviceType: { coding: [{ system: 'http://snomed.info/sct', code: '9482002', display: 'Servicio odontológico' }] },
      subject: { reference: `Patient/${patientId}` },
      ...(appointmentId ? { appointment: [{ reference: `Appointment/${appointmentId}` }] } : {}),
      period: { start: now.toISOString() },
      ...(reasonText ? { reasonCode: [{ text: reasonText }] } : {}),
      participant: [
        { individual: { display: userCtx.userName }, type: [{ coding: [{ code: 'ATND', display: 'Profesional Tratante' }] }] },
      ],
    };

    let saved: OdontologyEncounterEntity;
    try {
      saved = await this.encounterRepo.save(entity);
    } catch (err: any) {
      // Carrera (dos pestañas): el índice único parcial rechaza la 2ª visita activa → devolver la existente.
      const dup = await this.encounterRepo.findOne({ where: { patientId, tenantId, status: 'in-progress' }, order: { startDate: 'DESC' } });
      if (dup) return this.toFhir(dup);
      throw err;
    }
    saved.payload.id = saved.id;
    await this.encounterRepo.update(saved.id, { payload: saved.payload });

    // Si hay turno, reflejar que la atención empezó (booked → arrived).
    if (appointmentId) {
      const appt = await this.appointmentRepo.findOne({ where: { id: appointmentId, tenantId } });
      if (appt && (appt.status === 'booked' || appt.status === 'proposed')) {
        appt.status = 'arrived';
        if (appt.payload) appt.payload.status = 'arrived';
        await this.appointmentRepo.save(appt);
      }
    }

    await this.audit.log({ encounterId: saved.id, tenantId, patientId, actorId: userCtx.userId, actorName: userCtx.userName, action: 'OPEN', payloadSnapshot: { reasonText, appointmentId } });
    return this.toFhir(saved);
  }

  /** Historial de auditoría de una visita (apertura/firma/cancelación/addenda). */
  async getAuditHistory(encounterId: string, tenantId: string): Promise<any[]> {
    return this.audit.getHistory(encounterId, tenantId);
  }

  /** Visita activa del paciente (o null). */
  async getActive(patientId: string, tenantId: string): Promise<any | null> {
    await this.assertPatient(patientId, tenantId);
    const active = await this.encounterRepo.findOne({
      where: { patientId, tenantId, status: 'in-progress' },
      order: { startDate: 'DESC' },
    });
    return active ? this.toFhir(active) : null;
  }

  /** Lista las visitas del paciente (resumen) + conteo de registros legacy sin visita. */
  async list(patientId: string, tenantId: string): Promise<any> {
    await this.assertPatient(patientId, tenantId);
    const encounters = await this.encounterRepo.find({
      where: { patientId, tenantId },
      order: { startDate: 'DESC' },
    });

    // Conteo de prestaciones por visita (una consulta agregada, sin N+1).
    const counts = await this.resourceRepo
      .createQueryBuilder('r')
      .select('r.encounter_id', 'eid')
      .addSelect('COUNT(*)', 'n')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.patient_id = :patientId', { patientId })
      .andWhere('r.encounter_id IS NOT NULL')
      .groupBy('r.encounter_id')
      .getRawMany();
    const countMap = new Map<string, number>(counts.map((c) => [c.eid, parseInt(c.n, 10)]));

    const legacyRow = await this.resourceRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'n')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.patient_id = :patientId', { patientId })
      .andWhere('r.encounter_id IS NULL')
      .getRawOne();

    return {
      visitas: encounters.map((e) => ({
        id: e.id,
        status: e.status,
        start: e.startDate,
        end: e.endDate,
        reasonText: e.reasonText,
        classCode: e.classCode,
        prestaciones: countMap.get(e.id) || 0,
        signedBy: e.signedBy,
        signedAt: e.signedAt,
        appointmentId: e.appointmentId,
        hasAddenda: Array.isArray(e.addenda) && e.addenda.length > 0,
      })),
      legacy: { count: parseInt(legacyRow?.n || '0', 10) },
    };
  }

  /** Una visita con sus prestaciones embebidas + addenda. */
  async getOne(id: string, patientId: string, tenantId: string): Promise<any> {
    await this.assertPatient(patientId, tenantId);
    const entity = await this.encounterRepo.findOne({ where: { id, patientId, tenantId } });
    if (!entity) throw new NotFoundException('Visita no encontrada en tu consultorio.');
    const resources = await this.resourceRepo.find({
      where: { encounterId: id, tenantId },
      order: { createdAt: 'ASC' },
    });
    return { ...this.toFhir(entity), prestaciones: resources.map((r) => r.payload) };
  }

  /**
   * Finaliza y firma la visita (inmutable). Replica el patrón de EncounterService.sign:
   * hash SHA-256 del contenido + status finished + bloqueo de mutación posterior.
   * Marca el turno asociado como 'fulfilled' (misma operación).
   */
  async sign(id: string, patientId: string, tenantId: string, userCtx: UserCtx): Promise<any> {
    await this.assertPatient(patientId, tenantId);
    const entity = await this.encounterRepo.findOne({ where: { id, patientId, tenantId } });
    if (!entity) throw new NotFoundException('Visita no encontrada en tu consultorio.');
    if (entity.status === 'finished') throw new BadRequestException('Esta visita ya fue firmada.');
    if (entity.status === 'cancelled') throw new BadRequestException('No se puede firmar una visita cancelada.');

    const resources = await this.resourceRepo.find({
      where: { encounterId: id, tenantId },
      order: { createdAt: 'ASC' },
    });
    if (resources.length === 0 && !entity.reasonText) {
      throw new BadRequestException('No se puede firmar una visita vacía: registrá al menos una prestación o el motivo de consulta.');
    }

    const now = new Date();
    // Hash estable del set de prestaciones + motivo + apertura.
    const canonical = JSON.stringify({
      reasonText: entity.reasonText,
      start: new Date(entity.startDate).toISOString(), // ISO normalizado → hash reproducible
      prestaciones: resources
        .map((r) => ({ type: r.resourceType, payload: r.payload }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    });
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');

    entity.status = 'finished';
    entity.endDate = now;
    entity.signedBy = userCtx.userName;
    entity.signedById = userCtx.userId;
    entity.signedAt = now;
    entity.contentHash = hash;
    entity.payload = {
      ...(entity.payload || {}),
      status: 'finished',
      period: { ...(entity.payload?.period || {}), end: now.toISOString() },
      extension: [
        ...((entity.payload?.extension) || []),
        { url: 'http://denthce.local/fhir/StructureDefinition/odonto-signed-by', valueString: userCtx.userName },
        { url: 'http://denthce.local/fhir/StructureDefinition/odonto-signed-at', valueDateTime: now.toISOString() },
        { url: 'http://denthce.local/fhir/StructureDefinition/odonto-hash', valueString: hash },
      ],
    };
    await this.encounterRepo.save(entity);

    // Vínculo turno: la visita firmada ⇒ turno cumplido.
    if (entity.appointmentId) {
      const appt = await this.appointmentRepo.findOne({ where: { id: entity.appointmentId, tenantId } });
      if (appt && appt.status !== 'cancelled' && appt.status !== 'noshow') {
        appt.status = 'fulfilled';
        if (appt.payload) appt.payload.status = 'fulfilled';
        await this.appointmentRepo.save(appt);
      }
    }

    await this.audit.log({ encounterId: entity.id, tenantId, patientId, actorId: userCtx.userId, actorName: userCtx.userName, action: 'SIGN', payloadSnapshot: { contentHash: hash, prestaciones: resources.length, appointmentId: entity.appointmentId } });
    return this.toFhir(entity);
  }

  /** Cancela una visita activa. Las prestaciones se desvinculan a legacy (no se borra el trabajo). */
  async cancel(id: string, patientId: string, tenantId: string, userCtx: UserCtx): Promise<any> {
    await this.assertPatient(patientId, tenantId);
    const entity = await this.encounterRepo.findOne({ where: { id, patientId, tenantId } });
    if (!entity) throw new NotFoundException('Visita no encontrada en tu consultorio.');
    if (entity.status !== 'in-progress') throw new BadRequestException('Solo se puede cancelar una visita en curso.');

    await this.resourceRepo.update({ encounterId: id, tenantId }, { encounterId: null });

    entity.status = 'cancelled';
    if (entity.payload) entity.payload.status = 'cancelled';
    await this.encounterRepo.save(entity);
    await this.audit.log({ encounterId: entity.id, tenantId, patientId, actorId: userCtx.userId, actorName: userCtx.userName, action: 'CANCEL' });
    return this.toFhir(entity);
  }

  /** Agrega una addenda (corrección post-firma, append-only). No altera lo firmado. */
  async addAddenda(id: string, patientId: string, text: string, tenantId: string, userCtx: UserCtx): Promise<any> {
    await this.assertPatient(patientId, tenantId);
    const entity = await this.encounterRepo.findOne({ where: { id, patientId, tenantId } });
    if (!entity) throw new NotFoundException('Visita no encontrada en tu consultorio.');
    if (entity.status !== 'finished') throw new BadRequestException('Solo se agregan addenda a una visita firmada.');
    const clean = (text || '').trim();
    if (!clean) throw new BadRequestException('La addenda no puede estar vacía.');

    const addenda = Array.isArray(entity.addenda) ? entity.addenda : [];
    addenda.push({
      id: crypto.randomUUID(),
      text: clean,
      authoredBy: userCtx.userName,
      authoredById: userCtx.userId,
      authoredAt: new Date().toISOString(),
    });
    entity.addenda = addenda;
    // Reflejo FHIR: cada addenda como note del Encounter.
    entity.payload = {
      ...(entity.payload || {}),
      note: [...((entity.payload?.note) || []), { authorString: userCtx.userName, time: new Date().toISOString(), text: clean }],
    };
    await this.encounterRepo.save(entity);
    await this.audit.log({ encounterId: entity.id, tenantId, patientId, actorId: userCtx.userId, actorName: userCtx.userName, action: 'ADDENDA', payloadSnapshot: { text: clean } });
    return this.toFhir(entity);
  }

  /**
   * Helper para el guard de inmutabilidad de prestaciones: indica si el encuentro
   * dado está firmado (finished). Usado por OdontologyService antes de mutar recursos.
   */
  async isFinished(encounterId: string, tenantId: string): Promise<boolean> {
    if (!encounterId) return false;
    const e = await this.encounterRepo.findOne({ where: { id: encounterId, tenantId } });
    return e?.status === 'finished';
  }

  /** Valida que el encuentro exista, sea del paciente/tenant y esté activo (para asociar prestaciones). */
  async assertActiveForResource(encounterId: string, patientId: string, tenantId: string): Promise<void> {
    const e = await this.encounterRepo.findOne({ where: { id: encounterId, patientId, tenantId } });
    if (!e) throw new BadRequestException('La visita indicada no existe en tu consultorio.');
    if (e.status === 'finished') throw new ForbiddenException('Una visita firmada no puede modificarse. Usá una addenda.');
    if (e.status === 'cancelled') throw new BadRequestException('La visita fue cancelada.');
  }
}
