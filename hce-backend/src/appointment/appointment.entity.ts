import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * AppointmentEntity — Módulo 5, Tarea 5.1
 * Recurso FHIR R4 `Appointment`. Representa un turno reservado (origen WhatsApp/CliniChat o recepción).
 * Tenant-scoped (Zero Trust). El `payload` JSONB guarda el recurso FHIR completo; las columnas
 * desnormalizadas existen para indexar las búsquedas frecuentes (agenda diaria, por paciente, por profesional).
 */
@Entity('fhir_appointments')
@Index('idx_appt_tenant_start', ['tenantId', 'startDate'])
@Index('idx_appt_tenant_patient', ['tenantId', 'patientId'])
@Index('idx_appt_tenant_practitioner', ['tenantId', 'practitionerRef'])
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  /** UUID del PatientEntity del HCE (resuelto por (dni, gender)). Null si el paciente aún no existe. */
  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  /** DNI desnormalizado para trazabilidad y reconciliación con CliniChat. */
  @Column({ name: 'patient_dni', type: 'varchar', nullable: true })
  patientDni: string | null;

  /**
   * Estado FHIR R4 Appointment.status:
   * 'proposed' → sugerido por la IA, sin confirmar
   * 'booked'   → reservado/confirmado
   * 'arrived'  → el paciente llegó
   * 'fulfilled'→ atendido (cumplido)
   * 'cancelled'→ cancelado
   * 'noshow'   → ausente
   */
  @Column({ type: 'varchar', default: 'booked' })
  status: string;

  /** Referencia ligera al profesional. */
  @Column({ name: 'practitioner_ref', type: 'varchar', nullable: true })
  practitionerRef: string | null;

  /** Nombre desnormalizado del profesional para mostrar en grilla sin join. */
  @Column({ name: 'practitioner_name', type: 'varchar', nullable: true })
  practitionerName: string | null;

  /** Especialidad / tipo de servicio (texto libre; mapea a Appointment.serviceType). */
  @Column({ name: 'service_type', type: 'varchar', nullable: true })
  serviceType: string | null;

  /** Inicio del turno (Appointment.start). */
  @Column({ name: 'start_date', type: 'timestamp with time zone' })
  startDate: Date;

  /** Fin del turno (Appointment.end). Obligatorio en FHIR si status booked/arrived/fulfilled. */
  @Column({ name: 'end_date', type: 'timestamp with time zone', nullable: true })
  endDate: Date | null;

  /** Canal de origen: 'whatsapp' | 'recepcion' | 'portal'. Para auditoría y reconciliación. */
  @Column({ name: 'origin_channel', type: 'varchar', default: 'recepcion' })
  originChannel: string;

  /** Clave de idempotencia provista por el cliente (CliniChat) para evitar turnos duplicados por reintentos. */
  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true, unique: true })
  idempotencyKey: string | null;

  /** Motivo de cancelación (Appointment.cancelationReason), cuando status='cancelled'. */
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  /** Recurso FHIR R4 Appointment completo en JSONB. */
  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
