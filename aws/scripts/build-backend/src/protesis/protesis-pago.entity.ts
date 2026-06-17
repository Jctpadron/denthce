import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProtesisOrder } from './protesis-order.entity';

@Entity('protesis_pagos')
export class ProtesisPago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ name: 'fecha_pago', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaPago: Date;

  @Column({ name: 'metodo_pago', length: 50 })
  metodoPago: string;

  @Column({ name: 'comprobante_ref', length: 200, nullable: true })
  comprobanteRef?: string;

  @Column({ type: 'text', nullable: true })
  notas?: string;

  @Column({ name: 'registrado_por', length: 100, nullable: true })
  registradoPor?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ProtesisOrder, (order) => order.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: ProtesisOrder;
}
