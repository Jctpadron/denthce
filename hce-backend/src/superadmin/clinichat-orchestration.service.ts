import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { KeycloakAdminService } from '../tenant/keycloak-admin.service';

/**
 * ClinichatOrchestrationService — Fase 4B (lado HCE).
 *
 * Cuando el Super Admin anexa/da de baja el módulo WhatsApp de una clínica, el HCE:
 *  - genera el service-account de Keycloak (Fase 4A),
 *  - asegura el hce_webhook_secret de la clínica,
 *  - arma el payload y lo firma con HMAC-SHA256 (PLATFORM_SYNC_SECRET),
 *  - lo dispara al endpoint de CliniChat (configure-hce-integration).
 *
 * El secreto y la URL se leen SIEMPRE del entorno (nunca hardcodeados).
 */
@Injectable()
export class ClinichatOrchestrationService {
  private readonly logger = new Logger(ClinichatOrchestrationService.name);

  // Defaults de DESARROLLO local; en producción se setean por entorno.
  private get platformSecret(): string {
    return process.env.PLATFORM_SYNC_SECRET || 'test_secret_123';
  }
  private get configUrl(): string {
    return process.env.CLINICHAT_CONFIG_URL || 'http://localhost:3000/api/public/hooks/configure-hce-integration';
  }
  private get fhirBaseUrl(): string {
    return process.env.HCE_FHIR_BASE_URL || 'https://api.systia.ar/fhir/r4';
  }
  private get keycloakTokenUrl(): string {
    const issuer = process.env.KEYCLOAK_ISSUER_URL || 'https://auth.systia.ar/realms/hce-realm';
    return `${issuer}/protocol/openid-connect/token`;
  }

  constructor(
    @InjectRepository(TenantConfigEntity)
    private readonly tenantConfigRepo: Repository<TenantConfigEntity>,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  /** Asegura el hce_webhook_secret de la clínica (lo genera si no existe). */
  private async ensureWebhookSecret(tenantId: string): Promise<string> {
    const config = await this.tenantConfigRepo.findOne({ where: { tenantId } });
    if (!config) throw new BadRequestException(`Clínica "${tenantId}" sin configuración.`);
    if (config.hceWebhookSecret) return config.hceWebhookSecret;
    const secret = crypto.randomBytes(32).toString('hex');
    config.hceWebhookSecret = secret;
    await this.tenantConfigRepo.save(config);
    return secret;
  }

  /** Firma el body con HMAC-SHA256 y lo POSTea al endpoint de CliniChat. */
  private async dispatch(payload: any): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', this.platformSecret).update(body).digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(this.configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-HCE-Platform-Signature': `sha256=${signature}` },
        body,
        signal: controller.signal,
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        this.logger.error(`[orquestacion] CliniChat respondió ${res.status}: ${text}`);
        const msg =
          res.status === 401 ? 'Firma de plataforma rechazada por CliniChat.'
          : res.status === 404 ? 'Código de enlace (pairing code) no encontrado en CliniChat.'
          : `CliniChat rechazó la configuración (${res.status}).`;
        throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
      }
      this.logger.log(`[orquestacion] CliniChat configurado OK (${payload.action}) para ${payload.hce_tenant_id}.`);
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      if (e?.name === 'AbortError') throw new HttpException('Timeout al contactar a CliniChat.', HttpStatus.GATEWAY_TIMEOUT);
      this.logger.error(`[orquestacion] Error contactando a CliniChat: ${e?.message}`);
      throw new HttpException('No se pudo contactar a CliniChat.', HttpStatus.BAD_GATEWAY);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Anexa WhatsApp: genera service-account + webhook secret y configura CliniChat por pairing code.
   */
  async enableWhatsapp(tenantId: string, pairingCode: string): Promise<void> {
    if (!pairingCode) throw new BadRequestException('El código de enlace (pairing code) es obligatorio para anexar WhatsApp.');
    const sa = await this.keycloakAdmin.createClinicServiceAccount(tenantId);
    const webhookSecret = await this.ensureWebhookSecret(tenantId);
    await this.dispatch({
      action: 'enable',
      hce_tenant_id: tenantId,
      pairing_code: pairingCode,
      credentials: {
        hce_fhir_base_url: this.fhirBaseUrl,
        hce_keycloak_token_url: this.keycloakTokenUrl,
        hce_keycloak_client_id: sa.clientId,
        hce_keycloak_grant_type: 'client_credentials',
        hce_keycloak_client_secret: sa.clientSecret,
        hce_webhook_secret: webhookSecret,
      },
    });
  }

  /** Da de baja WhatsApp: apaga la integración del lado CliniChat. */
  async disableWhatsapp(tenantId: string): Promise<void> {
    await this.dispatch({ action: 'disable', hce_tenant_id: tenantId });
  }
}
