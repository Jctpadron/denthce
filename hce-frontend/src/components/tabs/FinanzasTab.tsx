import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, AlertCircle } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface FinanzasTabProps {
  patientId: string;
}

interface PresupuestoResumen {
  id: string; numero: string; fecha: string; total: number;
  pagado: number; saldo: number; estado: string;
}

interface CuentaCorriente {
  totalPresupuestado: number;
  totalPagado: number;
  deudaActual: number;
  presupuestos: PresupuestoResumen[];
}

const MONEY = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const badgeEstado = (estado: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    borrador: { background: 'color-mix(in srgb, var(--color-muted) 10%, transparent)', color: 'var(--color-muted)' },
    presentado: { background: 'color-mix(in srgb, var(--color-primary, var(--color-cyan)) 10%, transparent)', color: 'var(--color-primary, var(--color-cyan))' },
    aceptado: { background: 'color-mix(in srgb, var(--color-violet) 12%, transparent)', color: 'var(--color-violet)' },
    en_curso: { background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)', color: 'var(--color-amber)' },
    pagado: { background: 'color-mix(in srgb, var(--color-emerald) 12%, transparent)', color: 'var(--color-emerald)' },
    cancelado: { background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)', color: 'var(--color-rose)' },
    vencido: { background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)', color: 'var(--color-rose)' },
  };
  return { display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, ...(map[estado] || map.borrador) };
};

export const FinanzasTab: React.FC<FinanzasTabProps> = ({ patientId }) => {
  const [data, setData] = useState<CuentaCorriente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/clinica/finanzas/cuenta-corriente/${patientId}`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setData(res.data as CuentaCorriente);
    } catch {
      setError('No se pudo cargar la información financiera del paciente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [patientId]);

  if (loading) {
    return <p style={{ padding: '1.5rem', color: 'var(--color-muted)', fontSize: '0.88rem' }}>Cargando información financiera…</p>;
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem', color: 'var(--color-muted)' }}>
        <AlertCircle style={{ width: '2rem', height: '2rem', opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: '0.88rem' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { totalPresupuestado, totalPagado, deudaActual, presupuestos } = data;
  const presupuestosActivos = presupuestos.filter(p => !['pagado', 'cancelado'].includes(p.estado));

  const TH: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--color-muted)', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' };
  const TD: React.CSSProperties = { padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', verticalAlign: 'middle' };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: 'right' };
  const TD_CENTER: React.CSSProperties = { ...TD, textAlign: 'center' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '0.85rem' }}>
        <KpiMini value={MONEY(totalPresupuestado)} label="Total Presupuestado" color="var(--color-primary, var(--color-cyan))" />
        <KpiMini value={MONEY(totalPagado)} label="Total Pagado" color="var(--color-emerald)" />
        <KpiMini value={MONEY(deudaActual)} label={deudaActual > 0 ? 'Deuda Pendiente' : 'Saldo en Cero'} color={deudaActual > 0 ? 'var(--color-rose)' : 'var(--color-emerald)'} />
        <KpiMini value={`${presupuestosActivos.length}`} label="Presupuestos Activos" color="var(--color-violet)" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <DollarSign style={{ width: '0.9rem', height: '0.9rem' }} /> Presupuestos
        </h4>
        {presupuestos.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Este paciente no tiene presupuestos registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: '90px' }}>N°</th>
                  <th style={{ ...TH, width: '100px' }}>Fecha</th>
                  <th style={{ ...TH, width: '95px', textAlign: 'right' }}>Total</th>
                  <th style={{ ...TH, width: '95px', textAlign: 'right' }}>Pagado</th>
                  <th style={{ ...TH, width: '95px', textAlign: 'right' }}>Saldo</th>
                  <th style={{ ...TH, width: '110px', textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {presupuestos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ ...TD, fontWeight: 600 }}>{p.numero}</td>
                    <td style={TD}>{new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                    <td style={{ ...TD_RIGHT, fontWeight: 600 }}>{MONEY(p.total)}</td>
                    <td style={{ ...TD_RIGHT, color: 'var(--color-emerald)', fontWeight: 600 }}>{MONEY(p.pagado)}</td>
                    <td style={{ ...TD_RIGHT, fontWeight: 700, color: p.saldo > 0 ? 'var(--color-rose)' : 'var(--color-emerald)' }}>{MONEY(p.saldo)}</td>
                    <td style={TD_CENTER}><span style={badgeEstado(p.estado)}>{p.estado.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const KpiMini: React.FC<{ value: string; label: string; color: string }> = ({ value, label, color }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', position: 'relative', boxShadow: 'var(--shadow-sm)' }}>
    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: color, borderRadius: '3px 0 0 3px' }} aria-hidden="true" />
    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 600 }}>{label}</div>
  </div>
);
