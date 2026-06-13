-- ============================================================
-- Migración: Super Admin — Servicios anexables (Fase 1)
-- Modelo de módulos/suscripción por clínica.
-- Idempotente: seguro de re-ejecutar. Aplicar en dev local y RDS prod.
-- ============================================================

-- 1. tenant_config: plan + estado de la clínica
ALTER TABLE tenant_config
    ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'basic',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Catálogo maestro de módulos contratables
CREATE TABLE IF NOT EXISTS platform_modules (
    key         VARCHAR(64) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price       NUMERIC(10,2),
    available   BOOLEAN NOT NULL DEFAULT true,
    is_base     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Entitlements: qué módulos contrató cada clínica
CREATE TABLE IF NOT EXISTS tenant_modules (
    tenant_id    VARCHAR(255) NOT NULL,
    module_key   VARCHAR(64)  NOT NULL REFERENCES platform_modules(key) ON DELETE CASCADE,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    activated_at TIMESTAMP WITH TIME ZONE,
    expires_at   TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules (tenant_id);

-- 4. Seed del catálogo de módulos
INSERT INTO platform_modules (key, name, description, price, available, is_base) VALUES
    ('hc-base',          'Historia Clínica',             'Núcleo asistencial: pacientes, odontograma, alergias, signos vitales, documentos.', NULL, true, true),
    ('agenda',           'Agenda de Turnos',             'Calendario de turnos por día/semana, sala de espera y estado del box.',             NULL, true, false),
    ('whatsapp',         'WhatsApp / CliniChat',         'Recordatorios y sincronización de turnos por WhatsApp (bot CliniChat).',            NULL, true, false),
    ('odontologia-pami', 'Historia Clínica Odontológica', 'Ficha odontológica completa modelo PAMI con exportación oficial.',                  NULL, true, false)
ON CONFLICT (key) DO NOTHING;

-- 5. Backfill: las clínicas existentes reciben los módulos base habilitados.
--    (hc-base + agenda + odontologia-pami como parte del producto entregado; WhatsApp NO,
--     se anexa solo si lo contrataron.)
INSERT INTO tenant_modules (tenant_id, module_key, enabled, activated_at)
SELECT tc.tenant_id, m.key, true, CURRENT_TIMESTAMP
FROM tenant_config tc
CROSS JOIN (VALUES ('hc-base'), ('agenda'), ('odontologia-pami')) AS m(key)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- Verificación rápida (opcional):
-- SELECT * FROM platform_modules ORDER BY is_base DESC, key;
-- SELECT tenant_id, module_key, enabled FROM tenant_modules ORDER BY tenant_id, module_key;
