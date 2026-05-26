# Diseño Técnico: Motor de Auditoría Clínica Inmutable (FHIR AuditEvent)

Este documento define el diseño arquitectónico y de base de datos para el **Motor de Auditoría Clínica** de la HCE. Este motor cumple con las regulaciones de seguridad **HIPAA (Health Insurance Portability and Accountability Act)** y **GDPR (Reglamento General de Protección de Datos)** mediante el registro inmutable de accesos y modificaciones a la información de salud protegida (ePHI).

El motor modela cada registro de auditoría utilizando la estructura estándar del recurso **[AuditEvent de HL7 FHIR R4](https://hl7.org/fhir/R4/auditevent.html)**.

---

## 🏗️ Arquitectura de Persistencia de Auditoría

Para equilibrar la estructuración relacional (para búsquedas rápidas) y la flexibilidad del estándar FHIR (que puede cambiar o expandirse), implementamos un diseño **híbrido en PostgreSQL**:

1. **Campos Indexados (Metadatos Críticos)**: Columnas relacionales tradicionales (`recorded`, `user_id`, `action_type`, `resource_type`, `outcome`) para consultas analíticas de alta velocidad y generación de reportes en tiempo real.
2. **Payload Estructurado (`JSONB`)**: El recurso `AuditEvent` completo en formato JSON para almacenar la totalidad del estándar FHIR, indexado con un índice GIN (Generalized Inverted Index) para permitir búsquedas ad-hoc y extensibilidad a futuro sin alterar el esquema.

---

## 🗄️ Esquema Físico de la Base de Datos (`audit_events`)

El esquema de la tabla de auditoría clínica se detalla a continuación. Para garantizar la inmutabilidad de los registros, se asocia un trigger que bloquea cualquier operación de edición (`UPDATE`) o eliminación (`DELETE`).

```sql
-- Habilitar extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de eventos de auditoría clínica
CREATE TABLE IF NOT EXISTS clinical_audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recorded TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id VARCHAR(255) NOT NULL,              -- ID del profesional/paciente que ejecutó la acción
    user_role VARCHAR(100) NOT NULL,            -- Rol clínico (medico, enfermero, etc.)
    action_type VARCHAR(50) NOT NULL,           -- CREATE, READ, UPDATE, DELETE, EXECUTE
    resource_type VARCHAR(100) NOT NULL,         -- Patient, Encounter, MedicationRequest, etc.
    resource_id VARCHAR(255),                   -- ID físico del recurso afectado
    client_ip VARCHAR(45) NOT NULL,             -- Dirección IPv4 o IPv6 del cliente
    outcome VARCHAR(50) NOT NULL,               -- SUCCESS, MINOR_FAILURE, SERIOUS_FAILURE, MAJOR_FAILURE
    outcome_description TEXT,                   -- Detalle de error si aplica
    payload JSONB NOT NULL                      -- Recurso original completo HL7 FHIR AuditEvent
);
```

---

## 🔒 Control de Inmutabilidad Zero-Trust (Triggers a nivel de Base de Datos)

Un requisito clave de HIPAA es que ningún usuario (incluso administradores de base de datos) pueda alterar el registro de auditoría. Se implementa una política **Write-Once-Read-Many (WORM)** usando la siguiente función de trigger:

```sql
-- Función para bloquear modificaciones y eliminaciones
CREATE OR REPLACE FUNCTION block_audit_alterations()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: Los registros de auditoría clínica en clinical_audit_events son inmutables.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para evitar UPDATE o DELETE
CREATE TRIGGER trg_clinical_audit_inmutability
BEFORE UPDATE OR DELETE ON clinical_audit_events
FOR EACH ROW
EXECUTE FUNCTION block_audit_alterations();
```

---

## ⚡ Índices para Rendimiento y Búsquedas

Los logs de auditoría crecen exponencialmente. Para asegurar tiempos de respuesta subsegundo, configuramos los siguientes índices estratégicos:

```sql
-- Búsqueda rápida por marcas de tiempo (Orden cronológico y filtrado temporal)
CREATE INDEX idx_audit_recorded ON clinical_audit_events (recorded DESC);

-- Búsqueda de accesos realizados por un usuario específico (Análisis forense)
CREATE INDEX idx_audit_user_id ON clinical_audit_events (user_id);

-- Búsqueda por tipo de recurso y acción (ej: Ver quién modificó recetas "MedicationRequest")
CREATE INDEX idx_audit_resource_action ON clinical_audit_events (resource_type, action_type);

-- Índice GIN para búsquedas profundas dentro del recurso JSONB de FHIR
CREATE INDEX idx_audit_payload_gin ON clinical_audit_events USING gin (payload);
```

---

## 📋 Mapeo al Recurso FHIR `AuditEvent`

El campo `payload` contendrá el JSON compatible con FHIR. Aquí se muestra una correspondencia básica de campos:

| Columna en Postgres | Atributo en FHIR `AuditEvent` JSON | Descripción |
| :--- | :--- | :--- |
| `id` | `.id` | Identificador único del evento de auditoría. |
| `recorded` | `.recorded` | Fecha y hora exactas del evento. |
| `user_id` | `.agent[0].altId` o `.agent[0].who.reference` | Identificador del actor que inició el evento. |
| `user_role` | `.agent[0].role` | Roles asignados al agente clínico. |
| `action_type` | `.action` | Código de acción (`C` Create, `R` Read, `U` Update, `D` Delete, `E` Execute). |
| `resource_type` | `.entity[0].type` | Tipo de entidad de datos (ej. Patient, Encounter). |
| `resource_id` | `.entity[0].what.reference` | Referencia física del objeto auditado. |
| `client_ip` | `.agent[0].network.address` | Dirección IP de la máquina de origen. |
| `outcome` | `.outcome` | Resultado (`0` para Success, `4` para Minor failure, `8` Serious, `12` Major). |
| `outcome_description` | `.outcomeDesc` | Descripción textual del resultado (ej. error de credenciales). |
