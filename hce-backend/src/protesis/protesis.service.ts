import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import { ProtesisOrder } from './protesis-order.entity';
import { ProtesisChat } from './protesis-chat.entity';
import { ProtesisInsumo } from './protesis-insumo.entity';
import { ProtesisStatusHistory } from './protesis-status-history.entity';
import { ProtesisPago } from './protesis-pago.entity';
import { ProtesisConsumoInsumo } from './protesis-consumo-insumo.entity';

export class CreateOrderDto {
  performerTenantId?: string;
  patientId?: string;
  tenantId?: string;
  isManual?: boolean;
  patientName?: string;
  doctorName?: string;
  doctorMatricula?: string;
  dentalWork: {
    workType: string;
    material: string;
    color: string;
    teeth: number[];
    notes?: string;
  };
  requestedDelivery?: Date;
}

export class SendMessageDto {
  textContent: string;
  attachmentMeta?: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  };
}

export class CreateInsumoDto {
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  precioUnitario?: number;
  additionalMeta?: {
    height?: number;
    color?: string;
    lotNumber?: string;
    brand?: string;
  };
}

export class UpdateInsumoDto {
  name?: string;
  category?: string;
  stock?: number;
  minStock?: number;
  unit?: string;
  precioUnitario?: number;
  additionalMeta?: object;
}

export class UpdateTrazabilidadDto {
  technicianName?: string;
  materialLot?: string;
  materialBrand?: string;
  aditamentos?: {
    type: string;
    brand: string;
    lot: string;
  }[];
}

export class SignConformidadDto {
  signedBy: string;
  declaracionDoc: string;
}

export class SetPresupuestoDto {
  presupuestoFinal: number;
}

export class SetPresupuestoEstimadoDto {
  presupuestoEstimado: number;
}

export class RegistrarPagoDto {
  monto: number;
  metodoPago: string;
  fechaPago?: Date;
  comprobanteRef?: string;
  notas?: string;
}

export class RegistrarConsumoDto {
  insumoId: string;
  cantidad: number;
  costoUnitario?: number;
  lote?: string;
}

@Injectable()
export class ProtesisService {
  constructor(
    @InjectRepository(ProtesisOrder)
    private readonly orderRepository: Repository<ProtesisOrder>,
    @InjectRepository(ProtesisChat)
    private readonly chatRepository: Repository<ProtesisChat>,
    @InjectRepository(ProtesisInsumo)
    private readonly insumoRepository: Repository<ProtesisInsumo>,
    @InjectRepository(ProtesisStatusHistory)
    private readonly statusHistoryRepository: Repository<ProtesisStatusHistory>,
    @InjectRepository(ProtesisPago)
    private readonly pagoRepository: Repository<ProtesisPago>,
    @InjectRepository(ProtesisConsumoInsumo)
    private readonly consumoRepository: Repository<ProtesisConsumoInsumo>,
  ) {}

  // Listar órdenes según el rol y tenant del usuario
  async getOrders(tenantId: string, tenantType: 'clinica' | 'laboratorio' | string): Promise<ProtesisOrder[]> {
    if (tenantType === 'laboratorio') {
      return this.orderRepository.find({
        where: { performerTenantId: tenantId },
        order: { createdAt: 'DESC' },
      });
    } else {
      return this.orderRepository.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
    }
  }

