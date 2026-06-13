import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, LayoutDashboard, Building2, Users, CalendarClock, Plus, X,
  CheckCircle2, XCircle, Settings2, Loader2, LogOut, AlertTriangle,
  FileText, CalendarDays, MessageCircle, Stethoscope, Boxes,
} from 'lucide-react';

/** Ícono representativo de cada módulo del catálogo (para el modal de gestión). */
function moduleIcon(key: string): React.ReactNode {
  const s = { width: '1.15rem', height: '1.15rem' };
  switch (key) {
    case 'hc-base': return <FileText style={s} />;
    case 'agenda': return <CalendarDays style={s} />;
    case 'whatsapp': return <MessageCircle style={s} />;
    case 'odontologia-pami': return <Stethoscope style={s} />;
    default: return <Boxes style={s} />;
  }
}
import keycloak from '../../utils/keycloak-config';
import {
  saGetMetrics, saGetClinics, saGetCatalog, saCreateClinic, saSetModule,
  type SaMetrics, type SaClinic, type SaModule,
} from './superadmin-api';

type Tab = 'overview' | 'clinics';

export const SuperAdminPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [metrics, setMetrics] = useState<SaMetrics | null>(null);
  const [clinics, setClinics] = useState<SaClinic[]>([]);
  const [catalog, setCatalog] = useState<SaModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modulesFor, setModulesFor] = useState<SaClinic | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, c, cat] = await Promise.all([saGetMetrics(), saGetClinics(), saGetCatalog()]);
      setMetrics(m);
      setClinics(c);
      setCatalog(cat);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'No tenés permisos de Super Admin.' : 'Error al cargar la plataforma.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const username = keycloak.tokenParsed?.preferred_username || 'Super Admin';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base, #f8fafc)', color: 'var(--color-text)', fontFamily: 'var(--font-title), system-ui, sans-serif' }}>
      {/* Cabecera */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.5rem', background: '#fff', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '2.2rem', height: '2.2rem', borderRadius: '10px', background: 'linear-gradient(135deg, #2962ff, #00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield style={{ width: '1.2rem', height: '1.2rem', color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Super Admin · DentHCE</h1>
            <span style={{ fontSize: '0.66rem', color: '#2962ff', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Plataforma SaaS</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600 }}>{username}</span>
          <button onClick={() => keycloak.logout()} className="btn btn-secondary" style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-rose)' }}>
            <LogOut style={{ width: '0.9rem', height: '0.9rem' }} /> Salir
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Tabs */}
        <div className="segmented-control" style={{ alignSelf: 'flex-start' }}>
          <button onClick={() => setTab('overview')} className={`segmented-button ${tab === 'overview' ? 'active' : ''}`}>
            <LayoutDashboard style={{ width: '0.95rem', height: '0.95rem' }} /> Resumen
          </button>
          <button onClick={() => setTab('clinics')} className={`segmented-button ${tab === 'clinics' ? 'active' : ''}`}>
            <Building2 style={{ width: '0.95rem', height: '0.95rem' }} /> Clínicas
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '0.8rem 1rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertTriangle style={{ width: '1rem', height: '1rem' }} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-muted)' }}>
            <Loader2 style={{ width: '2rem', height: '2rem', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '0.5rem' }}>Cargando plataforma...</p>
          </div>
        ) : tab === 'overview' ? (
          <Overview metrics={metrics} clinics={clinics} />
        ) : (
          <ClinicsTab
            clinics={clinics}
            onManageModules={(c) => setModulesFor(c)}
            onNew={() => setCreateOpen(true)}
          />
        )}
      </div>

      {modulesFor && (
        <ModulesModal
          clinic={modulesFor}
          catalog={catalog}
          onClose={() => setModulesFor(null)}
          onChanged={load}
        />
      )}
      {createOpen && (
        <CreateClinicModal onClose={() => setCreateOpen(false)} onCreated={load} />
      )}
    </div>
  );
};

// ---------------- Resumen ----------------
const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }> = ({ icon, label, value, sub, color }) => (
  <div className="card-premium-health" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', textAlign: 'center' }}>
    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.03em' }}>{label}</span>
    {sub && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>{sub}</span>}
    <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{value}</span>
    <div style={{ width: '2.6rem', height: '2.6rem', borderRadius: '50%', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, marginTop: '0.2rem' }}>{icon}</div>
  </div>
);

