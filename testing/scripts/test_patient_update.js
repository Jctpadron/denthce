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

async function runPatientUpdateTests() {
  console.log('🧪 INICIANDO PRUEBAS DE INTEGRACIÓN: MODIFICACIÓN DE DATOS DE PACIENTES 🧪\n');

  const testDni1 = String(Math.floor(10000000 + Math.random() * 90000000));
  const testDni2 = String(Math.floor(10000000 + Math.random() * 90000000));
  console.log(`📌 DNI de prueba 1: ${testDni1}`);
  console.log(`📌 DNI de prueba 2: ${testDni2}`);

  try {
    // ----------------------------------------------------
    // 1. AUTENTICACIÓN
    // ----------------------------------------------------
    console.log('\n🔐 1. Autenticando médicos (inquilinos)...');
    const doctorToken = await getToken('doctor_julio', 'doctor_pass_2026');
    console.log('   ✅ Doctor Julio (Inquilino A) autenticado.');

    const adminToken = await getToken('admin_hce', 'admin_pass_2026');
    console.log('   ✅ Administrador HCE (Inquilino B) autenticado.');

    // ----------------------------------------------------
    // 2. CREAR PACIENTE INICIAL (Inquilino A)
    // ----------------------------------------------------
    console.log('\n📝 2. Creando paciente inicial bajo Doctor Julio (Inquilino A)...');
    const patientPayload = {
      resourceType: 'Patient',
      active: true,
      identifier: [
        {
          use: 'official',
          system: 'http://hospital.gov/dni',
          value: testDni1,
        },
      ],
      name: [
        {
          use: 'official',
          family: 'Gómez',
          given: ['Juan'],
        },
      ],
      gender: 'male',
      birthDate: '1990-01-01',
      telecom: [
        { system: 'phone', value: '+5492610000000', use: 'home' }
      ],
      address: [
        {
          use: 'home',
          type: 'both',
          line: ['Calle Falsa 123'],
          city: 'Mendoza',
          country: 'Argentina'
        }
      ]
    };

    const createRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, patientPayload);

    if (createRes.statusCode !== 201) {
      throw new Error(`Fallo al crear paciente de prueba: ${createRes.body}`);
    }

    const createdPatient = JSON.parse(createRes.body);
    const patientId = createdPatient.id;
    console.log(`   ✅ Paciente creado con ID: ${patientId}`);

    // ----------------------------------------------------
    // 3. ACTUALIZAR PACIENTE (PUT) - FLUJO EXITOSO
    // ----------------------------------------------------
    console.log('\n✏️ 3. Modificando datos del paciente (Flujo Exitoso)...');
    const updatedPayload = {
      ...patientPayload,
      name: [
        {
          use: 'official',
          family: 'Gómez Modificado',
          given: ['Juan Carlos'],
        },
      ],
      telecom: [
        { system: 'phone', value: '+5492619999999', use: 'home' },
        { system: 'email', value: 'juan.carlos.mod@example.com', use: 'home' }
      ],
      address: [
        {
          use: 'home',
          type: 'both',
          line: ['Calle Verdadera 999'],
          city: 'San Rafael',
          country: 'Argentina'
        }
      ]
    };

    const updateRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, updatedPayload);

    if (updateRes.statusCode !== 200) {
      throw new Error(`Fallo esperado 200 OK al actualizar, pero se recibió: ${updateRes.statusCode}. Cuerpo: ${updateRes.body}`);
    }

    const updatedPatient = JSON.parse(updateRes.body);
    console.log('   ✅ Servidor respondió 200 OK.');

    // Verificar en GET que los datos realmente cambiaron en la base de datos
    console.log('   🔍 Consultando base de datos para verificar persistencia del cambio...');
    const getRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    const persistedPatient = JSON.parse(getRes.body);
    if (persistedPatient.name[0].family !== 'Gómez Modificado' ||
        persistedPatient.name[0].given[0] !== 'Juan Carlos' ||
        persistedPatient.telecom.find(t => t.system === 'email')?.value !== 'juan.carlos.mod@example.com' ||
        persistedPatient.address[0].line[0] !== 'Calle Verdadera 999') {
      throw new Error(`Los datos devueltos no coinciden con la actualización. Paciente obtenido: ${getRes.body}`);
    }
    console.log('      ✅ Datos modificados persisten correctamente y coinciden al 100%.');

    // ----------------------------------------------------
    // 4. VERIFICACIÓN DE AISLAMIENTO MULTI-INQUILINO (Zero Trust)
    // ----------------------------------------------------
    console.log('\n🛡️ 4. Probando Aislamiento Multi-Inquilino (Zero Trust)...');
    console.log(`   ⚠️ Inquilino B (Admin HCE) intenta editar al paciente del Inquilino A...`);

    const badUpdateRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, updatedPayload);

    if (badUpdateRes.statusCode !== 404) {
      throw new Error(`⚠️ ¡VULNERABILIDAD! El Inquilino B pudo acceder o modificar los datos de un paciente ajeno. Código de respuesta: ${badUpdateRes.statusCode}`);
    }
    console.log('   ✅ Aislamiento exitoso. Servidor rechazó la modificación con un código 404 Not Found.');

    // ----------------------------------------------------
    // 5. CONTROL DE UNICIDAD DE DNI
    // ----------------------------------------------------
    console.log('\n⚠️ 5. Probando Control de Unicidad de DNI...');
    
    // Crear un segundo paciente con testDni2
    console.log(`   📝 Creando segundo paciente con DNI ${testDni2}...`);
    const patient2Payload = {
      ...patientPayload,
      identifier: [
        {
          use: 'official',
          system: 'http://hospital.gov/dni',
          value: testDni2,
        },
      ],
      name: [
        {
          use: 'official',
          family: 'Pérez',
          given: ['Pedro'],
        },
      ]
    };

    const create2Res = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, patient2Payload);

    if (create2Res.statusCode !== 201) {
      throw new Error(`Fallo al crear el segundo paciente de prueba: ${create2Res.body}`);
    }
    console.log('      ✅ Segundo paciente creado con éxito.');

    // Intentar modificar el primer paciente poniéndole el DNI del segundo paciente
    console.log(`   ⚠️ Intentando cambiar el DNI del primer paciente al DNI ocupado ${testDni2}...`);
    const conflictPayload = {
      ...updatedPayload,
      identifier: [
        {
          use: 'official',
          system: 'http://hospital.gov/dni',
          value: testDni2,
        },
      ]
    };

    const conflictUpdateRes = await request(`${BACKEND_URL}/fhir/r4/Patient/${patientId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, conflictPayload);

    if (conflictUpdateRes.statusCode !== 409) {
      throw new Error(`Se esperaba código 409 Conflict ante colisión de DNI, pero se recibió: ${conflictUpdateRes.statusCode}. Cuerpo: ${conflictUpdateRes.body}`);
    }
    console.log('      ✅ Control de DNI validado. El servidor bloqueó la modificación con 409 Conflict.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE MODIFICACIÓN COMPLETADAS CON ÉXITO! (100% Passed) 🎉\n');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', error.message);
    process.exit(1);
  }
}

runPatientUpdateTests();
