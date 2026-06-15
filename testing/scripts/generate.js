// ============================================================================
// generate.js — CARGA MASIVA QA contra PRODUCCIÓN
//   - 250 pacientes (índices 0..249 => DNI 90000000..90000249)  [SALVAGUARDA]
//   - Muestra de SAMPLE_SIZE pacientes con TODAS las secciones cargadas.
// Uso: node generate.js [TOTAL] [SAMPLE_SIZE]   (default 250 / 55)
// ============================================================================
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const TOTAL = parseInt(process.argv[2] || '250', 10);
const SAMPLE_SIZE = parseInt(process.argv[3] || '55', 10);
const OUT = path.join(__dirname, '..', 'output');

// Acumuladores de métricas
const timings = {}; // seccion -> [ms...]
const errors = [];  // {seccion, dni, status, body}
const counters = {}; // seccion -> {ok, fail}

function record(section, r, ctx) {
  (timings[section] ||= []).push(r.ms);
  counters[section] ||= { ok: 0, fail: 0 };
  if (r.ok) counters[section].ok++;
  else {
    counters[section].fail++;
    errors.push({ section, ...ctx, status: r.status, body: typeof r.data === 'string' ? r.data.slice(0, 300) : r.data });
  }
}

function stats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, min: s[0], max: s[s.length - 1], avg: Math.round(sum / s.length), p50: pct(0.5), p95: pct(0.95) };
}

