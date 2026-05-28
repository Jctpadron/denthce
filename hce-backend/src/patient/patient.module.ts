import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientEntity } from './patient.entity';
import { PatientAuditEntity } from './patient-audit.entity';
import { PatientService } from './patient.service';
import { PatientAuditService } from './patient-audit.service';
import { PatientController } from './patient.controller';
import { ClinicalResourceEntity } from './clinical-resource.entity';
import { ClinicalResourceService } from './clinical-resource.service';
import { ClinicalResourceController } from './clinical-resource.controller';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';

@Module({
  imports: [TypeOrmModule.forFeature([PatientEntity, PatientAuditEntity, ClinicalResourceEntity])],
  providers: [PatientService, PatientAuditService, ClinicalResourceService, FileUploadService],
  controllers: [PatientController, ClinicalResourceController, FileUploadController],
  exports: [PatientService, PatientAuditService, ClinicalResourceService, FileUploadService],
})
export class PatientModule {}

