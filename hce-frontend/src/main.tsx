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

// Inicializar Keycloak antes de renderizar la aplicación React
keycloak
  .init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
  })
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error('Error al inicializar Keycloak:', err);
    document.getElementById('root')!.innerHTML = `
      <div style="background-color: #020617; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 2rem;">
        <h2 style="color: #f43f5e; font-size: 1.8rem; margin-bottom: 1rem;">⚠️ Error de Conexión de Seguridad</h2>
        <p style="color: #94a3b8; max-width: 500px; margin-bottom: 2rem;">No se pudo establecer conexión con el servidor de identidad Keycloak. Por favor, asegúrate de que el contenedor de Docker esté encendido.</p>
        <button onclick="window.location.reload()" style="background: linear-gradient(135deg, #06b6d4, #10b981); color: #020617; font-weight: bold; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Reintentar Conexión</button>
      </div>
    `;
  });
