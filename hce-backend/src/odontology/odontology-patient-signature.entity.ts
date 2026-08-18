import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Firma de conformidad del PACIENTE por prestación realizada (evidencia médico-legal, append-only).
 * Una fila por firma manuscrita (canvas → PNG). El blob vive en almacén privado; la DB guarda puntero + hash.
 * Inmutabilidad reforzada por trigger de Postgres (ver migración 20260727_1600).
 * Mapea a FHIR Provenance + datatype Signature (código ASTM "Consent Signature").
 * Diseño: docs/design/firma-conformidad-paciente-modelo-datos.md
 */
@Entity('odontology_patient_signatures')
@Index('idx_odo_patsig_tenant_resource', ['tenantId', 'resourceId'])
@Index('idx_odo_patsig_tenant_encounter', ['tenantId', 'encounterId'])
@Index('idx_odo_patsig_tenant_patient', ['tenantId', 'patientId'])
export class OdontologyPatientSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** Procedure firmado (FK lógica a odontology_clinical_resources.id). La firma es POR prestación. */
  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  /** Visita donde se firmó (FK lógica). Nullable = prestación suelta/legacy. */
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  // --- Puntero al blob (NUNCA el blob en DB), almacén privado ---
  @Column({ name: 'storage_backend', type: 'varchar', default: 'local' })
  storageBackend: string;

  @Column({ name: 'storage_key', type: 'varchar' })
  storageKey: string;

  @Column({ name: 'mime_type', type: 'varchar', default: 'image/png' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer', nullable: true })
  sizeBytes: number | null;

  // --- Integridad / no repudio ---
  @Column({ name: 'content_hash', type: 'varchar' })
  contentHash: string;

  @Column({ name: 'hash_algo', type: 'varchar', default: 'SHA-256' })
  hashAlgo: string;

  /** Snapshot inmutable de lo firmado (el Procedure es mutable). Sin esto la firma no tiene valor probatorio. */
  @Column({ name: 'signed_content_snapshot', type: 'jsonb' })
  signedContentSnapshot: any;

  @Column({ name: 'snapshot_hash', type: 'varchar', nullable: true })
  snapshotHash: string | null;

  @Column({ name: 'signed_at', type: 'timestamp with time zone' })
  signedAt: Date;

  @Column({ name: 'captured_by_id', type: 'varchar' })
  capturedById: string;

  @Column({ name: 'captured_by_name', type: 'varchar', nullable: true })
  capturedByName: string | null;

  @Column({ name: 'device_info', type: 'varchar', nullable: true })
  deviceInfo: string | null;

  @Column({ name: 'source_ip', type: 'varchar', nullable: true })
  sourceIp: string | null;

  // --- Mapeo FHIR (valores fijos hoy → default de columna, no hardcode) ---
  @Column({
    name: 'signature_type_system',
    type: 'varchar',
    default: 'urn:iso-astm:E1762-95:2013',
  })
  signatureTypeSystem: string;

  @Column({
    name: 'signature_type_code',
    type: 'varchar',
    default: '1.2.840.10065.1.12.1.7',
  })
  signatureTypeCode: string;

  @Column({ name: 'sig_format', type: 'varchar', default: 'image/png' })
  sigFormat: string;

  @Column({ name: 'fhir_meta', type: 'jsonb', nullable: true })
  fhirMeta: any;

  // --- Ciclo de vida append-only ---
  @Column({ name: 'superseded_by', type: 'uuid', nullable: true })
  supersededBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
