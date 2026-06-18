# Handoff — Gobernanza multi-agente + Gating por suscripción + Alta de laboratorio

> Punto de continuidad para retomar en una sesión nueva (sin /compact). Fuente de verdad = este repo.
> Fecha: 2026-06-16. Responsable: Claude (orquestador).

## 1. Decisión de gobernanza (aprobada por el Super Admin)
Con varios agentes de distintos modelos (Gemini, DeepSeek, Qwen, Kimi) sin memoria compartida, la coordinación debe estar **en el repo y forzada por máquina**. Se aprobó ejecutar **Solución 1 ahora → evolucionar a Solución 2 → Solución 3 como norte** (detalle en el chat del 2026-06-16).

**Pendiente de implementar (Solución 1):**
- **Reforzar `.github/workflows/ci.yml`** (YA EXISTE) para que bloquee merge: `npm ci` + build + `jest` + `eslint` (back y front) + chequeo de migraciones. Hay también `deploy.yml`.
- **PR template + Definition of Done** (`.github/pull_request_template.md`).
- **`CODEOWNERS`** (`.github/CODEOWNERS`).
- **Reescribir `AGENTS.md` como contrato MODEL-AGNOSTIC**: loop obligatorio para cualquier agente = leer tablero → reclamar issue → branch/worktree → implementar → PR → CI verde → review → merge → actualizar docs/ADR. La memoria privada de cada modelo NO es estado compartido.
- **`docs/product/VISION.md`**: objetivo del suite modular por suscripción para clínicas + laboratorios.
- **Design-system como spec consumible por cualquier modelo** (tokens + componentes + checklist), no skill de un solo modelo.
- ⚠️ **Branch protection** (prohibir push directo a `main`, exigir PR+CI): se hace **manual en GitHub** (Settings → Branches) — `gh` NO está instalado en el entorno. Es el paso de MAYOR impacto.

## 2. Feature: Gating por suscripción (entitlements) — HECHO en local, verificado, SIN commitear
Principio: **acceso = Rol (Keycloak) ∧ Módulo contratado (`tenant_modules`)**. Apagar la suscripción = flag en BD, sin tocar Keycloak.
- Backend: `hce-backend/src/auth/modules.guard.ts` + `requires-module.decorator.ts` (nuevos). 403 `MODULE_NOT_ENABLED` si no contratado. Aplicado a `protesis.controller` (`@RequiresModule('protesis-lab')`) y `clinica-finanzas.controller` (`finanzas-clinicas`). Import de `PlatformModule` en protesis/finanzas/tenant modules.
- `tenant-config.controller`: `GET /api/tenant/config` ahora devuelve `enabledModules`.
- Frontend: `ThemeContext` expone `enabledModules` + hook `useModules`; gating de tabs Prótesis/Finanzas (`OdontologyHC`) y vista/portal (`App.tsx`) por rol∧módulo; componente `components/ModuleUpsell.tsx` ("Activá X por $Y/mes", variante 'suspended').
- `finanzas-clinicas` registrado como módulo pago ($25) en `scripts/migration_finanzas_clinicas_module.sql` (aplicado a LOCAL).
- **Verificado local**: módulo ON → 200 + tab real; OFF → 403 + Upsell. (scripts en `D:\tmp\gtest.js`.)

## 3. Feature: Alta de laboratorio en 1 acción — implementado en local, FALTA build/test E2E
- Backend: `SuperAdminService.createLab` (espeja `createClinic`: crea tenant_config + habilita `protesis-lab` + crea user Keycloak rol `laboratorio-admin` + `tenant_id`) + endpoint `POST /api/superadmin/labs`. `KeycloakAdminService.createUser` ampliado para roles `laboratorio-operador/admin`.
- Frontend: `CreateLabModal` + botón "Nuevo laboratorio" en `SuperAdminPanel`; `saCreateLab` en `superadmin-api.ts`.
- FALTA: `nest build` + reiniciar backend + probar el alta E2E (necesita un usuario con rol `superadmin` en Keycloak local).

## 4. Rollout a prod del gating (NO hecho — orden seguro obligatorio)
**No desplegar el guard tal cual**: `protesista_juan` en prod tiene `tenant_id = None` → el guard lo bloquearía y rompería el portal en vivo.
1. (a) En prod RDS: aplicar `migration_finanzas_clinicas_module.sql`; setear `tenant_id` de `protesista_juan` (ej. `lab_valle`) en Keycloak prod; asegurar `tenant_modules` de los tenants existentes (mi_consultorio_dent_hce: protesis-lab + finanzas-clinicas + base; lab del protesista: protesis-lab).
2. (b) `nest build` + zip + EB version (`Odontocloud-env`/app `odontocloud`); `aws s3 sync` front + invalidación CloudFront `E1UKXKQOWMVBOM`.
3. Verificar 200/403 + portal lab + upsell.

## 5. Estado git / entorno
- `origin/main` = `0df622d` (verde). **Local `main` = `a637fd2`** (módulo finanzas de Gemini, **sin pushear**) + cambios **sin commitear** (gating + lab + esta doc).
- Recomendado: commits separados → `feat(entitlements): gating` · `feat(superadmin): alta laboratorio` · `chore(governance): ...`. De acá en más, **vía PR** (cuando esté branch protection).
- Prod: `app.systia.ar`/`api.systia.ar`; RDS `hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com` (user `hce_admin`); ya migradas tablas de finanzas clínicas y de prótesis. `docker restart hce-backend-api` tras editar back; frontend con `usePolling`.
- Otros hallazgos abiertos: logo roto en prod (URL `http://localhost:3000/...` hardcodeada en `tenant-config.controller`), protesis C3 (inyección de tenant en órdenes manuales) y C4 (gating) — C4 se resuelve con este feature.

## 6. Bugs de prótesis ya resueltos (no rehacer)
- C2 (estados): superado por la máquina de estados de Gemini (`VALID_TRANSITIONS`). A1 (`req.user.sub` en `jwt.strategy`) corregido. B5 (stock<0) corregido. Suite de prótesis reparada (mocks de repos nuevos) → 162 tests verdes en local.
