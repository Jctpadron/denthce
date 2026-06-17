import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProtesisOrder } from './protesis-order.entity';
import { ProtesisInsumo } from './protesis-insumo.entity';

@Entity('protesis_consumo_insumos')
export class ProtesisConsumoInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'insumo_id' })
  insumoId: string;

  @Column({ type: 'float' })
  cantidad: number;

  @Column({ name: 'costo_unitario', type: 'decimal', precision: 10, scale: 2 })
  costoUnitario: number;

  @Column({ name: 'costo_total', type: 'decimal', precision: 10, scale: 2 })
  costoTotal: number;

  @Column({ length: 200, nullable: true })
  lote?: string;

  @Column({ name: 'registrado_por', length: 100, nullable: true })
  registradoPor?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ProtesisOrder, (order) => order.consumos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: ProtesisOrder;

  @ManyToOne(() => ProtesisInsumo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insumo_id' })
  insumo: ProtesisInsumo;
}
