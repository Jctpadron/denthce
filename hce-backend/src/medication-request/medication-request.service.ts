import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MedicationRequestEntity } from './medication-request.entity';
import { ClinicalResourceEntity } from '../patient/clinical-resource.entity';
import { PatientEntity } from '../patient/patient.entity';
import * as crypto from 'crypto';

@Injectable()
export class MedicationRequestService {
  constructor(
    @InjectRepository(MedicationRequestEntity)
    private readonly medicationRequestRepository: Repository<MedicationRequestEntity>,

    @InjectRepository(ClinicalResourceEntity)
    private readonly clinicalResourceRepository: Repository<ClinicalResourceEntity>,

    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,
  ) {}

  // Diccionario del Vademécum Odontológico y Clínico Frecuente (50 fármacos)
  private readonly VADEMECUM = [
    { code: 'AMX-500', name: 'Amoxicilina 500 mg', substance: 'Amoxicilina', category: 'Antibiótico' },
    { code: 'AMX-875', name: 'Amoxicilina 875 mg', substance: 'Amoxicilina', category: 'Antibiótico' },
    { code: 'AMX-CLV', name: 'Amoxicilina 875 mg + Ácido Clavulánico 125 mg', substance: 'Amoxicilina / Ácido Clavulánico', category: 'Antibiótico' },
    { code: 'IBU-400', name: 'Ibuprofeno 400 mg', substance: 'Ibuprofeno', category: 'Analgésico / Antiinflamatorio' },
    { code: 'IBU-600', name: 'Ibuprofeno 600 mg', substance: 'Ibuprofeno', category: 'Analgésico / Antiinflamatorio' },
    { code: 'PAR-500', name: 'Paracetamol 500 mg', substance: 'Paracetamol', category: 'Analgésico / Antipirético' },
    { code: 'PAR-1G', name: 'Paracetamol 1 g', substance: 'Paracetamol', category: 'Analgésico / Antipirético' },
    { code: 'KT-10', name: 'Ketorolac 10 mg', substance: 'Ketorolac', category: 'Analgésico potente' },
    { code: 'KT-20', name: 'Ketorolac 20 mg (Sublingual)', substance: 'Ketorolac', category: 'Analgésico potente' },
    { code: 'CLX-500', name: 'Cefalexina 500 mg', substance: 'Cefalexina', category: 'Antibiótico' },
    { code: 'DXM-4', name: 'Dexametasona 4 mg', substance: 'Dexametasona', category: 'Corticoide' },
    { code: 'DXM-8', name: 'Dexametasona 8 mg (Inyectable)', substance: 'Dexametasona', category: 'Corticoide' },
    { code: 'CLN-300', name: 'Clindamicina 300 mg', substance: 'Clindamicina', category: 'Antibiótico' },
    { code: 'MCX-15', name: 'Meloxicam 15 mg', substance: 'Meloxicam', category: 'Antiinflamatorio' },
    { code: 'NPR-500', name: 'Naproxeno 500 mg', substance: 'Naproxeno', category: 'Analgésico / Antiinflamatorio' },
    { code: 'PNC-G', name: 'Penicilina G Sódica 1.200.000 UI', substance: 'Penicilina', category: 'Antibiótico' },
    { code: 'PNC-V', name: 'Penicilina V 500.000 UI', substance: 'Penicilina', category: 'Antibiótico' },
    { code: 'AZT-500', name: 'Azitromicina 500 mg', substance: 'Azitromicina', category: 'Antibiótico' },
    { code: 'MET-500', name: 'Metronidazol 500 mg', substance: 'Metronidazol', category: 'Antibiótico / Antiparasitario' },
    { code: 'ASP-100', name: 'Aspirina 100 mg (Ácido Acetilsalicílico)', substance: 'Aspirina', category: 'Antiagregante plaquetario' },
    { code: 'CLP-75', name: 'Clopidogrel 75 mg', substance: 'Clopidogrel', category: 'Antiagregante' },
    { code: 'ENP-10', name: 'Enalapril 10 mg', substance: 'Enalapril', category: 'Antihipertensivo' },
    { code: 'LOS-50', name: 'Losartán 50 mg', substance: 'Losartán', category: 'Antihipertensivo' },
    { code: 'AML-5', name: 'Amlodipina 5 mg', substance: 'Amlodipina', category: 'Antihipertensivo' },
    { code: 'ATV-20', name: 'Atorvastatina 20 mg', substance: 'Atorvastatina', category: 'Hipolipemiante' },
    { code: 'MET-850', name: 'Metformina 850 mg', substance: 'Metformina', category: 'Hipoglucemiante' },
    { code: 'LVT-100', name: 'Levotiroxina 100 mcg', substance: 'Levotiroxina', category: 'Hormona tiroidea' },
    { code: 'OMP-20', name: 'Omeprazol 20 mg', substance: 'Omeprazol', category: 'Protector gástrico' },
    { code: 'PNZ-40', name: 'Pantoprazol 40 mg', substance: 'Pantoprazol', category: 'Protector gástrico' },
    { code: 'CLN-05', name: 'Clonazepam 0.5 mg', substance: 'Clonazepam', category: 'Ansiolítico' },
    { code: 'CLN-20', name: 'Clonazepam 2 mg', substance: 'Clonazepam', category: 'Ansiolítico' },
    { code: 'ALP-05', name: 'Alprazolam 0.5 mg', substance: 'Alprazolam', category: 'Ansiolítico' },
    { code: 'DZP-5', name: 'Diazepam 5 mg', substance: 'Diazepam', category: 'Ansiolítico / Miorrelajante' },
    { code: 'SND-50', name: 'Sildenafil 50 mg', substance: 'Sildenafil', category: 'Disfunción eréctil' },
    { code: 'CHX-012', name: 'Clorhexidina Colutorio 0.12%', substance: 'Clorhexidina', category: 'Antiséptico Bucal' },
    { code: 'CHX-GEL', name: 'Clorhexidina Gel Dental 0.20%', substance: 'Clorhexidina', category: 'Antiséptico Bucal' },
    { code: 'FLU-005', name: 'Fluoruro de Sodio Colutorio 0.05%', substance: 'Fluoruro de Sodio', category: 'Preventivo de Caries' },
    { code: 'FLU-BAR', name: 'Fluoruro de Sodio Barniz 5%', substance: 'Fluoruro de Sodio', category: 'Preventivo de Caries' },
    { code: 'NYT-100', name: 'Nistatina Suspensión Oral 100.000 UI/ml', substance: 'Nistatina', category: 'Antimicótico Oral' },
    { code: 'MCZ-GEL', name: 'Miconazol Gel Oral 2%', substance: 'Miconazol', category: 'Antimicótico Oral' },
    { code: 'TRM-50', name: 'Tramadol 50 mg', substance: 'Tramadol', category: 'Analgésico Opioide' },
    { code: 'TRM-PAR', name: 'Tramadol 37.5 mg + Paracetamol 325 mg', substance: 'Tramadol / Paracetamol', category: 'Analgésico Opioide Combinado' },
    { code: 'MCD-10', name: 'Metoclopramida 10 mg', substance: 'Metoclopramida', category: 'Antiemético' },
    { code: 'DPH-50', name: 'Difenhidramina 50 mg', substance: 'Difenhidramina', category: 'Antihistamínico' },
    { code: 'LOR-10', name: 'Loratadina 10 mg', substance: 'Loratadina', category: 'Antihistamínico' },
    { code: 'BET-KIT', name: 'Betametasona Inyectable (Kit Dúo)', substance: 'Betametasona', category: 'Corticoide' },
    { code: 'BUP-05', name: 'Bupivacaína 0.5% con Epinefrina (Cartuchos)', substance: 'Bupivacaína', category: 'Anestésico Local Dental' },
    { code: 'LID-20', name: 'Lidocaína 2% con Epinefrina (Cartuchos)', substance: 'Lidocaína', category: 'Anestésico Local Dental' },
    { code: 'MEP-30', name: 'Mepivacaína 3% sin Vasoconstrictor', substance: 'Mepivacaína', category: 'Anestésico Local Dental' },
    { code: 'MCB-8', name: 'Mepivacaína 2% con Corbadrina', substance: 'Mepivacaína', category: 'Anestésico Local Dental' }
  ];

