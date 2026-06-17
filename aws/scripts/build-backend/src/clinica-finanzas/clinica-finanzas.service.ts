import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { ClinicalPrecio } from './clinical-precio.entity';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';
import { ClinicalPresupuestoItem } from './clinical-presupuesto-item.entity';
import { ClinicalPago } from './clinical-pago.entity';
import { ClinicalGasto } from './clinical-gasto.entity';

// --- DTOs ---

export class CreatePrecioDto {
  snomedCode: string;
  snomedDisplay: string;
  precio: number;
}

export class UpdatePrecioDto {
  snomedDisplay?: string;
  precio?: number;
  active?: boolean;
}

export class CreatePresupuestoDto {
  patientId: string;
  descuento?: number;
  senhaPorcentaje?: number;
  notas?: string;
  items: CreatePresupuestoItemDto[];
}

export class CreatePresupuestoItemDto {
  snomedCode: string;
  snomedDisplay: string;
  diente?: string;
  cara?: string;
  cantidad?: number;
  precioUnitario: number;
  orden?: number;
}

export class RegistrarPagoDto {
  patientId: string;
  presupuestoId?: string;
  tipo: string; // senha | cuota | pago_directo
  monto: number;
  metodoPago: string;
  fechaPago?: Date;
  comprobante?: string;
  notas?: string;
}

export class CreateGastoDto {
  categoria: string;
  descripcion: string;
  monto: number;
  fechaGasto?: Date;
  metodoPago: string;
  comprobante?: string;
  insumoId?: string;
}

// --- Estados del Presupuesto ---

const ESTADOS_VALIDOS: Record<string, string[]> = {
  borrador: ['presentado'],
  presentado: ['aceptado', 'vencido', 'cancelado'],
  aceptado: ['en_curso', 'cancelado'],
  en_curso: ['pagado', 'cancelado'],
  pagado: [],
  cancelado: [],
  vencido: [],
};

@Injectable()
export class ClinicaFinanzasService {
  constructor(
    @InjectRepository(ClinicalPrecio)
    private precioRepo: Repository<ClinicalPrecio>,
    @InjectRepository(ClinicalPresupuesto)
    private presupuestoRepo: Repository<ClinicalPresupuesto>,
    @InjectRepository(ClinicalPresupuestoItem)
    private presupuestoItemRepo: Repository<ClinicalPresupuestoItem>,
    @InjectRepository(ClinicalPago)
    private pagoRepo: Repository<ClinicalPago>,
    @InjectRepository(ClinicalGasto)
    private gastoRepo: Repository<ClinicalGasto>,
  ) {}

  // ========== NOMENCLADOR ==========

  async getNomenclador(tenantId: string): Promise<ClinicalPrecio[]> {
    return this.precioRepo.find({ where: { tenantId, active: true }, order: { snomedDisplay: 'ASC' } });
  }

  async upsertPrecio(tenantId: string, dto: CreatePrecioDto): Promise<ClinicalPrecio> {
    const existing = await this.precioRepo.findOne({ where: { tenantId, snomedCode: dto.snomedCode } });
    if (existing) {
      existing.precio = dto.precio;
      existing.snomedDisplay = dto.snomedDisplay;
      return this.precioRepo.save(existing);
    }
    return this.precioRepo.save(this.precioRepo.create({ ...dto, tenantId }));
  }

  async updatePrecio(tenantId: string, id: string, dto: UpdatePrecioDto): Promise<ClinicalPrecio> {
    const precio = await this.precioRepo.findOne({ where: { id, tenantId } });
    if (!precio) throw new NotFoundException('Precio no encontrado');
    Object.assign(precio, dto);
    return this.precioRepo.save(precio);
  }

  async deactivatePrecio(tenantId: string, id: string): Promise<void> {
    const precio = await this.precioRepo.findOne({ where: { id, tenantId } });
    if (!precio) throw new NotFoundException('Precio no encontrado');
    precio.active = false;
    await this.precioRepo.save(precio);
  }

  // ========== PRESUPUESTOS ==========

