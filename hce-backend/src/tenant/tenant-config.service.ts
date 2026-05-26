import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantConfigEntity } from './tenant-config.entity';

@Injectable()
export class TenantConfigService {
  constructor(
    @InjectRepository(TenantConfigEntity)
    private readonly repo: Repository<TenantConfigEntity>,
  ) {}

  async getConfig(tenantId: string): Promise<TenantConfigEntity> {
    let config = await this.repo.findOne({ where: { tenantId } });
    if (!config) {
      // Crear configuración por defecto para el tenant
      config = this.repo.create({ tenantId });
      await this.repo.save(config);
    }
    return config;
  }

  async updateConfig(
    tenantId: string,
    dto: Partial<TenantConfigEntity>,
  ): Promise<TenantConfigEntity> {
    let config = await this.repo.findOne({ where: { tenantId } });
    if (!config) {
      config = this.repo.create({ tenantId });
    }
    // Nunca permitir sobrescribir el tenantId
    delete dto.tenantId;
    Object.assign(config, dto);
    return this.repo.save(config);
  }

  async saveLogoUrl(tenantId: string, logoUrl: string): Promise<TenantConfigEntity> {
    return this.updateConfig(tenantId, { logoUrl });
  }

  async saveSignatureUrl(tenantId: string, signatureUrl: string): Promise<TenantConfigEntity> {
    return this.updateConfig(tenantId, { signatureUrl });
  }
}