  // Buscar medicamentos en Vademecum
  async searchVademecum(query: string): Promise<any[]> {
    if (!query || query.trim() === '') return [];
    const lower = query.toLowerCase();
    return this.VADEMECUM.filter(
      item => item.name.toLowerCase().includes(lower) || item.substance.toLowerCase().includes(lower)
    );
  }

  // Motor CDS Hooks: Evalúa interacciones con las alergias registradas del paciente
  async runCdsHooks(patientId: string, tenantId: string, medicationName: string, medicationCode: string): Promise<string[]> {
    const warnings: string[] = [];
    if (!medicationName) return [];

    // 1. Buscar Alergias del Paciente en fhir_clinical_resources
    const allergies = await this.clinicalResourceRepository.find({
      where: { patientId, tenantId, resourceType: 'AllergyIntolerance' }
    });

    const parsedAllergies = allergies.map(a => {
      const display = a.payload?.code?.coding?.[0]?.display || a.payload?.code?.text || '';
      return display.toLowerCase().trim();
    });

    const medNameLower = medicationName.toLowerCase();

    // 2. Ejecutar Reglas de Cruce
    for (const allergy of parsedAllergies) {
      // Regla de Alergia a la Penicilina (Cruza con Amoxicilina, Penicilinas y Cefalosporinas)
      if (allergy.includes('penicilina') || allergy.includes('penicillin')) {
        if (
          medNameLower.includes('amoxicilina') ||
          medNameLower.includes('penicilina') ||
          medNameLower.includes('cefalexina') ||
          medNameLower.includes('ampicilina')
        ) {
          warnings.push(
            `⚠️ ALERTA CDS: El paciente es alérgico a la PENICILINA. El fármaco prescrito (${medicationName}) es un betalactámico derivado y puede causar shock anafiláctico.`
          );
        }
      }

      // Regla de Alergia a AINES (Cruza con Ibuprofeno, Ketorolac, Naproxeno, Aspirina, Meloxicam)
      if (allergy.includes('aine') || allergy.includes('nsaid') || allergy.includes('aspirina') || allergy.includes('ibuprofeno')) {
        if (
          medNameLower.includes('ibuprofeno') ||
          medNameLower.includes('ketorolac') ||
          medNameLower.includes('naproxeno') ||
          medNameLower.includes('aspirina') ||
          medNameLower.includes('meloxicam')
        ) {
          warnings.push(
            `⚠️ ALERTA CDS: El paciente posee intolerancia/alergia registrada a AINES/Aspirina. El analgésico prescrito (${medicationName}) está contraindicado.`
          );
        }
      }

      // Cruce por texto exacto / coincidencia directa de sustancia activa
      const preset = this.VADEMECUM.find(v => v.code === medicationCode);
      const substance = preset?.substance?.toLowerCase() || '';
      if (substance && allergy.includes(substance)) {
        warnings.push(
          `⚠️ ALERTA CDS: Coincidencia directa de Alergia. Paciente alérgico a la sustancia activa: ${preset?.substance}.`
        );
      }
    }

    return warnings;
  }

