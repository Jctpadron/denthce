import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyEncounterEntity } from './odontology-encounter.entity';
import { OdontologyEncounterAuditEntity } from './odontology-encounter-audit.entity';
import { OdontologyPatientSignatureEntity } from './odontology-patient-signature.entity';
import { ClinicalEvidenceAuditEntity } from './clinical-evidence-audit.entity';
import { ClinicalAttachmentEntity } from './clinical-attachment.entity';
import { ClinicalPresupuesto } from '../clinica-finanzas/clinical-presupuesto.entity';
import { OdontologyService } from './odontology.service';
import { OdontologyEncounterService } from './odontology-encounter.service';
import { OdontologyEncounterAuditService } from './odontology-encounter-audit.service';
import { OdontologyPatientSignatureService } from './odontology-patient-signature.service';
import { ClinicalAttachmentService } from './clinical-attachment.service';
import { OdontologyController } from './odontology.controller';
import { OdontologyEncounterController } from './odontology-encounter.controller';
import { OdontologyPatientSignatureController } from './odontology-patient-signature.controller';
import { ClinicalAttachmentController } from './clinical-attachment.controller';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { OdontologyPdfService } from './odontology-pdf.service';

/**
 * Módulo AISLADO de la Historia Clínica Odontológica.
 * Tablas propias: odontology_clinical_resources (prestaciones) y odontology_encounters
 * (visitas). Importa PatientEntity en modo lectura para validar pertenencia del paciente
 * al tenant, y AppointmentEntity para derivar "última visita" y marcar el turno fulfilled.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OdontologyResourceEntity, OdontologyEncounterEntity, OdontologyEncounterAuditEntity, OdontologyPatientSignatureEntity, ClinicalEvidenceAuditEntity, ClinicalAttachmentEntity, ClinicalPresupuesto, PatientEntity, AppointmentEntity])],
  providers: [OdontologyService, OdontologyEncounterService, OdontologyEncounterAuditService, OdontologyPatientSignatureService, ClinicalAttachmentService, OdontologyPdfService],
  controllers: [OdontologyController, OdontologyEncounterController, OdontologyPatientSignatureController, ClinicalAttachmentController],
  exports: [OdontologyService, OdontologyEncounterService, OdontologyPdfService],
})
export class OdontologyModule {}
