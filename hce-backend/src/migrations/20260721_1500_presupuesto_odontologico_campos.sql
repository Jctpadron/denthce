-- Migración: Presupuesto odontológico (PAMI / Obra Social) sobre el módulo Finanzas.
-- Digitaliza el formulario de papel REUSANDO las tablas existentes de Finanzas
-- (clinica_presupuestos, clinica_presupuesto_items). NO crea tablas nuevas.
-- Diseño: docs/design/presupuesto-odontologico-modelo-datos.md
-- Mapeo UX de origen: docs/design/modal-presupuesto-odontologico.md (§9 y §9.4)
--
-- Naturaleza: EXPAND (aditiva). Todas las columnas son NULLABLE y sin DEFAULT que reescriba
-- filas → no rompe presupuestos existentes ni la UI de Finanzas actual.
-- Idempotente: ADD COLUMN IF NOT EXISTS (re-ejecutable sin error).
-- Sin DELETE / TRUNCATE / DROP. Sin índices nuevos (no se crean tablas; el aislamiento
-- multi-inquilino sigue siendo por filtro tenant_id a nivel app, ya existente).
--
-- Aplicación MANUAL (DB_SYNCHRONIZE=false): este archivo es la fuente de verdad del esquema.

\c hce_fhir;

-- Cota de espera de lock: si otra transacción tiene la tabla tomada más de 3s, abortar
-- en vez de encolar y bloquear el tráfico productivo.
SET lock_timeout = '3s';

-- ============================================================================
-- clinica_presupuesto_items  (líneas del presupuesto)
-- ============================================================================

-- Código del nomenclador de facturación (nacional / PAMI / OS). Eje distinto del snomed_code
-- clínico ya existente: éste es el código con el que se factura a la Obra Social.
ALTER TABLE clinica_presupuesto_items
  ADD COLUMN IF NOT EXISTS codigo_nomenclador varchar(50);

-- Texto libre del "Detalle de tratamiento" (dientes, cara, puente 15-17, etc.) para casos
-- que no encajan en los campos estructurados diente / cara.
ALTER TABLE clinica_presupuesto_items
  ADD COLUMN IF NOT EXISTS detalle varchar(255);

-- Trazabilidad al recurso FHIR planificado del odontograma que originó la línea.
-- Evita re-importar la misma línea y permite marcar el plan como "presupuestado".
ALTER TABLE clinica_presupuesto_items
  ADD COLUMN IF NOT EXISTS source_resource_id varchar(255);

-- ============================================================================
-- clinica_presupuestos  (cabecera del presupuesto)
-- ============================================================================

-- Cantidad de radiografías (RX) presentadas a la Obra Social. En el papel es un conteo.
ALTER TABLE clinica_presupuestos
  ADD COLUMN IF NOT EXISTS rx_presentadas int;

-- Obra Social a la que se presenta el presupuesto. v1: texto libre (futuro: FK a catálogo OS).
ALTER TABLE clinica_presupuestos
  ADD COLUMN IF NOT EXISTS obra_social varchar(255);

-- Cantidad de cuotas pactadas (informativo: sugiere valor de cuota = total / cantidad_cuotas).
ALTER TABLE clinica_presupuestos
  ADD COLUMN IF NOT EXISTS cantidad_cuotas int;

-- Fecha de presentación del presupuesto a la Obra Social.
ALTER TABLE clinica_presupuestos
  ADD COLUMN IF NOT EXISTS fecha_presentacion date;

-- Fecha de liquidación / pago por parte de la Obra Social.
ALTER TABLE clinica_presupuestos
  ADD COLUMN IF NOT EXISTS fecha_liquidacion date;

-- NOTA sobre "Saldo": NO se agrega columna. El saldo es derivado y se calcula
-- total - Σ(clinica_pagos.monto WHERE presupuesto_id = ...). Persistirlo introduciría
-- una fuente de verdad redundante que se desincroniza con cada pago.
