// Prueba funcional del módulo AISLADO de HC Odontológica (local).
// Verifica: listado de pacientes (contrato Bundle), crear plan (azul),
// completar (azul→rojo), y aislamiento respecto de la HC original.
const http = require('http');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = options.headers || {};
    if (body && typeof body !== 'string') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: options.method || 'GET', headers, agent: false },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      },
    );
    req.setTimeout(8000, () => { req.destroy(); reject(new Error(`TIMEOUT 8s en ${u.pathname}`)); });
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
  let ok = 0, fail = 0;
  const check = (cond, msg) => { if (cond) { console.log(`  ✅ ${msg}`); ok++; } else { console.log(`  ❌ ${msg}`); fail++; } };

  try {
    console.log('🧪 Test módulo HC Odontológica (aislado)\n');
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    const auth = { Authorization: `Bearer ${token}` };
    console.log('🔑 Token obtenido (doctor_julio)\n');

    // 1) Listado de pacientes (lo que consume OdontologyHC)
    const list = await request(`${BACKEND_URL}/fhir/r4/Patient`, { headers: auth });
    const bundle = JSON.parse(list.body);
    const entries = bundle.entry || [];
    check(list.statusCode === 200, `GET /fhir/r4/Patient → ${list.statusCode}`);
    check(Array.isArray(entries), `Respuesta es Bundle con .entry (${entries.length} pacientes)`);
    if (entries.length === 0) { console.log('\n⚠️  No hay pacientes cargados; el resto del test necesita al menos uno.'); return; }
    const patientId = entries[0].resource.id;
    console.log(`  → Paciente de prueba: ${patientId}\n`);

    // 2) Crear un tratamiento PLANIFICADO (azul) en el módulo odontológico
    const planPayload = {
      resourceType: 'Procedure',
      payload: {
        status: 'preparation',
        code: { coding: [{ system: 'http://snomed.info/sct', code: '23450005', display: 'Restauración dental' }], text: 'Restauración (plan)' },
        bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '11' }, { system: 'http://snomed.info/sct', code: 'O' }] },
        extension: [{ url: 'http://denthce.local/fhir/StructureDefinition/odontogram-layer', valueCode: 'planned' }],
      },
    };
    const created = await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { method: 'POST', headers: auth }, planPayload);
    const createdBody = JSON.parse(created.body);
    check(created.statusCode === 201 || created.statusCode === 200, `POST /odontology/.../resource → ${created.statusCode}`);
    check(!!createdBody.id, `Recurso creado con id ${createdBody.id || '(sin id)'}`);
    const resourceId = createdBody.id;

    // 3) Leer y confirmar que quedó como 'planned'
    const after = await request(`${BACKEND_URL}/odontology/patient/${patientId}/resource`, { headers: auth });
    const afterArr = JSON.parse(after.body);
    const found = afterArr.find((r) => r.id === resourceId);
    const layerOf = (p) => (p.extension || []).find((e) => e.url.endsWith('odontogram-layer'))?.valueCode;
    check(Array.isArray(afterArr), `GET /odontology/.../resource devuelve arreglo (${afterArr.length})`);
    check(found && layerOf(found) === 'planned', 'El recurso quedó en capa PLANNED (azul)');

    // 4) Completar: plan → existente (azul → rojo)
    const completed = await request(`${BACKEND_URL}/odontology/resource/${resourceId}/complete`, { method: 'PATCH', headers: auth });
    const completedBody = JSON.parse(completed.body);
    check(completed.statusCode === 200, `PATCH /odontology/resource/:id/complete → ${completed.statusCode}`);
    check(layerOf(completedBody) === 'existing', 'Tras completar quedó en capa EXISTING (rojo)');
    check(completedBody.status === 'completed', "Procedure.status pasó a 'completed'");

    // 5) Aislamiento: el recurso NO debe aparecer en la HC original
    const original = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, { headers: auth });
    const originalArr = JSON.parse(original.body);
    check(!originalArr.find((r) => r.id === resourceId), 'AISLAMIENTO: el recurso NO está en fhir_clinical_resources (HC original)');

    // 6) Limpieza
    const del = await request(`${BACKEND_URL}/odontology/resource/${resourceId}`, { method: 'DELETE', headers: auth });
    check(del.statusCode === 200, `DELETE de limpieza → ${del.statusCode}`);

    console.log(`\n📊 Resultado: ${ok} OK, ${fail} fallos`);
    process.exitCode = fail > 0 ? 1 : 0;
  } catch (e) {
    console.error('💥 Error en el test:', e.message);
    process.exitCode = 1;
  }
})();
