import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { TenantModuleEntity } from '../platform/tenant-module.entity';
import { PlatformModuleEntity } from '../platform/platform-module.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { KeycloakAdminService } from '../tenant/keycloak-admin.service';
import { ClinichatOrchestrationService } from './clinichat-orchestration.service';

/** Módulos que se entregan por defecto al provisionar una clínica (no incluye WhatsApp). */
const DEFAULT_MODULES = ['hc-base', 'agenda', 'odontologia-pami'];
const WHATSAPP_MODULE = 'whatsapp';

/**
 * SuperAdminService — gestión CROSS-TENANT de la plataforma.
 *
 * A diferencia de los servicios clínicos (scoped por tenantId del JWT), aquí se opera sobre
 * TODAS las clínicas: listarlas, provisionarlas y gestionar qué módulos tienen contratados.
 * Protegido por SuperAdminGuard a nivel de controlador.
 */
@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(TenantConfigEntity)
    private readonly tenantConfigRepo: Repository<TenantConfigEntity>,
    @InjectRepository(TenantModuleEntity)
    private readonly tenantModuleRepo: Repository<TenantModuleEntity>,
    @InjectRepository(PlatformModuleEntity)
    private readonly platformModuleRepo: Repository<PlatformModuleEntity>,
    @InjectRepository(PatientEntity)
    private readonly patientRepo: Repository<PatientEntity>,
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly clinichat: ClinichatOrchestrationService,
  ) {}

  /** Catálogo de módulos contratables. */
  async catalog(): Promise<PlatformModuleEntity[]> {
    return this.platformModuleRepo.find({ order: { isBase: 'DESC', key: 'ASC' } });
  }

  /** Lista TODAS las clínicas con su plan, estado y módulos activos. */
  async listClinics(): Promise<any[]> {
    const configs = await this.tenantConfigRepo.find();
    const allModules = await this.tenantModuleRepo.find();
    const now = Date.now();

    return configs.map((c) => {
      const mods = allModules.filter((m) => m.tenantId === c.tenantId);
      const activeModules = mods
        .filter((m) => m.enabled && (!m.expiresAt || m.expiresAt.getTime() > now))
        .map((m) => m.moduleKey);
      return {
        tenantId: c.tenantId,
        clinicName: c.clinicName,
        specialty: c.specialty,
        plan: c.plan,
        isActive: c.isActive,
        modules: activeModules,
      };
    });
  }

  /**
   * Provisiona una clínica nueva: crea su tenant_config, los módulos base y el usuario
   * administrador en Keycloak (con su tenant_id). Idempotencia: rechaza si el tenant ya existe.
   */
  async createClinic(dto: {
    tenantId: string;
    name: string;
    plan?: string;
    adminUsername: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
  }): Promise<any> {
    const tenantId = (dto.tenantId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!tenantId || !dto.name || !dto.adminUsername || !dto.adminEmail) {
      throw new BadRequestException('tenantId, name, adminUsername y adminEmail son obligatorios.');
    }

    const existing = await this.tenantConfigRepo.findOne({ where: { tenantId } });
    if (existing) {
      throw new ConflictException(`Ya existe una clínica con el tenant "${tenantId}".`);
    }

    // 1. tenant_config
    const config = this.tenantConfigRepo.create({
      tenantId,
      clinicName: dto.name,
      plan: dto.plan || 'basic',
      isActive: true,
    });
    await this.tenantConfigRepo.save(config);

    // 2. Módulos base (entitlements)
    const baseRows = DEFAULT_MODULES.map((key) =>
      this.tenantModuleRepo.create({
        tenantId,
        moduleKey: key,
        enabled: true,
        activatedAt: new Date(),
      }),
    );
    await this.tenantModuleRepo.save(baseRows);

    // 3. Usuario administrador en Keycloak con el tenant_id de la clínica
    let admin: any = null;
    try {
      admin = await this.keycloakAdmin.createUser({
        username: dto.adminUsername.toLowerCase().trim(),
        email: dto.adminEmail.toLowerCase().trim(),
        firstName: dto.adminFirstName?.trim() || dto.adminUsername,
        lastName: dto.adminLastName?.trim() || '',
        role: 'administrador',
        tenantId,
      });
    } catch (e: any) {
      // La clínica queda creada; se reporta el problema del admin para reintento manual.
      return {
        tenantId,
        clinicName: dto.name,
        plan: config.plan,
        modules: DEFAULT_MODULES,
        adminCreated: false,
        adminError: e?.message || 'No se pudo crear el usuario administrador.',
      };
    }

    return {
      tenantId,
      clinicName: dto.name,
      plan: config.plan,
      modules: DEFAULT_MODULES,
      adminCreated: true,
      admin,
    };
  }

  /**
   * Alta de un LABORATORIO de prótesis independiente, en UNA sola acción:
   * crea su tenant, le habilita el módulo `protesis-lab` y crea el usuario admin del lab
   * en Keycloak (rol `laboratorio-admin` + tenant_id). Es el alta del producto vendido como
   * servicio independiente del HCE. Idempotencia: rechaza si el tenant ya existe.
   */
  async createLab(dto: {
    tenantId: string;
    name: string;
    plan?: string;
    adminUsername: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
  }): Promise<any> {
    const tenantId = (dto.tenantId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!tenantId || !dto.name || !dto.adminUsername || !dto.adminEmail) {
      throw new BadRequestException('tenantId, name, adminUsername y adminEmail son obligatorios.');
    }

    const existing = await this.tenantConfigRepo.findOne({ where: { tenantId } });
    if (existing) {
      throw new ConflictException(`Ya existe un tenant "${tenantId}".`);
    }

    // 1. tenant_config (el lab es un tenant más, marcado por su especialidad).
    const config = this.tenantConfigRepo.create({
      tenantId,
      clinicName: dto.name,
      specialty: 'Laboratorio Dental',
      plan: dto.plan || 'lab',
      isActive: true,
    });
    await this.tenantConfigRepo.save(config);

    // 2. Entitlement: el laboratorio solo necesita el módulo del portal de prótesis.
    const protesisModule = await this.platformModuleRepo.findOne({ where: { key: 'protesis-lab' } });
    if (!protesisModule) {
      throw new BadRequestException('El módulo "protesis-lab" no está en el catálogo. Registralo antes de dar de alta laboratorios.');
    }
    await this.tenantModuleRepo.save(
      this.tenantModuleRepo.create({ tenantId, moduleKey: 'protesis-lab', enabled: true, activatedAt: new Date() }),
    );

    // 3. Usuario admin del laboratorio en Keycloak (rol laboratorio-admin + tenant_id del lab).
    try {
      const admin = await this.keycloakAdmin.createUser({
        username: dto.adminUsername.toLowerCase().trim(),
        email: dto.adminEmail.toLowerCase().trim(),
        firstName: dto.adminFirstName?.trim() || dto.adminUsername,
        lastName: dto.adminLastName?.trim() || '',
        role: 'laboratorio-admin',
        tenantId,
      });
      return { tenantId, labName: dto.name, modules: ['protesis-lab'], adminCreated: true, admin };
    } catch (e: any) {
      return {
        tenantId,
        labName: dto.name,
        modules: ['protesis-lab'],
        adminCreated: false,
        adminError: e?.message || 'No se pudo crear el usuario administrador del laboratorio.',
      };
    }
  }

  /**
   * Anexa o da de baja un módulo de una clínica (upsert en tenant_modules).
   * enabled=true → anexar; enabled=false → dar de baja. expiresAt opcional.
   */
  async setModule(
    tenantId: string,
    moduleKey: string,
    enabled: boolean,
    expiresAt?: string | null,
    pairingCode?: string,
  ): Promise<any> {
    const clinic = await this.tenantConfigRepo.findOne({ where: { tenantId } });
    if (!clinic) throw new NotFoundException(`Clínica "${tenantId}" no encontrada.`);

    const module = await this.platformModuleRepo.findOne({ where: { key: moduleKey } });
    if (!module) throw new BadRequestException(`Módulo "${moduleKey}" no existe en el catálogo.`);
    if (module.isBase && !enabled) {
      throw new BadRequestException(`El módulo "${moduleKey}" es parte del producto base y no se puede dar de baja.`);
    }

    // WhatsApp es un servicio orquestado: antes de anexar/dar de baja el entitlement,
    // configuramos el lado de CliniChat. Si esa orquestación falla, NO tocamos el entitlement
    // (no anexamos un servicio que no quedó configurado del otro lado).
    if (moduleKey === WHATSAPP_MODULE) {
      if (enabled) {
        await this.clinichat.enableWhatsapp(tenantId, pairingCode || '');
      } else {
        await this.clinichat.disableWhatsapp(tenantId);
      }
    }

    let tm = await this.tenantModuleRepo.findOne({ where: { tenantId, moduleKey } });
    if (!tm) {
      tm = this.tenantModuleRepo.create({ tenantId, moduleKey });
    }
    tm.enabled = enabled;
    tm.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (enabled && !tm.activatedAt) tm.activatedAt = new Date();
    await this.tenantModuleRepo.save(tm);

    return { tenantId, moduleKey, enabled: tm.enabled, expiresAt: tm.expiresAt };
  }

  /**
   * Fase 4A — genera (o recupera) el service-account de Keycloak de una clínica.
   * Devuelve las credenciales que luego se le entregan a CliniChat (Fase 4B).
   */
  async generateServiceAccount(tenantId: string): Promise<any> {
    const clinic = await this.tenantConfigRepo.findOne({ where: { tenantId } });
    if (!clinic) throw new NotFoundException(`Clínica "${tenantId}" no encontrada.`);
    return this.keycloakAdmin.createClinicServiceAccount(tenantId);
  }

  /** Métricas globales de la plataforma para el panel de resumen. */
  async metrics(): Promise<any> {
    const [clinics, patients, appointments] = await Promise.all([
      this.tenantConfigRepo.find(),
      this.patientRepo.count(),
      this.appointmentRepo.count(),
    ]);
    return {
      totalClinics: clinics.length,
      activeClinics: clinics.filter((c) => c.isActive).length,
      totalPatients: patients,
      totalAppointments: appointments,
    };
  }
}
