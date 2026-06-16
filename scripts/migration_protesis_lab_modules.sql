-- ============================================================
-- Migración: Registro de Módulo Protesistas Dentales (DentaLab)
-- Habilita el módulo en el catálogo platform_modules y realiza
-- el backfill inicial para el tenant de pruebas en local.
-- ============================================================

-- 1. Insertar el módulo en el catálogo maestro
INSERT INTO platform_modules (key, name, description, price, available, is_base) VALUES
    ('protesis-lab', 'Portal Protesistas Dentales', 'Bandeja de órdenes de prótesis, chat clínico y descarga de archivos STL/CAD.', 35.00, true, false)
ON CONFLICT (key) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price;

-- 2. Habilitar el módulo para el tenant de prueba local 'mi_consultorio_dent_hce'
--    Esto permite que el odontólogo doctor_julio visualice la pestaña de laboratorio
INSERT INTO tenant_modules (tenant_id, module_key, enabled, activated_at) VALUES
    ('mi_consultorio_dent_hce', 'protesis-lab', true, CURRENT_TIMESTAMP)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- 3. Habilitar el módulo para el laboratorio mock 'lab_valle'
INSERT INTO tenant_modules (tenant_id, module_key, enabled, activated_at) VALUES
    ('lab_valle', 'protesis-lab', true, CURRENT_TIMESTAMP)
ON CONFLICT (tenant_id, module_key) DO NOTHING;
