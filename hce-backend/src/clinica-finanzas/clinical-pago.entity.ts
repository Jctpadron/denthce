import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';

@Entity('clinica_pagos')
export class ClinicalPago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ type: 'varchar', name: 'presupuesto_id', nullable: true })
  presupuestoId?: string | null;

  @Column({ length: 20 })
  tipo: string; // senha | cuota | pago_directo

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({ name: 'metodo_pago', length: 50 })
  metodoPago: string;

  @Column({ name: 'fecha_pago', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaPago: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  comprobante?: string | null;

  @Column({ type: 'text', nullable: true })
  notas?: string | null;

  @Column({ type: 'varchar', name: 'registered_by', length: 100, nullable: true })
  registeredBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ClinicalPresupuesto, (p) => p.pagos, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto?: ClinicalPresupuesto | null;
}
