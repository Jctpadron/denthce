import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ProtesisOrder } from './protesis-order.entity';
import { ProtesisChat } from './protesis-chat.entity';
import { ProtesisInsumo } from './protesis-insumo.entity';

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
  additionalMeta?: {
    height?: number;
    color?: string;
    lotNumber?: string;
    brand?: string;
  };
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

@Injectable()
export class ProtesisService {
  constructor(
    @InjectRepository(ProtesisOrder)
    private readonly orderRepository: Repository<ProtesisOrder>,
    @InjectRepository(ProtesisChat)
    private readonly chatRepository: Repository<ProtesisChat>,
    @InjectRepository(ProtesisInsumo)
    private readonly insumoRepository: Repository<ProtesisInsumo>,
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

  // Actualizar estado de la orden
  async updateStatus(tenantId: string, orderId: string, status: string): Promise<ProtesisOrder> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    // Solo la clínica emisora o el laboratorio receptor pueden cambiar el estado
    if (order.tenantId !== tenantId && order.performerTenantId !== tenantId) {
      throw new ForbiddenException('No tiene permisos para modificar esta orden');
    }

    order.status = status;
    return this.orderRepository.save(order);
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
    order.status = 'ready';

    return this.orderRepository.save(order);
  }
}
