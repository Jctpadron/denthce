import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientEntity } from './patient.entity';
import { PatientAuditService } from './patient-audit.service';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientEntity)
    private patientRepository: Repository<PatientEntity>,
    private readonly auditService: PatientAuditService,
  ) {}

  async create(fhirPatient: any, tenantId: string, userCtx?: { userId: string; userName: string }): Promise<any> {
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
    const nowIso = new Date().toISOString();
    entity.payload = {
      resourceType: 'Patient',
      active: entity.active,
      identifier: fhirPatient.identifier || [{ value: dni, system: 'http://hospital.gov/dni' }],
      name: fhirPatient.name || [{ family: familyName, given: [givenName] }],
      gender: gender,
      birthDate: birthDate,
      telecom: fhirPatient.telecom || [],
      address: fhirPatient.address || [],
      extension: fhirPatient.extension || [
        {
          url: 'http://hospital.gov/fhir/StructureDefinition/admission-date',
          valueDateTime: nowIso
        }
      ]
    };

    const saved = await this.patientRepository.save(entity);
    
    // Inyectar el ID generado por la base de datos en el payload retornado y sincronizar fecha de ingreso si es necesario
    saved.payload.id = saved.id;
    
    // Asegurar que la extensión de fecha de ingreso coincida con la real de creación en base de datos
    const admissionExt = saved.payload.extension?.find((ext: any) => ext.url === 'http://hospital.gov/fhir/StructureDefinition/admission-date');
    if (admissionExt && saved.createdAt) {
      admissionExt.valueDateTime = saved.createdAt.toISOString();
    }

    await this.patientRepository.update(saved.id, { payload: saved.payload });

    // Registrar evento de auditoría: Alta de paciente
    await this.auditService.logChange({
      patientId: saved.id,
      tenantId,
      userId: userCtx?.userId || 'system',
      userName: userCtx?.userName || 'Sistema',
      action: 'CREATE',
      after: {
        dni: saved.dni,
        familyName: saved.familyName,
        givenName: saved.givenName,
        gender: saved.gender,
        birthDate: saved.birthDate,
      },
      payloadSnapshot: saved.payload,
    });

    return saved.payload;
  }

  async findOne(id: string, tenantId: string): Promise<any> {
    const patient = await this.patientRepository.findOne({ where: { id, tenantId } });
    if (!patient) {
      throw new NotFoundException(`Paciente con ID ${id} no encontrado en tu consultorio.`);
    }

    const payload = patient.payload;
    if (!payload.extension) payload.extension = [];
    
    const hasAdmission = payload.extension.some((ext: any) => ext.url === 'http://hospital.gov/fhir/StructureDefinition/admission-date');
    if (!hasAdmission) {
      payload.extension.push({
        url: 'http://hospital.gov/fhir/StructureDefinition/admission-date',
        valueDateTime: patient.createdAt ? patient.createdAt.toISOString() : new Date().toISOString()
      });
    }

    return payload;
  }

  async update(id: string, fhirPatient: any, tenantId: string, userCtx?: { userId: string; userName: string }): Promise<any> {
    const entity = await this.patientRepository.findOne({ where: { id, tenantId } });
    if (!entity) {
      throw new NotFoundException(`Paciente con ID ${id} no encontrado en tu consultorio.`);
    }

    const dni = this.extractDni(fhirPatient);
    const familyName = this.extractFamilyName(fhirPatient);
    const givenName = this.extractGivenName(fhirPatient);
    const gender = fhirPatient.gender || 'unknown';
    const birthDate = fhirPatient.birthDate;

    if (!dni || !familyName || !givenName || !birthDate) {
      throw new BadRequestException('Campos obligatorios FHIR faltantes (identifier/DNI, name, birthDate).');
    }

    // Si el DNI cambia, verificar que no haya conflicto con otro paciente en el mismo tenant
    if (dni !== entity.dni) {
      const existing = await this.patientRepository.findOne({ where: { dni, tenantId } });
      if (existing) {
        throw new ConflictException(`El paciente con DNI/identifier ${dni} ya se encuentra registrado en tu consultorio.`);
      }
    }

    entity.dni = dni;
    entity.familyName = familyName;
    entity.givenName = givenName;
    entity.gender = gender;
    entity.birthDate = birthDate;

    // Preservar o añadir la fecha de ingreso original
    const originalAdmissionDate = entity.payload.extension?.find(
      (ext: any) => ext.url === 'http://hospital.gov/fhir/StructureDefinition/admission-date'
    );
    const newExtensions = fhirPatient.extension || [];
    const hasNewAdmissionDate = newExtensions.some(
      (ext: any) => ext.url === 'http://hospital.gov/fhir/StructureDefinition/admission-date'
    );
    
    const finalExtensions = [...newExtensions];
    if (!hasNewAdmissionDate) {
      if (originalAdmissionDate) {
        finalExtensions.push(originalAdmissionDate);
      } else {
        finalExtensions.push({
          url: 'http://hospital.gov/fhir/StructureDefinition/admission-date',
          valueDateTime: entity.createdAt ? entity.createdAt.toISOString() : new Date().toISOString()
        });
      }
    }

    // Actualizar el payload manteniendo el ID de base de datos
    entity.payload = {
      ...entity.payload,
      ...fhirPatient,
      id: entity.id,
      identifier: fhirPatient.identifier || [{ value: dni, system: 'http://hospital.gov/dni' }],
      name: fhirPatient.name || [{ family: familyName, given: [givenName] }],
      gender: gender,
      birthDate: birthDate,
      telecom: fhirPatient.telecom || [],
      address: fhirPatient.address || [],
      extension: finalExtensions
    };

    // Snapshot del estado ANTERIOR para el diff de auditoría
    const before = {
      dni: entity.dni,
      familyName: entity.familyName,
      givenName: entity.givenName,
      gender: entity.gender,
      birthDate: entity.birthDate,
      phone: entity.payload?.telecom?.find((t: any) => t.system === 'phone')?.value,
      email: entity.payload?.telecom?.find((t: any) => t.system === 'email')?.value,
      address: entity.payload?.address?.[0]?.line?.join(' '),
    };

    entity.dni = dni;
    entity.familyName = familyName;
    entity.givenName = givenName;
    entity.gender = gender;
    entity.birthDate = birthDate;

    await this.patientRepository.save(entity);

    // Registrar evento de auditoría: Modificación demográfica
    const after = {
      dni,
      familyName,
      givenName,
      gender,
      birthDate,
      phone: fhirPatient.telecom?.find((t: any) => t.system === 'phone')?.value,
      email: fhirPatient.telecom?.find((t: any) => t.system === 'email')?.value,
      address: fhirPatient.address?.[0]?.line?.join(' '),
    };
    await this.auditService.logChange({
      patientId: id,
      tenantId,
      userId: userCtx?.userId || 'system',
      userName: userCtx?.userName || 'Sistema',
      action: 'UPDATE',
      before,
      after,
      payloadSnapshot: entity.payload,
    });

    return entity.payload;
  }

  async search(query: { dni?: string; name?: string; age?: string; admissionDate?: string }, tenantId: string): Promise<any> {
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
    if (query.age) {
      qb.andWhere('EXTRACT(YEAR FROM AGE(patient.birth_date)) = :age', { age: parseInt(query.age) });
    }
    if (query.admissionDate) {
      qb.andWhere('DATE(patient.created_at) = :admissionDate', { admissionDate: query.admissionDate });
    }

    const patients = await qb.getMany();
    
    // Retornar en formato Bundle de FHIR para búsquedas
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: patients.length,
      entry: patients.map((p) => {
        const payload = p.payload;
        if (!payload.extension) payload.extension = [];
        const hasAdmission = payload.extension.some((ext: any) => ext.url === 'http://hospital.gov/fhir/StructureDefinition/admission-date');
        if (!hasAdmission) {
          payload.extension.push({
            url: 'http://hospital.gov/fhir/StructureDefinition/admission-date',
            valueDateTime: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString()
          });
        }
        return {
          fullUrl: `http://localhost:3000/fhir/r4/Patient/${p.id}`,
          resource: payload,
        };
      }),
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
