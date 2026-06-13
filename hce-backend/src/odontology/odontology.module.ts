import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { OdontologyService } from './odontology.service';
import { OdontologyController } from './odontology.controller';
import { PatientEntity } from '../patient/patient.entity';
import { OdontologyPdfService } from './odontology-pdf.service';

/**
 * Módulo AISLADO de la Historia Clínica Odontológica.
 * Tiene su propia tabla (odontology_clinical_resources). Importa PatientEntity
 * solo en modo lectura para validar la pertenencia del paciente al tenant.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OdontologyResourceEntity, PatientEntity])],
  providers: [OdontologyService, OdontologyPdfService],
  controllers: [OdontologyController],
  exports: [OdontologyService, OdontologyPdfService],
})
export class OdontologyModule {}
