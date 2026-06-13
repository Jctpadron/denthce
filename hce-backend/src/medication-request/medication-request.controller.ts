import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MedicationRequestService } from './medication-request.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('fhir/r4/Patient/:patientId/MedicationRequest')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MedicationRequestController {
  constructor(private readonly medicationRequestService: MedicationRequestService) {}

  private getUserCtx(req: any) {
    return {
      userId: req.user?.sub || req.user?.userId || 'unknown',
      userName: req.user?.preferred_username || req.user?.name || 'Profesional',
    };
  }

  /** GET /fhir/r4/Patient/:patientId/MedicationRequest/vademecum — Buscar en Vademecum */
  @Get('vademecum')
  @Roles('medico')
  async searchVademecum(@Query('query') query: string) {
    return this.medicationRequestService.searchVademecum(query);
  }

  /** POST /fhir/r4/Patient/:patientId/MedicationRequest — Crear nueva receta (borrador) */
  @Post()
  @Roles('medico')
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.medicationRequestService.create(patientId, dto, req.user.tenantId);
  }

  /** GET /fhir/r4/Patient/:patientId/MedicationRequest — Listar recetas del paciente */
  @Get()
  @Roles('medico', 'recepcionista', 'administrador')
  async findAll(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    return this.medicationRequestService.findAll(patientId, req.user.tenantId);
  }

  /** GET /fhir/r4/Patient/:patientId/MedicationRequest/:id — Obtener receta específica */
  @Get(':id')
  @Roles('medico', 'administrador')
  async findOne(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.medicationRequestService.findOne(id, req.user.tenantId);
  }

  /** PUT /fhir/r4/Patient/:patientId/MedicationRequest/:id — Actualizar borrador */
  @Put(':id')
  @Roles('medico')
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.medicationRequestService.update(id, dto, req.user.tenantId);
  }

  /** POST /fhir/r4/Patient/:patientId/MedicationRequest/:id/sign — Firmar la receta */
  @Post(':id/sign')
  @Roles('medico')
  async sign(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.medicationRequestService.sign(id, req.user.tenantId, this.getUserCtx(req));
  }
}
