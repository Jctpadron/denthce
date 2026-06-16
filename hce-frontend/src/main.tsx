import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import keycloak from './utils/keycloak-config.ts';
import axios from 'axios';

// Configurar interceptor global de Axios para renovación de tokens de Keycloak
axios.interceptors.request.use(
  async (config) => {
    if (keycloak.authenticated && keycloak.token) {
      try {
        // Refrescar el token si expira en menos de 30 segundos
        await keycloak.updateToken(30);
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      } catch (error) {
        console.error('No se pudo refrescar el token de Keycloak automáticamente:', error);
        // Si el refresh token también expiró, forzar reautenticación
        keycloak.login();
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Render único de la app (guarda anti-doble-montaje entre el then/catch y la red de seguridad).
let appRendered = false;
function renderApp() {
  if (appRendered) return;
  appRendered = true;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Inicializar Keycloak antes de renderizar la aplicación React
keycloak
  .init({
    onLoad: 'check-sso',
    // Chequeo SSO silencioso vía iframe del MISMO origen (app.systia.ar/silent-check-sso.html).
    // Evita el login-status-iframe a auth.systia.ar, que en Android/móvil queda bloqueado por
    // las cookies de terceros → keycloak.init() colgaba y la app nunca renderizaba (pantalla en blanco).
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    checkLoginIframe: false,
    pkceMethod: 'S256',
  })
  .then(renderApp)
  .catch((err) => {
    // No bloquear la app si Keycloak no inicializa: igual mostramos la UI (landing/login).
    // El login real se dispara cuando el usuario lo pide (keycloak.login()).
    console.error('Error al inicializar Keycloak:', err);
    renderApp();
  });

// Red de seguridad: si por cualquier motivo la init de Keycloak no resuelve a tiempo
// (p.ej. iframe/cookies en móvil), renderizamos igual para no dejar pantalla en blanco.
setTimeout(renderApp, 8000);
