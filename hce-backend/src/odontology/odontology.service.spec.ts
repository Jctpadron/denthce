import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdontologyService, ODONTOGRAM_LAYER_URL } from './odontology.service';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OdontologyService', () => {
  let service: OdontologyService;
  let resourceRepository: Repository<OdontologyResourceEntity>;
  let patientRepository: Repository<PatientEntity>;

  // QueryBuilder encadenable reutilizable para los agregados de enrichPatients.
  const makeQb = (rows: any[]) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  const mockResourceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPatientRepository = {
    findOne: jest.fn(),
  };

  const mockAppointmentRepository = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdontologyService,
        {
          provide: getRepositoryToken(OdontologyResourceEntity),
          useValue: mockResourceRepository,
        },
        {
          provide: getRepositoryToken(PatientEntity),
          useValue: mockPatientRepository,
        },
        {
          provide: getRepositoryToken(AppointmentEntity),
          useValue: mockAppointmentRepository,
        },
      ],
    }).compile();

    service = module.get<OdontologyService>(OdontologyService);
    resourceRepository = module.get<Repository<OdontologyResourceEntity>>(
      getRepositoryToken(OdontologyResourceEntity),
    );
    patientRepository = module.get<Repository<PatientEntity>>(
      getRepositoryToken(PatientEntity),
    );

    // Limpiar mocks antes de cada test
    jest.clearAllMocks();
  });

  describe('getPatient', () => {
    it('debería retornar el paciente si pertenece al tenant del médico', async () => {
      const mockPatient = { id: 'patient-123', tenantId: 'tenant-abc', dni: '12345678' } as PatientEntity;
      mockPatientRepository.findOne.mockResolvedValue(mockPatient);

      const result = await service.getPatient('patient-123', 'tenant-abc');
      expect(result).toEqual(mockPatient);
      expect(patientRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'patient-123', tenantId: 'tenant-abc' },
      });
    });

    it('debería lanzar NotFoundException si el paciente no existe o pertenece a otro tenant', async () => {
      mockPatientRepository.findOne.mockResolvedValue(null);

      await expect(service.getPatient('patient-123', 'tenant-xyz')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveResource', () => {
    const mockPatient = { id: 'patient-123', tenantId: 'tenant-abc' } as PatientEntity;

    it('debería guardar un nuevo recurso si el tipo de recurso es permitido y el paciente es del tenant', async () => {
      mockPatientRepository.findOne.mockResolvedValue(mockPatient);
      mockResourceRepository.save.mockImplementation((entity) => {
        entity.id = 'resource-uuid';
        return Promise.resolve(entity);
      });
      mockResourceRepository.update.mockResolvedValue({});

      const payload = {
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        code: { coding: [{ system: 'http://snomed.info/sct', code: '80967001' }] },
      };

      const result = await service.saveResource('patient-123', 'Condition', payload, 'tenant-abc');

      expect(result.id).toBe('resource-uuid');
      expect(result.resourceType).toBe('Condition');
      expect(result.subject.reference).toBe('Patient/patient-123');
      expect(resourceRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar BadRequestException si el tipo de recurso no es admitido', async () => {
      await expect(
        service.saveResource('patient-123', 'ObservationInvalid', {}, 'tenant-abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería realizar un upsert correctamente si ya existe un hallazgo para la misma pieza, cara y capa', async () => {
      mockPatientRepository.findOne.mockResolvedValue(mockPatient);

      const existingResource = {
        id: 'existing-id',
        patientId: 'patient-123',
        resourceType: 'Condition',
        tenantId: 'tenant-abc',
        payload: {
          id: 'existing-id',
          bodySite: {
            coding: [{ code: '18' }, { code: 'O' }],
          },
          extension: [{ url: ODONTOGRAM_LAYER_URL, valueCode: 'existing' }],
        },
      } as OdontologyResourceEntity;

      mockResourceRepository.find.mockResolvedValue([existingResource]);
      mockResourceRepository.save.mockImplementation((entity) => Promise.resolve(entity));
      mockResourceRepository.update.mockResolvedValue({});

      const newPayload = {
        bodySite: {
          coding: [{ code: '18' }, { code: 'O' }],
        },
        extension: [{ url: ODONTOGRAM_LAYER_URL, valueCode: 'existing' }],
        note: 'Actualizada',
      };

      const result = await service.saveResource('patient-123', 'Condition', newPayload, 'tenant-abc');

      expect(result.id).toBe('existing-id');
      expect(result.note).toBe('Actualizada');
    });
  });

  describe('getResourcesByPatient', () => {
    it('debería retornar todos los payloads del paciente seleccionado bajo el tenant activo', async () => {
      const mockPatient = { id: 'patient-123', tenantId: 'tenant-abc' } as PatientEntity;
      mockPatientRepository.findOne.mockResolvedValue(mockPatient);

      const resources = [
        { payload: { id: 'r1', resourceType: 'Condition' } },
        { payload: { id: 'r2', resourceType: 'Procedure' } },
      ] as OdontologyResourceEntity[];

      mockResourceRepository.find.mockResolvedValue(resources);

      const result = await service.getResourcesByPatient('patient-123', 'tenant-abc');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('r1');
      expect(result[1].id).toBe('r2');
      expect(resourceRepository.find).toHaveBeenCalledWith({
        where: { patientId: 'patient-123', tenantId: 'tenant-abc' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('completeResource', () => {
    it('debería transicionar un tratamiento de planned (azul) a existing (rojo)', async () => {
      const existingResource = {
        id: 'resource-uuid',
        tenantId: 'tenant-abc',
        payload: {
          resourceType: 'Procedure',
          status: 'preparation',
          extension: [{ url: ODONTOGRAM_LAYER_URL, valueCode: 'planned' }],
        },
      } as OdontologyResourceEntity;

      mockResourceRepository.findOne.mockResolvedValue(existingResource);
      mockResourceRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.completeResource('resource-uuid', 'tenant-abc');

      expect(result.status).toBe('completed');
      expect(result.performedDateTime).toBeDefined();
      const layerExt = result.extension.find((e: any) => e.url === ODONTOGRAM_LAYER_URL);
      expect(layerExt.valueCode).toBe('existing');
    });

    it('debería lanzar BadRequestException si el recurso no es del tipo planned', async () => {
      const existingResource = {
        id: 'resource-uuid',
        tenantId: 'tenant-abc',
        payload: {
          resourceType: 'Procedure',
          status: 'completed',
          extension: [{ url: ODONTOGRAM_LAYER_URL, valueCode: 'existing' }],
        },
      } as OdontologyResourceEntity;

      mockResourceRepository.findOne.mockResolvedValue(existingResource);

      await expect(service.completeResource('resource-uuid', 'tenant-abc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debería lanzar NotFoundException si el recurso no existe o pertenece a otro tenant', async () => {
      mockResourceRepository.findOne.mockResolvedValue(null);

      await expect(service.completeResource('resource-uuid', 'tenant-xyz')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveFile', () => {
    const mockPatient = { id: 'patient-123', tenantId: 'tenant-abc' } as PatientEntity;

    it('guarda una imagen como FHIR Media con url relativa y categoría', async () => {
      mockPatientRepository.findOne.mockResolvedValue(mockPatient);
      mockResourceRepository.save.mockImplementation((e) => { e.id = 'media-1'; return Promise.resolve(e); });
      mockResourceRepository.update.mockResolvedValue({});

      const result = await service.saveFile(
        'patient-123',
        { originalname: 'rx.png', filename: 'odo-123.png', mimetype: 'image/png', size: 5000 },
        'Panorámica inicial', 'radiografia', 'tenant-abc',
      );

      expect(result.resourceType).toBe('Media');
      expect(result.content.url).toBe('/uploads/odo-123.png');
      expect(result.content.contentType).toBe('image/png');
      expect(result._category).toBe('radiografia');
      expect(result.subject.reference).toBe('Patient/patient-123');
      expect(result.id).toBe('media-1');
    });

    it('guarda un PDF como FHIR DocumentReference', async () => {
      mockPatientRepository.findOne.mockResolvedValue(mockPatient);
      mockResourceRepository.save.mockImplementation((e) => { e.id = 'doc-1'; return Promise.resolve(e); });
      mockResourceRepository.update.mockResolvedValue({});

      const result = await service.saveFile(
        'patient-123',
        { originalname: 'consentimiento.pdf', filename: 'odo-9.pdf', mimetype: 'application/pdf', size: 9000 },
        '', 'documento', 'tenant-abc',
      );

      expect(result.resourceType).toBe('DocumentReference');
      expect(result.content[0].attachment.url).toBe('/uploads/odo-9.pdf');
      expect(result._category).toBe('documento');
    });

    it('lanza NotFoundException si el paciente no es del tenant', async () => {
      mockPatientRepository.findOne.mockResolvedValue(null);
      await expect(
        service.saveFile('patient-123', { originalname: 'x.png', filename: 'y.png', mimetype: 'image/png', size: 1 }, '', 'foto', 'tenant-xyz'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('enrichPatients', () => {
    it('devuelve un mapa vacío si no hay IDs', async () => {
      const result = await service.enrichPatients([], 'tenant-abc');
      expect(result).toEqual({});
    });

    it('toma la fecha más reciente entre turno atendido y actividad odontológica, y la última obra social', async () => {
      // Turno fulfilled más antiguo que la actividad odonto → debe ganar la odonto.
      mockAppointmentRepository.createQueryBuilder.mockReturnValue(
        makeQb([{ pid: 'p1', last: '2026-01-10T10:00:00.000Z' }]),
      );
      mockResourceRepository.createQueryBuilder.mockReturnValue(
        makeQb([{ pid: 'p1', last: '2026-03-20T09:00:00.000Z' }]),
      );
      mockResourceRepository.find.mockResolvedValue([
        { patientId: 'p1', payload: { obraSocial: 'OSDE' } },
      ]);

      const result = await service.enrichPatients(['p1'], 'tenant-abc');

      expect(result.p1.lastVisit).toBe('2026-03-20T09:00:00.000Z');
      expect(result.p1.obraSocial).toBe('OSDE');
    });

    it('deja null cuando un paciente no tiene visitas ni cobertura', async () => {
      mockAppointmentRepository.createQueryBuilder.mockReturnValue(makeQb([]));
      mockResourceRepository.createQueryBuilder.mockReturnValue(makeQb([]));
      mockResourceRepository.find.mockResolvedValue([]);

      const result = await service.enrichPatients(['p2'], 'tenant-abc');

      expect(result.p2).toEqual({ lastVisit: null, obraSocial: null });
    });
  });

  describe('deleteResource', () => {
    it('debería eliminar el recurso si pertenece al tenant correcto', async () => {
      const existingResource = {
        id: 'resource-uuid',
        tenantId: 'tenant-abc',
      } as OdontologyResourceEntity;

      mockResourceRepository.findOne.mockResolvedValue(existingResource);
      mockResourceRepository.remove.mockResolvedValue(existingResource);

      const result = await service.deleteResource('resource-uuid', 'tenant-abc');
      expect(result.message).toContain('eliminado con éxito');
      expect(resourceRepository.remove).toHaveBeenCalledWith(existingResource);
    });

    it('debería lanzar NotFoundException si el recurso no existe o pertenece a otro tenant', async () => {
      mockResourceRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteResource('resource-uuid', 'tenant-xyz')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
