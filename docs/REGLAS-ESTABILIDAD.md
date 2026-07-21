# 🛡️ REGLAS DE ESTABILIDAD — HCE (DentHCE)

> **Estado:** 🚧 **BORRADOR — pendiente de validación del Super Admin** · Fecha: 2026-07-21 · Autor: Claude (orquestador).
> Adaptado del patrón `REGLAS-ESTABILIDAD.md` del proyecto gemelo LabFlow LIS.
>
> **LEER ANTES DE TOCAR PRODUCCIÓN. Vale para todos los agentes (Claude/Gemini/…).**
> Este documento es la **fuente de verdad del estado de producción y las reglas para no romperlo**.
> Cada hecho está marcado como *(✅ verificado en el repo)* o *(⚠️ CONFIRMAR — de memoria/handoff, sin verificar)*.
> **Los ⚠️ CONFIRMAR deben resolverse con el Super Admin antes de considerar este doc VIGENTE.**

---

## ⚖️ Precedencia
Ante CUALQUIER contradicción sobre estado de producción (auth, Keycloak, deploy, caché, DNS, DB), **este documento gana** una vez validado. Otros docs que digan lo contrario están desactualizados: corregilos o ignoralos.

| Documento | Estado | Para qué sirve |
|:--|:--|:--|
| **`docs/REGLAS-ESTABILIDAD.md`** (este) | 🚧 BORRADOR → luego MANDA | Estado real de prod + reglas de oro |
| `AGENTS.md` | ✅ Vigente | Gobernanza y contrato de loop |
| `docs/walkthroughs/2026-06-18_gobernanza_solucion1_y_deploy_manual.md` | ✅ Vigente | Deploy manual + gating (handoff base) |
| `docs/adr/` | ✅ Vigente | Decisiones inmutables |

---

## 0. Estado REAL de producción

| Componente | Realidad | Fuente |
|:--|:--|:--|
| **Deploy** | Desacoplado del merge: `deploy.yml` es **`workflow_dispatch`** (manual). El push a `main` **NO** despliega. | ✅ verificado (`.github/workflows/deploy.yml`) |
| **Deploy real (backend)** | **Manual vía `aws/scripts/deploy-aws.ps1`** → entorno **`Odontocloud-env`** (CloudFront `api.systia.ar` → `odontocloud-env.eba-qis2brnr...`, `us-east-1`). Así se puso y mantiene `app.systia.ar`. ✔️ Funciona. Cuenta AWS `751835847253`; versiones EB en `s3://elasticbeanstalk-us-east-1-751835847253`. | ✅ verificado (`deploy-aws.ps1`, `cf-backend.json`, `manage-env-cost.ps1:10`, walkthroughs de despliegue) |
| **Deploy CI (`deploy.yml`)** | Alternativa nueva (`workflow_dispatch`), **NUNCA usada**. Sus nombres (`HceBackend-env`/`hce-backend`) **no coinciden** con el prod real (`Odontocloud-env`) → **no usar hasta alinear** (tarea **GOV.5**, conocido desde el handoff 2026-06-18). No afecta prod. | ✅ verificado (`deploy.yml:42-43`) |
| **Frontend** | Deploy manual: `aws s3 sync dist/ s3://`**`odontocloud-frontend-2026`**` --delete` + invalidación CloudFront **`E1UKXKQOWMVBOM`**. URL pública: **`app.systia.ar`**. Caché: política separada para `/assets/*` (largo) vs default. `--delete` es correcto acá (borra assets viejos de un build completo del SPA). | ✅ bucket/distribution/mecanismo verificados (`deploy-aws.ps1:86,94,102`, `cf-frontend.json`, walkthrough 2026-06-14); **política HTML no-cache ⚠️ CONFIRMAR** |
| **DB / esquema** | `DB_SYNCHRONIZE=false` → **esquema por SQL MANUAL** (archivos en `scripts/*.sql` + `hce-backend/src/migrations/*.sql`, aplicados a RDS a mano). Backup: `scripts/backup-db.sh`. | ✅ mecanismo verificado (`app.module.ts:85`, `docker-compose.prod.yml:69`, `scripts/`); **identificador/endpoint de la instancia RDS ⚠️ CONFIRMAR** (no consta en repo) |
| **Auth — audiencia** | `aud` esperada = **`hce-backend`** (`KEYCLOAK_AUDIENCE`). | ✅ verificado (`jwt.strategy.ts:17`) |
| **Auth — realm/issuer** | Realm de **prod = `hce-realm`** (issuer `https://auth.systia.ar/realms/hce-realm`). El "Denta Cloud" es el **tema de login**, no el realm. | ✅ verificado (`aws/keycloak/hce-realm.json`, `docker-compose.prod.yml:70`) |
| **Auth — modo estricto** | `AUTH_STRICT` valida `aud` + exige `tenant_id`. En el repo está **efectivamente en `false`**: el `.ebextensions` de EB NO lo setea (→ default desactivado) y `.env.example:20`=`false`. ⚠️ Matiz: la consola de EB puede sobrescribir env vars fuera del repo. | ✅ verificado en repo (`aws/backend/.ebextensions/node-settings.config`, `jwt.strategy.ts:12-14`, `.env.example:20`) |
| **Gating multi-inquilino** | `tenant_modules.enabled=false` corta el acceso al módulo al instante, sin tocar Keycloak. | ✅ verificado (`modules.guard.ts`) |

---

## 1. REGLAS DE ORO (romper esto = caída/incidente en producción)

