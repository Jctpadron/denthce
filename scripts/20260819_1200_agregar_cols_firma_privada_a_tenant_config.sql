-- =====================================================================
-- AUD.8 — Firma del profesional fuera del estático público
--
-- Agrega los punteros al almacén PRIVADO de evidencia. Hasta ahora la firma
-- se servía por `express.static` desde `uploads/signatures/signature-<tenantId>.png`:
-- sin autenticación y con nombre predecible.
--
-- EXPAND puro: todas las columnas son nullable y el código viejo sigue funcionando
-- (leía `signature_url`, que se conserva). El CONTRACT — limpiar las URLs absolutas
-- `http://localhost:3000/...` que quedaron — va en el paso de datos de abajo, que es
-- idempotente y no destruye nada recuperable.
--
-- Protocolo: docs/PROTOCOLO-CAMBIOS-DB.md
-- Aplicar en: LOCAL primero, luego PROD (con snapshot RDS previo).
-- =====================================================================

SET lock_timeout = '3s';

BEGIN;

-- 1) EXPAND — punteros al almacén privado (nullable: compatible con el código viejo).
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS signature_storage_key     VARCHAR,
  ADD COLUMN IF NOT EXISTS signature_storage_backend VARCHAR,
  ADD COLUMN IF NOT EXISTS signature_content_type    VARCHAR,
  ADD COLUMN IF NOT EXISTS signature_hash            VARCHAR;

COMMENT ON COLUMN tenant_config.signature_storage_key IS
  'Clave aleatoria del blob en el almacen privado (S3 o private-uploads). Nunca derivada del tenant_id.';
COMMENT ON COLUMN tenant_config.signature_storage_backend IS
  'local | s3 — con que backend se guardo, para rutear la lectura.';
COMMENT ON COLUMN tenant_config.signature_hash IS
  'SHA-256 del blob: integridad y trazabilidad de la firma profesional.';

-- 2) Datos — neutralizar las URLs que apuntaban al estático público.
--
--    Se limpian SOLO las filas que todavía no tienen puntero privado (WHERE ... IS NULL):
--    una fila ya migrada por el script de archivos no se toca.
--
--    Dejar `signature_url` en NULL es correcto y deliberado: el frontend lo usa como
--    indicador de "hay firma cargada", y mientras el blob no esté en el almacén privado
--    NO hay firma servible. Marcarla como presente mostraría una imagen rota.
--    El script scripts/migrar-firmas-a-almacen-privado.js repuebla las que sí se puedan.
UPDATE tenant_config
   SET signature_url = NULL
 WHERE signature_storage_key IS NULL
   AND signature_url IS NOT NULL
   AND signature_url LIKE '%/uploads/signatures/%';

COMMIT;

-- =====================================================================
-- VERIFICACIÓN (correr después; debe devolver 0 filas)
--
--   SELECT tenant_id, signature_url
--     FROM tenant_config
--    WHERE signature_url LIKE '%/uploads/%';
--
-- Y para ver el estado de la migración de blobs:
--
--   SELECT tenant_id,
--          signature_url IS NOT NULL          AS tiene_firma,
--          signature_storage_backend          AS backend,
--          signature_hash IS NOT NULL         AS con_hash
--     FROM tenant_config
--    ORDER BY tenant_id;
-- =====================================================================
