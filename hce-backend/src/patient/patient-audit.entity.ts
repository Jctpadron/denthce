import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * PatientAuditEntity — Tarea 2.4
 * Tabla de auditoría inmutable para trazabilidad de cambios demográficos de pacientes.
 * Compatible con el recurso AuditEvent de HL7 FHIR R4.
 */
@Entity('patient_audit_log')
export class PatientAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'user_name', nullable: true })
  userName: string;

  /** 'CREATE' | 'UPDATE' */
  @Column()
  action: string;

  /**
   * Diff de campos demográficos en formato JSONB:
   * { fieldName: { before: '...', after: '...' } }
   */
  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields: Record<string, { before: any; after: any }>;

  /** Snapshot del payload FHIR completo al momento del cambio */
  @Column({ name: 'payload_snapshot', type: 'jsonb', nullable: true })
  payloadSnapshot: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
