import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MedicationRequestService } from './medication-request.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Endpoint agregado (no anidado a un paciente) para el Dashboard.
 * Tarea 3.12 — widget "Recetas pendientes de firma".
 */
@Controller('fhir/r4/MedicationRequest')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MedicationRequestSummaryController {
  constructor(private readonly medicationRequestService: MedicationRequestService) {}

  /**
   * GET /fhir/r4/MedicationRequest?status=draft
   * Lista las recetas en borrador del consultorio del profesional (aislado por tenant).
   * Solo el médico firma recetas, por eso es el único rol con acceso.
   */
  @Get()
  @Roles('medico')
  async findPending(@Query('status') status: string, @Request() req: any) {
    if (status === 'draft') {
      return this.medicationRequestService.findPendingDrafts(req.user.tenantId);
    }
    return [];
  }
}
