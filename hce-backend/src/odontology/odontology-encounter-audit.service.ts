import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdontologyEncounterAuditEntity } from './odontology-encounter-audit.entity';

/**
 * Auditoría inmutable de la visita odontológica (apertura, firma, cancelación, addenda).
 */
@Injectable()
export class OdontologyEncounterAuditService {
  constructor(
    @InjectRepository(OdontologyEncounterAuditEntity)
    private readonly auditRepo: Repository<OdontologyEncounterAuditEntity>,
  ) {}

  async log(params: {
    encounterId: string;
    tenantId: string;
    patientId: string;
    actorId: string;
    actorName: string;
    action: 'OPEN' | 'SIGN' | 'CANCEL' | 'ADDENDA';
    payloadSnapshot?: any;
  }): Promise<void> {
    const entry = new OdontologyEncounterAuditEntity();
    entry.encounterId = params.encounterId;
    entry.tenantId = params.tenantId;
    entry.patientId = params.patientId;
    entry.actorId = params.actorId;
    entry.actorName = params.actorName;
    entry.action = params.action;
    entry.payloadSnapshot = params.payloadSnapshot ?? null;
    await this.auditRepo.save(entry);
  }

  async getHistory(encounterId: string, tenantId: string): Promise<OdontologyEncounterAuditEntity[]> {
    return this.auditRepo.find({ where: { encounterId, tenantId }, order: { createdAt: 'DESC' } });
  }
}