(async () => {
  console.log(`=== CARGA QA: ${TOTAL} pacientes, muestra clínica de ${SAMPLE_SIZE} ===`);
  console.log(`Inicio: ${new Date().toISOString()}\n`);

  const createdPatients = []; // {id, dni, gender, ...meta}
  const tWall0 = Date.now();

  // ---------- FASE 1: alta de 250 pacientes ----------
  for (let i = 0; i < TOTAL; i++) {
    const { resource, meta } = L.buildPatient(i);
    const r = await L.apiFetch('POST', '/fhir/r4/Patient', resource);
    record('Patient.create', r, { dni: meta.dni });
    if (r.ok) {
      createdPatients.push({ id: r.data.id, ...meta });
    } else if (r.status === 409) {
      // Ya existía (re-ejecución): recuperarlo para poder cargarle secciones
      const s = await L.apiFetch('GET', `/fhir/r4/Patient?identifier=${meta.dni}&gender=${meta.gender}`);
      const id = s.data?.entry?.[0]?.resource?.id;
      if (id) createdPatients.push({ id, ...meta, reused: true });
    }
    if ((i + 1) % 25 === 0) console.log(`  pacientes: ${i + 1}/${TOTAL} (creados/recuperados: ${createdPatients.length})`);
  }
  console.log(`\nPacientes disponibles para carga clínica: ${createdPatients.length}\n`);

  // ---------- FASE 2: secciones clínicas para la muestra ----------
  const sample = createdPatients.slice(0, Math.min(SAMPLE_SIZE, createdPatients.length));
  let turnoIdx = 0; // para distribuir turnos en horarios sin colisión

  for (let i = 0; i < sample.length; i++) {
    const p = sample[i];

    // --- Antecedente personal (Condition) ---
    let r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Condition',
      payload: {
        clinicalStatus: { coding: [{ code: 'active' }] },
        verificationStatus: 'confirmed',
        category: 'personal',
        code: { text: L.pick(L.ANTECEDENTES_PERS) },
        note: [{ text: 'Antecedente personal (QA)' }],
      },
    });
    record('Antecedente.personal', r, { dni: p.dni });

    // --- Antecedente familiar (Condition) ---
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Condition',
      payload: {
        clinicalStatus: { coding: [{ code: 'active' }] },
        verificationStatus: 'confirmed',
        category: 'familiar',
        code: { text: L.pick(L.ANTECEDENTES_FAM) },
        note: [{ text: 'Antecedente familiar (QA)' }],
      },
    });
    record('Antecedente.familiar', r, { dni: p.dni });

    // --- Alergia (AllergyIntolerance) --- 1 o 2 alergias
    const nAlergias = L.randInt(1, 2);
    for (let a = 0; a < nAlergias; a++) {
      const al = L.pick(L.ALERGIAS);
      r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
        resourceType: 'AllergyIntolerance',
        payload: {
          clinicalStatus: { coding: [{ code: 'active', display: 'Activa' }] },
          criticality: al.criticality,
          code: { coding: [{ display: al.allergen }], text: al.allergen },
          reaction: [{ manifestation: [{ coding: [{ display: al.reaction }] }] }],
          note: [{ text: 'Alergia (QA)' }],
          recordedDate: new Date().toISOString().split('T')[0],
        },
      });
      record('Alergia', r, { dni: p.dni });
    }

    // --- Signos vitales (Observation) ---
    // Pulso
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Pulso / FC' }], text: 'Pulso / FC' },
        valueQuantity: { value: L.randInt(58, 99), unit: 'lpm' },
        effectiveDateTime: new Date().toISOString(),
      },
    });
    record('Vital.pulso', r, { dni: p.dni });

    // Temperatura
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Temperatura' }], text: 'Temperatura' },
        valueQuantity: { value: 36 + Math.random() * 1.5, unit: '°C' },
        effectiveDateTime: new Date().toISOString(),
      },
    });
    record('Vital.temperatura', r, { dni: p.dni });

    // Peso
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Peso' }], text: 'Peso' },
        valueQuantity: { value: L.randInt(45, 110), unit: 'kg' },
        effectiveDateTime: new Date().toISOString(),
      },
    });
    record('Vital.peso', r, { dni: p.dni });

    // Talla
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '8302-2', display: 'Talla' }], text: 'Talla' },
        valueQuantity: { value: L.randInt(150, 195), unit: 'cm' },
        effectiveDateTime: new Date().toISOString(),
      },
    });
    record('Vital.talla', r, { dni: p.dni });

    // Saturación O2
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '59408-5', display: 'Saturación O₂' }], text: 'Saturación O₂' },
        valueQuantity: { value: L.randInt(94, 100), unit: '%' },
        effectiveDateTime: new Date().toISOString(),
      },
    });
    record('Vital.saturacion', r, { dni: p.dni });

    // Presión arterial (compuesta)
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '55284-4', display: 'Presión Arterial' }], text: 'Presión Arterial' },
        effectiveDateTime: new Date().toISOString(),
        component: [
          { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Sistólica' }] }, valueQuantity: { value: L.randInt(105, 145), unit: 'mmHg' } },
          { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastólica' }] }, valueQuantity: { value: L.randInt(65, 95), unit: 'mmHg' } },
        ],
      },
    });
    record('Vital.presion', r, { dni: p.dni });

    // --- Odontograma: 2 a 4 hallazgos en piezas distintas ---
    const piezas = [11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26, 31, 32, 33, 34, 35, 36, 41, 42, 43, 44, 45, 46];
    const caras = ['O', 'M', 'D', 'V', 'L'];
    const nHallazgos = L.randInt(2, 4);
    const usadas = new Set();
    for (let h = 0; h < nHallazgos; h++) {
      let pieza; do { pieza = L.pick(piezas); } while (usadas.has(pieza));
      usadas.add(pieza);
      const cara = L.pick(caras);
      const pat = L.pick(L.PATOLOGIAS);
      r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/clinical-resource`, {
        resourceType: 'Condition',
        payload: {
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          code: { coding: [{ system: 'http://snomed.info/sct', code: pat.snomed, display: pat.text }], text: pat.text },
          bodySite: { coding: [
            { system: 'http://snomed.info/sct', code: String(pieza), display: `Pieza dental ${pieza}` },
            { system: 'http://snomed.info/sct', code: cara, display: `Cara ${cara}` },
          ] },
        },
      });
      record('Odontograma', r, { dni: p.dni, pieza });
    }

    // --- Receta (MedicationRequest) draft + firma ---
    const f = L.pick(L.FARMACOS);
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/MedicationRequest`, {
      medicationName: f.name, medicationCode: f.code, dosageText: f.dosage,
      frequencyHours: f.freq, doseValue: f.dose, durationDays: f.dur,
    });
    record('Receta.crear', r, { dni: p.dni });
    const rxId = r.data?.id;
    if (rxId) {
      const rs = await L.apiFetch('POST', `/fhir/r4/Patient/${p.id}/MedicationRequest/${rxId}/sign`);
      record('Receta.firmar', rs, { dni: p.dni });
    }

    // --- Turno (Appointment) ---  horarios escalonados para evitar colisión (mono-profesional)
    // Distribuimos en días/horas distintos: 30 min cada uno desde +1 día 08:00.
    const slotMin = turnoIdx * 30;
    const day = Math.floor(slotMin / (8 * 60)); // 16 turnos por "jornada" de 8h
    const within = slotMin % (8 * 60);
    const start = new Date(Date.now() + 86400000 * (1 + day));
    start.setHours(8, 0, 0, 0);
    start.setMinutes(within);
    turnoIdx++;
    r = await L.apiFetch('POST', '/fhir/r4/Appointment', {
      patientDni: p.dni, gender: p.gender, start: start.toISOString(),
      minutesDuration: 30, serviceType: L.pick(L.SERVICIOS_TURNO),
      practitionerName: 'Dr. Julio', originChannel: 'recepcion', status: 'booked',
    });
    record('Turno', r, { dni: p.dni });

    if ((i + 1) % 10 === 0) console.log(`  muestra clínica: ${i + 1}/${sample.length}`);
  }

  const wallMs = Date.now() - tWall0;

  // ---------- FASE 3: pruebas de búsqueda/lectura con la base poblada ----------
  const searchTests = [];
  const measure = async (name, path) => {
    const r = await L.apiFetch('GET', path);
    const total = r.data?.total ?? (Array.isArray(r.data) ? r.data.length : undefined);
    searchTests.push({ name, status: r.status, ms: r.ms, total });
    console.log(`  [search] ${name}: HTTP ${r.status} ${r.ms}ms total=${total}`);
  };
  console.log('\n=== Pruebas de búsqueda ===');
  await measure('Listar TODOS los pacientes del tenant', '/fhir/r4/Patient');
  await measure('Buscar por apellido "QA-TEST"', '/fhir/r4/Patient?name=QA-TEST');
  await measure('Buscar por DNI prefijo 9000000', '/fhir/r4/Patient?identifier=9000000');
  await measure('Filtrar por género female', '/fhir/r4/Patient?gender=female');
  await measure('Buscar por nombre inexistente', '/fhir/r4/Patient?name=ZZZNOEXISTE');
  // repetir listado completo 3 veces para ver consistencia de tiempos
  for (let k = 1; k <= 3; k++) await measure(`Listado completo (run ${k})`, '/fhir/r4/Patient');

  // ---------- Reporte ----------
  const summary = {
    generadoEn: new Date().toISOString(),
    parametros: { TOTAL, SAMPLE_SIZE },
    wallClockMs: wallMs,
    pacientesCreados: createdPatients.filter(p => !p.reused).length,
    pacientesRecuperados: createdPatients.filter(p => p.reused).length,
    counters,
    timings: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, stats(v)])),
    searchTests,
    errores: errors,
  };

  fs.writeFileSync(path.join(OUT, 'resultados.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'pacientes-creados.json'), JSON.stringify(createdPatients, null, 2));

  console.log('\n=== RESUMEN ===');
  console.log('Wall clock (ms):', wallMs, `(${(wallMs / 60000).toFixed(1)} min)`);
  console.log('Contadores por sección:');
  for (const [k, v] of Object.entries(counters)) console.log(`  ${k}: ok=${v.ok} fail=${v.fail}`);
  console.log('Tiempos (ms) por sección:');
  for (const [k, v] of Object.entries(summary.timings)) console.log(`  ${k}: avg=${v.avg} p50=${v.p50} p95=${v.p95} max=${v.max} (n=${v.n})`);
  console.log('Errores totales:', errors.length);
  if (errors.length) console.log(JSON.stringify(errors.slice(0, 10), null, 2));
  console.log('\nReporte escrito en testing/output/resultados.json');
})();
