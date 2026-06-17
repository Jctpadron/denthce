import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { PatientEntity } from '../patient/patient.entity';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantConfigEntity, PatientEntity])],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
