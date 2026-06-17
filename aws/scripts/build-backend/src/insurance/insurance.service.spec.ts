import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceService } from './insurance.service';
import { InsuranceCompanyEntity } from './insurance-company.entity';
import { PatientCoverageEntity } from './patient-coverage.entity';
import { NotFoundException } from '@nestjs/common';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let companyRepo: jest.Mocked<Repository<InsuranceCompanyEntity>>;
  let coverageRepo: jest.Mocked<Repository<PatientCoverageEntity>>;

  const TENANT_A = 'tenant-clinica-a';
  const TENANT_B = 'tenant-clinica-b';
  const PATIENT_1 = 'patient-uuid-1';

  beforeEach(async () => {
    const mockCompanyRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const mockCoverageRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceService,
        { provide: getRepositoryToken(InsuranceCompanyEntity), useValue: mockCompanyRepo },
        { provide: getRepositoryToken(PatientCoverageEntity), useValue: mockCoverageRepo },
      ],
    }).compile();

    service = module.get(InsuranceService);
    companyRepo = module.get(getRepositoryToken(InsuranceCompanyEntity));
    coverageRepo = module.get(getRepositoryToken(PatientCoverageEntity));
    jest.clearAllMocks();
  });

  describe('findAllCompanies', () => {
    it('debería retornar obras sociales activas ordenadas alfabéticamente', async () => {
      const mockCompanies = [
        { id: '1', nombre: 'ISJ', activa: true },
        { id: '2', nombre: 'OSDE', activa: true },
      ] as InsuranceCompanyEntity[];
      companyRepo.find.mockResolvedValue(mockCompanies);

      const result = await service.findAllCompanies();

      expect(result).toEqual(mockCompanies);
      expect(companyRepo.find).toHaveBeenCalledWith({
        where: { activa: true },
        order: { nombre: 'ASC' },
      });
    });
  });

  describe('findOneCompany', () => {
    it('debería retornar la obra social si existe', async () => {
      const mockCompany = { id: '1', nombre: 'ISJ', activa: true } as InsuranceCompanyEntity;
      companyRepo.findOne.mockResolvedValue(mockCompany);

      const result = await service.findOneCompany('1');

      expect(result).toEqual(mockCompany);
      expect(companyRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneCompany('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCoveragesByPatient', () => {
    it('debería filtrar por patientId y tenantId', async () => {
      const mockCoverages = [
        { id: 'c1', patientId: PATIENT_1, tenantId: TENANT_A, principal: true },
      ] as PatientCoverageEntity[];
      coverageRepo.find.mockResolvedValue(mockCoverages);

      const result = await service.getCoveragesByPatient(PATIENT_1, TENANT_A);

      expect(result).toEqual(mockCoverages);
      expect(coverageRepo.find).toHaveBeenCalledWith({
        where: { patientId: PATIENT_1, tenantId: TENANT_A },
        order: { principal: 'DESC', createdAt: 'ASC' },
      });
    });
  });

  describe('createCoverage', () => {
    it('debería crear cobertura y desmarcar otras coberturas como principal si la nueva es principal', async () => {
      coverageRepo.update.mockResolvedValue({} as any);
      coverageRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new-cov-id', ...e }));

      const data = {
        insuranceCompanyId: 'company-1',
        nroAfiliado: '12345',
        plan: 'Premium',
        esTitular: true,
        principal: true,
      };

      const result = await service.createCoverage(PATIENT_1, TENANT_A, data);

      expect(coverageRepo.update).toHaveBeenCalledWith(
        { patientId: PATIENT_1, tenantId: TENANT_A },
        { principal: false },
      );
      expect(result.patientId).toBe(PATIENT_1);
      expect(result.tenantId).toBe(TENANT_A);
      expect(result.nroAfiliado).toBe('12345');
      expect(result.plan).toBe('Premium');
      expect(result.principal).toBe(true);
      expect(result.esTitular).toBe(true);
      expect(result.nombreTitular).toBeNull();
    });
  });

  describe('updateCoverage', () => {
    it('debería actualizar cobertura existente y desmarcar otras si se marca como principal', async () => {
      const existingCoverage = {
        id: 'c1',
        patientId: PATIENT_1,
        tenantId: TENANT_A,
        principal: false,
        nroAfiliado: '12345',
      } as PatientCoverageEntity;

      coverageRepo.findOne.mockResolvedValue(existingCoverage);
      coverageRepo.update.mockResolvedValue({} as any);
      coverageRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const updateData = {
        nroAfiliado: '54321',
        principal: true,
      };

      const result = await service.updateCoverage('c1', PATIENT_1, TENANT_A, updateData);

      expect(coverageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'c1', patientId: PATIENT_1, tenantId: TENANT_A },
      });
      expect(coverageRepo.update).toHaveBeenCalledWith(
        { patientId: PATIENT_1, tenantId: TENANT_A },
        { principal: false },
      );
      expect(result.nroAfiliado).toBe('54321');
      expect(result.principal).toBe(true);
    });

    it('debería lanzar NotFoundException si la cobertura no existe o no pertenece al tenant/patient', async () => {
      coverageRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateCoverage('c1', PATIENT_1, TENANT_A, { nroAfiliado: '1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCoverage', () => {
    it('debería remover la cobertura si existe y pertenece al tenant/patient', async () => {
      const existingCoverage = {
        id: 'c1',
        patientId: PATIENT_1,
        tenantId: TENANT_A,
      } as PatientCoverageEntity;

      coverageRepo.findOne.mockResolvedValue(existingCoverage);
      coverageRepo.remove.mockResolvedValue({} as any);

      const result = await service.deleteCoverage('c1', PATIENT_1, TENANT_A);

      expect(result).toEqual({ deleted: true });
      expect(coverageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'c1', patientId: PATIENT_1, tenantId: TENANT_A },
      });
      expect(coverageRepo.remove).toHaveBeenCalledWith(existingCoverage);
    });

    it('debería lanzar NotFoundException al eliminar si no existe o no pertenece al tenant/patient', async () => {
      coverageRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteCoverage('c1', PATIENT_1, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
