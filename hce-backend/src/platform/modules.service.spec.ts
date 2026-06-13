import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ModulesService } from './modules.service';
import { TenantModuleEntity } from './tenant-module.entity';
import { PlatformModuleEntity } from './platform-module.entity';

describe('ModulesService — entitlements (gate de servicios anexables)', () => {
  let service: ModulesService;
  const mockTenantModuleRepo = { findOne: jest.fn(), find: jest.fn() };
  const mockPlatformModuleRepo = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModulesService,
        { provide: getRepositoryToken(TenantModuleEntity), useValue: mockTenantModuleRepo },
        { provide: getRepositoryToken(PlatformModuleEntity), useValue: mockPlatformModuleRepo },
      ],
    }).compile();
    service = module.get<ModulesService>(ModulesService);
    jest.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('false si la clínica no contrató el módulo (sin fila)', async () => {
      mockTenantModuleRepo.findOne.mockResolvedValue(null);
      expect(await service.isEnabled('t1', 'whatsapp')).toBe(false);
    });

    it('true si está contratado, habilitado y sin vencimiento', async () => {
      mockTenantModuleRepo.findOne.mockResolvedValue({ enabled: true, expiresAt: null });
      expect(await service.isEnabled('t1', 'whatsapp')).toBe(true);
    });

    it('false si está contratado pero deshabilitado', async () => {
      mockTenantModuleRepo.findOne.mockResolvedValue({ enabled: false, expiresAt: null });
      expect(await service.isEnabled('t1', 'whatsapp')).toBe(false);
    });

    it('false si está habilitado pero VENCIDO (expires_at pasado)', async () => {
      mockTenantModuleRepo.findOne.mockResolvedValue({
        enabled: true,
        expiresAt: new Date(Date.now() - 86400000),
      });
      expect(await service.isEnabled('t1', 'whatsapp')).toBe(false);
    });

    it('true si el vencimiento es futuro', async () => {
      mockTenantModuleRepo.findOne.mockResolvedValue({
        enabled: true,
        expiresAt: new Date(Date.now() + 86400000),
      });
      expect(await service.isEnabled('t1', 'whatsapp')).toBe(true);
    });

    it('false si no hay tenantId', async () => {
      expect(await service.isEnabled('', 'whatsapp')).toBe(false);
      expect(mockTenantModuleRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('enabledModules', () => {
    it('filtra los vencidos y devuelve solo las keys vigentes', async () => {
      mockTenantModuleRepo.find.mockResolvedValue([
        { moduleKey: 'hc-base', enabled: true, expiresAt: null },
        { moduleKey: 'whatsapp', enabled: true, expiresAt: new Date(Date.now() - 1000) }, // vencido
        { moduleKey: 'agenda', enabled: true, expiresAt: new Date(Date.now() + 100000) },
      ]);
      const result = await service.enabledModules('t1');
      expect(result).toEqual(['hc-base', 'agenda']);
    });
  });
});