  // Crear borrador de Receta
  async create(
    patientId: string,
    dto: any,
    tenantId: string,
  ): Promise<any> {
    const entity = new MedicationRequestEntity();
    entity.patientId = patientId;
    entity.tenantId = tenantId;
    entity.status = 'draft';

    // Ejecutar CDS Hooks para incluir advertencias iniciales en el payload
    const medName = dto.medicationName || dto.medicationCodeableConcept?.text || '';
    const medCode = dto.medicationCode || '';
    const warnings = await this.runCdsHooks(patientId, tenantId, medName, medCode);

    entity.payload = {
      resourceType: 'MedicationRequest',
      status: 'draft',
      intent: 'order',
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      medicationCodeableConcept: {
        coding: [{
          system: 'http://loinc.org',
          code: medCode,
          display: medName
        }],
        text: medName
      },
      dosageInstruction: [{
        text: dto.dosageText || '',
        timing: { repeat: { frequency: parseInt(dto.frequencyHours) || 8, periodUnit: 'h' } },
        doseAndRate: [{ doseQuantity: { value: parseFloat(dto.doseValue) || 1 } }]
      }],
      dispenseRequest: {
        expectedSupplyDuration: { value: parseInt(dto.durationDays) || 3, unit: 'd' }
      },
      extension: [
        { url: 'http://hospital.gov/fhir/StructureDefinition/cds-warnings', valueString: JSON.stringify(warnings) }
      ]
    };

    const saved = await this.medicationRequestRepository.save(entity);
    saved.payload.id = saved.id;
    await this.medicationRequestRepository.update(saved.id, { payload: saved.payload });

    return { ...saved.payload, warnings };
  }

  // Listar todas las recetas de un paciente
  async findAll(patientId: string, tenantId: string): Promise<any[]> {
    const list = await this.medicationRequestRepository.find({
      where: { patientId, tenantId },
      order: { createdAt: 'DESC' }
    });
    return list.map(m => ({
      ...m.payload,
      id: m.id,
      status: m.status,
      signedBy: m.signedBy,
      signedAt: m.signedAt,
      contentHash: m.contentHash,
      qrCodeData: m.qrCodeData
    }));
  }

  /**
   * Recetas pendientes de firma del consultorio (status='draft').
   * Alimenta el widget del Dashboard "Recetas pendientes de firma" (Tarea 3.12).
   * Aislamiento multi-inquilino: filtra siempre por tenantId.
   */
  async findPendingDrafts(tenantId: string): Promise<any[]> {
    const drafts = await this.medicationRequestRepository.find({
      where: { tenantId, status: 'draft' },
      order: { createdAt: 'DESC' },
    });

    if (drafts.length === 0) return [];

    // Enriquecer con el nombre del paciente (una sola consulta por lote)
    const patientIds = [...new Set(drafts.map(d => d.patientId))];
    const patients = await this.patientRepository.find({ where: { id: In(patientIds) } });
    const nameById = new Map(
      patients.map((p: PatientEntity) => [p.id, `${p.givenName} ${p.familyName}`.trim()]),
    );

    return drafts.map(d => ({
      id: d.id,
      patientId: d.patientId,
      patientName: nameById.get(d.patientId) || 'Paciente',
      medicationName: d.payload?.medicationCodeableConcept?.text || 'Medicamento',
      authoredOn: d.payload?.authoredOn || d.createdAt,
      status: d.status,
    }));
  }

