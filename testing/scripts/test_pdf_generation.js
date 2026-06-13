const http = require('http');
const fs = require('fs');
const path = require('path');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';

const agent = new http.Agent({ keepAlive: true });

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...options.headers };
    if (body && typeof body !== 'string') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    
    const req = http.request(
      { 
        hostname: u.hostname, 
        port: u.port, 
        path: u.pathname + u.search, 
        method: options.method || 'GET', 
        headers, 
        agent: agent
      },
      (res) => {
        // Si esperamos binarios, devolvemos buffer
        if (options.responseType === 'arraybuffer') {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
        } else {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        }
      },
    );
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`TIMEOUT en ${u.pathname}`)); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getToken(username, password) {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', 'hce-app');
  params.append('username', username);
  params.append('password', password);
  const res = await request(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, params.toString());
  if (res.statusCode !== 200) throw new Error(`Auth falló: ${res.body}`);
  return JSON.parse(res.body).access_token;
}

(async () => {
  try {
    console.log('🧪 Iniciando prueba de generación de PDF oficial PAMI...');
    
    // 1) Autenticar
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    const auth = { Authorization: `Bearer ${token}` };
    console.log('🔑 Autenticación exitosa.');

    // 2) Obtener el primer paciente
    const list = await request(`${BACKEND_URL}/fhir/r4/Patient`, { headers: auth });
    const bundle = JSON.parse(list.body);
    const entries = bundle.entry || [];
    if (entries.length === 0) {
      console.log('❌ No hay pacientes en el padrón para realizar la prueba.');
      process.exit(1);
    }
    const patient = entries[0].resource;
    const patientId = patient.id;
    console.log(`👤 Paciente de prueba: ${patient.given} ${patient.family || ''} (ID: ${patientId})`);

    // 3) Crear cobertura médica de prueba
    console.log('⚙️ Creando datos de Cobertura de prueba...');
    const covPayload = {
      resourceType: 'Coverage',
      payload: {
        status: 'active',
        subscriberId: '1234567890-PAMI',
        obraSocial: 'PAMI INSSJP',
        beneficio: '987654321',
        prestador: 'PREST-ODONTO-12',
        medicoCabecera: 'Dra. María González',
        titular: true,
        payor: [{ display: 'PAMI' }]
      }
    };
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, covPayload);

    // 4) Crear odontograma de prueba (caries en pieza 11-O y restauración en 46-V)
    console.log('⚙️ Creando tratamientos de prueba en Odontograma...');
    const cariesPayload = {
      resourceType: 'Condition',
      payload: {
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        code: { coding: [{ system: 'http://snomed.info/sct', code: '80967001', display: 'Caries dental' }], text: 'Caries dental activa' },
        bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '11' }, { system: 'http://snomed.info/sct', code: 'O' }] },
        extension: [{ url: 'http://denthce.local/fhir/StructureDefinition/odontogram-layer', valueCode: 'existing' }]
      }
    };
    const restPayload = {
      resourceType: 'Procedure',
      payload: {
        status: 'preparation',
        code: { coding: [{ system: 'http://snomed.info/sct', code: '23450005', display: 'Restauración dental' }], text: 'Restauración' },
        bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '46' }, { system: 'http://snomed.info/sct', code: 'V' }] },
        extension: [{ url: 'http://denthce.local/fhir/StructureDefinition/odontogram-layer', valueCode: 'planned' }]
      }
    };
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, cariesPayload);
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, restPayload);

    // 5) Crear observación de estado bucal de prueba
    console.log('⚙️ Creando Estado Bucal de prueba...');
    const obsPayload = {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: { coding: [{ system: 'http://denthce.local/oral-status', code: 'oral-status' }], text: 'Estado bucal, diagnóstico y plan' },
        effectiveDateTime: new Date().toISOString(),
        component: [
          { code: { text: 'placa' }, valueBoolean: true },
          { code: { text: 'periodontal' }, valueBoolean: false },
          { code: { text: 'lesiones' }, valueBoolean: true },
          { code: { text: 'lesionZona' }, valueString: 'Encía vestibular del 46' },
          { code: { text: 'lesionTipo' }, valueString: 'Inflamación leve' },
          { code: { text: 'diagnostico' }, valueString: 'Caries en pieza 11 y restauración pendiente en 46. Gingivitis localizada.' },
          { code: { text: 'plan' }, valueString: '1. Profilaxis. 2. Operatoria dental en 11 y 46.' }
        ]
      }
    };
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, obsPayload);

    // 6) Crear consentimiento firmado de prueba con firmas de prueba (pequeños pixeles en base64)
    console.log('⚙️ Creando Consentimiento Informado con firmas...');
    const mockSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const consentPayload = {
      resourceType: 'Consent',
      payload: {
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
        dateTime: new Date().toISOString(),
        text: 'He comprendido todas las explicaciones y estoy de acuerdo con el tratamiento.',
        matricula: 'M.P. 54321',
        firmaPaciente: mockSignature,
        firmaProfesional: mockSignature
      }
    };
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, consentPayload);

    // 7) Crear un par de evoluciones clínicas
    console.log('⚙️ Creando entradas de evolución de prueba...');
    const ev1Payload = {
      resourceType: 'Procedure',
      payload: {
        status: 'completed',
        code: { coding: [{ system: 'http://denthce.local/evolution', code: 'evolution' }], text: 'Se realiza limpieza general y eliminación de placa.' },
        performedDateTime: new Date(Date.now() - 86400000 * 2).toISOString(),
        conformidad: true
      }
    };
    const ev2Payload = {
      resourceType: 'Procedure',
      payload: {
        status: 'completed',
        code: { coding: [{ system: 'http://denthce.local/evolution', code: 'evolution' }], text: 'Se inicia apertura y limpieza profunda de caries en pieza 11.' },
        performedDateTime: new Date().toISOString(),
        conformidad: true
      }
    };
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, ev1Payload);
    await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, ev2Payload);

    // 8) Descargar PDF
    console.log('📥 Descargando PDF generado...');
    const pdfRes = await request(`${BACKEND_URL}/odontology/patient/${patientId}/report/pdf`, {
      headers: auth,
      responseType: 'arraybuffer'
    });

    if (pdfRes.statusCode === 200) {
      const filePath = path.join(__dirname, 'test_odontologia.pdf');
      fs.writeFileSync(filePath, pdfRes.body);
      console.log(`✅ ¡PDF generado con éxito y guardado en: ${filePath}`);
      agent.destroy();
    } else {
      console.log(`❌ Error al generar el PDF. Código HTTP: ${pdfRes.statusCode}`);
      console.log(pdfRes.body.toString());
      agent.destroy();
      process.exit(1);
    }

  } catch (e) {
    console.error('💥 Error inesperado durante la prueba:', e.message);
    agent.destroy();
    process.exit(1);
  }
})();
