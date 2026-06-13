-- ============================================================
-- QA — Testing de control de la Fase 1 (Super Admin / módulos)
-- Pruebas de integridad, lógica de entitlements, idempotencia y estrés.
-- Seguro: usa tenants de prueba con prefijo 'qa_' y limpia al final.
-- NO toca el tenant real (mi_consultorio_dent_hce).
-- ============================================================
\set ON_ERROR_STOP off
\timing on

\echo '======================================================'
\echo 'TEST 1 — PK compuesta: duplicado (tenant, module) debe FALLAR'
\echo '======================================================'
DO $$
BEGIN
  INSERT INTO tenant_modules (tenant_id, module_key, enabled) VALUES ('qa_pk', 'hc-base', true);
  INSERT INTO tenant_modules (tenant_id, module_key, enabled) VALUES ('qa_pk', 'hc-base', true);
  RAISE EXCEPTION 'FAIL: se permitió un (tenant, module) duplicado';
EXCEPTION
  WHEN unique_violation THEN RAISE NOTICE 'PASS: PK compuesta rechaza duplicados';
END $$;

\echo '======================================================'
\echo 'TEST 2 — FK: module_key inexistente debe FALLAR'
\echo '======================================================'
DO $$
BEGIN
  INSERT INTO tenant_modules (tenant_id, module_key, enabled) VALUES ('qa_fk', 'modulo-fantasma', true);
  RAISE EXCEPTION 'FAIL: se permitió un module_key fuera del catálogo';
EXCEPTION
  WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: FK rechaza módulos fuera del catálogo';
END $$;

\echo '======================================================'
\echo 'TEST 3 — Defaults (enabled=true por defecto)'
\echo '======================================================'
INSERT INTO tenant_modules (tenant_id, module_key) VALUES ('qa_def', 'agenda');
SELECT CASE WHEN enabled THEN 'PASS: enabled default=true' ELSE 'FAIL' END AS test3
FROM tenant_modules WHERE tenant_id = 'qa_def';

\echo '======================================================'
\echo 'TEST 4 — Lógica de entitlements (la query de isEnabled)'
\echo '  Regla: activo = enabled=true AND (expires_at IS NULL OR expires_at > now())'
\echo '======================================================'
-- 4 casos: activo perpetuo, deshabilitado, vencido, vigente futuro
INSERT INTO tenant_modules (tenant_id, module_key, enabled, expires_at) VALUES
  ('qa_logic', 'hc-base',          true,  NULL),                         -- activo perpetuo
  ('qa_logic', 'agenda',           false, NULL),                         -- deshabilitado
  ('qa_logic', 'whatsapp',         true,  now() - interval '1 day'),     -- vencido
  ('qa_logic', 'odontologia-pami', true,  now() + interval '30 days');   -- vigente
SELECT module_key,
       (enabled AND (expires_at IS NULL OR expires_at > now())) AS activo,
       CASE module_key
         WHEN 'hc-base'          THEN (enabled AND (expires_at IS NULL OR expires_at > now())) = true
         WHEN 'agenda'           THEN (enabled AND (expires_at IS NULL OR expires_at > now())) = false
         WHEN 'whatsapp'         THEN (enabled AND (expires_at IS NULL OR expires_at > now())) = false
         WHEN 'odontologia-pami' THEN (enabled AND (expires_at IS NULL OR expires_at > now())) = true
       END AS resultado_esperado
FROM tenant_modules WHERE tenant_id = 'qa_logic' ORDER BY module_key;

\echo '  -> "no contratado" (sin fila) = inactivo:'
SELECT COALESCE(
  (SELECT enabled FROM tenant_modules WHERE tenant_id = 'qa_logic' AND module_key = 'inexistente'),
  false) AS modulo_no_contratado_es_inactivo;

\echo '======================================================'
\echo 'TEST 5 — Idempotencia del seed del catálogo (re-INSERT no duplica)'
\echo '======================================================'
INSERT INTO platform_modules (key, name, is_base) VALUES ('whatsapp', 'dup', false)
ON CONFLICT (key) DO NOTHING;
SELECT CASE WHEN count(*) = 1 THEN 'PASS: catálogo idempotente' ELSE 'FAIL' END AS test5
FROM platform_modules WHERE key = 'whatsapp';

\echo '======================================================'
\echo 'TEST 6 — ESTRÉS: 2000 clínicas x 4 módulos = 8000 entitlements'
\echo '======================================================'
INSERT INTO tenant_modules (tenant_id, module_key, enabled, activated_at, expires_at)
SELECT 'qa_stress_' || g, m.key, (g % 4 <> 0), CURRENT_TIMESTAMP,
       CASE WHEN g % 5 = 0 THEN now() + interval '60 days' ELSE NULL END
FROM generate_series(1, 2000) g
CROSS JOIN (VALUES ('hc-base'),('agenda'),('whatsapp'),('odontologia-pami')) AS m(key)
ON CONFLICT DO NOTHING;

SELECT count(*) AS total_entitlements_qa_stress FROM tenant_modules WHERE tenant_id LIKE 'qa_stress_%';

\echo '  -> EXPLAIN ANALYZE de la query de isEnabled (debe usar PK index, < 1ms):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT enabled AND (expires_at IS NULL OR expires_at > now()) AS activo
FROM tenant_modules WHERE tenant_id = 'qa_stress_1500' AND module_key = 'whatsapp';

\echo '  -> Query agregada: módulos activos de una clínica (vista del panel):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT module_key FROM tenant_modules
WHERE tenant_id = 'qa_stress_999' AND enabled AND (expires_at IS NULL OR expires_at > now());

\echo '======================================================'
\echo 'TEST 7 — CLEANUP (borra todo lo de prueba, deja la BD intacta)'
\echo '======================================================'
DELETE FROM tenant_modules WHERE tenant_id LIKE 'qa_%';
DELETE FROM platform_modules WHERE key = 'qa_nada'; -- no-op defensivo
SELECT count(*) AS entitlements_qa_restantes FROM tenant_modules WHERE tenant_id LIKE 'qa_%';
SELECT count(*) AS catalogo_intacto FROM platform_modules;
SELECT tenant_id, module_key FROM tenant_modules ORDER BY tenant_id, module_key;