const Overview: React.FC<{ metrics: SaMetrics | null; clinics: SaClinic[] }> = ({ metrics, clinics }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
      <MetricCard icon={<Building2 style={{ width: '1.15rem', height: '1.15rem' }} />} label="Clínicas activas" value={metrics ? `${metrics.activeClinics} / ${metrics.totalClinics}` : '—'} color="#059669" />
      <MetricCard icon={<Users style={{ width: '1.15rem', height: '1.15rem' }} />} label="Pacientes totales" value={metrics?.totalPatients ?? '—'} color="#2962ff" />
      <MetricCard icon={<CalendarClock style={{ width: '1.15rem', height: '1.15rem' }} />} label="Turnos totales" value={metrics?.totalAppointments ?? '—'} color="#7c3aed" />
      <MetricCard icon={<Shield style={{ width: '1.15rem', height: '1.15rem' }} />} label="Plan más común" sub={planStats(clinics).label} value={planStats(clinics).pct} color="#d97706" />
    </div>
  </div>
);

const PLAN_LABELS: Record<string, string> = { basic: 'Plan Básico', pro: 'Plan Pro', enterprise: 'Plan Enterprise' };

function planStats(clinics: SaClinic[]): { label: string; pct: string } {
  if (clinics.length === 0) return { label: '—', pct: '—' };
  const counts: Record<string, number> = {};
  clinics.forEach((c) => { counts[c.plan] = (counts[c.plan] || 0) + 1; });
  const [topPlan, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return {
    label: (PLAN_LABELS[topPlan] || topPlan).toUpperCase(),
    pct: `${Math.round((topCount / clinics.length) * 100)}%`,
  };
}

// ---------------- Clínicas ----------------
const ClinicsTab: React.FC<{ clinics: SaClinic[]; onManageModules: (c: SaClinic) => void; onNew: () => void }> = ({ clinics, onManageModules, onNew }) => (
  <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Clínicas ({clinics.length})</h3>
      <button onClick={onNew} className="btn btn-primary" style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}>
        <Plus style={{ width: '1rem', height: '1rem' }} /> Nueva clínica
      </button>
    </div>
    {clinics.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
        No hay clínicas registradas todavía.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {clinics.map((c) => (
          <div key={c.tenantId} className="card-premium-health" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{c.clinicName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>{c.tenantId}</div>
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(41,98,255,0.08)', color: '#2962ff', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>{c.plan}</span>
            {c.isActive ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}><CheckCircle2 style={{ width: '0.85rem', height: '0.85rem' }} /> Activa</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}><XCircle style={{ width: '0.85rem', height: '0.85rem' }} /> Inactiva</span>
            )}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: 1, minWidth: '160px' }}>
              {c.modules.map((m) => (
                <span key={m} style={{ fontSize: '0.66rem', fontWeight: 600, background: 'rgba(5,150,105,0.08)', color: '#059669', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>{m}</span>
              ))}
            </div>
            <button onClick={() => onManageModules(c)} className="btn btn-secondary" style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Settings2 style={{ width: '0.85rem', height: '0.85rem' }} /> Módulos
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ---------------- Modal: gestión de módulos (anexar/baja) ----------------
const ModulesModal: React.FC<{ clinic: SaClinic; catalog: SaModule[]; onClose: () => void; onChanged: () => void }> = ({ clinic, catalog, onClose, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState<string[]>(clinic.modules);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async (mod: SaModule) => {
    const isOn = active.includes(mod.key);
    setBusy(mod.key);
    setErr(null);
    try {
      await saSetModule(clinic.tenantId, mod.key, !isOn);
      setActive((prev) => (isOn ? prev.filter((k) => k !== mod.key) : [...prev, mod.key]));
      onChanged();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'No se pudo actualizar el módulo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Módulos · {clinic.clinicName}</h3>
        <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '10px' }}><X style={{ width: '1.1rem', height: '1.1rem' }} /></button>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.3rem 0 0' }}>Anexá o dá de baja los servicios contratados por esta clínica.</p>
      {err && <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.5rem' }}>
        {catalog.map((mod) => {
          const on = active.includes(mod.key);
          return (
            <div key={mod.key} className="card-premium-health" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.75rem 0.9rem', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '2.6rem', height: '2.6rem', borderRadius: '12px', background: 'rgba(41,98,255,0.06)', color: '#2962ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {moduleIcon(mod.key)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {mod.name}
                  {mod.isBase && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'rgba(100,116,139,0.1)', color: 'var(--color-muted)', padding: '0.1rem 0.35rem', borderRadius: '5px', textTransform: 'uppercase' }}>base</span>}
                </div>
                {mod.description && <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>{mod.description}</div>}
              </div>
              {/* Toggle */}
              <button
                onClick={() => !mod.isBase && toggle(mod)}
                disabled={mod.isBase || busy === mod.key}
                title={mod.isBase ? 'Módulo base (no se da de baja)' : on ? 'Dar de baja' : 'Anexar'}
                style={{
                  width: '3rem', height: '1.7rem', borderRadius: '999px', border: 'none', flexShrink: 0,
                  cursor: mod.isBase ? 'not-allowed' : 'pointer', position: 'relative',
                  background: on ? '#2962ff' : 'var(--border-color)', opacity: mod.isBase ? 0.5 : 1,
                  transition: 'var(--transition-smooth)',
                }}
              >
                <span style={{ position: 'absolute', top: '0.2rem', left: on ? '1.5rem' : '0.2rem', width: '1.3rem', height: '1.3rem', borderRadius: '50%', background: '#fff', transition: 'left 0.18s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {busy === mod.key && <Loader2 style={{ width: '0.8rem', height: '0.8rem', color: '#2962ff', animation: 'spin 1s linear infinite' }} />}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </Overlay>
  );
};

// ---------------- Modal: crear clínica ----------------
const CreateClinicModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [f, setF] = useState({ tenantId: '', name: '', plan: 'basic', adminUsername: '', adminEmail: '', adminFirstName: '', adminLastName: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      const res = await saCreateClinic(f);
      setOk(res.adminCreated ? `Clínica creada. Admin: ${f.adminUsername}` : `Clínica creada, pero el admin falló: ${res.adminError}`);
      onCreated();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'No se pudo crear la clínica.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Nueva clínica</h3>
        <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '10px' }}><X style={{ width: '1.1rem', height: '1.1rem' }} /></button>
      </div>
      {err && <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>{err}</div>}
      {ok && <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle2 style={{ width: '0.9rem', height: '0.9rem' }} /> {ok}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Nombre de la clínica" value={f.name} onChange={(v) => set('name', v)} placeholder="Clínica Santa Lucía" full />
        <Field label="Tenant ID (identificador)" value={f.tenantId} onChange={(v) => set('tenantId', v)} placeholder="clinica_santa_lucia" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={labelStyle}>Plan</label>
          <select className="search-input" value={f.plan} onChange={(e) => set('plan', e.target.value)} style={{ color: 'var(--color-text)' }}>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <Field label="Usuario admin" value={f.adminUsername} onChange={(v) => set('adminUsername', v)} placeholder="admin_lucia" />
        <Field label="Email admin" value={f.adminEmail} onChange={(v) => set('adminEmail', v)} placeholder="admin@lucia.com" />
        <Field label="Nombre" value={f.adminFirstName} onChange={(v) => set('adminFirstName', v)} placeholder="Ana" />
        <Field label="Apellido" value={f.adminLastName} onChange={(v) => set('adminLastName', v)} placeholder="Pérez" />
      </div>
      <button onClick={submit} disabled={busy || !f.name || !f.tenantId || !f.adminUsername || !f.adminEmail} className="btn btn-primary" style={{ padding: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
        {busy ? <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} /> : <Plus style={{ width: '1rem', height: '1rem' }} />}
        Crear clínica
      </button>
    </Overlay>
  );
};

const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' };

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean }> = ({ label, value, onChange, placeholder, full }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: full ? '1 / -1' : undefined }}>
    <label style={labelStyle}>{label}</label>
    <input className="search-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.15s ease' }}>
    <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem', animation: 'slideIn 0.2s ease' }}>
      {children}
    </div>
  </div>
);
