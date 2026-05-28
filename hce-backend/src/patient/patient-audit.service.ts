import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientAuditEntity } from './patient-audit.entity';

/**
 * PatientAuditService — Tarea 2.4
 * Servicio de trazabilidad y auditoría de cambios demográficos de pacientes.
 */
@Injectable()
export class PatientAuditService {
  constructor(
    @InjectRepository(PatientAuditEntity)
    private auditRepository: Repository<PatientAuditEntity>,
  ) {}

  /**
   * Registra un evento de auditoría. Calcular el diff de campos clave
   * entre el estado anterior y el nuevo.
   */
  async logChange(params: {
    patientId: string;
    tenantId: string;
    userId: string;
    userName: string;
    action: 'CREATE' | 'UPDATE';
    before?: Record<string, any>;
    after: Record<string, any>;
    payloadSnapshot?: any;
  }): Promise<void> {
    const changedFields: Record<string, { before: any; after: any }> = {};

    // Campos demográficos a comparar en un UPDATE
    if (params.action === 'UPDATE' && params.before) {
      const trackedFields = ['dni', 'familyName', 'givenName', 'gender', 'birthDate', 'phone', 'email', 'address'];
      for (const field of trackedFields) {
        const prev = params.before[field];
        const curr = params.after[field];
        if (JSON.stringify(prev) !== JSON.stringify(curr)) {
          changedFields[field] = { before: prev ?? null, after: curr ?? null };
        }
      }
    }

    const entry = new PatientAuditEntity();
    entry.patientId = params.patientId;
    entry.tenantId = params.tenantId;
    entry.userId = params.userId;
    entry.userName = params.userName;
    entry.action = params.action;
    entry.changedFields = Object.keys(changedFields).length > 0 ? changedFields : (undefined as any);
    entry.payloadSnapshot = params.payloadSnapshot || (undefined as any);

    await this.auditRepository.save(entry);
  }

  /**
   * Devuelve el historial de auditoría de un paciente para el tenant dado.
   * Ordenado del más reciente al más antiguo.
   */
  async getHistory(patientId: string, tenantId: string): Promise<PatientAuditEntity[]> {
    return this.auditRepository.find({
      where: { patientId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}
