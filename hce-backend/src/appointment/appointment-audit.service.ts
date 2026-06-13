import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentAuditEntity } from './appointment-audit.entity';

/**
 * AppointmentAuditService — auditoría inmutable de turnos (creación, cancelación, modificación).
 */
@Injectable()
export class AppointmentAuditService {
  constructor(
    @InjectRepository(AppointmentAuditEntity)
    private auditRepository: Repository<AppointmentAuditEntity>,
  ) {}

  async log(params: {
    appointmentId: string;
    tenantId: string;
    actorId: string;
    actorName: string;
    isServiceAccount?: boolean;
    originChannel?: string;
    action: 'CREATE' | 'CANCEL' | 'UPDATE';
    payloadSnapshot?: any;
  }): Promise<void> {
    const entry = new AppointmentAuditEntity();
    entry.appointmentId = params.appointmentId;
    entry.tenantId = params.tenantId;
    entry.actorId = params.actorId;
    entry.actorName = params.actorName;
    entry.isServiceAccount = params.isServiceAccount ?? false;
    entry.originChannel = params.originChannel ?? null;
    entry.action = params.action;
    entry.payloadSnapshot = params.payloadSnapshot ?? null;

    await this.auditRepository.save(entry);
  }

  async getHistory(appointmentId: string, tenantId: string): Promise<AppointmentAuditEntity[]> {
    return this.auditRepository.find({
      where: { appointmentId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}
