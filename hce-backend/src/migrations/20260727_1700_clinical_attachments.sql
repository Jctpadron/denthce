-- 20260727_1700_clinical_attachments.sql
-- Adjuntos clínicos (RX/PDF) anclados al presupuesto y a cada prestación (Procedure).
-- Diseño: docs/design/adjuntos-presupuesto-ficha-modelo-datos.md
-- Gates: security (magic-bytes, descarga autenticada, validación cross-tenant, auditoría DOWNLOAD) +
--        fhir-mcp (hash_algo, type_system/code/display, doc_status, fhir_extras → DocumentReference).
--
-- Naturaleza: EXPAND (aditiva). Tabla nueva; no toca datos existentes.
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS. Sin DROP TABLE / DELETE / TRUNCATE.
-- Soft-delete (deleted_at) — a diferencia de la firma, un adjunto SÍ se corrige (no append-only).
-- Aislamiento multi-inquilino por filtro tenant_id a nivel app + validación de owner en el servicio.
-- Aplicación MANUAL (DB_SYNCHRONIZE=false): este archivo es la fuente de verdad del esquema.

\c hce_fhir;

SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS clinical_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       varchar NOT NULL,
  patient_id      uuid NOT NULL,          -- derivado del owner (nunca del cliente)

  -- Anclaje polimórfico
  owner_type      varchar NOT NULL,       -- 'presupuesto' | 'procedure'
  owner_id        uuid NOT NULL,

  -- Puntero al blob (NUNCA el blob en DB), almacén PRIVADO (no /uploads público)
  storage_backend varchar NOT NULL DEFAULT 'local',
  storage_key     varchar NOT NULL,
  filename        varchar NOT NULL,       -- nombre original (solo etiqueta; el de disco lo genera el backend)
  mime_type       varchar NOT NULL,       -- image/jpeg | image/png | application/pdf (validado por magic-bytes)
  size_bytes      integer NULL,
  kind            varchar NULL,           -- 'rx' | 'foto' | 'documento' (clasificación de negocio)

  -- Integridad
  content_hash    varchar NOT NULL,
  hash_algo       varchar NOT NULL DEFAULT 'SHA-256',   -- fhir-mcp: Attachment.hash necesita algoritmo explícito

  -- Mapeo FHIR DocumentReference (nullable/refinable sin re-migrar; RX dental no tiene LOINC limpio)
  type_system     varchar NULL,           -- 'http://loinc.org' | 'http://snomed.info/sct'
  type_code       varchar NULL,
  type_display    varchar NULL,
  doc_status      varchar NOT NULL DEFAULT 'final',      -- final | amended; soft-deleted → 'entered-in-error'
  fhir_extras     jsonb   NULL,

  -- Autoría
  uploaded_by     varchar NOT NULL,
  uploaded_by_name varchar NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),

  -- Soft-delete (los adjuntos SÍ se corrigen; el blob no se borra por trazabilidad de ePHI)
  deleted_at      timestamptz NULL,
  deleted_by      varchar NULL,

  CONSTRAINT ck_clinical_attachments_owner_type CHECK (owner_type IN ('presupuesto', 'procedure'))
);

-- Listar adjuntos vigentes de un owner (excluye soft-deleted).
CREATE INDEX IF NOT EXISTS idx_clin_attach_owner
  ON clinical_attachments (tenant_id, owner_type, owner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clin_attach_tenant_patient
  ON clinical_attachments (tenant_id, patient_id)
  WHERE deleted_at IS NULL;
