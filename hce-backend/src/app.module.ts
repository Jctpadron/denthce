import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PatientModule } from './patient/patient.module';
import { AuthModule } from './auth/auth.module';
import { PatientEntity } from './patient/patient.entity';
import { ClinicalResourceEntity } from './patient/clinical-resource.entity';
import { TenantModule } from './tenant/tenant.module';
import { TenantConfigEntity } from './tenant/tenant-config.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'hce_admin',
      password: process.env.DB_PASSWORD || 'hce_secure_password_2026',
      database: process.env.DB_NAME || 'hce_fhir',
      entities: [PatientEntity, ClinicalResourceEntity, TenantConfigEntity],
      synchronize: false,
      logging: true,
    }),
    AuthModule,
    PatientModule,
    TenantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

