import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncounterEntity } from './encounter.entity';
import * as crypto from 'crypto';

/**
 * EncounterService — Tareas 3.1, 3.2, 3.4
 * Gestiona el ciclo de vida completo de una consulta clínica FHIR Encounter:
 * creación, actualización de borrador, firma digital lógica y lectura.
 */
@Injectable()
export class EncounterService {
  constructor(
    @InjectRepository(EncounterEntity)
    private readonly encounterRepository: Repository<EncounterEntity>,
  ) {}

  /** Crea un nuevo encuentro clínico (borrador) para un paciente */
  async create(
    patientId: string,
    fhirEncounter: any,
    tenantId: string,
    userCtx: { userId: string; userName: string },
  ): Promise<any> {
    const now = new Date();

    const entity = new EncounterEntity();
    entity.patientId = patientId;
    entity.tenantId = tenantId;
    entity.status = 'in-progress';
    entity.classCode = fhirEncounter.class?.code || 'AMB';
    entity.startDate = fhirEncounter.period?.start ? new Date(fhirEncounter.period.start) : now;

    entity.payload = {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: fhirEncounter.class || { code: 'AMB', display: 'Ambulatorio' },
      subject: { reference: `Patient/${patientId}` },
      period: { start: now.toISOString() },
      reasonCode: fhirEncounter.reasonCode || [],
      note: fhirEncounter.note || [],
      participant: [
        {
          individual: { display: userCtx.userName },
          type: [{ coding: [{ code: 'ATND', display: 'Profesional Tratante' }] }]
        }
      ],
    };

    const saved = await this.encounterRepository.save(entity);
    saved.payload.id = saved.id;
    await this.encounterRepository.update(saved.id, { payload: saved.payload });

    return saved.payload;
  }

  /** Devuelve todas las consultas de un paciente, ordenadas del más reciente al más antiguo */
  async findAll(patientId: string, tenantId: string): Promise<any[]> {
    const encounters = await this.encounterRepository.find({
      where: { patientId, tenantId },
      order: { createdAt: 'DESC' },
    });
    return encounters.map(e => ({ ...e.payload, id: e.id, status: e.status, signedBy: e.signedBy, signedAt: e.signedAt }));
  }

  /** Devuelve un encuentro específico por ID */
  async findOne(id: string, tenantId: string): Promise<any> {
    const entity = await this.encounterRepository.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Consulta ${id} no encontrada.`);
    return { ...entity.payload, id: entity.id, status: entity.status, signedBy: entity.signedBy, signedAt: entity.signedAt, contentHash: entity.contentHash };
  }

  /** Actualiza un borrador de encuentro (solo si no está firmado) */
  async update(
    id: string,
    fhirEncounter: any,
    tenantId: string,
  ): Promise<any> {
    const entity = await this.encounterRepository.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Consulta ${id} no encontrada.`);
    if (entity.status === 'finished') {
      throw new ForbiddenException('Una nota firmada no puede ser modificada.');
    }

    entity.classCode = fhirEncounter.class?.code || entity.classCode;
    entity.payload = {
      ...entity.payload,
      ...fhirEncounter,
      id: entity.id,
      subject: { reference: `Patient/${entity.patientId}` },
      status: 'in-progress',
    };

    await this.encounterRepository.save(entity);
    return { ...entity.payload, id: entity.id, status: entity.status };
  }

  /**
   * Firma digitalmente (lógica) un encuentro clínico.
   * Una vez firmado, el encuentro queda bloqueado e inmutable.
   * Se genera un hash SHA-256 del contenido SOAP para verificar integridad futura.
   */
  async sign(
    id: string,
    tenantId: string,
    userCtx: { userId: string; userName: string },
  ): Promise<any> {
    const entity = await this.encounterRepository.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Consulta ${id} no encontrada.`);
    if (entity.status === 'finished') {
      throw new BadRequestException('Esta nota ya fue firmada anteriormente.');
    }

    const notes = entity.payload?.note || [];
    if (notes.length === 0 || notes.every((n: any) => !n.text?.trim())) {
      throw new BadRequestException('No se puede firmar una nota SOAP vacía. Complete al menos un campo S/O/A/P.');
    }

    const now = new Date();
    const soapContent = notes.map((n: any) => n.text).join('\n');
    const hash = crypto.createHash('sha256').update(soapContent).digest('hex');

    entity.status = 'finished';
    entity.signedBy = userCtx.userName;
    entity.signedAt = now;
    entity.contentHash = hash;
    entity.endDate = now;

    entity.payload = {
      ...entity.payload,
      status: 'finished',
      period: { ...entity.payload.period, end: now.toISOString() },
      extension: [
        ...(entity.payload.extension || []),
        { url: 'http://hospital.gov/fhir/StructureDefinition/soap-signed-by', valueString: userCtx.userName },
        { url: 'http://hospital.gov/fhir/StructureDefinition/soap-signed-at', valueDateTime: now.toISOString() },
        { url: 'http://hospital.gov/fhir/StructureDefinition/soap-hash', valueString: hash },
      ]
    };

    await this.encounterRepository.save(entity);
    return { ...entity.payload, id: entity.id, status: 'finished', signedBy: entity.signedBy, signedAt: entity.signedAt, contentHash: hash };
  }
}
