import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Auditoría INMUTABLE de la visita/encuentro odontológico.
 * Cada acto sensible (apertura, firma, cancelación, addenda) queda imputable a un actor.
 * La firma de la visita tiene valor médico-legal → trazabilidad obligatoria (ePHI).
 * Compatible con el recurso AuditEvent de HL7 FHIR R4.
 */
@Entity('odontology_encounter_audit_log')
@Index('idx_odo_enc_audit_enc', ['encounterId'])
export class OdontologyEncounterAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'encounter_id', type: 'uuid' })
  encounterId: string;

  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** sub del JWT del actor. */
  @Column({ name: 'actor_id', type: 'varchar', nullable: true })
  actorId: string | null;

  /** Nombre legible del actor (preferred_username). */
  @Column({ name: 'actor_name', type: 'varchar', nullable: true })
  actorName: string | null;

  /** 'OPEN' | 'SIGN' | 'CANCEL' | 'ADDENDA' */
  @Column({ type: 'varchar' })
  action: string;

  /** Snapshot del estado del encuentro al momento de la acción. */
  @Column({ name: 'payload_snapshot', type: 'jsonb', nullable: true })
  payloadSnapshot: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
