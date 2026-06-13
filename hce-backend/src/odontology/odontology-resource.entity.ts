import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Recurso clínico de la HISTORIA CLÍNICA ODONTOLÓGICA (módulo aislado).
 *
 * Tabla PROPIA `odontology_clinical_resources`, totalmente separada de
 * `fhir_clinical_resources` (la primera HC). Esto garantiza que la nueva HC
 * odontológica no comparte datos ni afecta el funcionamiento de la HC original.
 *
 * Almacena en JSONB recursos FHIR R4: Condition/Procedure (odontograma de doble
 * capa), QuestionnaireResponse (anamnesis), Observation/CarePlan (estado bucal,
 * diagnóstico y plan de tratamiento).
 */
@Entity('odontology_clinical_resources')
@Index(['tenantId', 'patientId', 'resourceType'])
export class OdontologyResourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'resource_type' })
  resourceType: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
