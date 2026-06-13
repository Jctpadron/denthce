import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fhir_medication_requests')
export class MedicationRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  /**
   * FHIR status:
   * 'draft'      → Borrador (editable, CDS Hooks warnings displayed)
   * 'active'     → Receta activa / firmada (inmutable)
   * 'completed'  → Tratamiento terminado
   * 'cancelled'  → Cancelada
   */
  @Column({ default: 'draft' })
  status: string;

  /** FHIR MedicationRequest payload en formato JSONB */
  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ name: 'signed_by', nullable: true })
  signedBy: string;

  @Column({ name: 'signed_at', type: 'timestamp with time zone', nullable: true })
  signedAt: Date;

  @Column({ name: 'content_hash', nullable: true })
  contentHash: string;

  @Column({ name: 'qr_code_data', nullable: true })
  qrCodeData: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
