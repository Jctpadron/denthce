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

async function runPrescriptionTests() {
  console.log('🧪 Iniciando Pruebas de Integración - Módulo 4: Receta Electrónica y CDS Hooks...');
  
  try {
    // ----------------------------------------------------
    // 1. AUTENTICACIÓN
    // ----------------------------------------------------
    console.log('\n🔐 1. Autenticando usuarios...');
    const doctorToken = await getToken('doctor_julio', 'doctor_pass_2026');
    console.log('   ✅ Doctor Julio (Inquilino A) autenticado.');

    const otherTenantToken = await getToken('admin_hce', 'admin_pass_2026');
    console.log('   ✅ Administrador HCE (Inquilino B) autenticado.');

    // ----------------------------------------------------
    // 2. CREACIÓN DE PACIENTE DE PRUEBA
    // ----------------------------------------------------
    console.log('\n📝 2. Creando paciente de prueba (Inquilino A)...');
    const testDni = String(Math.floor(10000000 + Math.random() * 90000000));
    
    const patientRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
    }, {
      resourceType: 'Patient',
      active: true,
      identifier: [{ system: 'http://hospital.gov/dni', value: testDni }],
      name: [{ family: 'Rodriguez', given: ['Mariana'] }],
      gender: 'female',
      birthDate: '1995-10-12'
    });

    if (patientRes.statusCode !== 201) {
      throw new Error(`Error al crear paciente: ${patientRes.body}`);
    }

    const patient = JSON.parse(patientRes.body);
    const patientId = patient.id;
    console.log(`   ✅ Paciente creado. ID: ${patientId}`);

    // ----------------------------------------------------
    // 3. REGISTRO DE ALERGIA A LA PENICILINA (FHIR AllergyIntolerance)
    // ----------------------------------------------------
    console.log('\n⚠️ 3. Registrando alergia a la Penicilina...');
    const allergyRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
    }, {
      resourceType: 'AllergyIntolerance',
      payload: {
        clinicalStatus: { coding: [{ code: 'active', display: 'Activo' }] },
        verificationStatus: { coding: [{ code: 'confirmed', display: 'Confirmado' }] },
        type: 'allergy',
        category: ['medication'],
        criticality: 'high',
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '300916003', display: 'Alergia a la Penicilina' }],
          text: 'Alergia a la Penicilina'
        }
      }
    });

    if (allergyRes.statusCode !== 201) {
      throw new Error(`Error al registrar alergia: ${allergyRes.body}`);
    }
    console.log('   ✅ Alergia a la Penicilina registrada con éxito.');

    // ----------------------------------------------------
    // 4. MOTOR CDS HOOKS: PRESCRIBIR AMOXICILINA (Alerta Esperada)
    // ----------------------------------------------------
    console.log('\n💊 4. Probando Motor CDS Hooks — Prescribiendo Amoxicilina...');
    const amoxDraftRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
    }, {
      medicationName: 'Amoxicilina 875 mg',
      medicationCode: 'AMX-875',
      doseValue: '1',
      frequencyHours: '8',
      durationDays: '7',
      dosageText: 'Tomar 1 comprimido cada 8 horas por 7 días.'
    });

    if (amoxDraftRes.statusCode !== 201) {
      throw new Error(`Error al crear borrador de Amoxicilina: ${amoxDraftRes.body}`);
    }

    const amoxDraft = JSON.parse(amoxDraftRes.body);
    console.log('   ✅ Borrador de receta creado.');
    console.log('   🔍 Advertencias CDS Hooks devueltas por la API:');
    console.log(amoxDraft.warnings);

    if (amoxDraft.warnings.length === 0 || !amoxDraft.warnings[0].includes('PENICILINA')) {
      throw new Error('FALLO: El motor CDS Hooks no generó la alerta esperada para la alergia a la Penicilina.');
    }
    console.log('   🟢 ÉXITO: Alerta CDS de alergia a penicilinas interceptada correctamente.');

    // ----------------------------------------------------
    // 5. MOTOR CDS HOOKS: PRESCRIBIR IBUPROFENO (Sin Alerta de Penicilina)
    // ----------------------------------------------------
    console.log('\n💊 5. Probando Motor CDS Hooks — Prescribiendo Ibuprofeno (Sustancia segura)...');
    const ibuDraftRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
    }, {
      medicationName: 'Ibuprofeno 600 mg',
      medicationCode: 'IBU-600',
      doseValue: '1',
      frequencyHours: '12',
      durationDays: '3',
      dosageText: 'Tomar 1 comprimido cada 12 horas en caso de dolor.'
    });

    if (ibuDraftRes.statusCode !== 201) {
      throw new Error(`Error al crear borrador de Ibuprofeno: ${ibuDraftRes.body}`);
    }

    const ibuDraft = JSON.parse(ibuDraftRes.body);
    console.log('   ✅ Borrador de receta (Ibuprofeno) creado.');
    console.log('   🔍 Advertencias CDS Hooks devueltas por la API (debe ser vacía):');
    console.log(ibuDraft.warnings);

    if (ibuDraft.warnings.length > 0 && ibuDraft.warnings.some(w => w.includes('PENICILINA'))) {
      throw new Error('FALLO: El motor CDS Hooks generó una alerta incorrecta de penicilina para el Ibuprofeno.');
    }
    console.log('   🟢 ÉXITO: Sin alertas cruzadas incorrectas.');

    // ----------------------------------------------------
    // 6. FIRMA DIGITAL DE RECETA E INMUTABILIDAD
    // ----------------------------------------------------
    console.log('\n🔒 6. Probando Firma Digital de la Receta e Inmutabilidad...');
    const signRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${amoxDraft.id}/sign`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    if (signRes.statusCode !== 201) {
      throw new Error(`Error al firmar receta: ${signRes.body}`);
    }

    const signedPrescription = JSON.parse(signRes.body);
    console.log('   ✅ Receta firmada electrónicamente.');
    console.log(`   📌 Firmado Por: ${signedPrescription.extension.find(e => e.url.includes('signed-by')).valueString}`);
    console.log(`   🔑 Hash Criptográfico (Integridad): ${signedPrescription.extension.find(e => e.url.includes('prescription-hash')).valueString}`);
    console.log(`   📱 URL del Código QR de Validación: ${signedPrescription.extension.find(e => e.url.includes('prescription-qr')).valueString}`);

    // Intentar modificar la receta firmada (Debe fallar)
    console.log('   📝 Intentando modificar receta firmada (Debe lanzar 403 Forbidden)...');
    const updateRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${amoxDraft.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
    }, {
      medicationName: 'Amoxicilina 500 mg'
    });

    if (updateRes.statusCode !== 403) {
      throw new Error(`FALLO: Se permitió modificar una receta firmada. Código devuelto: ${updateRes.statusCode}`);
    }
    console.log('   🟢 ÉXITO: Modificación bloqueada de forma inmutable (403 Forbidden).');

    // ----------------------------------------------------
    // 7. AISLAMIENTO MULTI-INQUILINO (ZERO TRUST)
    // ----------------------------------------------------
    console.log('\n🛡️ 7. Probando Aislamiento Multi-Inquilino (Zero Trust)...');
    console.log('   🔍 Inquilino B intentando consultar la receta del Inquilino A (Debe lanzar 404/403)...');
    
    const tenantBRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${amoxDraft.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${otherTenantToken}` }
    });

    if (tenantBRes.statusCode !== 404 && tenantBRes.statusCode !== 403) {
      throw new Error(`FALLO: El Inquilino B pudo acceder a la receta del Inquilino A. Código: ${tenantBRes.statusCode}`);
    }
    console.log('   🟢 ÉXITO: Acceso bloqueado. Aislamiento multi-inquilino verificado.');

    console.log('\n🎉 TODOS LAS PRUEBAS DEL MÓDULO 4 PASARON CON ÉXITO (100% OK).');
    
  } catch (err) {
    console.error(`🔴 FALLO EN INTEGRACIÓN DEL MÓDULO 4:`, err.message);
    process.exit(1);
  }
}

runPrescriptionTests();
