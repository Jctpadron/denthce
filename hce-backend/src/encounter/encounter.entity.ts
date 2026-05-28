import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * EncounterEntity — Tarea 3.1
 * Representa una consulta/episodio clínico compatible con el recurso Encounter de HL7 FHIR R4.
 * Almacena el registro completo de una visita médica incluyendo la nota SOAP y firma digital lógica.
 */
@Entity('fhir_encounters')
export class EncounterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  /**
   * Estado FHIR del encuentro:
   * 'in-progress'  → Borrador (aún editable)
   * 'finished'     → Firmado y bloqueado
   * 'cancelled'    → Cancelado
   */
  @Column({ default: 'in-progress' })
  status: string;

  /**
   * Clase del encuentro:
   * 'AMB'   → Ambulatorio
   * 'URG'   → Urgencias
   * 'CTRL'  → Control / Seguimiento
   * 'INTER' → Interconsulta
   */
  @Column({ name: 'class_code', default: 'AMB' })
  classCode: string;

  @Column({ name: 'start_date', type: 'timestamp with time zone', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp with time zone', nullable: true })
  endDate: Date;

  /** Recurso FHIR Encounter R4 completo en formato JSONB */
  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  /** Nombre del profesional que firmó la nota */
  @Column({ name: 'signed_by', nullable: true })
  signedBy: string;

  /** Fecha y hora de la firma */
  @Column({ name: 'signed_at', type: 'timestamp with time zone', nullable: true })
  signedAt: Date;

  /** Hash SHA-256 del contenido SOAP al momento de la firma (integridad) */
  @Column({ name: 'content_hash', nullable: true })
  contentHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
