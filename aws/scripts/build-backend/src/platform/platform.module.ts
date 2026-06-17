import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModuleEntity } from './platform-module.entity';
import { TenantModuleEntity } from './tenant-module.entity';
import { ModulesService } from './modules.service';

/**
 * PlatformModule — entitlements de módulos/servicios por clínica.
 * Exporta ModulesService para que otros módulos (Appointment, etc.) gateen sus features.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PlatformModuleEntity, TenantModuleEntity])],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class PlatformModule {}
