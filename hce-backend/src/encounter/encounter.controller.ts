import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EncounterService } from './encounter.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * EncounterController — Tarea 3.1
 * Expone los endpoints FHIR para gestión de consultas clínicas (Encounter).
 * Todas las rutas están anidadas bajo /fhir/r4/Patient/:patientId/encounter
 * para seguir el modelo de recurso referenciado de FHIR R4.
 */
@Controller('fhir/r4/Patient/:patientId/encounter')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EncounterController {
  constructor(private readonly encounterService: EncounterService) {}

  private getUserCtx(req: any) {
    return {
      userId: req.user?.sub || req.user?.userId || 'unknown',
      userName: req.user?.preferred_username || req.user?.name || 'Profesional',
    };
  }

  /** POST /fhir/r4/Patient/:patientId/encounter — Crear nueva consulta */
  @Post()
  @Roles('medico')
  async create(
    @Param('patientId') patientId: string,
    @Body() fhirEncounter: any,
    @Request() req: any,
  ) {
    return this.encounterService.create(patientId, fhirEncounter, req.user.tenantId, this.getUserCtx(req));
  }

  /** GET /fhir/r4/Patient/:patientId/encounter — Listar todas las consultas del paciente */
  @Get()
  @Roles('medico', 'recepcionista', 'administrador')
  async findAll(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    return this.encounterService.findAll(patientId, req.user.tenantId);
  }

  /** GET /fhir/r4/Patient/:patientId/encounter/:id — Obtener una consulta específica */
  @Get(':id')
  @Roles('medico', 'administrador')
  async findOne(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.encounterService.findOne(id, req.user.tenantId);
  }

  /** PUT /fhir/r4/Patient/:patientId/encounter/:id — Actualizar borrador */
  @Put(':id')
  @Roles('medico')
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() fhirEncounter: any,
    @Request() req: any,
  ) {
    return this.encounterService.update(id, fhirEncounter, req.user.tenantId);
  }

  /** POST /fhir/r4/Patient/:patientId/encounter/:id/sign — Firmar y cerrar la nota */
  @Post(':id/sign')
  @Roles('medico')
  async sign(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.encounterService.sign(id, req.user.tenantId, this.getUserCtx(req));
  }
}
