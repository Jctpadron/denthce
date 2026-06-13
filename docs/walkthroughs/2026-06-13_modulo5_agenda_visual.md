# Módulo 5 — Agenda visual, recordatorios, triaje y ocupación (cierre 5.2–5.5)

> Orquestador · Fecha: 2026-06-13 · Rama: `feature/modulo-5-agenda`
> Alcance: cierre del Módulo 5 (Agenda, Citas y Admisión). El backend de turnos (5.1) ya existía
> de la integración CliniChat; este bloque construye la **UI de agenda** y completa 5.2/5.3/5.4/5.5
> en su **versión consultorio** (decisión del Super Admin: el producto es un consultorio odontológico
> mono-profesional, no un hospital).

---

## 0. Contexto / por qué

El tablero marcaba el Módulo 5 al 0%, pero el backend de turnos (`appointment/`, `slot/`, `webhook/`)
ya estaba implementado y verificado E2E contra CliniChat. El gap real era de **frontend**: el médico
no podía ver ni gestionar turnos desde la HCE — solo entraban por WhatsApp. Se decidió cerrar las
4 tareas faltantes en versión consultorio.

**Hallazgo de entorno:** las tablas `fhir_appointments` y `appointment_audit_log` **no existían** en
la BD local (el volumen se inicializó antes de que `init.sql` las incluyera, y `DB_SYNCHRONIZE=false`).
Se crearon a mano desde `init.sql`. En cualquier entorno nuevo, `init.sql` ya las crea (con `priority`).

---

## 1. Cambios — Backend (`hce-backend/`)

| Archivo | Cambio |
| :-- | :-- |
| `appointment/appointment.entity.ts` | Nueva columna `priority INT` (nullable) → triaje sala de espera (5.4), mapea a `Appointment.priority` FHIR R4. |
| `appointment/appointment.service.ts` | `changeStatus(id, status, tenant, actor, priority?)` (transición `booked/arrived/fulfilled/noshow`, auditada UPDATE, valida prioridad entera 1-5). `sendReminder(id, tenant)` (dispara webhook REMINDER para turnos activos). `create` y `buildFhir` propagan `priority`. |
| `appointment/appointment.controller.ts` | `PATCH /fhir/r4/Appointment/:id/status` y `POST /fhir/r4/Appointment/:id/reminder` (roles `medico/recepcionista/administrador`; **sin** `servicio-turnos` = mínimo privilegio). |
| `webhook/webhook.service.ts` | `dispatch()` acepta evento `REMINDER` → `event:'reminder'` en el payload firmado HMAC. |
| `scripts/init.sql` | Columna `priority` en `fhir_appointments`. |
| `scripts/migration_appointment_priority.sql` | Migración idempotente (`ADD COLUMN IF NOT EXISTS`) para BD existentes (RDS prod). |

## 2. Cambios — Frontend (`hce-frontend/src/`)

Nuevos componentes en `components/agenda/`:
- **`agenda-utils.ts`** — franjas horarias desde `scheduleJson` del tenant, formateo de fechas, metadatos de estado y prioridad (ESI 1-5), extractores FHIR.
- **`AgendaView.tsx`** — contenedor: navegación de fechas, switch **Día/Semana**, switch **Agenda/Sala de espera**, widget **Estado del box/sillón** (5.5), manejo del modal.
- **`AgendaGrid.tsx`** — grilla horaria día (lista de franjas) y semana (grid 6 días × horas), pinta turnos por estado, huecos libres clickeables.
- **`AppointmentModal.tsx`** — alta (búsqueda de paciente por DNI → POST), y detalle con acciones: marcar llegada (+ triaje), atendido, ausente, cancelar, **enviar recordatorio por WhatsApp** (5.3).
- **`WaitingRoom.tsx`** — sala de espera (5.4): llegados ordenados por urgencia (1 primero) y hora, botón Atender.

