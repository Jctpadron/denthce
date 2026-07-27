import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Trash2, FileText, Wallet, ClipboardList, Loader2, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { useIsMobile } from '../../hooks/useIsMobile';

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

interface PlannedResource {
  id: string;
  resourceType?: string;
  code?: { text?: string; coding?: { code?: string }[] };
  bodySite?: { coding?: { code?: string }[] };
}

interface RealizadoResource extends PlannedResource {
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

  // Al abrir: si el paciente YA tiene un presupuesto en borrador, lo cargamos para editar
  // (evita duplicados y muestra lo guardado). Si no, se queda con el auto-cargado del plan.
  useEffect(() => {
    (async () => {
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

        // 2) Borrador existente del paciente: editar en vez de duplicar.
        const r = await axios.get(`${API_URL}/clinica/finanzas/presupuesto`, { headers: authHeaders() });
        const arr = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        const borradores = arr.filter((p: { patientId?: string; estado?: string }) => p.patientId === patientId && p.estado === 'borrador');
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
    const items = lineas.filter((l) => (l.snomedDisplay || '').trim());
    if (items.length === 0) { setError('Agregá al menos una prestación.'); return; }
    const invalida = items.find((l) => !(Number(l.precioUnitario) > 0) || !(Number(l.cantidad) >= 1));
    if (invalida) { setError('Cada línea necesita importe mayor a 0 y cantidad ≥ 1.'); return; }
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
      if (presupuestoId) {
        await axios.patch(`${API_URL}/clinica/finanzas/presupuesto/${presupuestoId}`, dto, { headers: authHeaders() });
        setOkMsg('Presupuesto actualizado.');
      } else {
        await axios.post(`${API_URL}/clinica/finanzas/presupuesto`, dto, { headers: authHeaders() });
        setOkMsg('Presupuesto guardado en Finanzas.');
      }
      onSaved?.();
      setTimeout(onClose, 1000);
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setError(msg || 'No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { key: Tab; label: string; Icon: typeof FileText }[] = [
    { key: 'presupuesto', label: 'Presupuesto', Icon: FileText },
    { key: 'contable', label: 'Estado contable', Icon: Wallet },
    { key: 'ficha', label: 'Ficha de atención', Icon: ClipboardList },
  ];

  return (
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
                : presupuestoId ? '✏️ Editando el presupuesto en borrador del paciente'
                : `${plannedResources.length} tratamiento(s) planificado(s) auto-cargados`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}><X size={22} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', padding: '0.6rem 1rem 0', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-selected={tab === key}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', border: 'none', borderBottom: `2px solid ${tab === key ? 'var(--color-primary)' : 'transparent'}`, background: 'none', cursor: 'pointer', color: tab === key ? 'var(--color-primary)' : 'var(--color-muted)', fontWeight: tab === key ? 800 : 600, fontSize: '0.85rem' }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Body scrollable */}
        <div style={{ padding: '1.2rem 1.4rem', overflowY: 'auto', flex: 1 }}>
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
                      {!isMobile && l.diente && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--color-muted)' }}>Pieza {l.diente}{l.cara ? `/${l.cara}` : ''}</span>
                      )}
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
            </div>
          )}

          {tab === 'contable' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)' }}>Importe total</label>
                <div style={{ ...inputStyle, background: 'var(--bg-card)', fontWeight: 800 }}>{MONEY(total)}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)' }}>Cantidad de cuotas</label>
                <input type="number" min={1} value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)' }}>Obra social</label>
                <input value={obraSocial} maxLength={MAX.obraSocial} onChange={(e) => setObraSocial(e.target.value)} placeholder="OSDE, PAMI…" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)' }}>Fecha de presentación</label>
                <input type="date" value={fechaPresentacion} onChange={(e) => setFechaPresentacion(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)' }}>Fecha de liquidación</label>
                <input type="date" value={fechaLiquidacion} onChange={(e) => setFechaLiquidacion(e.target.value)} style={inputStyle} />
              </div>
              <p style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0 }}>
                Los <strong>pagos</strong> (tabla Fecha/Pago/Saldo) se registran desde <strong>Finanzas → Pagos</strong> una vez guardado el presupuesto. El saldo se calcula: total − Σ pagos.
              </p>
            </div>
          )}

          {tab === 'ficha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>Tratamientos <strong>realizados</strong> (derivados del odontograma en capa "Existente"):</p>
              {realizadoResources.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Sin tratamientos realizados registrados aún.</p>
              ) : (
                realizadoResources.map((r) => (
                  <div key={r.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--bg-card)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontWeight: 600 }}>{r.code?.text || 'Intervención'} · {detalleDe(r) || 's/pieza'}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{(r.performedDateTime || r.meta?.lastUpdated || '').slice(0, 10)}</span>
                  </div>
                ))
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
  );
};