  // Obtener detalle y chat de una orden específica, validando seguridad de tenencia
  async getOrderDetails(tenantId: string, orderId: string): Promise<ProtesisOrder> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { messages: true },
    });

    if (!order) {
      throw new NotFoundException('Orden de prótesis no encontrada');
    }

    // Validar aislamiento de datos (Zero-Trust)
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para acceder a esta orden');
    }

    // Ordenar mensajes por fecha ascendente para el chat
    if (order.messages) {
      order.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return order;
  }

  // Crear una nueva orden (desde el odontólogo/clínica o laboratorio manual)
  async createOrder(tenantId: string, dto: CreateOrderDto): Promise<ProtesisOrder> {
    const isManual = dto.isManual === true;
    const order = this.orderRepository.create({
      tenantId: isManual ? (dto.tenantId || 'external') : tenantId,
      performerTenantId: isManual ? tenantId : dto.performerTenantId,
      patientId: isManual ? (dto.patientId || 'external') : dto.patientId,
      isManual,
      patientName: isManual ? dto.patientName : undefined,
      doctorName: isManual ? dto.doctorName : undefined,
      doctorMatricula: isManual ? dto.doctorMatricula : undefined,
      status: 'received',
      dentalWork: dto.dentalWork,
      requestedDelivery: dto.requestedDelivery ? new Date(dto.requestedDelivery) : undefined,
    });

    return this.orderRepository.save(order);
  }

  // Mapa de transiciones válidas: [from] → [to, ...]
  static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    received:    ['designing', 'cancelled'],
    designing:   ['processing', 'cancelled'],
    processing:  ['ceramic', 'cancelled'],
    ceramic:     ['ready', 'cancelled'],
    ready:       ['delivered', 'cancelled'],
    delivered:   [],
    cancelled:   [],
  };

  // Estados terminales (no admiten más transiciones)
  static readonly TERMINAL_STATUSES = ['delivered', 'cancelled'];

  // Actualizar estado con máquina de estados formal + auditoría
  async updateStatus(
    tenantId: string,
    orderId: string,
    status: string,
    userSub?: string,
    userName?: string,
    reason?: string,
  ): Promise<ProtesisOrder> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden de prótesis no encontrada');
    }

    // Validar tenencia
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para modificar esta orden');
    }

    // Validar que el estado destino sea uno conocido
    const allowedNext = ProtesisService.VALID_TRANSITIONS[order.status];
    if (!allowedNext) {
      throw new BadRequestException(`Estado actual "${order.status}" no tiene transiciones definidas`);
    }

    // Si es estado terminal, no se permiten más cambios
    if (ProtesisService.TERMINAL_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `La orden ya está en estado terminal "${order.status}" y no puede ser modificada`,
      );
    }

    // Validar que la transición esté permitida
    if (!allowedNext.includes(status)) {
      throw new BadRequestException(
        `Transición inválida: de "${order.status}" a "${status}". ` +
        `Transiciones permitidas: ${allowedNext.join(', ')}.`,
      );
    }

    // Registrar auditoría antes de cambiar
    const fromStatus = order.status;
    order.status = status;
    const saved = await this.orderRepository.save(order);

    await this.statusHistoryRepository.save({
      orderId: order.id,
      fromStatus,
      toStatus: status,
      changedBy: userSub || 'unknown',
      changedByName: userName || null,
      actorType: order.performerTenantId === tenantId ? 'laboratorio' : 'clinica',
      reason: reason || null,
    });

    return saved;
  }

  // Enviar mensaje al chat
  async addChatMessage(
    tenantId: string,
    orderId: string,
    senderId: string,
    senderName: string,
    dto: SendMessageDto,
  ): Promise<ProtesisChat> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    // Validar seguridad de tenencia
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para enviar mensajes en este chat');
    }

    const message = this.chatRepository.create({
      orderId,
      senderId,
      senderName,
      textContent: dto.textContent,
      attachmentMeta: dto.attachmentMeta || undefined,
    });

    return this.chatRepository.save(message);
  }

  // Listar insumos de un laboratorio específico (Zero-Trust)
  async getInsumos(tenantId: string): Promise<ProtesisInsumo[]> {
    return this.insumoRepository.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  // Crear un nuevo insumo de inventario
  async createInsumo(tenantId: string, dto: CreateInsumoDto): Promise<ProtesisInsumo> {
    const insumo = this.insumoRepository.create({
      tenantId,
      ...dto,
    });
    return this.insumoRepository.save(insumo);
  }

  // Actualizar la cantidad de stock de un insumo
  async updateStock(tenantId: string, insumoId: string, stock: number): Promise<ProtesisInsumo> {
    if (!Number.isFinite(stock) || stock < 0) {
      throw new BadRequestException('El stock debe ser un número mayor o igual a 0.');
    }

    const insumo = await this.insumoRepository.findOne({ where: { id: insumoId } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado en el almacén');
    }

    // Validar aislamiento de datos (Zero-Trust)
    if (insumo.tenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para modificar el stock de este insumo');
    }

    insumo.stock = stock;
    return this.insumoRepository.save(insumo);
  }

  // Actualizar datos de un insumo (incluyendo precio)
  async updateInsumo(tenantId: string, insumoId: string, dto: UpdateInsumoDto): Promise<ProtesisInsumo> {
    const insumo = await this.insumoRepository.findOne({ where: { id: insumoId } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado');
    }
    if (insumo.tenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para modificar este insumo');
    }
    Object.assign(insumo, dto);
    return this.insumoRepository.save(insumo);
  }

  // Obtener estadísticas agregadas para el dashboard del laboratorio
  async getDashboardStats(tenantId: string): Promise<any> {
    // 1. Obtener todas las órdenes que pertenecen a este laboratorio
    const orders = await this.orderRepository.find({
      where: { performerTenantId: tenantId },
    });

    // 2. Agrupar órdenes activas por estado
    const statusCounts = {
      received: 0,
      designing: 0,
      processing: 0,
      ceramic: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      if (statusCounts[order.status] !== undefined) {
        statusCounts[order.status]++;
      }
    });

    // 3. Trabajos críticos (vence en los próximos 3 días y no entregado/cancelado)
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + 3);

    const criticalOrders = orders.filter((order) => {
      if (order.status === 'delivered' || order.status === 'cancelled') return false;
      if (!order.requestedDelivery) return false;
      const delivery = new Date(order.requestedDelivery);
      return delivery.getTime() >= today.getTime() - (24 * 60 * 60 * 1000) && delivery.getTime() <= limitDate.getTime();
    });

    // 4. Insumos en alerta de stock (stock <= minStock)
    const insumos = await this.insumoRepository.find({ where: { tenantId } });
    const lowStockCount = insumos.filter((insumo) => insumo.stock <= insumo.minStock).length;

    return {
      activeOrdersCount: orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
      statusCounts,
      criticalOrdersCount: criticalOrders.length,
      lowStockCount,
    };
  }

  // Obtener historial de órdenes completadas (entregadas o canceladas)
  async getHistoryOrders(tenantId: string, tenantType: string): Promise<ProtesisOrder[]> {
    const terminalStatuses = ProtesisService.TERMINAL_STATUSES;
    if (tenantType === 'laboratorio') {
      return this.orderRepository.find({
        where: { performerTenantId: tenantId, status: In(terminalStatuses) },
        order: { createdAt: 'DESC' },
      });
    } else {
      return this.orderRepository.find({
        where: { tenantId, status: In(terminalStatuses) },
        order: { createdAt: 'DESC' },
      });
    }
  }

  // Obtener timeline de estados de una orden específica
  async getOrderStatusHistory(tenantId: string, orderId: string): Promise<ProtesisStatusHistory[]> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden de prótesis no encontrada');
    }
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para acceder a esta orden');
    }
    return this.statusHistoryRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  // Actualizar trazabilidad de insumos (antes de firmar la conformidad)
  async updateTrazabilidad(
    tenantId: string,
    orderId: string,
    dto: UpdateTrazabilidadDto,
  ): Promise<ProtesisOrder> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    // Validar aislamiento multi-tenant
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para modificar esta orden');
    }

    // Validar si ya está firmada la conformidad
    if (order.conformidad?.isSigned) {
      throw new ForbiddenException('No se puede modificar la trazabilidad de una orden con conformidad ya firmada');
    }

    order.trazabilidad = {
      technicianName: dto.technicianName,
      materialLot: dto.materialLot,
      materialBrand: dto.materialBrand,
      aditamentos: dto.aditamentos || [],
    };

    return this.orderRepository.save(order);
  }

  // --- Métodos Financieros ---

  // Fijar presupuesto final (solo laboratorio-admin)
  async setPresupuestoFinal(tenantId: string, orderId: string, presupuestoFinal: number): Promise<ProtesisOrder> {
    const order = await this.findOrder(tenantId, orderId);
    order.presupuestoFinal = presupuestoFinal;
    if (!order.presupuestoEstimado) {
      order.presupuestoEstimado = presupuestoFinal;
    }
    return this.orderRepository.save(order);
  }

  // Fijar presupuesto estimado (clínica)
  async setPresupuestoEstimado(tenantId: string, orderId: string, presupuestoEstimado: number): Promise<ProtesisOrder> {
    const order = await this.findOrder(tenantId, orderId);
    order.presupuestoEstimado = presupuestoEstimado;
    return this.orderRepository.save(order);
  }

  // Registrar un pago (laboratorio-operador)
  async registrarPago(tenantId: string, orderId: string, dto: RegistrarPagoDto, registradoPor: string): Promise<ProtesisPago> {
    const order = await this.findOrder(tenantId, orderId);

    const pago = new ProtesisPago();
    pago.orderId = order.id;
    pago.monto = dto.monto;
    pago.metodoPago = dto.metodoPago;
    pago.fechaPago = dto.fechaPago || new Date();
    pago.comprobanteRef = dto.comprobanteRef || undefined;
    pago.notas = dto.notas || undefined;
    pago.registradoPor = registradoPor;

    const saved = await this.pagoRepository.save(pago);

    // Recalcular estado de pago de la orden
    await this.recalcularEstadoPago(order.id);

    return saved;
  }

  // Registrar consumo de insumo (laboratorio-operador)
  async registrarConsumo(tenantId: string, orderId: string, dto: RegistrarConsumoDto, registradoPor: string): Promise<ProtesisConsumoInsumo> {
    const order = await this.findOrder(tenantId, orderId);

    // Validar que el insumo exista dentro del tenant
    const insumo = await this.insumoRepository.findOne({ where: { id: dto.insumoId, tenantId } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado o no pertenece a este laboratorio');
    }

    // Validar stock suficiente
    if (insumo.stock < dto.cantidad) {
      throw new BadRequestException(`Stock insuficiente: disponible ${insumo.stock}, requerido ${dto.cantidad}`);
    }

    const costoUnitario = dto.costoUnitario ?? insumo.precioUnitario ?? 0;
    const costoTotal = costoUnitario * dto.cantidad;

    const consumo = new ProtesisConsumoInsumo();
    consumo.orderId = order.id;
    consumo.insumoId = insumo.id;
    consumo.cantidad = dto.cantidad;
    consumo.costoUnitario = costoUnitario;
    consumo.costoTotal = costoTotal;
    consumo.lote = dto.lote || undefined;
    consumo.registradoPor = registradoPor;

    // Descontar del stock
    insumo.stock -= dto.cantidad;
    await this.insumoRepository.save(insumo);

    return this.consumoRepository.save(consumo);
  }

  // Obtener datos financieros de una orden (pagos + consumos + totales)
  async getFinanzas(tenantId: string, orderId: string): Promise<any> {
    const order = await this.findOrder(tenantId, orderId);

    const pagos = await this.pagoRepository.find({ where: { orderId: order.id }, order: { createdAt: 'DESC' } });
    const consumos = await this.consumoRepository.find({
      where: { orderId: order.id },
      relations: { insumo: true },
      order: { createdAt: 'DESC' },
    });

    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const totalConsumos = consumos.reduce((sum, c) => sum + Number(c.costoTotal), 0);
    const saldoPendiente = Math.max(0, (order.presupuestoFinal ?? order.presupuestoEstimado ?? 0) - totalPagado);

    return {
      presupuestoEstimado: order.presupuestoEstimado,
      presupuestoFinal: order.presupuestoFinal,
      estadoPago: order.estadoPago,
      fechaVencimiento: order.fechaVencimiento,
      totalPagado,
      saldoPendiente,
      totalConsumos,
      pagos,
      consumos,
    };
  }

  // Cuenta corriente: deuda agregada por clínica
  async getCuentaCorriente(tenantId: string): Promise<any> {
    const orders = await this.orderRepository.find({
      where: { performerTenantId: tenantId },
    });

    const orderIds = orders.map((o) => o.id);
    const pagos = await this.pagoRepository.find({ where: { orderId: In(orderIds) } });
    const pagoPorOrden: Record<string, number> = {};
    for (const p of pagos) {
      pagoPorOrden[p.orderId] = (pagoPorOrden[p.orderId] || 0) + Number(p.monto);
    }

    const resumenPorOrden = orders.map((o) => ({
      id: o.id,
      tenantId: o.tenantId,
      paciente: o.patientName,
      medico: o.doctorName,
      presupuesto: o.presupuestoFinal ?? o.presupuestoEstimado ?? 0,
      pagado: pagoPorOrden[o.id] || 0,
      saldo: Math.max(0, (o.presupuestoFinal ?? o.presupuestoEstimado ?? 0) - (pagoPorOrden[o.id] || 0)),
      estadoPago: o.estadoPago,
    }));

    const totalDeuda = resumenPorOrden.reduce((s, r) => s + r.saldo, 0);

    return { totalDeuda, ordenes: resumenPorOrden };
  }

  // --- Helpers ---

  private async findOrder(tenantId: string, orderId: string): Promise<ProtesisOrder> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden de prótesis no encontrada');
    }
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para acceder a esta orden');
    }
    return order;
  }

  private async recalcularEstadoPago(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) return;

    const pagos = await this.pagoRepository.find({ where: { orderId } });
    const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
    const presupuesto = order.presupuestoFinal ?? order.presupuestoEstimado ?? 0;

    let estadoPago: string;
    if (totalPagado <= 0) {
      estadoPago = 'pending';
    } else if (totalPagado >= presupuesto && presupuesto > 0) {
      estadoPago = 'paid';
    } else {
      estadoPago = 'partial';
    }

    // Marcar como vencido si aplica
    if (order.fechaVencimiento && new Date(order.fechaVencimiento) < new Date() && estadoPago !== 'paid') {
      estadoPago = 'overdue';
    }

    await this.orderRepository.update(orderId, { estadoPago });
  }

  // Firmar la conformidad de forma inmutable y calcular el hash digital SHA-256
  async signConformidad(
    tenantId: string,
    orderId: string,
    dto: SignConformidadDto,
  ): Promise<ProtesisOrder> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    // Validar aislamiento multi-tenant
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para firmar la conformidad de esta orden');
    }

    // Validar si ya está firmada
    if (order.conformidad?.isSigned) {
      throw new ForbiddenException('La conformidad ya ha sido firmada previamente');
    }

    const signedAt = new Date().toISOString();
    
    // Generar hash digital SHA-256 combinando datos clave
    const hashData = JSON.stringify({
      orderId: order.id,
      patientId: order.patientId,
      dentalWork: order.dentalWork,
      trazabilidad: order.trazabilidad || {},
      signedBy: dto.signedBy,
      signedAt,
    });
    
    const hash = crypto.createHash('sha256').update(hashData).digest('hex');

    order.conformidad = {
      signedAt,
      signedBy: dto.signedBy,
      declaracionDoc: dto.declaracionDoc,
      hash,
      isSigned: true,
    };

    // Al firmar, transicionamos automáticamente la orden a 'ready' (Listo para Enviar)
    const fromStatus = order.status;
    order.status = 'ready';

    const saved = await this.orderRepository.save(order);

    // Auditar la transición a ready
    await this.statusHistoryRepository.save({
      orderId: order.id,
      fromStatus,
      toStatus: 'ready',
      changedBy: dto.signedBy || 'system',
      changedByName: dto.signedBy || null,
      actorType: 'laboratorio',
      reason: 'Firma de Declaración de Conformidad sanitaria',
    });

    return saved;
  }
}
