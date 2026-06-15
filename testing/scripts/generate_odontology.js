// ============================================================================
// generate_odontology.js — CARGA QA del MODULO HC ODONTOLOGICA + TURNOS (PRODUCCION)
//
// Alcance (instruccion del dueno):
//  - NO toca la HC general (clinical-resource). Usa SOLO endpoints /odontology.
//  - Asume que los 250 pacientes (DNI 90000000..90000249, apellido " QA-TEST")
//    YA estan creados por la corrida previa. Los recupera por DNI.
//  - Sobre una muestra (SAMPLE_SIZE) carga HC odontologica completa:
//      odontograma doble capa (Condition existing + Procedure planned),
//      anamnesis PAMI (QuestionnaireResponse), estado bucal (Observation),
//      diagnostico/plan (CarePlan), consentimiento (Consent), cobertura (Coverage),
//      evolucion (Observation nota).
//  - Genera turnos (Appointment) escalonados para probar la agenda con volumen.
//
// Endpoints confirmados leyendo el codigo:
//   POST   /odontology/patient/:patientId/resource   body {resourceType, payload}
//   GET    /odontology/patient/:patientId/resource
//   PATCH  /odontology/resource/:id/complete
//   POST   /fhir/r4/Appointment   {patientDni,gender,start,minutesDuration,serviceType,practitionerName,originChannel}
//
// Tipos permitidos por el service: Condition, Procedure, Observation,
//   QuestionnaireResponse, CarePlan, Coverage, Consent.
//
// Uso: node generate_odontology.js [SAMPLE_SIZE] [TURNOS]   (default 55 / 120)
// ============================================================================
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const SAMPLE_SIZE = parseInt(process.argv[2] || '55', 10);
const TURNOS = parseInt(process.argv[3] || '120', 10);
const TOTAL_PAC = 250; // DNI 90000000..90000249
const OUT = path.join(__dirname, '..', 'output');

const ODONTO_LAYER_URL = 'http://denthce.local/fhir/StructureDefinition/odontogram-layer';
const PIEZAS = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
const CARAS = ['O','M','D','V','L'];

// Procedimientos odontologicos a realizar (capa planned/azul)
const PROCEDIMIENTOS = [
  { code: '23450005', text: 'Restauracion con composite' },
  { code: '234947007', text: 'Endodoncia (tratamiento de conducto)' },
  { code: '81733005', text: 'Extraccion dentaria' },
  { code: '52765003', text: 'Tartrectomia / Limpieza' },
  { code: '768577005', text: 'Colocacion de corona' },
  { code: '122456005', text: 'Sellante de fosas y fisuras' },
];

// --- Acumuladores de metricas ---
const timings = {};
const errors = [];
const counters = {};
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

const odo = (patientId, resourceType, payload) =>
  L.apiFetch('POST', `/odontology/patient/${patientId}/resource`, { resourceType, payload });

