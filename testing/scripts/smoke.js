// smoke.js — prueba de humo con UN paciente QA (DNI 90000000) para validar
// que cada endpoint acepta los payloads exactos antes de la carga masiva.
const L = require('./lib');

(async () => {
  const results = [];
  const log = (name, r) => {
    const okMark = r.ok ? 'OK ' : 'FAIL';
    console.log(`[${okMark}] ${name} -> HTTP ${r.status} (${r.ms}ms)`);
    if (!r.ok) console.log('     body:', JSON.stringify(r.data));
    results.push({ name, status: r.status, ok: r.ok, ms: r.ms });
  };

  // 1) Crear paciente índice 0 => DNI 90000000
  const { resource, meta } = L.buildPatient(0);
  let r = await L.apiFetch('POST', '/fhir/r4/Patient', resource);
  // Si ya existe (409) reusar buscándolo
  let patientId = r.data?.id;
  if (r.status === 409) {
    console.log('[INFO] Paciente 90000000 ya existe, lo busco.');
    const s = await L.apiFetch('GET', `/fhir/r4/Patient?identifier=${meta.dni}&gender=${meta.gender}`);
    patientId = s.data?.entry?.[0]?.resource?.id;
    log('Crear Paciente (ya existía, reusado)', { ...s, ok: !!patientId });
  } else {
    log('Crear Paciente válido FHIR', r);
  }
  if (!patientId) { console.log('Sin patientId, aborto smoke.'); process.exit(1); }
  console.log('     patientId:', patientId);

  // 2) Antecedente personal (Condition)
  r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/clinical-resource`, {
    resourceType: 'Condition',
    payload: {
      clinicalStatus: { coding: [{ code: 'active' }] },
      verificationStatus: 'confirmed',
      category: 'personal',
      code: { text: 'Hipertensión arterial' },
      note: [{ text: 'Antecedente de prueba QA' }],
    },
  });
  log('Antecedente personal (Condition)', r);

  // 3) Alergia (AllergyIntolerance)
  r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/clinical-resource`, {
    resourceType: 'AllergyIntolerance',
    payload: {
      clinicalStatus: { coding: [{ code: 'active', display: 'Activa' }] },
      criticality: 'high',
      code: { coding: [{ display: 'Penicilina' }], text: 'Penicilina' },
      reaction: [{ manifestation: [{ coding: [{ display: 'Erupción cutánea' }] }] }],
      note: [{ text: 'Alergia de prueba QA' }],
      recordedDate: new Date().toISOString().split('T')[0],
    },
  });
  log('Alergia (AllergyIntolerance)', r);

  // 4) Signo vital simple (Observation - Pulso)
  r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/clinical-resource`, {
    resourceType: 'Observation',
    payload: {
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Pulso / FC' }], text: 'Pulso / FC' },
      valueQuantity: { value: 72, unit: 'lpm' },
      effectiveDateTime: new Date().toISOString(),
    },
  });
  log('Signo vital simple (Observation pulso)', r);

  // 5) Signo vital compuesto (Presión arterial)
  r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/clinical-resource`, {
    resourceType: 'Observation',
    payload: {
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '55284-4', display: 'Presión Arterial' }], text: 'Presión Arterial' },
      effectiveDateTime: new Date().toISOString(),
      component: [
        { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Sistólica' }] }, valueQuantity: { value: 120, unit: 'mmHg' } },
        { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastólica' }] }, valueQuantity: { value: 80, unit: 'mmHg' } },
      ],
    },
  });
  log('Signo vital compuesto (Presión arterial)', r);

  // 6) Odontograma (Condition con bodySite SNOMED, como hace el frontend)
  r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/clinical-resource`, {
    resourceType: 'Condition',
    payload: {
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      code: { coding: [{ system: 'http://snomed.info/sct', code: '80967001', display: 'Caries dental' }], text: 'Caries dental activa' },
      bodySite: { coding: [
        { system: 'http://snomed.info/sct', code: '16', display: 'Pieza dental 16' },
        { system: 'http://snomed.info/sct', code: 'O', display: 'Cara O' },
      ] },
    },
  });
  log('Odontograma hallazgo (Condition+bodySite)', r);

  // 7) Receta (MedicationRequest draft)
  r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/MedicationRequest`, {
    medicationName: 'Amoxicilina 500 mg',
    medicationCode: 'AMX-500',
    dosageText: '1 comprimido cada 8 horas',
    frequencyHours: 8,
    doseValue: 1,
    durationDays: 7,
  });
  log('Receta (MedicationRequest draft)', r);
  const rxId = r.data?.id;
  if (r.data?.warnings?.length) console.log('     CDS warnings:', r.data.warnings);

  // 7b) Firmar receta
  if (rxId) {
    r = await L.apiFetch('POST', `/fhir/r4/Patient/${patientId}/MedicationRequest/${rxId}/sign`);
    log('Firmar receta', r);
  }

  // 8) Turno (Appointment, originChannel recepcion)
  const start = new Date(Date.now() + 86400000); start.setHours(10, 0, 0, 0);
  r = await L.apiFetch('POST', '/fhir/r4/Appointment', {
    patientDni: meta.dni,
    gender: meta.gender,
    start: start.toISOString(),
    minutesDuration: 30,
    serviceType: 'Consulta de control',
    practitionerName: 'Dr. Julio',
    originChannel: 'recepcion',
    status: 'booked',
  });
  log('Turno (Appointment booked)', r);

  // 9) Lectura de recursos clínicos
  r = await L.apiFetch('GET', `/fhir/r4/Patient/${patientId}/clinical-resource`);
  log(`Leer recursos clínicos (count=${Array.isArray(r.data) ? r.data.length : '?'})`, r);

  console.log('\n=== Resumen smoke ===');
  console.log(JSON.stringify(results, null, 2));
})();
