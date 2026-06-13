const http = require('http');
const { Client } = require('pg');
const crypto = require('crypto');

const KEYCLOAK_URL = 'https://auth.systia.ar';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';
const TENANT_ID = 'mi_consultorio_dent_hce';

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
  console.log('🔌 Conectando a la base de datos para sembrar tenant_config...');
  await dbClient.connect();
  
  // Limpiar citas anteriores para evitar interferencia
  await dbClient.query('DELETE FROM fhir_appointments WHERE tenant_id = $1', [TENANT_ID]);
  await dbClient.query('DELETE FROM fhir_patients WHERE tenant_id = $1', [TENANT_ID]);

  // Insertar tenant_config
  const insertConfigQuery = `
    INSERT INTO tenant_config (tenant_id, clinic_name, specialty, doctor_name, doctor_license, doctor_title, schedule_json)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (tenant_id) DO UPDATE 
    SET clinic_name = EXCLUDED.clinic_name,
        specialty = EXCLUDED.specialty,
        doctor_name = EXCLUDED.doctor_name,
        doctor_license = EXCLUDED.doctor_license,
        doctor_title = EXCLUDED.doctor_title,
        schedule_json = EXCLUDED.schedule_json;
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
    JSON.stringify(scheduleJson)
  ]);
  
  console.log('✅ Base de datos preparada y sembrada.');
}

async function runTests() {
  console.log('🧪 Iniciando Pruebas de Integración para Slots y Citas (Fase 0.3) ...\n');
  
  try {
    await prepareDatabase();

    // 1. Autenticación
    console.log('\n🔐 1. Autenticando al Doctor Julio...');
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    console.log('   ✅ Doctor Julio autenticado.');

    // 2. Crear un paciente de prueba
    console.log('\n📝 2. Creando paciente de prueba (DNI 777777)...');
    const patientPayload = {
      resourceType: 'Patient',
      active: true,
      identifier: [
        {
          use: 'official',
          system: 'http://hospital.gov/dni',
          value: '777777',
        },
      ],
      name: [
        {
          use: 'official',
          family: 'Gómez',
          given: ['Roberto'],
        },
      ],
      gender: 'male',
      birthDate: '1990-01-01',
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
    console.log('\n🔍 3. Verificando Endpoints de Discovery (Onboarding)...');
    
    console.log('   - Consultando /Practitioner...');
    const practitionerRes = await request(`${BACKEND_URL}/fhir/r4/Practitioner`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (practitionerRes.statusCode !== 200) {
      throw new Error(`Fallo en GET /Practitioner: ${practitionerRes.body}`);
    }
    const practitionerList = JSON.parse(practitionerRes.body);
    console.log(`     ✅ Encontrado Practitioner: "${practitionerList.entry[0].resource.name[0].text}"`);

    console.log('   - Consultando /HealthcareService...');
    const serviceRes = await request(`${BACKEND_URL}/fhir/r4/HealthcareService`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (serviceRes.statusCode !== 200) {
      throw new Error(`Fallo en GET /HealthcareService: ${serviceRes.body}`);
    }
    const serviceList = JSON.parse(serviceRes.body);
    console.log(`     ✅ Encontrada Especialidad: "${serviceList.entry[0].resource.name}" (ID: ${serviceList.entry[0].resource.id})`);
    const specialtyId = serviceList.entry[0].resource.id;

    // 4. Consultar Disponibilidad de Slots (GET /Slot)
    // Definimos una ventana de 3 días a partir del próximo lunes para asegurar que caiga en días laborales.
    // Busquemos una fecha futura que sea lunes.
    const today = new Date();
    const nextMonday = new Date();
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    nextMonday.setHours(9, 0, 0, 0); // 09:00 AM
    
    const nextWednesday = new Date(nextMonday);
    nextWednesday.setDate(nextMonday.getDate() + 3);
    nextWednesday.setHours(18, 0, 0, 0); // 18:00 PM

    // Formatear fechas ISO con offset argentino (-03:00)
    const formatArgTime = (date) => {
      // Forzar -03:00 restando la diferencia de zona horaria local y agregando -03:00 literal
      const offsetMs = date.getTimezoneOffset() * 60000;
      // Convertir a fecha con offset -03:00
      const argDate = new Date(date.getTime() - offsetMs - (3 * 3600000));
      return argDate.toISOString().replace('Z', '-03:00');
    };

    const startGe = formatArgTime(nextMonday);
    const startLt = formatArgTime(nextWednesday);

    console.log(`\n📅 4. Consultando Slots libres entre ${startGe} y ${startLt}...`);
    const slotRes = await request(`${BACKEND_URL}/fhir/r4/Slot?status=free&specialty=${specialtyId}&start=ge${startGe}&start=lt${startLt}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (slotRes.statusCode !== 200) {
      throw new Error(`Fallo en GET /Slot: ${slotRes.body}`);
    }
    const slotBundle = JSON.parse(slotRes.body);
    console.log(`   ✅ Se encontraron ${slotBundle.total} slots libres.`);
    if (slotBundle.total === 0) {
      throw new Error('No se encontraron slots libres en la agenda laboral.');
    }

    const firstSlot = slotBundle.entry[0].resource;
    console.log(`      - Primer Slot libre: ${firstSlot.start} -> ${firstSlot.end}`);

    // 5. Agendar Turno (POST /Appointment) con Idempotency-Key
    console.log('\n📅 5. Creando turno en el primer slot libre...');
    const idempotencyKey = crypto.randomUUID();
    const appointmentPayload = {
      resourceType: 'Appointment',
      status: 'booked',
      start: firstSlot.start,
      patientDni: '777777',
      gender: 'male',
      practitionerRef: `Practitioner/${practitionerList.entry[0].resource.id}`,
      practitionerName: practitionerList.entry[0].resource.name[0].text,
      serviceType: 'Odontología General',
      minutesDuration: 30,
      slot: [{ reference: `Slot/${firstSlot.id}` }]
    };

    const bookRes = await request(`${BACKEND_URL}/fhir/r4/Appointment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey
      }
    }, appointmentPayload);

    if (bookRes.statusCode !== 201) {
      throw new Error(`Fallo al reservar turno: ${bookRes.body}`);
    }
    const appointment = JSON.parse(bookRes.body);
    const apptId = appointment.id;
    console.log(`   ✅ Cita creada con éxito en la HCE.`);
    console.log(`      - ID de Cita: ${apptId}`);
    console.log(`      - Canal de origen: ${appointment.extension[0].valueCode}`);

    // 6. Verificar Idempotencia
    console.log('\n🔄 6. Probando comportamiento idempotente (mismo body + misma Idempotency-Key)...');
    const bookDupRes = await request(`${BACKEND_URL}/fhir/r4/Appointment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey
      }
    }, appointmentPayload);

    // Debe retornar 200 OK con el mismo payload
    if (bookDupRes.statusCode !== 200 && bookDupRes.statusCode !== 201) {
      throw new Error(`Se esperaba 200/201 para petición idempotente, recibido: ${bookDupRes.statusCode} -> ${bookDupRes.body}`);
    }
    const appointmentDup = JSON.parse(bookDupRes.body);
    if (appointmentDup.id !== apptId) {
      throw new Error('La petición idempotente creó un recurso nuevo o devolvió un ID distinto.');
    }
    console.log(`   ✅ Idempotencia validada con éxito. Retornó el recurso existente ID ${appointmentDup.id} síncronamente.`);

    // 7. Verificar que el slot reservado ya no figura como libre
    console.log('\n🔍 7. Verificando que el Slot ocupado ya no esté en la lista de disponibles...');
    const slotCheckRes = await request(`${BACKEND_URL}/fhir/r4/Slot?status=free&specialty=${specialtyId}&start=ge${startGe}&start=lt${startLt}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const slotCheckBundle = JSON.parse(slotCheckRes.body);
    const isStillFree = slotCheckBundle.entry.some(e => e.resource.start === firstSlot.start);
    if (isStillFree) {
      throw new Error(`⚠️ ¡ERROR! El slot en ${firstSlot.start} se muestra como disponible tras haber sido reservado.`);
    }
    console.log('   ✅ El slot se ha descontado correctamente de la disponibilidad.');

    // 8. Intentar reservar en el mismo slot (Double-booking prevention - 409 Conflict)
    console.log('\n⚠️ 8. Intentando doble reserva del mismo slot con diferente Idempotency-Key...');
    const anotherIdempotencyKey = crypto.randomUUID();
    const conflictRes = await request(`${BACKEND_URL}/fhir/r4/Appointment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': anotherIdempotencyKey
      }
    }, {
      ...appointmentPayload,
      patientDni: '777777' // mismo o diferente paciente
    });

    if (conflictRes.statusCode !== 409) {
      throw new Error(`Se esperaba código 409 Conflict ante colisión de slot, recibido: ${conflictRes.statusCode} -> ${conflictRes.body}`);
    }
    const outcome = JSON.parse(conflictRes.body);
    if (outcome.resourceType !== 'OperationOutcome' || outcome.issue[0].diagnostics !== 'slot-unavailable') {
      throw new Error(`El OperationOutcome devuelto no indica "slot-unavailable": ${conflictRes.body}`);
    }
    console.log(`   ✅ Prevención de doble reserva exitosa. Retornó 409 Conflict con código "${outcome.issue[0].diagnostics}".`);

    // 9. Cancelar Turno (PATCH /Appointment/:id)
    console.log(`\n🗑️ 9. Cancelando el turno ID ${apptId} ...`);
    const cancelRes = await request(`${BACKEND_URL}/fhir/r4/Appointment/${apptId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, {
      status: 'cancelled',
      cancellationReason: 'Reprogramación solicitada por el paciente'
    });

    if (cancelRes.statusCode !== 200) {
      throw new Error(`Fallo al cancelar cita: ${cancelRes.body}`);
    }
    const cancelledAppt = JSON.parse(cancelRes.body);
    if (cancelledAppt.status !== 'cancelled') {
      throw new Error(`El estado de la cita devuelto es "${cancelledAppt.status}" en vez de "cancelled".`);
    }
    console.log('   ✅ Turno cancelado correctamente.');

    // 10. Verificar que el slot vuelva a estar disponible tras la cancelación
    console.log('\n🔍 10. Verificando que el Slot vuelva a figurar como libre tras la cancelación...');
    const slotCheckFreeRes = await request(`${BACKEND_URL}/fhir/r4/Slot?status=free&specialty=${specialtyId}&start=ge${startGe}&start=lt${startLt}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const slotCheckFreeBundle = JSON.parse(slotCheckFreeRes.body);
    const isFreeNow = slotCheckFreeBundle.entry.some(e => e.resource.start === firstSlot.start);
    if (!isFreeNow) {
      throw new Error(`⚠️ ¡ERROR! El slot en ${firstSlot.start} no volvió a liberarse tras la cancelación de la cita.`);
    }
    console.log('   ✅ El slot volvió a liberarse exitosamente en el listado.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE DISPONIBILIDAD Y CITAS COMPLETADAS CON ÉXITO! 🎉\n');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', error);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

runTests();
