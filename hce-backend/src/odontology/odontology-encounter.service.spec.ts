import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OdontologyEncounterService } from './odontology-encounter.service';
import { OdontologyEncounterAuditService } from './odontology-encounter-audit.service';
import { OdontologyEncounterEntity } from './odontology-encounter.entity';
import { OdontologyResourceEntity } from './odontology-resource.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';

/**
 * Quality Gate de QA — VISITA / ENCUENTRO odontológico (módulo aislado).
 * Cubre las invariantes 1-6: apertura idempotente, aislamiento tenant (Zero Trust),
 * firma + hash, vínculo con turno, cancelación con desvinculación, y addenda append-only.
 * Patrón: mock de repositorios TypeORM vía getRepositoryToken (igual que
 * odontology.service.spec.ts y appointment.service.spec.ts).
 */
describe('OdontologyEncounterService — ciclo de vida de la visita odontológica', () => {
  let service: OdontologyEncounterService;

  const mockEncounterRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockResourceRepo = {
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockPatientRepo = { findOne: jest.fn() };
  const mockAppointmentRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockAudit = { log: jest.fn(), getHistory: jest.fn() };

  const userCtx = { userId: 'sub-123', userName: 'Dra. Test' };
  const TENANT = 'tenant-abc';
  const PATIENT = 'patient-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdontologyEncounterService,
        { provide: getRepositoryToken(OdontologyEncounterEntity), useValue: mockEncounterRepo },
        { provide: getRepositoryToken(OdontologyResourceEntity), useValue: mockResourceRepo },
        { provide: getRepositoryToken(PatientEntity), useValue: mockPatientRepo },
        { provide: getRepositoryToken(AppointmentEntity), useValue: mockAppointmentRepo },
        { provide: OdontologyEncounterAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<OdontologyEncounterService>(OdontologyEncounterService);
    jest.clearAllMocks();
    // Por defecto, el paciente existe en el tenant (la mayoría de los tests lo asumen).
    mockPatientRepo.findOne.mockResolvedValue({ id: PATIENT, tenantId: TENANT } as PatientEntity);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INVARIANTE 1: Apertura idempotente
  // ──────────────────────────────────────────────────────────────────────────
  describe('open() — apertura idempotente', () => {
    it('si ya hay una visita in-progress devuelve la existente y NO crea otra', async () => {
      const existing = {
        id: 'enc-existing',
        tenantId: TENANT,
        patientId: PATIENT,
        status: 'in-progress',
        startDate: new Date(),
        payload: { resourceType: 'Encounter' },
        addenda: [],
      } as unknown as OdontologyEncounterEntity;
      mockEncounterRepo.findOne.mockResolvedValue(existing);

      const result = await service.open(PATIENT, {}, TENANT, userCtx);

      expect(result.id).toBe('enc-existing');
      expect(result.status).toBe('in-progress');
      expect(mockEncounterRepo.save).not.toHaveBeenCalled();
      expect(mockEncounterRepo.findOne).toHaveBeenCalledWith({
        where: { patientId: PATIENT, tenantId: TENANT, status: 'in-progress' },
        order: { startDate: 'DESC' },
      });
    });

    it('si NO hay visita activa crea una nueva in-progress', async () => {
      mockEncounterRepo.findOne.mockResolvedValue(null);
      mockEncounterRepo.save.mockImplementation((e: any) => {
        e.id = 'enc-new';
        return Promise.resolve(e);
      });
      mockEncounterRepo.update.mockResolvedValue({});

      const result = await service.open(PATIENT, { reasonText: 'Control' }, TENANT, userCtx);

      expect(result.id).toBe('enc-new');
      expect(result.status).toBe('in-progress');
      expect(mockEncounterRepo.save).toHaveBeenCalledTimes(1);
    });

    it('ante carrera (índice único parcial rechaza la 2da) devuelve la existente sin propagar el error', async () => {
      const dup = {
        id: 'enc-dup',
        tenantId: TENANT,
        patientId: PATIENT,
        status: 'in-progress',
        startDate: new Date(),
        payload: {},
        addenda: [],
      } as unknown as OdontologyEncounterEntity;
      // 1ª findOne: no hay activa → intenta crear; save falla; 2ª findOne: aparece la dup.
      mockEncounterRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(dup);
      mockEncounterRepo.save.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      const result = await service.open(PATIENT, {}, TENANT, userCtx);

      expect(result.id).toBe('enc-dup');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INVARIANTE 2: Aislamiento tenant (Zero Trust)
  // ──────────────────────────────────────────────────────────────────────────
  describe('aislamiento multi-inquilino (Zero Trust)', () => {
    it('open() lanza NotFound si el paciente es de otro tenant', async () => {
      mockPatientRepo.findOne.mockResolvedValue(null);
      await expect(service.open(PATIENT, {}, 'tenant-xyz', userCtx)).rejects.toThrow(NotFoundException);
      expect(mockPatientRepo.findOne).toHaveBeenCalledWith({ where: { id: PATIENT, tenantId: 'tenant-xyz' } });
    });

    it('getActive() lanza NotFound si el paciente es de otro tenant', async () => {
      mockPatientRepo.findOne.mockResolvedValue(null);
      await expect(service.getActive(PATIENT, 'tenant-xyz')).rejects.toThrow(NotFoundException);
    });

    it('list() lanza NotFound si el paciente es de otro tenant', async () => {
      mockPatientRepo.findOne.mockResolvedValue(null);
      await expect(service.list(PATIENT, 'tenant-xyz')).rejects.toThrow(NotFoundException);
    });

    it('getOne() filtra por tenant: visita de otro tenant da NotFound', async () => {
      mockEncounterRepo.findOne.mockResolvedValue(null);
      await expect(service.getOne('enc-1', PATIENT, TENANT)).rejects.toThrow(NotFoundException);
      expect(mockEncounterRepo.findOne).toHaveBeenCalledWith({ where: { id: 'enc-1', patientId: PATIENT, tenantId: TENANT } });
    });

    it('sign() filtra por tenant: visita de otro tenant da NotFound', async () => {
      mockEncounterRepo.findOne.mockResolvedValue(null);
      await expect(service.sign('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(NotFoundException);
      expect(mockEncounterRepo.findOne).toHaveBeenCalledWith({ where: { id: 'enc-1', patientId: PATIENT, tenantId: TENANT } });
    });

    it('cancel() filtra por tenant: visita de otro tenant da NotFound', async () => {
      mockEncounterRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(NotFoundException);
      expect(mockEncounterRepo.findOne).toHaveBeenCalledWith({ where: { id: 'enc-1', patientId: PATIENT, tenantId: TENANT } });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INVARIANTE 3: Firma
  // ──────────────────────────────────────────────────────────────────────────
  describe('sign() — firma e inmutabilidad', () => {
    it('setea status finished, endDate, signedBy/Id, signedAt y contentHash', async () => {
      const entity = {
        id: 'enc-1',
        tenantId: TENANT,
        patientId: PATIENT,
        status: 'in-progress',
        startDate: new Date('2026-01-01T10:00:00Z'),
        reasonText: 'Control',
        appointmentId: null,
        payload: { resourceType: 'Encounter', status: 'in-progress' },
        addenda: [],
      } as unknown as OdontologyEncounterEntity;
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockResourceRepo.find.mockResolvedValue([
        { resourceType: 'Procedure', payload: { resourceType: 'Procedure' } },
      ]);
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.sign('enc-1', PATIENT, TENANT, userCtx);

      expect(result.status).toBe('finished');
      expect(result.end).toBeDefined();
      expect(result.signedBy).toBe('Dra. Test');
      expect(result.signedById).toBe('sub-123');
      expect(result.signedAt).toBeDefined();
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('re-firmar una visita ya finished lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'finished',
      } as unknown as OdontologyEncounterEntity);
      await expect(service.sign('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(BadRequestException);
      expect(mockEncounterRepo.save).not.toHaveBeenCalled();
    });

    it('firmar una visita cancelada lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'cancelled',
      } as unknown as OdontologyEncounterEntity);
      await expect(service.sign('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(BadRequestException);
    });

    it('firmar una visita vacía (sin prestaciones ni reasonText) lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'in-progress',
        reasonText: null, startDate: new Date(), payload: {}, addenda: [],
      } as unknown as OdontologyEncounterEntity);
      mockResourceRepo.find.mockResolvedValue([]); // sin prestaciones

      await expect(service.sign('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(BadRequestException);
      expect(mockEncounterRepo.save).not.toHaveBeenCalled();
    });

    it('firmar una visita vacía PERO con reasonText es válido', async () => {
      const entity = {
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'in-progress',
        reasonText: 'Solo control sin prestaciones', startDate: new Date(),
        appointmentId: null, payload: {}, addenda: [],
      } as unknown as OdontologyEncounterEntity;
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockResourceRepo.find.mockResolvedValue([]); // sin prestaciones, pero hay motivo
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.sign('enc-1', PATIENT, TENANT, userCtx);
      expect(result.status).toBe('finished');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INVARIANTE 4: Vínculo con el turno
  // ──────────────────────────────────────────────────────────────────────────
  describe('sign() — vínculo con el turno', () => {
    it('al firmar con appointmentId el turno pasa a fulfilled', async () => {
      const entity = {
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'in-progress',
        reasonText: 'Control', startDate: new Date(), appointmentId: 'appt-1',
        payload: {}, addenda: [],
      } as unknown as OdontologyEncounterEntity;
      const appt = { id: 'appt-1', tenantId: TENANT, status: 'arrived', payload: { status: 'arrived' } };
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockResourceRepo.find.mockResolvedValue([{ resourceType: 'Procedure', payload: {} }]);
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));
      mockAppointmentRepo.findOne.mockResolvedValue(appt);
      mockAppointmentRepo.save.mockResolvedValue(appt);

      await service.sign('enc-1', PATIENT, TENANT, userCtx);

      expect(mockAppointmentRepo.findOne).toHaveBeenCalledWith({ where: { id: 'appt-1', tenantId: TENANT } });
      expect(appt.status).toBe('fulfilled');
      expect(appt.payload.status).toBe('fulfilled');
      expect(mockAppointmentRepo.save).toHaveBeenCalledWith(appt);
    });

    it('un turno cancelado/noshow NO se marca fulfilled al firmar', async () => {
      const entity = {
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'in-progress',
        reasonText: 'Control', startDate: new Date(), appointmentId: 'appt-1',
        payload: {}, addenda: [],
      } as unknown as OdontologyEncounterEntity;
      const appt = { id: 'appt-1', tenantId: TENANT, status: 'cancelled', payload: { status: 'cancelled' } };
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockResourceRepo.find.mockResolvedValue([{ resourceType: 'Procedure', payload: {} }]);
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));
      mockAppointmentRepo.findOne.mockResolvedValue(appt);

      await service.sign('enc-1', PATIENT, TENANT, userCtx);

      expect(appt.status).toBe('cancelled');
      expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INVARIANTE 5: Cancelación
  // ──────────────────────────────────────────────────────────────────────────
  describe('cancel() — cancelación con desvinculación', () => {
    it('desvincula las prestaciones (encounter_id → null) y deja status cancelled', async () => {
      const entity = {
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'in-progress',
        payload: { status: 'in-progress' }, addenda: [], startDate: new Date(),
      } as unknown as OdontologyEncounterEntity;
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockResourceRepo.update.mockResolvedValue({});
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.cancel('enc-1', PATIENT, TENANT, userCtx);

      expect(result.status).toBe('cancelled');
      expect(mockResourceRepo.update).toHaveBeenCalledWith(
        { encounterId: 'enc-1', tenantId: TENANT },
        { encounterId: null },
      );
    });

    it('cancelar una visita ya finished lanza BadRequest y NO toca prestaciones', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'finished',
      } as unknown as OdontologyEncounterEntity);
      await expect(service.cancel('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(BadRequestException);
      expect(mockResourceRepo.update).not.toHaveBeenCalled();
      expect(mockEncounterRepo.save).not.toHaveBeenCalled();
    });

    it('cancelar una visita ya cancelada lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'cancelled',
      } as unknown as OdontologyEncounterEntity);
      await expect(service.cancel('enc-1', PATIENT, TENANT, userCtx)).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INVARIANTE 6: Addenda
  // ──────────────────────────────────────────────────────────────────────────
  describe('addAddenda() — append-only sobre visita firmada', () => {
    it('agrega una addenda solo si la visita está finished', async () => {
      const entity = {
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'finished',
        payload: { status: 'finished' }, addenda: [], startDate: new Date(),
      } as unknown as OdontologyEncounterEntity;
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.addAddenda('enc-1', PATIENT, 'Corrección: faltó registrar X', TENANT, userCtx);

      expect(result.addenda).toHaveLength(1);
      expect(result.addenda[0].text).toBe('Corrección: faltó registrar X');
      expect(result.addenda[0].authoredBy).toBe('Dra. Test');
      expect(result.addenda[0].authoredById).toBe('sub-123');
    });

    it('es append-only: una nueva addenda se suma a las existentes sin pisarlas', async () => {
      const entity = {
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'finished',
        payload: { status: 'finished' },
        addenda: [{ id: 'a0', text: 'previa', authoredBy: 'X', authoredById: 'x', authoredAt: '2026-01-01T00:00:00Z' }],
        startDate: new Date(),
      } as unknown as OdontologyEncounterEntity;
      mockEncounterRepo.findOne.mockResolvedValue(entity);
      mockEncounterRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.addAddenda('enc-1', PATIENT, 'segunda', TENANT, userCtx);

      expect(result.addenda).toHaveLength(2);
      expect(result.addenda[0].text).toBe('previa');
      expect(result.addenda[1].text).toBe('segunda');
    });

    it('agregar addenda a una visita in-progress (no firmada) lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'in-progress', addenda: [],
      } as unknown as OdontologyEncounterEntity);
      await expect(service.addAddenda('enc-1', PATIENT, 'texto', TENANT, userCtx)).rejects.toThrow(BadRequestException);
    });

    it('addenda vacía (o solo espacios) lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'enc-1', tenantId: TENANT, patientId: PATIENT, status: 'finished', addenda: [],
      } as unknown as OdontologyEncounterEntity);
      await expect(service.addAddenda('enc-1', PATIENT, '   ', TENANT, userCtx)).rejects.toThrow(BadRequestException);
      expect(mockEncounterRepo.save).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers de guard usados por OdontologyService
  // ──────────────────────────────────────────────────────────────────────────
  describe('assertActiveForResource() — guard de asociación de prestaciones', () => {
    it('una visita firmada lanza ForbiddenException', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({ id: 'enc-1', status: 'finished' });
      await expect(service.assertActiveForResource('enc-1', PATIENT, TENANT)).rejects.toThrow(ForbiddenException);
    });

    it('una visita inexistente (o de otro tenant) lanza BadRequest', async () => {
      mockEncounterRepo.findOne.mockResolvedValue(null);
      await expect(service.assertActiveForResource('enc-1', PATIENT, TENANT)).rejects.toThrow(BadRequestException);
    });

    it('una visita activa pasa sin error', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({ id: 'enc-1', status: 'in-progress' });
      await expect(service.assertActiveForResource('enc-1', PATIENT, TENANT)).resolves.toBeUndefined();
    });
  });

  describe('isFinished() — helper de inmutabilidad', () => {
    it('devuelve true si el encuentro está finished', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({ id: 'enc-1', status: 'finished' });
      await expect(service.isFinished('enc-1', TENANT)).resolves.toBe(true);
    });

    it('devuelve false si está in-progress', async () => {
      mockEncounterRepo.findOne.mockResolvedValue({ id: 'enc-1', status: 'in-progress' });
      await expect(service.isFinished('enc-1', TENANT)).resolves.toBe(false);
    });

    it('devuelve false si no se pasa encounterId', async () => {
      await expect(service.isFinished('', TENANT)).resolves.toBe(false);
      expect(mockEncounterRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
