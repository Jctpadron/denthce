-- Script de Inicialización de Base de Datos HCE
-- Se ejecuta de forma automática en el primer arranque del contenedor de PostgreSQL

-- 1. Crear base de datos para los recursos clínicos (HCE FHIR) si no existe
SELECT 'CREATE DATABASE hce_fhir'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hce_fhir')\gexec

-- 2. Otorgar todos los privilegios al usuario administrador sobre la base de datos clínica
GRANT ALL PRIVILEGES ON DATABASE hce_fhir TO hce_admin;

-- Mensaje de éxito en logs de PostgreSQL
\echo 'Base de datos hce_fhir creada y privilegios configurados exitosamente.'

-- 3. Inicializar la tabla de auditoría clínica en hce_fhir
\c hce_fhir;

-- Habilitar extensiones para generación de UUID y optimización de búsquedas parciales
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Crear la tabla de auditoría clínica
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

-- Crear índices optimizados para auditoría forense y analítica clínica
CREATE INDEX IF NOT EXISTS idx_audit_recorded ON clinical_audit_events (recorded DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON clinical_audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource_action ON clinical_audit_events (resource_type, action_type);
CREATE INDEX IF NOT EXISTS idx_audit_payload_gin ON clinical_audit_events USING gin (payload);

-- Crear la función para forzar inmutabilidad de los registros (WORM)
CREATE OR REPLACE FUNCTION block_audit_alterations()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación denegada: Los registros de auditoría clínica en clinical_audit_events son estrictamente inmutables por regulaciones HIPAA/GDPR.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger de protección ante modificaciones (UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_clinical_audit_inmutability ON clinical_audit_events;
CREATE TRIGGER trg_clinical_audit_inmutability
BEFORE UPDATE OR DELETE ON clinical_audit_events
FOR EACH ROW
EXECUTE FUNCTION block_audit_alterations();

\echo 'Tabla de auditoría clinical_audit_events e índices creados con éxito.'

-- 4. Inicializar la tabla de pacientes fhir_patients
CREATE TABLE IF NOT EXISTS fhir_patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    dni VARCHAR(50) NOT NULL,
    family_name VARCHAR(150) NOT NULL,
    given_name VARCHAR(150) NOT NULL,
    gender VARCHAR(50) NOT NULL,
    birth_date DATE NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- Clave de unicidad (dni, gender, tenant): en Argentina existen dos personas distintas con
    -- el mismo DNI y distinto sexo (Libreta de Enrolamiento / Libreta Cívica), por lo que el
    -- DNI no es único por sí solo. La desambiguación final la hace el operador en la grilla.
    CONSTRAINT uq_patient_dni_gender_tenant UNIQUE (dni, gender, tenant_id)
);

-- Crear índices demográficos y de patrones para optimizar búsquedas LIKE a gran escala (10.000+ registros)
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON fhir_patients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_dni ON fhir_patients (dni);
-- Índice B-Tree de patrón para búsquedas DNI LIKE '123%' (prefijo)
CREATE INDEX IF NOT EXISTS idx_patients_dni_pattern ON fhir_patients (dni varchar_pattern_ops);

-- Índices GIN Trigram para búsquedas de nombres/apellidos con comodines LIKE '%nombre%'
CREATE INDEX IF NOT EXISTS idx_patients_family_name_trgm ON fhir_patients USING gin (family_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_given_name_trgm ON fhir_patients USING gin (given_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_birth_date ON fhir_patients (birth_date);
CREATE INDEX IF NOT EXISTS idx_patients_payload_gin ON fhir_patients USING gin (payload);

\echo 'Tabla fhir_patients e índices creados con éxito.'

-- 5. Inicializar la tabla de recursos clínicos fhir_clinical_resources (Odontograma, Alergias, Signos Vitales, Documentos)
CREATE TABLE IF NOT EXISTS fhir_clinical_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL,
    resource_type VARCHAR(100) NOT NULL, -- 'Condition', 'Procedure', 'AllergyIntolerance', 'Observation', etc.
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES fhir_patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clinical_resources_tenant_patient ON fhir_clinical_resources (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_resources_payload_gin ON fhir_clinical_resources USING gin (payload);

\echo 'Tabla fhir_clinical_resources e índices creados con éxito.'

-- 6. Tabla de Configuración de Tenant (Personalización White-Label por Consultorio)
CREATE TABLE IF NOT EXISTS tenant_config (
    tenant_id       VARCHAR(255) PRIMARY KEY,
    -- Identidad del Consultorio
    clinic_name     VARCHAR(255) NOT NULL DEFAULT 'Mi Consultorio',
    specialty       VARCHAR(255) DEFAULT 'Odontología General',
    logo_url        VARCHAR(500),
    primary_color   VARCHAR(20) DEFAULT '#0284c7',
    dark_mode       BOOLEAN DEFAULT FALSE,
    -- Datos del Profesional (para recetas y reportes)
    doctor_name     VARCHAR(255),
    doctor_license  VARCHAR(100),   -- Número de matrícula
    doctor_title    VARCHAR(100),   -- Ej: "Dr.", "Dra.", "Od."
    -- Datos del Consultorio (para encabezado de recetas)
    address         VARCHAR(500),
    city            VARCHAR(100),
    province        VARCHAR(100),
    postal_code     VARCHAR(20),
    phone           VARCHAR(50),
    email           VARCHAR(255),
    cuit            VARCHAR(20),    -- Para facturación
    health_insurance VARCHAR(255),  -- Obra social / prepaga
    -- Horarios de Atención
    schedule_json   JSONB DEFAULT '{"lunes":"09:00-18:00","martes":"09:00-18:00","miercoles":"09:00-18:00","jueves":"09:00-18:00","viernes":"09:00-18:00","sabado":"","domingo":""}',
    -- Firma Digital
    signature_url   VARCHAR(500),   -- URL de imagen de firma PNG
    -- Integración CliniChat (Webhook Secret)
    hce_webhook_secret VARCHAR(255),
    -- Metadata
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

\echo 'Tabla tenant_config creada con éxito.'

-- 7. Tabla de Auditoría de Cambios de Paciente (patient_audit_log)
CREATE TABLE IF NOT EXISTS patient_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    changed_fields JSONB,
    payload_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_audit_patient ON patient_audit_log (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_audit_tenant ON patient_audit_log (tenant_id);

\echo 'Tabla patient_audit_log creada con éxito.'

-- 8. Tabla de Encuentros Médicos (fhir_encounters)
CREATE TABLE IF NOT EXISTS fhir_encounters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'in-progress',
    class_code VARCHAR(50) NOT NULL DEFAULT 'AMB',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    payload JSONB,
    signed_by VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    content_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient_tenant ON fhir_encounters (tenant_id, patient_id);

\echo 'Tabla fhir_encounters creada con éxito.'

-- 9. Tabla de Recetas Médicas (fhir_medication_requests)
CREATE TABLE IF NOT EXISTS fhir_medication_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'draft',
    payload JSONB NOT NULL,
    signed_by VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    content_hash VARCHAR(255),
    qr_code_data VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_medication_requests_patient_tenant ON fhir_medication_requests (tenant_id, patient_id);

\echo 'Tabla fhir_medication_requests creada con éxito.'

-- 10. Tabla de Citas/Turnos (fhir_appointments)
CREATE TABLE IF NOT EXISTS fhir_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    patient_id UUID,
    patient_dni VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'booked',
    practitioner_ref VARCHAR(255),
    practitioner_name VARCHAR(255),
    service_type VARCHAR(100),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    origin_channel VARCHAR(50) DEFAULT 'recepcion',
    idempotency_key VARCHAR(255) UNIQUE,
    cancellation_reason TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES fhir_patients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_appt_tenant_start ON fhir_appointments (tenant_id, start_date);
CREATE INDEX IF NOT EXISTS idx_appt_tenant_patient ON fhir_appointments (tenant_id, patient_id);

\echo 'Tabla fhir_appointments creada con éxito.'

-- 11. Tabla de Auditoría de Citas/Turnos (appointment_audit_log)
CREATE TABLE IF NOT EXISTS appointment_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    actor_id VARCHAR(255),
    actor_name VARCHAR(255),
    is_service_account BOOLEAN DEFAULT FALSE,
    origin_channel VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    payload_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appt_audit_appointment ON appointment_audit_log (appointment_id);
CREATE INDEX IF NOT EXISTS idx_appt_audit_tenant ON appointment_audit_log (tenant_id);

\echo 'Tabla appointment_audit_log creada con éxito.'



