import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProtesisOrder } from './protesis-order.entity';

@Entity('protesis_status_history')
export class ProtesisStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'from_status', type: 'varchar', length: 50, nullable: true })
  fromStatus?: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 50 })
  toStatus: string;

  @Column({ name: 'changed_by', type: 'varchar' })
  changedBy: string;

  @Column({ name: 'changed_by_name', type: 'varchar', nullable: true })
  changedByName?: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'clinica' })
  actorType: string;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ProtesisOrder, (order) => order.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: ProtesisOrder;
}
