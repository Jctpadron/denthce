const { Client } = require('pg');
const { remoteConfig } = require('./db-config');
const client = new Client(remoteConfig('postgres'));

async function main() {
  console.log('Connecting to PostgreSQL database...');
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='keycloak_db'");
    if (res.rowCount === 0) {
      console.log('Creating database keycloak_db...');
      await client.query('CREATE DATABASE keycloak_db');
      console.log('Database keycloak_db created successfully!');
    } else {
      console.log('Database keycloak_db already exists.');
    }
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}
main();
