/**
 * Validación LOCAL punta a punta (10 pacientes): alta -> HC Odontológica -> turno.
 * Contrato confirmado por el agente qa leyendo el código real.
 * Backend LOCAL (localhost:3000), token de auth.systia.ar (issuer del backend local).
 * Salvaguarda: DNI 90000900-90000909, apellido " QA-TEST".
 */
const KC = 'https://auth.systia.ar';
// Parametrizable por entorno (default LOCAL). Para prod: API_BASE=https://api.systia.ar DNI_BASE=90000910
const API = process.env.API_BASE || 'http://localhost:3000';
const DNI_BASE = parseInt(process.env.DNI_BASE || '90000900', 10);
const ODONTO_LAYER = 'http://denthce.local/fhir/StructureDefinition/odontogram-layer';

const NOMBRES_M = ['Juan', 'Carlos', 'Roberto', 'Miguel', 'Jorge'];
const NOMBRES_F = ['María', 'Ana', 'Lucía', 'Marta', 'Elena'];
const APELLIDOS = ['Gómez', 'Fernández', 'López', 'Díaz', 'Romero', 'Sosa', 'Torres', 'Ruiz', 'Benítez', 'Acosta'];
const PATOLOGIAS = [
  { cie: 'K02.1', desc: 'Caries de la dentina' },
  { cie: 'K05.0', desc: 'Gingivitis aguda' },
  { cie: 'K05.3', desc: 'Periodontitis crónica' },
  { cie: 'K04.7', desc: 'Absceso periapical' },
  { cie: 'K03.0', desc: 'Bruxismo (atrición dental)' },
  { cie: 'M26.4', desc: 'Maloclusión' },
  { cie: 'K04.0', desc: 'Pulpitis' },
  { cie: 'K05.2', desc: 'Pericoronaritis' },
  { cie: 'K08.1', desc: 'Pérdida de dientes' },
  { cie: 'K00.6', desc: 'Alteración de la erupción dentaria' },
];

const t0 = () => process.hrtime.bigint();
const ms = (start) => Number(process.hrtime.bigint() - start) / 1e6;

