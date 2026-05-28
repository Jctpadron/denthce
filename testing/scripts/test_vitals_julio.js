const http = require('http');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';

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

async function runVitalsIntegrationTest() {
  console.log('🧪 Iniciando Verificación de Signos Vitales con usuario doctor_julio...');
  
  try {
    // 1. Obtener Token de Keycloak
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    console.log('✅ Autenticación exitosa. Token obtenido.');

    // 2. Dar de alta a un paciente de prueba
    const testDni = String(Math.floor(10000000 + Math.random() * 90000000));
    console.log(`📌 Registrando paciente de prueba DNI: ${testDni}...`);
    
    const patientPayload = {
      resourceType: 'Patient',
      active: true,
      identifier: [{
        use: 'official',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'NNARG', display: 'National Person Identifier' }] },
        system: 'http://hospital.gov/dni',
        value: testDni,
      }],
      name: [{ use: 'official', family: 'Gómez', given: ['Carlos Alberto'] }],
      gender: 'male',
      birthDate: '1975-04-20',
    };

    const patientRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, patientPayload);

    if (patientRes.statusCode !== 201) {
      throw new Error(`Error al crear paciente: ${patientRes.body}`);
    }

    const createdPatient = JSON.parse(patientRes.body);
    const patientId = createdPatient.id;
    console.log(`✅ Paciente creado con éxito. ID FHIR: ${patientId}`);

    // 3. Generar 25 signos vitales variados chronológicamente en las últimas 25 horas
    console.log('\n⚡ Registrando 25 registros de signos vitales (Observaciones FHIR)...');
    
    const baseDate = new Date();
    
    const vitalPresets = [
      { code: '55284-4', label: 'Presión Arterial', isComposite: true },
      { code: '8310-5', label: 'Temperatura', isComposite: false, unit: '°C' },
      { code: '8867-4', label: 'Pulso / FC', isComposite: false, unit: 'lpm' },
      { code: '29463-7', label: 'Peso', isComposite: false, unit: 'kg' },
      { code: '8302-2', label: 'Talla', isComposite: false, unit: 'cm' },
      { code: '59408-5', label: 'Saturación O₂', isComposite: false, unit: '%' }
    ];

    for (let i = 0; i < 25; i++) {
      // Avanzar hora por hora
      const measurementDate = new Date(baseDate.getTime() - (25 - i) * 60 * 60 * 1000);
      const formattedDate = measurementDate.toISOString();

      // Elegir preset cíclicamente
      const preset = vitalPresets[i % vitalPresets.length];
      let payload = {
        resourceType: 'Observation',
        payload: {
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: preset.code, display: preset.label }],
            text: preset.label
          },
          effectiveDateTime: formattedDate
        }
      };

      if (preset.isComposite) {
        // Presión arterial
        const sysVal = 115 + (i % 5) * 3; // 115, 118, 121, 124, 127
        const diaVal = 75 + (i % 3) * 3;   // 75, 78, 81
        payload.payload.component = [
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Sistólica' }] },
            valueQuantity: { value: sysVal, unit: 'mmHg' }
          },
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastólica' }] },
            valueQuantity: { value: diaVal, unit: 'mmHg' }
          }
        ];
      } else {
        let value = 0;
        if (preset.code === '8310-5') value = 36.2 + (i % 8) * 0.2; // Temperatura
        else if (preset.code === '8867-4') value = 70 + (i % 6) * 3; // FC
        else if (preset.code === '29463-7') value = 80.0 + (i % 3) * 0.5; // Peso
        else if (preset.code === '8302-2') value = 175; // Talla
        else if (preset.code === '59408-5') value = 96 + (i % 4); // Sat O2

        payload.payload.valueQuantity = {
          value: value,
          unit: preset.unit
        };
      }

      const obsRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, payload);

      if (obsRes.statusCode !== 201) {
        throw new Error(`Error al registrar observación #${i + 1}: ${obsRes.body}`);
      }
      
      console.log(`   [${i + 1}/25] Registrado: ${preset.label} a las ${measurementDate.toLocaleTimeString('es-AR')}`);
    }

    console.log('\n🔍 4. Verificando persistencia y consulta en la API...');
    const listRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (listRes.statusCode !== 200) {
      throw new Error(`Error al listar recursos clínicos: ${listRes.body}`);
    }

    const resources = JSON.parse(listRes.body);
    const observationCount = resources.filter(r => r.resourceType === 'Observation').length;

    console.log(`\n🎉 RESULTADO DEL TEST:`);
    console.log(`----------------------------------------------`);
    console.log(`📌 Paciente ID: ${patientId}`);
    console.log(`📊 Total observaciones FHIR creadas: 25`);
    console.log(`🔍 Total observaciones FHIR encontradas: ${observationCount}`);
    
    if (observationCount === 25) {
      console.log(`🟢 TEST COMPLETADO CON ÉXITO: 25/25 registros validados.`);
    } else {
      throw new Error(`Discrepancia en registros guardados: Esperados 25, Encontrados ${observationCount}`);
    }

  } catch (error) {
    console.error('🔴 ERROR EN TEST DE SIGNOS VITALES:', error.message);
    process.exit(1);
  }
}

runVitalsIntegrationTest();
