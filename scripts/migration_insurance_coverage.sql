-- ============================================================
-- Migración: Cobertura de Salud y Obras Sociales
-- Tablas de catálogo de obras sociales y coberturas de pacientes.
-- Idempotente: seguro de re-ejecutar.
-- ============================================================

-- 1. Catálogo maestro de obras sociales / prepagas
CREATE TABLE IF NOT EXISTS insurance_companies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rnos       VARCHAR(64),
    nombre     VARCHAR(255) NOT NULL,
    tipo       VARCHAR(64),
    activa     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice de unicidad para rnos donde no sea null ni vacío
CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_rnos 
ON insurance_companies (rnos) 
WHERE rnos IS NOT NULL AND rnos != '';

-- 2. Coberturas de los pacientes
CREATE TABLE IF NOT EXISTS patient_coverages (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id           VARCHAR(255) NOT NULL,
    insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
    nro_afiliado         VARCHAR(255) NOT NULL,
    plan                 VARCHAR(255),
    es_titular           BOOLEAN NOT NULL DEFAULT true,
    nombre_titular       VARCHAR(255),
    principal            BOOLEAN NOT NULL DEFAULT true,
    activa               BOOLEAN NOT NULL DEFAULT true,
    tenant_id            VARCHAR(255) NOT NULL,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas eficientes y multi-tenant Zero Trust
CREATE INDEX IF NOT EXISTS idx_coverage_patient ON patient_coverages (patient_id);
CREATE INDEX IF NOT EXISTS idx_coverage_tenant ON patient_coverages (tenant_id);
