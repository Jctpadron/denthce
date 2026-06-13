-- ============================================================
-- Migración: columna `priority` en fhir_appointments (Módulo 5, Tarea 5.4)
-- Triaje de sala de espera (ESI simplificado 1-5; 1 = más urgente).
-- Idempotente: seguro de re-ejecutar. Aplicar en BD existentes (dev local y RDS prod).
-- ============================================================

ALTER TABLE fhir_appointments
    ADD COLUMN IF NOT EXISTS priority INT;

-- Verificación rápida (opcional):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'fhir_appointments' AND column_name = 'priority';
