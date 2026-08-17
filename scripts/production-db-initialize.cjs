#!/usr/bin/env node

const { Client } = require('../hce-backend/node_modules/pg');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeAudit = args.has('--include-audit');

const requiredConfirmation = 'CONFIRMO_INICIALIZAR_PRODUCCION';
const confirmation = process.env.ALLOW_PROD_DB_INITIALIZE;

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || process.env.DB_USERNAME || 'hce_admin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'hce_fhir',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const preservedTables = [
  'tenant_config',
  'platform_modules',
  'tenant_modules',
  'insurance_companies',
  'clinica_precios',
  'protesis_insumos',
];

const operationalTables = [
  'clinical_attachments',
  'odontology_patient_signatures',
  'odontology_clinical_resources',
  'odontology_encounters',
  'clinica_pagos',
  'clinica_presupuesto_items',
  'clinica_presupuestos',
  'clinica_gastos',
  'protesis_consumo_insumos',
  'protesis_pagos',
  'protesis_status_history',
  'protesis_chats',
  'protesis_orders',
  'appointment_audit_log',
  'fhir_appointments',
  'patient_coverages',
  'patient_audit_log',
  'fhir_medication_requests',
  'fhir_clinical_resources',
  'fhir_encounters',
  'fhir_patients',
];

const auditTables = [
  'clinical_evidence_audit_log',
  'odontology_encounter_audit_log',
  'clinical_audit_events',
];

const allKnownTables = [...preservedTables, ...operationalTables, ...auditTables];

function quoteIdent(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function existingTables(tables) {
  const result = await client.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = ANY($1::text[])
     ORDER BY tablename`,
    [tables],
  );
  return new Set(result.rows.map((row) => row.tablename));
}

async function countRows(table) {
  const result = await client.query(`SELECT count(*)::bigint AS count FROM ${quoteIdent(table)}`);
  return Number(result.rows[0].count);
}

async function printCounts(title, tables) {
  const rows = [];
  const existing = await existingTables(tables);
  for (const table of tables) {
    rows.push({
      tabla: table,
      existe: existing.has(table) ? 'si' : 'no',
      filas: existing.has(table) ? await countRows(table) : null,
    });
  }
  console.log(`\n${title}`);
  console.table(rows);
}

async function truncateTables(tables) {
  const existing = await existingTables(tables);
  const present = tables.filter((table) => existing.has(table));
  if (!present.length) return;
  const quotedTables = present.map(quoteIdent).join(', ');
  await client.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
}

async function main() {
  if (!process.env.DB_HOST || !process.env.DB_PASSWORD) {
    throw new Error('Faltan DB_HOST y/o DB_PASSWORD en el entorno.');
  }

  await client.connect();

  const tablesToClean = includeAudit ? [...operationalTables, ...auditTables] : operationalTables;

  console.log('Inicializacion controlada de base de datos productiva HCE');
  console.log(`Modo: ${apply ? 'APLICAR' : 'VISTA PREVIA'}`);
  console.log(`Auditoria WORM/testing: ${includeAudit ? 'se limpiara' : 'se conservara'}`);
  console.log(`Tablas a conservar: ${preservedTables.join(', ')}`);
  console.log(`Tablas a limpiar: ${tablesToClean.join(', ')}`);

  await printCounts('Conteos antes', allKnownTables);

  if (!apply) {
    console.log('\nNo se aplicaron cambios. Para ejecutar: agregar --apply y ALLOW_PROD_DB_INITIALIZE=CONFIRMO_INICIALIZAR_PRODUCCION.');
    return;
  }

  if (confirmation !== requiredConfirmation) {
    throw new Error(`Confirmacion ausente. Definir ALLOW_PROD_DB_INITIALIZE=${requiredConfirmation}`);
  }

  await client.query('BEGIN');
  try {
    await truncateTables(tablesToClean);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  await printCounts('Conteos despues', allKnownTables);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      // noop
    }
  });
