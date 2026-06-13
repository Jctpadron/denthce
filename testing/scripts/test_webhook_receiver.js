const http = require('http');
const crypto = require('crypto');

const PORT = 4000;
const SHARED_SECRET = 'secreto_webhook_prueba_2026';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/public/hooks/sync-appointment') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('\n📥 [Webhook Receiver] Recibida llamada de webhook!');
      console.log(`   - Headers recibidos: ${JSON.stringify(req.headers, null, 2)}`);
      console.log(`   - Raw Body: ${body}`);

      // 1. Obtener la firma del header
      const signatureHeader = req.headers['x-clinichat-signature'] || '';
      if (!signatureHeader.startsWith('sha256=')) {
        console.log('   ❌ [Error] Cabecera X-CliniChat-Signature inválida o faltante.');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Falta firma digital o formato incorrecto.' }));
        return;
      }

      const receivedSignature = signatureHeader.substring(7); // Quitar 'sha256='

      // 2. Calcular la firma esperada usando el secreto compartido
      const expectedSignature = crypto
        .createHmac('sha256', SHARED_SECRET)
        .update(body)
        .digest('hex');

      console.log(`   - Firma recibida: ${receivedSignature}`);
      console.log(`   - Firma esperada: ${expectedSignature}`);

      // 3. Comparar firmas
      if (receivedSignature === expectedSignature) {
        console.log('   ✅ [Firma Válida] La autenticidad e integridad del payload están confirmadas.');
        const parsedPayload = JSON.parse(body);
        console.log(`   - Acción: ${parsedPayload.action}`);
        console.log(`   - Tenant ID: ${parsedPayload.hce_tenant_id}`);
        console.log(`   - Appointment ID: ${parsedPayload.hce_appointment_id}`);
        console.log(`   - Patient DNI: ${parsedPayload.patient_dni}`);
        console.log(`   - Fecha Cita: ${parsedPayload.appointment_date}`);
        console.log(`   - Practitioner ID: ${parsedPayload.hce_practitioner_id}`);
        console.log(`   - Specialty ID: ${parsedPayload.hce_specialty_id}`);
        console.log(`   - Status Cita: ${parsedPayload.status}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Webhook recibido y validado con éxito.' }));
      } else {
        console.log('   ❌ [Firma Inválida] El secreto compartido no coincide o el payload fue alterado.');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Firma inválida o no autorizada.' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 [Webhook Receiver] Escuchando webhooks de prueba en: http://localhost:${PORT}/api/public/hooks/sync-appointment`);
});
