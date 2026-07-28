-- 20260727_1600_firma_conformidad_paciente.sql
-- Firma de conformidad del paciente por prestación (append-only) + audit log de evidencia clínica.
-- Diseño: docs/design/firma-conformidad-paciente-modelo-datos.md
-- Gates: security (signed_content_snapshot inmutable, descarga autenticada, auditoría de VIEW) +
--        fhir-mcp (hash_algo, signature_type_*, sig_format, fhir_meta → Provenance/Signature).
--
-- Naturaleza: EXPAND (aditiva). Crea tablas nuevas; no toca datos existentes.
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS, DROP TRIGGER IF EXISTS antes del CREATE (no borra datos).
-- Sin DROP TABLE / DELETE / TRUNCATE. Aislamiento multi-inquilino por filtro tenant_id a nivel app.
-- Aplicación MANUAL (DB_SYNCHRONIZE=false): este archivo es la fuente de verdad del esquema.

\c hce_fhir;

SET lock_timeout = '3s';

-- ============================================================================
-- odontology_patient_signatures — firma manuscrita de conformidad, 1 fila por prestación
-- ============================================================================

CREATE TABLE IF NOT EXISTS odontology_patient_signatures (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              varchar NOT NULL,
  patient_id             uuid NOT NULL,
  resource_id            uuid NOT NULL,          -- Procedure firmado (FK lógica a odontology_clinical_resources.id)
  encounter_id           uuid NULL,              -- visita (FK lógica); nullable = prestación suelta/legacy

  -- Puntero al blob (NUNCA el blob en DB). Almacén PRIVADO (no /uploads público) + hash de integridad.
  storage_backend        varchar NOT NULL DEFAULT 'local',   -- 'local' (hoy) | 's3' (futuro), sin cambio de esquema
  storage_key            varchar NOT NULL,
  mime_type              varchar NOT NULL DEFAULT 'image/png',
  size_bytes             integer NULL,

  -- Integridad / no repudio
  content_hash           varchar NOT NULL,       -- hash del PNG
  hash_algo              varchar NOT NULL DEFAULT 'SHA-256',  -- fhir-mcp: algoritmo explícito (integridad legal)

  -- BLOQUEANTE security: snapshot inmutable de LO FIRMADO (el Procedure es mutable; sin esto la firma
  -- apuntaría a un texto que puede cambiar → se rompe el no repudio). Congela qué conformó el paciente.
  signed_content_snapshot jsonb NOT NULL,        -- { snomedCode, snomedDisplay, codigoNomenclador?, diente?, cara?, performedDateTime? }
  snapshot_hash          varchar NULL,           -- hash del snapshot (encadena integridad snapshot+imagen)

  -- Momento y autoría del acto
  signed_at              timestamptz NOT NULL DEFAULT now(),  -- timestamp de SERVIDOR (nunca del cliente)
  captured_by_id         varchar NOT NULL,       -- sub del JWT (profesional que capturó)
  captured_by_name       varchar NULL,           -- preferred_username
  device_info            varchar NULL,           -- userAgent recortado / etiqueta de box (sin ePHI)
  source_ip              varchar NULL,           -- refuerza no repudio (metadato del acto, no del paciente)

  -- Mapeo FHIR (fhir-mcp): Provenance + datatype Signature. Valores fijos hoy → default de columna (no hardcode).
  signature_type_system  varchar NOT NULL DEFAULT 'urn:iso-astm:E1762-95:2013',
  signature_type_code    varchar NOT NULL DEFAULT '1.2.840.10065.1.12.1.7',  -- ASTM "Consent Signature"
  sig_format             varchar NOT NULL DEFAULT 'image/png',
  fhir_meta              jsonb NULL,             -- extras FHIR (securityLabel, extensiones) sin re-migrar

  -- Ciclo de vida append-only
  superseded_by          uuid NULL,              -- recaptura: apunta a la fila nueva; la vieja NUNCA se borra
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odo_patsig_tenant_resource  ON odontology_patient_signatures (tenant_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_odo_patsig_tenant_encounter ON odontology_patient_signatures (tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_odo_patsig_tenant_patient   ON odontology_patient_signatures (tenant_id, patient_id);

-- Una sola firma VIGENTE (no supersedida) por prestación.
CREATE UNIQUE INDEX IF NOT EXISTS uq_odo_patsig_resource_vigente
  ON odontology_patient_signatures (tenant_id, resource_id)
  WHERE superseded_by IS NULL;

-- Inmutabilidad append-only a nivel motor (defensa en profundidad). Rechaza DELETE y todo UPDATE
-- salvo marcar superseded_by por primera vez. Protege también signed_content_snapshot y source_ip.
CREATE OR REPLACE FUNCTION odo_patsig_no_mutate() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Firma de conformidad inmutable: DELETE no permitido';
  END IF;
  IF OLD.superseded_by IS NOT NULL
     OR NEW.id <> OLD.id OR NEW.tenant_id <> OLD.tenant_id
     OR NEW.patient_id <> OLD.patient_id OR NEW.resource_id <> OLD.resource_id
     OR NEW.content_hash <> OLD.content_hash OR NEW.storage_key <> OLD.storage_key
     OR NEW.signed_at <> OLD.signed_at OR NEW.captured_by_id <> OLD.captured_by_id
     OR NEW.signed_content_snapshot::text <> OLD.signed_content_snapshot::text
     OR COALESCE(NEW.source_ip,'') <> COALESCE(OLD.source_ip,'') THEN
    RAISE EXCEPTION 'Firma de conformidad inmutable: solo se permite marcar superseded_by una vez';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_odo_patsig_no_mutate ON odontology_patient_signatures;
CREATE TRIGGER trg_odo_patsig_no_mutate
  BEFORE UPDATE OR DELETE ON odontology_patient_signatures
  FOR EACH ROW EXECUTE FUNCTION odo_patsig_no_mutate();

-- ============================================================================
-- clinical_evidence_audit_log — auditoría append-only de firma y adjuntos (patrón AuditEvent FHIR)
-- Polimórfico (recomendación security/fhir-mcp): sirve a firma (C) y adjuntos (D), con o sin encounter.
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinical_evidence_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     varchar NOT NULL,
  patient_id    uuid NULL,
  entity_type   varchar NOT NULL,   -- 'patient_signature' | 'clinical_attachment'
  entity_id     uuid NULL,
  action        varchar NOT NULL,   -- PATIENT_SIGN | PATIENT_SIGN_VIEW | PATIENT_SIGN_SUPERSEDE | ATTACH_UPLOAD | ATTACH_DOWNLOAD | ATTACH_DELETE
  actor_id      varchar NOT NULL,
  actor_name    varchar NULL,
  source_ip     varchar NULL,
  payload       jsonb NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_audit_tenant_entity ON clinical_evidence_audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_audit_tenant_patient ON clinical_evidence_audit_log (tenant_id, patient_id);

-- Append-only: rechaza UPDATE/DELETE.
CREATE OR REPLACE FUNCTION clinical_evidence_audit_no_mutate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Auditoría de evidencia clínica inmutable: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidence_audit_no_mutate ON clinical_evidence_audit_log;
CREATE TRIGGER trg_evidence_audit_no_mutate
  BEFORE UPDATE OR DELETE ON clinical_evidence_audit_log
  FOR EACH ROW EXECUTE FUNCTION clinical_evidence_audit_no_mutate();
