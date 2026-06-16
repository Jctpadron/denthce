import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('protesis_insumos')
export class ProtesisInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string; // Aislamiento multi-inquilino del laboratorio

  @Column()
  name: string;

  @Column()
  category: string; // zirconio, resina, aditamento, metal, yeso, otro

  @Column({ type: 'float', default: 0 })
  stock: number;

  @Column({ type: 'float', name: 'min_stock', default: 1 })
  minStock: number;

  @Column({ default: 'Unidad' })
  unit: string; // Unidad, Gramos, ml, etc.

  @Column({ type: 'jsonb', name: 'additional_meta', nullable: true })
  additionalMeta?: {
    height?: number;     // Altura en mm para bloques/discos de zirconio (ej. 14, 18, 22)
    color?: string;      // Color VITA (ej. A2, B1)
    lotNumber?: string;  // Trazabilidad de lote sanitario
    brand?: string;      // Marca comercial del insumo
    [key: string]: any;
  } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
