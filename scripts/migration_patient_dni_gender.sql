-- =======================================================================
-- MIGRACIÓN: Clave de unicidad del paciente (dni, gender, tenant_id)
-- HCE / DentHCE — 2026-05-30
-- =======================================================================
-- Motivo: en Argentina, por el sistema histórico de Libreta de Enrolamiento
-- (varones) y Libreta Cívica (mujeres), existen dos personas distintas con el
-- mismo número de documento y distinto sexo. El DNI no es único por sí solo.
-- Esta migración reemplaza el UNIQUE (dni, tenant_id) por (dni, gender, tenant_id).
--
-- Aplicar sobre una BD EXISTENTE (las bases nuevas ya nacen con la clave correcta
-- desde init.sql). Idempotente: se puede correr más de una vez sin error.
-- =======================================================================

\c hce_fhir;

-- 1. DETECCIÓN PREVIA DE COLISIONES.
--    Debe devolver 0 filas. Si devuelve filas, hay pacientes que ya colisionan
--    bajo la nueva clave y deben resolverse manualmente (merge) ANTES de migrar.
\echo 'Verificando colisiones bajo la nueva clave (dni, gender, tenant_id)...'
SELECT dni, gender, tenant_id, COUNT(*) AS repetidos
FROM fhir_patients
GROUP BY dni, gender, tenant_id
HAVING COUNT(*) > 1;

-- 2. Eliminar el constraint viejo UNIQUE (dni, tenant_id) si existe.
ALTER TABLE fhir_patients DROP CONSTRAINT IF EXISTS unique_dni_tenant;

-- 3. Crear el nuevo constraint compuesto (dni, gender, tenant_id) si aún no existe.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_patient_dni_gender_tenant'
          AND conrelid = 'fhir_patients'::regclass
    ) THEN
        ALTER TABLE fhir_patients
            ADD CONSTRAINT uq_patient_dni_gender_tenant UNIQUE (dni, gender, tenant_id);
    END IF;
END $$;

\echo 'Migración de clave (dni, gender, tenant_id) aplicada con éxito.'

-- 4. VERIFICACIÓN POST-MIGRACIÓN (manual / opcional):
--    - Insertar mismo (dni, gender, tenant) dos veces debe FALLAR.
--    - Insertar mismo dni con gender distinto en el mismo tenant debe PASAR.
