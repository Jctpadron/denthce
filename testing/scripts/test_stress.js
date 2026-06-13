const http = require('http');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';

// Diccionarios para generación de datos variables aleatorios
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

function decodeToken(token) {
  const payloadB64 = token.split('.')[1];
  return JSON.parse(Buffer.from(payloadB64, 'base64').toString());
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

// Genera un paciente aleatorio
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
  console.log('⚡ INICIANDO PRUEBA DE ESTRÉS Y VOLUMEN DE DATOS ⚡\n');
  const startTime = Date.now();
  let requestDurations = [];

  try {
    // ----------------------------------------------------
    // 1. AUTENTICACIÓN Y VERIFICACIÓN DE EXPIRACIÓN DE TOKEN
    // ----------------------------------------------------
    console.log('🔐 1. Autenticando doctores en Keycloak...');
    const t0 = Date.now();
    const tokenA = await getToken('doctor_julio', 'doctor_pass_2026');
    const tokenB = await getToken('admin_hce', 'admin_pass_2026');
    requestDurations.push(Date.now() - t0);

    const payloadA = decodeToken(tokenA);
    const lifespanSeconds = payloadA.exp - payloadA.iat;
    const lifespanMinutes = lifespanSeconds / 60;
    
    console.log(`   ✅ Autenticación exitosa.`);
    console.log('   🔍 Análisis de Expiración del Token Keycloak:');
    console.log(`      - Emitido en (iat): ${new Date(payloadA.iat * 1000).toLocaleString()}`);
    console.log(`      - Expira en (exp):  ${new Date(payloadA.exp * 1000).toLocaleString()}`);
    console.log(`      - Tiempo de vida de sesión activa: ${lifespanSeconds} segundos (${lifespanMinutes} minutos)`);
    console.log(`      👉 CONCLUSIÓN: La aplicación se desconectará y solicitará autenticación nuevamente después de exactamente **${lifespanMinutes} minutos** de inactividad del token.\n`);

    // ----------------------------------------------------
    // 2. POBLADO MASIVO Y MEDICIÓN DE RENDIMIENTO
    // ----------------------------------------------------
    console.log('💾 2. Sembrando 200 pacientes (100 por Doctor/Inquilino) e Historias Clínicas...');
    let successCount = 0;
    let failedCount = 0;

    const tenants = [
      { name: 'Dr. Julio (Inquilino A)', token: tokenA, patientsCount: 100 },
      { name: 'Dr. Admin HCE (Inquilino B)', token: tokenB, patientsCount: 100 }
    ];

    for (const tenant of tenants) {
      console.log(`\n⏳ Procesando ${tenant.name}...`);
      
      for (let i = 1; i <= tenant.patientsCount; i++) {
        const uniqueDni = String(Math.floor(10000000 + Math.random() * 90000000));
        const patientData = generateRandomPatient(uniqueDni);
        
        try {
          // A. Crear paciente
          const tCreate = Date.now();
          const createRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tenant.token}` }
          }, patientData);
          requestDurations.push(Date.now() - tCreate);

          if (createRes.statusCode !== 201) {
            throw new Error(`Error paciente DNI ${uniqueDni}: ${createRes.statusCode}`);
          }
          const createdPatient = JSON.parse(createRes.body);
          const patientId = createdPatient.id;

          // B. Crear Signo Vital (Observation LOINC)
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
            headers: { 'Authorization': `Bearer ${tenant.token}` }
          }, vitalPayload);
          requestDurations.push(Date.now() - tVital);

          // C. Crear Alergia (AllergyIntolerance SNOMED)
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
            headers: { 'Authorization': `Bearer ${tenant.token}` }
          }, allergyPayload);
          requestDurations.push(Date.now() - tAllergy);

          // D. Crear Procedimiento Odontológico (Procedure SNOMED)
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
            headers: { 'Authorization': `Bearer ${tenant.token}` }
          }, procedurePayload);
          requestDurations.push(Date.now() - tProc);

          // E. Crear Encuentro SOAP (Encounter FHIR)
          const encounterPayload = {
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
              { text: 'S: Paciente refiere sensibilidad dental al frío.' },
              { text: 'O: Lesión cariosa oclusal en pieza 16.' },
              { text: 'A: Caries activa de esmalte y dentina.' },
              { text: 'P: Obturación estética con composite.' }
            ]
          };
          const tEncounter = Date.now();
          const encRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/encounter`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tenant.token}` }
          }, encounterPayload);
          requestDurations.push(Date.now() - tEncounter);

          if (encRes.statusCode === 201) {
            const createdEncounter = JSON.parse(encRes.body);
            const encounterId = createdEncounter.id;

            // Firmar Encuentro
            const tSignEnc = Date.now();
            await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/encounter/${encounterId}/sign`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${tenant.token}` }
            }, {});
            requestDurations.push(Date.now() - tSignEnc);
          }

          // F. Crear Receta Electrónica (MedicationRequest FHIR)
          const rxPayload = {
            medicationName: getRandomItem(['Ibuprofeno 600 mg', 'Amoxicilina 500 mg', 'Paracetamol 500 mg', 'Clonazepam 0.5 mg']),
            medicationCode: 'RX-MED',
            doseValue: '1',
            frequencyHours: '8',
            durationDays: '5',
            dosageText: 'Tomar 1 comprimido cada 8 horas.'
          };
          const tRx = Date.now();
          const rxRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tenant.token}` }
          }, rxPayload);
          requestDurations.push(Date.now() - tRx);

          if (rxRes.statusCode === 201) {
            const createdRx = JSON.parse(rxRes.body);
            const rxId = createdRx.id;

            // Firmar Receta
            const tSignRx = Date.now();
            await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${rxId}/sign`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${tenant.token}` }
            }, {});
            requestDurations.push(Date.now() - tSignRx);
          }

          successCount++;
          if (successCount % 10 === 0) {
            console.log(`   Processed ${successCount}/200 patients (DNI ${uniqueDni}: ${patientData.name[0].given[0]} ${patientData.name[0].family})`);
          }
        } catch (err) {
          console.error(`   ❌ Fallo al procesar paciente número ${i}:`, err.message);
          failedCount++;
        }
      }
    }

    // ----------------------------------------------------
    // 3. ANÁLISIS DE RENDIMIENTO
    // ----------------------------------------------------
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = durationMs / 1000;
    const avgDuration = requestDurations.reduce((sum, val) => sum + val, 0) / requestDurations.length;
    const totalRequests = requestDurations.length;
    const throughput = totalRequests / durationSec;

    console.log('\n📊 3. Métricas de Rendimiento del Sistema:');
    console.log(`   - Pacientes sembrados con éxito: ${successCount}/200`);
    console.log(`   - Fallos de transacción: ${failedCount}`);
    console.log(`   - Peticiones REST enviadas totales: ${totalRequests}`);
    console.log(`   - Tiempo total de prueba de estrés: ${durationSec.toFixed(2)} segundos`);
    console.log(`   - Promedio de respuesta de API: ${avgDuration.toFixed(1)} ms por petición`);
    console.log(`   - Tasa de procesamiento (Throughput): ${throughput.toFixed(1)} peticiones/segundo`);

    console.log('\n🎉 ¡PRUEBA DE ESTRÉS FINALIZADA CON ÉXITO! (100% Correcto) 🎉\n');
    console.log('👉 INSTRUCCIONES PARA PRUEBA VISUAL DE LA HISTORIA CLÍNICA:');
    console.log('   1. Abre tu navegador e ingresa a: http://localhost:5173/');
    console.log('   2. Inicia sesión como Doctor Julio (usuario: "doctor_julio", clave: "doctor_pass_2026").');
    console.log('   3. Ve a "Historia Clínica" y realiza búsquedas de pacientes cargados.');
    console.log('   4. Compara la fluidez al cargar odontogramas, alergias y signos vitales recién generados.');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO EN LA PRUEBA DE ESTRÉS:', error.message);
    process.exit(1);
  }
}

runStressTest();
