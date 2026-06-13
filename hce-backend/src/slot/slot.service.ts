import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import * as crypto from 'crypto';

/**
 * Genera un UUID determinista v4 a partir de un string
 */
function deterministicUUID(input: string): string {
  const hash = crypto.createHash('md5').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Convierte un objeto Date a formato ISO 8601 forzando el offset de Argentina (-03:00)
 */
function formatLocalDateISO(date: Date): string {
  // Argentina está en UTC-3
  const offsetMs = -3 * 60 * 60 * 1000;
  const localTime = new Date(date.getTime() + offsetMs);
  const iso = localTime.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return iso.substring(0, 19) + '-03:00';
}

const DIAS_MAP: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
};

@Injectable()
export class SlotService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private appointmentRepository: Repository<AppointmentEntity>,
    @InjectRepository(TenantConfigEntity)
    private tenantConfigRepository: Repository<TenantConfigEntity>,
  ) {}

  /**
   * Genera y retorna slots libres de 30 minutos para un tenant/clínica
   * en la ventana temporal seleccionada, deduciendo los turnos ya agendados.
   */
  async findAvailableSlots(
    specialtyId: string,
    startDateStr: string,
    endDateStr: string,
    tenantId: string,
  ): Promise<any> {
    const config = await this.tenantConfigRepository.findOne({ where: { tenantId } });
    const schedule = config?.scheduleJson || {
      lunes: '09:00-18:00',
      martes: '09:00-18:00',
      miercoles: '09:00-18:00',
      jueves: '09:00-18:00',
      viernes: '09:00-18:00',
      sabado: '',
      domingo: '',
    };

    const startQuery = new Date(startDateStr);
    const endQuery = new Date(endDateStr);

    // Buscar todas las citas reservadas (activas) en esta ventana temporal
    const activeAppointments = await this.appointmentRepository.find({
      where: {
        tenantId,
        status: Not('cancelled'),
        startDate: Between(startQuery, endQuery),
      },
    });

    const slots: any[] = [];
    const stepMinutes = 30;

    // Recorrer día por día en el rango de búsqueda
    const currentDay = new Date(startQuery);
    while (currentDay <= endQuery) {
      const dayOfWeekNum = currentDay.getDay();
      const dayName = DIAS_MAP[dayOfWeekNum];
      const timeRange = schedule[dayName];

      if (timeRange && timeRange.includes('-')) {
        const [startStr, endStr] = timeRange.split('-');
        const [startHour, startMin] = startStr.split(':').map(Number);
        const [endHour, endMin] = endStr.split(':').map(Number);

        // Crear límites de atención para ese día en UTC (teniendo en cuenta la zona -03:00 de Argentina)
        // Configuramos la fecha en base al huso horario local de Argentina
        const dayStartLocal = new Date(currentDay);
        dayStartLocal.setUTCHours(startHour + 3, startMin, 0, 0); // +3 para compensar el UTC-3

        const dayEndLocal = new Date(currentDay);
        dayEndLocal.setUTCHours(endHour + 3, endMin, 0, 0);

        let slotStart = new Date(dayStartLocal);
        while (slotStart < dayEndLocal) {
          const slotEnd = new Date(slotStart.getTime() + stepMinutes * 60000);

          // Verificar si este bloque horario choca con alguna cita activa
          const isOccupied = activeAppointments.some((appt) => {
            const apptStart = new Date(appt.startDate);
            const apptEnd = appt.endDate ? new Date(appt.endDate) : new Date(apptStart.getTime() + 30 * 60000);
            // Si hay solapamiento de intervalos
            return slotStart < apptEnd && slotEnd > apptStart;
          });

          if (!isOccupied && slotStart >= startQuery && slotStart < endQuery) {
            const startIso = formatLocalDateISO(slotStart);
            const endIso = formatLocalDateISO(slotEnd);
            const id = deterministicUUID(`${tenantId}-slot-${startIso}`);

            slots.push({
              resourceType: 'Slot',
              id,
              status: 'free',
              start: startIso,
              end: endIso,
              schedule: {
                reference: `Schedule/${deterministicUUID(tenantId + '-schedule')}`,
              },
            });
          }

          slotStart = slotEnd;
        }
      }

      // Avanzar al siguiente día
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: slots.length,
      entry: slots.map((s) => ({
        fullUrl: `http://localhost:3000/fhir/r4/Slot/${s.id}`,
        resource: s,
      })),
    };
  }

  /**
   * Endpoint de Discovery: Devolvemos el único profesional de la clínica
   */
  async findPractitioner(tenantId: string): Promise<any> {
    const config = await this.tenantConfigRepository.findOne({ where: { tenantId } });
    const doctorName = config?.doctorName || 'Médico Principal';
    const parts = doctorName.trim().split(/\s+/);
    const family = parts[parts.length - 1] || 'Consultorio';
    const given = parts.slice(0, parts.length - 1);

    const practitionerId = deterministicUUID(tenantId + '-practitioner');

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [
        {
          fullUrl: `http://localhost:3000/fhir/r4/Practitioner/${practitionerId}`,
          resource: {
            resourceType: 'Practitioner',
            id: practitionerId,
            active: true,
            name: [
              {
                text: doctorName,
                family: family,
                given: given.length > 0 ? given : ['Médico'],
              },
            ],
            identifier: [
              {
                system: 'http://hospital.gov/matricula',
                value: config?.doctorLicense || '0000',
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Endpoint de Discovery: Devolvemos la especialidad de la clínica
   */
  async findHealthcareService(tenantId: string): Promise<any> {
    const config = await this.tenantConfigRepository.findOne({ where: { tenantId } });
    const specialtyName = config?.specialty || 'Odontología General';
    const specialtyId = deterministicUUID(tenantId + '-specialty');

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [
        {
          fullUrl: `http://localhost:3000/fhir/r4/HealthcareService/${specialtyId}`,
          resource: {
            resourceType: 'HealthcareService',
            id: specialtyId,
            active: true,
            name: specialtyName,
            specialty: [
              {
                coding: [
                  {
                    system: 'http://hospital.gov/specialty',
                    code: specialtyName.toLowerCase().replace(/\s+/g, '-'),
                    display: specialtyName,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }
}
