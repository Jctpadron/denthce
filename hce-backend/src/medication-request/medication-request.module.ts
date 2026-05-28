import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationRequestService } from './medication-request.service';
import { MedicationRequestController } from './medication-request.controller';
import { MedicationRequestEntity } from './medication-request.entity';
import { ClinicalResourceEntity } from '../patient/clinical-resource.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicationRequestEntity, ClinicalResourceEntity])
  ],
  controllers: [MedicationRequestController],
  providers: [MedicationRequestService],
  exports: [MedicationRequestService]
})
export class MedicationRequestModule {}
