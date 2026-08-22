const { Client } = require('pg');
const { remoteConfig } = require('./db-config');
const client = new Client(remoteConfig('keycloak_db'));

async function main() {
  console.log('Conectándose a la base de datos...');
  try {
    await client.connect();
    console.log('Conectado!');
    
    // Buscar el cliente hce-app
    const clientRes = await client.query("SELECT id, client_id FROM client WHERE client_id = 'hce-app'");
    console.log('Cliente hce-app:', clientRes.rows);
    
    if (clientRes.rows.length > 0) {
      const internalId = clientRes.rows[0].id;
      
      // Buscar URIs de redirección
      const urisRes = await client.query("SELECT * FROM redirect_uris WHERE client_id = $1", [internalId]);
      console.log('Redirect URIs actuales:', urisRes.rows);
      
      // Buscar Web Origins
      const originsRes = await client.query("SELECT * FROM web_origins WHERE client_id = $1", [internalId]);
      console.log('Web Origins actuales:', originsRes.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
main();
