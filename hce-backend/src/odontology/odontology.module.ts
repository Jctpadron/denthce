import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyService } from './odontology.service';
import { OdontologyController } from './odontology.controller';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { OdontologyPdfService } from './odontology-pdf.service';

/**
 * Módulo AISLADO de la Historia Clínica Odontológica.
 * Tiene su propia tabla (odontology_clinical_resources). Importa PatientEntity
 * solo en modo lectura para validar la pertenencia del paciente al tenant, y
 * AppointmentEntity (lectura) para derivar la "última visita" en la grilla.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OdontologyResourceEntity, PatientEntity, AppointmentEntity])],
  providers: [OdontologyService, OdontologyPdfService],
  controllers: [OdontologyController],
  exports: [OdontologyService, OdontologyPdfService],
})
export class OdontologyModule {}
