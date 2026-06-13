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
-- 1. Tabla de Auditoría de Pacientes
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

-- 2. Tabla de Consultas Clínicas (Encounter)
CREATE TABLE IF NOT EXISTS fhir_encounters (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id     varchar NOT NULL,
    tenant_id      varchar NOT NULL,
    status         varchar NOT NULL DEFAULT 'in-progress',
    class_code     varchar NOT NULL DEFAULT 'AMB',
    start_date     timestamp with time zone,
    end_date       timestamp with time zone,
    payload        jsonb,
    signed_by      varchar,
    signed_at      timestamp with time zone,
    content_hash   varchar,
    created_at     timestamp with time zone NOT NULL DEFAULT now(),
    updated_at     timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fhir_encounters_patient_tenant
    ON fhir_encounters (patient_id, tenant_id);

-- 3. Tabla de Recetas de Medicamentos (MedicationRequest)
CREATE TABLE IF NOT EXISTS fhir_medication_requests (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id     varchar NOT NULL,
    tenant_id      varchar NOT NULL,
    status         varchar NOT NULL DEFAULT 'draft',
    payload        jsonb NOT NULL,
    signed_by      varchar,
    signed_at      timestamp with time zone,
    content_hash   varchar,
    qr_code_data   varchar,
    created_at     timestamp with time zone NOT NULL DEFAULT now(),
    updated_at     timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fhir_medication_requests_patient_tenant
    ON fhir_medication_requests (patient_id, tenant_id);

-- 4. Tabla de Recursos de Odontología (módulo aislado)
CREATE TABLE IF NOT EXISTS odontology_clinical_resources (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      varchar NOT NULL,
    patient_id     varchar NOT NULL,
    resource_type  varchar NOT NULL,
    payload        jsonb NOT NULL,
    created_at     timestamp with time zone NOT NULL DEFAULT now(),
    updated_at     timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odontology_tenant_patient_type
    ON odontology_clinical_resources (tenant_id, patient_id, resource_type);
`;

async function main() {
  console.log('Conectando a RDS en producción (hce_fhir)...');
  try {
    await client.connect();
    console.log('Conexión exitosa. Ejecutando DDL de creación de tablas...');
    await client.query(DDL);
    console.log('Tablas creadas/verificadas.');

    // Verificar las tablas que existen actualmente en la base de datos
    const tablesCheck = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('\nTablas actuales en la base de datos de producción:');
    tablesCheck.rows.forEach((r) => console.log(`  - ${r.table_name}`));

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
