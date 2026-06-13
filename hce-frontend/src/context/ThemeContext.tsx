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

// Aplica las variables CSS dinámicamente en :root
function applyTheme(config: TenantConfig) {
  const root = document.documentElement;
  const rgb = hexToRgb(config.primaryColor);

  root.style.setProperty('--color-cyan', config.primaryColor);
  root.style.setProperty('--color-cyan-rgb', rgb);
  root.style.setProperty('--color-primary', config.primaryColor);

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
