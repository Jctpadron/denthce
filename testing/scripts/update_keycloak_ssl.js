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
  console.log('Conectándose a la base de datos keycloak_db en RDS...');
  try {
    await client.connect();
    console.log('Conexión exitosa!');
    
    // Consultar realms existentes antes del cambio
    const res = await client.query("SELECT id, name, ssl_required FROM realm");
    console.log('Realms existentes antes del cambio:', res.rows);
    
    // Actualizar ssl_required a 'NONE' para hce-realm
    console.log('Actualizando ssl_required a NONE para hce-realm...');
    const updateRes = await client.query("UPDATE realm SET ssl_required = 'NONE' WHERE id = 'hce-realm' OR name = 'hce-realm'");
    console.log('Registros actualizados:', updateRes.rowCount);
    
    // Validar el cambio
    const checkRes = await client.query("SELECT id, name, ssl_required FROM realm");
    console.log('Realms después de la actualización:', checkRes.rows);
  } catch (err) {
    console.error('Error ejecutando la consulta en la base de datos:', err);
  } finally {
    await client.end();
  }
}
main();
