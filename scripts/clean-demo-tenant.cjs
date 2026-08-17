#!/usr/bin/env node

const { randomUUID } = require('crypto');
const { Client } = require('../hce-backend/node_modules/pg');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
const tenantId = tenantArg ? tenantArg.slice('--tenant='.length) : 'mi_consultorio_dent_hce';

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'hce_admin',
  password: process.env.DB_PASSWORD || 'hce_secure_password_2026',
  database: process.env.DB_NAME || 'hce_fhir',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const demoPatients = [
  { dni: '91010001', family: 'Mendez', given: 'Sofia', gender: 'female', birthDate: '1988-04-12', reason: 'Control odontologico integral', coverage: 'OSDE Plan 210' },
  { dni: '91010002', family: 'Herrera', given: 'Lucas', gender: 'male', birthDate: '1979-09-03', reason: 'Rehabilitacion con corona', coverage: 'PAMI' },
  { dni: '91010003', family: 'Rojas', given: 'Valentina', gender: 'female', birthDate: '1996-01-24', reason: 'Ortodoncia y limpieza', coverage: 'Particular' },
  { dni: '91010004', family: 'Castro', given: 'Mateo', gender: 'male', birthDate: '2012-06-18', reason: 'Sellantes y control preventivo', coverage: 'Swiss Medical' },
  { dni: '91010005', family: 'Benitez', given: 'Camila', gender: 'female', birthDate: '1968-11-30', reason: 'Protesis parcial removible', coverage: 'IOMA' },
  { dni: '91010006', family: 'Pereyra', given: 'Tomas', gender: 'male', birthDate: '2001-02-07', reason: 'Urgencia por dolor molar', coverage: 'Particular' },
];

const tablesToCount = [
  'tenant_config',
  'fhir_patients',
  'fhir_clinical_resources',
  'fhir_encounters',
  'fhir_medication_requests',
  'fhir_appointments',
  'appointment_audit_log',
  'patient_audit_log',
  'patient_coverages',
  'odontology_clinical_resources',
  'odontology_encounters',
  'odontology_encounter_audit_log',
  'odontology_patient_signatures',
  'clinical_attachments',
  'clinical_evidence_audit_log',
  'clinica_precios',
  'clinica_presupuesto_items',
  'clinica_presupuestos',
  'clinica_pagos',
  'clinica_gastos',
  'protesis_orders',
];

