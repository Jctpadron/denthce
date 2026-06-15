import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * InsuranceCompanyEntity (`insurance_companies`).
 * Catálogo maestro de obras sociales y prepagas.
 * Incluye entidades nacionales (RNOS), provinciales y la opción "Particular".
 * Se pre-pobla con el seed de obras sociales relevantes para Jujuy/NOA al iniciar.
 */
@Entity('insurance_companies')
@Index('uq_insurance_rnos', ['rnos'], { unique: true, where: '"rnos" IS NOT NULL AND "rnos" != \'\'' })
export class InsuranceCompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Código RNOS asignado por la SSSalud (Superintendencia de Servicios de Salud).
   * Formato: "0-XXXX-X". Puede ser nulo para entidades provinciales o "Particular".
   */
  @Column({ type: 'varchar', nullable: true })
  rnos: string | null;

  /** Nombre de la obra social / prepaga (ej: "OSDE", "PAMI", "ISJ") */
  @Column()
  nombre: string;

  /**
   * Tipo de entidad.
   * - "sindical": obra social de un sindicato (Ley 23.660)
   * - "provincial": obra social provincial (ej: ISJ)
   * - "prepaga": empresa de medicina prepaga (Ley 26.682)
   * - "estatal": obras sociales del Estado (IOSE, etc.)
   * - "mutual": mutuales con cobertura médica
   * - "particular": sin cobertura / pago directo
   */
  @Column({ type: 'varchar', nullable: true })
  tipo: string | null;

  /** Si la entidad está habilitada para su selección en el formulario */
  @Column({ default: true })
  activa: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
