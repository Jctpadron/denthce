import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import keycloak from '../utils/keycloak-config';

export interface TenantConfig {
  tenantId: string;
  clinicName: string;
  specialty: string;
  logoUrl: string | null;
  primaryColor: string;
  darkMode: boolean;
  doctorName: string;
  doctorLicense: string;
  doctorTitle: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  cuit: string;
  healthInsurance: string;
  scheduleJson: Record<string, string>;
  signatureUrl: string | null;
  hceWebhookSecret: string | null;
}

const DEFAULT_CONFIG: TenantConfig = {
  tenantId: '',
  clinicName: 'Mi Consultorio',
  specialty: 'Odontología General',
  logoUrl: null,
  primaryColor: '#0284c7',
  darkMode: false,
  doctorName: '',
  doctorLicense: '',
  doctorTitle: 'Dr.',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  phone: '',
  email: '',
  cuit: '',
  healthInsurance: '',
  scheduleJson: {
    lunes: '09:00-18:00',
    martes: '09:00-18:00',
    miercoles: '09:00-18:00',
    jueves: '09:00-18:00',
    viernes: '09:00-18:00',
    sabado: '',
    domingo: '',
  },
  signatureUrl: null,
  hceWebhookSecret: null,
};

interface ThemeContextValue {
  config: TenantConfig;
  loading: boolean;
  reload: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  config: DEFAULT_CONFIG,
  loading: true,
  reload: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

// Convierte un color hex en componentes RGB para efectos de opacidad en CSS
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '2, 132, 199';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

// ---- Contraste WCAG (white-label) ----
// El color de marca del tenant suele fallar contraste 4.5:1 sobre blanco cuando se
// usa como TEXTO chico. Derivamos `--accent-text`: el mismo tono, oscurecido lo
// mínimo necesario para cumplir AA. El acento puro se reserva para rellenos/íconos/títulos.
function parseHex(hex: string): [number, number, number] | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return null;
  return [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)];
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
// Contraste contra la superficie BASE de la app (--bg-base #e9edf3), no blanco puro:
// es la superficie más exigente donde aparece texto de acento (footer, links sobre el fondo).
// Si pasa sobre la base, pasa también sobre las tarjetas blancas.
const BASE_BG_L = relLuminance([233, 237, 243]);
function contrastOnBase(rgb: [number, number, number]): number {
  const L = relLuminance(rgb);
  return (BASE_BG_L + 0.05) / (L + 0.05);
}
function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}
// Oscurece el color (escalando hacia negro) hasta alcanzar el ratio objetivo sobre la base.
function accentTextFor(hex: string, target = 4.5): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#075985';
  if (contrastOnBase(rgb) >= target) return hex;
  let factor = 1;
  for (let i = 0; i < 40; i++) {
    factor -= 0.025;
    const next: [number, number, number] = [rgb[0] * factor, rgb[1] * factor, rgb[2] * factor];
    if (contrastOnBase(next) >= target) return toHex(next);
  }
  return '#1e293b'; // fallback charcoal (siempre AA)
}

// Aplica las variables CSS dinámicamente en :root
function applyTheme(config: TenantConfig) {
  const root = document.documentElement;
  const rgb = hexToRgb(config.primaryColor);

  root.style.setProperty('--color-cyan', config.primaryColor);
  root.style.setProperty('--color-cyan-rgb', rgb);
  root.style.setProperty('--color-primary', config.primaryColor);
  // Variante con contraste AA garantizado para texto chico sobre blanco (white-label).
  root.style.setProperty('--accent-text', accentTextFor(config.primaryColor));

  // Título de la pestaña del navegador
  document.title = config.clinicName || 'DentHCE';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<TenantConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!keycloak.token) return;
    try {
      const res = await axios.get(import.meta.env.VITE_API_URL + '/api/tenant/config', {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      const data: TenantConfig = res.data;
      setConfig(data);
      applyTheme(data);
    } catch (e) {
      console.warn('No se pudo cargar la configuración del tenant, usando valores por defecto.', e);
      applyTheme(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <ThemeContext.Provider value={{ config, loading, reload }}>
      {children}
    </ThemeContext.Provider>
  );
};