  // Obtener una receta específica
  async findOne(id: string, tenantId: string): Promise<any> {
    const entity = await this.medicationRequestRepository.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Receta ${id} no encontrada.`);
    return {
      ...entity.payload,
      id: entity.id,
      status: entity.status,
      signedBy: entity.signedBy,
      signedAt: entity.signedAt,
      contentHash: entity.contentHash,
      qrCodeData: entity.qrCodeData
    };
  }

  // Modificar borrador de receta (si no está firmada)
  async update(id: string, dto: any, tenantId: string): Promise<any> {
    const entity = await this.medicationRequestRepository.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Receta ${id} no encontrada.`);
    if (entity.status === 'active') {
      throw new ForbiddenException('No se puede modificar una receta electrónica ya firmada.');
    }

    const medName = dto.medicationName || entity.payload.medicationCodeableConcept?.text || '';
    const medCode = dto.medicationCode || entity.payload.medicationCodeableConcept?.coding?.[0]?.code || '';
    const warnings = await this.runCdsHooks(entity.patientId, tenantId, medName, medCode);

    entity.payload = {
      ...entity.payload,
      medicationCodeableConcept: {
        coding: [{
          system: 'http://loinc.org',
          code: medCode,
          display: medName
        }],
        text: medName
      },
      dosageInstruction: [{
        text: dto.dosageText || '',
        timing: { repeat: { frequency: parseInt(dto.frequencyHours) || 8, periodUnit: 'h' } },
        doseAndRate: [{ doseQuantity: { value: parseFloat(dto.doseValue) || 1 } }]
      }],
      dispenseRequest: {
        expectedSupplyDuration: { value: parseInt(dto.durationDays) || 3, unit: 'd' }
      },
      extension: [
        { url: 'http://hospital.gov/fhir/StructureDefinition/cds-warnings', valueString: JSON.stringify(warnings) }
      ]
    };

    await this.medicationRequestRepository.save(entity);
    return { ...entity.payload, id: entity.id, warnings };
  }

  // Firma avanzada de receta (la congela, genera hash SHA-256 e inyecta QR)
  async sign(
    id: string,
    tenantId: string,
    userCtx: { userId: string; userName: string },
  ): Promise<any> {
    const entity = await this.medicationRequestRepository.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Receta ${id} no encontrada.`);
    if (entity.status === 'active') {
      throw new BadRequestException('Esta receta ya fue firmada anteriormente.');
    }

    const medName = entity.payload.medicationCodeableConcept?.text || '';
    if (!medName) {
      throw new BadRequestException('No se puede firmar una receta sin especificar un medicamento.');
    }

    const now = new Date();
    const prescriptionText = `${medName} | Dosis: ${entity.payload.dosageInstruction?.[0]?.text} | Duración: ${entity.payload.dispenseRequest?.expectedSupplyDuration?.value} días`;
    const hash = crypto.createHash('sha256').update(prescriptionText).digest('hex');
    
    // Generar string para código QR de validación farmacéutica externa
    const qrData = `https://dentariehr.gov/verify/prescription?id=${entity.id}&hash=${hash}&signedBy=${encodeURIComponent(userCtx.userName)}`;

    entity.status = 'active';
    entity.signedBy = userCtx.userName;
    entity.signedAt = now;
    entity.contentHash = hash;
    entity.qrCodeData = qrData;

    entity.payload = {
      ...entity.payload,
      status: 'active',
      extension: [
        ...(entity.payload.extension || []),
        { url: 'http://hospital.gov/fhir/StructureDefinition/prescription-signed-by', valueString: userCtx.userName },
        { url: 'http://hospital.gov/fhir/StructureDefinition/prescription-signed-at', valueDateTime: now.toISOString() },
        { url: 'http://hospital.gov/fhir/StructureDefinition/prescription-hash', valueString: hash },
        { url: 'http://hospital.gov/fhir/StructureDefinition/prescription-qr', valueString: qrData }
      ]
    };

    await this.medicationRequestRepository.save(entity);
    return { ...entity.payload, id: entity.id, status: 'active', signedBy: entity.signedBy, signedAt: entity.signedAt, contentHash: hash, qrCodeData: qrData };
  }
}
