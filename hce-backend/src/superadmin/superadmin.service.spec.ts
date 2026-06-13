import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { TenantModuleEntity } from '../platform/tenant-module.entity';
import { PlatformModuleEntity } from '../platform/platform-module.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { KeycloakAdminService } from '../tenant/keycloak-admin.service';

describe('SuperAdminService (cross-tenant)', () => {
  let service: SuperAdminService;
  const tenantConfigRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn() };
  const tenantModuleRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn() };
  const platformModuleRepo = { find: jest.fn(), findOne: jest.fn() };
  const patientRepo = { count: jest.fn() };
  const appointmentRepo = { count: jest.fn() };
  const keycloakAdmin = { createUser: jest.fn(), createClinicServiceAccount: jest.fn() };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminService,
        { provide: getRepositoryToken(TenantConfigEntity), useValue: tenantConfigRepo },
        { provide: getRepositoryToken(TenantModuleEntity), useValue: tenantModuleRepo },
        { provide: getRepositoryToken(PlatformModuleEntity), useValue: platformModuleRepo },
        { provide: getRepositoryToken(PatientEntity), useValue: patientRepo },
        { provide: getRepositoryToken(AppointmentEntity), useValue: appointmentRepo },
        { provide: KeycloakAdminService, useValue: keycloakAdmin },
      ],
    }).compile();
    service = mod.get<SuperAdminService>(SuperAdminService);
    jest.clearAllMocks();
  });

  describe('listClinics', () => {
    it('mapea clínicas con sus módulos activos (filtra vencidos)', async () => {
      tenantConfigRepo.find.mockResolvedValue([
        { tenantId: 't1', clinicName: 'A', plan: 'pro', isActive: true },
      ]);
      tenantModuleRepo.find.mockResolvedValue([
        { tenantId: 't1', moduleKey: 'hc-base', enabled: true, expiresAt: null },
        { tenantId: 't1', moduleKey: 'whatsapp', enabled: true, expiresAt: new Date(Date.now() - 1000) },
        { tenantId: 't1', moduleKey: 'agenda', enabled: false, expiresAt: null },
      ]);
      const res = await service.listClinics();
      expect(res[0].modules).toEqual(['hc-base']);
    });
  });

  describe('createClinic', () => {
    it('rechaza si el tenant ya existe', async () => {
      tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1' });
      await expect(
        service.createClinic({ tenantId: 't1', name: 'X', adminUsername: 'a', adminEmail: 'a@a.com', adminFirstName: 'A', adminLastName: 'B' }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea clínica + módulos base + admin Keycloak', async () => {
      tenantConfigRepo.findOne.mockResolvedValue(null);
      tenantConfigRepo.save.mockResolvedValue({});
      tenantModuleRepo.save.mockResolvedValue([]);
      keycloakAdmin.createUser.mockResolvedValue({ id: 'u1', username: 'admin_x' });

      const res = await service.createClinic({
        tenantId: 'Clínica X!', name: 'Clínica X', adminUsername: 'admin_x',
        adminEmail: 'a@x.com', adminFirstName: 'Ana', adminLastName: 'Pérez',
      });
      expect(res.tenantId).toBe('cl_nica_x_'); // normalizado a [a-z0-9_-]
      expect(res.adminCreated).toBe(true);
      expect(res.modules).toEqual(['hc-base', 'agenda', 'odontologia-pami']);
      expect(keycloakAdmin.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'administrador' }));
    });
  });

  describe('setModule', () => {
    it('no permite dar de baja un módulo base', async () => {
      tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1' });
      platformModuleRepo.findOne.mockResolvedValue({ key: 'hc-base', isBase: true });
      await expect(service.setModule('t1', 'hc-base', false)).rejects.toThrow(BadRequestException);
    });

    it('anexa el módulo whatsapp (upsert enabled=true)', async () => {
      tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1' });
      platformModuleRepo.findOne.mockResolvedValue({ key: 'whatsapp', isBase: false });
      tenantModuleRepo.findOne.mockResolvedValue(null);
      tenantModuleRepo.save.mockImplementation(async (x) => x);

      const res = await service.setModule('t1', 'whatsapp', true);
      expect(res.enabled).toBe(true);
      expect(tenantModuleRepo.save).toHaveBeenCalled();
    });

    it('NotFound si la clínica no existe', async () => {
      tenantConfigRepo.findOne.mockResolvedValue(null);
      await expect(service.setModule('tx', 'whatsapp', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateServiceAccount', () => {
    it('genera el service-account si la clínica existe', async () => {
      tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1' });
      keycloakAdmin.createClinicServiceAccount.mockResolvedValue({ clientId: 'clinichat-t1', clientSecret: 'sec', tenantId: 't1' });
      const res = await service.generateServiceAccount('t1');
      expect(res.clientId).toBe('clinichat-t1');
      expect(keycloakAdmin.createClinicServiceAccount).toHaveBeenCalledWith('t1');
    });

    it('NotFound si la clínica no existe', async () => {
      tenantConfigRepo.findOne.mockResolvedValue(null);
      await expect(service.generateServiceAccount('tx')).rejects.toThrow(NotFoundException);
    });
  });

  describe('metrics', () => {
    it('devuelve conteos globales', async () => {
      tenantConfigRepo.find.mockResolvedValue([{ isActive: true }, { isActive: false }]);
      patientRepo.count.mockResolvedValue(120);
      appointmentRepo.count.mockResolvedValue(45);
      const m = await service.metrics();
      expect(m).toEqual({ totalClinics: 2, activeClinics: 1, totalPatients: 120, totalAppointments: 45 });
    });
  });
});
