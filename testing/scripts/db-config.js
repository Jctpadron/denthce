// ============================================================================
// db-config.js — configuración de conexión a la base para los scripts de
// mantenimiento. Las credenciales salen del entorno, NUNCA del código.
//
// Por qué (AUD.9): estos scripts traían el endpoint de RDS y la clave del
// usuario `hce_admin` de PRODUCCIÓN escritos en claro y versionados en git.
// Cualquiera con el repo tenía acceso directo a la base de todos los
// inquilinos, saltándose la aplicación, los guards y la auditoría.
//
// El host también es obligatorio a propósito: con el endpoint de producción
// como valor por defecto, correr uno de estos scripts sin pensarlo apuntaba a
// prod. Ahora hay que declarar explícitamente a dónde se apunta.
//
// Uso (PowerShell):
//   $env:DB_HOST="mi-instancia.rds.amazonaws.com"
//   $env:DB_PASSWORD="..."
//   node testing/scripts/create_production_tables.js
// ============================================================================

/** Lee una variable de entorno obligatoria o aborta con un mensaje claro. */
function requireEnv(name, descripcion) {
  const valor = process.env[name];
  if (!valor) {
    console.error(
      `\n[ERROR] Falta la variable de entorno ${name} (${descripcion}).\n` +
        `  PowerShell:  $env:${name}="<valor>"\n` +
        `  bash:        export ${name}="<valor>"\n`,
    );
    process.exit(1);
  }
  return valor;
}

/**
 * Conexión a una base remota (RDS). Exige host y clave por entorno.
 * @param {string} database nombre de la base por defecto de cada script
 */
function remoteConfig(database) {
  return {
    host: requireEnv('DB_HOST', 'endpoint de la instancia PostgreSQL'),
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'hce_admin',
    password: requireEnv('DB_PASSWORD', 'clave del usuario de la base'),
    database: process.env.DB_NAME || database,
    ssl: { rejectUnauthorized: false },
  };
}

/**
 * Conexión a la base local de desarrollo. La clave local sí admite un valor
 * por defecto: es la del docker-compose de desarrollo, no un secreto de prod.
 */
function localConfig(database) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'hce_admin',
    password: process.env.DB_PASSWORD || 'hce_secure_password_2026',
    database: process.env.DB_NAME || database,
  };
}

module.exports = { requireEnv, remoteConfig, localConfig };
