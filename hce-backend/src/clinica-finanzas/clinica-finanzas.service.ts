import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { ClinicalPrecio } from './clinical-precio.entity';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';
import { ClinicalPresupuestoItem } from './clinical-presupuesto-item.entity';
import { ClinicalPago } from './clinical-pago.entity';
import { ClinicalGasto } from './clinical-gasto.entity';
import { PatientEntity } from '../patient/patient.entity';

// --- DTOs ---

export interface CreatePrecioDto {
  snomedCode: string;
  snomedDisplay: string;
  precio: number;
}

export interface UpdatePrecioDto {
  snomedDisplay?: string;
  precio?: number;
  active?: boolean;
}

export interface CreatePresupuestoDto {
  patientId: string;
  descuento?: number;
  senhaPorcentaje?: number;
  notas?: string;
  // --- Campos odontológicos PAMI / OS (aditivos, opcionales) ---
  rxPresentadas?: number;
  obraSocial?: string;
  cantidadCuotas?: number;
  fechaPresentacion?: string; // ISO date (YYYY-MM-DD)
  fechaLiquidacion?: string; // ISO date (YYYY-MM-DD)
  items: CreatePresupuestoItemDto[];
}

export interface CreatePresupuestoItemDto {
  snomedCode: string;
  snomedDisplay: string;
  codigoNomenclador?: string; // código de facturación a la OS (distinto del SNOMED clínico)
  diente?: string;
  cara?: string;
  detalle?: string; // texto libre (puentes multi-pieza, notas)
  cantidad?: number;
  precioUnitario: number;
  orden?: number;
  sourceResourceId?: string; // recurso FHIR planificado que originó la línea
}

export interface RegistrarPagoDto {
  patientId: string;
  presupuestoId?: string;
  tipo?: string; // senha | cuota | pago_directo (default: pago_directo)
  monto: number;
  metodoPago?: string; // default: efectivo
  fechaPago?: Date;
  comprobante?: string;
  notas?: string;
}

export interface AnularPagoDto {
  motivo: string;
}

export interface CreateGastoDto {
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Estados que DEVENGAN deuda. Definicion unica para todo el modulo.
 * - `borrador`  : nunca se presento al paciente, no es dinero exigible.
 * - `cancelado` : quedo sin efecto.
 * - `presentado`: presentado pero no aceptado; todavia no es un compromiso.
 * - `pagado`    : se incluye porque su saldo es 0 y mantiene coherentes los totales.
 */
const ESTADOS_DEVENGAN_DEUDA = ['aceptado', 'en_curso', 'vencido', 'pagado'];

@Injectable()
export class ClinicaFinanzasService {
  private readonly logger = new Logger(ClinicaFinanzasService.name);

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
    @InjectRepository(PatientEntity)
    private patientRepo: Repository<PatientEntity>,
  ) {}

  // ========== NOMENCLADOR ==========

  async getNomenclador(tenantId: string): Promise<ClinicalPrecio[]> {
    return this.precioRepo.find({
      where: { tenantId, active: true },
      order: { snomedDisplay: 'ASC' },
    });
  }

  async upsertPrecio(
    tenantId: string,
    dto: CreatePrecioDto,
  ): Promise<ClinicalPrecio> {
    const existing = await this.precioRepo.findOne({
      where: { tenantId, snomedCode: dto.snomedCode },
    });
    if (existing) {
      existing.precio = dto.precio;
      existing.snomedDisplay = dto.snomedDisplay;
      return this.precioRepo.save(existing);
    }
    return this.precioRepo.save(this.precioRepo.create({ ...dto, tenantId }));
  }

  async updatePrecio(
    tenantId: string,
    id: string,
    dto: UpdatePrecioDto,
  ): Promise<ClinicalPrecio> {
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

  async getPresupuestos(
    tenantId: string,
    filters?: { patientId?: string; estado?: string },
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.estado) where.estado = filters.estado;
    const presupuestos = await this.presupuestoRepo.find({
      where,
      relations: { items: true, pagos: true },
      order: { createdAt: 'DESC' },
    });
    return this.enrichWithPatientIdentity(tenantId, presupuestos);
  }

