-- ============================================================
-- Migración: columna `hce_webhook_secret` en tenant_config
-- Faltaba en entornos cuya BD se inicializó antes de la integración CliniChat
-- (la columna ya está en init.sql para instalaciones nuevas).
-- Sin ella, todo SELECT de tenant_config vía la entidad TypeORM falla (500):
-- el webhook saliente HCE→CliniChat y el Super Admin (listClinics) la requieren.
-- Idempotente, aditiva, no destructiva. Aplicada en RDS prod el 2026-06-13.
-- ============================================================

ALTER TABLE tenant_config
    ADD COLUMN IF NOT EXISTS hce_webhook_secret VARCHAR(255);
