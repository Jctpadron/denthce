import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';

@Entity('clinica_presupuesto_items')
export class ClinicalPresupuestoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'presupuesto_id' })
  presupuestoId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'snomed_code', length: 50 })
  snomedCode: string;

  @Column({ name: 'snomed_display', length: 255 })
  snomedDisplay: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  diente?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cara?: string | null;

  @Column({ default: 1 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'precio_unitario' })
  precioUnitario: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ default: 0 })
  orden: number;

  @ManyToOne(() => ClinicalPresupuesto, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto: ClinicalPresupuesto;
}
