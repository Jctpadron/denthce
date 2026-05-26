import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientEntity } from './patient.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientEntity)
    private patientRepository: Repository<PatientEntity>,
  ) {}

  async create(fhirPatient: any, tenantId: string): Promise<any> {
    const dni = this.extractDni(fhirPatient);
    const familyName = this.extractFamilyName(fhirPatient);
    const givenName = this.extractGivenName(fhirPatient);
    const gender = fhirPatient.gender || 'unknown';
    const birthDate = fhirPatient.birthDate;

    if (!dni || !familyName || !givenName || !birthDate) {
      throw new BadRequestException('Campos obligatorios FHIR faltantes (identifier/DNI, name, birthDate).');
    }

    // El DNI debe ser único por cada profesional (tenant)
    const existing = await this.patientRepository.findOne({ where: { dni, tenantId } });
    if (existing) {
      throw new ConflictException(`El paciente con DNI/identifier ${dni} ya se encuentra registrado en tu consultorio.`);
    }

    const entity = new PatientEntity();
    entity.active = fhirPatient.active !== false;
    entity.tenantId = tenantId;
    entity.dni = dni;
    entity.familyName = familyName;
    entity.givenName = givenName;
    entity.gender = gender;
    entity.birthDate = birthDate;
    
    // Mapear recurso base
    entity.payload = {
      resourceType: 'Patient',
      active: entity.active,
      identifier: fhirPatient.identifier || [{ value: dni, system: 'http://hospital.gov/dni' }],
      name: fhirPatient.name || [{ family: familyName, given: [givenName] }],
      gender: gender,
      birthDate: birthDate,
      telecom: fhirPatient.telecom || [],
      address: fhirPatient.address || []
    };

    const saved = await this.patientRepository.save(entity);
    
    // Inyectar el ID generado por la base de datos en el payload retornado
    saved.payload.id = saved.id;
    await this.patientRepository.update(saved.id, { payload: saved.payload });

    return saved.payload;
  }

  async findOne(id: string, tenantId: string): Promise<any> {
    const patient = await this.patientRepository.findOne({ where: { id, tenantId } });
    if (!patient) {
      throw new NotFoundException(`Paciente con ID ${id} no encontrado en tu consultorio.`);
    }
    return patient.payload;
  }

  async search(query: { dni?: string; name?: string; birthDate?: string }, tenantId: string): Promise<any> {
    const qb = this.patientRepository.createQueryBuilder('patient');

    // Filtrar estrictamente por el tenant (aislamiento)
    qb.where('patient.tenant_id = :tenantId', { tenantId });

    if (query.dni) {
      qb.andWhere('patient.dni LIKE :dni', { dni: `${query.dni}%` });
    }
    if (query.name) {
      qb.andWhere(
        '(LOWER(patient.family_name) LIKE LOWER(:name) OR LOWER(patient.given_name) LIKE LOWER(:name))',
        { name: `%${query.name}%` },
      );
    }
    if (query.birthDate) {
      qb.andWhere('patient.birth_date = :birthDate', { birthDate: query.birthDate });
    }

    const patients = await qb.getMany();
    
    // Retornar en formato Bundle de FHIR para búsquedas
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: patients.length,
      entry: patients.map((p) => ({
        fullUrl: `http://localhost:3000/fhir/r4/Patient/${p.id}`,
        resource: p.payload,
      })),
    };
  }

  // --- Auxiliares para procesamiento FHIR ---
  private extractDni(fhirPatient: any): string | null {
    const identifiers = fhirPatient.identifier || [];
    const dniIdentifier = identifiers.find((id: any) => id.value);
    return dniIdentifier ? dniIdentifier.value : null;
  }

  private extractFamilyName(fhirPatient: any): string | null {
    const names = fhirPatient.name || [];
    const primaryName = names[0] || {};
    return primaryName.family || null;
  }

  private extractGivenName(fhirPatient: any): string | null {
    const names = fhirPatient.name || [];
    const primaryName = names[0] || {};
    const givens = primaryName.given || [];
    return Array.isArray(givens) ? givens.join(' ') : (givens || null);
  }
}
