import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { ProtesisChat } from './protesis-chat.entity';
import { ProtesisStatusHistory } from './protesis-status-history.entity';
import { ProtesisPago } from './protesis-pago.entity';
import { ProtesisConsumoInsumo } from './protesis-consumo-insumo.entity';

@Entity('protesis_orders')
export class ProtesisOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId?: string | null; // Clínica emisora

  @Column({ name: 'performer_tenant_id' })
  performerTenantId: string; // Laboratorio receptor

  @Column({ name: 'patient_id', type: 'varchar', nullable: true })
  patientId?: string | null; // Referencia al recurso FHIR Patient

  @Column({ name: 'is_manual', type: 'boolean', default: false })
  isManual: boolean;

  @Column({ name: 'patient_name', type: 'varchar', nullable: true })
  patientName?: string | null;

  @Column({ name: 'doctor_name', type: 'varchar', nullable: true })
  doctorName?: string | null;

  @Column({ name: 'doctor_matricula', type: 'varchar', nullable: true })
  doctorMatricula?: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'received',
  })
  status: string; // received | designing | processing | ceramic | ready | delivered | cancelled

  @Column({ type: 'jsonb', name: 'dental_work' })
  dentalWork: {
    workType: string;
    material: string;
    color: string;
    teeth: number[];
    notes?: string;
  };

  @Column({ type: 'timestamp', name: 'requested_delivery', nullable: true })
  requestedDelivery?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'jsonb', name: 'trazabilidad', nullable: true })
  trazabilidad?: {
    technicianName?: string;
    materialLot?: string;
    materialBrand?: string;
    aditamentos?: { type: string; brand: string; lot: string }[];
  } | null;

  @Column({ type: 'jsonb', name: 'conformidad', nullable: true })
  conformidad?: {
    signedAt: string;
    signedBy: string;
    declaracionDoc: string;
    hash: string;
    isSigned: boolean;
  } | null;

  // --- Campos financieros ---
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'presupuesto_estimado', nullable: true })
  presupuestoEstimado?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'presupuesto_final', nullable: true })
  presupuestoFinal?: number | null;

  @Column({ type: 'date', name: 'fecha_vencimiento', nullable: true })
  fechaVencimiento?: Date | null;

  @Column({ length: 20, name: 'estado_pago', default: 'pending' })
  estadoPago: string; // pending | partial | paid | overdue

  // --- Relaciones ---
  @OneToMany(() => ProtesisChat, (chat) => chat.order, { cascade: true })
  messages: ProtesisChat[];

  @OneToMany(() => ProtesisStatusHistory, (history) => history.order, { cascade: true })
  statusHistory: ProtesisStatusHistory[];

  @OneToMany(() => ProtesisPago, (pago) => pago.order, { cascade: true })
  pagos: ProtesisPago[];

  @OneToMany(() => ProtesisConsumoInsumo, (consumo) => consumo.order, { cascade: true })
  consumos: ProtesisConsumoInsumo[];
}
