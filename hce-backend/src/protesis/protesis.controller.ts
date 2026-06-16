import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProtesisService, CreateOrderDto, SendMessageDto, CreateInsumoDto, UpdateTrazabilidadDto, SignConformidadDto } from './protesis.service';

@Controller('protesis')
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
    @Request() req: any,
  ) {
    return this.protesisService.updateStatus(req.user.tenantId, id, status);
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
}
