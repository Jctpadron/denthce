import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ShieldAlert } from 'lucide-react';
import keycloak from '../utils/keycloak-config';

type ClinicalResource = {
  id?: string;
  resourceType?: string;
  clinicalStatus?: { coding?: { code?: string }[] };
  criticality?: string;
  code?: { text?: string; coding?: { display?: string }[] };
  reaction?: { manifestation?: { coding?: { display?: string }[] }[] }[];
  note?: { text?: string }[];
};

type ClinicalAlertsProps = {
  patientId?: string | null;
  resources?: ClinicalResource[];
  compact?: boolean;
  title?: string;
};

const CRITICALITY_LABELS: Record<string, string> = {
  high: 'Alta',
  low: 'Baja',
  'unable-to-assess': 'No evaluada',
};
const EMPTY_CLINICAL_RESOURCES: ClinicalResource[] = [];

function isActive(resource: ClinicalResource) {
  const status = resource.clinicalStatus?.coding?.[0]?.code;
  return !status || status === 'active';
}

function isCriticalAllergy(resource: ClinicalResource) {
  return resource.resourceType === 'AllergyIntolerance' && resource.criticality === 'high' && isActive(resource);
}

function allergyName(resource: ClinicalResource) {
  return resource.code?.text || resource.code?.coding?.[0]?.display || 'Alergia sin nombre';
}

function reactionText(resource: ClinicalResource) {
  return resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || resource.note?.[0]?.text || '';
}

export function ClinicalAlerts({ patientId, resources, compact = false, title = 'Alertas clinicas criticas' }: ClinicalAlertsProps) {
  const [loaded, setLoaded] = useState<{ patientId?: string | null; resources: ClinicalResource[] }>({ resources: [] });

  useEffect(() => {
    if (resources || !patientId) return;
    let mounted = true;
    axios
      .get(`${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      })
      .then((res) => {
        if (mounted) setLoaded({ patientId, resources: res.data || [] });
      })
      .catch(() => {
        if (mounted) setLoaded({ patientId, resources: [] });
      });
    return () => {
      mounted = false;
    };
  }, [patientId, resources]);

  const currentResources = resources || (loaded.patientId === patientId ? loaded.resources : EMPTY_CLINICAL_RESOURCES);
  const alerts = useMemo(
    () => currentResources.filter(isCriticalAllergy),
    [currentResources],
  );

  if (alerts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '0.45rem' : '0.65rem',
        padding: compact ? '0.75rem 0.85rem' : '0.9rem 1rem',
        borderRadius: '12px',
        border: '1px solid color-mix(in srgb, var(--color-rose) 28%, transparent)',
        background: 'color-mix(in srgb, var(--color-rose) 9%, var(--bg-surface))',
        color: 'var(--color-text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: 800, fontSize: compact ? '0.8rem' : '0.9rem' }}>
        <ShieldAlert style={{ width: compact ? '1rem' : '1.1rem', height: compact ? '1rem' : '1.1rem', color: 'var(--color-rose)', flexShrink: 0 }} />
        <span>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {alerts.map((alert, index) => {
          const reaction = reactionText(alert);
          const criticality = CRITICALITY_LABELS[alert.criticality || ''] || 'Alta';
          return (
            <div key={alert.id || `${allergyName(alert)}-${index}`} style={{ fontSize: compact ? '0.78rem' : '0.84rem', lineHeight: 1.4 }}>
              <strong>Alergia critica:</strong> {allergyName(alert)} <span style={{ color: 'var(--color-muted)' }}>({criticality})</span>
              {reaction ? <span style={{ color: 'var(--color-muted)' }}> - {reaction}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
