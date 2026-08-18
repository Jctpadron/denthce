import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';

@Entity('clinica_presupuesto_items')
export class ClinicalPresupuestoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'presupuesto_id' })
  presupuestoId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'snomed_code', length: 50 })
  snomedCode: string;

  @Column({ name: 'snomed_display', length: 255 })
  snomedDisplay: string;

  // Código del nomenclador de facturación (nacional / PAMI / OS). Eje distinto del snomedCode
  // (terminología clínica): éste es el código con el que se factura a la Obra Social.
  @Column({
    name: 'codigo_nomenclador',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  codigoNomenclador?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  diente?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cara?: string | null;

  // Texto libre del "Detalle de tratamiento" (dientes, cara, puente 15-17, etc.) para casos
  // que no encajan en diente/cara estructurados.
  @Column({ type: 'varchar', length: 255, nullable: true })
  detalle?: string | null;

  // Trazabilidad al recurso FHIR planificado del odontograma que originó esta línea.
  // Evita re-importar la misma línea y permite marcar el plan como "presupuestado".
  @Column({
    name: 'source_resource_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sourceResourceId?: string | null;

  @Column({ default: 1 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'precio_unitario' })
  precioUnitario: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ default: 0 })
  orden: number;

  @ManyToOne(() => ClinicalPresupuesto, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto: ClinicalPresupuesto;
}
