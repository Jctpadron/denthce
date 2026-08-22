import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenant_config')
export class TenantConfigEntity {
  @PrimaryColumn({ name: 'tenant_id' })
  tenantId: string;

  // Identidad del Consultorio
  @Column({ name: 'clinic_name', default: 'Mi Consultorio' })
  clinicName: string;

  @Column({ nullable: true })
  specialty: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

  @Column({ name: 'primary_color', default: '#0284c7' })
  primaryColor: string;

  @Column({ name: 'dark_mode', default: false })
  darkMode: boolean;

  // Datos del Profesional
  @Column({ name: 'doctor_name', nullable: true })
  doctorName: string;

  @Column({ name: 'doctor_license', nullable: true })
  doctorLicense: string;

  @Column({ name: 'doctor_title', nullable: true })
  doctorTitle: string;

  // Datos del Consultorio (para recetas)
  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  province: string;

  @Column({ name: 'postal_code', nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  cuit: string;

  @Column({ name: 'health_insurance', nullable: true })
  healthInsurance: string;

  // Horarios de Atención (JSONB)
  @Column({
    name: 'schedule_json',
    type: 'jsonb',
    nullable: true,
    default: () =>
      `'{"lunes":"09:00-18:00","martes":"09:00-18:00","miercoles":"09:00-18:00","jueves":"09:00-18:00","viernes":"09:00-18:00","sabado":"","domingo":""}'`,
  })
  scheduleJson: Record<string, string>;

  // Firma Digital del profesional.
  // `signature_url` YA NO guarda una URL absoluta al estático público: guarda la ruta
  // del endpoint autenticado (`/api/tenant/signature`) y sirve de indicador de "hay firma
  // cargada" para el frontend. El blob vive en el almacén PRIVADO (EvidenceStorageService).
  @Column({ name: 'signature_url', nullable: true })
  signatureUrl: string;

  // Punteros al almacén privado. `select: false` para que no viajen en el GET de config:
  // son metadatos de almacenamiento, no configuración que el frontend deba conocer.
  //
  // `type: 'varchar'` es OBLIGATORIO en las columnas `string | null`: TypeORM infiere el
  // tipo del metadata de TypeScript, y una unión emite `Object`, que Postgres rechaza al
  // arrancar (DataTypeNotSupportedError). Mismo motivo por el que `hceWebhookSecret` lo declara.
  @Column({
    name: 'signature_storage_key',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  signatureStorageKey: string | null;

  /** 'local' | 's3' — con qué backend se guardó, para rutear la lectura. */
  @Column({
    name: 'signature_storage_backend',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  signatureStorageBackend: string | null;

  @Column({
    name: 'signature_content_type',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  signatureContentType: string | null;

  /** SHA-256 del blob: integridad y trazabilidad de la firma profesional. */
  @Column({
    name: 'signature_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  signatureHash: string | null;

  // Integración CliniChat
  @Column({ name: 'hce_webhook_secret', type: 'varchar', nullable: true })
  hceWebhookSecret: string | null;

  // Suscripción / estado de la clínica (Super Admin)
  /** Plan contratado: 'basic' | 'pro' | 'enterprise'. Agrupa el nivel; los módulos finos viven en tenant_modules. */
  @Column({ type: 'varchar', default: 'basic' })
  plan: string;

  /** Clínica activa. Si false, queda suspendida (no opera). */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
