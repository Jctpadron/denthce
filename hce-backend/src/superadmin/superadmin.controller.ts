import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { SuperAdminService } from './superadmin.service';

/**
 * API de plataforma del Super Admin. CROSS-TENANT: no se filtra por el tenant del JWT.
 * Doble guard: JWT válido + rol 'superadmin'.
 */
@Controller('api/superadmin')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  /** Métricas globales (tarjetas del panel de resumen). */
  @Get('metrics')
  async metrics() {
    return this.superAdminService.metrics();
  }

  /** Catálogo de módulos contratables. */
  @Get('modules')
  async modules() {
    return this.superAdminService.catalog();
  }

  /** Lista todas las clínicas con plan, estado y módulos activos. */
  @Get('clinics')
  async listClinics() {
    return this.superAdminService.listClinics();
  }

  /** Provisiona una clínica nueva (tenant_config + módulos base + admin Keycloak). */
  @Post('clinics')
  async createClinic(@Body() body: any) {
    return this.superAdminService.createClinic({
      tenantId: body?.tenantId,
      name: body?.name,
      plan: body?.plan,
      adminUsername: body?.adminUsername,
      adminEmail: body?.adminEmail,
      adminFirstName: body?.adminFirstName,
      adminLastName: body?.adminLastName,
    });
  }

  /** Anexa o da de baja un módulo de una clínica. */
  @Patch('clinics/:tenantId/modules')
  async setModule(@Param('tenantId') tenantId: string, @Body() body: any) {
    return this.superAdminService.setModule(
      tenantId,
      body?.moduleKey,
      body?.enabled === true || body?.enabled === 'true',
      body?.expiresAt ?? null,
    );
  }
}
