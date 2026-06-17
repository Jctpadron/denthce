import { Test, TestingModule } from '@nestjs/testing';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';
import { AuthGuard } from '@nestjs/passport';

describe('InsuranceController', () => {
  let controller: InsuranceController;
  let service: InsuranceService;

  const mockInsuranceService = {
    findAllCompanies: jest.fn(),
    findOneCompany: jest.fn(),
    getCoveragesByPatient: jest.fn(),
    createCoverage: jest.fn(),
    updateCoverage: jest.fn(),
    deleteCoverage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsuranceController],
      providers: [
        {
          provide: InsuranceService,
          useValue: mockInsuranceService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InsuranceController>(InsuranceController);
    service = module.get<InsuranceService>(InsuranceService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar el catálogo de obras sociales activas', async () => {
      const mockList = [{ id: '1', nombre: 'ISJ' }];
      mockInsuranceService.findAllCompanies.mockResolvedValue(mockList);

      const result = await controller.findAll();

      expect(service.findAllCompanies).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe('findOne', () => {
    it('debería retornar el detalle de una obra social', async () => {
      const mockDetail = { id: '1', nombre: 'ISJ' };
      mockInsuranceService.findOneCompany.mockResolvedValue(mockDetail);

      const result = await controller.findOne('1');

      expect(service.findOneCompany).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getCoverages', () => {
    it('debería obtener las coberturas filtrando por paciente y tenant de la request', async () => {
      const patientId = 'p-1';
      const req = { user: { tenantId: 'tenant-1' } };
      const mockCoverages = [{ id: 'c-1', patientId }];
      mockInsuranceService.getCoveragesByPatient.mockResolvedValue(mockCoverages);

      const result = await controller.getCoverages(patientId, req);

      expect(service.getCoveragesByPatient).toHaveBeenCalledWith(patientId, 'tenant-1');
      expect(result).toEqual(mockCoverages);
    });
  });

  describe('createCoverage', () => {
    it('debería crear cobertura delegando los datos al servicio', async () => {
      const patientId = 'p-1';
      const req = { user: { tenantId: 'tenant-1' } };
      const body = {
        insuranceCompanyId: 'comp-1',
        nroAfiliado: '12345',
        plan: '310',
        esTitular: true,
        principal: true,
      };
      const mockCreated = { id: 'c-1', ...body };
      mockInsuranceService.createCoverage.mockResolvedValue(mockCreated);

      const result = await controller.createCoverage(patientId, body, req);

      expect(service.createCoverage).toHaveBeenCalledWith(patientId, 'tenant-1', body);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateCoverage', () => {
    it('debería actualizar la cobertura delegando los datos al servicio', async () => {
      const patientId = 'p-1';
      const covId = 'c-1';
      const req = { user: { tenantId: 'tenant-1' } };
      const body = {
        nroAfiliado: '54321',
        principal: true,
      };
      const mockUpdated = { id: covId, ...body };
      mockInsuranceService.updateCoverage.mockResolvedValue(mockUpdated);

      const result = await controller.updateCoverage(patientId, covId, body, req);

      expect(service.updateCoverage).toHaveBeenCalledWith(covId, patientId, 'tenant-1', body);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteCoverage', () => {
    it('debería eliminar la cobertura delegando al servicio', async () => {
      const patientId = 'p-1';
      const covId = 'c-1';
      const req = { user: { tenantId: 'tenant-1' } };
      mockInsuranceService.deleteCoverage.mockResolvedValue({ deleted: true });

      const result = await controller.deleteCoverage(patientId, covId, req);

      expect(service.deleteCoverage).toHaveBeenCalledWith(covId, patientId, 'tenant-1');
      expect(result).toEqual({ deleted: true });
    });
  });
});
