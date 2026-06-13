# Super Admin y Servicios Anexables (Fases 1-5 + 4A) — Walkthrough

> Orquestador · Fecha: 2026-06-13 · Rama: `feature/superadmin-servicios`
> Diseño completo: `docs/design/superadmin-servicios-anexables.md`. Handoff CliniChat: `docs/integraciones/HANDOFF-CLINICHAT-orquestacion-hce.md`.

## 0. Contexto / por qué
El HCE es el **producto base**; los demás productos (CliniChat/WhatsApp, etc.) son **servicios que se anexan a una clínica solo si la contrató**. Antes NO existía: modelo de suscripción, panel de Super Admin, ni control de "qué pagó cada clínica". El módulo WhatsApp se activaba a mano en dos bases de datos. Este bloque construye el Super Admin que gestiona clínicas y módulos desde un punto único.

Se investigó a fondo el Super Admin ya existente de **CliniChat** ("VoxMed SaaS") y el ciclo de vida del servicio WhatsApp (ver memorias `hce-modulo...`, `hce-ciclo-vida-servicio-whatsapp`). Decisiones tomadas: tablas normalizadas de entitlements, HCE orquesta, service-account automatizado, estética DentHCE.

## 1. Qué se construyó (por fase)

| Fase | Entregable | Commit |
| :-- | :-- | :-- |
| **1** | Modelo de datos: `platform_modules` (catálogo) + `tenant_modules` (entitlements con `expires_at`) + `tenant_config.plan`/`is_active`. Rol `superadmin` + `SuperAdminGuard`. | `01b04f0` |
| **2** | `ModulesService.isEnabled()` + **gate del módulo WhatsApp** en `sendReminder` (403 si no contratado) y en los webhooks `create`/`cancel`. Cierra el GAP de producto modular. | `e9f3492` |
| **3** | API Super Admin cross-tenant: `GET /metrics`/`/modules`/`/clinics`, `POST /clinics` (provisión), `PATCH /clinics/:id/modules`. | `15f9e9a` |
| **5** | Panel React (rol superadmin): Resumen + Clínicas + toggles de módulos + alta de clínica. Estética DentHCE alineada a mockups nano banana. | `f2c5bed`, `2fce632` |
| **4A** | Generación del service-account de Keycloak por clínica (`createClinicServiceAccount`): client confidential + rol `servicio-turnos` (mínimo privilegio) + mapper `tenant_id`. | `dfe25c2` |

**Backend:** `src/platform/` (entidades + `ModulesService`), `src/superadmin/` (service + controller + module), `src/auth/superadmin.guard.ts`, `KeycloakAdminService.createClinicServiceAccount`. **Frontend:** `src/components/superadmin/`. **SQL:** `scripts/migration_superadmin_modules.sql` + `init.sql`. **Realms:** roles `superadmin` + `servicio-turnos`.

## 2. Lo que queda — Fase 4B (bloqueada por CliniChat)
La orquestación HCE→CliniChat (el "botón mágico" que entrega las credenciales y enciende la integración) **depende de un endpoint nuevo en el repo `clinichat-assistant`**. El contrato completo está en `docs/integraciones/HANDOFF-CLINICHAT-orquestacion-hce.md`. Mientras tanto, el anexado del lado HCE funciona (gate + service-account); el lado CliniChat se configura con el runbook manual.

## 3. Verificación (Fase 6)
- **Tests:** 64 Jest en verde (8 suites). Incluye `modules.service.spec`, `superadmin.service.spec`, `superadmin.guard.spec`, gates en `appointment.service.spec`.
- **Testing exhaustivo de BD (Fase 1):** integridad (PK compuesta, FK, defaults), lógica de entitlements (incl. vencimiento), idempotencia de migración, **estrés 8.000 entitlements** (query `isEnabled` 0.075ms por índice). Script: `testing/scripts/test_superadmin_modules.sql`.
- **Prueba de oro del service-account (Fase 4A) contra Keycloak local real:** se generó un client `clinichat-{tenant}`, se obtuvo un token `client_credentials` y se verificó que trae **`tenant_id` correcto** y **solo el rol `servicio-turnos`** (mínimo privilegio confirmado). Cleanup OK.
- **Quality Gate de seguridad:** `SuperAdminGuard` a nivel de controller cubre los 6 endpoints; el `client_secret` no se loguea; el aislamiento por tenant del resto del sistema queda intacto; `setModule` bloquea dar de baja módulos base.
- **Rutas:** todas montadas y protegidas (401 sin token).

### Pendiente de verificación visual (no bloqueante)
El flujo del **panel con un token de superadmin real** (login → ver panel → crear clínica → anexar WhatsApp en vivo) no se verificó e2e porque el issuer del backend local apunta a `auth.systia.ar` (producción) y el Keycloak local firma con otras llaves — misma limitación que el Módulo 5. Para probarlo: (a) alinear temporalmente el issuer a `localhost:8080` + crear un usuario `superadmin` local, o (b) tras desplegar el Super Admin a producción, crear el usuario superadmin en `auth.systia.ar`.

## 4. Notas de despliegue (cuando se despliegue)
- Aplicar `scripts/migration_superadmin_modules.sql` en la RDS de producción.
- Reimportar/actualizar el realm Keycloak para que existan los roles `superadmin` y `servicio-turnos` (o crearlos vía Admin API, como se hizo en local).
- Crear el usuario `superadmin` de plataforma en Keycloak.
- Desplegar backend (nuevo módulo superadmin) + frontend (panel).
