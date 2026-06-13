import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PatientService } from './patient.service';
import { PatientAuditService } from './patient-audit.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('fhir/r4/Patient')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
    private readonly auditService: PatientAuditService,
  ) {}

  /** Extrae el contexto de usuario del token JWT para la auditoría */
  private getUserCtx(req: any) {
    return {
      userId: req.user?.userId || req.user?.sub || 'unknown',
      userName: req.user?.preferred_username || req.user?.name || req.user?.username || 'Desconocido',
    };
  }

  @Post()
  @Roles('medico', 'recepcionista', 'administrador')
  async create(@Body() fhirPatient: any, @Request() req: any) {
    return this.patientService.create(fhirPatient, req.user.tenantId, this.getUserCtx(req));
  }

  @Get()
  @Roles('medico', 'recepcionista', 'administrador')
  async search(
    @Request() req: any,
    @Query('identifier') identifier?: string,
    @Query('gender') gender?: string,
    @Query('name') name?: string,
    @Query('age') age?: string,
    @Query('admissionDate') admissionDate?: string,
  ) {
    let extractedDni = identifier;
    if (identifier && identifier.includes('|')) {
      extractedDni = identifier.split('|')[1];
    }

    return this.patientService.search({
      dni: extractedDni,
      gender,
      name,
      age,
      admissionDate,
    }, req.user.tenantId);
  }

  @Get(':id/audit')
  @Roles('medico', 'administrador')
  async getAudit(@Param('id') id: string, @Request() req: any) {
    return this.auditService.getHistory(id, req.user.tenantId);
  }

  @Get(':id')
  @Roles('medico', 'recepcionista', 'administrador', 'paciente')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.patientService.findOne(id, req.user.tenantId);
  }

  @Put(':id')
  @Roles('medico', 'recepcionista', 'administrador')
  async update(@Param('id') id: string, @Body() fhirPatient: any, @Request() req: any) {
    return this.patientService.update(id, fhirPatient, req.user.tenantId, this.getUserCtx(req));
  }
}
