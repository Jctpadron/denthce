import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceCompanyEntity } from './insurance-company.entity';
import { PatientCoverageEntity } from './patient-coverage.entity';

// ---------------------------------------------------------------------------
// Seed de Obras Sociales relevantes para Jujuy / NOA / Argentina
// ---------------------------------------------------------------------------
const OBRAS_SOCIALES_SEED: Partial<InsuranceCompanyEntity>[] = [
  // ── Particular / sin cobertura ──────────────────────────────────────────
  { rnos: null, nombre: 'Particular (sin cobertura)', tipo: 'particular', activa: true },

  // ── Provinciales / Locales (Jujuy) ─────────────────────────────────────
  { rnos: '0-0900-9', nombre: 'ISJ (Instituto de Seguros de Jujuy)', tipo: 'provincial', activa: true },
  { rnos: null,       nombre: 'OSPAIL (Obra Social Ingenio Ledesma)', tipo: 'sindical', activa: true },
  { rnos: null,       nombre: 'INPROJUY (Instituto Provincial de Jujuy)', tipo: 'provincial', activa: true },
  { rnos: null,       nombre: 'OSIM (Obra Social Municipales Jujuy)', tipo: 'sindical', activa: true },

  // ── Nacionales – Estatales / Jubilados ──────────────────────────────────
  { rnos: '0-0200-5', nombre: 'PAMI (Instituto Nacional para Jubilados y Pensionados)', tipo: 'estatal', activa: true },
  { rnos: '0-0500-7', nombre: 'IOSE (Obra Social del Ejército)', tipo: 'estatal', activa: true },
  { rnos: '0-0501-5', nombre: 'Obra Social de Gendarmería Nacional (OSGN)', tipo: 'estatal', activa: true },
  { rnos: '0-0502-3', nombre: 'Obra Social de la Armada (OSAM)', tipo: 'estatal', activa: true },
  { rnos: '0-0503-1', nombre: 'Obra Social de la Aeronáutica (OSA)', tipo: 'estatal', activa: true },
  { rnos: '0-0590-4', nombre: 'PROSSAM (Obra Social del Personal de Salud)', tipo: 'estatal', activa: true },

  // ── Prepagas ─────────────────────────────────────────────────────────────
  { rnos: '0-0001-1', nombre: 'OSDE (Organización de Servicios Directos Empresarios)', tipo: 'prepaga', activa: true },
  { rnos: '0-0002-9', nombre: 'Swiss Medical Group', tipo: 'prepaga', activa: true },
  { rnos: '0-0003-7', nombre: 'Galeno Argentina', tipo: 'prepaga', activa: true },
  { rnos: '0-0004-5', nombre: 'Medifé (Federación Médica de Buenos Aires)', tipo: 'prepaga', activa: true },
  { rnos: '0-0005-2', nombre: 'Boreal Salud', tipo: 'prepaga', activa: true },
  { rnos: '0-0006-0', nombre: 'Sancor Salud', tipo: 'prepaga', activa: true },
  { rnos: '0-0007-8', nombre: 'Omint (Organización Médica Internacional)', tipo: 'prepaga', activa: true },
  { rnos: '0-0008-6', nombre: 'Accord Salud', tipo: 'prepaga', activa: true },

  // ── Sindicales – Alta frecuencia en Jujuy ───────────────────────────────
  { rnos: '0-0100-9', nombre: 'OSECAC (Empleados de Comercio y Actividades Civiles)', tipo: 'sindical', activa: true },
  { rnos: '0-0101-7', nombre: 'OSPE (Obra Social del Personal de Petróleo y Gas)', tipo: 'sindical', activa: true },
  { rnos: '0-0102-5', nombre: 'OSMATA (Mecánicos y Afines del Transporte Automotor)', tipo: 'sindical', activa: true },
  { rnos: '0-0103-3', nombre: 'OSPLAD (Personal de la Docencia Privada)', tipo: 'sindical', activa: true },
  { rnos: '0-0104-1', nombre: 'OSDOP (Obras Sociales Docentes Provinciales)', tipo: 'sindical', activa: true },
  { rnos: '0-0105-8', nombre: 'UP (Unión del Personal Civil de la Nación)', tipo: 'sindical', activa: true },
  { rnos: '0-0106-6', nombre: 'OSDEPYM (Personal de Pequeña y Mediana Empresa)', tipo: 'sindical', activa: true },
  { rnos: '0-0107-4', nombre: 'OSPEDYC (Empleados y Obreros de Droguería y Cosmética)', tipo: 'sindical', activa: true },
  { rnos: '0-0108-2', nombre: 'Luz y Fuerza (OSLED)', tipo: 'sindical', activa: true },
  { rnos: '0-0109-0', nombre: 'OSBA (Personal Bancario y Seguros)', tipo: 'sindical', activa: true },
  { rnos: '0-0110-4', nombre: 'UOCRA (Unión Obreros Construcción de la República Argentina)', tipo: 'sindical', activa: true },
  { rnos: '0-0111-2', nombre: 'OSUTHGRA (Hotelería, Gastronomía y Afines)', tipo: 'sindical', activa: true },
  { rnos: '0-0112-0', nombre: 'ATACIR (Transporte Automotor de Cargas, Industria y Ramas)', tipo: 'sindical', activa: true },
  { rnos: '0-0113-8', nombre: 'OSUOMRA (Mecánicos y Obreros Metalúrgicos)', tipo: 'sindical', activa: true },
  { rnos: '0-0114-6', nombre: 'OSPECON (Personal de Estaciones de Servicio y GNC)', tipo: 'sindical', activa: true },
  { rnos: '0-0115-3', nombre: 'OSAM (Personal de la Actividad Azucarera)', tipo: 'sindical', activa: true },
  { rnos: '0-0116-1', nombre: 'OSPAT (Personal de la Actividad Textil)', tipo: 'sindical', activa: true },
  { rnos: '0-0117-9', nombre: 'Camioneros (OSTCRA)', tipo: 'sindical', activa: true },
  { rnos: '0-0118-7', nombre: 'OSFE (Ferroviarios del Estado)', tipo: 'sindical', activa: true },
  { rnos: '0-0119-5', nombre: 'Pasteleros, Confiteros, Pizzeros (OS)', tipo: 'sindical', activa: true },
  { rnos: '0-0120-9', nombre: 'OSPA (Panaderos y Afines)', tipo: 'sindical', activa: true },
  { rnos: '0-0121-7', nombre: 'Sanidad (OSDE - Personal Médico)', tipo: 'sindical', activa: true },
  { rnos: '0-0122-5', nombre: 'OSPIL (Personal de Industria del Papel y Cartón)', tipo: 'sindical', activa: true },
  { rnos: '0-0123-3', nombre: 'OSACRA (Personal de Agencias de Publicidad)', tipo: 'sindical', activa: true },
  { rnos: '0-0124-1', nombre: 'OSPAGA (Personal de Agencias Gráficas)', tipo: 'sindical', activa: true },
  { rnos: '0-0125-8', nombre: 'OS del Personal de Luz y Fuerza Jujuy', tipo: 'sindical', activa: true },
  { rnos: '0-0126-6', nombre: 'OS del Personal de Municipalidades del NOA', tipo: 'sindical', activa: true },
  { rnos: '0-0127-4', nombre: 'OSDOP Jujuy (Docentes Provinciales)', tipo: 'sindical', activa: true },

  // ── Monotributistas ──────────────────────────────────────────────────────
  { rnos: '0-0300-5', nombre: 'OSDE Binario (Monotributistas)', tipo: 'sindical', activa: true },
  { rnos: '0-0301-3', nombre: 'AVALIAN (ex Obra Social Unión Dependientes)', tipo: 'sindical', activa: true },
  { rnos: '0-0302-1', nombre: 'CEMIC (Centro de Educación Médica)', tipo: 'prepaga', activa: true },
  { rnos: '0-0303-9', nombre: 'Jerárquicos Salud (OSDE Personal de Dirección)', tipo: 'sindical', activa: true },
];

