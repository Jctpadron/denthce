import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Trash2, FileText, Wallet, ClipboardList, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

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
  color: 'var(--color-text)', fontSize: '0.85rem',
};

export const PresupuestoOdontologicoModal: React.FC<Props> = ({
  patientId, plannedResources, realizadoResources = [], onClose, onSaved,
}) => {
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
          })) : [];
          // #5: incorporar los tratamientos planificados que aún NO están en el presupuesto (por sourceResourceId).
          const yaPresupuestados = new Set(existentes.map((l) => l.sourceResourceId).filter(Boolean));
          const nuevosDelPlan = plannedResources.filter((r) => !yaPresupuestados.has(r.id)).map(lineaFromPlanned);
          if (existentes.length || nuevosDelPlan.length) setLineas([...existentes, ...nuevosDelPlan]);
          setRxPresentadas(full.rxPresentadas != null ? String(full.rxPresentadas) : '');
          setObraSocial(full.obraSocial || '');
          setCantidadCuotas(full.cantidadCuotas != null ? String(full.cantidadCuotas) : '');
          setFechaPresentacion((full.fechaPresentacion || '').slice(0, 10));
          setFechaLiquidacion((full.fechaLiquidacion || '').slice(0, 10));
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lineas.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Sin líneas. Agregá prestaciones con "＋".</p>
              )}
              {lineas.map((l, i) => (
                <div key={l.uid} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', alignItems: 'end', background: 'var(--bg-card)' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>Cód. Nomenclador</label>
                    <input value={l.codigoNomenclador} maxLength={MAX.codigo} onChange={(e) => setLinea(i, { codigoNomenclador: e.target.value })} placeholder="p.ej. 0218" style={inputStyle} />
                  </div>
                  <div style={{ minWidth: '180px' }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>Prestación{l.diente ? ` · pieza ${l.diente}${l.cara ? `/${l.cara}` : ''}` : ''}</label>
                    <input value={l.snomedDisplay} maxLength={MAX.prestacion} onChange={(e) => setLinea(i, { snomedDisplay: e.target.value })} placeholder="Descripción" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>Cant.</label>
                    <input type="number" min={1} value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>Importe unit.</label>
                    <input type="number" min={0} step="0.01" value={l.precioUnitario} onChange={(e) => setLinea(i, { precioUnitario: Number(e.target.value) })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>Subtotal</label>
                    <div style={{ ...inputStyle, background: 'var(--bg-card)', fontWeight: 700, whiteSpace: 'nowrap' }}>{MONEY((Number(l.precioUnitario) || 0) * (Number(l.cantidad) || 1))}</div>
                  </div>
                  <div style={{ minWidth: '160px' }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>Detalle (diente/cara)</label>
                    <input value={l.detalle} maxLength={MAX.detalle} onChange={(e) => setLinea(i, { detalle: e.target.value })} style={inputStyle} />
                  </div>
                  <button type="button" onClick={() => delLinea(i)} aria-label="Quitar línea" style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', color: 'var(--color-rose)', justifySelf: 'start' }}><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={addLinea} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px dashed var(--color-primary)', background: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}><Plus size={16} /> Agregar línea</button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>RX presentadas</label>
                  <input type="number" min={0} value={rxPresentadas} onChange={(e) => setRxPresentadas(e.target.value)} style={{ ...inputStyle, width: '90px' }} />
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
