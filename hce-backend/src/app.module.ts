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
      entities: [PatientEntity, PatientAuditEntity, ClinicalResourceEntity, TenantConfigEntity, EncounterEntity, MedicationRequestEntity],
      synchronize: false,
      logging: true,
    }),
    AuthModule,
    PatientModule,
    TenantModule,
    SisaModule,
    EncounterModule,
    MedicationRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


