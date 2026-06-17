import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { InsuranceCompanyEntity } from './insurance-company.entity';

/**
 * PatientCoverageEntity (`patient_coverages`).
 * Cobertura de salud de un paciente.
 * Un paciente puede tener múltiples coberturas activas simultáneas (ej: PAMI + OS sindical).
 * La cobertura marcada como `principal = true` es la que se muestra en la ficha y se imprime
 * en presupuestos y recetas.
 */
@Entity('patient_coverages')
@Index('idx_coverage_patient', ['patientId'])
@Index('idx_coverage_tenant', ['tenantId'])
export class PatientCoverageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID del paciente en `fhir_patients` */
  @Column({ name: 'patient_id' })
  patientId: string;

  /** Referencia a la obra social del catálogo */
  @Column({ name: 'insurance_company_id' })
  insuranceCompanyId: string;

  @ManyToOne(() => InsuranceCompanyEntity, { eager: true })
  @JoinColumn({ name: 'insurance_company_id' })
  insuranceCompany: InsuranceCompanyEntity;

  /** Número de afiliado (puede incluir sufijo familiar: "123456789-02") */
  @Column({ name: 'nro_afiliado' })
  nroAfiliado: string;

  /** Plan o categoría dentro de la OS (ej: "Plan 310", "Activo", "Jubilado") */
  @Column({ type: 'varchar', nullable: true })
  plan: string | null;

  /** Si el paciente es el titular de la cobertura */
  @Column({ name: 'es_titular', default: true })
  esTitular: boolean;

  /**
   * Nombre completo del titular de la cobertura.
   * Solo se completa cuando `esTitular = false` (el paciente es un familiar).
   */
  @Column({ name: 'nombre_titular', type: 'varchar', nullable: true })
  nombreTitular: string | null;

  /** Si esta cobertura es la principal (la que se imprime en documentos) */
  @Column({ default: true })
  principal: boolean;

  /** Si la cobertura está activa */
  @Column({ default: true })
  activa: boolean;

  /** Aislamiento multi-tenant */
  @Column({ name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
