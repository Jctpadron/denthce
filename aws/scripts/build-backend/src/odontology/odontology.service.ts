import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { join } from 'path';
import * as fs from 'fs';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyEncounterEntity } from './odontology-encounter.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';

/** Metadatos del archivo subido (radiografía/foto/documento). */
export interface OdontoFileInfo {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
}

// URL canónica de la extensión que distingue la capa del odontograma:
// 'existing' = prestación existente (ya realizada → rojo)
// 'planned'  = prestación a realizar (planificada → azul)
export const ODONTOGRAM_LAYER_URL =
  'http://denthce.local/fhir/StructureDefinition/odontogram-layer';

export type OdontogramLayer = 'existing' | 'planned';

/** Lee la capa de un payload de forma defensiva (sin extensión = 'existing'). */
export function getLayer(payload: any): OdontogramLayer {
  const ext = (payload?.extension || []).find(
    (e: any) => e.url === ODONTOGRAM_LAYER_URL,
  );
  return ext?.valueCode === 'planned' ? 'planned' : 'existing';
}

@Injectable()
export class OdontologyService {
  constructor(
    @InjectRepository(OdontologyResourceEntity)
    private readonly resourceRepository: Repository<OdontologyResourceEntity>,
    // Lectura del padrón demográfico compartido SOLO para validar pertenencia
    // del paciente al tenant. No escribe ni modifica la HC original.
    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,
    // Lectura de turnos SOLO para derivar la "última visita" de la grilla.
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepository: Repository<AppointmentEntity>,
    // Visitas: validar visita activa y bloquear mutación de prestaciones firmadas.
    @InjectRepository(OdontologyEncounterEntity)
    private readonly encounterRepository: Repository<OdontologyEncounterEntity>,
  ) {}

  /**
   * Guarda de inmutabilidad: una prestación asociada a una visita FIRMADA (finished)
   * no puede modificarse ni borrarse (solo addenda a nivel visita). Recursos sin
   * encuentro o de visita activa: editables.
   */
  private async assertResourceMutable(encounterId: string | null | undefined, tenantId: string): Promise<void> {
    if (!encounterId) return;
    const enc = await this.encounterRepository.findOne({ where: { id: encounterId, tenantId } });
    if (enc && enc.status === 'finished') {
      throw new ForbiddenException('Una visita firmada no puede modificarse. Usá una addenda.');
    }
  }

  /**
   * Enriquece la grilla de pacientes con datos derivados que NO viven en el
   * padrón demográfico: "última visita" y "obra social". Se resuelve en lote
   * (sin N+1) para escalar: 3 consultas agregadas, no una por paciente.
   *
   * No toca PatientService.search (regla del Super Admin): el frontend busca el
   * padrón como siempre y luego pide aquí solo los IDs visibles en pantalla.
   *
   * @returns mapa { [patientId]: { lastVisit, obraSocial } }
   */
  async enrichPatients(
    patientIds: string[],
    tenantId: string,
  ): Promise<Record<string, { lastVisit: string | null; obraSocial: string | null }>> {
    const result: Record<string, { lastVisit: string | null; obraSocial: string | null }> = {};
    // Cota defensiva: solo se enriquece lo que se muestra en una página de grilla.
    const ids = (patientIds || [])
      .filter((id) => typeof id === 'string' && id.length > 0)
      .slice(0, 300);
    if (ids.length === 0) return result;
    ids.forEach((id) => { result[id] = { lastVisit: null, obraSocial: null }; });

    // 1a) Última visita por turno atendido (fulfilled).
    const apptRows = await this.appointmentRepository
      .createQueryBuilder('a')
      .select('a.patient_id', 'pid')
      .addSelect('MAX(a.start_date)', 'last')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.patient_id IN (:...ids)', { ids })
      .andWhere("a.status = 'fulfilled'")
      .groupBy('a.patient_id')
      .getRawMany();

    // 1b) Última actividad odontológica (registro clínico = hubo visita).
    const odontoRows = await this.resourceRepository
      .createQueryBuilder('r')
      .select('r.patient_id', 'pid')
      .addSelect('MAX(r.updated_at)', 'last')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.patient_id IN (:...ids)', { ids })
      .groupBy('r.patient_id')
      .getRawMany();

    const applyVisit = (rows: Array<{ pid: string; last: any }>) => {
      for (const { pid, last } of rows) {
        if (!result[pid] || !last) continue;
        const iso = new Date(last).toISOString();
        if (!result[pid].lastVisit || iso > (result[pid].lastVisit as string)) {
          result[pid].lastVisit = iso;
        }
      }
    };
    applyVisit(apptRows);
    applyVisit(odontoRows);

    // 2) Obra social: la cobertura más reciente registrada por paciente.
    const coverages = await this.resourceRepository.find({
      where: { tenantId, resourceType: 'Coverage', patientId: In(ids) },
      order: { updatedAt: 'DESC' },
    });
    for (const cov of coverages) {
      const entry = result[cov.patientId];
      if (entry && !entry.obraSocial) {
        const os = cov.payload?.obraSocial || cov.payload?.payor?.[0]?.display || null;
        if (os) entry.obraSocial = os;
      }
    }

    return result;
  }

