# Walkthrough: Cierre Módulo 2 — Auditoría Demográfica + Integración SISA

**Fecha:** 26/05/2026  
**Sprint:** Módulo 2 — Registro Demográfico (FHIR Patient)  
**Estado:** ✅ Módulo 2 COMPLETADO al 100%

---

## Tareas Implementadas

### Tarea 2.4 — Historial de Trazabilidad y Auditoría Demográfica

#### Backend
| Archivo | Cambio |
|---------|--------|
| `patient/patient-audit.entity.ts` | **[NEW]** Entidad TypeORM para tabla `patient_audit_log` (id, patientId, tenantId, userId, userName, action, changedFields JSONB, payloadSnapshot JSONB, createdAt) |
| `patient/patient-audit.service.ts` | **[NEW]** Servicio con `logChange()` (calcula diff de campos demográficos) y `getHistory()` (devuelve historial ordenado DESC) |
| `patient/patient.service.ts` | **[MODIFY]** Inyecta `PatientAuditService`. En `create()`: registra evento `CREATE`. En `update()`: calcula snapshot `before`, ejecuta cambios y registra evento `UPDATE` con diff. |
| `patient/patient.controller.ts` | **[MODIFY]** Extrae `userId`/`userName` del JWT. Agrega endpoint `GET /fhir/r4/Patient/:id/audit` (roles: medico, administrador). |
| `patient/patient.module.ts` | **[MODIFY]** Registra `PatientAuditEntity` y `PatientAuditService`. |
| `app.module.ts` | **[MODIFY]** Agrega `PatientAuditEntity` al array de entidades TypeORM. |

#### Base de Datos (Migración Manual)
```sql
CREATE TABLE patient_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id varchar NOT NULL,
  tenant_id varchar NOT NULL,
  user_id varchar,
  user_name varchar,
  action varchar NOT NULL,          -- 'CREATE' | 'UPDATE'
  changed_fields jsonb,             -- { fieldName: { before, after } }
  payload_snapshot jsonb,           -- Snapshot FHIR completo
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_patient_id ON patient_audit_log(patient_id);
CREATE INDEX idx_audit_tenant_id ON patient_audit_log(tenant_id);
```

#### Frontend
| Archivo | Cambio |
|---------|--------|
| `components/tabs/AuditTab.tsx` | **[NEW]** Timeline visual de cambios demográficos. Badge Create/Update. Diff expandible antes/después por campo. Usuario + timestamp por evento. |
| `components/PatientSearch.tsx` | **[MODIFY]** Agrega pestaña "Historial" (ícono Shield) al segmented control de la ficha clínica. Renderiza `<AuditTab />`. |

---

### Tarea 2.5 — Adaptador SISA (Padrón Gubernamental Argentina)

#### Backend
| Archivo | Cambio |
|---------|--------|
| `sisa/sisa.service.ts` | **[NEW]** Adaptador con modo mock (activo por defecto) y modo real (via .env). Verifica DNI contra SISA REST API. |
| `sisa/sisa.controller.ts` | **[NEW]** `GET /api/sisa/verificar?dni=:dni&gender=:gender` — proxy seguro protegido por JWT. |
| `sisa/sisa.module.ts` | **[NEW]** Módulo NestJS para SISA. |
| `app.module.ts` | **[MODIFY]** Importa `SisaModule`. |

#### Frontend
| Archivo | Cambio |
|---------|--------|
| `components/PatientForm.tsx` | **[MODIFY]** Botón "SISA" junto al campo DNI. Al hacer click: consulta el backend, y si el padrón responde, propone autocompletar nombre, apellido, fecha de nacimiento y género. Badge de estado: 🔧 Demo / ✅ Verificado / ⚠️ No encontrado / 🔌 No disponible. |

#### Activar SISA Real (cuando se obtengan credenciales)
Agregar en `.env` del backend:
```env
SISA_MOCK=false
SISA_BASE_URL=https://sisa.msal.gov.ar/sisa/services/rest/
SISA_USER=tu_usuario_msal
SISA_PASSWORD=tu_clave_msal
```

---

## Validación

- ✅ Backend compiló sin errores (NestJS start:dev)
- ✅ Tabla `patient_audit_log` creada en PostgreSQL con índices
- ✅ Rutas mapeadas: `GET /fhir/r4/Patient/:id/audit` + `GET /api/sisa/verificar`
- ✅ Frontend compiló via Vite HMR
- ✅ Tablero de control actualizado: Módulo 2 al **100%**

---

## Próximo Paso

**→ Inicio del Módulo 3: Historia Clínica y Notas SOAP (FHIR Encounter)**
- Tarea 3.1: Recurso `Encounter` FHIR
- Tarea 3.2: Editor de Nota SOAP
