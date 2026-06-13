import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ClinichatOrchestrationService } from './clinichat-orchestration.service';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';
import { KeycloakAdminService } from '../tenant/keycloak-admin.service';

describe('ClinichatOrchestrationService (Fase 4B)', () => {
  let service: ClinichatOrchestrationService;
  const tenantConfigRepo = { findOne: jest.fn(), save: jest.fn() };
  const keycloakAdmin = { createClinicServiceAccount: jest.fn() };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ClinichatOrchestrationService,
        { provide: getRepositoryToken(TenantConfigEntity), useValue: tenantConfigRepo },
        { provide: KeycloakAdminService, useValue: keycloakAdmin },
      ],
    }).compile();
    service = mod.get<ClinichatOrchestrationService>(ClinichatOrchestrationService);
    jest.clearAllMocks();
    process.env.PLATFORM_SYNC_SECRET = 'test_secret_123';
    process.env.CLINICHAT_CONFIG_URL = 'http://localhost:3000/api/public/hooks/configure-hce-integration';
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('enableWhatsapp: genera SA, firma HMAC correcta y POSTea el payload enable', async () => {
    keycloakAdmin.createClinicServiceAccount.mockResolvedValue({ clientId: 'clinichat-t1', clientSecret: 'sec', tenantId: 't1' });
    tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1', hceWebhookSecret: 'wh-secret' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{"synced":true}' });

    await service.enableWhatsapp('t1', 'PAIR-123');

    expect(keycloakAdmin.createClinicServiceAccount).toHaveBeenCalledWith('t1');
    const [, opts] = fetchMock.mock.calls[0];
    const body = opts.body as string;
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({ action: 'enable', hce_tenant_id: 't1', pairing_code: 'PAIR-123' });
    expect(payload.credentials.hce_keycloak_client_id).toBe('clinichat-t1');
    expect(payload.credentials.hce_keycloak_grant_type).toBe('client_credentials');
    // La firma del header debe coincidir con el HMAC del body crudo.
    const expected = 'sha256=' + crypto.createHmac('sha256', 'test_secret_123').update(body).digest('hex');
    expect(opts.headers['X-HCE-Platform-Signature']).toBe(expected);
  });

  it('enableWhatsapp: genera un webhook secret si la clínica no tenía', async () => {
    keycloakAdmin.createClinicServiceAccount.mockResolvedValue({ clientId: 'c', clientSecret: 's', tenantId: 't1' });
    tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1', hceWebhookSecret: null });
    tenantConfigRepo.save.mockImplementation(async (x) => x);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

    await service.enableWhatsapp('t1', 'PAIR');
    expect(tenantConfigRepo.save).toHaveBeenCalled(); // se persistió el nuevo secret
  });

  it('rechaza enable sin pairing code', async () => {
    await expect(service.enableWhatsapp('t1', '')).rejects.toThrow(BadRequestException);
  });

  it('propaga error si CliniChat responde 404 (pairing no encontrado)', async () => {
    keycloakAdmin.createClinicServiceAccount.mockResolvedValue({ clientId: 'c', clientSecret: 's', tenantId: 't1' });
    tenantConfigRepo.findOne.mockResolvedValue({ tenantId: 't1', hceWebhookSecret: 'w' });
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
    await expect(service.enableWhatsapp('t1', 'BAD')).rejects.toThrow(HttpException);
  });

  it('disableWhatsapp: POSTea el payload disable firmado', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    await service.disableWhatsapp('t1');
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ action: 'disable', hce_tenant_id: 't1' });
  });
});
