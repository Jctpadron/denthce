import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { PatientEntity } from '../patient/patient.entity';
import { AppointmentEntity } from '../appointment/appointment.entity';
import * as crypto from 'crypto';

/**
 * Genera un UUID determinista v4 a partir de un string (idéntico al de SlotService)
 */
function deterministicUUID(input: string): string {
  const hash = crypto.createHash('md5').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Convierte un objeto Date a formato ISO 8601 forzando el offset de Argentina (-03:00)
 */
function formatLocalDateISO(date: Date): string {
  const offsetMs = -3 * 60 * 60 * 1000;
  const localTime = new Date(date.getTime() + offsetMs);
  const iso = localTime.toISOString();
  return iso.substring(0, 19) + '-03:00';
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(TenantConfigEntity)
    private readonly tenantConfigRepository: Repository<TenantConfigEntity>,
    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,
  ) {}

  /**
   * Despacha un webhook firmado hacia CliniChat notificando un cambio en un turno.
   */
  async dispatch(action: 'CREATE' | 'CANCEL' | 'REMINDER', appt: AppointmentEntity, tenantId: string): Promise<void> {
    try {
      // 1. Obtener configuración del tenant
      const config = await this.tenantConfigRepository.findOne({ where: { tenantId } });
      const secret = config?.hceWebhookSecret;

      if (!secret) {
        this.logger.warn(
          `[Webhook] No se despachó el webhook de cita para el tenant "${tenantId}". Motivo: hce_webhook_secret no configurado.`,
        );
        return;
      }

      // 2. Resolver URLs y variables de entorno (por defecto la de producción provista)
      const webhookUrl =
        process.env.CLINICHAT_WEBHOOK_URL ||
        'https://hooks.systia.ar/api/public/hooks/sync-appointment';

      // 3. Extraer Practitioner ID del PractitionerRef (ej: "Practitioner/uuid" -> "uuid")
      let practitionerId = appt.practitionerRef || '';
      if (practitionerId.includes('/')) {
        practitionerId = practitionerId.split('/')[1];
      }
      if (!practitionerId) {
        practitionerId = deterministicUUID(tenantId + '-practitioner');
      }

      // 4. Calcular Specialty ID determinista de la clínica
      const specialtyId = deterministicUUID(tenantId + '-specialty');

      // 5. Resolver datos del paciente para cumplir el contrato §5.3
      let patientGender = 'unknown';
      let patientName = 'Paciente Desconocido';

      if (appt.patientId) {
        const patient = await this.patientRepository.findOne({ where: { id: appt.patientId } });
        if (patient) {
          patientGender = patient.gender || 'unknown';
          patientName = `${patient.givenName} ${patient.familyName}`.trim();
        }
      }

      // Mapear la acción al string de evento esperado ('created', 'cancelled')
      const eventMapping: Record<string, string> = {
        CREATE: 'created',
        CANCEL: 'cancelled',
        REMINDER: 'reminder',
      };
      const eventStr = eventMapping[action] || 'updated';

      // 6. Estructurar el payload exacto del webhook acordado
      const payload = {
        event: eventStr,
        hce_tenant_id: tenantId,
        hce_appointment_id: appt.id,
        patient_dni: appt.patientDni || '',
        patient_gender: patientGender,
        patient_name: patientName,
        appointment_date: formatLocalDateISO(appt.startDate),
        hce_practitioner_id: practitionerId,
        hce_specialty_id: specialtyId,
        status: appt.status,
      };

      const bodyStr = JSON.stringify(payload);

      // 7. Calcular la firma HMAC-SHA256
      const signature = crypto
        .createHmac('sha256', secret)
        .update(bodyStr)
        .digest('hex');

      this.logger.log(`[Webhook] Despachando evento "${eventStr}" para cita "${appt.id}" a la URL: ${webhookUrl}`);

      // 8. Enviar la llamada POST usando fetch nativo de Node.js (con timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CliniChat-Signature': `sha256=${signature}`,
        },
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(
          `[Webhook] Error al enviar webhook a CliniChat. Status: ${response.status}. Detalle: ${errorText}`,
        );
      } else {
        this.logger.log(`[Webhook] Webhook de cita "${appt.id}" enviado con éxito a CliniChat.`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error(`[Webhook] Timeout al enviar webhook de cita para el tenant "${tenantId}".`);
      } else {
        this.logger.error(
          `[Webhook] Error inesperado al despachar webhook de cita para el tenant "${tenantId}": ${error.message}`,
        );
      }
    }
  }
}
