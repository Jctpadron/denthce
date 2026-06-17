import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyEncounterEntity } from './odontology-encounter.entity';
import { OdontologyEncounterAuditEntity } from './odontology-encounter-audit.entity';
import { OdontologyService } from './odontology.service';
import { OdontologyEncounterService } from './odontology-encounter.service';
import { OdontologyEncounterAuditService } from './odontology-encounter-audit.service';
import { OdontologyController } from './odontology.controller';
import { OdontologyEncounterController } from './odontology-encounter.controller';
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
  imports: [TypeOrmModule.forFeature([OdontologyResourceEntity, OdontologyEncounterEntity, OdontologyEncounterAuditEntity, PatientEntity, AppointmentEntity])],
  providers: [OdontologyService, OdontologyEncounterService, OdontologyEncounterAuditService, OdontologyPdfService],
  controllers: [OdontologyController, OdontologyEncounterController],
  exports: [OdontologyService, OdontologyEncounterService, OdontologyPdfService],
})
export class OdontologyModule {}