// ---------------------------------------------------------------------------

@Injectable()
export class InsuranceService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(InsuranceCompanyEntity)
    private readonly companyRepo: Repository<InsuranceCompanyEntity>,
    @InjectRepository(PatientCoverageEntity)
    private readonly coverageRepo: Repository<PatientCoverageEntity>,
  ) {}

  /**
   * Al iniciar la aplicación, insertar el catálogo de obras sociales si la tabla está vacía.
   * Esto garantiza que la primera vez que se despliega el backend, el catálogo esté disponible.
   */
  async onApplicationBootstrap() {
    const count = await this.companyRepo.count();
    if (count === 0) {
      await this.seedInsuranceCompanies();
    }
  }

  private async seedInsuranceCompanies() {
    const entities = OBRAS_SOCIALES_SEED.map((data) => {
      const entity = new InsuranceCompanyEntity();
      entity.rnos = data.rnos ?? null;
      entity.nombre = data.nombre!;
      entity.tipo = data.tipo ?? null;
      entity.activa = data.activa ?? true;
      return entity;
    });
    await this.companyRepo.save(entities);
    console.log(`[InsuranceService] Seed ejecutado: ${entities.length} obras sociales cargadas.`);
  }

  // ── Catálogo ──────────────────────────────────────────────────────────────

  async findAllCompanies(): Promise<InsuranceCompanyEntity[]> {
    return this.companyRepo.find({
      where: { activa: true },
      order: { nombre: 'ASC' },
    });
  }

  async findOneCompany(id: string): Promise<InsuranceCompanyEntity> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Obra social con ID ${id} no encontrada.`);
    return company;
  }

  // ── Coberturas del Paciente ───────────────────────────────────────────────

  async getCoveragesByPatient(patientId: string, tenantId: string): Promise<PatientCoverageEntity[]> {
    return this.coverageRepo.find({
      where: { patientId, tenantId },
      order: { principal: 'DESC', createdAt: 'ASC' },
    });
  }

  async createCoverage(
    patientId: string,
    tenantId: string,
    data: {
      insuranceCompanyId: string;
      nroAfiliado: string;
      plan?: string;
      esTitular?: boolean;
      nombreTitular?: string;
      principal?: boolean;
    },
  ): Promise<PatientCoverageEntity> {
    // Si la nueva cobertura es principal, desmarcar las anteriores
    if (data.principal !== false) {
      await this.coverageRepo.update({ patientId, tenantId }, { principal: false });
    }

    const entity = new PatientCoverageEntity();
    entity.patientId = patientId;
    entity.tenantId = tenantId;
    entity.insuranceCompanyId = data.insuranceCompanyId;
    entity.nroAfiliado = data.nroAfiliado;
    entity.plan = data.plan ?? null;
    entity.esTitular = data.esTitular !== false;
    entity.nombreTitular = data.esTitular !== false ? null : (data.nombreTitular ?? null);
    entity.principal = data.principal !== false;
    entity.activa = true;

    return this.coverageRepo.save(entity);
  }

  async updateCoverage(
    id: string,
    patientId: string,
    tenantId: string,
    data: {
      insuranceCompanyId?: string;
      nroAfiliado?: string;
      plan?: string;
      esTitular?: boolean;
      nombreTitular?: string;
      principal?: boolean;
      activa?: boolean;
    },
  ): Promise<PatientCoverageEntity> {
    const coverage = await this.coverageRepo.findOne({ where: { id, patientId, tenantId } });
    if (!coverage) throw new NotFoundException(`Cobertura con ID ${id} no encontrada.`);

    // Si pasa a principal, desmarcar las otras del mismo paciente
    if (data.principal === true) {
      await this.coverageRepo.update({ patientId, tenantId }, { principal: false });
    }

    Object.assign(coverage, {
      ...data,
      nombreTitular: data.esTitular !== false ? null : (data.nombreTitular ?? coverage.nombreTitular),
    });

    return this.coverageRepo.save(coverage);
  }

  async deleteCoverage(id: string, patientId: string, tenantId: string): Promise<{ deleted: boolean }> {
    const coverage = await this.coverageRepo.findOne({ where: { id, patientId, tenantId } });
    if (!coverage) throw new NotFoundException(`Cobertura con ID ${id} no encontrada.`);
    await this.coverageRepo.remove(coverage);
    return { deleted: true };
  }
}
