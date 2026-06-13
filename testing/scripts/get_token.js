// Imprime un access_token de Keycloak (uso local de pruebas).
const http = require('http');
const u = process.argv[2] || 'doctor_julio';
const pw = process.argv[3] || 'doctor_pass_2026';
const p = new URLSearchParams({ grant_type: 'password', client_id: 'hce-app', username: u, password: pw }).toString();
const r = http.request(
  { hostname: 'localhost', port: 8080, path: '/realms/hce-realm/protocol/openid-connect/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(p) } },
  (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => process.stdout.write(JSON.parse(d).access_token || 'ERR:' + d)); },
);
r.on('error', (e) => process.stdout.write('ERR:' + e.message));
r.write(p); r.end();
