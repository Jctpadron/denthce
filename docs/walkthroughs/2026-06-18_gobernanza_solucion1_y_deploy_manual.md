# Handoff — Gobernanza Solución 1 ejecutada + deploy a prod desacoplado

> Continuación de `2026-06-16_handoff_gobernanza_y_gating_modulos.md`. Fuente de verdad = el repo.
> Fecha: 2026-06-18. Responsable: Claude (orquestador). Aprobado por Super Admin.

## Estado al iniciar (verificado contra el repo)
- Los cambios que el handoff del 2026-06-16 daba como "sin commitear" YA estaban commiteados: gating (`834db05`), alta laboratorio (`3579402`), handoff (`259aa4a`). Working tree limpio (solo basura sin trackear).
- `local main` estaba 5 commits adelante de `origin/main` (`0df622d`), sin pushear.
- Docker: levantado (api, keycloak, database, frontend-client).

## Qué se hizo (Solución 1 — coordinación forzada por máquina)
1. **`AGENTS.md`**: nueva sección **"Contrato de loop (model-agnostic)"** — loop obligatorio para cualquier agente: tablero → reclamar → branch/worktree → implementar+tests+verificación real → PR (DoD) → CI verde → review (CODEOWNERS) → merge → actualizar docs/ADR. (AGENTS.md ya era model-agnostic; faltaba este loop explícito.)
2. **`.github/pull_request_template.md`**: Definition of Done (español, CI verde, tests, verificación real, responsive, multi-inquilino, sin secretos, migraciones, handoff).
3. **`.github/CODEOWNERS`**: `@Jctpadron` (Super Admin) revisor obligatorio; refuerzo en `/hce-backend/src/auth/`, `/AGENTS.md`, `/.github/`, `/docs/adr/`, VISION.
4. **`.github/workflows/ci.yml`**: ya era sólido (lint+build+test back, build front); se agregó **`npm run lint` en frontend**.
5. **`docs/product/VISION.md`**: visión de producto vendor-neutral (suite modular por suscripción; acceso = rol ∧ módulo; invariantes).
6. **`.github/workflows/deploy.yml` → `workflow_dispatch`** (manual). Ver abajo.

Commits: `12ae094` (gobernanza) + `331eaac` (deploy manual). Pusheados. `origin/main` = **`331eaac`**.

## ⚠️ Hallazgo crítico resuelto: deploy auto a prod
`deploy.yml` se disparaba con `push: branches:[main]` → **cualquier push a main desplegaba a prod** (EB + S3 + CloudFront). Esto habría desplegado el **gating guard** y roto a `protesista_juan` (`tenant_id=None`) en vivo — el riesgo abierto del handoff anterior.
- **Decisión del Super Admin:** desacoplar deploy del merge.
- **Hecho:** `deploy.yml` ahora es `workflow_dispatch` (manual desde Actions). El push del merge solo corre CI.
- Nota: los nombres en `deploy.yml` (`hce-backend`/`HceBackend-env`/`odontocloud-frontend-2026`) **no coinciden** con el prod descrito en handoffs previos (`Odontocloud-env`/`odontocloud`/`app.systia.ar`). Verificar a qué entorno apunta realmente antes de usar el deploy manual.

## Pendiente de Solución 1 (MANUAL en GitHub — no hay `gh` en el entorno)
**Branch protection en `main`** (paso de mayor impacto): GitHub → Settings → Branches → Add rule para `main`:
- Require a pull request before merging (+ require approvals: 1).
- Require review from Code Owners.
- Require status checks to pass: `lint`, `test-backend`, `build-frontend`.
- Do not allow bypassing / include administrators.
- (Opcional) Restringir quién puede pushear.

Verificar que el **CI del push** quedó verde: Actions → CI en `331eaac`.

## Por dónde seguir
- (A) Activar branch protection (manual, arriba) — cierra Solución 1.
- (B) **Test E2E del alta de laboratorio** (Docker arriba): `nest build` + reiniciar backend + alta vía `POST /api/superadmin/labs` con usuario rol `superadmin` en Keycloak local.
- (C) **Rollout a prod del gating** (orden seguro del handoff 2026-06-16 §4): setear `tenant_id` de `protesista_juan`, migración finanzas en RDS, asegurar `tenant_modules`; recién entonces disparar **Deploy manual**.

## Diseño de design-system como spec consumible (pendiente menor)
Sigue solo como skill de Claude (`.claude/skills/design-system/SKILL.md`). Para que otros modelos lo consuman, falta promoverlo a `docs/` vendor-neutral. No bloqueante.
