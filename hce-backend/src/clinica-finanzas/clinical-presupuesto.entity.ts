import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ClinicalPresupuestoItem } from './clinical-presupuesto-item.entity';
import { ClinicalPago } from './clinical-pago.entity';

@Entity('clinica_presupuestos')
export class ClinicalPresupuesto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ length: 20 })
  numero: string;

  @Column({ length: 20, default: 'borrador' })
  estado: string;

  @Column({ name: 'fecha_emision', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaEmision: Date;

  @Column({ name: 'fecha_validez', type: 'date', nullable: true })
  fechaValidez?: Date | null;

  @Column({ name: 'fecha_aceptacion', type: 'timestamp', nullable: true })
  fechaAceptacion?: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'senha_porcentaje', default: 30 })
  senhaPorcentaje: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'senha_monto', nullable: true })
  senhaMonto?: number | null;

  @Column({ type: 'varchar', nullable: true })
  notas?: string | null;

  @Column({ name: 'created_by', length: 100 })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ClinicalPresupuestoItem, (item) => item.presupuesto, { cascade: true })
  items?: ClinicalPresupuestoItem[];

  @OneToMany(() => ClinicalPago, (pago) => pago.presupuesto, { cascade: true })
  pagos?: ClinicalPago[];
}
