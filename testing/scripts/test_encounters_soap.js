const axios = require('axios');

async function runTests() {
  console.log('🧪 Iniciando pruebas de integración automatizadas para Módulo 3 (Consultas y SOAP)...');

  // 1. Obtener Token de Keycloak
  console.log('\n🔑 Obteniendo token de autenticación desde Keycloak...');
  let token;
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', 'hce-app');
    params.append('username', 'doctor_julio'); // usuario con rol de médico configurado en el sistema
    params.append('password', 'doctor_pass_2026'); // contraseña de test

    const tokenRes = await axios.post(
      'http://localhost:8080/realms/hce-realm/protocol/openid-connect/token',
      params
    );
    token = tokenRes.data.access_token;
    console.log('✅ Token obtenido con éxito.');
  } catch (err) {
    console.error('❌ Error al obtener token de Keycloak. Asegúrese de que el contenedor de Keycloak esté activo.', err.message);
    process.exit(1);
  }

  // 2. Buscar Paciente
  console.log('\n🔍 Buscando un paciente para asociarle la consulta...');
  let patientId;
  try {
    const patientsRes = await axios.get('http://localhost:3000/fhir/r4/Patient', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const entries = patientsRes.data.entry || [];
    if (entries.length === 0) {
      console.log('❌ No hay pacientes registrados. Registre un paciente en el sistema primero.');
      process.exit(1);
    }
    patientId = entries[0].resource.id;
    console.log(`✅ Paciente seleccionado: ${patientId}`);
  } catch (err) {
    console.error('❌ Error al buscar pacientes en el backend:', err.message);
    process.exit(1);
  }

  // 3. Crear Encuentro (Borrador)
  console.log('\n📝 Creando borrador de consulta (Encounter) en formato SOAP...');
  let encounterId;
  try {
    const encounterData = {
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
        { text: 'S: Paciente refiere dolor en zona molar.' },
        { text: 'O: Lesión cariosa en 46.' },
        { text: 'A: Caries de dentina profunda.' },
        { text: 'P: Restauración estética en composite.' }
      ]
    };

    const res = await axios.post(
      `http://localhost:3000/fhir/r4/Patient/${patientId}/encounter`,
      encounterData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    encounterId = res.data.id;
    console.log(`✅ Borrador de Consulta creado con ID: ${encounterId}`);
    console.log(`   Estado inicial: ${res.data.status}`);
  } catch (err) {
    console.error('❌ Error al crear borrador de Encounter:', err.response?.data || err.message);
    process.exit(1);
  }

  // 4. Actualizar Borrador
  console.log('\n💾 Actualizando el borrador de la consulta...');
  try {
    const updatedData = {
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
        { text: 'S: Paciente refiere dolor leve en zona molar.' }, // Cambio leve
        { text: 'O: Lesión cariosa en 46.' },
        { text: 'A: Caries de dentina profunda.' },
        { text: 'P: Restauración estética en composite y control en 15 días.' } // Plan actualizado
      ]
    };

    const res = await axios.put(
      `http://localhost:3000/fhir/r4/Patient/${patientId}/encounter/${encounterId}`,
      updatedData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`✅ Consulta actualizada con éxito. Estado: ${res.data.status}`);
  } catch (err) {
    console.error('❌ Error al actualizar borrador:', err.response?.data || err.message);
    process.exit(1);
  }

  // 5. Firmar Consulta (Firma Lógica)
  console.log('\n🔒 Firmando digitalmente la consulta...');
  try {
    const res = await axios.post(
      `http://localhost:3000/fhir/r4/Patient/${patientId}/encounter/${encounterId}/sign`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`✅ Consulta firmada con éxito.`);
    console.log(`   Estado final: ${res.data.status}`);
    console.log(`   Firmado por: ${res.data.signedBy}`);
    console.log(`   Fecha firma: ${res.data.signedAt}`);
    console.log(`   SHA-256 Hash: ${res.data.contentHash}`);
  } catch (err) {
    console.error('❌ Error al firmar la consulta:', err.response?.data || err.message);
    process.exit(1);
  }

  // 6. Validar Inmutabilidad (Intentar actualizar la nota firmada)
  console.log('\n🛡️ Validando inmutabilidad (Intento de actualización de nota firmada)...');
  try {
    const hackData = {
      note: [{ text: 'S: Intento de cambiar contenido' }]
    };

    await axios.put(
      `http://localhost:3000/fhir/r4/Patient/${patientId}/encounter/${encounterId}`,
      hackData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.error('❌ ERROR: El backend permitió modificar una consulta firmada.');
    process.exit(1);
  } catch (err) {
    if (err.response && err.response.status === 403) {
      console.log('✅ Correcto: El servidor rechazó la modificación con código 403 Forbidden.');
    } else {
      console.error('❌ Error inesperado al validar inmutabilidad:', err.response?.status || err.message);
      process.exit(1);
    }
  }

  // 7. Crear Antecedente Clínico
  console.log('\n🧬 Registrando antecedente clínico (Condition)...');
  try {
    const conditionData = {
      resourceType: 'Condition',
      payload: {
        resourceType: 'Condition',
        clinicalStatus: 'active',
        verificationStatus: 'confirmed',
        category: 'personal',
        code: { text: 'Hipertensión Arterial (HTA)' },
        note: [{ text: 'Diagnosticado hace 2 años, bajo tratamiento con Enalapril 10mg' }]
      }
    };

    const res = await axios.post(
      `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
      conditionData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`✅ Antecedente clínico registrado con éxito. ID: ${res.data.id}`);
  } catch (err) {
    console.error('❌ Error al registrar antecedente:', err.response?.data || err.message);
    process.exit(1);
  }

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DEL MÓDULO 3 FINALIZARON CORRECTAMENTE! 🎉\n');
}

runTests();
