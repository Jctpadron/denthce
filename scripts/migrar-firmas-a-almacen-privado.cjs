#!/usr/bin/env node
/**
 * AUD.8 — Migración best-effort de las firmas del profesional al almacén privado.
 *
 * Antes, la firma vivía en `uploads/signatures/signature-<tenantId>.png`, servida por
 * `express.static` SIN autenticación. Este script mueve las que todavía existan en disco
 * al almacén privado (S3 con SSE si `S3_EVIDENCE_BUCKET` está seteado, `private-uploads/`
 * si no) y completa los punteros en `tenant_config`.
 *
 * Es "best-effort" a propósito: en Elastic Beanstalk el filesystem de la instancia es
 * efímero, así que es probable que varios archivos ya no existan. Los que falten se
 * reportan para que el profesional vuelva a subir la firma — no se inventa nada.
 *
 * Uso:
 *   node scripts/migrar-firmas-a-almacen-privado.cjs                          # dry-run
 *   node scripts/migrar-firmas-a-almacen-privado.cjs --apply                  # aplica
 *   node scripts/migrar-firmas-a-almacen-privado.cjs --apply --borrar-legado  # + borra el original
 *
 * `--borrar-legado` es OPT-IN a propósito: borrar es irreversible y el original sigue
 * siendo la única copia hasta que se verifique que la lectura autenticada funciona.
 * Pero ojo: **mientras el archivo siga en `uploads/signatures/`, sigue expuesto** por
 * `express.static`. Correr el borrado apenas se verifique la descarga es parte de cerrar AUD.8.
 *
 * Credenciales: SOLO por variables de entorno. Sin defaults de contraseña —
 * hay scripts en este repo que las traen hardcodeadas (AUD.9); no se replica acá.
 *   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME [DB_SSL=true]
 *   [S3_EVIDENCE_BUCKET] [AWS_REGION]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('../hce-backend/node_modules/pg');

const apply = process.argv.includes('--apply');
const borrarLegado = process.argv.includes('--borrar-legado');

// Debe coincidir con TenantSignatureService.CATEGORY y con EvidenceStorageService.
const CATEGORY = 'tenant-signatures';
const SIGNATURE_ENDPOINT_PATH = '/api/tenant/signature';

const LEGACY_DIR = path.join(process.cwd(), 'hce-backend', 'uploads', 'signatures');
const LOCAL_BASE = path.join(process.cwd(), 'hce-backend', 'private-uploads');

const BUCKET = process.env.S3_EVIDENCE_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';
const useS3 = !!BUCKET;

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta la variable de entorno ${name}.`);
    process.exit(1);
  }
  return v;
}

async function putBlob(tenantId, key, buffer, contentType) {
  if (useS3) {
    const {
      S3Client,
      PutObjectCommand,
    } = require('../hce-backend/node_modules/@aws-sdk/client-s3');
    const s3 = new S3Client({ region: REGION });
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `clinical-evidence/${tenantId}/${CATEGORY}/${key}`,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
    return 's3';
  }
  const dir = path.join(LOCAL_BASE, CATEGORY);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, key), buffer);
  return 'local';
}

/** Busca el archivo legado del tenant, probando las extensiones admitidas. */
function findLegacyFile(tenantId) {
  for (const ext of Object.keys(MIME_BY_EXT)) {
    const p = path.join(LEGACY_DIR, `signature-${tenantId}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const client = new Client({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log(`Modo: ${apply ? 'APLICAR' : 'DRY-RUN (no escribe nada)'}`);
  console.log(`Almacén destino: ${useS3 ? `S3 (${BUCKET})` : `local (${LOCAL_BASE})`}`);
  console.log(`Origen legado: ${LEGACY_DIR}\n`);

  const { rows } = await client.query(
    `SELECT tenant_id, signature_url, signature_storage_key
       FROM tenant_config
      ORDER BY tenant_id`,
  );

  const resumen = {
    migradas: 0,
    yaMigradas: 0,
    sinArchivo: 0,
    sinFirma: 0,
    legadosBorrados: 0,
  };

  for (const row of rows) {
    const tenantId = row.tenant_id;

    if (row.signature_storage_key) {
      console.log(`  = ${tenantId}: ya migrada`);
      resumen.yaMigradas++;
      continue;
    }

    const legacy = findLegacyFile(tenantId);
    if (!legacy) {
      // Sin puntero nuevo y sin archivo viejo: o nunca cargó firma, o el disco efímero se la llevó.
      const teniaUrl = !!row.signature_url;
      console.log(
        teniaUrl
          ? `  ! ${tenantId}: tenía firma registrada pero el archivo NO está en disco → debe resubirla`
          : `  - ${tenantId}: nunca cargó firma`,
      );
      teniaUrl ? resumen.sinArchivo++ : resumen.sinFirma++;
      continue;
    }

    const buffer = fs.readFileSync(legacy);
    const ext = path.extname(legacy).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'image/png';
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const storageKey = `sig-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

    if (!apply) {
      console.log(
        `  → ${tenantId}: migraría ${path.basename(legacy)} (${buffer.length} bytes, ${contentType})`,
      );
      resumen.migradas++;
      continue;
    }

    const backend = await putBlob(tenantId, storageKey, buffer, contentType);
    await client.query(
      `UPDATE tenant_config
          SET signature_url = $2,
              signature_storage_key = $3,
              signature_storage_backend = $4,
              signature_content_type = $5,
              signature_hash = $6
        WHERE tenant_id = $1`,
      [tenantId, SIGNATURE_ENDPOINT_PATH, storageKey, backend, contentType, hash],
    );
    // Verificación de integridad antes de considerar migrada la firma: el blob del
    // almacén privado debe tener el mismo SHA-256 que el original. Sólo en local se
    // puede releer barato; en S3 se confía en el PUT (que ya falla ruidosamente).
    if (backend === 'local') {
      const copia = fs.readFileSync(path.join(LOCAL_BASE, CATEGORY, storageKey));
      const hashCopia = crypto.createHash('sha256').update(copia).digest('hex');
      if (hashCopia !== hash) {
        console.error(`  ✗ ${tenantId}: la copia NO coincide con el original. Se aborta.`);
        process.exit(1);
      }
    }

    console.log(`  ✓ ${tenantId}: migrada → ${backend}:${storageKey}`);
    resumen.migradas++;

    if (borrarLegado) {
      fs.unlinkSync(legacy);
      console.log(`    · original borrado de la carpeta pública: ${path.basename(legacy)}`);
      resumen.legadosBorrados++;
    }
  }

  console.log('\nResumen');
  console.log(`  migradas:            ${resumen.migradas}`);
  console.log(`  ya estaban migradas: ${resumen.yaMigradas}`);
  console.log(`  deben resubir firma: ${resumen.sinArchivo}`);
  console.log(`  nunca tuvieron:      ${resumen.sinFirma}`);

  if (resumen.sinArchivo > 0) {
    console.log(
      '\n  Los tenants marcados con "!" deben volver a subir su firma desde\n' +
        '  Personalización → Firma. El archivo original ya no existe en el servidor.',
    );
  }
  if (borrarLegado) {
    console.log(`  originales borrados: ${resumen.legadosBorrados}`);
  } else if (resumen.migradas > 0 && apply) {
    console.log(
      '\n  ⚠️  Los archivos originales SIGUEN en uploads/signatures/, o sea que siguen\n' +
        '     expuestos por express.static. Verificá la descarga autenticada y volvé a\n' +
        '     correr con --apply --borrar-legado para cerrar la exposición.',
    );
  }
  if (!apply) {
    console.log('\n  Dry-run: no se escribió nada. Repetir con --apply para aplicar.');
  }

  await client.end();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
