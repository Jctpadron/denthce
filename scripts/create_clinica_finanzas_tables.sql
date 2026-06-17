-- Migration: Módulo Finanzas Clínicas
-- Tablas: clinica_precios, clinica_presupuestos, clinica_presupuesto_items, clinica_pagos, clinica_gastos
-- Ejecutar: psql -U hce_admin -d hce_fhir -f scripts/create_clinica_finanzas_tables.sql

-- 1. Nomenclador (catálogo de precios por prestación SNOMED)
CREATE TABLE IF NOT EXISTS clinica_precios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    snomed_code VARCHAR(50) NOT NULL,
    snomed_display VARCHAR(255) NOT NULL,
    precio NUMERIC(12,2) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinica_precios_tenant ON clinica_precios (tenant_id, active);

-- 2. Presupuestos
CREATE TABLE IF NOT EXISTS clinica_presupuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    patient_id UUID NOT NULL,
    numero VARCHAR(20) NOT NULL,
    estado VARCHAR(20) DEFAULT 'borrador',
    fecha_emision TIMESTAMPTZ DEFAULT NOW(),
    fecha_validez DATE,
    fecha_aceptacion TIMESTAMPTZ,
    subtotal NUMERIC(12,2) NOT NULL,
    descuento NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    senha_porcentaje NUMERIC(5,2) DEFAULT 30,
    senha_monto NUMERIC(12,2),
    notas TEXT,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinica_presupuestos_tenant_patient ON clinica_presupuestos (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinica_presupuestos_tenant_estado ON clinica_presupuestos (tenant_id, estado);

-- 3. Items del presupuesto
CREATE TABLE IF NOT EXISTS clinica_presupuesto_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id UUID NOT NULL REFERENCES clinica_presupuestos(id) ON DELETE CASCADE,
    tenant_id VARCHAR NOT NULL,
    snomed_code VARCHAR(50) NOT NULL,
    snomed_display VARCHAR(255) NOT NULL,
    diente VARCHAR(10),
    cara VARCHAR(10),
    cantidad INTEGER DEFAULT 1,
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    orden INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_clinica_presupuesto_items_presupuesto ON clinica_presupuesto_items (presupuesto_id);

-- 4. Pagos recibidos
CREATE TABLE IF NOT EXISTS clinica_pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    patient_id UUID NOT NULL,
    presupuesto_id UUID REFERENCES clinica_presupuestos(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL, -- senha | cuota | pago_directo
    monto NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    fecha_pago TIMESTAMPTZ DEFAULT NOW(),
    comprobante VARCHAR(200),
    notas TEXT,
    registered_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinica_pagos_tenant_patient ON clinica_pagos (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinica_pagos_presupuesto ON clinica_pagos (presupuesto_id);

-- 5. Gastos operativos
CREATE TABLE IF NOT EXISTS clinica_gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    fecha_gasto TIMESTAMPTZ DEFAULT NOW(),
    metodo_pago VARCHAR(50) NOT NULL,
    comprobante VARCHAR(200),
    insumo_id UUID,
    registered_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinica_gastos_tenant_categoria ON clinica_gastos (tenant_id, categoria);
CREATE INDEX IF NOT EXISTS idx_clinica_gastos_tenant_fecha ON clinica_gastos (tenant_id, fecha_gasto);
