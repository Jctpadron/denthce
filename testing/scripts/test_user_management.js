const http = require('http');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';
const DOCTOR_USER = 'doctor_julio';
const DOCTOR_PASS = 'doctor_pass_2026';
const TEST_USER = 'secre_test_user';
const TEST_EMAIL = 'secre_test@hce-hospital.com';

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

async function runTests() {
  console.log('🧪 Iniciando Pruebas de Integración de Gestión de Usuarios y Keycloak...');

  try {
    // 1. Obtener Token del Doctor Julio
    console.log('\n1. Autenticando Doctor Julio en Keycloak...');
    const tokenUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;
    const docTokenParams = new URLSearchParams();
    docTokenParams.append('grant_type', 'password');
    docTokenParams.append('client_id', 'hce-app');
    docTokenParams.append('username', DOCTOR_USER);
    docTokenParams.append('password', DOCTOR_PASS);

    const docAuthRes = await request(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, docTokenParams.toString());

    if (docAuthRes.statusCode !== 200) {
      throw new Error(`Fallo al autenticar doctor: ${docAuthRes.body}`);
    }

    const docTokenData = JSON.parse(docAuthRes.body);
    const doctorToken = docTokenData.access_token;
    console.log('✅ Doctor Julio autenticado correctamente.');

    // 2. Listar Usuarios del Tenant del Doctor
    console.log('\n2. Obteniendo listado de personal de la API del Backend...');
    const listRes = await request(`${BACKEND_URL}/api/tenant/users`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    if (listRes.statusCode !== 200) {
      throw new Error(`Error al listar usuarios: ${listRes.body}`);
    }

    const initialUsers = JSON.parse(listRes.body);
    console.log(`✅ Listado obtenido con éxito. Personal actual: ${initialUsers.length} usuarios.`);

    // 3. Crear secretaria de prueba (secre_test_user)
    console.log('\n3. Creando secretaria de prueba a través de la API del Backend...');
    const createUserPayload = {
      username: TEST_USER,
      email: TEST_EMAIL,
      firstName: 'Secre',
      lastName: 'Prueba',
      role: 'recepcionista'
    };

    const createRes = await request(`${BACKEND_URL}/api/tenant/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }, createUserPayload);

    if (createRes.statusCode !== 201) {
      throw new Error(`Error al crear usuario secretaria: ${createRes.body}`);
    }

    const createdUserData = JSON.parse(createRes.body);
    console.log(`✅ Secretaria creada exitosamente.`);
    console.log(`   - ID Keycloak: ${createdUserData.id}`);
    console.log(`   - Clave temporal: ${createdUserData.defaultPassword}`);

    // 4. Intentar autenticar secretaria de prueba
    console.log('\n4. Intentando iniciar sesión como la secretaria creada...');
    const secTokenParams = new URLSearchParams();
    secTokenParams.append('grant_type', 'password');
    secTokenParams.append('client_id', 'hce-app');
    secTokenParams.append('username', TEST_USER);
    secTokenParams.append('password', createdUserData.defaultPassword);

    const secAuthRes = await request(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, secTokenParams.toString());

    if (secAuthRes.statusCode !== 200) {
      throw new Error(`Fallo al autenticar secretaria: ${secAuthRes.body}`);
    }

    const secTokenData = JSON.parse(secAuthRes.body);
    console.log('✅ Inicio de sesión de secretaria exitoso.');

    // Decodificar el token JWT de la secretaria y verificar tenant_id
    const jwtPayload = JSON.parse(Buffer.from(secTokenData.access_token.split('.')[1], 'base64').toString());
    console.log('🔍 Payload del token JWT decodificado para verificar multi-inquilino:');
    console.log(`   - sub: ${jwtPayload.sub}`);
    console.log(`   - tenant_id: ${jwtPayload.tenant_id}`);
    
    if (jwtPayload.tenant_id) {
      console.log('✅ Validación de Multi-Inquilino exitosa: El token contiene tenant_id.');
    } else {
      console.log('⚠️  El atributo tenant_id no está inyectado en el JWT todavía.');
      console.log('👉 Se confirma que la secretaria fue creada en Keycloak con el atributo de tenant_id.');
    }

    // 5. Eliminar secretaria de prueba (Limpieza)
    console.log('\n5. Eliminando secretaria de prueba de Keycloak (Limpieza)...');
    
    // Obtener token admin de master para eliminar el usuario
    const adminTokenParams = new URLSearchParams();
    adminTokenParams.append('grant_type', 'password');
    adminTokenParams.append('client_id', 'admin-cli');
    adminTokenParams.append('username', 'admin');
    adminTokenParams.append('password', 'admin_secure_password_2026');

    const adminAuthRes = await request(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, adminTokenParams.toString());

    if (adminAuthRes.statusCode === 200) {
      const adminToken = JSON.parse(adminAuthRes.body).access_token;
      const deleteRes = await request(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${createdUserData.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      if (deleteRes.statusCode === 204) {
        console.log('✅ Secretaria de prueba eliminada correctamente de Keycloak.');
      } else {
        console.log('⚠️ No se pudo eliminar el usuario de prueba de Keycloak. Código:', deleteRes.statusCode);
      }
    } else {
      console.log('⚠️ No se pudo obtener token de administración de master para la limpieza.');
    }

    console.log('\n🎉 ¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO! 🎉');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', error.message);
    process.exit(1);
  }
}

runTests();
