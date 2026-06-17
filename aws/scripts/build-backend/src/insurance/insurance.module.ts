import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceCompanyEntity } from './insurance-company.entity';
import { PatientCoverageEntity } from './patient-coverage.entity';
import { InsuranceService } from './insurance.service';
import { InsuranceController } from './insurance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceCompanyEntity, PatientCoverageEntity])],
  providers: [InsuranceService],
  controllers: [InsuranceController],
  exports: [InsuranceService],
})
export class InsuranceModule {}
