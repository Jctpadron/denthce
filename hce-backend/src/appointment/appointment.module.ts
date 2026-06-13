import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { AppointmentEntity } from './appointment.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentAuditService } from './appointment-audit.service';
import { AppointmentAuditEntity } from './appointment-audit.entity';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppointmentEntity, PatientEntity, AppointmentAuditEntity]),
    WebhookModule,
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, AppointmentAuditService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
