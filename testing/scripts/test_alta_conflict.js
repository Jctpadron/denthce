async function run() {
  console.log('Obteniendo token de Keycloak...');
  let token;
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', 'hce-app');
    params.append('username', 'doctor_julio');
    params.append('password', 'doctor_pass_2026');

    const tokenRes = await fetch(
      'http://localhost:8080/realms/hce-realm/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      }
    );
    const tokenData = await tokenRes.json();
    token = tokenData.access_token;
  } catch (err) {
    console.error('Error Keycloak:', err.message);
    return;
  }

  const sharedDni = 'E2E' + Math.floor(Math.random() * 900000 + 100000) + 'S';
  console.log(`DNI Compartido a testear: ${sharedDni}`);

  const male = {
    identifier: [{ value: sharedDni, system: 'http://hospital.gov/dni' }],
    name: [{ family: 'Hombre', given: ['Carlos'] }],
    gender: 'male',
    birthDate: '1965-06-06',
  };

  const female = {
    identifier: [{ value: sharedDni, system: 'http://hospital.gov/dni' }],
    name: [{ family: 'Mujer', given: ['Carla'] }],
    gender: 'female',
    birthDate: '1965-06-06',
  };

  try {
    console.log('Intentando registrar paciente VARÓN (debe dar 201)...');
    const r1 = await fetch('http://localhost:3000/fhir/r4/Patient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(male),
    });
    console.log(`VARÓN status: ${r1.status}`);

    console.log('Intentando registrar paciente MUJER (mismo DNI, distinto género)...');
    const r2 = await fetch('http://localhost:3000/fhir/r4/Patient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(female),
    });
    console.log(`MUJER status: ${r2.status}`);
    
    if (r2.status !== 201) {
      const errBody = await r2.json();
      console.error(`ERROR DETALLADO MUJER:`, JSON.stringify(errBody, null, 2));
    }
  } catch (err) {
    console.error('Error durante peticiones:', err.message);
  }
}

run();
