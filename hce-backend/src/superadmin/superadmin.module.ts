import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';
import { ClinichatOrchestrationService } from './clinichat-orchestration.service';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { TenantModuleEntity } from '../platform/tenant-module.entity';
import { PlatformModuleEntity } from '../platform/platform-module.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { KeycloakAdminService } from '../tenant/keycloak-admin.service';

/**
 * SuperAdminModule — API cross-tenant de gestión de la plataforma (clínicas + módulos).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantConfigEntity,
      TenantModuleEntity,
      PlatformModuleEntity,
      PatientEntity,
      AppointmentEntity,
    ]),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, KeycloakAdminService, ClinichatOrchestrationService],
})
export class SuperAdminModule {}
