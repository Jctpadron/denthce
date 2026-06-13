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

async function runTests() {
  console.log('🧪 Iniciando Pruebas de Integración de Admisión e Historias Clínicas...');
  
  // Generar un DNI único para evitar colisiones
  const testDni = String(Math.floor(10000000 + Math.random() * 90000000));
  console.log(`📌 DNI de prueba generado para el flujo: ${testDni}`);

  try {
    // ----------------------------------------------------
    // 1. AUTENTICACIÓN
    // ----------------------------------------------------
    console.log('\n🔐 1. Autenticando usuarios...');
    
    // Inquilino A: Doctor Julio
    const doctorToken = await getToken('doctor_julio', 'doctor_pass_2026');
    console.log('   ✅ Doctor Julio (Inquilino A) autenticado.');

    // Inquilino B: Administrador HCE (actuando como administrador de otro consultorio/inquilino)
    const adminToken = await getToken('admin_hce', 'admin_pass_2026');
    console.log('   ✅ Administrador HCE (Inquilino B) autenticado.');

    // ----------------------------------------------------
    // 2. ALTA DE PACIENTE (FHIR Patient) - INQUILINO A
    // ----------------------------------------------------
    console.log('\n📝 2. Probando Alta de Paciente (Inquilino A)...');
    
    const patientPayload = {
      resourceType: 'Patient',
      active: true,
      identifier: [
        {
          use: 'official',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'NNARG',
                display: 'National Person Identifier',
              },
            ],
          },
          system: 'http://hospital.gov/dni',
          value: testDni,
        },
      ],
      name: [
        {
          use: 'official',
          family: 'Pérez',
          given: ['Juan Carlos'],
        },
      ],
      gender: 'male',
      birthDate: '1988-06-15',
      telecom: [
        { system: 'phone', value: '+5492614567890', use: 'home' },
        { system: 'email', value: 'juan.perez.test@example.com', use: 'home' }
      ],
      address: [
        {
          use: 'home',
          type: 'both',
          line: ['Av. San Martín 1234'],
          city: 'Mendoza',
          country: 'Argentina'
        }
      ]
    };

    const createPatientRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, patientPayload);

    if (createPatientRes.statusCode !== 201) {
      throw new Error(`Fallo al crear paciente: ${createPatientRes.body}`);
    }

    const createdPatient = JSON.parse(createPatientRes.body);
    const patientId = createdPatient.id;
    console.log(`   ✅ Paciente creado con éxito por Doctor Julio.`);
    console.log(`      - ID Generado: ${patientId}`);
    console.log(`      - Nombre: ${createdPatient.name[0].given[0]} ${createdPatient.name[0].family}`);

    // Búsqueda del paciente por DNI (Inquilino A)
    console.log('🔍 Buscando paciente por DNI (Inquilino A)...');
    const searchRes = await request(`${BACKEND_URL}/fhir/r4/Patient?identifier=${testDni}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    if (searchRes.statusCode !== 200) {
      throw new Error(`Fallo al buscar paciente: ${searchRes.body}`);
    }

    const searchBundle = JSON.parse(searchRes.body);
    if (searchBundle.total !== 1 || searchBundle.entry[0].resource.id !== patientId) {
      throw new Error('La búsqueda no devolvió el paciente esperado o devolvió múltiples resultados.');
    }
    console.log(`   ✅ Búsqueda exitosa. Se devolvió 1 recurso compatible con FHIR Bundle.`);

    // Validar restricción de DNI duplicado para el mismo inquilino
    console.log('⚠️ Intentando crear un paciente con el mismo DNI bajo el mismo inquilino (Doctor Julio)...');
    const duplicateCreateRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, patientPayload);

    if (duplicateCreateRes.statusCode !== 409) {
      throw new Error(`Se esperaba código 409 Conflict, pero se recibió: ${duplicateCreateRes.statusCode}`);
    }
    console.log(`   ✅ Restricción validada. El servidor rechazó la creación con 409 Conflict.`);

    // ----------------------------------------------------
    // 3. REGISTRO DE HISTORIA CLÍNICA (Recursos Clínicos)
    // ----------------------------------------------------
    console.log('\n🦷 3. Registrando recursos clínicos de la Historia Clínica (Inquilino A)...');

    // Registrar Signo Vital (Observation - Temperatura)
    console.log('   💓 Registrando Signo Vital (Observation)...');
    const vitalsPayload = {
      resourceType: 'Observation',
      payload: {
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Temperatura' }],
          text: 'Temperatura'
        },
        valueQuantity: { value: 36.8, unit: '°C' },
        effectiveDateTime: new Date().toISOString(),
      }
    };

    const vitalsRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, vitalsPayload);

    if (vitalsRes.statusCode !== 201) {
      throw new Error(`Fallo al registrar Signo Vital: ${vitalsRes.body}`);
    }
    const createdVitals = JSON.parse(vitalsRes.body);
    console.log(`      ✅ Signo Vital registrado. ID: ${createdVitals.id}`);

    // Registrar Alergia (AllergyIntolerance)
    console.log('   ⚠️ Registrando Alergia (AllergyIntolerance)...');
    const allergyPayload = {
      resourceType: 'AllergyIntolerance',
      payload: {
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active', display: 'Active' }]
        },
        verificationStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed', display: 'Confirmed' }]
        },
        category: ['food'],
        criticality: 'high',
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '300916003', display: 'Alergia a la Penicilina' }],
          text: 'Alergia a la Penicilina'
        }
      }
    };

    const allergyRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, allergyPayload);

    if (allergyRes.statusCode !== 201) {
      throw new Error(`Fallo al registrar Alergia: ${allergyRes.body}`);
    }
    const createdAllergy = JSON.parse(allergyRes.body);
    console.log(`      ✅ Alergia registrada. ID: ${createdAllergy.id}`);

    // Registrar Procedimiento Odontológico (Procedure)
    console.log('   🦷 Registrando Tratamiento Odontológico (Procedure)...');
    const procedurePayload = {
      resourceType: 'Procedure',
      payload: {
        status: 'completed',
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '275926002', display: 'Restauración de diente' }],
          text: 'Restauración de diente'
        },
        bodySite: {
          coding: [
            { system: 'http://snomed.info/sct', code: '18', display: 'Diente 18' },
            { system: 'http://snomed.info/sct', code: 'O', display: 'Superficie Oclusal' }
          ]
        }
      }
    };

    const procedureRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, procedurePayload);

    if (procedureRes.statusCode !== 201) {
      throw new Error(`Fallo al registrar Procedimiento: ${procedureRes.body}`);
    }
    const createdProcedure = JSON.parse(procedureRes.body);
    console.log(`      ✅ Procedimiento registrado. ID: ${createdProcedure.id}`);

    // Listar Historia Clínica Completa
    console.log('🔍 Listando Historia Clínica de Paciente A...');
    const historyRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    if (historyRes.statusCode !== 200) {
      throw new Error(`Fallo al listar historia clínica: ${historyRes.body}`);
    }
    const historyList = JSON.parse(historyRes.body);
    if (historyList.length !== 3) {
      throw new Error(`Se esperaban 3 recursos en el historial clínico, pero se obtuvieron: ${historyList.length}`);
    }
    console.log(`   ✅ Historia clínica obtenida correctamente. Se recuperaron los 3 registros ingresados.`);

    // ----------------------------------------------------
    // 4. AISLAMIENTO MULTI-INQUILINO (Zero Trust)
    // ----------------------------------------------------
    console.log('\n🛡️ 4. Verificando Aislamiento Multi-Inquilino (Zero Trust)...');

    // Inquilino B intenta buscar paciente del Inquilino A por DNI
    console.log(`   🔍 Inquilino B intenta buscar DNI ${testDni}...`);
    const adminSearchRes = await request(`${BACKEND_URL}/fhir/r4/Patient?identifier=${testDni}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (adminSearchRes.statusCode !== 200) {
      throw new Error(`Fallo inesperado al buscar (se esperaba 200 con total:0): ${adminSearchRes.body}`);
    }
    const adminSearchBundle = JSON.parse(adminSearchRes.body);
    if (adminSearchBundle.total !== 0 || adminSearchBundle.entry.length !== 0) {
      throw new Error('⚠️ ¡FALLO DE SEGURIDAD! El Inquilino B pudo encontrar al paciente del Inquilino A.');
    }
    console.log('      ✅ Aislamiento de búsqueda demográfica exitoso (se retornaron 0 resultados).');

    // Inquilino B intenta acceder al paciente directamente por ID
    console.log(`   🔍 Inquilino B intenta acceder a paciente ID ${patientId}...`);
    const adminGetPatientRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (adminGetPatientRes.statusCode !== 404) {
      throw new Error(`⚠️ ¡FALLO DE SEGURIDAD! Se esperaba código 404, pero se recibió: ${adminGetPatientRes.statusCode}`);
    }
    console.log('      ✅ Aislamiento por ID directo exitoso (se retornó 404 Not Found).');

    // Inquilino B intenta acceder a la historia clínica del paciente por ID
    console.log(`   🔍 Inquilino B intenta acceder a la historia clínica del paciente ID ${patientId}...`);
    const adminGetHistoryRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (adminGetHistoryRes.statusCode !== 404) {
      throw new Error(`⚠️ ¡FALLO DE SEGURIDAD! Se esperaba código 404 para historia clínica ajena, pero se recibió: ${adminGetHistoryRes.statusCode}`);
    }
    console.log('      ✅ Aislamiento de historia clínica exitoso (se retornó 404 Not Found).');

    // Inquilino B crea su PROPIO paciente con el MISMO DNI (scoping por inquilino)
    console.log(`   📝 Inquilino B intenta registrar un paciente con el mismo DNI ${testDni}...`);
    const patientBPayload = {
      ...patientPayload,
      name: [{ use: 'official', family: 'Gómez', given: ['Carlos'] }]
    };

    const createPatientBRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, patientBPayload);

    if (createPatientBRes.statusCode !== 201) {
      throw new Error(`Fallo al registrar paciente de Inquilino B: ${createPatientBRes.body}`);
    }
    const createdPatientB = JSON.parse(createPatientBRes.body);
    const patientBId = createdPatientB.id;
    console.log(`      ✅ Paciente creado con éxito por Inquilino B (DNI duplicado permitido entre inquilinos diferentes).`);
    console.log(`      - ID Generado para Paciente B: ${patientBId}`);

    // Verificar listados separados
    console.log('   🔍 Verificando listados aislados de pacientes...');
    
    // Inquilino A busca sus pacientes
    const docSearchRes = await request(`${BACKEND_URL}/fhir/r4/Patient?identifier=${testDni}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    const docBundle = JSON.parse(docSearchRes.body);
    
    // Inquilino B busca sus pacientes
    const bSearchRes = await request(`${BACKEND_URL}/fhir/r4/Patient?identifier=${testDni}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const bBundle = JSON.parse(bSearchRes.body);

    if (docBundle.entry[0].resource.id !== patientId || bBundle.entry[0].resource.id !== patientBId) {
      throw new Error('Mezcla de datos: Un inquilino recuperó el paciente del otro.');
    }
    console.log('      ✅ Verificación de listados independientes exitosa.');

    // ----------------------------------------------------
    // 5. ELIMINACIÓN Y LIMPIEZA
    // ----------------------------------------------------
    console.log('\n🧹 5. Probando Eliminación de Recursos Clínicos y Limpieza...');

    // Eliminar el signo vital
    console.log(`   🗑️ Eliminando recurso clínico ID ${createdVitals.id}...`);
    const deleteRes = await request(`${BACKEND_URL}/fhir/r4/Patient/clinical-resource/${createdVitals.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    if (deleteRes.statusCode !== 200) {
      throw new Error(`Error al eliminar recurso clínico: ${deleteRes.body}`);
    }
    console.log('      ✅ Recurso eliminado correctamente.');

    // Verificar que ya no esté listado en la historia clínica
    console.log('   🔍 Listando historia clínica para verificar eliminación...');
    const updatedHistoryRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}/clinical-resource`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    const updatedHistoryList = JSON.parse(updatedHistoryRes.body);
    if (updatedHistoryList.length !== 2) {
      throw new Error(`Se esperaban 2 recursos, pero se obtuvieron: ${updatedHistoryList.length}`);
    }
    console.log('      ✅ Verificación de eliminación exitosa. El recurso ya no figura.');

    // Limpieza: Eliminar los recursos clínicos restantes de Inquilino A para dejar limpia la base
    console.log('   🗑️ Eliminando el resto de recursos de prueba...');
    await request(`${BACKEND_URL}/fhir/r4/Patient/clinical-resource/${createdAllergy.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    await request(`${BACKEND_URL}/fhir/r4/Patient/clinical-resource/${createdProcedure.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    console.log('      ✅ Limpieza completada.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO! (100% Passed) 🎉');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', error.message);
    process.exit(1);
  }
}

runTests();
