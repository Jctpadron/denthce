import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantModuleEntity } from './tenant-module.entity';
import { PlatformModuleEntity } from './platform-module.entity';

/**
 * ModulesService — fuente de verdad de los entitlements (qué módulo tiene contratado cada clínica).
 *
 * El HCE es el producto base; un módulo (WhatsApp, etc.) solo opera si la clínica lo contrató
 * y la contratación está vigente. Los gates de los módulos consultan `isEnabled()`.
 */
@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(TenantModuleEntity)
    private readonly tenantModuleRepo: Repository<TenantModuleEntity>,
    @InjectRepository(PlatformModuleEntity)
    private readonly platformModuleRepo: Repository<PlatformModuleEntity>,
  ) {}

  /**
   * ¿La clínica tiene el módulo activo AHORA?
   * Activo = existe la fila, enabled=true y no está vencida (expires_at null o futuro).
   * Sin fila (no contratado) → false.
   */
  async isEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    if (!tenantId) return false;
    const tm = await this.tenantModuleRepo.findOne({ where: { tenantId, moduleKey } });
    if (!tm || !tm.enabled) return false;
    if (tm.expiresAt && tm.expiresAt.getTime() <= Date.now()) return false;
    return true;
  }

  /** Lista las keys de los módulos activos de una clínica (para el dashboard / front). */
  async enabledModules(tenantId: string): Promise<string[]> {
    const rows = await this.tenantModuleRepo.find({ where: { tenantId, enabled: true } });
    const now = Date.now();
    return rows
      .filter((r) => !r.expiresAt || r.expiresAt.getTime() > now)
      .map((r) => r.moduleKey);
  }

  /** Catálogo completo de módulos contratables. */
  async catalog(): Promise<PlatformModuleEntity[]> {
    return this.platformModuleRepo.find({ order: { isBase: 'DESC', key: 'ASC' } });
  }
}
