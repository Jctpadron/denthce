import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdontologyService, ODONTOGRAM_LAYER_URL } from './odontology.service';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { PatientEntity } from '../patient/patient.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OdontologyService', () => {
  let service: OdontologyService;
  let resourceRepository: Repository<OdontologyResourceEntity>;
  let patientRepository: Repository<PatientEntity>;

  const mockResourceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockPatientRepository = {
    findOne: jest.fn(),
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
