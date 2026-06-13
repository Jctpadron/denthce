// =============================================================================
// Crea las tablas del módulo AISLADO de Historia Clínica Odontológica en RDS.
// Idempotente (IF NOT EXISTS). No toca ninguna tabla de la primera HC.
// Uso:  node testing/scripts/create_odontology_tables.js
// =============================================================================
const { Client } = require('pg');

const client = new Client({
  host: 'hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'hce_admin',
  password: '*AndreA335*',
  database: 'hce_fhir', // base principal de la app
  ssl: { rejectUnauthorized: false },
});

const DDL = `
CREATE TABLE IF NOT EXISTS odontology_clinical_resources (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     varchar NOT NULL,
    patient_id    varchar NOT NULL,
    resource_type varchar NOT NULL,
    payload       jsonb   NOT NULL,
    created_at    timestamp with time zone NOT NULL DEFAULT now(),
    updated_at    timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odontology_tenant_patient_type
    ON odontology_clinical_resources (tenant_id, patient_id, resource_type);
`;

async function main() {
  console.log('Conectando a RDS (hce_fhir)...');
  try {
    await client.connect();
    console.log('Conexión exitosa. Creando tabla odontology_clinical_resources...');
    await client.query(DDL);

    const check = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'odontology_clinical_resources' ORDER BY ordinal_position",
    );
    console.log('Tabla verificada. Columnas:');
    check.rows.forEach((r) => console.log(`  - ${r.column_name} (${r.data_type})`));
    console.log('OK: módulo odontológico listo para persistir datos.');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
