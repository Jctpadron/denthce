const { Client } = require('pg');

const client = new Client({
  host: 'hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'hce_admin',
  password: '*AndreA335*',
  database: 'hce_fhir',
  ssl: { rejectUnauthorized: false },
});

const DDL = `
CREATE TABLE IF NOT EXISTS patient_audit_log (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id         varchar NOT NULL,
    tenant_id          varchar NOT NULL,
    user_id            varchar,
    user_name          varchar,
    action             varchar NOT NULL,
    changed_fields     jsonb,
    payload_snapshot   jsonb,
    created_at         timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_audit_patient_tenant
    ON patient_audit_log (patient_id, tenant_id);
`;

async function main() {
  console.log('Conectando a RDS en producción (hce_fhir)...');
  try {
    await client.connect();
    console.log('Conexión exitosa. Creando tabla patient_audit_log si no existe...');
    await client.query(DDL);
    console.log('Tabla creada o ya existente.');

    // Verificar las tablas que existen actualmente en la base de datos
    const tablesCheck = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Tablas actuales en la base de datos:');
    tablesCheck.rows.forEach((r) => console.log(`  - ${r.table_name}`));

    // Verificar columnas de patient_audit_log
    const checkColumns = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patient_audit_log' ORDER BY ordinal_position"
    );
    console.log('\nColumnas de patient_audit_log:');
    checkColumns.rows.forEach((r) => console.log(`  - ${r.column_name} (${r.data_type})`));

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
