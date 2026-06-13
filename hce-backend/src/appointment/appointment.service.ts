import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentEntity } from './appointment.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentAuditService } from './appointment-audit.service';
import { WebhookService } from '../webhook/webhook.service';

const ORIGIN_CHANNEL_EXT = 'http://hospital.gov/fhir/StructureDefinition/origin-channel';
const STATUSES_REQUIRING_END = ['booked', 'arrived', 'fulfilled'];

type ActorCtx = {
  actorId: string;
  actorName: string;
  isServiceAccount?: boolean;
};

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private appointmentRepository: Repository<AppointmentEntity>,
    @InjectRepository(PatientEntity)
    private patientRepository: Repository<PatientEntity>,
    private readonly auditService: AppointmentAuditService,
    private readonly webhookService: WebhookService,
  ) {}

  /**
   * Crea un turno. Resuelve el paciente del HCE por (dni, gender) — el HCE es dueño del padrón.
   * Idempotente por `idempotencyKey` (reintentos de CliniChat no duplican turnos).
   */
  async create(dto: any, tenantId: string, actor: ActorCtx): Promise<any> {
    const patientDni = dto.patientDni || null;
    const gender = dto.gender || 'unknown';
    const start = dto.start || dto.startDate;
    const serviceType = dto.serviceType || (Array.isArray(dto.serviceType) ? dto.serviceType?.[0]?.text : undefined);
    const practitionerName = dto.practitionerName || null;
    const practitionerRef = dto.practitionerRef || null;
    const status = dto.status || 'booked';
    const originChannel = dto.originChannel || 'recepcion';
    const idempotencyKey = dto.idempotencyKey || null;
    const minutesDuration = dto.minutesDuration ? parseInt(String(dto.minutesDuration), 10) : 30;

    if (!start) {
      throw new BadRequestException('Falta la fecha/hora de inicio del turno (start).');
    }

    // Calcular start y end del nuevo turno para verificar colisiones y reglas FHIR
    const startDate = new Date(start);
    let endDate: Date | null = dto.end || dto.endDate ? new Date(dto.end || dto.endDate) : null;
    if (!endDate && STATUSES_REQUIRING_END.includes(status)) {
      endDate = new Date(startDate.getTime() + minutesDuration * 60000);
    }
    const finalEnd = endDate || new Date(startDate.getTime() + minutesDuration * 60000);

    // Idempotencia: si ya existe un turno con esa key en el tenant, devolverlo en vez de crear otro.
    if (idempotencyKey) {
      const dup = await this.appointmentRepository.findOne({ where: { idempotencyKey, tenantId } });
      if (dup) {
        return dup.payload;
      }
    }

    // Prevención de Doble Reserva (Double-booking prevention):
    // Cada tenant representa un consultorio mono-profesional independiente.
    // Si hay otra cita activa en el mismo bloque de tiempo, devolvemos 409 Conflict.
    if (status !== 'cancelled') {
      const collision = await this.appointmentRepository
        .createQueryBuilder('appt')
        .where('appt.tenant_id = :tenantId', { tenantId })
        .andWhere('appt.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
        .andWhere('appt.start_date < :newEnd', { newEnd: finalEnd })
        .andWhere('appt.end_date > :newStart', { newStart: startDate })
        .getOne();

      if (collision) {
        throw new ConflictException({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'conflict',
              diagnostics: 'slot-unavailable',
              details: {
                coding: [
                  {
                    system: 'http://hospital.gov/fhir/StructureDefinition/appointment-errors',
                    code: 'slot-unavailable',
                    display: 'Slot ocupado o no disponible',
                  },
                ],
                text: 'El horario seleccionado ya se encuentra ocupado por otra cita activa.',
              },
            },
          ],
        });
      }
    }

    // Resolver el paciente por (dni, gender) en el padrón del HCE.
    let patientId: string | null = null;
    let patientDisplay: string | undefined;
    if (patientDni) {
      const patient = await this.patientRepository.findOne({ where: { dni: patientDni, gender, tenantId } });
      if (!patient) {
        throw new NotFoundException(
          `No existe un paciente con DNI ${patientDni} y sexo ${gender} en tu consultorio. Registrá el paciente antes de agendar el turno.`,
        );
      }
      patientId = patient.id;
      patientDisplay = `${patient.givenName} ${patient.familyName}`.trim();
    }

    const entity = new AppointmentEntity();
    entity.tenantId = tenantId;
    entity.patientId = patientId;
    entity.patientDni = patientDni;
    entity.status = status;
    entity.practitionerRef = practitionerRef;
    entity.practitionerName = practitionerName;
    entity.serviceType = serviceType || null;
    entity.startDate = startDate;
    entity.endDate = endDate;
    entity.originChannel = originChannel;
    entity.idempotencyKey = idempotencyKey;

    entity.payload = this.buildFhir(entity, patientDisplay, dto.comment);

    const saved = await this.appointmentRepository.save(entity);
    saved.payload.id = saved.id;
    await this.appointmentRepository.update(saved.id, { payload: saved.payload });

    await this.auditService.log({
      appointmentId: saved.id,
      tenantId,
      actorId: actor.actorId,
      actorName: actor.actorName,
      isServiceAccount: actor.isServiceAccount,
      originChannel,
      action: 'CREATE',
      payloadSnapshot: saved.payload,
    });

    // Disparar Webhook si el origen es Recepción (evitar bucles infinitos con WhatsApp)
    if (saved.originChannel === 'recepcion') {
      this.webhookService.dispatch('CREATE', saved, tenantId).catch(() => {});
    }

    return saved.payload;
  }

  async findOne(id: string, tenantId: string): Promise<any> {
    const appt = await this.appointmentRepository.findOne({ where: { id, tenantId } });
    if (!appt) {
      throw new NotFoundException(`Turno con ID ${id} no encontrado en tu consultorio.`);
    }
    return appt.payload;
  }

  /** Cancela un turno: status='cancelled' + motivo, auditado. */
  async cancel(id: string, reason: string | undefined, tenantId: string, actor: ActorCtx): Promise<any> {
    const appt = await this.appointmentRepository.findOne({ where: { id, tenantId } });
    if (!appt) {
      throw new NotFoundException(`Turno con ID ${id} no encontrado en tu consultorio.`);
    }

    appt.status = 'cancelled';
    appt.cancellationReason = reason || null;
    appt.payload = {
      ...appt.payload,
      status: 'cancelled',
      cancelationReason: reason ? { text: reason } : undefined,
    };
    // El participante paciente pasa a 'declined' al cancelar (FHIR).
    if (Array.isArray(appt.payload.participant)) {
      appt.payload.participant = appt.payload.participant.map((p: any) =>
        p?.actor?.reference?.startsWith('Patient/') ? { ...p, status: 'declined' } : p,
      );
    }

    const saved = await this.appointmentRepository.save(appt);

    await this.auditService.log({
      appointmentId: saved.id,
      tenantId,
      actorId: actor.actorId,
      actorName: actor.actorName,
      isServiceAccount: actor.isServiceAccount,
      originChannel: saved.originChannel,
      action: 'CANCEL',
      payloadSnapshot: saved.payload,
    });

    // Disparar Webhook para notificar la cancelación a CliniChat
    this.webhookService.dispatch('CANCEL', saved, tenantId).catch(() => {});

    return saved.payload;
  }

  /** Búsqueda tenant-scoped (Zero Trust) que devuelve un Bundle FHIR searchset. */
  async search(
    query: { date?: string; dateFrom?: string; dateTo?: string; patient?: string; practitioner?: string; status?: string },
    tenantId: string,
  ): Promise<any> {
    const qb = this.appointmentRepository.createQueryBuilder('appt');
    qb.where('appt.tenant_id = :tenantId', { tenantId });

    if (query.date) {
      qb.andWhere('DATE(appt.start_date) = :date', { date: query.date });
    }
    if (query.dateFrom) {
      qb.andWhere('appt.start_date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('appt.start_date <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.patient) {
      qb.andWhere('(appt.patient_id = :patient OR appt.patient_dni = :patient)', { patient: query.patient });
    }
    if (query.practitioner) {
      qb.andWhere('(appt.practitioner_ref = :pr OR LOWER(appt.practitioner_name) LIKE LOWER(:prLike))', {
        pr: query.practitioner,
        prLike: `%${query.practitioner}%`,
      });
    }
    if (query.status) {
      qb.andWhere('appt.status = :status', { status: query.status });
    }

    qb.orderBy('appt.start_date', 'ASC');
    const appts = await qb.getMany();

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: appts.length,
      entry: appts.map((a) => ({
        fullUrl: `http://localhost:3000/fhir/r4/Appointment/${a.id}`,
        resource: a.payload,
      })),
    };
  }

  // --- Auxiliar: arma el recurso FHIR R4 Appointment ---
  private buildFhir(entity: AppointmentEntity, patientDisplay: string | undefined, comment?: string): any {
    const participant: any[] = [];
    if (entity.patientId) {
      participant.push({
        actor: { reference: `Patient/${entity.patientId}`, display: patientDisplay },
        status: 'accepted',
        required: 'required',
      });
    }
    if (entity.practitionerName || entity.practitionerRef) {
      participant.push({
        actor: {
          reference: entity.practitionerRef || undefined,
          display: entity.practitionerName || undefined,
        },
        status: 'accepted',
        required: 'required',
      });
    }

    return {
      resourceType: 'Appointment',
      status: entity.status,
      serviceType: entity.serviceType ? [{ text: entity.serviceType }] : undefined,
      start: entity.startDate.toISOString(),
      end: entity.endDate ? entity.endDate.toISOString() : undefined,
      created: new Date().toISOString(),
      comment: comment || undefined,
      participant,
      extension: [{ url: ORIGIN_CHANNEL_EXT, valueCode: entity.originChannel }],
    };
  }
}
