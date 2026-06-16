-- Migración: Encuentro / Visita odontológica (módulo aislado).
-- Crea la tabla odontology_encounters y agrega encounter_id a odontology_clinical_resources.
-- Diseño: docs/design/encuentro-odontologico-modelo.md
-- No destructiva: los registros existentes quedan con encounter_id = NULL (legacy "pre-visita").
\c hce_fhir;

CREATE TABLE IF NOT EXISTS odontology_encounters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,                 -- Zero Trust
    patient_id UUID NOT NULL,
    appointment_id UUID,                             -- FK lógica a fhir_appointments; NULL = walk-in
    status VARCHAR(50) DEFAULT 'in-progress' NOT NULL, -- 'in-progress' | 'finished' | 'cancelled'
    class_code VARCHAR(50) DEFAULT 'AMB' NOT NULL,   -- 'AMB' | 'URG' | 'CTRL'
    reason_text TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,    -- period.start (apertura)
    end_date TIMESTAMP WITH TIME ZONE,               -- period.end (cierre/firma)
    payload JSONB,                                   -- recurso FHIR R4 Encounter
    signed_by VARCHAR(255),                          -- firmante (preferred_username)
    signed_by_id VARCHAR(255),                       -- sub del JWT (trazabilidad estable)
    signed_at TIMESTAMP WITH TIME ZONE,
    content_hash VARCHAR(255),                       -- SHA-256 al firmar
    addenda JSONB DEFAULT '[]'::jsonb NOT NULL,      -- correcciones post-firma (append-only)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_odo_enc_tenant_patient ON odontology_encounters (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_odo_enc_tenant_patient_status ON odontology_encounters (tenant_id, patient_id, status);
CREATE INDEX IF NOT EXISTS idx_odo_enc_appointment ON odontology_encounters (appointment_id);
-- Refuerzo de la invariante "una sola visita activa por paciente/tenant" a nivel DB.
CREATE UNIQUE INDEX IF NOT EXISTS uq_odo_enc_active_per_patient
    ON odontology_encounters (tenant_id, patient_id)
    WHERE status = 'in-progress';

-- Vínculo de las prestaciones existentes a la visita (no destructivo).
ALTER TABLE odontology_clinical_resources ADD COLUMN IF NOT EXISTS encounter_id UUID;
CREATE INDEX IF NOT EXISTS idx_odo_res_encounter ON odontology_clinical_resources (tenant_id, encounter_id);

-- Auditoría inmutable de los actos de la visita (apertura/firma/cancelación/addenda) — ePHI.
CREATE TABLE IF NOT EXISTS odontology_encounter_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encounter_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL,
    actor_id VARCHAR(255),
    actor_name VARCHAR(255),
    action VARCHAR(50) NOT NULL,            -- 'OPEN' | 'SIGN' | 'CANCEL' | 'ADDENDA'
    payload_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_odo_enc_audit_enc ON odontology_encounter_audit_log (encounter_id);
