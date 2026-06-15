// Prueba funcional del módulo de HC Odontológica en el entorno de PRODUCCIÓN.
// Verifica la autenticación mediante HTTPS, el consumo del listado de pacientes FHIR,
// la creación de un Procedure planificado, su completado e integridad de aislamiento.
const https = require('https');

const KEYCLOAK_URL = 'https://auth.systia.ar';
const BACKEND_URL = 'https://api.systia.ar';
const REALM = 'hce-realm';

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = options.headers || {};
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    headers['Origin'] = 'https://historiaclinica.systia.ar';
    headers['Referer'] = 'https://historiaclinica.systia.ar/';
    headers['Accept'] = 'application/json, text/plain, */*';
    if (body && typeof body !== 'string') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    
    const req = https.request(
      { 
        hostname: u.hostname, 
        port: u.port || 443, 
        path: u.pathname + u.search, 
        method: options.method || 'GET', 
        headers, 
        agent: false 
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      },
    );
    req.setTimeout(12000, () => { 
      req.destroy(); 
      reject(new Error(`TIMEOUT 12s en ${u.pathname}`)); 
    });
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
    method: 'POST', 
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, params.toString());
  
  if (res.statusCode !== 200) throw new Error(`Auth falló: [HTTP ${res.statusCode}] ${res.body}`);
  return JSON.parse(res.body).access_token;
}

(async () => {
  let ok = 0, fail = 0;
  const check = (cond, msg) => { 
    if (cond) { 
      console.log(`  ✅ ${msg}`); 
      ok++; 
    } else { 
      console.log(`  ❌ ${msg}`); 
      fail++; 
    } 
  };

  try {
    console.log('🧪 Iniciando prueba funcional en el entorno de PRODUCCIÓN HCE...\n');
    console.log(`🔗 Conectando a Keycloak: ${KEYCLOAK_URL}`);
    console.log(`🔗 Conectando a API Backend: ${BACKEND_URL}\n`);
    
    // Obtener token JWT
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    const auth = { Authorization: `Bearer ${token}` };
    console.log('🔑 Token de acceso obtenido con éxito (doctor_julio)\n');

    // 1) Crear un paciente de prueba temporal único
    console.log('1. Creando paciente temporal único para pruebas en producción...');
    const randomDni = Math.floor(10000000 + Math.random() * 90000000).toString();
    const tempPatient = {
      resourceType: 'Patient',
      active: true,
      identifier: [{ use: 'official', system: 'http://hospital.gov/dni', value: randomDni }],
      name: [{ use: 'official', family: 'Test-Prod-Odonto', given: ['PacienteTemp'] }],
      gender: 'other',
      birthDate: '1995-05-15'
    };
    
    const pCreate = await request(`${BACKEND_URL}/fhir/r4/Patient`, { method: 'POST', headers: auth }, tempPatient);
    check(pCreate.statusCode === 201 || pCreate.statusCode === 200, `POST /fhir/r4/Patient → HTTP ${pCreate.statusCode}`);
    
    const createdP = JSON.parse(pCreate.body);
    const patientId = createdP.id;
    console.log(`  → Utilizando nuevo Paciente ID: ${patientId}\n`);

    // 2) Crear un tratamiento PLANIFICADO (capa azul)
    console.log('2. Registrando tratamiento planificado (procedimiento en preparación)...');
    const planPayload = {
      resourceType: 'Procedure',
      payload: {
        status: 'preparation',
        code: { coding: [{ system: 'http://snomed.info/sct', code: '23450005', display: 'Restauración dental' }], text: 'Restauración 3D' },
        bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '11' }, { system: 'http://snomed.info/sct', code: 'O' }] },
        extension: [{ url: 'http://denthce.local/fhir/StructureDefinition/odontogram-layer', valueCode: 'planned' }],
      },
    };
    
    const created = await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, planPayload);
    const createdBody = JSON.parse(created.body);
    check(created.statusCode === 201 || created.statusCode === 200, `POST /odontology/patient/.../resource → HTTP ${created.statusCode}`);
    check(!!createdBody.id, `Tratamiento creado en BD con ID: ${createdBody.id || 'N/A'}`);
    const resourceId = createdBody.id;

    // 3) Confirmar persistencia en la capa 'planned' (azul)
    console.log('3. Validando persistencia en capa planned...');
    const after = await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { headers: auth });
    
    console.log(`  [DEBUG] GET /odontology/patient/.../resource -> HTTP ${after.statusCode}`);
    if (after.statusCode !== 200) {
      console.log(`  [DEBUG] Response body:`, after.body);
    }

    const afterArr = JSON.parse(after.body);
    const found = afterArr.find((r) => r.id === resourceId);
    const layerOf = (p) => (p.extension || []).find((e) => e.url.endsWith('odontogram-layer'))?.valueCode;
    check(Array.isArray(afterArr), `GET /odontology/patient/.../resource retorna arreglo (${afterArr.length} items)`);
    check(found && layerOf(found) === 'planned', 'El recurso se encuentra en la capa PLANNED');

    // 4) Completar el tratamiento (planificado -> existente / azul -> rojo)
    console.log('4. Completando tratamiento (Planned → Existing)...');
    const completed = await request(`${BACKEND_URL}/odontology/resource/${resourceId}/complete`, { method: 'PATCH', headers: auth });
    const completedBody = JSON.parse(completed.body);
    check(completed.statusCode === 200, `PATCH /odontology/resource/:id/complete → HTTP ${completed.statusCode}`);
    check(layerOf(completedBody) === 'existing', 'El recurso migró correctamente a la capa EXISTING (rojo)');
    check(completedBody.status === 'completed', "El estado del Procedure FHIR pasó a 'completed'");

    // 5) Verificar aislamiento con la Historia Clínica General
    console.log('5. Verificando aislamiento Zero Trust...');
    const original = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, { headers: auth });
    const originalArr = JSON.parse(original.body);
    check(!originalArr.find((r) => r.id === resourceId), 'AISLAMIENTO: El recurso de odontología no contamina la HC general del paciente');

    // 6) Eliminar el tratamiento (Limpieza)
    console.log('6. Eliminando recurso de prueba (limpieza)...');
    const del = await request(`${BACKEND_URL}/odontology/resource/${resourceId}`, { method: 'DELETE', headers: auth });
    check(del.statusCode === 200, `DELETE /odontology/resource/:id → HTTP ${del.statusCode}`);

    console.log(`\n📊 Resumen de Calidad en Producción: ${ok} exitosos, ${fail} fallidos`);
    process.exitCode = fail > 0 ? 1 : 0;
  } catch (e) {
    console.error('\n💥 Error durante el test de producción:', e.message);
    process.exitCode = 1;
  }
})();
