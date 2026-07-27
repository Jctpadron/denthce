# Walkthrough / Handoff — 2026-07-21: Gobernanza + Deploy prod (gating) + feature Presupuesto

> Responsable: Claude (orquestador). Sesión larga y densa. Fuente de verdad = el repo.
> Punto de continuidad para la próxima sesión/agente (incluye Codex, que ahora trabaja en paralelo).

## 1. Gobernanza portada de LabFlow → HCE (MERGEADA a `main`)
Rama `feature/gobernanza-y-ops-seguros` → merge `1b0a912` en `main` (pusheado). Solo docs/config.
- **Agente `revisor`** (Quality Gate técnico del diff, reutiliza `/code-review`).
- **Skills nuevas:** `entrevistador-procesos` (Fase 0), `optimizador-prompts`, `verificador-clinico`, `qa-smoke-e2e`.
- **CLAUDE.md:** Fase 0 (elicitación + CHECKPOINT), revisor en tabla+Quality Gates.
- **Docs de ops seguros:** `docs/REGLAS-ESTABILIDAD.md`, `docs/deploy/RUNBOOK-DEPLOY-SEGURO.md`, `docs/PROTOCOLO-CAMBIOS-DB.md` (migraciones: timestamp, aditivo/nullable, idempotente, expand/contract, lock_timeout).
- **Hallazgos rastreados (tablero GOV.5-8):** ver §4.
- **Codex** ya puede re-importar la gobernanza completa desde `main`.

## 2. Deploy a PRODUCCIÓN realizado y verificado
Se desplegó `main` a prod (backend EB `Odontocloud-env` app `odontocloud` + frontend S3 `odontocloud-frontend-2026` + CloudFront `E1UKXKQOWMVBOM`). Nueva versión backend **`prod-20260721-1542`** (rollback: `prod-20260616-180717`, snapshot `hce-pre-deploy-20260721-1533`).
- **Lo que activó:** el **gating enforcement** (`@RequiresModule`) + **alta de laboratorio** (`POST /api/superadmin/labs`) — antes NO estaban en prod (verificado por inspección del bundle desplegado).
- **Smoke OK:** health 200; `/api/superadmin/labs` pasó de 404→401; login funcional `doctor_julio` → `/clinica/finanzas/dashboard` 200 (gating permite).
- **RUNBOOK aplicado:** build → snapshot → deploy version-label → smoke externo vía CloudFront. Nota: A1 (EIP) NO aplica (CloudFront→CNAME).

## 3. Prep del gating en prod (para que el guard no rompa a nadie)
- **B3:** módulo `finanzas-clinicas` ($25) registrado en `platform_modules` + habilitado en `tenant_modules` de `mi_consultorio_dent_hce`.
- **B4-fix:** `tenant_id` en Keycloak → `protesista_juan`+`sergio`=`lab_valle`, `nurse_maria`=`mi_consultorio_dent_hce`.
- **GOV.8:** el alta por admin API no seteaba `tenant_id` (unmanagedAttributePolicy=DISABLED en KC24+) → **resuelto con `ADMIN_EDIT`** (NO ENABLED, que permitiría auto-elevación cross-tenant).

## 4. Tareas GOV abiertas (en el tablero)
- **GOV.5:** `deploy.yml` (CI) desalineado (app `hce-backend`/env `HceBackend-env` vs real `odontocloud`/`Odontocloud-env`). Nunca se usó; deploy real por PowerShell/CLI. Alinear o retirar.
- **GOV.6:** secretos REALES hardcodeados en repo+history (DB pass `*AndreA335*` real, admin Keycloak, client_secret). Detalle en `docs/security/remediacion-secretos-hardcodeados.md`. **Requiere ROTACIÓN** (no solo borrar). Prioridad Alta.
- **GOV.7:** runner de migraciones automático (hoy SQL manual sin `schema_migrations`).
- **GOV.8:** provisioning Keycloak — resuelto (ADMIN_EDIT); pendiente declarar `tenant_id` como atributo gestionado.

## 5. Feature NUEVA: Modal de Presupuesto odontológico (EN RAMA, sin mergear)
Rama `feature/presupuesto-odontologico` (parte de `main` + gobernanza + la feature). Pedido del odontólogo: al armar el **Plan** del odontograma, un modal que digitaliza el formulario PAMI de papel.
- **Diseño:** `docs/design/modal-presupuesto-odontologico.md` (ux) + `docs/design/presupuesto-odontologico-modelo-datos.md` (architect).
- **Backend (commit `0edc606`):** REUSA `clinica_presupuestos`; campos aditivos (item: `codigoNomenclador`/`detalle`/`sourceResourceId`; cabecera: `rxPresentadas`/`obraSocial`/`cantidadCuotas`/`fechaPresentacion`/`fechaLiquidacion`) + migración `hce-backend/src/migrations/20260721_1500_presupuesto_odontologico_campos.sql` (aditiva, idempotente, SIN aplicar).
- **Frontend (commit `4fd3396`):** `PresupuestoOdontologicoModal.tsx` (3 pestañas, auto-carga del plan, responsivo) + botón disparador en `OdontogramPAMI.tsx` (solo en modo Plan). **Quality Gate `revisor`: APROBADO.**
- **Pendiente:** aplicar la migración ANTES de desplegar el backend (riesgo 500 por columna faltante); gates security/qa/ux; push+PR; deploy.

## 6. Coordinación multi-agente (Claude + Codex)
Codex trabaja en paralelo y creó `.agents/`+`.codex/` (untracked flotantes) al importar subagentes/skills. Coordinar por el tablero (responsables) + ramas separadas. Codex corre en sandbox con permisos git distintos (ver REGLAS de LabFlow: `.git/index.lock`).

## Accesos/datos operativos usados (para retomar)
- Clave RDS real: env `DB_PASSWORD` del EB `Odontocloud-env` (`aws elasticbeanstalk describe-configuration-settings`). Diagnóstico DB: script node+pg (RDS `hce-database-3...` alcanzable, db `hce_fhir`).
- Keycloak admin: env `KEYCLOAK_ADMIN_USER`/`_PASSWORD` del EB `Odontocloud-Keycloak-env`. Realm `hce-realm`, client ROPC `hce-app`.
- Superadmin app: `superadmin@systia.ar` (clave reseteada esta sesión). Clínica demo: `doctor_julio`/`doctor_pass_2026`.
