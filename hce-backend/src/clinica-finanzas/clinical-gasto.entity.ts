import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('clinica_gastos')
export class ClinicalGasto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ length: 50 })
  categoria: string;

  @Column({ length: 255 })
  descripcion: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({ name: 'fecha_gasto', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaGasto: Date;

  @Column({ name: 'metodo_pago', length: 50 })
  metodoPago: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  comprobante?: string | null;

  @Column({ type: 'varchar', name: 'insumo_id', nullable: true })
  insumoId?: string | null;

  @Column({ type: 'varchar', name: 'registered_by', length: 100, nullable: true })
  registeredBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
