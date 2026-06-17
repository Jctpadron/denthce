-- Migración para crear la tabla fhir_medication_requests
\c hce_fhir;

CREATE TABLE IF NOT EXISTS fhir_medication_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, -- 'draft' | 'active' | 'completed' | 'cancelled'
    payload JSONB NOT NULL,
    signed_by VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    content_hash VARCHAR(255),
    qr_code_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES fhir_patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medication_requests_tenant_patient ON fhir_medication_requests (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_requests_payload_gin ON fhir_medication_requests USING gin (payload);
