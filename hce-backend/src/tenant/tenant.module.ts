import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfigEntity } from './tenant-config.entity';
import { TenantConfigService } from './tenant-config.service';
import { TenantConfigController } from './tenant-config.controller';
import { KeycloakAdminService } from './keycloak-admin.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantConfigEntity])],
  providers: [TenantConfigService, KeycloakAdminService],
  controllers: [TenantConfigController, UsersController],
  exports: [TenantConfigService, KeycloakAdminService],
})
export class TenantModule {}
