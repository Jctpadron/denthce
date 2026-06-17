import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  DollarSign, TrendingUp, ShoppingCart, CreditCard, Search, Plus,
  X, AlertCircle, FileText
} from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

type FinanzasTab = 'dashboard' | 'presupuestos' | 'nomenclador' | 'pagos' | 'gastos';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const getHeaders = () => ({ Authorization: `Bearer ${keycloak.token}` });

interface DashboardData {
  cobradoHoy: number; cobradoMes: number; gastosMes: number;
  rentabilidadNeta: number; deudaTotal: number; pacientesMorosos: number;
}
interface Precio { id: string; snomedCode: string; snomedDisplay: string; precio: number; active: boolean; }
interface Presupuesto { id: string; numero: string; patientId: string; estado: string; subtotal: number; descuento: number; total: number; senhaPorcentaje: number; senhaMonto: number; fechaEmision: string; fechaValidez: string; createdBy: string; items?: PresupuestoItem[]; pagos?: Pago[]; }
interface PresupuestoItem { id: string; snomedCode: string; snomedDisplay: string; diente?: string; cantidad: number; precioUnitario: number; subtotal: number; }
interface Pago { id: string; patientId: string; presupuestoId?: string; tipo: string; monto: number; metodoPago: string; fechaPago: string; comprobante?: string; notas?: string; registeredBy?: string; }
interface Gasto { id: string; categoria: string; descripcion: string; monto: number; fechaGasto: string; metodoPago: string; comprobante?: string; }

const MONEY = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const badge = (variant: string): React.CSSProperties => {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 };
  const map: Record<string, React.CSSProperties> = {
    green: { background: 'color-mix(in srgb, var(--color-emerald) 12%, transparent)', color: 'var(--color-emerald)' },
    yellow: { background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)', color: 'var(--color-amber)' },
    red: { background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)', color: 'var(--color-rose)' },
    blue: { background: 'color-mix(in srgb, var(--color-primary, var(--color-cyan)) 10%, transparent)', color: 'var(--color-primary, var(--color-cyan))' },
    gray: { background: 'color-mix(in srgb, var(--color-muted) 10%, transparent)', color: 'var(--color-muted)' },
    purple: { background: 'color-mix(in srgb, var(--color-violet) 12%, transparent)', color: 'var(--color-violet)' },
    amber: { background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)', color: 'var(--color-amber)' },
  };
  return { ...base, ...(map[variant] || map.gray) };
};

const badgeEstado = (estado: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    borrador: badge('gray'), presentado: badge('blue'), aceptado: badge('purple'),
    en_curso: badge('amber'), pagado: badge('green'), cancelado: badge('red'), vencido: badge('red'),
  };
  return map[estado] || badge('gray');
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-text) 35%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', borderRadius: '20px', padding: '1.5rem', width: '480px', maxWidth: '90vw', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '0.8rem' }}>
    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{label}</label>
    {children}
  </div>
);

