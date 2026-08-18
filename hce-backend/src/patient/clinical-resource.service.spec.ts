import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ClinicalResourceEntity } from './clinical-resource.entity';
import { ClinicalResourceService } from './clinical-resource.service';
import { PatientEntity } from './patient.entity';

describe('ClinicalResourceService', () => {
  let service: ClinicalResourceService;
  let resourceRepo: jest.Mocked<Repository<ClinicalResourceEntity>>;
  let patientRepo: jest.Mocked<Repository<PatientEntity>>;

  const patientId = '2037da20-c722-4714-8697-552adda33d5f';
  const tenantId = 'clinica-test';

  beforeEach(async () => {
    const resourceRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const patientRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalResourceService,
        {
          provide: getRepositoryToken(ClinicalResourceEntity),
          useValue: resourceRepository,
        },
        {
          provide: getRepositoryToken(PatientEntity),
          useValue: patientRepository,
        },
      ],
    }).compile();

    service = module.get(ClinicalResourceService);
    resourceRepo = module.get(getRepositoryToken(ClinicalResourceEntity));
    patientRepo = module.get(getRepositoryToken(PatientEntity));
  });

  it('guarda AllergyIntolerance como FHIR R4 usando patient y no subject', async () => {
    patientRepo.findOne.mockResolvedValue({
      id: patientId,
      tenantId,
    } as PatientEntity);
    resourceRepo.save.mockImplementation(async (entity) => ({
      ...(entity as ClinicalResourceEntity),
      id: 'allergy-1',
      payload: { ...(entity as ClinicalResourceEntity).payload },
    }));
    resourceRepo.update.mockResolvedValue({ affected: 1 } as any);

    const result = await service.saveResource(
      patientId,
      'AllergyIntolerance',
      {
        clinicalStatus: {
          coding: [{ code: 'active' }],
        },
        criticality: 'high',
        subject: { reference: 'Patient/no-debe-quedar' },
      },
      tenantId,
    );

    expect(result.resourceType).toBe('AllergyIntolerance');
    expect(result.patient).toEqual({ reference: `Patient/${patientId}` });
    expect(result.subject).toBeUndefined();
  });

  it('guarda Condition odontologica con subject y sin patient', async () => {
    patientRepo.findOne.mockResolvedValue({
      id: patientId,
      tenantId,
    } as PatientEntity);
    resourceRepo.find.mockResolvedValue([]);
    resourceRepo.save.mockImplementation(async (entity) => ({
      ...(entity as ClinicalResourceEntity),
      id: 'condition-1',
      payload: { ...(entity as ClinicalResourceEntity).payload },
    }));
    resourceRepo.update.mockResolvedValue({ affected: 1 } as any);

    const result = await service.saveResource(
      patientId,
      'Condition',
      {
        code: { text: 'Caries' },
        patient: { reference: 'Patient/no-debe-quedar' },
        bodySite: { coding: [{ code: '11', display: 'Pieza dental 11' }] },
      },
      tenantId,
    );

    expect(result.resourceType).toBe('Condition');
    expect(result.subject).toEqual({ reference: `Patient/${patientId}` });
    expect(result.patient).toBeUndefined();
  });

  it('rechaza recursos de pacientes que no pertenecen al tenant', async () => {
    patientRepo.findOne.mockResolvedValue(null);

    await expect(
      service.saveResource(
        patientId,
        'AllergyIntolerance',
        { criticality: 'high' },
        tenantId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza tipos FHIR no permitidos', async () => {
    await expect(
      service.saveResource(patientId, 'Claim', {}, tenantId),
    ).rejects.toThrow(BadRequestException);
  });
});
