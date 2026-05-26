import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientEntity } from './patient.entity';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { ClinicalResourceEntity } from './clinical-resource.entity';
import { ClinicalResourceService } from './clinical-resource.service';
import { ClinicalResourceController } from './clinical-resource.controller';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';

@Module({
  imports: [TypeOrmModule.forFeature([PatientEntity, ClinicalResourceEntity])],
  providers: [PatientService, ClinicalResourceService, FileUploadService],
  controllers: [PatientController, ClinicalResourceController, FileUploadController],
  exports: [PatientService, ClinicalResourceService, FileUploadService],
})
export class PatientModule {}
