import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import keycloak from './utils/keycloak-config.ts';

// Inicializar Keycloak antes de renderizar la aplicación React
keycloak
  .init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
  })
  .then((authenticated) => {
    if (authenticated) {
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    } else {
      console.warn('Fallo en la autenticación con Keycloak.');
      window.location.reload();
    }
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
