import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Adjunto clínico (RX/imagen/PDF) anclado polimórficamente a un presupuesto o a una prestación (Procedure).
 * El blob vive en almacén privado; la DB guarda puntero + hash. Soft-delete (no append-only, a diferencia
 * de la firma). Mapea a FHIR DocumentReference. Diseño: docs/design/adjuntos-presupuesto-ficha-modelo-datos.md
 */
export type AttachmentOwnerType = 'presupuesto' | 'procedure';

@Entity('clinical_attachments')
@Index('idx_clin_attach_owner', ['tenantId', 'ownerType', 'ownerId'])
@Index('idx_clin_attach_tenant_patient', ['tenantId', 'patientId'])
export class ClinicalAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'owner_type', type: 'varchar' })
  ownerType: AttachmentOwnerType;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  // --- Puntero al blob (almacén privado) ---
  @Column({ name: 'storage_backend', type: 'varchar', default: 'local' })
  storageBackend: string;

  @Column({ name: 'storage_key', type: 'varchar' })
  storageKey: string;

  @Column({ type: 'varchar' })
  filename: string;

  @Column({ name: 'mime_type', type: 'varchar' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer', nullable: true })
  sizeBytes: number | null;

  @Column({ type: 'varchar', nullable: true })
  kind: string | null;

  // --- Integridad ---
  @Column({ name: 'content_hash', type: 'varchar' })
  contentHash: string;

  @Column({ name: 'hash_algo', type: 'varchar', default: 'SHA-256' })
  hashAlgo: string;

  // --- Mapeo FHIR DocumentReference ---
  @Column({ name: 'type_system', type: 'varchar', nullable: true })
  typeSystem: string | null;

  @Column({ name: 'type_code', type: 'varchar', nullable: true })
  typeCode: string | null;

  @Column({ name: 'type_display', type: 'varchar', nullable: true })
  typeDisplay: string | null;

  @Column({ name: 'doc_status', type: 'varchar', default: 'final' })
  docStatus: string;

  @Column({ name: 'fhir_extras', type: 'jsonb', nullable: true })
  fhirExtras: any;

  // --- Autoría ---
  @Column({ name: 'uploaded_by', type: 'varchar' })
  uploadedBy: string;

  @Column({ name: 'uploaded_by_name', type: 'varchar', nullable: true })
  uploadedByName: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamp with time zone' })
  uploadedAt: Date;

  // --- Soft-delete ---
  @Column({
    name: 'deleted_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by', type: 'varchar', nullable: true })
  deletedBy: string | null;
}