const PacienteSearchField: React.FC<{
  name: string;
  required?: boolean;
  onSelect?: (p: any) => void;
  placeholder?: string;
  initialPatientId?: string;
}> = ({ name, required, onSelect, placeholder, initialPatientId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [selectedId, setSelectedId] = useState(initialPatientId || '');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (initialPatientId && !selected) {
      axios.get(`${API_URL}/fhir/r4/Patient/${initialPatientId}`, { headers: getHeaders() })
        .then(res => {
          const p = res.data;
          const label = `${p.name?.[0]?.family || ''}, ${p.name?.[0]?.given?.[0] || ''}`;
          setSelected(p);
          setQuery(label);
          setSelectedId(p.id);
          onSelect?.(p);
        })
        .catch(() => {});
    }
  }, []);

  const doSearch = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (/^\d/.test(q.trim())) params.append('identifier', q.trim());
      else params.append('name', q.trim());
      const res = await axios.get(`${API_URL}/fhir/r4/Patient?${params}`, { headers: getHeaders() });
      setResults((res.data.entry || []).map((e: any) => e.resource));
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const handleQuery = (v: string) => {
    setQuery(v);
    if (selected) { setSelected(null); setSelectedId(''); }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 300);
  };

  const handleSelect = (p: any) => {
    const label = `${p.name?.[0]?.family || ''}, ${p.name?.[0]?.given?.[0] || ''}`;
    setQuery(label);
    setResults([]);
    setSelected(p);
    setSelectedId(p.id);
    onSelect?.(p);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input type="hidden" name={name} value={selectedId} />
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
          <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-text)' }}>
            <strong>{query}</strong>
          </span>
          <button type="button" onClick={() => { setSelected(null); setSelectedId(''); setQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <input value={query} onChange={e => handleQuery(e.target.value)} className="search-input" placeholder={placeholder || 'Buscar paciente por nombre o DNI...'} style={{ width: '100%' }} required={required} />
      )}
      {searching && <small style={{ color: 'var(--color-muted)', display: 'block', marginTop: '2px' }}>Buscando...</small>}
      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-card)', zIndex: 10, maxHeight: '220px', overflowY: 'auto', marginTop: '2px' }}>
          {results.map(p => (
            <div key={p.id} onClick={() => handleSelect(p)} style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{p.name?.[0]?.family}, {p.name?.[0]?.given?.[0]}</strong></span>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.7rem' }}>
                {p.identifier?.find((i: any) => i.type?.coding?.[0]?.code === 'DNI')?.value || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const FinanzasClinicas: React.FC = () => {
  const [tab, setTab] = useState<FinanzasTab>('dashboard');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [precios, setPrecios] = useState<Precio[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [showNuevoPresupuesto, setShowNuevoPresupuesto] = useState(false);
  const [showRegistrarPago, setShowRegistrarPago] = useState(false);
  const [showRegistrarGasto, setShowRegistrarGasto] = useState(false);
  const [showNuevoPrecio, setShowNuevoPrecio] = useState(false);
  const [pagoPresupuestos, setPagoPresupuestos] = useState<Presupuesto[]>([]);
  const [quickPagoPresupuesto, setQuickPagoPresupuesto] = useState<Presupuesto | null>(null);

  const fetchAll = useCallback(async (background = false) => {
    if (!background) setInitialLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [dash, preciosR, presupuestosR, pagosR, gastosR] = await Promise.all([
        axios.get(`${API_URL}/clinica/finanzas/dashboard`, { headers: getHeaders() }),
        axios.get(`${API_URL}/clinica/finanzas/nomenclador`, { headers: getHeaders() }),
        axios.get(`${API_URL}/clinica/finanzas/presupuesto`, { headers: getHeaders() }),
        axios.get(`${API_URL}/clinica/finanzas/pago`, { headers: getHeaders() }),
        axios.get(`${API_URL}/clinica/finanzas/gasto`, { headers: getHeaders() }),
      ]);
      setDashboard(dash.data || null);
      setPrecios(preciosR.data || []);
      setPresupuestos(presupuestosR.data || []);
      setPagos(pagosR.data || []);
      setGastos(gastosR.data || []);
      loadedOnce.current = true;
    } catch (e: any) {
      console.error('Error fetching finanzas data', e);
      setError(e?.response?.data?.message || 'No se pudieron cargar los datos de finanzas. Verifique la conexión.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const refresh = () => fetchAll(true);

  const handleTransicion = async (id: string, estado: string) => {
    try {
      await axios.post(`${API_URL}/clinica/finanzas/presupuesto/${id}/${estado}`, {}, { headers: getHeaders() });
      refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al cambiar el estado del presupuesto.');
    }
  };

  const handleNuevoPresupuesto = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const dto = {
      patientId: data.get('patientId') as string,
      descuento: parseFloat(data.get('descuento') as string) || 0,
      senhaPorcentaje: parseFloat(data.get('senhaPorcentaje') as string) || 30,
      items: [{ snomedCode: 'GENERAL', snomedDisplay: data.get('descripcion') as string || 'Servicio odontologico', precioUnitario: parseFloat(data.get('total') as string) || 0 }]
    };
    try {
      await axios.post(`${API_URL}/clinica/finanzas/presupuesto`, dto, { headers: getHeaders() });
      setShowNuevoPresupuesto(false);
      refresh();
    } catch (e: any) { setFormError(e?.response?.data?.message || 'Error al crear el presupuesto.'); }
  };

  const handleRegistrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const dto = {
      patientId: data.get('patientId') as string,
      presupuestoId: data.get('presupuestoId') as string || undefined,
      tipo: data.get('tipo') as string,
      monto: parseFloat(data.get('monto') as string),
      metodoPago: data.get('metodoPago') as string,
      comprobante: data.get('comprobante') as string || undefined,
      notas: data.get('notas') as string || undefined,
    };
    try {
      await axios.post(`${API_URL}/clinica/finanzas/pago`, dto, { headers: getHeaders() });
      setShowRegistrarPago(false);
      refresh();
    } catch (e: any) { setFormError(e?.response?.data?.message || 'Error al registrar el pago.'); }
  };

  const handleRegistrarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const dto = {
      categoria: data.get('categoria') as string,
      descripcion: data.get('descripcion') as string,
      monto: parseFloat(data.get('monto') as string),
      metodoPago: data.get('metodoPago') as string,
      comprobante: data.get('comprobante') as string || undefined,
    };
    try {
      await axios.post(`${API_URL}/clinica/finanzas/gasto`, dto, { headers: getHeaders() });
      setShowRegistrarGasto(false);
      refresh();
    } catch (e: any) { setFormError(e?.response?.data?.message || 'Error al registrar el gasto.'); }
  };

  const handleNuevoPrecio = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const dto = {
      snomedCode: data.get('snomedCode') as string,
      snomedDisplay: data.get('snomedDisplay') as string,
      precio: parseFloat(data.get('precio') as string),
    };
    try {
      await axios.post(`${API_URL}/clinica/finanzas/nomenclador`, dto, { headers: getHeaders() });
      setShowNuevoPrecio(false);
      refresh();
    } catch (e: any) { setFormError(e?.response?.data?.message || 'Error al agregar la prestación.'); }
  };

  const TABS = [
    { key: 'dashboard' as FinanzasTab, label: 'Dashboard', icon: <TrendingUp size={16} /> },
    { key: 'presupuestos' as FinanzasTab, label: 'Presupuestos', icon: <FileText size={16} /> },
    { key: 'nomenclador' as FinanzasTab, label: 'Nomenclador', icon: <CreditCard size={16} /> },
    { key: 'pagos' as FinanzasTab, label: 'Pagos', icon: <DollarSign size={16} /> },
    { key: 'gastos' as FinanzasTab, label: 'Gastos', icon: <ShoppingCart size={16} /> },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Finanzas Clínicas</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0.25rem 0 0' }}>Gestión de cobros, presupuestos, gastos y rentabilidad</p>
        </div>
        {dashboard && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={badge('blue')}>Cobrado hoy: {MONEY(dashboard.cobradoHoy)}</span>
            <span style={badge('amber')}>Deuda: {MONEY(dashboard.deudaTotal)}</span>
          </div>
        )}
      </div>

      <div className="segmented-control" style={{ marginBottom: '1.25rem' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`segmented-button${tab === t.key ? ' active' : ''}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>Cargando...</div>
      ) : (
        <>
          {refreshing && <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 600 }}>Actualizando...</div>}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '1rem 1.25rem', borderRadius: '12px', background: 'color-mix(in srgb, var(--color-rose) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-rose) 20%, transparent)', color: 'var(--color-rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {tab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {dashboard ? (
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))' }}>
                  <KpiCard value={MONEY(dashboard.cobradoHoy)} label="Cobrado Hoy" color="var(--color-emerald)" />
                  <KpiCard value={MONEY(dashboard.cobradoMes)} label="Cobrado Este Mes" color="var(--color-primary, var(--color-cyan))" />
                  <KpiCard value={MONEY(dashboard.gastosMes)} label="Gastos del Mes" color="var(--color-rose)" />
                  <KpiCard value={MONEY(dashboard.rentabilidadNeta)} label="Rentabilidad Neta" color="var(--color-text)" />
                  <KpiCard value={MONEY(dashboard.deudaTotal)} label="Deuda Total Pacientes" color="var(--color-amber)" />
                  <KpiCard value={String(dashboard.pacientesMorosos)} label="Presupuestos Vencidos" color="var(--color-rose)" />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', color: 'var(--color-muted)', fontSize: '0.88rem' }}>
                  No hay datos de dashboard disponibles.
                </div>
              )}
              {!error && dashboard && dashboard.cobradoMes === 0 && dashboard.gastosMes === 0 && dashboard.deudaTotal === 0 && (
                <div style={{ textAlign: 'center', padding: '1.25rem', background: 'var(--bg-surface)', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                  Aún no hay movimientos registrados. Comience creando un presupuesto o registrando un pago.
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => { setShowNuevoPresupuesto(true); setFormError(null); }}><Plus size={16} /> Nuevo Presupuesto</button>
                <button className="btn btn-secondary" onClick={() => { setShowRegistrarPago(true); setFormError(null); }}><DollarSign size={16} /> Registrar Pago</button>
                <button className="btn btn-secondary" onClick={() => { setShowRegistrarGasto(true); setFormError(null); }}><ShoppingCart size={16} /> Registrar Gasto</button>
              </div>
            </div>
          )}

          {tab === 'presupuestos' && (
            <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{presupuestos.length} presupuestos</span>
                <button className="btn btn-primary" onClick={() => { setShowNuevoPresupuesto(true); setFormError(null); }}><Plus size={16} /> Nuevo Presupuesto</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)' }}>
                      <th style={{ ...TH, ...COLS.numero }}>N°</th>
                      <th style={{ ...TH, ...COLS.paciente }}>Paciente</th>
                      <th style={{ ...TH, ...COLS.total, textAlign: 'right' }}>Total</th>
                      <th style={{ ...TH, ...COLS.pagado, textAlign: 'right' }}>Pagado</th>
                      <th style={{ ...TH, ...COLS.saldo, textAlign: 'right' }}>Saldo</th>
                      <th style={{ ...TH, ...COLS.estado, textAlign: 'center' }}>Estado</th>
                      <th style={{ ...TH, ...COLS.fecha }}>Fecha</th>
                      <th style={{ ...TH, ...COLS.acciones, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presupuestos.map(p => {
                      const totalPagado = (p.pagos || []).reduce((s, pg) => s + Number(pg.monto), 0);
                      const saldo = Math.max(0, Number(p.total) - totalPagado);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ ...TD, ...COLS.numero }}>{p.numero}</td>
                          <td style={{ ...TD, ...COLS.paciente }}>
                            <span style={{ fontWeight: 600, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.patientId}>
                              {p.patientId?.slice(0, 10)}...
                            </span>
                          </td>
                          <td style={{ ...TD_RIGHT, ...COLS.total }}>{MONEY(Number(p.total))}</td>
                          <td style={{ ...TD_RIGHT, ...COLS.pagado }}><span style={{ color: 'var(--color-emerald)' }}>{MONEY(totalPagado)}</span></td>
                          <td style={{ ...TD_RIGHT, ...COLS.saldo }}><span style={{ color: saldo > 0 ? 'var(--color-amber)' : 'var(--color-emerald)', fontWeight: 700 }}>{MONEY(saldo)}</span></td>
                          <td style={{ ...TD_CENTER, ...COLS.estado }}><span style={badgeEstado(p.estado)}>{p.estado.replace('_', ' ')}</span></td>
                          <td style={{ ...TD, ...COLS.fecha }}><span style={{ color: 'var(--color-muted)', fontSize: '0.7rem' }}>{new Date(p.fechaEmision).toLocaleDateString()}</span></td>
                          <td style={{ ...TD_CENTER, ...COLS.acciones }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                              {p.estado === 'borrador' && <button onClick={() => handleTransicion(p.id, 'presentar')} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Presentar</button>}
                              {p.estado === 'presentado' && <button onClick={() => handleTransicion(p.id, 'aceptar')} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Aceptar</button>}
                              {(p.estado === 'aceptado' || p.estado === 'en_curso') && (
                                <button onClick={() => { setQuickPagoPresupuesto(p); setShowRegistrarPago(true); setFormError(null); }} className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>+ Pago</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {presupuestos.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No hay presupuestos registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'nomenclador' && (
            <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{precios.length} prestaciones con precio</span>
                <button className="btn btn-primary" onClick={() => { setShowNuevoPrecio(true); setFormError(null); }}><Plus size={16} /> Agregar Prestación</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)' }}>
                      <th style={TH}>Código SNOMED</th><th style={TH}>Prestación</th><th style={TH}>Precio</th><th style={TH}>Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precios.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={TD}><code>{p.snomedCode}</code></td>
                        <td style={TD}><span style={{ fontWeight: 600 }}>{p.snomedDisplay}</span></td>
                        <td style={TD}>{MONEY(p.precio)}</td>
                        <td style={TD}><span style={p.active ? badge('green') : badge('gray')}>{p.active ? 'Activo' : 'Inactivo'}</span></td>
                      </tr>
                    ))}
                    {precios.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No hay precios configurados. Agregue prestaciones desde el nomenclador.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'pagos' && (
            <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{pagos.length} pagos registrados</span>
                <button className="btn btn-primary" onClick={() => { setShowRegistrarPago(true); setFormError(null); }}><DollarSign size={16} /> Registrar Pago</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)' }}>
                      <th style={TH}>Tipo</th><th style={TH}>Monto</th><th style={TH}>Método</th><th style={TH}>Presupuesto</th><th style={TH}>Fecha</th><th style={TH}>Comprobante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={TD}><span style={p.tipo === 'senha' ? badge('purple') : p.tipo === 'cuota' ? badge('blue') : badge('gray')}>{p.tipo}</span></td>
                        <td style={TD}><span style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{MONEY(Number(p.monto))}</span></td>
                        <td style={TD}>{p.metodoPago}</td>
                        <td style={TD}>{p.presupuestoId ? `${p.presupuestoId.slice(0, 8)}...` : '—'}</td>
                        <td style={TD}><span style={{ color: 'var(--color-muted)', fontSize: '0.7rem' }}>{new Date(p.fechaPago).toLocaleDateString()}</span></td>
                        <td style={TD}>{p.comprobante || '—'}</td>
                      </tr>
                    ))}
                    {pagos.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No hay pagos registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'gastos' && (
            <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{gastos.length} gastos registrados</span>
                <button className="btn btn-primary" onClick={() => { setShowRegistrarGasto(true); setFormError(null); }}><ShoppingCart size={16} /> Registrar Gasto</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)' }}>
                      <th style={TH}>Categoría</th><th style={TH}>Descripción</th><th style={TH}>Monto</th><th style={TH}>Método</th><th style={TH}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={TD}><span style={catBadge(g.categoria)}>{g.categoria}</span></td>
                        <td style={TD}><span style={{ fontWeight: 600 }}>{g.descripcion}</span></td>
                        <td style={TD}><span style={{ fontWeight: 700, color: 'var(--color-rose)' }}>{MONEY(Number(g.monto))}</span></td>
                        <td style={TD}>{g.metodoPago}</td>
                        <td style={TD}><span style={{ color: 'var(--color-muted)', fontSize: '0.7rem' }}>{new Date(g.fechaGasto).toLocaleDateString()}</span></td>
                      </tr>
                    ))}
                    {gastos.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No hay gastos registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showNuevoPresupuesto && (
        <Modal title="Nuevo Presupuesto" onClose={() => { setShowNuevoPresupuesto(false); setFormError(null); }}>
          <form onSubmit={handleNuevoPresupuesto}>
            <Field label="Paciente">
              <PacienteSearchField name="patientId" required />
            </Field>
            <Field label="Descripción del servicio">
              <input name="descripcion" className="search-input" placeholder="Ej: Restauración + Corona" required />
            </Field>
            <Field label="Monto Total ($)">
              <input name="total" type="number" className="search-input" placeholder="0.00" required />
            </Field>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <Field label="Descuento ($)">
                  <input name="descuento" type="number" className="search-input" placeholder="0" defaultValue="0" />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Seña (%)">
                  <input name="senhaPorcentaje" type="number" className="search-input" placeholder="30" defaultValue="30" />
                </Field>
              </div>
            </div>
                        {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'color-mix(in srgb, var(--color-rose) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-rose) 20%, transparent)', color: 'var(--color-rose)', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" onClick={() => { setShowNuevoPresupuesto(false); setFormError(null); }} className="btn btn-secondary">Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Presupuesto</button>
            </div>
          </form>
        </Modal>
      )}

      {showRegistrarPago && (
        <Modal title="Registrar Pago" onClose={() => { setShowRegistrarPago(false); setPagoPresupuestos([]); setQuickPagoPresupuesto(null); setFormError(null); }}>
          <form onSubmit={handleRegistrarPago}>
            <Field label="Tipo de Pago">
              <select name="tipo" className="search-input" required defaultValue={quickPagoPresupuesto ? 'cuota' : 'senha'} onChange={e => {
                if (e.target.value === 'pago_directo') setPagoPresupuestos([]);
              }}>
                <option value="senha">Seña (adelanto)</option>
                <option value="cuota">Cuota (contra presupuesto)</option>
                <option value="pago_directo">Pago Directo (sin presupuesto)</option>
              </select>
            </Field>
            <Field label="Paciente">
              <PacienteSearchField name="patientId" required initialPatientId={quickPagoPresupuesto?.patientId} onSelect={(p) => {
                const tipo = (document.querySelector('select[name="tipo"]') as HTMLSelectElement)?.value;
                if (tipo && tipo !== 'pago_directo') {
                  axios.get(`${API_URL}/clinica/finanzas/presupuesto?patientId=${p.id}`, { headers: getHeaders() })
                    .then(res => {
                      const pres = (res.data as Presupuesto[]).filter(pr => !['pagado', 'cancelado'].includes(pr.estado));
                      setPagoPresupuestos(pres);
                      if (quickPagoPresupuesto && quickPagoPresupuesto.patientId === p.id) {
                        setTimeout(() => {
                          const sel = document.querySelector('select[name="presupuestoId"]') as HTMLSelectElement;
                          if (sel) {
                            sel.value = quickPagoPresupuesto.id;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          }
                        }, 50);
                      }
                    })
                    .catch(() => setPagoPresupuestos([]));
                }
              }} />
            </Field>
            {pagoPresupuestos.length > 0 && (
              <Field label="Presupuesto a pagar">
                <select name="presupuestoId" className="search-input" onChange={e => {
                  const pr = pagoPresupuestos.find(p => p.id === e.target.value);
                  if (pr) {
                    const pagado = (pr.pagos || []).reduce((s, p) => s + p.monto, 0);
                    const montoInput = (e.target.closest('form')?.querySelector('input[name="monto"]') as HTMLInputElement);
                    if (montoInput) montoInput.value = String(pr.total - pagado);
                  }
                }}>
                  <option value="">Seleccionar presupuesto...</option>
                  {pagoPresupuestos.map(pr => {
                    const pagado = (pr.pagos || []).reduce((s, p) => s + p.monto, 0);
                    return (
                      <option key={pr.id} value={pr.id}>
                        {pr.numero} — ${(pr.total - pagado).toLocaleString('es-AR')} restantes (Total: ${pr.total.toLocaleString('es-AR')})
                      </option>
                    );
                  })}
                </select>
              </Field>
            )}
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <Field label="Monto ($)">
                  <input name="monto" type="number" className="search-input" placeholder="0.00" required />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Método de Pago">
                  <select name="metodoPago" className="search-input" required>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>
              </div>
            </div>
            <Field label="Comprobante / Ref. (opcional)">
              <input name="comprobante" className="search-input" placeholder="N° de recibo o transferencia" />
            </Field>
                        {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'color-mix(in srgb, var(--color-rose) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-rose) 20%, transparent)', color: 'var(--color-rose)', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" onClick={() => { setShowRegistrarPago(false); setPagoPresupuestos([]); setQuickPagoPresupuesto(null); setFormError(null); }} className="btn btn-secondary">Cancelar</button>
              <button type="submit" className="btn btn-primary">Confirmar Pago</button>
            </div>
          </form>
        </Modal>
      )}

      {showRegistrarGasto && (
        <Modal title="Registrar Gasto" onClose={() => { setShowRegistrarGasto(false); setFormError(null); }}>
          <form onSubmit={handleRegistrarGasto}>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <Field label="Categoría">
                  <select name="categoria" className="search-input" required>
                    <option value="Insumos">Insumos</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Sueldos">Sueldos</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Equipamiento">Equipamiento</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Método de Pago">
                  <select name="metodoPago" className="search-input" required>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                  </select>
                </Field>
              </div>
            </div>
            <Field label="Descripción">
              <input name="descripcion" className="search-input" placeholder="Ej: Alquiler local Junio 2026" required />
            </Field>
            <Field label="Monto ($)">
              <input name="monto" type="number" className="search-input" placeholder="0.00" required />
            </Field>
            <Field label="Comprobante (opcional)">
              <input name="comprobante" className="search-input" placeholder="N° de factura o recibo" />
            </Field>
                        {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'color-mix(in srgb, var(--color-rose) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-rose) 20%, transparent)', color: 'var(--color-rose)', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" onClick={() => { setShowRegistrarGasto(false); setFormError(null); }} className="btn btn-secondary">Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-rose)', borderColor: 'var(--color-rose)' }}>Registrar Gasto</button>
            </div>
          </form>
        </Modal>
      )}

      {showNuevoPrecio && (
        <Modal title="Agregar Prestación al Nomenclador" onClose={() => { setShowNuevoPrecio(false); setFormError(null); }}>
          <form onSubmit={handleNuevoPrecio}>
            <Field label="Código SNOMED">
              <input name="snomedCode" className="search-input" placeholder="Ej: 397277009" required />
            </Field>
            <Field label="Nombre de la prestación">
              <input name="snomedDisplay" className="search-input" placeholder="Ej: Consulta odontológica inicial" required />
            </Field>
            <Field label="Precio ($)">
              <input name="precio" type="number" className="search-input" placeholder="0.00" required />
            </Field>
                        {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'color-mix(in srgb, var(--color-rose) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-rose) 20%, transparent)', color: 'var(--color-rose)', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" onClick={() => { setShowNuevoPrecio(false); setFormError(null); }} className="btn btn-secondary">Cancelar</button>
              <button type="submit" className="btn btn-primary">Agregar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ value: string; label: string; color: string }> = ({ value, label, color }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }} />
    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>{label}</div>
  </div>
);

const catBadge = (cat: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    Insumos: badge('blue'), Alquiler: badge('purple'), Sueldos: badge('green'),
    Servicios: badge('gray'), Equipamiento: badge('amber'), Otro: badge('yellow'),
  };
  return { display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, ...(map[cat] || badge('gray')) };
};

const TH: React.CSSProperties = { textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '2px solid var(--border-color)', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '0.6rem 0.8rem', whiteSpace: 'nowrap', verticalAlign: 'middle' };
const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: 'right' };
const TD_CENTER: React.CSSProperties = { ...TD, textAlign: 'center' };
const COLS = {
  numero: { minWidth: '90px' },
  paciente: { minWidth: '140px', maxWidth: '200px' },
  total: { minWidth: '95px' },
  pagado: { minWidth: '95px' },
  saldo: { minWidth: '95px' },
  estado: { minWidth: '100px' },
  fecha: { minWidth: '95px' },
  acciones: { minWidth: '110px' },
};
