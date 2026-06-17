import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProtesisOrder } from './protesis-order.entity';

@Entity('protesis_chats')
export class ProtesisChat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'sender_id' })
  senderId: string; // ID de usuario Keycloak

  @Column({ name: 'sender_name' })
  senderName: string; // Nombre legible del usuario (médico, protesista)

  @Column({ type: 'text', name: 'text_content' })
  textContent: string;

  @Column({ type: 'jsonb', name: 'attachment_meta', nullable: true })
  attachmentMeta?: {
    fileName: string;
    fileUrl: string;
    fileType: string; // stl | png | jpg | pdf
    fileSize?: number;
  } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ProtesisOrder, (order) => order.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: ProtesisOrder;
}
