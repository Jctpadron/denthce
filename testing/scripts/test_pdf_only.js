const http = require('http');
const fs = require('fs');
const path = require('path');

const KEYCLOAK_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:3000';
const REALM = 'hce-realm';
const patientId = '205f55d9-ca83-4ac2-8c49-80ce9be43367';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = options.headers || {};
    
    const req = http.request(
      { 
        hostname: u.hostname, 
        port: u.port, 
        path: u.pathname + u.search, 
        method: 'GET', 
        headers, 
        agent: false 
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
      },
    );
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    req.end();
  });
}

async function getToken(username, password) {
  const params = new URLSearchParams({ grant_type: 'password', client_id: 'hce-app', username, password }).toString();
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 8080, path: `/realms/${REALM}/protocol/openid-connect/token`, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(params) } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(JSON.parse(d).access_token));
      }
    );
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

(async () => {
  try {
    console.log('⏳ Solicitando token...');
    const token = await getToken('doctor_julio', 'doctor_pass_2026');
    const auth = { Authorization: `Bearer ${token}` };
    console.log('🔑 Token obtenido. Descargando PDF...');
    
    const res = await request(`${BACKEND_URL}/odontology/patient/${patientId}/report/pdf`, { headers: auth });
    console.log(`📡 Código de estado HTTP: ${res.statusCode}`);
    if (res.statusCode === 200) {
      fs.writeFileSync('test_only_output.pdf', res.body);
      console.log('✅ PDF guardado con éxito como test_only_output.pdf');
    } else {
      console.log('❌ Falló la descarga. Respuesta del servidor:', res.body.toString());
    }
  } catch (err) {
    console.error('💥 Error:', err.message);
  }
})();
