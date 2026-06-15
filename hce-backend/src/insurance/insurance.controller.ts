import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InsuranceService } from './insurance.service';

@Controller('insurance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  // ── Catálogo de Obras Sociales (lectura pública para el formulario) ───────

  /**
   * GET /insurance
   * Devuelve el listado completo de obras sociales activas ordenadas por nombre.
   * Usado por el dropdown del formulario de pacientes.
   */
  @Get()
  @Roles('medico', 'recepcionista', 'administrador')
  async findAll() {
    return this.insuranceService.findAllCompanies();
  }

  /**
   * GET /insurance/:id
   * Devuelve el detalle de una obra social específica.
   */
  @Get(':id')
  @Roles('medico', 'recepcionista', 'administrador')
  async findOne(@Param('id') id: string) {
    return this.insuranceService.findOneCompany(id);
  }

  // ── Coberturas por Paciente ──────────────────────────────────────────────

  /**
   * GET /insurance/patient/:patientId/coverage
   * Lista todas las coberturas de un paciente (múltiples OS posibles).
   */
  @Get('patient/:patientId/coverage')
  @Roles('medico', 'recepcionista', 'administrador')
  async getCoverages(@Param('patientId') patientId: string, @Request() req: any) {
    return this.insuranceService.getCoveragesByPatient(patientId, req.user.tenantId);
  }

  /**
   * POST /insurance/patient/:patientId/coverage
   * Crea una nueva cobertura para el paciente.
   * Si `principal = true` (o no se envía), se marcará como cobertura principal.
   */
  @Post('patient/:patientId/coverage')
  @Roles('medico', 'recepcionista', 'administrador')
  async createCoverage(
    @Param('patientId') patientId: string,
    @Body() body: {
      insuranceCompanyId: string;
      nroAfiliado: string;
      plan?: string;
      esTitular?: boolean;
      nombreTitular?: string;
      principal?: boolean;
    },
    @Request() req: any,
  ) {
    return this.insuranceService.createCoverage(patientId, req.user.tenantId, body);
  }

  /**
   * PUT /insurance/patient/:patientId/coverage/:covId
   * Actualiza una cobertura existente del paciente.
   */
  @Put('patient/:patientId/coverage/:covId')
  @Roles('medico', 'recepcionista', 'administrador')
  async updateCoverage(
    @Param('patientId') patientId: string,
    @Param('covId') covId: string,
    @Body() body: {
      insuranceCompanyId?: string;
      nroAfiliado?: string;
      plan?: string;
      esTitular?: boolean;
      nombreTitular?: string;
      principal?: boolean;
      activa?: boolean;
    },
    @Request() req: any,
  ) {
    return this.insuranceService.updateCoverage(covId, patientId, req.user.tenantId, body);
  }

  /**
   * DELETE /insurance/patient/:patientId/coverage/:covId
   * Elimina (borra físicamente) una cobertura del paciente.
   */
  @Delete('patient/:patientId/coverage/:covId')
  @Roles('medico', 'recepcionista', 'administrador')
  async deleteCoverage(
    @Param('patientId') patientId: string,
    @Param('covId') covId: string,
    @Request() req: any,
  ) {
    return this.insuranceService.deleteCoverage(covId, patientId, req.user.tenantId);
  }
}
