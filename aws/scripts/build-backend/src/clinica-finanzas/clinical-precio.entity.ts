import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('clinica_precios')
export class ClinicalPrecio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'snomed_code', length: 50 })
  snomedCode: string;

  @Column({ name: 'snomed_display', length: 255 })
  snomedDisplay: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
