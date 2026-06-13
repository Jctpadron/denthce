import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { AppointmentEntity } from './appointment.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentAuditService } from './appointment-audit.service';
import { WebhookService } from '../webhook/webhook.service';

/**
 * Tests de la lógica nueva del Módulo 5 (Tareas 5.2/5.3/5.4):
 * transición de estado, clasificación de urgencia (priority) y recordatorio,
 * con foco en el aislamiento multi-inquilino (Zero Trust).
 */
describe('AppointmentService — transición de estado / triaje / recordatorio', () => {
  let service: AppointmentService;

  const mockApptRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockPatientRepo = { findOne: jest.fn() };
  const mockAudit = { log: jest.fn() };
  const mockWebhook = { dispatch: jest.fn() };

  const actor = { actorId: 'u1', actorName: 'Dr. Test', isServiceAccount: false };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(AppointmentEntity), useValue: mockApptRepo },
        { provide: getRepositoryToken(PatientEntity), useValue: mockPatientRepo },
        { provide: AppointmentAuditService, useValue: mockAudit },
        { provide: WebhookService, useValue: mockWebhook },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    jest.clearAllMocks();
  });

  describe('changeStatus', () => {
    it('rechaza un estado inválido (no permite "cancelled" por esta vía)', async () => {
      await expect(service.changeStatus('a1', 'cancelled', 't1', actor)).rejects.toThrow(BadRequestException);
      expect(mockApptRepo.findOne).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el turno no pertenece al tenant (aislamiento ZT)', async () => {
      mockApptRepo.findOne.mockResolvedValue(null);
      await expect(service.changeStatus('a1', 'arrived', 't1', actor)).rejects.toThrow(NotFoundException);
      expect(mockApptRepo.findOne).toHaveBeenCalledWith({ where: { id: 'a1', tenantId: 't1' } });
    });

    it('marca llegada y persiste la prioridad en entidad y payload, auditando UPDATE', async () => {
      const appt: any = { id: 'a1', tenantId: 't1', status: 'booked', payload: { status: 'booked' } };
      mockApptRepo.findOne.mockResolvedValue(appt);
      mockApptRepo.save.mockImplementation(async (e: any) => e);

      const res = await service.changeStatus('a1', 'arrived', 't1', actor, 2);

      expect(res.status).toBe('arrived');
      expect(res.priority).toBe(2);
      expect(appt.priority).toBe(2);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: 'a1', tenantId: 't1', action: 'UPDATE' }),
      );
    });

    it('rechaza una prioridad fuera de rango (1-5)', async () => {
      const appt: any = { id: 'a1', tenantId: 't1', status: 'booked', payload: {} };
      mockApptRepo.findOne.mockResolvedValue(appt);
      await expect(service.changeStatus('a1', 'arrived', 't1', actor, 9)).rejects.toThrow(BadRequestException);
    });

    it('rechaza una prioridad no numérica (evita 500 al guardar en columna INT)', async () => {
      const appt: any = { id: 'a1', tenantId: 't1', status: 'booked', payload: {} };
      mockApptRepo.findOne.mockResolvedValue(appt);
      await expect(service.changeStatus('a1', 'arrived', 't1', actor, 'abc' as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendReminder', () => {
    it('despacha el webhook REMINDER para un turno activo', async () => {
      const appt: any = { id: 'a1', tenantId: 't1', status: 'booked' };
      mockApptRepo.findOne.mockResolvedValue(appt);
      mockWebhook.dispatch.mockResolvedValue(undefined);

      const res = await service.sendReminder('a1', 't1');

      expect(res).toEqual({ status: 'sent', appointmentId: 'a1' });
      expect(mockWebhook.dispatch).toHaveBeenCalledWith('REMINDER', appt, 't1');
    });

    it('no permite recordatorio de un turno ya atendido', async () => {
      mockApptRepo.findOne.mockResolvedValue({ id: 'a1', tenantId: 't1', status: 'fulfilled' });
      await expect(service.sendReminder('a1', 't1')).rejects.toThrow(BadRequestException);
      expect(mockWebhook.dispatch).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el turno no es del tenant', async () => {
      mockApptRepo.findOne.mockResolvedValue(null);
      await expect(service.sendReminder('a1', 't1')).rejects.toThrow(NotFoundException);
    });
  });
});