Integración: `App.tsx` (vista `agenda` + ítem de nav 📅), `config/dashboard-modules.ts` (módulo `agenda`, roles `medico/recepcionista/administrador`).

## 3. Mapeo de tareas

| Tarea | Estado | Nota |
| :-- | :-- | :-- |
| 5.1 Endpoint `Appointment` FHIR | ✅ (preexistente) | POST/GET/cancel + idempotencia + anti-double-booking + webhooks. |
| 5.2 Calendario visual | ✅ | Vista día/semana, crear/cancelar/cambiar estado sobre el backend. |
| 5.3 Recordatorios | ✅ | **Automáticos/programados los emite CliniChat** (dueño del canal WhatsApp). La HCE dispara recordatorios **manuales puntuales** vía `POST /:id/reminder` → webhook `reminder` firmado. |
| 5.4 Triaje | ✅ (versión consultorio) | Priorización de sala de espera (ESI simplificado 1-5) sobre el turno. **NO** se implementó el algoritmo hospitalario Manchester/ESI de guardia (fuera de alcance del producto). |
| 5.5 Internación / Bed Management | ✅ (versión consultorio) | Estado del box/sillón derivado del turno en atención (mono-profesional = 1 box). **NO** se implementó bed management hospitalario (camas, limpieza, Encounter inpatient). |

## 4. Contrato 5.3 con CliniChat (handoff de integración)

El webhook saliente a CliniChat ahora soporta tres eventos en el mismo payload firmado HMAC-SHA256
(`X-CliniChat-Signature`): `created`, `cancelled` y **`reminder`** (nuevo). CliniChat debe aceptar
`event: "reminder"` y enviar el mensaje de recordatorio al paciente por WhatsApp. URL destino:
`CLINICHAT_WEBHOOK_URL` (prod: `https://hooks.systia.ar/api/public/hooks/sync-appointment`).

## 5. Verificación

- **Tests backend (Jest):** 5 suites / **40 tests** en verde (incluye `appointment.service.spec.ts` nuevo:
  transición de estado, prioridad entera 1-5, recordatorio, aislamiento de tenant).
- **Build:** `nest build` y `vite build` en verde, sin errores TS.
- **Runtime (stack local Docker):** tablas creadas; backend recompilado (hot-reload de volumen no dispara
  en Windows → se reinició el contenedor); rutas nuevas montadas y protegidas:
  `PATCH /:id/status` → 401, `POST /:id/reminder` → 401 sin token (Zero Trust activo).
- **Quality Gate código (`/code-review`):** 1 hallazgo (validación de `priority` no entera → 500 en columna INT)
  corregido con `Number.isInteger` + test.
- **Quality Gate seguridad:** aislamiento por `tenantId` en todas las queries; roles de mínimo privilegio;
  transiciones auditadas (`UPDATE` con actor); `status` validado por allow-list.

### Pendiente de verificación manual (Super Admin)
- **Flujo E2E con token real:** el `KEYCLOAK_ISSUER_URL` del backend apunta a un túnel Cloudflare; el `iss`
  del token debe coincidir. El envío de credenciales al túnel fue bloqueado por el clasificador de seguridad
  durante esta sesión. Verificar manualmente: login como `doctor_julio`, crear turno desde la agenda,
  marcar llegada→atendido, cancelar, enviar recordatorio (requiere `hce_webhook_secret` del tenant configurado).
- **Verificación visual UI** (responsive móvil/desktop, estados vacíos) en el navegador.

## 6. Notas / riesgos
- **Hot-reload Windows:** tras cambios de backend en local, reiniciar `hce-backend-api` (el watcher no
  detecta cambios a través del volumen montado en Windows). Documentado también en walkthroughs previos.
- **Doble agenda transitoria:** CliniChat sigue calculando slots en Supabase; la HCE es el registro
  canónico. No se invirtió aún la autoridad de disponibilidad (sería 5.x futuro).
- **Migración prod:** correr `scripts/migration_appointment_priority.sql` en RDS antes de desplegar.
