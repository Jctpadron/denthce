import Keycloak from 'keycloak-js';

// Configuración de conexión al contenedor Keycloak local
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: 'hce-realm',
  clientId: 'hce-app',
});

export default keycloak;
