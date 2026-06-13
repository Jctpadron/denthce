import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OdontologyService } from './odontology.service';
import { OdontologyPdfService } from './odontology-pdf.service';

/**
 * API de la HISTORIA CLÍNICA ODONTOLÓGICA (módulo aislado).
 * Prefijo propio `/odontology`, separado del `/fhir/r4/Patient` de la HC original.
 * Aislamiento multi-inquilino Zero Trust: todo se filtra por req.user.tenantId.
 */
@Controller('odontology')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OdontologyController {
  constructor(
    private readonly odontologyService: OdontologyService,
    private readonly odontologyPdfService: OdontologyPdfService,
  ) {}

  @Post('patient/:patientId/resource')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async createResource(
    @Param('patientId') patientId: string,
    @Body() body: { resourceType: string; payload: any },
    @Request() req: any,
  ) {
    return this.odontologyService.saveResource(
      patientId,
      body.resourceType,
      body.payload,
      req.user.tenantId,
    );
  }

  @Get('patient/:patientId/resource')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async getResources(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    return this.odontologyService.getResourcesByPatient(patientId, req.user.tenantId);
  }

  @Get('patient/:patientId/report/pdf')
  @Roles('medico', 'enfermero', 'administrador')
  async getPdfReport(
    @Param('patientId') patientId: string,
    @Request() req: any,
    @Res() res: any,
  ) {
    try {
      const patient = await this.odontologyService.getPatient(patientId, req.user.tenantId);
      const resources = await this.odontologyService.getResourcesByPatient(patientId, req.user.tenantId);
      const buffer = await this.odontologyPdfService.generatePdf(patient, resources);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="hc_odontologica_${patient.dni}.pdf"`,
        'Content-Length': buffer.length,
      });
      
      res.end(buffer);
    } catch (err) {
      console.error('Error generando PDF de Odontología:', err);
      res.status(500).json({
        statusCode: 500,
        message: 'Error interno al generar el reporte PDF.',
        error: err.message,
      });
    }
  }

  @Patch('resource/:id/complete')
  @Roles('medico', 'enfermero', 'administrador')
  async completeResource(@Param('id') id: string, @Request() req: any) {
    return this.odontologyService.completeResource(id, req.user.tenantId);
  }

  @Delete('resource/:id')
  @Roles('medico', 'enfermero', 'administrador')
  async deleteResource(@Param('id') id: string, @Request() req: any) {
    return this.odontologyService.deleteResource(id, req.user.tenantId);
  }
}
