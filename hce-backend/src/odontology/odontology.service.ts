import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { PatientEntity } from '../patient/patient.entity';

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
  ) {}

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

    payload.resourceType = resourceType;
    payload.subject = { reference: `Patient/${patientId}` };

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

    if (!entity) {
      entity = new OdontologyResourceEntity();
      entity.patientId = patientId;
      entity.resourceType = resourceType;
      entity.tenantId = tenantId;
    }

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
   * Transiciona un hallazgo planificado (azul) a existente (rojo): el
   * tratamiento "a realizar" pasó a "realizado".
   */
  async completeResource(id: string, tenantId: string): Promise<any> {
    const resource = await this.resourceRepository.findOne({ where: { id, tenantId } });
    if (!resource) {
      throw new NotFoundException('Recurso clínico no encontrado en tu consultorio.');
    }

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
    await this.resourceRepository.remove(resource);
    return { message: 'Recurso clínico eliminado con éxito.' };
  }
}
