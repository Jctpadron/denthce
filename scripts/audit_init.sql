-- ============================================================================
-- Script de Inicialización de la Tabla de Auditoría Clínica Inmutable (FHIR AuditEvent)
-- HCE - Zero Trust Architecture
-- ============================================================================

-- 1. Conectarse a la base de datos clínica hce_fhir
\c hce_fhir;

-- 2. Habilitar extensión para generación de UUID en hce_fhir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Crear la tabla de auditoría clínica
CREATE TABLE IF NOT EXISTS clinical_audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recorded TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_role VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    client_ip VARCHAR(45) NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    outcome_description TEXT,
    payload JSONB NOT NULL
);

-- 4. Crear índices optimizados para auditoría forense y analítica clínica
CREATE INDEX IF NOT EXISTS idx_audit_recorded ON clinical_audit_events (recorded DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON clinical_audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource_action ON clinical_audit_events (resource_type, action_type);
CREATE INDEX IF NOT EXISTS idx_audit_payload_gin ON clinical_audit_events USING gin (payload);

-- 5. Crear la función para forzar inmutabilidad de los registros (WORM)
CREATE OR REPLACE FUNCTION block_audit_alterations()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación denegada: Los registros de auditoría clínica en clinical_audit_events son estrictamente inmutables por regulaciones HIPAA/GDPR.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger de protección ante modificaciones (UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_clinical_audit_inmutability ON clinical_audit_events;
CREATE TRIGGER trg_clinical_audit_inmutability
BEFORE UPDATE OR DELETE ON clinical_audit_events
FOR EACH ROW
EXECUTE FUNCTION block_audit_alterations();

-- Mensaje informativo para logs
\echo 'Tabla de auditoría clinical_audit_events creada con políticas de inmutabilidad y triggers configurados exitosamente en la BD hce_fhir.'