  async getPresupuesto(tenantId: string, id: string): Promise<any> {
    const p = await this.presupuestoRepo.findOne({
      where: { id, tenantId },
      relations: { items: true, pagos: true },
    });
    if (!p) throw new NotFoundException('Presupuesto no encontrado');
    const [enriched] = await this.enrichWithPatientIdentity(tenantId, [p]);
    return enriched;
  }

  async createPresupuesto(
    tenantId: string,
    dto: CreatePresupuestoDto,
    userId: string,
  ): Promise<ClinicalPresupuesto> {
    if (!dto.patientId || !UUID_RE.test(dto.patientId)) {
      throw new BadRequestException(
        'Selecciona un paciente valido antes de guardar el presupuesto',
      );
    }
    await this.assertPatientBelongsToTenant(tenantId, dto.patientId);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'El presupuesto debe tener al menos un item',
      );
    }

    const subtotal = dto.items.reduce(
      (s, i) => s + i.precioUnitario * (i.cantidad || 1),
      0,
    );
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
      rxPresentadas: dto.rxPresentadas ?? null,
      obraSocial: dto.obraSocial ?? null,
      cantidadCuotas: dto.cantidadCuotas ?? null,
      fechaPresentacion: dto.fechaPresentacion
        ? new Date(dto.fechaPresentacion)
        : null,
      fechaLiquidacion: dto.fechaLiquidacion
        ? new Date(dto.fechaLiquidacion)
        : null,
      createdBy: userId,
    });

    const saved = await this.presupuestoRepo.save(presupuesto);

    const items = dto.items.map((item, i) =>
      this.presupuestoItemRepo.create({
        presupuestoId: saved.id,
        tenantId,
        snomedCode: item.snomedCode,
        snomedDisplay: item.snomedDisplay,
        codigoNomenclador: item.codigoNomenclador ?? null,
        diente: item.diente,
        cara: item.cara,
        detalle: item.detalle ?? null,
        sourceResourceId: item.sourceResourceId ?? null,
        cantidad: item.cantidad || 1,
        precioUnitario: item.precioUnitario,
        subtotal: item.precioUnitario * (item.cantidad || 1),
        orden: item.orden ?? i,
      }),
    );
    await this.presupuestoItemRepo.save(items);

    return this.getPresupuesto(tenantId, saved.id);
  }

  async updatePresupuesto(
    tenantId: string,
    id: string,
    dto: Partial<CreatePresupuestoDto>,
    userId: string,
  ): Promise<ClinicalPresupuesto> {
    const presupuesto = await this.presupuestoRepo.findOne({
      where: { id, tenantId },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    // DEC-4: documento vivo → editable mientras esté abierto; solo 'cancelado' bloquea.
    if (presupuesto.estado === 'cancelado') {
      throw new ForbiddenException(
        'No se puede editar un presupuesto cancelado',
      );
    }

    if (dto.items) {
      if (dto.items.length === 0)
        throw new BadRequestException('Debe haber al menos un item');
      await this.presupuestoItemRepo.delete({ presupuestoId: id });
      const items = dto.items.map((item, i) =>
        this.presupuestoItemRepo.create({
          presupuestoId: id,
          tenantId,
          snomedCode: item.snomedCode,
          snomedDisplay: item.snomedDisplay,
          codigoNomenclador: item.codigoNomenclador ?? null,
          diente: item.diente,
          cara: item.cara,
          detalle: item.detalle ?? null,
          sourceResourceId: item.sourceResourceId ?? null,
          cantidad: item.cantidad || 1,
          precioUnitario: item.precioUnitario,
          subtotal: item.precioUnitario * (item.cantidad || 1),
          orden: item.orden ?? i,
        }),
      );
      await this.presupuestoItemRepo.save(items);

      const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
      presupuesto.subtotal = subtotal;
      presupuesto.total = Math.max(
        0,
        subtotal - (dto.descuento ?? presupuesto.descuento),
      );
    }

    if (dto.descuento !== undefined) {
      presupuesto.descuento = dto.descuento;
      presupuesto.total = Math.max(0, presupuesto.subtotal - dto.descuento);
    }
    if (dto.senhaPorcentaje !== undefined) {
      presupuesto.senhaPorcentaje = dto.senhaPorcentaje;
    }
    // Cabecera contable odontológica (aditiva, opcional)
    if (dto.rxPresentadas !== undefined)
      presupuesto.rxPresentadas = dto.rxPresentadas;
    if (dto.obraSocial !== undefined) presupuesto.obraSocial = dto.obraSocial;
    if (dto.cantidadCuotas !== undefined)
      presupuesto.cantidadCuotas = dto.cantidadCuotas;
    if (dto.fechaPresentacion !== undefined)
      presupuesto.fechaPresentacion = dto.fechaPresentacion
        ? new Date(dto.fechaPresentacion)
        : null;
    if (dto.fechaLiquidacion !== undefined)
      presupuesto.fechaLiquidacion = dto.fechaLiquidacion
        ? new Date(dto.fechaLiquidacion)
        : null;
    presupuesto.senhaMonto =
      presupuesto.total * (presupuesto.senhaPorcentaje / 100);

    await this.presupuestoRepo.save(presupuesto);
    // DEC-4: si cambió el total, re-derivar el estado desde los pagos (ej: pagado→en_curso al agregar líneas).
    await this.recalcularEstadoPresupuesto(tenantId, id);
    return this.getPresupuesto(tenantId, id);
  }

  async transicionarEstado(
    tenantId: string,
    id: string,
    nuevoEstado: string,
    userId?: string,
  ): Promise<ClinicalPresupuesto> {
    const presupuesto = await this.presupuestoRepo.findOne({
      where: { id, tenantId },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    const permitidos = ESTADOS_VALIDOS[presupuesto.estado];
    if (!permitidos || !permitidos.includes(nuevoEstado)) {
      throw new BadRequestException(
        `Transicion de '${presupuesto.estado}' a '${nuevoEstado}' no permitida`,
      );
    }

    if (nuevoEstado === 'aceptado') {
      presupuesto.fechaAceptacion = new Date();
    }

    presupuesto.estado = nuevoEstado;
    await this.presupuestoRepo.save(presupuesto);
    return this.getPresupuesto(tenantId, id);
  }

  async deletePresupuesto(tenantId: string, id: string): Promise<void> {
    const presupuesto = await this.presupuestoRepo.findOne({
      where: { id, tenantId },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    if (presupuesto.estado !== 'borrador') {
      throw new ForbiddenException(
        'Solo se puede eliminar un presupuesto en estado borrador',
      );
    }
    // Defensa en profundidad: un borrador no debería tener pagos (registrarPago lo impide), pero
    // si por datos legacy los tuviera, no lo borramos para no dejar pagos huérfanos.
    const pagosVinculados = await this.pagoRepo.count({
      where: { presupuestoId: id },
    });
    if (pagosVinculados > 0) {
      throw new ForbiddenException(
        'No se puede eliminar un presupuesto con pagos registrados',
      );
    }
    await this.presupuestoRepo.remove(presupuesto);
  }

  // ========== PAGOS ==========

  async getPagos(
    tenantId: string,
    filters?: { patientId?: string; presupuestoId?: string },
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.presupuestoId) where.presupuestoId = filters.presupuestoId;
    const pagos = await this.pagoRepo.find({
      where,
      order: { fechaPago: 'DESC' },
    });
    return this.enrichWithPatientIdentity(tenantId, pagos);
  }

  async registrarPago(
    tenantId: string,
    dto: RegistrarPagoDto,
    userId: string,
  ): Promise<ClinicalPago> {
    if (!dto.patientId || !UUID_RE.test(dto.patientId)) {
      throw new BadRequestException(
        'Selecciona un paciente valido antes de registrar el pago',
      );
    }
    await this.assertPatientBelongsToTenant(tenantId, dto.patientId);

    // Importe válido (CA-16): el DTO es interface (por el ValidationPipe), se valida a mano.
    const monto = Number(dto.monto);
    if (dto.monto == null || !Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('El importe debe ser mayor a cero');
    }
    const fechaPago = dto.fechaPago ? new Date(dto.fechaPago) : new Date();
    if (Number.isNaN(fechaPago.getTime())) {
      throw new BadRequestException('La fecha del pago no es valida');
    }
    const finDeHoy = new Date();
    finDeHoy.setHours(23, 59, 59, 999);
    if (fechaPago > finDeHoy) {
      throw new BadRequestException('La fecha del pago no puede ser futura');
    }
    // DEC-1: se cobra en cualquier estado ≠ cancelado; el estado se DERIVA de los pagos.
    // Se preserva la validación cross-tenant (where incluye tenantId) y el NotFound.
    if (dto.presupuestoId) {
      const presupuesto = await this.presupuestoRepo.findOne({
        where: { id: dto.presupuestoId, tenantId },
      });
      if (!presupuesto)
        throw new NotFoundException('Presupuesto no encontrado');
      if (presupuesto.estado === 'cancelado') {
        throw new BadRequestException(
          'No se pueden registrar pagos sobre un presupuesto cancelado.',
        );
      }
      // No se puede cobrar mas que el saldo pendiente. Sin esto, el excedente
      // resta en deudaActual del paciente y ENMASCARA la deuda de otros
      // presupuestos: un moroso aparece al dia.
      const yaPagado = await this.sumarPagosVigentes(
        tenantId,
        dto.presupuestoId,
      );
      const saldoPendiente = Number(presupuesto.total) - yaPagado;
      // Tolerancia de medio centavo: los importes son NUMERIC(12,2) y la suma se
      // hace en punto flotante, asi que un pago que salda exacto podria quedar
      // apenas por encima del saldo y ser rechazado sin motivo real.
      if (monto > saldoPendiente + 0.005) {
        throw new BadRequestException(
          `El importe supera el saldo pendiente del presupuesto (saldo: $${saldoPendiente.toFixed(2)})`,
        );
      }
    }
    const pago = this.pagoRepo.create({
      tenantId,
      patientId: dto.patientId,
      presupuestoId: dto.presupuestoId || null,
      tipo: dto.tipo || 'pago_directo',
      monto,
      metodoPago: dto.metodoPago || 'efectivo',
      fechaPago,
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

  /**
   * Anula un pago (soft-delete): no lo borra, lo marca con motivo + autoría para la traza contable.
   * Un pago anulado deja de contar en el saldo → recalcula el estado del presupuesto (puede BAJAR).
   * Roles: administrador/médico (recepcionista NO revierte su propio cobro).
   */
  async anularPago(
    tenantId: string,
    id: string,
    dto: AnularPagoDto,
    userId: string,
  ): Promise<ClinicalPago> {
    if (!dto?.motivo || !dto.motivo.trim()) {
      throw new BadRequestException('El motivo de anulación es obligatorio');
    }
    // El tenantId en el where cierra el cross-tenant (no se anula un pago de otra clínica).
    const pago = await this.pagoRepo.findOne({ where: { id, tenantId } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (pago.anuladoAt) throw new BadRequestException('El pago ya fue anulado');

    pago.anuladoAt = new Date();
    pago.anuladoPor = userId;
    pago.motivoAnulacion = dto.motivo.trim();
    const saved = await this.pagoRepo.save(pago);

    // Traza de la acción sensible en el pipeline de logs (sin nueva tabla; la fila ya es auditable).
    this.logger.warn(
      `ANULACION_PAGO tenant=${tenantId} pago=${id} monto=${pago.monto} por=${userId} motivo="${pago.motivoAnulacion}"`,
    );

    if (pago.presupuestoId) {
      await this.recalcularEstadoPresupuesto(tenantId, pago.presupuestoId);
    }
    return saved;
  }

  // ========== GASTOS ==========

  async getGastos(
    tenantId: string,
    filters?: { categoria?: string; desde?: Date; hasta?: Date },
  ): Promise<ClinicalGasto[]> {
    const where: any = { tenantId };
    if (filters?.categoria) where.categoria = filters.categoria;
    if (filters?.desde && filters?.hasta) {
      where.fechaGasto = Between(filters.desde, filters.hasta);
    }
    return this.gastoRepo.find({ where, order: { fechaGasto: 'DESC' } });
  }

  async registrarGasto(
    tenantId: string,
    dto: CreateGastoDto,
    userId: string,
  ): Promise<ClinicalGasto> {
    // El spread va PRIMERO y el tenantId del JWT despues, para que un
    // tenantId inyectado en el body no pueda pisarlo (AUD.12). CreateGastoDto
    // es una `interface`, de modo que el ValidationPipe no filtra el body:
    // este orden es la unica defensa. Mismo patron que createPrecio.
    const gasto = this.gastoRepo.create({
      ...dto,
      tenantId,
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

    // Cobrado hoy (excluye pagos anulados)
    const pagosHoy = await this.pagoRepo.find({
      where: {
        tenantId,
        fechaPago: Between(hoy, new Date()),
        anuladoAt: IsNull(),
      },
    });
    const cobradoHoy = pagosHoy.reduce((s, p) => s + Number(p.monto), 0);

    // Cobrado este mes (excluye pagos anulados)
    const pagosMes = await this.pagoRepo.find({
      where: {
        tenantId,
        fechaPago: Between(inicioMes, new Date()),
        anuladoAt: IsNull(),
      },
    });
    const cobradoMes = pagosMes.reduce((s, p) => s + Number(p.monto), 0);

    // Gastos este mes
    const gastosMes = await this.gastoRepo.find({
      where: { tenantId, fechaGasto: Between(inicioMes, new Date()) },
    });
    const gastosTotal = gastosMes.reduce((s, g) => s + Number(g.monto), 0);

    // Deuda total — misma definicion que la cuenta corriente del paciente
    // (ESTADOS_DEVENGAN_DEUDA + clamp por presupuesto), para que las dos
    // pantallas no puedan mostrar numeros distintos sobre los mismos datos.
    // Incluye 'vencido': es deuda, y ademas la que mas importa.
    const presupuestos = await this.presupuestoRepo.find({
      where: { tenantId, estado: In(ESTADOS_DEVENGAN_DEUDA) },
    });
    const presupuestoIds = presupuestos.map((p) => p.id);
    const pagosVinculados =
      presupuestoIds.length > 0
        ? await this.pagoRepo.find({
            where: {
              tenantId,
              presupuestoId: In(presupuestoIds),
              anuladoAt: IsNull(),
            },
          })
        : [];
    const pagoPorPresupuesto: Record<string, number> = {};
    for (const p of pagosVinculados) {
      if (p.presupuestoId) {
        pagoPorPresupuesto[p.presupuestoId] =
          (pagoPorPresupuesto[p.presupuestoId] || 0) + Number(p.monto);
      }
    }
    const deudaTotal = presupuestos.reduce(
      (s, p) =>
        s +
        this.saldoDePresupuesto(Number(p.total), pagoPorPresupuesto[p.id] || 0)
          .saldo,
      0,
    );

    // Pacientes morosos: PACIENTES distintos con al menos un presupuesto vencido.
    // Antes contaba presupuestos, asi que un paciente con 3 vencidos figuraba
    // como 3 morosos.
    const morosos = await this.presupuestoRepo
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.patient_id)', 'total')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.estado = :estado', { estado: 'vencido' })
      .getRawOne<{ total: string }>();
    const vencidos = Number(morosos?.total ?? 0);

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
    if (!patientId || !UUID_RE.test(patientId)) {
      throw new BadRequestException(
        'Selecciona un paciente valido para consultar la cuenta corriente',
      );
    }

    const presupuestos = await this.presupuestoRepo.find({
      where: { tenantId, patientId },
      relations: { items: true, pagos: true },
      order: { createdAt: 'DESC' },
    });

    // Los totales recorren TODO el historial, porque acompañan a la lista que se
    // muestra. La deuda, en cambio, solo suma los estados que devengan y se
    // clampea por presupuesto: por eso `deudaActual` NO es totalPresupuestado -
    // totalPagado, y no debe calcularse asi.
    let totalPresupuestado = 0;
    let totalPagado = 0;
    let deudaActual = 0;
    let excedentePagado = 0;

    const presupuestosDetalle = presupuestos.map((p) => {
      // Los pagos vienen por relación → se excluyen los anulados en memoria (no por where).
      const pagosPresupuesto = (p.pagos || [])
        .filter((pg) => !pg.anuladoAt)
        .reduce((s, pg) => s + Number(pg.monto), 0);
      const total = Number(p.total);
      const { saldo, excedente } = this.saldoDePresupuesto(
        total,
        pagosPresupuesto,
      );

      totalPresupuestado += total;
      totalPagado += pagosPresupuesto;
      if (ESTADOS_DEVENGAN_DEUDA.includes(p.estado)) {
        deudaActual += saldo;
        excedentePagado += excedente;
      }

      return {
        id: p.id,
        numero: p.numero,
        fecha: p.fechaEmision,
        total,
        pagado: pagosPresupuesto,
        saldo,
        excedente,
        estado: p.estado,
      };
    });

    return {
      patientId,
      totalPresupuestado,
      totalPagado,
      deudaActual,
      // Dinero cobrado por encima del total de sus presupuestos. Deberia ser 0;
      // si no lo es, hay un sobrepago historico que la clinica debe revisar.
      excedentePagado,
      presupuestos: presupuestosDetalle,
    };
  }

  async getReporte(tenantId: string, desde: Date, hasta: Date): Promise<any> {
    const pagos = await this.pagoRepo.find({
      where: {
        tenantId,
        fechaPago: Between(desde, hasta),
        anuladoAt: IsNull(),
      },
    });
    const gastos = await this.gastoRepo.find({
      where: { tenantId, fechaGasto: Between(desde, hasta) },
    });
    const ingresos = pagos.reduce((s, p) => s + Number(p.monto), 0);
    const egresos = gastos.reduce((s, g) => s + Number(g.monto), 0);

    const pagosPorMetodo: Record<string, number> = {};
    for (const p of pagos) {
      pagosPorMetodo[p.metodoPago] =
        (pagosPorMetodo[p.metodoPago] || 0) + Number(p.monto);
    }

    const gastosPorCategoria: Record<string, number> = {};
    for (const g of gastos) {
      gastosPorCategoria[g.categoria] =
        (gastosPorCategoria[g.categoria] || 0) + Number(g.monto);
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

  private async assertPatientBelongsToTenant(
    tenantId: string,
    patientId: string,
  ): Promise<void> {
    const exists = await this.patientRepo.exists({
      where: { id: patientId, tenantId },
    });
    if (!exists) {
      throw new NotFoundException('Paciente no encontrado en tu consultorio');
    }
  }

  private async enrichWithPatientIdentity<T extends { patientId?: string }>(
    tenantId: string,
    rows: T[],
  ): Promise<any[]> {
    const patientIds = [
      ...new Set(rows.map((row) => row.patientId).filter(Boolean)),
    ] as string[];
    if (patientIds.length === 0) return rows;

    const patients = await this.patientRepo.find({
      where: { id: In(patientIds), tenantId },
    });
    const patientById = new Map(
      patients.map((patient) => [
        patient.id,
        {
          patientDisplay: `${patient.givenName} ${patient.familyName}`.trim(),
          patientDni: patient.dni,
        },
      ]),
    );

    return rows.map((row) => ({
      ...row,
      ...(row.patientId ? patientById.get(row.patientId) : undefined),
    }));
  }

  /**
   * Deriva el estado del presupuesto a partir de sus pagos VIGENTES (DEC-1). Vía interna privilegiada
   * (no pasa por ESTADOS_VALIDOS): permite borrador→en_curso por pago, y BAJA al anular pagos.
   * 'cancelado' es terminal-manual y no se deriva.
   */
  private async recalcularEstadoPresupuesto(
    tenantId: string,
    presupuestoId: string,
  ): Promise<void> {
    const presupuesto = await this.presupuestoRepo.findOne({
      where: { id: presupuestoId, tenantId },
    });
    if (!presupuesto) return;
    if (presupuesto.estado === 'cancelado') return;

    // Σ SOLO de pagos vigentes (excluye anulados) → es lo que hace que anular baje el estado.
    const totalPagado = await this.sumarPagosVigentes(tenantId, presupuestoId);
    const total = Number(presupuesto.total);

    // Piso al quedar en 0 (DEC-3): fue aceptado → 'aceptado'; fue presentado → 'presentado'; si no → 'borrador'.
    const estadoBase = presupuesto.fechaAceptacion
      ? 'aceptado'
      : presupuesto.fechaPresentacion
        ? 'presentado'
        : 'borrador';

    let nuevoEstado: string;
    if (totalPagado <= 0) {
      nuevoEstado = estadoBase; // BAJA: se anularon todos los pagos
    } else if (totalPagado >= total) {
      nuevoEstado = 'pagado';
    } else {
      nuevoEstado = 'en_curso'; // 0 < Σ < total (incluye borrador/presentado → en_curso)
    }

    // Vencido: solo si no está pagado y la validez pasó (regla preservada).
    if (
      presupuesto.fechaValidez &&
      new Date(presupuesto.fechaValidez) < new Date() &&
      nuevoEstado !== 'pagado'
    ) {
      nuevoEstado = 'vencido';
    }

    if (nuevoEstado !== presupuesto.estado) {
      presupuesto.estado = nuevoEstado;
      await this.presupuestoRepo.save(presupuesto);
    }
  }

  /**
   * Definicion canonica del saldo de UN presupuesto. Unico lugar donde se decide
   * que es deuda y que es dinero cobrado de mas.
   *
   * La deuda nunca puede ser negativa: si se cobro de mas, ese excedente NO debe
   * restar de la deuda de otros presupuestos (haria que un moroso figure al dia).
   * Se devuelve aparte como `excedente` para que quede VISIBLE en vez de oculto:
   * un excedente > 0 es una anomalia que la clinica tiene que poder ver.
   */
  private saldoDePresupuesto(
    total: number,
    pagado: number,
  ): { saldo: number; excedente: number } {
    const diferencia = total - pagado;
    return {
      saldo: Math.max(0, diferencia),
      excedente: Math.max(0, -diferencia),
    };
  }

  /**
   * Σ de los pagos VIGENTES (no anulados) de un presupuesto.
   * Unico punto donde se suma lo cobrado: lo usan el recalculo de estado (DEC-1)
   * y la validacion de sobrepago, para que no puedan divergir.
   * El filtro por tenantId es defensa en profundidad — el presupuestoId ya viene
   * validado contra el tenant, pero la invariante "toda query lleva tenantId" es
   * lo que hace auditable el aislamiento multi-inquilino.
   */
  private async sumarPagosVigentes(
    tenantId: string,
    presupuestoId: string,
  ): Promise<number> {
    const pagos = await this.pagoRepo.find({
      where: { tenantId, presupuestoId, anuladoAt: IsNull() },
    });
    return pagos.reduce((s, p) => s + Number(p.monto), 0);
  }

  private async generarNumeroPresupuesto(tenantId: string): Promise<string> {
    const count = await this.presupuestoRepo.count({ where: { tenantId } });
    return `PRES-${String(count + 1).padStart(4, '0')}`;
  }
}