  async getPresupuestos(tenantId: string, filters?: { patientId?: string; estado?: string }): Promise<ClinicalPresupuesto[]> {
    const where: any = { tenantId };
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.estado) where.estado = filters.estado;
    return this.presupuestoRepo.find({ where, relations: { items: true, pagos: true }, order: { createdAt: 'DESC' } });
  }

  async getPresupuesto(tenantId: string, id: string): Promise<ClinicalPresupuesto> {
    const p = await this.presupuestoRepo.findOne({ where: { id, tenantId }, relations: { items: true, pagos: true } });
    if (!p) throw new NotFoundException('Presupuesto no encontrado');
    return p;
  }

  async createPresupuesto(tenantId: string, dto: CreatePresupuestoDto, userId: string): Promise<ClinicalPresupuesto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El presupuesto debe tener al menos un item');
    }

    const subtotal = dto.items.reduce((s, i) => s + (i.precioUnitario * (i.cantidad || 1)), 0);
    const descuento = dto.descuento || 0;
    const total = Math.max(0, subtotal - descuento);
    const senhaPorcentaje = dto.senhaPorcentaje || 30;
    const senhaMonto = total * (senhaPorcentaje / 100);

    const numero = await this.generarNumeroPresupuesto(tenantId);

    const presupuesto = this.presupuestoRepo.create({
      tenantId,
      patientId: dto.patientId,
      numero,
      estado: 'borrador',
      subtotal,
      descuento,
      total,
      senhaPorcentaje,
      senhaMonto,
      notas: dto.notas,
      createdBy: userId,
    });

    const saved = await this.presupuestoRepo.save(presupuesto);

    const items = dto.items.map((item, i) =>
      this.presupuestoItemRepo.create({
        presupuestoId: saved.id,
        tenantId,
        snomedCode: item.snomedCode,
        snomedDisplay: item.snomedDisplay,
        diente: item.diente,
        cara: item.cara,
        cantidad: item.cantidad || 1,
        precioUnitario: item.precioUnitario,
        subtotal: item.precioUnitario * (item.cantidad || 1),
        orden: item.orden ?? i,
      })
    );
    await this.presupuestoItemRepo.save(items);

    return this.getPresupuesto(tenantId, saved.id);
  }

  async updatePresupuesto(tenantId: string, id: string, dto: Partial<CreatePresupuestoDto>, userId: string): Promise<ClinicalPresupuesto> {
    const presupuesto = await this.presupuestoRepo.findOne({ where: { id, tenantId } });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    if (presupuesto.estado !== 'borrador') {
      throw new ForbiddenException('Solo se puede editar un presupuesto en estado borrador');
    }

    if (dto.items) {
      if (dto.items.length === 0) throw new BadRequestException('Debe haber al menos un item');
      await this.presupuestoItemRepo.delete({ presupuestoId: id });
      const items = dto.items.map((item, i) =>
        this.presupuestoItemRepo.create({
          presupuestoId: id,
          tenantId,
          snomedCode: item.snomedCode,
          snomedDisplay: item.snomedDisplay,
          diente: item.diente,
          cara: item.cara,
          cantidad: item.cantidad || 1,
          precioUnitario: item.precioUnitario,
          subtotal: item.precioUnitario * (item.cantidad || 1),
          orden: item.orden ?? i,
        })
      );
      await this.presupuestoItemRepo.save(items);

      const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
      presupuesto.subtotal = subtotal;
      presupuesto.total = Math.max(0, subtotal - (dto.descuento ?? presupuesto.descuento));
    }

    if (dto.descuento !== undefined) {
      presupuesto.descuento = dto.descuento;
      presupuesto.total = Math.max(0, presupuesto.subtotal - dto.descuento);
    }
    if (dto.senhaPorcentaje !== undefined) {
      presupuesto.senhaPorcentaje = dto.senhaPorcentaje;
    }
    presupuesto.senhaMonto = presupuesto.total * (presupuesto.senhaPorcentaje / 100);

    await this.presupuestoRepo.save(presupuesto);
    return this.getPresupuesto(tenantId, id);
  }

  async transicionarEstado(tenantId: string, id: string, nuevoEstado: string, userId?: string): Promise<ClinicalPresupuesto> {
    const presupuesto = await this.presupuestoRepo.findOne({ where: { id, tenantId } });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    const permitidos = ESTADOS_VALIDOS[presupuesto.estado];
    if (!permitidos || !permitidos.includes(nuevoEstado)) {
      throw new BadRequestException(`Transicion de '${presupuesto.estado}' a '${nuevoEstado}' no permitida`);
    }

    if (nuevoEstado === 'aceptado') {
      presupuesto.fechaAceptacion = new Date();
    }

    presupuesto.estado = nuevoEstado;
    await this.presupuestoRepo.save(presupuesto);
    return this.getPresupuesto(tenantId, id);
  }

  async deletePresupuesto(tenantId: string, id: string): Promise<void> {
    const presupuesto = await this.presupuestoRepo.findOne({ where: { id, tenantId } });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    if (presupuesto.estado !== 'borrador') {
      throw new ForbiddenException('Solo se puede eliminar un presupuesto en estado borrador');
    }
    await this.presupuestoRepo.remove(presupuesto);
  }

  // ========== PAGOS ==========

  async getPagos(tenantId: string, filters?: { patientId?: string; presupuestoId?: string }): Promise<ClinicalPago[]> {
    const where: any = { tenantId };
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.presupuestoId) where.presupuestoId = filters.presupuestoId;
    return this.pagoRepo.find({ where, order: { fechaPago: 'DESC' } });
  }

  async registrarPago(tenantId: string, dto: RegistrarPagoDto, userId: string): Promise<ClinicalPago> {
    const pago = this.pagoRepo.create({
      tenantId,
      patientId: dto.patientId,
      presupuestoId: dto.presupuestoId || null,
      tipo: dto.tipo,
      monto: dto.monto,
      metodoPago: dto.metodoPago,
      fechaPago: dto.fechaPago || new Date(),
      comprobante: dto.comprobante,
      notas: dto.notas,
      registeredBy: userId,
    });
    const saved = await this.pagoRepo.save(pago);

    // Recalcular estado del presupuesto vinculado (si existe)
    if (dto.presupuestoId) {
      await this.recalcularEstadoPresupuesto(tenantId, dto.presupuestoId);
    }

    return saved;
  }

  // ========== GASTOS ==========

  async getGastos(tenantId: string, filters?: { categoria?: string; desde?: Date; hasta?: Date }): Promise<ClinicalGasto[]> {
    const where: any = { tenantId };
    if (filters?.categoria) where.categoria = filters.categoria;
    if (filters?.desde && filters?.hasta) {
      where.fechaGasto = Between(filters.desde, filters.hasta);
    }
    return this.gastoRepo.find({ where, order: { fechaGasto: 'DESC' } });
  }

  async registrarGasto(tenantId: string, dto: CreateGastoDto, userId: string): Promise<ClinicalGasto> {
    const gasto = this.gastoRepo.create({
      tenantId,
      ...dto,
      fechaGasto: dto.fechaGasto || new Date(),
      registeredBy: userId,
    });
    return this.gastoRepo.save(gasto);
  }

  // ========== DASHBOARD ==========

  async getDashboard(tenantId: string): Promise<any> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Cobrado hoy
    const pagosHoy = await this.pagoRepo.find({ where: { tenantId, fechaPago: Between(hoy, new Date()) } });
    const cobradoHoy = pagosHoy.reduce((s, p) => s + Number(p.monto), 0);

    // Cobrado este mes
    const pagosMes = await this.pagoRepo.find({ where: { tenantId, fechaPago: Between(inicioMes, new Date()) } });
    const cobradoMes = pagosMes.reduce((s, p) => s + Number(p.monto), 0);

    // Gastos este mes
    const gastosMes = await this.gastoRepo.find({ where: { tenantId, fechaGasto: Between(inicioMes, new Date()) } });
    const gastosTotal = gastosMes.reduce((s, g) => s + Number(g.monto), 0);

    // Deuda total
    const presupuestos = await this.presupuestoRepo.find({
      where: { tenantId, estado: In(['aceptado', 'en_curso']) },
    });
    const presupuestoIds = presupuestos.map((p) => p.id);
    const pagosVinculados = presupuestoIds.length > 0
      ? await this.pagoRepo.find({ where: { presupuestoId: In(presupuestoIds) } })
      : [];
    const pagoPorPresupuesto: Record<string, number> = {};
    for (const p of pagosVinculados) {
      if (p.presupuestoId) {
        pagoPorPresupuesto[p.presupuestoId] = (pagoPorPresupuesto[p.presupuestoId] || 0) + Number(p.monto);
      }
    }
    const deudaTotal = presupuestos.reduce((s, p) => s + Math.max(0, Number(p.total) - (pagoPorPresupuesto[p.id] || 0)), 0);

    // Pacientes morosos (presupuestos vencidos)
    const vencidos = await this.presupuestoRepo.count({ where: { tenantId, estado: 'vencido' } });

    return {
      cobradoHoy,
      cobradoMes,
      gastosMes: gastosTotal,
      rentabilidadNeta: cobradoMes - gastosTotal,
      deudaTotal,
      pacientesMorosos: vencidos,
    };
  }

  async getCuentaCorriente(tenantId: string, patientId: string): Promise<any> {
    const presupuestos = await this.presupuestoRepo.find({
      where: { tenantId, patientId },
      relations: { items: true, pagos: true },
      order: { createdAt: 'DESC' },
    });

    let totalPresupuestado = 0;
    let totalPagado = 0;

    const presupuestosDetalle = presupuestos.map((p) => {
      const pagosPresupuesto = (p.pagos || []).reduce((s, pg) => s + Number(pg.monto), 0);
      totalPresupuestado += Number(p.total);
      totalPagado += pagosPresupuesto;
      return {
        id: p.id,
        numero: p.numero,
        fecha: p.fechaEmision,
        total: Number(p.total),
        pagado: pagosPresupuesto,
        saldo: Math.max(0, Number(p.total) - pagosPresupuesto),
        estado: p.estado,
      };
    });

    return {
      patientId,
      totalPresupuestado,
      totalPagado,
      deudaActual: totalPresupuestado - totalPagado,
      presupuestos: presupuestosDetalle,
    };
  }

  async getReporte(tenantId: string, desde: Date, hasta: Date): Promise<any> {
    const pagos = await this.pagoRepo.find({ where: { tenantId, fechaPago: Between(desde, hasta) } });
    const gastos = await this.gastoRepo.find({ where: { tenantId, fechaGasto: Between(desde, hasta) } });
    const ingresos = pagos.reduce((s, p) => s + Number(p.monto), 0);
    const egresos = gastos.reduce((s, g) => s + Number(g.monto), 0);

    const pagosPorMetodo: Record<string, number> = {};
    for (const p of pagos) {
      pagosPorMetodo[p.metodoPago] = (pagosPorMetodo[p.metodoPago] || 0) + Number(p.monto);
    }

    const gastosPorCategoria: Record<string, number> = {};
    for (const g of gastos) {
      gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + Number(g.monto);
    }

    return {
      desde,
      hasta,
      ingresos,
      egresos,
      balance: ingresos - egresos,
      pagosPorMetodo,
      gastosPorCategoria,
      cantidadPagos: pagos.length,
      cantidadGastos: gastos.length,
    };
  }

  // ========== UTILITY ==========

  private async recalcularEstadoPresupuesto(tenantId: string, presupuestoId: string): Promise<void> {
    const presupuesto = await this.presupuestoRepo.findOne({ where: { id: presupuestoId, tenantId } });
    if (!presupuesto) return;

    const pagos = await this.pagoRepo.find({ where: { presupuestoId } });
    const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
    const total = Number(presupuesto.total);

    let nuevoEstado: string;
    if (totalPagado <= 0) {
      // Si fue aceptado pero no tiene pagos, queda aceptado
      nuevoEstado = presupuesto.estado;
    } else if (totalPagado >= total) {
      nuevoEstado = 'pagado';
    } else if (presupuesto.estado === 'aceptado') {
      nuevoEstado = 'en_curso';
    } else {
      nuevoEstado = presupuesto.estado;
    }

    // Marcar vencido si aplica
    if (presupuesto.fechaValidez && new Date(presupuesto.fechaValidez) < new Date() && nuevoEstado !== 'pagado' && presupuesto.estado !== 'cancelado') {
      nuevoEstado = 'vencido';
    }

    if (nuevoEstado !== presupuesto.estado) {
      presupuesto.estado = nuevoEstado;
      await this.presupuestoRepo.save(presupuesto);
    }
  }

  private async generarNumeroPresupuesto(tenantId: string): Promise<string> {
    const count = await this.presupuestoRepo.count({ where: { tenantId } });
    return `PRES-${String(count + 1).padStart(4, '0')}`;
  }
}


