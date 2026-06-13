import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * PatientEntity (`fhir_patients`).
 * Clave de unicidad: (dni, gender, tenant_id). En Argentina, por el sistema histórico de
 * Libreta de Enrolamiento (varones) y Libreta Cívica (mujeres), existen dos personas distintas
 * con el mismo número de documento y distinto sexo; por eso el DNI NO es único por sí solo.
 */
@Entity('fhir_patients')
@Index('uq_patient_dni_gender_tenant', ['dni', 'gender', 'tenantId'], { unique: true })
export class PatientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column()
  dni: string;

  @Column({ name: 'family_name' })
  familyName: string;

  @Column({ name: 'given_name' })
  givenName: string;

  @Column()
  gender: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
