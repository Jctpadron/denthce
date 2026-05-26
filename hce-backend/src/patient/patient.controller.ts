import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PatientService } from './patient.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('fhir/r4/Patient')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @Roles('medico', 'recepcionista', 'administrador')
  async create(@Body() fhirPatient: any, @Request() req: any) {
    return this.patientService.create(fhirPatient, req.user.tenantId);
  }

  @Get()
  @Roles('medico', 'recepcionista', 'administrador')
  async search(
    @Request() req: any,
    @Query('identifier') identifier?: string,
    @Query('name') name?: string,
    @Query('birthdate') birthdate?: string,
  ) {
    return this.patientService.search({
      dni: identifier,
      name,
      birthDate: birthdate,
    }, req.user.tenantId);
  }

  @Get(':id')
  @Roles('medico', 'recepcionista', 'administrador', 'paciente')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.patientService.findOne(id, req.user.tenantId);
  }
}
