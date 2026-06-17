import { Test, TestingModule } from '@nestjs/testing';
import { OdontologyController } from './odontology.controller';
import { OdontologyService } from './odontology.service';
import { OdontologyPdfService } from './odontology-pdf.service';
import { PatientEntity } from '../patient/patient.entity';

describe('OdontologyController', () => {
  let controller: OdontologyController;
  let service: OdontologyService;
  let pdfService: OdontologyPdfService;

  const mockOdontologyService = {
    saveResource: jest.fn(),
    getResourcesByPatient: jest.fn(),
    getPatient: jest.fn(),
    completeResource: jest.fn(),
    deleteResource: jest.fn(),
  };

  const mockOdontologyPdfService = {
    generatePdf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OdontologyController],
      providers: [
        {
          provide: OdontologyService,
          useValue: mockOdontologyService,
        },
        {
          provide: OdontologyPdfService,
          useValue: mockOdontologyPdfService,
        },
      ],
    }).compile();

    controller = module.get<OdontologyController>(OdontologyController);
    service = module.get<OdontologyService>(OdontologyService);
    pdfService = module.get<OdontologyPdfService>(OdontologyPdfService);

    jest.clearAllMocks();
  });

  describe('createResource', () => {
    it('debería delegar el guardado al OdontologyService con el tenantId de la petición', async () => {
      const patientId = 'patient-123';
      const body = { resourceType: 'Condition', payload: { test: true } };
      const req = { user: { tenantId: 'tenant-abc' } };

      mockOdontologyService.saveResource.mockResolvedValue({ id: 'r-1', ...body.payload });

      const result = await controller.createResource(patientId, body, req);

      expect(service.saveResource).toHaveBeenCalledWith(
        patientId,
        body.resourceType,
        body.payload,
        'tenant-abc',
        null,
      );
      expect(result.id).toBe('r-1');
    });
  });

  describe('getResources', () => {
    it('debería retornar los recursos delegando al servicio con el tenantId de la petición', async () => {
      const patientId = 'patient-123';
      const req = { user: { tenantId: 'tenant-abc' } };
      const mockResources = [{ id: 'r-1' }, { id: 'r-2' }];

      mockOdontologyService.getResourcesByPatient.mockResolvedValue(mockResources);

      const result = await controller.getResources(patientId, req);

      expect(service.getResourcesByPatient).toHaveBeenCalledWith(patientId, 'tenant-abc');
      expect(result).toEqual(mockResources);
    });
  });

  describe('completeResource', () => {
    it('debería completar el recurso delegando al servicio', async () => {
      const id = 'resource-123';
      const req = { user: { tenantId: 'tenant-abc' } };

      mockOdontologyService.completeResource.mockResolvedValue({ id, completed: true });

      const result = await controller.completeResource(id, req);

      expect(service.completeResource).toHaveBeenCalledWith(id, 'tenant-abc');
      expect(result.completed).toBe(true);
    });
  });

  describe('deleteResource', () => {
    it('debería eliminar el recurso delegando al servicio', async () => {
      const id = 'resource-123';
      const req = { user: { tenantId: 'tenant-abc' } };

      mockOdontologyService.deleteResource.mockResolvedValue({ message: 'OK' });

      const result = await controller.deleteResource(id, req);

      expect(service.deleteResource).toHaveBeenCalledWith(id, 'tenant-abc');
      expect(result.message).toBe('OK');
    });
  });

  describe('getPdfReport', () => {
    it('debería retornar el PDF con las cabeceras e inline stream correctos', async () => {
      const patientId = 'patient-123';
      const req = { user: { tenantId: 'tenant-abc' } };
      const mockPatient = { id: patientId, dni: '12345678', givenName: 'Juan' } as PatientEntity;
      const mockResources = [{ id: 'res-1' }];
      const mockPdfBuffer = Buffer.from('PDF_STREAM');

      mockOdontologyService.getPatient.mockResolvedValue(mockPatient);
      mockOdontologyService.getResourcesByPatient.mockResolvedValue(mockResources);
      mockOdontologyPdfService.generatePdf.mockResolvedValue(mockPdfBuffer);

      // Mock de Response
      const res = {
        set: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.getPdfReport(patientId, req, res as any);

      expect(service.getPatient).toHaveBeenCalledWith(patientId, 'tenant-abc');
      expect(service.getResourcesByPatient).toHaveBeenCalledWith(patientId, 'tenant-abc');
      expect(pdfService.generatePdf).toHaveBeenCalledWith(mockPatient, mockResources);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="hc_odontologica_12345678.pdf"`,
        'Content-Length': mockPdfBuffer.length,
      });
      expect(res.end).toHaveBeenCalledWith(mockPdfBuffer);
    });

    it('debería retornar error 500 si la generación del PDF falla', async () => {
      const patientId = 'patient-123';
      const req = { user: { tenantId: 'tenant-abc' } };

      mockOdontologyService.getPatient.mockRejectedValue(new Error('Fallo de BD'));

      const res = {
        set: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.getPdfReport(patientId, req, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Error interno al generar el reporte PDF.',
        }),
      );
    });
  });
});