### 🚀 Deploy
1. **El deploy es MANUAL** (`workflow_dispatch`, gobernanza Solución 1). Commitear/mergear a `main` **NO** despliega. Solo el Super Admin dispara `Actions → Deploy → Run workflow`.
2. **El deploy real es manual por PowerShell** (`aws/scripts/deploy-aws.ps1` → `Odontocloud-env`). **NO usar el CI `deploy.yml`** hasta alinear sus nombres con la infra real (`HceBackend-env`→`Odontocloud-env`, verificar `application_name` en AWS) — tarea **GOV.5**. DNS de prod (CloudFront): `app.systia.ar` (frontend) · `api.systia.ar` → `odontocloud-env` (backend) · `auth.systia.ar` → `odontocloud-keycloak-env` (Keycloak).
3. **Rollout del gating (riesgo abierto):** activar el gating de módulos en prod **puede romper a `protesista_juan` (`tenant_id=None`)**. Orden seguro: setear `tenant_id` de `protesista_juan` → aplicar migración de finanzas en RDS → asegurar `tenant_modules` → recién entonces deploy. *(de memoria/handoff — ⚠️ CONFIRMAR estado actual)*

### 🗄️ Base de datos / migraciones
4. **`DB_SYNCHRONIZE=false` en prod: el esquema NO se autogenera.** Todo cambio de esquema va por **SQL manual** aplicado a RDS. Nunca asumir que TypeORM creará/alterará tablas en producción.
5. Cambios de esquema → seguir `docs/PROTOCOLO-CAMBIOS-DB.md` (a autorear): idempotencia, probar contra copia de datos reales, expand/contract. Una migración mal aplicada puede dejar el backend sin arrancar.

### 🔐 Auth / Keycloak
6. El backend valida `aud=hce-backend` y (con `AUTH_STRICT=true`) exige `tenant_id`. **No cambiar el realm, el mapper de audiencia ni el claim `tenant_id`** sin coordinar: si el token deja de traer `aud`/`tenant_id`, el backend rechaza todo.
7. **⚠️ Confirmar el realm de prod** y el estado real de `AUTH_STRICT` antes de tocar cualquier cosa de identidad. (Mi memoria: tema Keycloak "Denta Cloud" ya aplicado en prod, con riesgo de `OVERWRITE_EXISTING` si se reimporta el realm.)

### 🧊 Caché (Cloudflare / CloudFront)
8. El frontend se sirve detrás de CDN. Tras subir frontend nuevo → **invalidar la distribución** (el `deploy.yml` ya lo hace). Si se sube a mano, invalidar igual, o los navegadores corren el build viejo. *(⚠️ CONFIRMAR distribution ID / política de caché)*

### 🤝 Multi-agente
9. Trabajo en paralelo (Claude + Gemini + …). **Editar archivos compartidos solo si están libres** (tablero, `AGENTS.md`, realm). Migraciones = un agente a la vez, anunciar antes. Contrato de loop en `AGENTS.md`.

---

## 2. Antes de tocar — checklist rápido
- ¿Tocás **deploy**? → es manual; confirmá el entorno EB real; mirá el riesgo del gating (`protesista_juan`).
- ¿Tocás el **esquema**? → SQL manual (`DB_SYNCHRONIZE=false`); seguí `PROTOCOLO-CAMBIOS-DB.md`.
- ¿Tocás **auth/Keycloak**? → no rompas `aud`/`tenant_id`; confirmá realm de prod y `AUTH_STRICT`.
- ¿Tocás el **frontend**? → invalidá el CDN tras subir.

## 3. Cómo resolver una contradicción
Si un doc contradice a éste (una vez VIGENTE) sobre estado de prod, gana éste. Los ⚠️ CONFIRMAR pendientes NO están resueltos: no actuar sobre ellos como si fueran hechos.

---

## Huecos — estado

**✅ RESUELTOS con evidencia del repo (2026-07-21):**
1. **Entorno EB real:** `Odontocloud-env` (deploy real por `deploy-aws.ps1`). El CI `deploy.yml` apunta a `HceBackend-env` (nunca usado) → alinear en **GOV.5** (no es un fallo de prod).
2. **Realm de prod:** `hce-realm` (issuer `https://auth.systia.ar/realms/hce-realm`).
3. **`AUTH_STRICT`:** efectivamente `false` en el repo (matiz: consola de EB puede sobrescribir).
4. **Frontend:** bucket `odontocloud-frontend-2026`, distribution CloudFront `E1UKXKQOWMVBOM`, deploy `s3 sync --delete` + invalidación.
5. **DNS:** `app.systia.ar` (frontend), `api.systia.ar` → `odontocloud-env`, `auth.systia.ar` → `odontocloud-keycloak-env`, todos vía CloudFront (`aws/cloudfront/*.json`).
6. **Migraciones:** SQL manual (`scripts/*.sql` + `hce-backend/src/migrations/*.sql`) sobre RDS; backup `scripts/backup-db.sh`.
7. **Plan de rollout del gating:** documentado en `docs/walkthroughs/2026-06-16_handoff_gobernanza_y_gating_modulos.md` §4 (aplicar `migration_finanzas_clinicas_module.sql`; setear `tenant_id` de `protesista_juan` → `lab_valle`; asegurar `tenant_modules`).

**⚠️ Los 3 datos que faltan (no están en el repo — son secret / estado vivo de AWS):**
- **Política de caché exacta** del frontend (¿HTML `no-cache`?).
- **Identificador/endpoint de la instancia RDS.**
- **Estado de ejecución del rollout del gating:** ¿`protesista_juan` ya tiene `tenant_id` en prod? ¿la migración ya se aplicó en RDS?

> **Tarea GOV.5 (tablero):** alinear o retirar `.github/workflows/deploy.yml` (nombres desalineados con el prod real; nunca se usó, el deploy real es por PowerShell). Documentado ≠ olvidado: se resuelve, no queda parkeado indefinidamente.
