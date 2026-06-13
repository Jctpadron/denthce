import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SlotService } from './slot.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('fhir/r4')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SlotController {
  constructor(private readonly slotService: SlotService) {}

  @Get('Slot')
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async findAvailableSlots(
    @Request() req: any,
    @Query('specialty') specialty?: string,
    @Query('start') start?: string | string[],
    @Query('status') status?: string,
  ) {
    if (status !== 'free') {
      throw new BadRequestException('Solo se permite la búsqueda de slots libres (status=free).');
    }

    // Resolver specialtyId quitando cualquier prefijo de system "system|{uuid}"
    let specialtyId = specialty;
    if (specialty && specialty.includes('|')) {
      specialtyId = specialty.split('|')[1];
    }

    if (!specialtyId) {
      throw new BadRequestException('El parámetro specialty (especialidad) es obligatorio.');
    }

    // Resolver rangos start=ge... y start=lt...
    let startDateStr: string | null = null;
    let endDateStr: string | null = null;

    if (Array.isArray(start)) {
      const geParam = start.find((s) => s.startsWith('ge'));
      const ltParam = start.find((s) => s.startsWith('lt'));
      if (geParam) startDateStr = geParam.substring(2);
      if (ltParam) endDateStr = ltParam.substring(2);
    } else if (typeof start === 'string') {
      if (start.startsWith('ge')) startDateStr = start.substring(2);
      else if (start.startsWith('lt')) endDateStr = start.substring(2);
    }

    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('Es obligatorio especificar los rangos de fecha de inicio start=ge... y fin start=lt...');
    }

    return this.slotService.findAvailableSlots(specialtyId, startDateStr, endDateStr, req.user.tenantId);
  }

  @Get('Practitioner')
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async getPractitioner(@Request() req: any) {
    return this.slotService.findPractitioner(req.user.tenantId);
  }

  @Get('HealthcareService')
  @Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
  async getHealthcareService(@Request() req: any) {
    return this.slotService.findHealthcareService(req.user.tenantId);
  }
}
