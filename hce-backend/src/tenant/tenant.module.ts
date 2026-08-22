import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfigEntity } from './tenant-config.entity';
import { TenantConfigService } from './tenant-config.service';
import { TenantConfigController } from './tenant-config.controller';
import { KeycloakAdminService } from './keycloak-admin.service';
import { TenantSignatureService } from './tenant-signature.service';
import { UsersController } from './users.controller';
import { PlatformModule } from '../platform/platform.module';
import { EvidenceStorageService } from '../odontology/evidence-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantConfigEntity]), PlatformModule],
  // EvidenceStorageService se registra acá en vez de importar OdontologyModule entero:
  // es stateless (sólo lee env vars) y traer el módulo completo por un servicio
  // acoplaría tenant a odontología. Pendiente: moverlo a un `common/storage`.
  providers: [
    TenantConfigService,
    KeycloakAdminService,
    TenantSignatureService,
    EvidenceStorageService,
  ],
  controllers: [TenantConfigController, UsersController],
  exports: [TenantConfigService, KeycloakAdminService],
})
export class TenantModule {}
