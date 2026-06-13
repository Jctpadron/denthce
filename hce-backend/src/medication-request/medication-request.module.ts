import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationRequestService } from './medication-request.service';
import { MedicationRequestController } from './medication-request.controller';
import { MedicationRequestSummaryController } from './medication-request-summary.controller';
import { MedicationRequestEntity } from './medication-request.entity';
import { ClinicalResourceEntity } from '../patient/clinical-resource.entity';
import { PatientEntity } from '../patient/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicationRequestEntity, ClinicalResourceEntity, PatientEntity])
  ],
  controllers: [MedicationRequestController, MedicationRequestSummaryController],
  providers: [MedicationRequestService],
  exports: [MedicationRequestService]
})
export class MedicationRequestModule {}
