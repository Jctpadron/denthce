const { Client } = require('pg');
const client = new Client({
  host: 'hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'hce_admin',
  password: '*AndreA335*',
  database: 'keycloak_db',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Conectándose a la base de datos keycloak_db...');
  try {
    await client.connect();
    console.log('Conectado!');
    
    // Obtener UUID del cliente hce-app
    const clientRes = await client.query("SELECT id FROM client WHERE client_id = 'hce-app'");
    if (clientRes.rows.length === 0) {
      throw new Error("No se encontró el cliente hce-app");
    }
    const internalId = clientRes.rows[0].id;
    console.log('UUID del cliente hce-app:', internalId);
    
    // Iniciar transacción
    await client.query('BEGIN');
    
    // 1. Actualizar Redirect URIs
    console.log('Borrando redirect URIs antiguos...');
    await client.query("DELETE FROM redirect_uris WHERE client_id = $1", [internalId]);
    
    console.log('Insertando nuevos redirect URIs seguros...');
    const redirectUris = [
      'https://app.systia.ar/*',
      'http://localhost:5173/*'
    ];
    for (const uri of redirectUris) {
      await client.query("INSERT INTO redirect_uris (client_id, value) VALUES ($1, $2)", [internalId, uri]);
    }
    
    // 2. Actualizar Web Origins
    console.log('Borrando web origins antiguos...');
    await client.query("DELETE FROM web_origins WHERE client_id = $1", [internalId]);
    
    console.log('Insertando nuevos web origins...');
    const webOrigins = [
      'https://app.systia.ar',
      'http://localhost:5173'
    ];
    for (const origin of webOrigins) {
      await client.query("INSERT INTO web_origins (client_id, value) VALUES ($1, $2)", [internalId, origin]);
    }
    
    // Confirmar cambios
    await client.query('COMMIT');
    console.log('Actualización completada exitosamente!');
    
    // Validar
    const checkUris = await client.query("SELECT value FROM redirect_uris WHERE client_id = $1", [internalId]);
    console.log('Nuevos Redirect URIs:', checkUris.rows.map(r => r.value));
    
    const checkOrigins = await client.query("SELECT value FROM web_origins WHERE client_id = $1", [internalId]);
    console.log('Nuevos Web Origins:', checkOrigins.rows.map(r => r.value));
    
  } catch (err) {
    console.error('Error durante la actualización, ejecutando rollback:', err);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}
main();
