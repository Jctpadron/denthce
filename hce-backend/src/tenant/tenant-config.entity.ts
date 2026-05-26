import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  // Firma Digital
  @Column({ name: 'signature_url', nullable: true })
  signatureUrl: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
