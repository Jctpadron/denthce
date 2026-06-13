const { Client } = require('pg');

// Configuración por defecto: base de datos local
const configLocal = {
  host: 'localhost',
  port: 5432,
  user: 'hce_admin',
  password: 'hce_secure_password_2026',
  database: 'hce_fhir',
};

// Configuración de producción (RDS AWS)
const configProd = {
  host: 'hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'hce_admin',
  password: '*AndreA335*',
  database: 'hce_fhir',
  ssl: { rejectUnauthorized: false },
};

const isProd = process.env.ENV_PROD === 'true';
const client = new Client(isProd ? configProd : configLocal);

async function run() {
  console.log(`Conectando a base de datos de ${isProd ? 'PRODUCCIÓN (RDS)' : 'DESARROLLO (Local)'}...`);
  try {
    await client.connect();
    console.log('Conexión exitosa.');

    // 1. Buscar y eliminar restricciones de clave única tradicionales
    const dropConstraintsQueries = [
      'ALTER TABLE fhir_patients DROP CONSTRAINT IF EXISTS fhir_patients_dni_key',
      'ALTER TABLE fhir_patients DROP CONSTRAINT IF EXISTS unique_dni_tenant',
      'ALTER TABLE fhir_patients DROP CONSTRAINT IF EXISTS uq_patient_dni_gender_tenant',
    ];

    for (const q of dropConstraintsQueries) {
      console.log(`Ejecutando: ${q}`);
      await client.query(q);
    }

    // 2. Buscar y eliminar índices físicos únicos que limiten solo por dni
    console.log('Buscando índices únicos relacionados con la columna "dni"...');
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'fhir_patients' 
        AND indexdef LIKE '%unique%' 
        AND indexdef LIKE '%(dni)%';
    `;
    const indexResult = await client.query(indexQuery);
    
    for (const row of indexResult.rows) {
      const dropIndexQuery = `DROP INDEX IF EXISTS ${row.indexname}`;
      console.log(`Ejecutando: ${dropIndexQuery}`);
      await client.query(dropIndexQuery);
    }

    // 3. Crear el nuevo constraint compuesto UNIQUE (dni, gender, tenant_id)
    const createConstraintQuery = `
      ALTER TABLE fhir_patients 
      ADD CONSTRAINT uq_patient_dni_gender_tenant UNIQUE (dni, gender, tenant_id);
    `;
    console.log(`Ejecutando: ${createConstraintQuery}`);
    await client.query(createConstraintQuery);

    console.log('¡MIGRACIÓN COMPLETADA CON ÉXITO!');
  } catch (err) {
    console.error('ERROR durante la migración:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
