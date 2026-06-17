import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  ClinicaFinanzasService,
  CreatePrecioDto,
  UpdatePrecioDto,
  CreatePresupuestoDto,
  RegistrarPagoDto,
  CreateGastoDto,
} from './clinica-finanzas.service';

@Controller('clinica/finanzas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClinicaFinanzasController {
  constructor(private readonly finanzasService: ClinicaFinanzasService) {}

  // ========== NOMENCLADOR ==========

  @Get('nomenclador')
  @Roles('medico', 'administrador', 'recepcionista')
  async getNomenclador(@Request() req: any) {
    return this.finanzasService.getNomenclador(req.user.tenantId);
  }

  @Post('nomenclador')
  @Roles('medico', 'administrador')
  async createPrecio(@Body() dto: CreatePrecioDto, @Request() req: any) {
    return this.finanzasService.upsertPrecio(req.user.tenantId, dto);
  }

  @Patch('nomenclador/:id')
  @Roles('medico', 'administrador')
  async updatePrecio(@Param('id') id: string, @Body() dto: UpdatePrecioDto, @Request() req: any) {
    return this.finanzasService.updatePrecio(req.user.tenantId, id, dto);
  }

  @Delete('nomenclador/:id')
  @Roles('medico', 'administrador')
  async deletePrecio(@Param('id') id: string, @Request() req: any) {
    return this.finanzasService.deactivatePrecio(req.user.tenantId, id);
  }

  // ========== PRESUPUESTOS ==========

  @Get('presupuesto')
  @Roles('medico', 'administrador', 'recepcionista')
  async getPresupuestos(
    @Request() req: any,
    @Query('patientId') patientId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.finanzasService.getPresupuestos(req.user.tenantId, { patientId, estado });
  }

  @Get('presupuesto/:id')
  @Roles('medico', 'administrador', 'recepcionista')
  async getPresupuesto(@Param('id') id: string, @Request() req: any) {
    return this.finanzasService.getPresupuesto(req.user.tenantId, id);
  }

  @Post('presupuesto')
  @Roles('medico', 'administrador')
  async createPresupuesto(@Body() dto: CreatePresupuestoDto, @Request() req: any) {
    return this.finanzasService.createPresupuesto(req.user.tenantId, dto, req.user.preferred_username || req.user.sub);
  }

  @Patch('presupuesto/:id')
  @Roles('medico', 'administrador')
  async updatePresupuesto(@Param('id') id: string, @Body() dto: Partial<CreatePresupuestoDto>, @Request() req: any) {
    return this.finanzasService.updatePresupuesto(req.user.tenantId, id, dto, req.user.preferred_username || req.user.sub);
  }

  @Post('presupuesto/:id/presentar')
  @Roles('medico', 'administrador')
  async presentarPresupuesto(@Param('id') id: string, @Request() req: any) {
    return this.finanzasService.transicionarEstado(req.user.tenantId, id, 'presentado');
  }

  @Post('presupuesto/:id/aceptar')
  @Roles('medico', 'administrador')
  async aceptarPresupuesto(@Param('id') id: string, @Request() req: any) {
    return this.finanzasService.transicionarEstado(req.user.tenantId, id, 'aceptado');
  }

  @Post('presupuesto/:id/cancelar')
  @Roles('medico', 'administrador')
  async cancelarPresupuesto(@Param('id') id: string, @Request() req: any) {
    return this.finanzasService.transicionarEstado(req.user.tenantId, id, 'cancelado');
  }

  @Delete('presupuesto/:id')
  @Roles('medico', 'administrador')
  async deletePresupuesto(@Param('id') id: string, @Request() req: any) {
    return this.finanzasService.deletePresupuesto(req.user.tenantId, id);
  }

  // ========== PAGOS ==========

  @Get('pago')
  @Roles('medico', 'administrador', 'recepcionista')
  async getPagos(
    @Request() req: any,
    @Query('patientId') patientId?: string,
    @Query('presupuestoId') presupuestoId?: string,
  ) {
    return this.finanzasService.getPagos(req.user.tenantId, { patientId, presupuestoId });
  }

  @Post('pago')
  @Roles('medico', 'administrador')
  async registrarPago(@Body() dto: RegistrarPagoDto, @Request() req: any) {
    return this.finanzasService.registrarPago(req.user.tenantId, dto, req.user.preferred_username || req.user.sub);
  }

  // ========== GASTOS ==========

  @Get('gasto')
  @Roles('medico', 'administrador')
  async getGastos(
    @Request() req: any,
    @Query('categoria') categoria?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const desdeDate = desde ? new Date(desde) : undefined;
    const hastaDate = hasta ? new Date(hasta) : undefined;
    return this.finanzasService.getGastos(req.user.tenantId, { categoria, desde: desdeDate, hasta: hastaDate });
  }

  @Post('gasto')
  @Roles('medico', 'administrador')
  async registrarGasto(@Body() dto: CreateGastoDto, @Request() req: any) {
    return this.finanzasService.registrarGasto(req.user.tenantId, dto, req.user.preferred_username || req.user.sub);
  }

  // ========== DASHBOARD ==========

  @Get('dashboard')
  @Roles('medico', 'administrador', 'recepcionista')
  async getDashboard(@Request() req: any) {
    return this.finanzasService.getDashboard(req.user.tenantId);
  }

  @Get('cuenta-corriente/:patientId')
  @Roles('medico', 'administrador', 'recepcionista')
  async getCuentaCorriente(@Param('patientId') patientId: string, @Request() req: any) {
    return this.finanzasService.getCuentaCorriente(req.user.tenantId, patientId);
  }

  @Get('reporte')
  @Roles('medico', 'administrador')
  async getReporte(
    @Request() req: any,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.finanzasService.getReporte(req.user.tenantId, new Date(desde), new Date(hasta));
  }
}
