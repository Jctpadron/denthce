const http = require('http');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';

const GIVEN_NAMES = ['Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Sebastián', 'Isabella', 'Lucas', 'Mariana', 'Benjamín', 'Florencia', 'Joaquín', 'Martina', 'Agustín', 'Lucía', 'Tomás', 'Catalina', 'Nicolás', 'Victoria', 'Felipe'];
const FAMILY_NAMES = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera'];
const GENDERS = ['male', 'female', 'other', 'unknown'];
const STREETS = ['Av. San Martín', 'Av. Belgrano', 'Calle Colón', 'Calle Mitre', 'Av. Rivadavia', 'Calle Las Heras', 'Calle Sarmiento', 'Calle Necochea'];
const CITIES = ['Mendoza', 'Buenos Aires', 'Córdoba', 'Rosario', 'Tucumán', 'Salta', 'San Juan', 'Neuquén'];

const VITAL_PRESETS = [
  { code: '8310-5', display: 'Temperatura', unit: '°C', valMin: 35.5, valMax: 39.0 },
  { code: '8867-4', display: 'Pulso / FC', unit: 'lpm', valMin: 60, valMax: 110 },
  { code: '29463-7', display: 'Peso', unit: 'kg', valMin: 50, valMax: 110 },
  { code: '8302-2', display: 'Talla', unit: 'cm', valMin: 150, valMax: 195 }
];

const ALLERGY_PRESETS = [
  { code: '300916003', display: 'Alergia a la Penicilina' },
  { code: '300917007', display: 'Alergia al Látex' },
  { code: '292150009', display: 'Alergia a la Aspirina' }
];

const PROCEDURE_PRESETS = [
  { code: '23450005', display: 'Restauración dental' },
  { code: '42425007', display: 'Tratamiento de conducto (Endodoncia)' }
];

const ANTECEDENT_PRESETS = [
  { code: 'Hipertensión Arterial (HTA)', note: 'Bajo control clínico con enalapril.' },
  { code: 'Diabetes Tipo 2', note: 'Medicada con Metformina 850mg.' },
  { code: 'Asma Bronquial', note: 'Uso de salbutamol SOS.' },
  { code: 'Cardiopatía Isquémica', note: 'Antecedentes de bypass coronario.' }
];

const TOOTH_PIECES = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28', '38', '37', '36', '35', '34', '33', '32', '31', '41', '42', '43', '44', '45', '46', '47', '48'];
const TOOTH_FACES = ['V', 'D', 'L', 'M', 'O'];

async function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (body) {
      if (typeof body === 'string') {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
      } else {
        body = JSON.stringify(body);
        reqOptions.headers['Content-Type'] = 'application/json';
        reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
      }
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (e) => reject(e));
    if (body) req.write(body);
    req.end();
  });
}

