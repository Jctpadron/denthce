import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * TenantModuleEntity (`tenant_modules`) — entitlements: qué módulos contrató cada clínica.
 *
 * Relaciona un tenant (clínica) con un módulo del catálogo `platform_modules`, con su estado
 * (enabled) y vigencia (activated_at / expires_at). Clave primaria compuesta (tenant_id, module_key)
 * para que una clínica no pueda tener el mismo módulo duplicado.
 *
 * "Anexar un servicio" = upsert con enabled=true. "Dar de baja" = enabled=false.
 */
@Entity('tenant_modules')
@Index('idx_tenant_modules_tenant', ['tenantId'])
export class TenantModuleEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  /** Clave del módulo (FK lógica a platform_modules.key). */
  @PrimaryColumn({ name: 'module_key', type: 'varchar' })
  moduleKey: string;

  /** Si el módulo está activo para esta clínica ahora mismo. */
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'activated_at', type: 'timestamp with time zone', nullable: true })
  activatedAt: Date | null;

  /** Vencimiento de la contratación. Null = sin vencimiento. Pasado = se considera inactivo. */
  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
