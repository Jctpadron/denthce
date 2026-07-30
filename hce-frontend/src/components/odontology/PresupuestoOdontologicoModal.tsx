import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Plus, Trash2, FileText, Wallet, ClipboardList, Loader2, CheckCircle, AlertCircle, HelpCircle, PenLine, Eye, Paperclip } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SignaturePadModal } from './SignaturePadModal';
import { ClinicalAttachments } from './ClinicalAttachments';

/**
 * Modal de Plan de Tratamiento / Presupuesto odontológico.
 * Digitaliza el formulario PAMI de papel (Presupuesto + Estado contable + Ficha de atención)
 * REUSANDO el presupuesto del módulo Finanzas (`clinica/finanzas/presupuesto`). Se abre desde
 * el odontograma en modo Plan y auto-carga las líneas desde los tratamientos planificados.
 * Diseño: docs/design/modal-presupuesto-odontologico.md
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const authHeaders = () => ({ Authorization: `Bearer ${keycloak.token}` });
const MONEY = (n: number) => `$${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isValidPatientId = (value?: string | null) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

interface PlannedResource {
  id: string;
  resourceType?: string;
  code?: { text?: string; coding?: { code?: string }[] };
  bodySite?: { coding?: { code?: string }[] };
}

interface RealizadoResource extends PlannedResource {
  status?: string;
  performedDateTime?: string;
  meta?: { lastUpdated?: string };
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

interface Linea {
  uid: string;
  sourceResourceId?: string;
  codigoNomenclador: string;
  snomedCode: string;
  snomedDisplay: string;
  cantidad: number;
  precioUnitario: number;
  detalle: string;
  diente?: string;
  cara?: string;
  fromDraft?: boolean; // true = vino de un borrador guardado → NO auto-pisar su importe
  precioEditado?: boolean; // true = el usuario tipeó el importe a mano → NO auto-pisar
}

// Límites de columna en la BD (evita 500 "value too long")
const MAX = { codigo: 50, prestacion: 255, detalle: 255, obraSocial: 255 };

interface PagoRow {
  id: string;
  monto: number | string;
  fechaPago?: string;
  tipo?: string;
  metodoPago?: string;
  comprobante?: string;
  notas?: string;
  anuladoAt?: string | null;
}

interface Firma {
  id: string;
  resourceId: string;
  encounterId: string | null;
  signedAt: string;
  contentHash: string;
  capturedByName: string | null;
  imageUrl: string;
  snapshot?: unknown;
}


interface Props {
  patientId: string;
  plannedResources: PlannedResource[];
  realizadoResources?: RealizadoResource[];
  onClose: () => void;
  onSaved?: () => void;
}

type Tab = 'presupuesto' | 'contable' | 'ficha';

const detalleDe = (r: PlannedResource): string => {
  const pieza = r.bodySite?.coding?.[0]?.code;
  const cara = r.bodySite?.coding?.[1]?.code;
  if (!pieza) return '';
  return `Pieza ${pieza}${cara && cara !== 'all' ? ` · cara ${cara}` : ''}`;
};

// Mapea un tratamiento planificado del odontograma a una línea de presupuesto,
// preservando pieza/cara ESTRUCTURADAS (columnas diente/cara), no solo como texto.
const lineaFromPlanned = (r: PlannedResource): Linea => {
  const pieza = r.bodySite?.coding?.[0]?.code;
  const cara = r.bodySite?.coding?.[1]?.code;
  return {
    uid: uid(),
    sourceResourceId: r.id,
    codigoNomenclador: '',
    snomedCode: r.code?.coding?.[0]?.code || 'GENERAL',
    snomedDisplay: r.code?.text || 'Intervención',
    cantidad: 1,
    precioUnitario: 0,
    detalle: detalleDe(r),
    diente: pieza || undefined,
    cara: cara && cara !== 'all' ? cara : undefined,
  };
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
  color: 'var(--color-text)', fontSize: '0.85rem', minWidth: 0, boxSizing: 'border-box',
};

const btnGhost: React.CSSProperties = {
  padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-primary)',
  background: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem',
};

// Layout de la tabla responsive de líneas (desktop ≥768px):
// Cód. Nomenclador | Prestación | Cant. | Importe unit. | Subtotal | Detalle | (borrar)
const GRID_COLS = '0.9fr 1.6fr 0.5fr 0.9fr 0.9fr 1.2fr auto';
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.2rem' };
const headerCellStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' };
// Oculta visualmente el label pero lo deja accesible para lectores de pantalla (desktop:
// el encabezado de columna hace de etiqueta visible, pero cada input conserva su <label>).
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

export const PresupuestoOdontologicoModal: React.FC<Props> = ({
  patientId, plannedResources, realizadoResources = [], onClose, onSaved,
}) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('presupuesto');
  const [lineas, setLineas] = useState<Linea[]>(() => plannedResources.map(lineaFromPlanned));
  const [rxPresentadas, setRxPresentadas] = useState('');
  const [obraSocial, setObraSocial] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState('');
  const [fechaPresentacion, setFechaPresentacion] = useState('');
  const [fechaLiquidacion, setFechaLiquidacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [presupuestoId, setPresupuestoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Estado contable (A): resumen persistido + pagos + registrar pago ──
  const [estado, setEstado] = useState<string>('borrador');
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [ccResumen, setCcResumen] = useState<{ total: number; pagado: number; saldo: number } | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoConcepto, setPagoConcepto] = useState('');
  const [pagoFecha, setPagoFecha] = useState('');
  const [pagoSaving, setPagoSaving] = useState(false);
  const [contableMsg, setContableMsg] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const montoInputRef = useRef<HTMLInputElement | null>(null);

  // ── Firma de conformidad del paciente por prestación (C) ──
  const [firmas, setFirmas] = useState<Record<string, Firma>>({});
  const [firmandoResourceId, setFirmandoResourceId] = useState<string | null>(null);
  const [firmaSaving, setFirmaSaving] = useState(false);
  const firmasLoaded = useRef(false);

  // Al abrir la Ficha, trae en 1 request TODAS las firmas vigentes del paciente (batch, no N).
  useEffect(() => {
    if (tab !== 'ficha' || firmasLoaded.current || realizadoResources.length === 0) return;
    firmasLoaded.current = true;
    (async () => {
      try {
        const sigResp = await axios.get(`${API_URL}/odontology/patient/${patientId}/signatures`, { headers: authHeaders() });
        const fmap: Record<string, Firma> = {};
        (Array.isArray(sigResp.data) ? sigResp.data : []).forEach((s: Firma) => { if (s.resourceId) fmap[s.resourceId] = s; });
        setFirmas(fmap);
      } catch { /* si falla, la Ficha se muestra sin firmas precargadas */ }
    })();
  }, [tab, realizadoResources, patientId]);

  const capturarFirma = async (png: Blob) => {
    if (!firmandoResourceId) return;
    setFirmaSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', png, 'firma.png');
      fd.append('deviceInfo', navigator.userAgent.slice(0, 120));
      const resp = await axios.post(`${API_URL}/odontology/patient/${patientId}/resource/${firmandoResourceId}/signature`, fd, { headers: authHeaders() });
      setFirmas((f) => ({ ...f, [firmandoResourceId]: resp.data }));
      setFirmandoResourceId(null);
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setError(msg || 'No se pudo registrar la firma.');
    } finally {
      setFirmaSaving(false);
    }
  };

  // Abre el PNG de la firma (endpoint autenticado) en una pestaña nueva.
  const verFirma = async (sig: Firma) => {
    try {
      const resp = await axios.get(`${API_URL}${sig.imageUrl}`, { headers: authHeaders(), responseType: 'blob' });
      window.open(URL.createObjectURL(resp.data), '_blank');
    } catch { /* noop */ }
  };

  // Celda "Firma de conformidad" de la Ficha: firmado (con Ver) o botón para capturar.
  const firmaCell = (resourceId: string) => {
    const sig = firmas[resourceId];
    if (sig) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
          <CheckCircle size={13} /> Firmado
          <button type="button" onClick={() => verFirma(sig)} title="Ver firma del paciente" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32, padding: 0 }}><Eye size={14} /></button>
        </span>
      );
    }
    return (
      <button type="button" onClick={() => setFirmandoResourceId(resourceId)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.7rem', borderRadius: '7px', border: '1px solid var(--color-primary)', background: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.7rem', minHeight: 36 }}>
        <PenLine size={13} /> Capturar firma
      </button>
    );
  };

  // Trae el resumen persistido (cuenta corriente) y los pagos del presupuesto abierto.
  const refreshContable = async (pid: string) => {
    if (!isValidPatientId(patientId)) return;
    try {
      const [cc, pg] = await Promise.all([
        axios.get(`${API_URL}/clinica/finanzas/cuenta-corriente/${patientId}`, { headers: authHeaders() }),
        axios.get(`${API_URL}/clinica/finanzas/pago?presupuestoId=${pid}`, { headers: authHeaders() }),
      ]);
      const dets = cc.data?.presupuestos || [];
      const det = dets.find((p: { id?: string }) => p.id === pid);
      if (det) setCcResumen({ total: Number(det.total) || 0, pagado: Number(det.pagado) || 0, saldo: Number(det.saldo) || 0 });
      setPagos(Array.isArray(pg.data) ? pg.data : (pg.data?.data || []));
    } catch { /* si falla, la pestaña muestra el total local sin pagos */ }
  };

  // Al abrir: si el paciente YA tiene un presupuesto en borrador, lo cargamos para editar
  // (evita duplicados y muestra lo guardado). Si no, se queda con el auto-cargado del plan.
  useEffect(() => {
    (async () => {
      if (!isValidPatientId(patientId)) {
        setError('Selecciona un paciente valido para armar el presupuesto.');
        setLoading(false);
        return;
      }

      try {
        // 1) Nomenclador de PRECIOS (snomedCode → precio) para auto-proponer importes.
        const precios: Record<string, number> = {};
        try {
          const rn = await axios.get(`${API_URL}/clinica/finanzas/nomenclador`, { headers: authHeaders() });
          const an = Array.isArray(rn.data) ? rn.data : (rn.data?.data || []);
          for (const p of an) {
            const code = p?.snomedCode; const precio = Number(p?.precio);
            if (code && Number.isFinite(precio) && precio > 0) precios[code] = precio;
          }
        } catch { /* sin nomenclador → el importe queda manual */ }
        // Aplica el precio sugerido a una línea del plan (no pisa borrador ni precio ya cargado).
        const conPrecio = (l: Linea): Linea =>
          (!l.fromDraft && !(Number(l.precioUnitario) > 0) && precios[l.snomedCode] > 0)
            ? { ...l, precioUnitario: precios[l.snomedCode] } : l;

        // 2) Presupuesto ABIERTO del paciente (documento vivo, DEC-4): editar en vez de duplicar.
        // Continúa el más reciente no cancelado (incluso 'pagado': agregar un tratamiento lo reabre).
        const r = await axios.get(`${API_URL}/clinica/finanzas/presupuesto`, { headers: authHeaders() });
        const arr = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        const borradores = arr.filter((p: { patientId?: string; estado?: string }) => p.patientId === patientId && p.estado !== 'cancelado');
        if (borradores.length > 0) {
          const reciente = borradores.sort((a: { fechaEmision?: string; createdAt?: string }, b: { fechaEmision?: string; createdAt?: string }) =>
            (b.fechaEmision || b.createdAt || '').localeCompare(a.fechaEmision || a.createdAt || ''))[0];
          const full = (await axios.get(`${API_URL}/clinica/finanzas/presupuesto/${reciente.id}`, { headers: authHeaders() })).data;
          setPresupuestoId(full.id);
          const existentes: Linea[] = Array.isArray(full.items) ? full.items.map((it: Record<string, unknown>) => ({
            uid: uid(),
            sourceResourceId: (it.sourceResourceId as string) || undefined,
            codigoNomenclador: (it.codigoNomenclador as string) || '',
            snomedCode: (it.snomedCode as string) || 'GENERAL',
            snomedDisplay: (it.snomedDisplay as string) || '',
            cantidad: Number(it.cantidad) || 1,
            precioUnitario: Number(it.precioUnitario) || 0,
            detalle: (it.detalle as string) || '',
            diente: (it.diente as string) || undefined,
            cara: (it.cara as string) || undefined,
            fromDraft: true,
          })) : [];
          // #5: incorporar los planificados que aún NO están en el presupuesto (por sourceResourceId), con su precio sugerido.
          const yaPresupuestados = new Set(existentes.map((l) => l.sourceResourceId).filter(Boolean));
          const nuevosDelPlan = plannedResources.filter((rp) => !yaPresupuestados.has(rp.id)).map(lineaFromPlanned).map(conPrecio);
          setLineas([...existentes, ...nuevosDelPlan]);
          setRxPresentadas(full.rxPresentadas != null ? String(full.rxPresentadas) : '');
          setObraSocial(full.obraSocial || '');
          setCantidadCuotas(full.cantidadCuotas != null ? String(full.cantidadCuotas) : '');
          setFechaPresentacion((full.fechaPresentacion || '').slice(0, 10));
          setFechaLiquidacion((full.fechaLiquidacion || '').slice(0, 10));
          setEstado(full.estado || 'borrador');
          await refreshContable(full.id);
        } else {
          // Sin borrador: aplicamos los precios sugeridos al plan auto-cargado.
          setLineas((ls) => ls.map(conPrecio));
        }
      } catch { /* si falla la carga, se queda con el auto-cargado del plan (POST nuevo) */ }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () => lineas.reduce((s, l) => s + (Number(l.precioUnitario) || 0) * (Number(l.cantidad) || 1), 0),
    [lineas],
  );

  const setLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLinea = () =>
    setLineas((ls) => [...ls, { uid: uid(), codigoNomenclador: '', snomedCode: 'GENERAL', snomedDisplay: '', cantidad: 1, precioUnitario: 0, detalle: '' }]);
  const delLinea = (i: number) => setLineas((ls) => ls.filter((_, idx) => idx !== i));

  const guardar = async () => {
    if (!isValidPatientId(patientId)) {
      setError('Selecciona un paciente valido antes de guardar el presupuesto.');
      return;
    }

    // Se presupuestan SOLO las líneas con importe > 0. Las líneas del plan sin precio (importe 0)
    // NO bloquean el guardado: quedan visibles en pantalla para completarlas después.
    const conNombre = lineas.filter((l) => (l.snomedDisplay || '').trim());
    const items = conNombre.filter((l) => Number(l.precioUnitario) > 0 && Number(l.cantidad) >= 1);
    if (items.length === 0) { setError('Poné importe (mayor a 0) al menos a una prestación para guardar.'); return; }
    const sinPrecio = conNombre.length - items.length;
    // (qa) Una línea GUARDADA puesta en $0 se ELIMINA del presupuesto persistido al guardar
    // (updatePresupuesto reemplaza items). Confirmación explícita para evitar pérdida silenciosa.
    const quitadas = conNombre.filter((l) => l.fromDraft && !(Number(l.precioUnitario) > 0));
    if (quitadas.length > 0) {
      const nombres = quitadas.map((l) => `• ${l.snomedDisplay}`).join('\n');
      if (!window.confirm(`Vas a QUITAR del presupuesto guardado ${quitadas.length} línea(s) que quedaron sin importe:\n${nombres}\n\n¿Continuar?`)) return;
    }
    setSaving(true); setError(''); setOkMsg('');
    try {
      const dto = {
        patientId,
        rxPresentadas: rxPresentadas ? Number(rxPresentadas) : undefined,
        obraSocial: obraSocial || undefined,
        cantidadCuotas: cantidadCuotas ? Number(cantidadCuotas) : undefined,
        fechaPresentacion: fechaPresentacion || undefined,
        fechaLiquidacion: fechaLiquidacion || undefined,
        items: items.map((l) => ({
          snomedCode: l.snomedCode || 'GENERAL',
          snomedDisplay: l.snomedDisplay || 'Prestación',
          codigoNomenclador: l.codigoNomenclador || undefined,
          detalle: l.detalle || undefined,
          diente: l.diente || undefined,
          cara: l.cara || undefined,
          sourceResourceId: l.sourceResourceId || undefined,
          cantidad: Number(l.cantidad) || 1,
          precioUnitario: Number(l.precioUnitario) || 0,
        })),
      };
      const aviso = sinPrecio > 0 ? ` (${sinPrecio} línea(s) sin importe quedaron fuera)` : '';
      let idActual = presupuestoId;
      if (presupuestoId) {
        const resp = await axios.patch(`${API_URL}/clinica/finanzas/presupuesto/${presupuestoId}`, dto, { headers: authHeaders() });
        setEstado(resp.data?.estado || estado);
        setOkMsg(`Presupuesto actualizado${aviso}.`);
      } else {
        const resp = await axios.post(`${API_URL}/clinica/finanzas/presupuesto`, dto, { headers: authHeaders() });
        idActual = resp.data?.id || null;
        setPresupuestoId(idActual);
        setEstado(resp.data?.estado || 'borrador');
        setOkMsg(`Presupuesto guardado${aviso}. Ya podés registrar pagos en "Estado contable".`);
      }
      // El modal QUEDA ABIERTO (documento vivo): refresca el saldo para seguir con los pagos.
      if (idActual) await refreshContable(idActual);
      onSaved?.();
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setError(msg || 'No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  };

  const registrarPago = async () => {
    if (!presupuestoId) return;
    const monto = Number(pagoMonto);
    if (!(monto > 0)) { setContableMsg('Ingresá un importe mayor a 0.'); return; }
    setPagoSaving(true); setContableMsg('');
    try {
      // Método/tipo por default en backend (efectivo / pago_directo). Concepto → notas.
      await axios.post(`${API_URL}/clinica/finanzas/pago`, {
        patientId, presupuestoId, monto,
        fechaPago: pagoFecha || undefined,
        notas: pagoConcepto || undefined,
      }, { headers: authHeaders() });
      setPagoMonto(''); setPagoConcepto('');
      // registrar un pago puede cambiar el estado (en_curso/pagado) → releer estado + saldo.
      const full = (await axios.get(`${API_URL}/clinica/finanzas/presupuesto/${presupuestoId}`, { headers: authHeaders() })).data;
      setEstado(full.estado || estado);
      await refreshContable(presupuestoId);
      montoInputRef.current?.focus(); // re-enfoca importe para cargar el siguiente pago
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setContableMsg(msg || 'No se pudo registrar el pago.');
    } finally {
      setPagoSaving(false);
    }
  };

  // Anula un pago (soft-delete) con motivo obligatorio; el saldo/estado se recalcula.
  const anularPago = async (pagoId: string) => {
    const motivo = window.prompt('Motivo de la anulación del pago:');
    if (!motivo || !motivo.trim()) return;
    setContableMsg('');
    try {
      await axios.patch(`${API_URL}/clinica/finanzas/pago/${pagoId}/anular`, { motivo: motivo.trim() }, { headers: authHeaders() });
      if (presupuestoId) {
        const full = (await axios.get(`${API_URL}/clinica/finanzas/presupuesto/${presupuestoId}`, { headers: authHeaders() })).data;
        setEstado(full.estado || estado);
        await refreshContable(presupuestoId);
      }
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setContableMsg(msg || 'No se pudo anular el pago.');
    }
  };

  const transicionar = async (accion: 'presentar' | 'aceptar' | 'cancelar') => {
    if (!presupuestoId) return;
    setContableMsg('');
    try {
      const r = await axios.post(`${API_URL}/clinica/finanzas/presupuesto/${presupuestoId}/${accion}`, {}, { headers: authHeaders() });
      setEstado(r.data?.estado || estado);
      await refreshContable(presupuestoId);
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setContableMsg(msg || 'No se pudo cambiar el estado del presupuesto.');
    }
  };

  const TABS: { key: Tab; label: string; Icon: typeof FileText }[] = [
    { key: 'presupuesto', label: 'Presupuesto', Icon: FileText },
    { key: 'contable', label: 'Estado contable', Icon: Wallet },
    { key: 'ficha', label: 'Ficha de atención', Icon: ClipboardList },
  ];

  return (
    <>
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Plan de tratamiento y presupuesto"
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-text) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', borderRadius: '18px', width: 'min(1040px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}
      >
        {/* Header sticky */}
        <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Plan de Tratamiento — Presupuesto</h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
              {loading ? 'Cargando presupuesto del paciente…'
                : presupuestoId ? '✏️ Editando el presupuesto del paciente'
                : `${plannedResources.length} tratamiento(s) planificado(s) auto-cargados`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}><X size={22} /></button>
        </div>

        {/* Tabs */}
        <div role="tablist" style={{ display: 'flex', gap: '0.25rem', padding: '0.6rem 1rem 0', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              onClick={() => setTab(key)}
              aria-selected={tab === key}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', border: 'none', borderBottom: `2px solid ${tab === key ? 'var(--color-primary)' : 'transparent'}`, background: 'none', cursor: 'pointer', color: tab === key ? 'var(--color-primary)' : 'var(--color-muted)', fontWeight: tab === key ? 800 : 600, fontSize: '0.85rem' }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Body scrollable */}
        <div style={{ padding: '1.2rem 1.4rem', overflowY: 'auto', flex: 1, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
          {tab === 'presupuesto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.4rem' }}>
              {lineas.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Sin líneas. Agregá prestaciones con "＋".</p>
              )}

              {/* Encabezado de columnas: SOLO en desktop (≥768px), una única vez.
                  En mobile cada tarjeta lleva su propio label por campo. */}
              {!isMobile && lineas.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0.6rem', padding: '0 0.75rem 0.35rem', borderBottom: '1px solid var(--border-color)', alignItems: 'end' }}>
                  <div style={headerCellStyle}>Cód. Nomenclador</div>
                  <div style={headerCellStyle}>Prestación</div>
                  <div style={headerCellStyle}>Cant.</div>
                  <div style={headerCellStyle}>Importe unit.</div>
                  <div style={headerCellStyle}>Subtotal</div>
                  <div style={headerCellStyle}>Detalle</div>
                  <div style={{ ...headerCellStyle, width: 34 }} aria-hidden="true"></div>
                </div>
              )}

              {lineas.map((l, i) => {
                // Estilos de fila: grid alineada a columnas en desktop; tarjeta apilada en mobile.
                const rowStyle: React.CSSProperties = isMobile
                  ? { border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'var(--bg-card)' }
                  : { display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0.6rem', padding: '0.35rem 0.75rem', alignItems: 'center', background: i % 2 ? 'var(--bg-card)' : 'transparent', borderRadius: '8px' };
                const subtotal = MONEY((Number(l.precioUnitario) || 0) * (Number(l.cantidad) || 1));
                return (
                  <div key={l.uid} style={rowStyle}>
                    {isMobile && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-muted)' }}>Línea {i + 1}</span>
                        <button type="button" onClick={() => delLinea(i)} aria-label={`Eliminar línea ${i + 1}`} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: 'var(--color-rose)', minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                      </div>
                    )}

                    {/* Cód. Nomenclador (facturación a la OS, distinto del clínico) */}
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={`cod-${l.uid}`} style={isMobile ? labelStyle : srOnly}>Cód. Nomenclador (facturación a la Obra Social)</label>
                      <input id={`cod-${l.uid}`} value={l.codigoNomenclador} maxLength={MAX.codigo} onChange={(e) => setLinea(i, { codigoNomenclador: e.target.value })} placeholder="OS/PAMI · p.ej. 0218" title="Código de facturación a la Obra Social (PAMI/NBU). Es distinto del código clínico SNOMED que asigna el odontograma." style={inputStyle} />
                    </div>

                    {/* Prestación */}
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={`prest-${l.uid}`} style={isMobile ? labelStyle : srOnly}>Prestación{l.diente ? ` · pieza ${l.diente}${l.cara ? `/${l.cara}` : ''}` : ''}</label>
                      <input id={`prest-${l.uid}`} value={l.snomedDisplay} maxLength={MAX.prestacion} onChange={(e) => setLinea(i, { snomedDisplay: e.target.value })} placeholder="Descripción" style={inputStyle} />
                      {/* (ux C1) el hint "Pieza X" desalineaba la fila; el dato ya está en la columna Detalle */}
                    </div>

                    {/* Cantidad */}
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={`cant-${l.uid}`} style={isMobile ? labelStyle : srOnly}>Cantidad</label>
                      <input id={`cant-${l.uid}`} type="number" min={1} value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} style={inputStyle} />
                    </div>

                    {/* Importe unitario (auto-propuesto desde el nomenclador de precios) */}
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={`imp-${l.uid}`} style={isMobile ? labelStyle : srOnly}>Importe unitario</label>
                      <input id={`imp-${l.uid}`} type="number" min={0} step="0.01" value={l.precioUnitario} onChange={(e) => setLinea(i, { precioUnitario: Number(e.target.value), precioEditado: true })} style={inputStyle} />
                    </div>

                    {/* Subtotal (calculado) */}
                    <div style={{ minWidth: 0 }}>
                      <span style={isMobile ? labelStyle : srOnly}>Subtotal</span>
                      <div style={{ ...(isMobile ? inputStyle : {}), fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--color-text)', fontSize: isMobile ? '0.85rem' : '0.82rem', ...(isMobile ? { background: 'var(--bg-surface)' } : {}) }}>{subtotal}</div>
                    </div>

                    {/* Detalle libre */}
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={`det-${l.uid}`} style={isMobile ? labelStyle : srOnly}>Detalle (diente/cara)</label>
                      <input id={`det-${l.uid}`} value={l.detalle} maxLength={MAX.detalle} onChange={(e) => setLinea(i, { detalle: e.target.value })} placeholder="p.ej. distal-oclusal" style={inputStyle} />
                    </div>

                    {/* Borrar (desktop; en mobile va arriba en la cabecera de la tarjeta) */}
                    {!isMobile && (
                      <button type="button" onClick={() => delLinea(i)} aria-label={`Eliminar línea ${i + 1}`} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: 'var(--color-rose)', width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                    )}
                  </div>
                );
              })}

              <button type="button" onClick={addLinea} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px dashed var(--color-primary)', background: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', marginTop: '0.35rem' }}><Plus size={16} /> Agregar línea</button>

              {/* Ayuda sobre el Cód. Nomenclador (aclaración solicitada) */}
              <p style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--color-muted)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
                <HelpCircle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
                <span>El <strong>Cód. Nomenclador</strong> es el código de <strong>facturación a la Obra Social</strong> (PAMI/NBU) y se carga a mano; es distinto del código clínico (SNOMED) que asigna el odontograma. El <strong>importe</strong> se propone automáticamente desde el nomenclador de precios cuando existe para esa prestación.</span>
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <label htmlFor="rx-presentadas" style={labelStyle}>RX presentadas</label>
                  <input id="rx-presentadas" type="number" min={0} value={rxPresentadas} onChange={(e) => setRxPresentadas(e.target.value)} style={{ ...inputStyle, width: '90px' }} />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>Total: {MONEY(total)}</div>
              </div>

              {/* Adjuntos del presupuesto (RX presentadas a la OS, autorizaciones, etc.) */}
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                {presupuestoId ? (
                  <ClinicalAttachments ownerType="presupuesto" ownerId={presupuestoId} label="RX / archivos del presupuesto" />
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', padding: '0.6rem 0.8rem', border: '1px dashed var(--border-color)', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Paperclip size={13} />
                    Guardá el presupuesto para adjuntar RX o archivos.
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === 'contable' && (() => {
            // Resumen: prioriza los valores PERSISTIDOS (cuenta corriente) sobre el total local.
            const totalC = ccResumen?.total ?? total;
            const pagado = ccResumen?.pagado ?? 0;
            const saldo = ccResumen ? ccResumen.saldo : totalC;
            const credito = pagado > totalC ? pagado - totalC : 0; // sobrepago (a cuenta)
            const nCuotas = Number(cantidadCuotas) || 0;
            const valorCuota = nCuotas > 0 ? totalC / nCuotas : null;
            const hoyStr = new Date().toISOString().slice(0, 10);
            // Saldo decreciente fila por fila (cronológico). Los pagos ANULADOS no cuentan.
            const pagosAsc = [...pagos].sort((a, b) => (a.fechaPago || '').localeCompare(b.fechaPago || ''));
            let acum = 0;
            const filas = pagosAsc.map((p) => {
              const anulado = !!p.anuladoAt;
              if (!anulado) acum += Number(p.monto) || 0;
              return { ...p, anulado, saldoTras: anulado ? null : totalC - acum };
            });
            const ESTADO_LABEL: Record<string, string> = { borrador: 'Borrador', presentado: 'Presentado', aceptado: 'Aceptado', en_curso: 'En curso', pagado: 'Pagado', cancelado: 'Cancelado', vencido: 'Vencido' };
            const saldoColor = saldo <= 0 ? 'var(--color-emerald)' : 'var(--color-rose)';
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Resumen económico — Saldo protagonista */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.7rem 0.85rem', background: 'var(--bg-card)' }}>
                  <div style={headerCellStyle}>Total</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.15rem' }}>{MONEY(totalC)}</div>
                </div>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.7rem 0.85rem', background: 'var(--bg-card)' }}>
                  <div style={headerCellStyle}>Pagado</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-emerald)', marginTop: '0.15rem' }}>{MONEY(pagado)}</div>
                </div>
                {/* (ux M1) padding compensa el borde de 2px para que el texto quede a ras de las otras cards */}
                <div style={{ border: `2px solid ${saldoColor}`, borderRadius: '12px', padding: 'calc(0.7rem - 1px) calc(0.85rem - 1px)', background: 'var(--bg-card)', gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                  <div style={headerCellStyle}>Saldo</div>
                  <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 900, color: saldoColor, lineHeight: 1.1 }}>{MONEY(saldo)}</div>
                  {saldo <= 0 && credito === 0 && <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-emerald)' }}>✓ Saldado</div>}
                  {credito > 0 && <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-emerald)' }}>Crédito a favor: {MONEY(credito)}</div>}
                </div>
              </div>

              {!presupuestoId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.8rem', border: '1px dashed var(--color-primary)', borderRadius: '10px', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>
                    Para registrar pagos y adjuntar archivos, primero hay que <strong>guardar el presupuesto</strong> (las líneas con importe de la pestaña Presupuesto).
                  </p>
                  <button type="button" onClick={guardar} disabled={saving} style={{ padding: '0.55rem 1.1rem', borderRadius: '9px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 800, minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {saving ? <><Loader2 size={16} className="spin" /> Guardando…</> : '💾 Guardar presupuesto ahora'}
                  </button>
                  {error && <span style={{ color: 'var(--color-rose)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertCircle size={14} /> {error}</span>}
                </div>
              ) : (
                <>
                  {/* Registrar pago — carga rápida, siempre disponible */}
                  <div style={{ border: '1px solid var(--color-primary)', borderRadius: '12px', padding: '0.85rem', background: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Registrar pago</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.85fr 1fr 1.3fr auto', gap: '0.5rem', alignItems: 'end' }}>
                      <div>
                        <label htmlFor="pago-fecha" style={labelStyle}>Fecha</label>
                        <input id="pago-fecha" type="date" value={pagoFecha || hoyStr} onChange={(e) => setPagoFecha(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label htmlFor="pago-monto" style={labelStyle}>Importe</label>
                        <input id="pago-monto" ref={montoInputRef} autoFocus type="number" min={0} step="0.01" value={pagoMonto}
                          onChange={(e) => setPagoMonto(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrarPago(); } }}
                          placeholder="0,00" style={inputStyle} />
                      </div>
                      <div>
                        <label htmlFor="pago-concepto" style={labelStyle}>Concepto (opcional)</label>
                        <input id="pago-concepto" value={pagoConcepto} maxLength={120}
                          onChange={(e) => setPagoConcepto(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrarPago(); } }}
                          placeholder="seña, cuota, implante…" style={inputStyle} />
                      </div>
                      <button type="button" onClick={registrarPago} disabled={pagoSaving}
                        style={{ padding: '0.55rem 1.1rem', borderRadius: '9px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: pagoSaving ? 'wait' : 'pointer', fontWeight: 800, minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        <Plus size={16} /> {pagoSaving ? '…' : 'Agregar'}
                      </button>
                    </div>
                  </div>

                  {/* (ux M3) mensaje de error contable en ubicación neutral: sirve a pagos, anulaciones y transiciones */}
                  {contableMsg && <div style={{ color: 'var(--color-rose)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertCircle size={14} /> {contableMsg}</div>}

                  {/* Grilla de pagos: Fecha · Importe · Concepto · Saldo (+ anular) */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.4rem' }}>Pagos</div>
                    {filas.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>Sin pagos registrados aún.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {!isMobile && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr 1fr auto', gap: '0.6rem', padding: '0 0.75rem 0.3rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={headerCellStyle}>Fecha</div>
                            <div style={{ ...headerCellStyle, textAlign: 'right' }}>Importe</div>
                            <div style={headerCellStyle}>Concepto</div>
                            <div style={{ ...headerCellStyle, textAlign: 'right' }}>Saldo</div>
                            <div style={{ ...headerCellStyle, width: 34 }} aria-hidden="true"></div>
                          </div>
                        )}
                        {filas.map((p, i) => (
                          isMobile ? (
                            <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 0.7rem', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.2rem', opacity: p.anulado ? 0.55 : 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 800, color: 'var(--color-text)', textDecoration: p.anulado ? 'line-through' : 'none' }}>{MONEY(Number(p.monto) || 0)}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{(p.fechaPago || '').slice(0, 10)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notas || '—'}{p.anulado ? ' · ANULADO' : ''}</span>
                                {!p.anulado && <span>Saldo {MONEY(p.saldoTras ?? 0)}</span>}
                                {!p.anulado && <button type="button" onClick={() => anularPago(p.id)} title="Anular pago" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-rose)', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 }}><Trash2 size={14} /></button>}
                              </div>
                            </div>
                          ) : (
                            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr 1fr auto', gap: '0.6rem', padding: '0.4rem 0.75rem', alignItems: 'center', background: i % 2 ? 'var(--bg-card)' : 'transparent', borderRadius: '8px', fontSize: '0.82rem', opacity: p.anulado ? 0.55 : 1 }}>
                              <span style={{ color: 'var(--color-text)' }}>{(p.fechaPago || '').slice(0, 10)}</span>
                              <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text)', textDecoration: p.anulado ? 'line-through' : 'none' }}>{MONEY(Number(p.monto) || 0)}</span>
                              <span style={{ color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notas || (p.anulado ? 'anulado' : '—')}</span>
                              <span style={{ textAlign: 'right', color: p.anulado ? 'var(--color-muted)' : ((p.saldoTras ?? 0) <= 0 ? 'var(--color-emerald)' : 'var(--color-muted)') }}>{p.anulado ? '—' : MONEY(p.saldoTras ?? 0)}</span>
                              {p.anulado
                                ? <span style={{ width: 34 }} aria-hidden="true"></span>
                                : <button type="button" onClick={() => anularPago(p.id)} title="Anular pago" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-rose)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, minHeight: 34, padding: 0, justifySelf: 'center', borderRadius: '8px' }}><Trash2 size={15} /></button>}
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Datos administrativos (colapsable): cuotas, OS, fechas, estado + presentación */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                    <button type="button" onClick={() => setAdminOpen((o) => !o)} aria-expanded={adminOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: 0, minHeight: 36 }}>
                      <span>{adminOpen ? '▾' : '▸'}</span> Datos administrativos (cuotas, obra social, presentación a OS)
                    </button>
                    {adminOpen && (
                      <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <label style={labelStyle}>Cantidad de cuotas</label>
                            <input type="number" min={1} value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} style={inputStyle} />
                            {valorCuota != null && <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>Valor cuota: {MONEY(valorCuota)}</span>}
                          </div>
                          <div>
                            <label style={labelStyle}>Obra social</label>
                            <input value={obraSocial} maxLength={MAX.obraSocial} onChange={(e) => setObraSocial(e.target.value)} placeholder="OSDE, PAMI…" style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Fecha de presentación</label>
                            <input type="date" value={fechaPresentacion} onChange={(e) => setFechaPresentacion(e.target.value)} style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Fecha de liquidación</label>
                            <input type="date" value={fechaLiquidacion} onChange={(e) => setFechaLiquidacion(e.target.value)} style={inputStyle} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)' }}>Estado:</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--color-text)' }}>{ESTADO_LABEL[estado] || estado}</span>
                          {estado === 'borrador' && <button type="button" onClick={() => transicionar('presentar')} style={btnGhost}>Presentar a OS</button>}
                          {estado === 'presentado' && <>
                            <button type="button" onClick={() => transicionar('aceptar')} style={btnGhost}>Aceptar</button>
                            <button type="button" onClick={() => transicionar('cancelar')} style={{ ...btnGhost, color: 'var(--color-rose)' }}>Cancelar</button>
                          </>}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            );
          })()}

          {tab === 'ficha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>
                Tratamientos <strong>realizados</strong> sobre el paciente (prestaciones completadas del odontograma).
              </p>
              {realizadoResources.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Sin tratamientos realizados registrados aún.</p>
              ) : (
                <>
                  {/* Encabezado (desktop): Fecha · Código · Diente · Cara · Firma */}
                  {!isMobile && (
                    <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.6fr 0.7fr 0.7fr 1fr', gap: '0.6rem', padding: '0 0.75rem 0.3rem', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={headerCellStyle}>Fecha</div>
                      <div style={headerCellStyle}>Prestación / Código</div>
                      <div style={headerCellStyle}>Nº diente</div>
                      <div style={headerCellStyle}>Cara</div>
                      <div style={headerCellStyle}>Firma conformidad</div>
                    </div>
                  )}
                  {realizadoResources.map((r, i) => {
                    const codigo = r.code?.coding?.[0]?.code || '';
                    const diente = r.bodySite?.coding?.[0]?.code || '—';
                    const cara = r.bodySite?.coding?.[1]?.code;
                    const fecha = (r.performedDateTime || r.meta?.lastUpdated || '').slice(0, 10);
                    if (isMobile) {
                      return (
                        <div key={r.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.7rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', background: 'var(--bg-card)' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{r.code?.text || 'Intervención'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{fecha} · Pieza {diente}{cara && cara !== 'all' ? `/${cara}` : ''}{codigo ? ` · ${codigo}` : ''}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--color-muted)' }}><span>Firma de conformidad:</span> {firmaCell(r.id)}</div>
                        </div>
                      );
                    }
                    return (
                      <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.6fr 0.7fr 0.7fr 1fr', gap: '0.6rem', padding: '0.45rem 0.75rem', alignItems: 'center', background: i % 2 ? 'var(--bg-card)' : 'transparent', borderRadius: '8px', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--color-muted)' }}>{fecha}</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{r.code?.text || 'Intervención'}{codigo ? ` · ${codigo}` : ''}</span>
                        <span style={{ color: 'var(--color-text)' }}>{diente}</span>
                        <span style={{ color: 'var(--color-text)' }}>{cara && cara !== 'all' ? cara : '—'}</span>
                        <span>{firmaCell(r.id)}</span>
                      </div>
                    );
                  })}
                  <p style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--color-muted)', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                    <HelpCircle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
                    <span>Tocá <strong>“Capturar firma”</strong> para que el paciente firme su conformidad con cada tratamiento realizado (canvas táctil). La firma queda como evidencia <strong>inmutable y auditada</strong>.</span>
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.82rem', minHeight: '1.2rem' }}>
            {error && <span style={{ color: 'var(--color-rose)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertCircle size={15} /> {error}</span>}
            {okMsg && <span style={{ color: 'var(--color-emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CheckCircle size={15} /> {okMsg}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={onClose} disabled={saving} style={{ padding: '0.55rem 1rem', borderRadius: '9px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{ padding: '0.55rem 1.1rem', borderRadius: '9px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              {saving ? <><Loader2 size={16} className="spin" /> Guardando…</> : 'Guardar presupuesto'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {firmandoResourceId && (
      <SignaturePadModal
        subtitle="El paciente firma su conformidad con el tratamiento realizado."
        saving={firmaSaving}
        onCancel={() => setFirmandoResourceId(null)}
        onSave={capturarFirma}
      />
    )}
    </>
  );
};
