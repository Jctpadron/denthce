-- Registra "Finanzas de la Clínica" como módulo PAGO en el catálogo (decisión de producto).
-- Idempotente. Precio inicial 25.00 (TBD por producto).
-- 1) Catálogo
INSERT INTO platform_modules (key, name, description, price, available, is_base) VALUES
    ('finanzas-clinicas', 'Finanzas de la Clínica', 'Nomenclador de precios, presupuestos, pagos, gastos y cuenta corriente de la clínica.', 25.00, true, false)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    available = EXCLUDED.available,
    is_base = EXCLUDED.is_base;

-- 2) Habilitar para el tenant de prueba (para no perder acceso de doctor_julio)
INSERT INTO tenant_modules (tenant_id, module_key, enabled, activated_at) VALUES
    ('mi_consultorio_dent_hce', 'finanzas-clinicas', true, CURRENT_TIMESTAMP)
ON CONFLICT (tenant_id, module_key) DO NOTHING;