async function getToken() {
  const res = await fetch(`${KC}/realms/hce-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=password&client_id=hce-app&username=doctor_julio&password=doctor_pass_2026',
  });
  if (!res.ok) throw new Error('No se pudo obtener token: ' + res.status);
  return (await res.json()).access_token;
}

async function main() {
  const metrics = { altas: [], odonto: [], turnos: [], errores: [] };
  console.log('== Validación LOCAL (10 pacientes) ==');
  const token = await getToken();
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 1);
  baseDate.setHours(9, 0, 0, 0);

  for (let i = 0; i < 10; i++) {
    const dni = String(DNI_BASE + i);
    const female = i % 2 === 0;
    const gender = female ? 'female' : 'male';
    const given = (female ? NOMBRES_F : NOMBRES_M)[i % 5];
    const family = `${APELLIDOS[i]} QA-TEST`;
    const pat = PATOLOGIAS[i];

    // 1. ALTA
    let patientId = null;
    try {
      const s = t0();
      const r = await fetch(`${API}/fhir/r4/Patient`, {
        method: 'POST', headers: H,
        body: JSON.stringify({
          resourceType: 'Patient', active: true,
          identifier: [{ use: 'official', system: 'http://hospital.gov/dni', value: dni }],
          name: [{ use: 'official', family, given: [given] }],
          gender, birthDate: `19${50 + i}-0${(i % 9) + 1}-15`,
          telecom: [{ system: 'phone', value: `351555${1000 + i}` }],
        }),
      });
      const body = await r.json();
      metrics.altas.push(ms(s));
      if (r.status === 201) patientId = body.id;
      else if (r.status === 409) {
        // ya existe: buscarlo
        const q = await fetch(`${API}/fhir/r4/Patient?identifier=${dni}`, { headers: H });
        const bundle = await q.json();
        patientId = bundle.entry?.[0]?.resource?.id;
      } else metrics.errores.push(`alta ${dni}: ${r.status} ${JSON.stringify(body).slice(0,120)}`);
    } catch (e) { metrics.errores.push(`alta ${dni}: ${e.message}`); }
    if (!patientId) { metrics.errores.push(`sin patientId para ${dni}, salto`); continue; }

    // 2. HC ODONTOLÓGICA (varios recursos)
    const odontoResources = [
      { resourceType: 'Condition', payload: { resourceType: 'Condition', code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: pat.cie, display: pat.desc }], text: pat.desc }, clinicalStatus: { coding: [{ code: 'active' }] } } },
      // Odontograma: hallazgo existente (rojo)
      { resourceType: 'Procedure', payload: { resourceType: 'Procedure', status: 'completed', code: { text: `Hallazgo pieza ${11 + i}` }, extension: [{ url: ODONTO_LAYER, valueCode: 'existing' }], bodySite: [{ text: `${11 + i}` }] } },
      // Odontograma: tratamiento a realizar (azul)
      { resourceType: 'Procedure', payload: { resourceType: 'Procedure', status: 'preparation', code: { text: `Tratamiento pieza ${21 + i}` }, extension: [{ url: ODONTO_LAYER, valueCode: 'planned' }], bodySite: [{ text: `${21 + i}` }] } },
      // Anamnesis
      { resourceType: 'QuestionnaireResponse', payload: { resourceType: 'QuestionnaireResponse', status: 'completed', item: [{ linkId: 'higiene', text: 'Higiene bucal', answer: [{ valueString: i % 3 === 0 ? 'deficiente' : 'buena' }] }] } },
      // Estado bucal
      { resourceType: 'Observation', payload: { resourceType: 'Observation', status: 'final', code: { text: 'Estado bucal general' }, valueString: pat.desc } },
    ];
    for (const rsc of odontoResources) {
      try {
        const s = t0();
        const r = await fetch(`${API}/odontology/patient/${patientId}/resource`, {
          method: 'POST', headers: H, body: JSON.stringify(rsc),
        });
        metrics.odonto.push(ms(s));
        if (!r.ok) { const b = await r.text(); metrics.errores.push(`odonto ${rsc.resourceType} ${dni}: ${r.status} ${b.slice(0,100)}`); }
      } catch (e) { metrics.errores.push(`odonto ${rsc.resourceType} ${dni}: ${e.message}`); }
    }

    // 3. TURNO (escalonado para evitar double-booking 409)
    try {
      const start = new Date(baseDate.getTime() + i * 30 * 60000);
      const s = t0();
      const r = await fetch(`${API}/fhir/r4/Appointment`, {
        method: 'POST', headers: H,
        body: JSON.stringify({
          resourceType: 'Appointment', status: 'booked',
          patientDni: dni, gender, start: start.toISOString(),
          minutesDuration: 30, serviceType: pat.desc, practitionerName: 'Julio Mendoza',
          originChannel: 'recepcion',
        }),
      });
      metrics.turnos.push(ms(s));
      if (!r.ok) { const b = await r.text(); metrics.errores.push(`turno ${dni}: ${r.status} ${b.slice(0,100)}`); }
    } catch (e) { metrics.errores.push(`turno ${dni}: ${e.message}`); }

    process.stdout.write(`  paciente ${i + 1}/10 (${family}) OK\r`);
  }

  // Búsqueda con volumen
  let searchMs = null;
  try { const s = t0(); await fetch(`${API}/fhir/r4/Patient?name=QA-TEST`, { headers: H }); searchMs = ms(s); } catch {}

  const avg = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 'n/a';
  console.log('\n\n== RESULTADOS ==');
  console.log(`Altas:   ${metrics.altas.length} | prom ${avg(metrics.altas)} ms`);
  console.log(`Odonto:  ${metrics.odonto.length} recursos | prom ${avg(metrics.odonto)} ms`);
  console.log(`Turnos:  ${metrics.turnos.length} | prom ${avg(metrics.turnos)} ms`);
  console.log(`Búsqueda 'QA-TEST': ${searchMs ? searchMs.toFixed(1) + ' ms' : 'n/a'}`);
  console.log(`Errores: ${metrics.errores.length}`);
  metrics.errores.slice(0, 15).forEach((e) => console.log('  - ' + e));
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
