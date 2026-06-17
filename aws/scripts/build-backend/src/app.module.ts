import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PatientModule } from './patient/patient.module';
import { AuthModule } from './auth/auth.module';
import { PatientEntity } from './patient/patient.entity';
import { PatientAuditEntity } from './patient/patient-audit.entity';
import { ClinicalResourceEntity } from './patient/clinical-resource.entity';
import { TenantModule } from './tenant/tenant.module';
import { TenantConfigEntity } from './tenant/tenant-config.entity';
import { SisaModule } from './sisa/sisa.module';
import { EncounterModule } from './encounter/encounter.module';
import { EncounterEntity } from './encounter/encounter.entity';
import { MedicationRequestModule } from './medication-request/medication-request.module';
import { MedicationRequestEntity } from './medication-request/medication-request.entity';
import { OdontologyModule } from './odontology/odontology.module';
import { OdontologyResourceEntity } from './odontology/odontology-resource.entity';
import { OdontologyEncounterEntity } from './odontology/odontology-encounter.entity';
import { OdontologyEncounterAuditEntity } from './odontology/odontology-encounter-audit.entity';
import { AppointmentModule } from './appointment/appointment.module';
import { AppointmentEntity } from './appointment/appointment.entity';
import { AppointmentAuditEntity } from './appointment/appointment-audit.entity';
import { SlotModule } from './slot/slot.module';
import { PlatformModuleEntity } from './platform/platform-module.entity';
import { TenantModuleEntity } from './platform/tenant-module.entity';
import { PlatformModule } from './platform/platform.module';
import { SuperAdminModule } from './superadmin/superadmin.module';
import { InsuranceModule } from './insurance/insurance.module';
import { InsuranceCompanyEntity } from './insurance/insurance-company.entity';
import { PatientCoverageEntity } from './insurance/patient-coverage.entity';
import { ProtesisModule } from './protesis/protesis.module';
import { ProtesisOrder } from './protesis/protesis-order.entity';
import { ProtesisChat } from './protesis/protesis-chat.entity';
import { ProtesisInsumo } from './protesis/protesis-insumo.entity';
import { ProtesisStatusHistory } from './protesis/protesis-status-history.entity';
import { ProtesisPago } from './protesis/protesis-pago.entity';
import { ProtesisConsumoInsumo } from './protesis/protesis-consumo-insumo.entity';
import { ClinicaFinanzasModule } from './clinica-finanzas/clinica-finanzas.module';
import { ClinicalPrecio } from './clinica-finanzas/clinical-precio.entity';
import { ClinicalPresupuesto } from './clinica-finanzas/clinical-presupuesto.entity';
import { ClinicalPresupuestoItem } from './clinica-finanzas/clinical-presupuesto-item.entity';
import { ClinicalPago } from './clinica-finanzas/clinical-pago.entity';
import { ClinicalGasto } from './clinica-finanzas/clinical-gasto.entity';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'hce_admin',
      password: process.env.DB_PASSWORD || 'hce_secure_password_2026',
      database: process.env.DB_NAME || 'hce_fhir',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      entities: [
        PatientEntity, 
        PatientAuditEntity, 
        ClinicalResourceEntity, 
        TenantConfigEntity, 
        EncounterEntity, 
        MedicationRequestEntity, 
        OdontologyResourceEntity,
        OdontologyEncounterEntity,
        OdontologyEncounterAuditEntity,
        AppointmentEntity,
        AppointmentAuditEntity,
        PlatformModuleEntity,
        TenantModuleEntity,
        InsuranceCompanyEntity,
        PatientCoverageEntity,
        ProtesisOrder,
        ProtesisChat,
        ProtesisInsumo,
        ProtesisStatusHistory,
        ProtesisPago,
        ProtesisConsumoInsumo,
        ClinicalPrecio,
        ClinicalPresupuesto,
        ClinicalPresupuestoItem,
        ClinicalPago,
        ClinicalGasto
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
    }),
    AuthModule,
    PatientModule,
    TenantModule,
    SisaModule,
    EncounterModule,
    MedicationRequestModule,
    OdontologyModule,
    AppointmentModule,
    SlotModule,
    PlatformModule,
    SuperAdminModule,
    InsuranceModule,
    ProtesisModule,
    ClinicaFinanzasModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}