async function countTable(table) {
  try {
    const column = table === 'protesis_orders' ? 'tenant_id' : 'tenant_id';
    const result = await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${column} = $1`, [tenantId]);
    return result.rows[0].count;
  } catch {
    return null;
  }
}

async function deleteIfExists(sql, params = [tenantId]) {
  const match = /\bFROM\s+([a-zA-Z0-9_]+)/i.exec(sql);
  if (match) {
    const exists = await client.query('SELECT to_regclass($1) AS table_name', [match[1]]);
    if (!exists.rows[0].table_name) return 0;
  }
  try {
    const result = await client.query(sql, params);
    return result.rowCount;
  } catch (error) {
    if (/does not exist|no existe/i.test(error.message)) return 0;
    throw error;
  }
}

function patientPayload(patient) {
  return {
    resourceType: 'Patient',
    active: true,
    identifier: [{ system: 'urn:ar:dni:systia-synthetic', value: patient.dni }],
    name: [{ use: 'official', family: patient.family, given: [patient.given] }],
    gender: patient.gender,
    birthDate: patient.birthDate,
    extension: [
      { url: 'https://systia.ar/fhir/StructureDefinition/synthetic-patient', valueBoolean: true },
      { url: 'https://systia.ar/fhir/StructureDefinition/presentation-reason', valueString: patient.reason },
    ],
  };
}

function appointmentPayload(appt) {
  return {
    resourceType: 'Appointment',
    status: appt.status,
    serviceType: [{ text: appt.serviceType }],
    start: appt.start.toISOString(),
    end: appt.end.toISOString(),
    participant: [
      { actor: { reference: `Patient/${appt.patientId}`, display: appt.patientName }, status: 'accepted' },
      { actor: { display: appt.practitionerName }, status: 'accepted' },
    ],
  };
}

async function seedDemo() {
  await client.query(
    `INSERT INTO tenant_config (
      tenant_id, clinic_name, specialty, logo_url, primary_color, doctor_name,
      doctor_license, doctor_title, address, city, province, postal_code, phone,
      email, cuit, health_insurance, schedule_json, updated_at
    ) VALUES (
      $1, 'Centro Odontologico Systia', 'Odontologia Integral Digital', NULL, '#1e6fd9',
      'Laura Mendez', 'MP 12458', 'Dra.', 'Av. Belgrano 1240',
      'San Salvador de Jujuy', 'Jujuy', '4600', '+54 388 555-0100',
      'contacto@systia.ar', '30-00000000-0', 'Cobertura segun paciente',
      '{"lunes":"09:00-18:00","martes":"09:00-18:00","miercoles":"09:00-18:00","jueves":"09:00-18:00","viernes":"09:00-16:00","sabado":"09:00-13:00","domingo":""}'::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      clinic_name = EXCLUDED.clinic_name,
      specialty = EXCLUDED.specialty,
      logo_url = EXCLUDED.logo_url,
      primary_color = EXCLUDED.primary_color,
      doctor_name = EXCLUDED.doctor_name,
      doctor_license = EXCLUDED.doctor_license,
      doctor_title = EXCLUDED.doctor_title,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      province = EXCLUDED.province,
      postal_code = EXCLUDED.postal_code,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      cuit = EXCLUDED.cuit,
      health_insurance = EXCLUDED.health_insurance,
      schedule_json = EXCLUDED.schedule_json,
      updated_at = CURRENT_TIMESTAMP`,
    [tenantId],
  );

  const inserted = [];
  for (const patient of demoPatients) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO fhir_patients (id, active, tenant_id, dni, family_name, given_name, gender, birth_date, payload)
       VALUES ($1, true, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [id, tenantId, patient.dni, patient.family, patient.given, patient.gender, patient.birthDate, JSON.stringify(patientPayload(patient))],
    );
    inserted.push({ ...patient, id });
  }

  const now = new Date();
  for (let i = 0; i < inserted.length; i++) {
    const patient = inserted[i];
    const start = new Date(now);
    start.setDate(start.getDate() + (i < 3 ? 1 : 2));
    start.setHours(9 + i, i % 2 === 0 ? 0 : 30, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 45);
    const appt = {
      patientId: patient.id,
      patientName: `${patient.given} ${patient.family}`,
      status: i === 0 ? 'arrived' : 'booked',
      serviceType: patient.reason,
      practitionerName: 'Dra. Laura Mendez',
      start,
      end,
    };
    await client.query(
      `INSERT INTO fhir_appointments (
        tenant_id, patient_id, patient_dni, status, practitioner_ref, practitioner_name,
        service_type, start_date, end_date, origin_channel, idempotency_key, priority, payload
      ) VALUES ($1, $2, $3, $4, 'Practitioner/demo-laura-mendez', $5, $6, $7, $8, 'recepcion', $9, $10, $11::jsonb)`,
      [
        tenantId,
        patient.id,
        patient.dni,
        appt.status,
        appt.practitionerName,
        appt.serviceType,
        appt.start,
        appt.end,
        `demo-clean-${tenantId}-${patient.dni}`,
        i === 5 ? 2 : null,
        JSON.stringify(appointmentPayload(appt)),
      ],
    );
  }

  const prices = [
    ['23450005', 'Restauracion con composite', 45000],
    ['52765003', 'Limpieza dental / tartrectomia', 28000],
    ['234947007', 'Endodoncia', 120000],
    ['768577005', 'Corona provisoria / definitiva', 180000],
    ['81733005', 'Extraccion dentaria simple', 52000],
  ];
  for (const [code, display, price] of prices) {
    await client.query(
      `INSERT INTO clinica_precios (tenant_id, snomed_code, snomed_display, precio, active)
       VALUES ($1, $2, $3, $4, true)`,
      [tenantId, code, display, price],
    );
  }

  await client.query(
    `INSERT INTO tenant_modules (tenant_id, module_key, enabled, activated_at)
     VALUES
       ($1, 'hc-base', true, CURRENT_TIMESTAMP),
       ($1, 'agenda', true, CURRENT_TIMESTAMP),
       ($1, 'odontologia-pami', true, CURRENT_TIMESTAMP),
       ($1, 'finanzas-clinicas', true, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled`,
    [tenantId],
  );
}

async function main() {
  await client.connect();
  const before = {};
  for (const table of tablesToCount) before[table] = await countTable(table);
  const suspectPatients = await client.query(
    `SELECT count(*)::int AS count
     FROM fhir_patients
     WHERE tenant_id = $1
       AND (
         family_name ILIKE '%QA-TEST%'
         OR given_name ILIKE '%test%'
         OR dni IN ('777777','888888')
         OR dni BETWEEN '90000000' AND '90000999'
         OR payload::text ~* '(qa-test|pacientetemp|test-prod-odonto)'
       )`,
    [tenantId],
  ).catch(() => ({ rows: [{ count: null }] }));

  console.log(`Tenant objetivo: ${tenantId}`);
  console.log(apply ? 'Modo: APLICAR cambios' : 'Modo: simulacion (agregar --apply para ejecutar)');
  console.table(before);
  console.log(`Pacientes con patrones QA bloqueantes: ${suspectPatients.rows[0].count}`);

  if (!apply) {
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    const orderIds = await client.query(
      `SELECT id FROM protesis_orders WHERE tenant_id = $1 OR performer_tenant_id = $1`,
      [tenantId],
    ).catch(() => ({ rows: [] }));
    const ids = orderIds.rows.map((row) => row.id);

    if (ids.length) {
      await deleteIfExists('DELETE FROM protesis_consumos_insumo WHERE order_id = ANY($1::uuid[])', [ids]);
      await deleteIfExists('DELETE FROM protesis_pagos WHERE order_id = ANY($1::uuid[])', [ids]);
      await deleteIfExists('DELETE FROM protesis_status_history WHERE order_id = ANY($1::uuid[])', [ids]);
      await deleteIfExists('DELETE FROM protesis_chats WHERE order_id = ANY($1::uuid[])', [ids]);
    }
    await deleteIfExists('DELETE FROM protesis_orders WHERE tenant_id = $1 OR performer_tenant_id = $1');

    const deleteStatements = [
      'DELETE FROM clinical_evidence_audit_log WHERE tenant_id = $1',
      'DELETE FROM clinical_attachments WHERE tenant_id = $1',
      'DELETE FROM odontology_patient_signatures WHERE tenant_id = $1',
      'DELETE FROM odontology_encounter_audit_log WHERE tenant_id = $1',
      'DELETE FROM odontology_clinical_resources WHERE tenant_id = $1',
      'DELETE FROM odontology_encounters WHERE tenant_id = $1',
      'DELETE FROM clinica_pagos WHERE tenant_id = $1',
      'DELETE FROM clinica_presupuesto_items WHERE tenant_id = $1',
      'DELETE FROM clinica_presupuestos WHERE tenant_id = $1',
      'DELETE FROM clinica_gastos WHERE tenant_id = $1',
      'DELETE FROM clinica_precios WHERE tenant_id = $1',
      'DELETE FROM fhir_medication_requests WHERE tenant_id = $1',
      'DELETE FROM fhir_clinical_resources WHERE tenant_id = $1',
      'DELETE FROM fhir_encounters WHERE tenant_id = $1',
      'DELETE FROM appointment_audit_log WHERE tenant_id = $1',
      'DELETE FROM fhir_appointments WHERE tenant_id = $1',
      'DELETE FROM patient_coverages WHERE tenant_id = $1',
      'DELETE FROM patient_audit_log WHERE tenant_id = $1',
      'DELETE FROM fhir_patients WHERE tenant_id = $1',
    ];

    for (const statement of deleteStatements) await deleteIfExists(statement);
    await seedDemo();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const after = {};
  for (const table of tablesToCount) after[table] = await countTable(table);
  console.table(after);
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  try { await client.end(); } catch {}
  process.exit(1);
});
