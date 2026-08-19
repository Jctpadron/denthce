import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { Server } from 'http';
import { Readable } from 'stream';
import { TenantConfigController } from './tenant-config.controller';
import { TenantConfigService } from './tenant-config.service';
import { TenantSignatureService } from './tenant-signature.service';
import { ModulesService } from '../platform/modules.service';
import { RolesGuard } from '../auth/roles.guard';

/**
 * Verificación de comportamiento HTTP del endpoint de firma (AUD.8).
 *
 * Lo que importa probar acá no es el happy path sino la propiedad de seguridad:
 * la firma del profesional YA NO se sirve por una ruta pública, sino por un endpoint
 * que exige token y que resuelve el tenant desde el JWT.
 */
describe('TenantConfigController — firma del profesional (AUD.8)', () => {
  let app: INestApplication;
  const signatureService = {
    save: jest.fn<Promise<{ signatureUrl: string }>, [string, unknown]>(),
    getStream: jest.fn().mockResolvedValue({
      stream: Readable.from([Buffer.from('PNG-BYTES')]),
      mimeType: 'image/png',
    }),
  };

  signatureService.save.mockResolvedValue({
    signatureUrl: '/api/tenant/signature',
  });

  /** Simula un usuario autenticado de la clínica A. */
  const jwtGuardOk = {
    canActivate: (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
      req.user = {
        tenantId: 'clinica-a',
        roles: ['medico'],
        sub: 'u-1',
        preferred_username: 'dr.julio',
      };
      return true;
    },
  };

  async function build(jwtGuard: {
    canActivate: (ctx: ExecutionContext) => boolean;
  }) {
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [TenantConfigController],
      providers: [
        { provide: TenantConfigService, useValue: { getConfig: jest.fn() } },
        { provide: ModulesService, useValue: { listForTenant: jest.fn() } },
        { provide: TenantSignatureService, useValue: signatureService },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(jwtGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const a = mod.createNestApplication();
    await a.init();
    return a;
  }

  afterEach(async () => {
    if (app) await app.close();
    jest.clearAllMocks();
  });

  it('RECHAZA la descarga sin autenticación (era pública por express.static)', async () => {
    app = await build({ canActivate: () => false });

    await request(app.getHttpServer() as Server)
      .get('/api/tenant/signature')
      .expect(403);

    expect(signatureService.getStream).not.toHaveBeenCalled();
  });

  it('con token, devuelve la imagen del tenant del JWT y con headers de no-cacheo', async () => {
    app = await build(jwtGuardOk);

    const res = await request(app.getHttpServer() as Server)
      .get('/api/tenant/signature')
      .expect(200);

    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
    // El tenant sale del token, no de la request.
    expect(signatureService.getStream).toHaveBeenCalledWith('clinica-a');
  });

  it('la subida también resuelve el tenant desde el JWT', async () => {
    app = await build(jwtGuardOk);

    await request(app.getHttpServer() as Server)
      .post('/api/tenant/signature')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'firma.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(signatureService.save).toHaveBeenCalledTimes(1);
    expect(signatureService.save.mock.calls[0][0]).toBe('clinica-a');
  });

  it('el endpoint declara roles: no queda al alcance de cualquier rol autenticado', () => {
    const reflector = new Reflector();
    // Se lee del descriptor para no referenciar el método desbindeado del prototipo.
    const handler = Object.getOwnPropertyDescriptor(
      TenantConfigController.prototype,
      'getSignature',
    )?.value as (...args: unknown[]) => unknown;
    const roles = reflector.get<string[]>('roles', handler);

    expect(roles).toBeDefined();
    expect(roles).toEqual(expect.arrayContaining(['administrador', 'medico']));
    // `paciente` y `laboratorio-operador` NO deben poder leer la firma del profesional.
    expect(roles).not.toContain('paciente');
    expect(roles).not.toContain('laboratorio-operador');
  });
});
