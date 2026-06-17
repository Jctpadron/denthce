import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OdontologyEncounterService } from './odontology-encounter.service';

/**
 * Ciclo de vida de la VISITA / ENCUENTRO odontológico.
 * Anidado bajo el módulo aislado: /odontology/patient/:patientId/encounter.
 * Zero Trust: todo filtrado por req.user.tenantId.
 */
@Controller('odontology/patient/:patientId/encounter')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OdontologyEncounterController {
  constructor(private readonly service: OdontologyEncounterService) {}

  private getUserCtx(req: any) {
    return {
      userId: req.user?.sub || req.user?.userId || 'unknown',
      userName: req.user?.preferred_username || req.user?.name || 'Profesional',
    };
  }

  /** Abrir visita (idempotente: devuelve la activa si ya existe). */
  @Post()
  @Roles('medico', 'enfermero', 'administrador')
  async open(
    @Param('patientId') patientId: string,
    @Body() body: { appointmentId?: string | null; classCode?: string; reasonText?: string },
    @Request() req: any,
  ) {
    return this.service.open(patientId, body || {}, req.user.tenantId, this.getUserCtx(req));
  }

  /** Visita activa del paciente (o { active: null }). */
  @Get('active')
  @Roles('medico', 'enfermero', 'administrador')
  async active(@Param('patientId') patientId: string, @Request() req: any) {
    const active = await this.service.getActive(patientId, req.user.tenantId);
    return { active };
  }

  /** Listar visitas del paciente (+ conteo de registros legacy sin visita). */
  @Get()
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async list(@Param('patientId') patientId: string, @Request() req: any) {
    return this.service.list(patientId, req.user.tenantId);
  }

  /** Obtener una visita con sus prestaciones + addenda. */
  @Get(':id')
  @Roles('medico', 'administrador')
  async getOne(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.getOne(id, patientId, req.user.tenantId);
  }

  /** Finalizar + firmar la visita (inmutable). Marca el turno asociado fulfilled. */
  @Post(':id/sign')
  @Roles('medico', 'administrador')
  async sign(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.sign(id, patientId, req.user.tenantId, this.getUserCtx(req));
  }

  /** Cancelar una visita en curso (las prestaciones se desvinculan a legacy). */
  @Post(':id/cancel')
  @Roles('medico', 'administrador')
  async cancel(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.cancel(id, patientId, req.user.tenantId, this.getUserCtx(req));
  }

  /** Historial de auditoría de la visita (apertura/firma/cancelación/addenda). */
  @Get(':id/audit')
  @Roles('medico', 'administrador')
  async audit(
    @Param('patientId') _patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.getAuditHistory(id, req.user.tenantId);
  }

  /** Addenda (corrección post-firma, append-only). */
  @Post(':id/addenda')
  @Roles('medico', 'administrador')
  async addAddenda(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() body: { text: string },
    @Request() req: any,
  ) {
    return this.service.addAddenda(id, patientId, body?.text, req.user.tenantId, this.getUserCtx(req));
  }
}
