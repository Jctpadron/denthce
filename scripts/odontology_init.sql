-- =============================================================================
-- Historia Clínica Odontológica (módulo AISLADO) — creación de tabla propia.
--
-- Esta tabla es independiente de `fhir_clinical_resources` (la primera HC).
-- Ejecutar UNA vez si el backend NO corre con DB_SYNCHRONIZE=true.
-- Idempotente: usa IF NOT EXISTS, se puede correr sin riesgo.
--
-- Uso (PowerShell, contra la BD local o RDS):
--   psql "$env:DATABASE_URL" -f scripts/odontology_init.sql
-- o con variables sueltas:
--   psql -h localhost -U hce_admin -d hce_fhir -f scripts/odontology_init.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS odontology_clinical_resources (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     varchar NOT NULL,
    patient_id    varchar NOT NULL,
    resource_type varchar NOT NULL,
    payload       jsonb   NOT NULL,
    created_at    timestamp with time zone NOT NULL DEFAULT now(),
    updated_at    timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice de la consulta caliente (cargar la HC odontológica de un paciente).
CREATE INDEX IF NOT EXISTS idx_odontology_tenant_patient_type
    ON odontology_clinical_resources (tenant_id, patient_id, resource_type);

-- Nota: gen_random_uuid() requiere la extensión pgcrypto (incluida por defecto
-- en PostgreSQL 13+). Si tu versión la necesita explícita, descomentá:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
