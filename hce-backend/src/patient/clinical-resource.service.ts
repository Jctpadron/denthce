import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalResourceEntity } from './clinical-resource.entity';
import { PatientEntity } from './patient.entity';

@Injectable()
export class ClinicalResourceService {
  constructor(
    @InjectRepository(ClinicalResourceEntity)
    private readonly resourceRepository: Repository<ClinicalResourceEntity>,
    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,
  ) {}

  async saveResource(
    patientId: string,
    resourceType: string,
    payload: any,
    tenantId: string,
  ): Promise<any> {
    const allowedTypes = [
      'Condition',
      'Procedure',
      'AllergyIntolerance',
      'Observation',
      'DocumentReference',
      'Media',
      'MedicationStatement',
    ];
    if (!allowedTypes.includes(resourceType)) {
      throw new BadRequestException(
        `El tipo de recurso debe ser uno de los siguientes: ${allowedTypes.join(', ')}`,
      );
    }

    // Verificar que el paciente exista y pertenezca al mismo tenant
    const patient = await this.patientRepository.findOne({ where: { id: patientId, tenantId } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado en tu consultorio.');
    }

    // Mapear campos básicos FHIR
    payload.resourceType = resourceType;
    payload.subject = { reference: `Patient/${patientId}` };

    // Si ya existe un recurso para la misma pieza dental y superficie y tipo, podemos actualizarlo
    // (Por ejemplo, si se marcó caries y luego se limpia, o si se actualiza el estado)
    // Para simplificar, buscamos si hay una pieza dental y superficie en el payload y tipo
    const toothCode = payload.bodySite?.coding?.[0]?.code;
    const faceCode = payload.bodySite?.coding?.[1]?.code; // opcional

    let entity: ClinicalResourceEntity | null = null;

    if (toothCode) {
      // Buscar si ya existe un registro clínico de este tipo en esa pieza dental
      const resources = await this.resourceRepository.find({
        where: { patientId, resourceType, tenantId },
      });

      entity = resources.find((r) => {
        const rTooth = r.payload.bodySite?.coding?.[0]?.code;
        const rFace = r.payload.bodySite?.coding?.[1]?.code;
        return rTooth === toothCode && rFace === faceCode;
      }) || null;
    }

    if (!entity) {
      entity = new ClinicalResourceEntity();
      entity.patientId = patientId;
      entity.resourceType = resourceType;
      entity.tenantId = tenantId;
    }

    entity.payload = payload;
    const saved = await this.resourceRepository.save(entity);

    // Inyectar el ID generado
    saved.payload.id = saved.id;
    await this.resourceRepository.update(saved.id, { payload: saved.payload });

    return saved.payload;
  }

  async getResourcesByPatient(patientId: string, tenantId: string): Promise<any[]> {
    // Verificar que el paciente exista y pertenezca al mismo tenant
    const patient = await this.patientRepository.findOne({ where: { id: patientId, tenantId } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado en tu consultorio.');
    }

    const resources = await this.resourceRepository.find({
      where: { patientId, tenantId },
      order: { createdAt: 'ASC' },
    });

    return resources.map((r) => r.payload);
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
