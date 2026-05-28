# Inicialización de Base de Datos HCE en AWS RDS

**Fecha:** 28 de Mayo de 2026
**Módulo:** Infraestructura (Despliegue AWS)

## Resumen de Cambios
Se ejecutó satisfactoriamente el script de estructuración y aprovisionamiento clínico (`scripts/init.sql`) sobre la instancia remota de **Aurora PostgreSQL en AWS**.

> [!TIP]
> Dado que la base de datos de producción ya está estructurada, el siguiente paso lógico de infraestructura sería configurar el Backend y Keycloak para que apunten a esta base de datos en AWS (utilizando las variables de entorno `DB_HOST`, `DB_PASSWORD`, `KC_DB_URL`, etc.).

## Resultados de la Validación

### Estructura Creada:
- **Base de datos principal:** `hce_fhir`
- **Extensiones habilitadas:** `uuid-ossp` y `pg_trgm` (optimizador de búsquedas en texto y JSON).
- **Tablas Clínicas (FHIR):**
  - `clinical_audit_events`: Tabla de auditoría con inmutabilidad habilitada mediante el trigger `trg_clinical_audit_inmutability`.
  - `fhir_patients`: Registro demográfico de pacientes con índices de búsqueda por DNI y aproximación por nombre.
  - `fhir_clinical_resources`: Tabla centralizada de almacenamiento en formato JSONB (Alergias, Odontograma, Observaciones).
  - `tenant_config`: Tabla de configuración White-Label multi-inquilino.

### Conectividad:
La conexión fue encriptada exitosamente de extremo a extremo (TLSv1.3) validando el certificado oficial de AWS RDS (`global-bundle.pem`).

---
El entorno de base de datos en AWS ya está 100% operativo y listo para recibir tráfico de la aplicación web.
