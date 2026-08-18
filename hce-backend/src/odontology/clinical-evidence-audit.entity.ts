import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Auditoría INMUTABLE (append-only) de evidencia clínica sensible: firma de conformidad del paciente
 * y adjuntos (RX/PDF). Polimórfica (entity_type/entity_id) para servir a firma y adjuntos, con o sin
 * encounter. Registra ESCRITURA y DESCARGA de ePHI (regla del gate de seguridad).
 * Compatible con el recurso AuditEvent de HL7 FHIR R4. Inmutable por trigger (ver migración 20260727_1600).
 */
export type EvidenceAuditAction =
  | 'PATIENT_SIGN'
  | 'PATIENT_SIGN_VIEW'
  | 'PATIENT_SIGN_SUPERSEDE'
  | 'ATTACH_UPLOAD'
  | 'ATTACH_DOWNLOAD'
  | 'ATTACH_DELETE';

@Entity('clinical_evidence_audit_log')
@Index('idx_evidence_audit_tenant_entity', [
  'tenantId',
  'entityType',
  'entityId',
])
@Index('idx_evidence_audit_tenant_patient', ['tenantId', 'patientId'])
export class ClinicalEvidenceAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  /** 'patient_signature' | 'clinical_attachment' */
  @Column({ name: 'entity_type', type: 'varchar' })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar' })
  action: EvidenceAuditAction;

  @Column({ name: 'actor_id', type: 'varchar' })
  actorId: string;

  @Column({ name: 'actor_name', type: 'varchar', nullable: true })
  actorName: string | null;

  @Column({ name: 'source_ip', type: 'varchar', nullable: true })
  sourceIp: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
