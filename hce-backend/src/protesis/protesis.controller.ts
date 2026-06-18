import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ModulesGuard } from '../auth/modules.guard';
import { RequiresModule } from '../auth/requires-module.decorator';
import { ProtesisService, CreateOrderDto, SendMessageDto, CreateInsumoDto, UpdateInsumoDto, UpdateTrazabilidadDto, SignConformidadDto, SetPresupuestoDto, SetPresupuestoEstimadoDto, RegistrarPagoDto, RegistrarConsumoDto } from './protesis.service';

@Controller('protesis')
@UseGuards(AuthGuard('jwt'), RolesGuard, ModulesGuard)
@RequiresModule('protesis-lab')
export class ProtesisController {
  constructor(private readonly protesisService: ProtesisService) {}

  // Determinar si el usuario logueado es del laboratorio o clínica en base a sus roles de Keycloak
  private getTenantType(user: any): 'laboratorio' | 'clinica' {
    const roles = user?.roles || [];
    if (roles.includes('laboratorio-operador') || roles.includes('laboratorio-admin')) {
      return 'laboratorio';
    }
    return 'clinica';
  }

  @Get('dashboard/stats')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async getDashboardStats(@Request() req: any) {
    return this.protesisService.getDashboardStats(req.user.tenantId);
  }

  @Get('insumos')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async getInsumos(@Request() req: any) {
    return this.protesisService.getInsumos(req.user.tenantId);
  }

  @Post('insumos')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async createInsumo(@Body() dto: CreateInsumoDto, @Request() req: any) {
    return this.protesisService.createInsumo(req.user.tenantId, dto);
  }

  @Patch('insumos/:id/stock')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async updateStock(
    @Param('id') id: string,
    @Body('stock') stock: number,
    @Request() req: any,
  ) {
    return this.protesisService.updateStock(req.user.tenantId, id, stock);
  }

  @Patch('insumos/:id')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async updateInsumo(
    @Param('id') id: string,
    @Body() dto: UpdateInsumoDto,
    @Request() req: any,
  ) {
    return this.protesisService.updateInsumo(req.user.tenantId, id, dto);
  }

  @Get('history')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async getHistoryOrders(@Request() req: any) {
    const tenantType = this.getTenantType(req.user);
    return this.protesisService.getHistoryOrders(req.user.tenantId, tenantType);
  }

  @Get()
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async getOrders(@Request() req: any) {
    const tenantType = this.getTenantType(req.user);
    return this.protesisService.getOrders(req.user.tenantId, tenantType);
  }

  @Get(':id')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async getOrderDetails(@Param('id') id: string, @Request() req: any) {
    return this.protesisService.getOrderDetails(req.user.tenantId, id);
  }

  @Get(':id/history')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async getOrderStatusHistory(@Param('id') id: string, @Request() req: any) {
    return this.protesisService.getOrderStatusHistory(req.user.tenantId, id);
  }

  @Post()
  @Roles('medico', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async createOrder(@Body() dto: CreateOrderDto, @Request() req: any) {
    return this.protesisService.createOrder(req.user.tenantId, dto);
  }

  @Patch(':id/status')
  @Roles('medico', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason: string | undefined,
    @Request() req: any,
  ) {
    const userSub = req.user.sub || 'unknown';
    const userName = req.user.name || req.user.preferred_username || 'Usuario';
    return this.protesisService.updateStatus(req.user.tenantId, id, status, userSub, userName, reason);
  }

  @Post(':id/chat')
  @Roles('medico', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async addChatMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ) {
    // Usamos el id de usuario de Keycloak y su nombre real (si está en el token)
    const senderId = req.user.sub || 'unknown';
    const senderName = req.user.name || req.user.preferred_username || 'Usuario';
    return this.protesisService.addChatMessage(req.user.tenantId, id, senderId, senderName, dto);
  }

  @Patch(':id/trazabilidad')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async updateTrazabilidad(
    @Param('id') id: string,
    @Body() dto: UpdateTrazabilidadDto,
    @Request() req: any,
  ) {
    return this.protesisService.updateTrazabilidad(req.user.tenantId, id, dto);
  }

  @Patch(':id/conformidad')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async signConformidad(
    @Param('id') id: string,
    @Body() dto: SignConformidadDto,
    @Request() req: any,
  ) {
    return this.protesisService.signConformidad(req.user.tenantId, id, dto);
  }

  // --- Finanzas ---

  @Patch(':id/presupuesto-final')
  @Roles('laboratorio-admin')
  async setPresupuestoFinal(
    @Param('id') id: string,
    @Body() dto: SetPresupuestoDto,
    @Request() req: any,
  ) {
    return this.protesisService.setPresupuestoFinal(req.user.tenantId, id, dto.presupuestoFinal);
  }

  @Patch(':id/presupuesto-estimado')
  @Roles('medico', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async setPresupuestoEstimado(
    @Param('id') id: string,
    @Body() dto: SetPresupuestoEstimadoDto,
    @Request() req: any,
  ) {
    return this.protesisService.setPresupuestoEstimado(req.user.tenantId, id, dto.presupuestoEstimado);
  }

  @Post(':id/pagos')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async registrarPago(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoDto,
    @Request() req: any,
  ) {
    const registradoPor = req.user.name || req.user.preferred_username || 'Usuario';
    return this.protesisService.registrarPago(req.user.tenantId, id, dto, registradoPor);
  }

  @Post(':id/consumos')
  @Roles('laboratorio-operador', 'laboratorio-admin')
  async registrarConsumo(
    @Param('id') id: string,
    @Body() dto: RegistrarConsumoDto,
    @Request() req: any,
  ) {
    const registradoPor = req.user.name || req.user.preferred_username || 'Usuario';
    return this.protesisService.registrarConsumo(req.user.tenantId, id, dto, registradoPor);
  }

  @Get(':id/finanzas')
  @Roles('medico', 'administrador', 'laboratorio-operador', 'laboratorio-admin')
  async getFinanzas(@Param('id') id: string, @Request() req: any) {
    return this.protesisService.getFinanzas(req.user.tenantId, id);
  }

  @Get('finanzas/cuenta-corriente')
  @Roles('laboratorio-admin')
  async getCuentaCorriente(@Request() req: any) {
    return this.protesisService.getCuentaCorriente(req.user.tenantId);
  }
}
