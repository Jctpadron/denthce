-- Remediación PROD: protesis_orders/protesis_insumos en prod quedaron stale (creadas en un
-- deploy previo; los CREATE TABLE IF NOT EXISTS posteriores no agregan columnas) → 500 en el
-- portal de laboratorio (TypeORM SELECT con columnas inexistentes).
-- SOLO ALTER aditivos e idempotentes (ADD COLUMN IF NOT EXISTS). Las 3 tablas nuevas
-- (status_history/pagos/consumo) se crean con scripts/create_protesis_tables.sql (autoritativo).
\c hce_fhir;

-- Columnas faltantes en protesis_orders (alinear con protesis-order.entity.ts)
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS patient_name varchar;
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS doctor_name varchar;
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS doctor_matricula varchar;
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS presupuesto_estimado decimal(10,2);
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS presupuesto_final decimal(10,2);
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
ALTER TABLE protesis_orders ADD COLUMN IF NOT EXISTS estado_pago varchar(20) NOT NULL DEFAULT 'pending';

-- Columna faltante en protesis_insumos (precio unitario para costeo)
ALTER TABLE protesis_insumos ADD COLUMN IF NOT EXISTS precio_unitario decimal(10,2);