  async getPatient(patientId: string, tenantId: string): Promise<PatientEntity> {
    const patient = await this.patientRepository.findOne({ where: { id: patientId, tenantId } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado en tu consultorio.');
    }
    return patient;
  }

  private async assertPatient(patientId: string, tenantId: string): Promise<void> {
    await this.getPatient(patientId, tenantId);
  }

  async saveResource(
    patientId: string,
    resourceType: string,
    payload: any,
    tenantId: string,
    encounterId?: string | null,
  ): Promise<any> {
    const allowedTypes = [
      'Condition',
      'Procedure',
      'Observation',
      'QuestionnaireResponse',
      'CarePlan',
      'Coverage',
      'Consent',
    ];
    if (!allowedTypes.includes(resourceType)) {
      throw new BadRequestException(
        `El tipo de recurso debe ser uno de los siguientes: ${allowedTypes.join(', ')}`,
      );
    }

    await this.assertPatient(patientId, tenantId);

    // Si se asocia a una visita, debe existir, ser del paciente/tenant y estar activa.
    if (encounterId) {
      const enc = await this.encounterRepository.findOne({ where: { id: encounterId, patientId, tenantId } });
      if (!enc) throw new BadRequestException('La visita indicada no existe en tu consultorio.');
      if (enc.status === 'finished') throw new ForbiddenException('Una visita firmada no puede modificarse. Usá una addenda.');
      if (enc.status === 'cancelled') throw new BadRequestException('La visita fue cancelada.');
    }

    payload.resourceType = resourceType;
    payload.subject = { reference: `Patient/${patientId}` };
    if (encounterId) {
      payload.encounter = { reference: `Encounter/${encounterId}` };
      if (resourceType === 'Procedure' && !payload.performedDateTime && !payload.performedPeriod) {
        payload.performedDateTime = new Date().toISOString();
      }
    }

    // Upsert por (pieza, cara, tipo, CAPA): una pieza puede tener simultáneamente
    // un hallazgo existente (rojo) y uno planificado (azul); marcar un "a realizar"
    // nunca debe pisar el "existente".
    const toothCode = payload.bodySite?.coding?.[0]?.code;
    const faceCode = payload.bodySite?.coding?.[1]?.code;
    const layer = getLayer(payload);

    let entity: OdontologyResourceEntity | null = null;

    if (toothCode) {
      const resources = await this.resourceRepository.find({
        where: { patientId, resourceType, tenantId },
      });
      entity =
        resources.find((r) => {
          const rTooth = r.payload.bodySite?.coding?.[0]?.code;
          const rFace = r.payload.bodySite?.coding?.[1]?.code;
          return rTooth === toothCode && rFace === faceCode && getLayer(r.payload) === layer;
        }) || null;
    }

    // Inmutabilidad: si se va a sobrescribir una prestación de una visita firmada, bloquear.
    if (entity) await this.assertResourceMutable(entity.encounterId, tenantId);

    if (!entity) {
      entity = new OdontologyResourceEntity();
      entity.patientId = patientId;
      entity.resourceType = resourceType;
      entity.tenantId = tenantId;
    }

    if (encounterId) entity.encounterId = encounterId;
    entity.payload = payload;
    const saved = await this.resourceRepository.save(entity);

    saved.payload.id = saved.id;
    await this.resourceRepository.update(saved.id, { payload: saved.payload });

    return saved.payload;
  }

  async getResourcesByPatient(patientId: string, tenantId: string): Promise<any[]> {
    await this.assertPatient(patientId, tenantId);
    const resources = await this.resourceRepository.find({
      where: { patientId, tenantId },
      order: { createdAt: 'ASC' },
    });
    return resources.map((r) => r.payload);
  }

  /**
   * Guarda una radiografía/foto (FHIR Media) o un documento (FHIR DocumentReference)
   * en la tabla del módulo odontológico (aislado). El archivo ya fue persistido en
   * disco por multer; acá guardamos la referencia. La url se almacena RELATIVA
   * (`/uploads/...`) para no atar el dato a un host (el frontend la prefija).
   */
  async saveFile(
    patientId: string,
    fileInfo: OdontoFileInfo,
    description: string,
    category: string,
    tenantId: string,
  ): Promise<any> {
    await this.assertPatient(patientId, tenantId);

    const isImage = fileInfo.mimetype.startsWith('image/');
    const resourceType = isImage ? 'Media' : 'DocumentReference';
    const fileUrl = `/uploads/${fileInfo.filename}`;
    const title = description?.trim() || fileInfo.originalname;
    const meta = {
      _category: category || (isImage ? 'imagen' : 'documento'),
      _originalName: fileInfo.originalname,
      _fileName: fileInfo.filename,
      _contentType: fileInfo.mimetype,
      _size: fileInfo.size,
      _uploadedAt: new Date().toISOString(),
    };

    const payload: any = isImage
      ? {
          resourceType: 'Media',
          status: 'completed',
          subject: { reference: `Patient/${patientId}` },
          content: { contentType: fileInfo.mimetype, url: fileUrl, title, size: fileInfo.size },
          note: description?.trim() ? [{ text: description.trim() }] : undefined,
          ...meta,
        }
      : {
          resourceType: 'DocumentReference',
          status: 'current',
          subject: { reference: `Patient/${patientId}` },
          description: title,
          content: [{ attachment: { contentType: fileInfo.mimetype, url: fileUrl, title, size: fileInfo.size } }],
          date: meta._uploadedAt,
          ...meta,
        };

    const entity = new OdontologyResourceEntity();
    entity.patientId = patientId;
    entity.resourceType = resourceType;
    entity.tenantId = tenantId;
    entity.payload = payload;

    const saved = await this.resourceRepository.save(entity);
    saved.payload.id = saved.id;
    await this.resourceRepository.update(saved.id, { payload: saved.payload });
    return saved.payload;
  }

  /**
   * Transiciona un hallazgo planificado (azul) a existente (rojo): el
   * tratamiento "a realizar" pasó a "realizado".
   */
  async completeResource(id: string, tenantId: string): Promise<any> {
    const resource = await this.resourceRepository.findOne({ where: { id, tenantId } });
    if (!resource) {
      throw new NotFoundException('Recurso clínico no encontrado en tu consultorio.');
    }
    await this.assertResourceMutable(resource.encounterId, tenantId);

    const payload = resource.payload || {};
    if (getLayer(payload) !== 'planned') {
      throw new BadRequestException(
        'Solo un tratamiento planificado (a realizar) puede marcarse como realizado.',
      );
    }

    const extension = (payload.extension || []).filter(
      (e: any) => e.url !== ODONTOGRAM_LAYER_URL,
    );
    extension.push({ url: ODONTOGRAM_LAYER_URL, valueCode: 'existing' });
    payload.extension = extension;

    if (payload.resourceType === 'Procedure') {
      payload.status = 'completed';
      payload.performedDateTime = new Date().toISOString();
    }

    resource.payload = payload;
    const saved = await this.resourceRepository.save(resource);
    return saved.payload;
  }

  async deleteResource(id: string, tenantId: string): Promise<any> {
    const resource = await this.resourceRepository.findOne({ where: { id, tenantId } });
    if (!resource) {
      throw new NotFoundException('Recurso clínico no encontrado.');
    }
    await this.assertResourceMutable(resource.encounterId, tenantId);

    // Si es un archivo subido (radiografía/foto/documento), borrar también el binario local.
    const fileName: string | undefined = resource.payload?._fileName;
    if (fileName) {
      const safe = String(fileName).replace(/[^a-zA-Z0-9.\-_]/g, '');
      const filePath = join(process.cwd(), 'uploads', safe);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* archivo ya inexistente: ignorar */ }
      }
    }

    await this.resourceRepository.remove(resource);
    return { message: 'Recurso clínico eliminado con éxito.' };
  }
}