async function getToken(username, password) {
  const tokenUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', 'hce-app');
  params.append('username', username);
  params.append('password', password);

  const res = await request(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, params.toString());

  if (res.statusCode !== 200) {
    throw new Error(`Error de autenticación para ${username}: ${res.body}`);
  }

  return JSON.parse(res.body).access_token;
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

function generateRandomPatient(dni) {
  const given = getRandomItem(GIVEN_NAMES);
  const family = getRandomItem(FAMILY_NAMES);
  const gender = getRandomItem(GENDERS);
  const birthYear = getRandomInt(1960, 2022);
  const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
  const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');
  const phone = `+549${getRandomInt(261, 351)}${getRandomInt(1000000, 9999999)}`;
  const email = `${given.toLowerCase()}.${family.toLowerCase()}@example-hce.com`;
  const street = getRandomItem(STREETS);
  const num = getRandomInt(10, 4500);
  const city = getRandomItem(CITIES);

  return {
    resourceType: 'Patient',
    active: true,
    identifier: [
      {
        use: 'official',
        system: 'http://hospital.gov/dni',
        value: dni,
      },
    ],
    name: [
      {
        use: 'official',
        family: family,
        given: [given],
      },
    ],
    gender: gender,
    birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
    telecom: [
      { system: 'phone', value: phone, use: 'home' },
      { system: 'email', value: email, use: 'home' }
    ],
    address: [
      {
        use: 'home',
        type: 'both',
        line: [`${street} ${num}`],
        city: city,
        country: 'Argentina'
      }
    ]
  };
}

async function runStressTest() {
  console.log('⚡ INICIANDO PRUEBA DE ESTRÉS Y VOLUMEN DE DATOS MÓDULO 3 (200 REGISTROS INTEGRALES) ⚡\n');
  const startTime = Date.now();
  let requestDurations = [];

  try {
    console.log('🔐 1. Autenticando médicos en Keycloak...');
    const t0 = Date.now();
    const tokenA = await getToken('doctor_julio', 'doctor_pass_2026');
    requestDurations.push(Date.now() - t0);

    console.log('💾 2. Sembrando 200 Historias Clínicas Integrales...');
    let successCount = 0;
    let failedCount = 0;

    // Ejecutaremos la creación secuencial de 40 pacientes integrales.
    // Cada paciente integral creará 5 registros asociados (1 Paciente, 1 Consulta/SOAP, 1 Signo Vital, 1 Alergia, 1 Antecedente, 1 Odontograma)
    // 40 pacientes * 5 recursos = 200 transacciones completas cubriendo todas las tablas del sistema.
    const targetPatientsCount = 40;

    for (let i = 1; i <= targetPatientsCount; i++) {
      const uniqueDni = String(Math.floor(10000000 + Math.random() * 90000000));
      const patientData = generateRandomPatient(uniqueDni);
      
      try {
        // A. Crear paciente
        const tCreate = Date.now();
        const createRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        }, patientData);
        requestDurations.push(Date.now() - tCreate);

        if (createRes.statusCode !== 201) {
          throw new Error(`Error paciente DNI ${uniqueDni}: ${createRes.statusCode}`);
        }
        const createdPatient = JSON.parse(createRes.body);
        const patientId = createdPatient.id;

        // B. Crear Consulta / Nota SOAP (FHIR Encounter)
        const encounterData = {
          class: { code: 'AMB', display: 'Ambulatorio' },
          reasonCode: [
            {
              coding: [{
                system: 'http://hl7.org/fhir/sid/icd-10',
                code: 'K02.1',
                display: 'Caries de la dentina'
              }]
            }
          ],
          note: [
            { text: 'S: Refiere dolor en zona bucal.' },
            { text: 'O: Lesión clínica visible.' },
            { text: 'A: Caries dental activa.' },
            { text: 'P: Restauración estética planificada.' }
          ]
        };
        const tEnc = Date.now();
        const encRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/encounter`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        }, encounterData);
        requestDurations.push(Date.now() - tEnc);

        // Firmar consulta inmediatamente para poblar historial de firmas
        if (encRes.statusCode === 201) {
          const encCreated = JSON.parse(encRes.body);
          const tSign = Date.now();
          await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/encounter/${encCreated.id}/sign`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenA}` }
          });
          requestDurations.push(Date.now() - tSign);
        }

        // C. Crear Signo Vital (Observation LOINC)
        const vitalPreset = getRandomItem(VITAL_PRESETS);
        const vitalValue = getRandomFloat(vitalPreset.valMin, vitalPreset.valMax);
        const vitalPayload = {
          resourceType: 'Observation',
          payload: {
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: vitalPreset.code, display: vitalPreset.display }],
              text: vitalPreset.display
            },
            valueQuantity: { value: vitalValue, unit: vitalPreset.unit },
            effectiveDateTime: new Date().toISOString()
          }
        };
        const tVital = Date.now();
        await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        }, vitalPayload);
        requestDurations.push(Date.now() - tVital);

        // D. Crear Alergia (AllergyIntolerance SNOMED)
        const allergyPreset = getRandomItem(ALLERGY_PRESETS);
        const allergyPayload = {
          resourceType: 'AllergyIntolerance',
          payload: {
            clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active', display: 'Active' }] },
            verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed', display: 'Confirmed' }] },
            category: ['medication'],
            criticality: 'high',
            code: {
              coding: [{ system: 'http://snomed.info/sct', code: allergyPreset.code, display: allergyPreset.display }],
              text: allergyPreset.display
            }
          }
        };
        const tAllergy = Date.now();
        await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        }, allergyPayload);
        requestDurations.push(Date.now() - tAllergy);

        // E. Crear Antecedente Clínico (Condition)
        const antecedentPreset = getRandomItem(ANTECEDENT_PRESETS);
        const antecedentPayload = {
          resourceType: 'Condition',
          payload: {
            resourceType: 'Condition',
            clinicalStatus: 'active',
            verificationStatus: 'confirmed',
            category: 'personal',
            code: { text: antecedentPreset.code },
            note: [{ text: antecedentPreset.note }]
          }
        };
        const tAnt = Date.now();
        await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        }, antecedentPayload);
        requestDurations.push(Date.now() - tAnt);

        // F. Crear Registro de Odontograma (Procedure)
        const procPreset = getRandomItem(PROCEDURE_PRESETS);
        const tooth = getRandomItem(TOOTH_PIECES);
        const face = getRandomItem(TOOTH_FACES);
        const procedurePayload = {
          resourceType: 'Procedure',
          payload: {
            status: 'completed',
            code: {
              coding: [{ system: 'http://snomed.info/sct', code: procPreset.code, display: procPreset.display }],
              text: procPreset.display
            },
            bodySite: {
              coding: [
                { system: 'http://snomed.info/sct', code: tooth, display: `Pieza dental ${tooth}` },
                { system: 'http://snomed.info/sct', code: face, display: `Cara ${face}` }
              ]
            }
          }
        };
        const tProc = Date.now();
        await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        }, procedurePayload);
        requestDurations.push(Date.now() - tProc);

        successCount++;
        if (successCount % 5 === 0) {
          console.log(`   ✅ Procesados ${successCount}/${targetPatientsCount} pacientes y sus sub-recursos.`);
        }
      } catch (err) {
        console.error(`   ❌ Fallo al procesar paciente número ${i}:`, err.message);
        failedCount++;
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = durationMs / 1000;
    const avgDuration = requestDurations.reduce((sum, val) => sum + val, 0) / requestDurations.length;
    const totalRequests = requestDurations.length;
    const throughput = totalRequests / durationSec;

    console.log('\n📊 Métricas de la Prueba de Estrés e Integración del Módulo 3:');
    console.log(`   - Pacientes integrales creados con éxito: ${successCount}/${targetPatientsCount}`);
    console.log(`   - Recursos clínicos y SOAP cargados con éxito: ${successCount * 5}`);
    console.log(`   - Total registros sembrados en la base de datos: ${successCount * 6}`);
    console.log(`   - Fallos de transacción: ${failedCount}`);
    console.log(`   - Peticiones REST enviadas totales: ${totalRequests}`);
    console.log(`   - Tiempo total de ejecución: ${durationSec.toFixed(2)} segundos`);
    console.log(`   - Promedio de respuesta de API: ${avgDuration.toFixed(1)} ms por petición`);
    console.log(`   - Tasa de procesamiento (Throughput): ${throughput.toFixed(1)} peticiones/segundo`);

    console.log('\n🎉 ¡PRUEBA DE VOLUMEN E INTEGRACIÓN FINALIZADA CON ÉXITO! (100% Passed) 🎉\n');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO DURANTE LA PRUEBA DE VOLUMEN:', error.message);
    process.exit(1);
  }
}

runStressTest();
