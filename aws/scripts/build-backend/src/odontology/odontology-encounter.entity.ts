import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * ENCUENTRO / VISITA ODONTOLÓGICA (módulo aislado).
 *
 * Tabla PROPIA `odontology_encounters`, separada de `fhir_encounters` (que usa la
 * HC original SOAP). Decisión de diseño (docs/design/encuentro-odontologico-modelo.md):
 * el módulo odontológico es deliberadamente aislado, así que no se reutiliza la
 * entidad de la HC original — se replica el patrón de firma/inmutabilidad.
 *
 * Representa una sesión clínica (visita) compatible con el recurso FHIR R4 Encounter:
 * se ABRE (status in-progress, period.start), se le asocian las prestaciones del
 * odontograma/evolución (odontology_clinical_resources.encounter_id), y se CIERRA con
 * firma (status finished, period.end, content_hash) → inmutable; correcciones por addenda.
 */
@Entity('odontology_encounters')
@Index('idx_odo_enc_tenant_patient', ['tenantId', 'patientId'])
@Index('idx_odo_enc_tenant_patient_status', ['tenantId', 'patientId', 'status'])
@Index('idx_odo_enc_appointment', ['appointmentId'])
export class OdontologyEncounterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** Vínculo opcional al turno (FK lógica a fhir_appointments). Null = atención sin cita (walk-in). */
  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /**
   * Estado FHIR del encuentro:
   * 'in-progress' → visita abierta (editable)
   * 'finished'    → firmada y bloqueada
   * 'cancelled'   → cancelada
   */
  @Column({ default: 'in-progress' })
  status: string;

  /** Clase del encuentro FHIR: 'AMB' (ambulatorio), 'URG', 'CTRL'. */
  @Column({ name: 'class_code', default: 'AMB' })
  classCode: string;

  /** Motivo de consulta libre de la sesión. */
  @Column({ name: 'reason_text', type: 'text', nullable: true })
  reasonText: string | null;

  /** period.start = apertura de la visita. */
  @Column({ name: 'start_date', type: 'timestamp with time zone' })
  startDate: Date;

  /** period.end = cierre/firma de la visita. */
  @Column({ name: 'end_date', type: 'timestamp with time zone', nullable: true })
  endDate: Date | null;

  /** Recurso FHIR R4 Encounter completo en JSONB. */
  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  /** Profesional que firmó (preferred_username, legible). */
  @Column({ name: 'signed_by', type: 'varchar', nullable: true })
  signedBy: string | null;

  /** Identificador estable del firmante (sub del JWT) — trazabilidad legal. */
  @Column({ name: 'signed_by_id', type: 'varchar', nullable: true })
  signedById: string | null;

  @Column({ name: 'signed_at', type: 'timestamp with time zone', nullable: true })
  signedAt: Date | null;

  /** SHA-256 del set de prestaciones + motivo + apertura, calculado al firmar (integridad). */
  @Column({ name: 'content_hash', type: 'varchar', nullable: true })
  contentHash: string | null;

  /** Correcciones post-firma (append-only). No alteran lo firmado. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  addenda: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
