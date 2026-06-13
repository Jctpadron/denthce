const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'hce_admin',
  password: 'hce_secure_password_2026',
  database: 'hce_fhir',
});

async function run() {
  try {
    await client.connect();
    
    // 1. Listar Constraints
    console.log('--- RESTRICCIONES (CONSTRAINTS) ---');
    const constraintsQuery = `
      SELECT conname, pg_get_constraintdef(oid) as condef
      FROM pg_constraint
      WHERE conrelid = 'fhir_patients'::regclass;
    `;
    const constraints = await client.query(constraintsQuery);
    constraints.rows.forEach(r => {
      console.log(`  Constraint: ${r.conname} -> ${r.condef}`);
    });

    // 2. Listar Índices
    console.log('\n--- ÍNDICES (INDEXES) ---');
    const indexesQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'fhir_patients';
    `;
    const indexes = await client.query(indexesQuery);
    indexes.rows.forEach(r => {
      console.log(`  Index: ${r.indexname} -> ${r.indexdef}`);
    });

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await client.end();
  }
}

run();
