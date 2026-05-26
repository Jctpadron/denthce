import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClinicalResourceService } from './clinical-resource.service';

@Controller('fhir/r4/Patient')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClinicalResourceController {
  constructor(private readonly resourceService: ClinicalResourceService) {}

  @Post(':patientId/clinical-resource')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async createResource(
    @Param('patientId') patientId: string,
    @Body() body: { resourceType: string; payload: any },
    @Request() req: any,
  ) {
    return this.resourceService.saveResource(
      patientId,
      body.resourceType,
      body.payload,
      req.user.tenantId,
    );
  }

  @Get(':patientId/clinical-resource')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador', 'paciente')
  async getResources(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    return this.resourceService.getResourcesByPatient(patientId, req.user.tenantId);
  }

  @Delete('clinical-resource/:id')
  @Roles('medico', 'enfermero', 'administrador')
  async deleteResource(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.resourceService.deleteResource(id, req.user.tenantId);
  }
}
