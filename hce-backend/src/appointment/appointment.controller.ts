import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, Headers, ConflictException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentService } from './appointment.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('fhir/r4/Appointment')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /** Extrae el contexto de usuario del token JWT para la auditoría */
  private getUserCtx(req: any) {
    const isServiceAccount = req.user?.roles?.includes('servicio-turnos') || req.user?.isServiceAccount || false;
    return {
      actorId: req.user?.userId || req.user?.sub || 'unknown',
      actorName: req.user?.preferred_username || req.user?.name || req.user?.username || (isServiceAccount ? 'Servicio Turnos' : 'Desconocido'),
      isServiceAccount,
    };
  }

  @Post()
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async create(
    @Body() fhirAppointment: any,
    @Request() req: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    // Si viene en el body, inyectarlo en el DTO para el servicio
    const dto = {
      ...fhirAppointment,
      idempotencyKey: idempotencyKey || fhirAppointment.idempotencyKey,
    };
    return this.appointmentService.create(dto, req.user.tenantId, this.getUserCtx(req));
  }

  @Get()
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async search(
    @Request() req: any,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('patient') patient?: string,
    @Query('practitioner') practitioner?: string,
    @Query('status') status?: string,
  ) {
    return this.appointmentService.search(
      { date, dateFrom, dateTo, patient, practitioner, status },
      req.user.tenantId,
    );
  }

  @Get(':id')
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.appointmentService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async cancel(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const reason = body?.cancellationReason?.text || body?.comment || undefined;
    return this.appointmentService.cancel(id, reason, req.user.tenantId, this.getUserCtx(req));
  }
}
