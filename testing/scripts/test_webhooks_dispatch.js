const http = require('http');
const { Client } = require('pg');
const crypto = require('crypto');

const KEYCLOAK_URL = 'https://auth.systia.ar';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';
const TENANT_ID = 'mi_consultorio_dent_hce';
const WEBHOOK_SECRET = '118382725c09c75e130c8fd03e817cb193f87eed8df8a8c44938699796e1149c';

const dbClient = new Client({
  host: 'localhost',
  port: 5432,
  user: 'hce_admin',
  password: 'hce_secure_password_2026',
  database: 'hce_fhir',
});

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

async function prepareDatabase() {
  console.log('🔌 Conectando a la base de datos para sembrar tenant_config y hce_webhook_secret...');
  await dbClient.connect();
  
  // Limpiar citas anteriores para evitar interferencia
  await dbClient.query('DELETE FROM fhir_appointments WHERE tenant_id = $1', [TENANT_ID]);
  await dbClient.query('DELETE FROM fhir_patients WHERE tenant_id = $1', [TENANT_ID]);

  // Insertar tenant_config con hce_webhook_secret
  const insertConfigQuery = `
    INSERT INTO tenant_config (tenant_id, clinic_name, specialty, doctor_name, doctor_license, doctor_title, schedule_json, hce_webhook_secret)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (tenant_id) DO UPDATE 
    SET clinic_name = EXCLUDED.clinic_name,
        specialty = EXCLUDED.specialty,
        doctor_name = EXCLUDED.doctor_name,
        doctor_license = EXCLUDED.doctor_license,
        doctor_title = EXCLUDED.doctor_title,
        schedule_json = EXCLUDED.schedule_json,
        hce_webhook_secret = EXCLUDED.hce_webhook_secret;
  `;
  const scheduleJson = {
    lunes: "09:00-18:00",
    martes: "09:00-18:00",
    miercoles: "09:00-18:00",
    jueves: "09:00-18:00",
    viernes: "09:00-18:00",
    sabado: "",
    domingo: ""
  };
  await dbClient.query(insertConfigQuery, [
    TENANT_ID,
    'Clínica Tacaya',
    'Odontología General',
    'Julio Mendoza',
    'MN-456789',
    'Dr.',
    JSON.stringify(scheduleJson),
    WEBHOOK_SECRET
  ]);
  
  console.log('✅ Base de datos preparada y sembrada con webhook secret.');
}

async function runTests() {
  console.log('🧪 Iniciando Pruebas de Despacho de Webhooks (Fase 3) ...\n');
  
  try {
    await prepareDatabase();

    // 1. Autenticación
    console.log('🔐 1. Autenticando al Doctor Julio...');
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    console.log('   ✅ Doctor Julio autenticado.');

    // 2. Crear un paciente de prueba
    console.log('\n📝 2. Creando paciente de prueba (DNI 888888)...');
    const patientPayload = {
      resourceType: 'Patient',
      active: true,
      identifier: [
        {
          use: 'official',
          system: 'http://hospital.gov/dni',
          value: '888888',
        },
      ],
      name: [
        {
          use: 'official',
          family: 'Gómez',
          given: ['Armando'],
        },
      ],
      gender: 'male',
      birthDate: '1995-05-05',
    };

    const patientRes = await request(`${BACKEND_URL}/fhir/r4/Patient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }, patientPayload);

    if (patientRes.statusCode !== 201) {
      throw new Error(`Fallo al crear paciente: ${patientRes.body}`);
    }
    const patient = JSON.parse(patientRes.body);
    const patientId = patient.id;
    console.log(`   ✅ Paciente creado. ID: ${patientId}`);

    // 3. Obtener Discovery (Practitioner y HealthcareService)
    console.log('\n🔍 3. Verificando Especialidad ID...');
    const serviceRes = await request(`${BACKEND_URL}/fhir/r4/HealthcareService`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const serviceList = JSON.parse(serviceRes.body);
    const specialtyId = serviceList.entry[0].resource.id;
    const practitionerId = deterministicUUID(TENANT_ID + '-practitioner');

    // 4. Consultar Disponibilidad de Slots (GET /Slot)
    const today = new Date();
    const nextMonday = new Date();
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    nextMonday.setHours(9, 0, 0, 0); // 09:00 AM
    
    const nextWednesday = new Date(nextMonday);
    nextWednesday.setDate(nextMonday.getDate() + 3);
    nextWednesday.setHours(18, 0, 0, 0); // 18:00 PM

    const formatArgTime = (date) => {
      const offsetMs = date.getTimezoneOffset() * 60000;
      const argDate = new Date(date.getTime() - offsetMs - (3 * 3600000));
      return argDate.toISOString().replace('Z', '-03:00');
    };

    const startGe = formatArgTime(nextMonday);
    const startLt = formatArgTime(nextWednesday);

    console.log(`📅 4. Consultando Slots libres...`);
    const slotRes = await request(`${BACKEND_URL}/fhir/r4/Slot?status=free&specialty=${specialtyId}&start=ge${startGe}&start=lt${startLt}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const slotBundle = JSON.parse(slotRes.body);
    const firstSlot = slotBundle.entry[0].resource;
    console.log(`   ✅ Slot obtenido: ${firstSlot.start}`);

    // 5. Agendar Turno (POST /Appointment) con origen 'recepcion' (debe disparar Webhook CREATE)
    console.log('\n📅 5. Agendando cita (canal recepcion) para disparar Webhook CREATE...');
    const appointmentPayload = {
      resourceType: 'Appointment',
      status: 'booked',
      start: firstSlot.start,
      patientDni: '888888',
      gender: 'male',
      practitionerRef: `Practitioner/${practitionerId}`,
      practitionerName: 'Julio Mendoza',
      serviceType: 'Odontología General',
      minutesDuration: 30,
      originChannel: 'recepcion',
      slot: [{ reference: `Slot/${firstSlot.id}` }]
    };

    const bookRes = await request(`${BACKEND_URL}/fhir/r4/Appointment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID()
      }
    }, appointmentPayload);

    if (bookRes.statusCode !== 201) {
      throw new Error(`Fallo al reservar turno: ${bookRes.body}`);
    }
    const appointment = JSON.parse(bookRes.body);
    const apptId = appointment.id;
    console.log(`   ✅ Cita creada con éxito. ID: ${apptId}`);

    // Esperar 2 segundos para dar tiempo al despacho del Webhook asíncrono
    console.log('   ⏳ Esperando 2 segundos para despacho del webhook CREATE...');
    await new Promise(r => setTimeout(r, 2000));

    // 6. Cancelar Cita (debe disparar Webhook CANCEL)
    console.log(`\n🗑️ 6. Cancelando la cita ID ${apptId} para disparar Webhook CANCEL...`);
    const cancelRes = await request(`${BACKEND_URL}/fhir/r4/Appointment/${apptId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, {
      status: 'cancelled',
      cancellationReason: 'Cambio de planes'
    });

    if (cancelRes.statusCode !== 200) {
      throw new Error(`Fallo al cancelar cita: ${cancelRes.body}`);
    }
    console.log('   ✅ Cita cancelada con éxito.');

    // Esperar 2 segundos para dar tiempo al despacho del Webhook CANCEL
    console.log('   ⏳ Esperando 2 segundos para despacho del webhook CANCEL...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n🎉 Transacciones completadas. Por favor, inspeccionar logs del receptor de Webhooks.');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', error);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

// Auxiliar determinista
function deterministicUUID(input) {
  const hash = crypto.createHash('md5').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

runTests();
