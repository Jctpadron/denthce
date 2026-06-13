import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * PlatformModuleEntity (`platform_modules`) — catálogo de módulos/servicios contratables.
 *
 * El HCE es el producto base; cada módulo (WhatsApp, Agenda, Odontología PAMI...) es un
 * servicio que una clínica puede tener contratado o no. Esta tabla es el catálogo maestro
 * (independiente de qué clínica lo contrató — eso vive en `tenant_modules`).
 */
@Entity('platform_modules')
export class PlatformModuleEntity {
  /** Clave estable del módulo (ej. 'whatsapp', 'agenda', 'hc-base', 'odontologia-pami'). */
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Precio mensual de referencia (informativo; el cobro real lo maneja billing externo). */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price: number | null;

  /** Si el módulo está disponible para contratar (false = "próximamente" / deshabilitado). */
  @Column({ type: 'boolean', default: true })
  available: boolean;

  /** Si es parte del producto base (no se puede dar de baja, ej. 'hc-base'). */
  @Column({ name: 'is_base', type: 'boolean', default: false })
  isBase: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
