import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * AppointmentAuditEntity — auditoría inmutable de turnos.
 * Toda creación/cancelación de turno queda imputable a un actor y un canal de origen
 * (especialmente importante para turnos creados por el service-account de WhatsApp/CliniChat).
 * Compatible con el recurso AuditEvent de HL7 FHIR R4.
 */
@Entity('appointment_audit_log')
export class AppointmentAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  /** ID del actor (usuario humano o service-account). */
  @Column({ name: 'actor_id', type: 'varchar', nullable: true })
  actorId: string | null;

  /** Nombre/identificador legible del actor. */
  @Column({ name: 'actor_name', type: 'varchar', nullable: true })
  actorName: string | null;

  /** true si el actor es un service-account (p. ej. clinichat-*). */
  @Column({ name: 'is_service_account', type: 'boolean', default: false })
  isServiceAccount: boolean;

  /** Canal de origen de la acción: 'whatsapp' | 'recepcion' | 'portal'. */
  @Column({ name: 'origin_channel', type: 'varchar', nullable: true })
  originChannel: string | null;

  /** 'CREATE' | 'CANCEL' | 'UPDATE' */
  @Column({ type: 'varchar' })
  action: string;

  /** Snapshot del recurso FHIR al momento de la acción. */
  @Column({ name: 'payload_snapshot', type: 'jsonb', nullable: true })
  payloadSnapshot: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
