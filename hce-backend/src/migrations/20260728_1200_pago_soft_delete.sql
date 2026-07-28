-- 20260728_1200_pago_soft_delete.sql
-- Soft-delete (anulación) de pagos en clinica_pagos. Habilita anular un pago mal cargado
-- conservando la traza contable (no borrado físico), con motivo obligatorio + autoría.
-- Spec funcional: docs/specs/estado-contable-pagos-dinamicos.md (DEC-1, CA-10..CA-12)
--
-- Naturaleza: EXPAND (aditiva). Solo agrega columnas nullable; no toca datos existentes.
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS. Sin DROP / DELETE / TRUNCATE.
-- Soft-delete NORMAL (no append-only, sin trigger: un pago SÍ se corrige/anula).
-- Aislamiento multi-inquilino: por filtro tenant_id a nivel app (la anulación valida tenant en el servicio).
-- Aplicación MANUAL (DB_SYNCHRONIZE=false): este archivo es la fuente de verdad del esquema.

\c hce_fhir;

SET lock_timeout = '3s';

ALTER TABLE clinica_pagos ADD COLUMN IF NOT EXISTS anulado_at        timestamptz NULL;
ALTER TABLE clinica_pagos ADD COLUMN IF NOT EXISTS anulado_por       varchar(100) NULL;
ALTER TABLE clinica_pagos ADD COLUMN IF NOT EXISTS motivo_anulacion  varchar(300) NULL;

-- Índice parcial: sumar/listar SOLO pagos vigentes de un presupuesto (hot-path del saldo).
CREATE INDEX IF NOT EXISTS idx_clinica_pagos_presupuesto_vigente
  ON clinica_pagos (presupuesto_id)
  WHERE anulado_at IS NULL;

-- Índice parcial para dashboard/reporte por tenant+fecha sobre pagos vigentes.
CREATE INDEX IF NOT EXISTS idx_clinica_pagos_tenant_fecha_vigente
  ON clinica_pagos (tenant_id, fecha_pago)
  WHERE anulado_at IS NULL;