(async () => {
  console.log(`=== CARGA QA ODONTOLOGIA: muestra ${SAMPLE_SIZE} pacientes, ${TURNOS} turnos ===`);
  console.log(`Inicio: ${new Date().toISOString()}\n`);
  const tWall0 = Date.now();

  // ---------- FASE 0: recuperar pacientes existentes por DNI ----------
  const patients = []; // {id, dni, gender}
  for (let i = 0; i < TOTAL_PAC && patients.length < Math.max(SAMPLE_SIZE, TURNOS); i++) {
    const dni = String(L.DNI_BASE + i);
    const r = await L.apiFetch('GET', `/fhir/r4/Patient?identifier=${dni}`);
    const res = r.data?.entry?.[0]?.resource;
    if (res?.id) {
      patients.push({ id: res.id, dni, gender: res.gender });
    }
  }
  console.log(`Pacientes recuperados para carga: ${patients.length}\n`);

  // ---------- FASE 1: HC odontologica sobre la muestra ----------
  const sample = patients.slice(0, Math.min(SAMPLE_SIZE, patients.length));
  for (let i = 0; i < sample.length; i++) {
    const p = sample[i];

    // --- Cobertura (Coverage) ---
    let r = await odo(p.id, 'Coverage', {
      status: 'active',
      type: { text: L.pick(['OSDE','Swiss Medical','PAMI','IOMA','OSECAC','Particular','Galeno']) },
      beneficiary: { reference: `Patient/${p.id}` },
      payor: [{ display: 'Obra social / Prepaga' }],
      subscriberId: `AF-${p.dni}`,
    });
    record('Odo.Coverage', r, { dni: p.dni });

    // --- Consentimiento (Consent) ---
    r = await odo(p.id, 'Consent', {
      status: 'active',
      scope: { text: 'Tratamiento odontologico' },
      category: [{ text: 'Consentimiento informado' }],
      dateTime: new Date().toISOString(),
      provision: { type: 'permit' },
    });
    record('Odo.Consent', r, { dni: p.dni });

    // --- Anamnesis PAMI (QuestionnaireResponse) ---
    r = await odo(p.id, 'QuestionnaireResponse', {
      status: 'completed',
      authored: new Date().toISOString(),
      item: [
        { linkId: 'medicado', text: 'Toma medicacion actualmente?', answer: [{ valueString: L.pick(['No','Antihipertensivos','Antidiabeticos orales','Anticoagulantes']) }] },
        { linkId: 'alergias', text: 'Alergias conocidas', answer: [{ valueString: L.pick(['Ninguna','Penicilina','AINEs','Latex','Lidocaina']) }] },
        { linkId: 'cardiopatia', text: 'Antecedente cardiovascular?', answer: [{ valueBoolean: Math.random() < 0.3 }] },
        { linkId: 'diabetes', text: 'Diabetes?', answer: [{ valueBoolean: Math.random() < 0.25 }] },
        { linkId: 'embarazo', text: 'Embarazo (si aplica)?', answer: [{ valueBoolean: p.gender === 'female' && Math.random() < 0.1 }] },
        { linkId: 'tabaquismo', text: 'Fuma?', answer: [{ valueBoolean: Math.random() < 0.3 }] },
      ],
    });
    record('Odo.Anamnesis', r, { dni: p.dni });

    // --- Estado bucal general (Observation) ---
    r = await odo(p.id, 'Observation', {
      status: 'final',
      category: [{ coding: [{ code: 'exam', display: 'Examen' }] }],
      code: { text: 'Estado bucal general' },
      valueString: L.pick(['Higiene bucal regular, sarro generalizado', 'Buena higiene, sin patologia activa relevante', 'Higiene deficiente, multiples caries', 'Enfermedad periodontal moderada']),
      effectiveDateTime: new Date().toISOString(),
    });
    record('Odo.EstadoBucal', r, { dni: p.dni });

    // --- Odontograma capa EXISTING (Condition / hallazgos ya presentes) ---
    const nExist = L.randInt(2, 5);
    const usadas = new Set();
    for (let h = 0; h < nExist; h++) {
      let pieza; do { pieza = L.pick(PIEZAS); } while (usadas.has(pieza));
      usadas.add(pieza);
      const cara = L.pick(CARAS);
      const pat = L.pick(L.PATOLOGIAS);
      r = await odo(p.id, 'Condition', {
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        verificationStatus: { coding: [{ code: 'confirmed' }] },
        code: { coding: [{ system: 'http://snomed.info/sct', code: pat.snomed, display: pat.text }], text: pat.text },
        bodySite: { coding: [
          { system: 'http://snomed.info/sct', code: String(pieza), display: `Pieza ${pieza}` },
          { system: 'http://snomed.info/sct', code: cara, display: `Cara ${cara}` },
        ] },
        extension: [{ url: ODONTO_LAYER_URL, valueCode: 'existing' }],
      });
      record('Odo.Odontograma.existing', r, { dni: p.dni, pieza });
    }

    // --- Odontograma capa PLANNED (Procedure a realizar) ---
    const plannedIds = [];
    const nPlan = L.randInt(1, 3);
    const usadasP = new Set();
    for (let h = 0; h < nPlan; h++) {
      let pieza; do { pieza = L.pick(PIEZAS); } while (usadasP.has(pieza));
      usadasP.add(pieza);
      const cara = L.pick(CARAS);
      const proc = L.pick(PROCEDIMIENTOS);
      r = await odo(p.id, 'Procedure', {
        status: 'preparation',
        code: { coding: [{ system: 'http://snomed.info/sct', code: proc.code, display: proc.text }], text: proc.text },
        bodySite: { coding: [
          { system: 'http://snomed.info/sct', code: String(pieza), display: `Pieza ${pieza}` },
          { system: 'http://snomed.info/sct', code: cara, display: `Cara ${cara}` },
        ] },
        extension: [{ url: ODONTO_LAYER_URL, valueCode: 'planned' }],
      });
      record('Odo.Odontograma.planned', r, { dni: p.dni, pieza });
      if (r.ok && r.data?.id) plannedIds.push(r.data.id);
    }

    // --- Plan de tratamiento (CarePlan) ---
    r = await odo(p.id, 'CarePlan', {
      status: 'active',
      intent: 'plan',
      title: 'Plan de tratamiento odontologico',
      description: `Plan en ${nPlan} sesion(es): ${PROCEDIMIENTOS.slice(0, nPlan).map(x => x.text).join(', ')}.`,
      created: new Date().toISOString(),
    });
    record('Odo.CarePlan', r, { dni: p.dni });

    // --- Completar 1 procedimiento planned -> existing (transicion azul->rojo) ---
    if (plannedIds.length && Math.random() < 0.5) {
      const cr = await L.apiFetch('PATCH', `/odontology/resource/${plannedIds[0]}/complete`);
      record('Odo.Completar', cr, { dni: p.dni });
    }

    // --- Evolucion (Observation nota de sesion) ---
    r = await odo(p.id, 'Observation', {
      status: 'final',
      category: [{ coding: [{ code: 'therapy', display: 'Evolucion' }] }],
      code: { text: 'Nota de evolucion' },
      valueString: L.pick([
        'Paciente tolera bien el procedimiento. Se indica control en 7 dias.',
        'Se completa restauracion sin complicaciones. Buena adaptacion oclusal.',
        'Anestesia infiltrativa efectiva. Sin signos de complicacion postoperatoria.',
        'Se reprograma para segunda sesion de endodoncia.',
      ]),
      effectiveDateTime: new Date().toISOString(),
    });
    record('Odo.Evolucion', r, { dni: p.dni });

    if ((i + 1) % 10 === 0) console.log(`  HC odontologica: ${i + 1}/${sample.length}`);
  }

  // ---------- FASE 2: TURNOS escalonados (evitar double-booking 409) ----------
  // El backend bloquea solapamiento por tenant (mono-profesional). 30 min c/u,
  // desde manana +1 dia 08:00, 16 turnos por jornada de 8h.
  console.log(`\n=== Generando ${TURNOS} turnos ===`);
  let creados409 = 0;
  for (let t = 0; t < TURNOS; t++) {
    const p = patients[t % patients.length];
    const slotMin = t * 30;
    const day = Math.floor(slotMin / (8 * 60));
    const within = slotMin % (8 * 60);
    const start = new Date(Date.now() + 86400000 * (1 + day));
    start.setHours(8, 0, 0, 0);
    start.setMinutes(within);
    const r = await L.apiFetch('POST', '/fhir/r4/Appointment', {
      patientDni: p.dni, gender: p.gender, start: start.toISOString(),
      minutesDuration: 30, serviceType: L.pick(L.SERVICIOS_TURNO),
      practitionerName: 'Dr. Julio', originChannel: 'recepcion', status: 'booked',
    });
    if (r.status === 409) creados409++;
    record('Turno', r, { dni: p.dni });
    if ((t + 1) % 25 === 0) console.log(`  turnos: ${t + 1}/${TURNOS} (409 colision: ${creados409})`);
  }

  const wallMs = Date.now() - tWall0;

  // ---------- FASE 3: busqueda / lectura con la base poblada ----------
  const searchTests = [];
  const measure = async (name, path) => {
    const r = await L.apiFetch('GET', path);
    const total = r.data?.total ?? (Array.isArray(r.data) ? r.data.length : (r.data?.entry?.length ?? undefined));
    searchTests.push({ name, status: r.status, ms: r.ms, total });
    console.log(`  [search] ${name}: HTTP ${r.status} ${r.ms}ms total=${total}`);
  };
  console.log('\n=== Pruebas de busqueda/lectura ===');
  await measure('Listar TODOS los pacientes', '/fhir/r4/Patient');
  await measure('Buscar por apellido QA-TEST', '/fhir/r4/Patient?name=QA-TEST');
  await measure('Buscar por DNI prefijo 9000000', '/fhir/r4/Patient?identifier=9000000');
  await measure('Filtrar genero female', '/fhir/r4/Patient?gender=female');
  await measure('Nombre inexistente', '/fhir/r4/Patient?name=ZZZNOEXISTE');
  for (let k = 1; k <= 3; k++) await measure(`Listado completo (run ${k})`, '/fhir/r4/Patient');
  // Lectura de HC odontologica de un paciente de la muestra (volumen de recursos)
  if (sample.length) {
    await measure('GET HC odontologica de 1 paciente', `/odontology/patient/${sample[0].id}/resource`);
  }
  await measure('Listar turnos (agenda completa)', '/fhir/r4/Appointment');

  // ---------- FASE 4: prueba de aislamiento multi-tenant ----------
  console.log('\n=== Aislamiento multi-tenant ===');
  const isolation = [];
  // a) recurso odontologico de un patientId inexistente / de otro tenant -> 404
  const ghost = await L.apiFetch('GET', `/odontology/patient/00000000-0000-0000-0000-000000000000/resource`);
  isolation.push({ test: 'HC odontologica de patientId inexistente', status: ghost.status, esperado: '404', ok: ghost.status === 404 });
  console.log(`  Paciente inexistente en odontologia -> HTTP ${ghost.status} (esperado 404)`);
  // b) lectura sin token -> 401
  const noAuth = await fetch(`${L.API}/fhir/r4/Patient`).then(x => ({ status: x.status })).catch(() => ({ status: 0 }));
  isolation.push({ test: 'Acceso sin token', status: noAuth.status, esperado: '401', ok: noAuth.status === 401 });
  console.log(`  Acceso sin token -> HTTP ${noAuth.status} (esperado 401)`);

  // ---------- Reporte ----------
  const summary = {
    generadoEn: new Date().toISOString(),
    parametros: { SAMPLE_SIZE, TURNOS },
    wallClockMs: wallMs,
    pacientesEnMuestra: sample.length,
    counters,
    timings: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, stats(v)])),
    searchTests,
    isolation,
    errores: errors,
  };
  fs.writeFileSync(path.join(OUT, 'resultados_odontologia.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== RESUMEN ===');
  console.log('Wall clock:', wallMs, 'ms', `(${(wallMs / 60000).toFixed(1)} min)`);
  console.log('Contadores por seccion:');
  for (const [k, v] of Object.entries(counters)) console.log(`  ${k}: ok=${v.ok} fail=${v.fail}`);
  console.log('Tiempos (ms):');
  for (const [k, v] of Object.entries(summary.timings)) console.log(`  ${k}: avg=${v.avg} p50=${v.p50} p95=${v.p95} max=${v.max} (n=${v.n})`);
  console.log('Errores totales:', errors.length);
  if (errors.length) console.log(JSON.stringify(errors.slice(0, 8), null, 2));
  console.log('\nReporte: testing/output/resultados_odontologia.json');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
