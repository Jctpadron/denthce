# Walkthrough — Port de gobernanza LabFlow→HCE (Tier 1)

> Fecha: 2026-07-21 · Responsable: Claude (orquestador) · Aprobado por: Super Admin.
> Rama: `feature/gobernanza-labflow-port` · Fuente de verdad = el repo.

## Contexto

Se analizó el proyecto gemelo **LabFlow LIS** (`D:\APP-jct\--old--app-systemas-laboratorios\app-systemas-laboratorios`), un LIS en producción de la misma suite Systia, cuya **gobernanza multi-agente es más madura** que la de la HCE. Objetivo: portar los conceptos para que ambos productos sean "idénticos en conceptos", **sin degradar** lo que la HCE ya tiene mejor.

**Hallazgo base:** los agentes de la HCE ya son MÁS ricos que los de LabFlow (no se tocan). El gap real es de **proceso**: falta un revisor, disciplina de elicitación, y (Tier 2/3) skills nuevas + `REGLAS-ESTABILIDAD.md` + secciones de `AGENTS.md`.

El análisis se hizo **punto por punto** sobre 7 efectos colaterales, en 3 tiers. Este walkthrough cubre el **Tier 1** (bajo riesgo, solo config de Claude + playbook; sin tocar código de app, prod, DB ni `AGENTS.md` compartido).

## Qué se hizo (Tier 1)

### Punto 1 — Entrevista como Fase 0 de la orquestación
- **Nuevo:** `.claude/skills/entrevistador-procesos/SKILL.md` — adaptada al dominio HCE (flujo clínico, FHIR R4, roles Keycloak, multi-inquilino, responsive), con **regla de proporción** (se activa en pedidos nuevos/ambiguos/sensibles; se saltea en tareas ya especificadas o triviales) y emparejada con un **CHECKPOINT** (devolver qué entendí + archivos/subagentes + riesgos, y esperar OK antes de codear).
- **Editado `CLAUDE.md`:** agregada a la lista de skills + antepuesta como **"Fase 0: Elicitación"** en el flujo de orquestación.
- **Justificación + aprobación del Super Admin: OTORGADA** (cumple el protocolo de creación de skills de `AGENTS.md`).

### Punto 2 — Orchestrator como subagente (DESCARTADO)
- **No se agregó.** En Claude Code la sesión principal ES el orquestador (no se convoca a sí misma). El rol ya vive vendor-neutral en `docs/agents/orchestrator.md`. Agregarlo a `.claude/agents/` solo crearía recursión/duplicación y no ayudaría al multi-proveedor (Gemini no lee `.claude/`).

### Punto 3 — Agente Revisor (Quality Gate técnico)
- **Nuevo:** `.claude/agents/revisor.md` (subagente Claude, `tools: Read, Grep, Glob, Bash`; revisa y corre tests/build, no edita producción) + `docs/agents/revisor.md` (spec vendor-neutral, para que Gemini también pueda actuar de revisor).
- **Editado `CLAUDE.md`:** `revisor` en la tabla de subagentes; **cableado corregido** `/code-review` → *"apoya al revisor"* (antes "a qa", que era conceptualmente incorrecto); sumado a los Quality Gates.
- **División limpia:** `qa` (comportamiento/FHIR/tenant) · `revisor` (calidad del diff/alcance/root-cause vía `/code-review`) · `security` (ePHI vía `/security-review`).

## Verificación

- Skill `entrevistador-procesos`: hot-reloadeada por el harness (aparece como disponible).
- Agente `revisor`: convocable como `subagent_type` a partir de la próxima sesión (los agentes cargan al iniciar).
- Sin fuga de dominio: las menciones a "LIS/LabFlow" en la skill son ejemplos válidos del **propio** Módulo 6 de la HCE (Integración LIS/PACS), no contaminación.
- CI no toca `.claude/` ni `docs/` → queda verde.

## Pendientes / follow-ups

- **Dato stale (registrado en tablero):** `CLAUDE.md` "Documentos clave" dice "61% global" pero el tablero real = **76%**. No se corrigió acá para respetar el alcance quirúrgico (anti-drive-by); va como tarea aparte.
- **Tier 3:** llevar el principio **CHECKPOINT** a `AGENTS.md` (para atar también a Gemini) + evaluar espejos `.agents/`/`.codex/` para simetría multi-proveedor.
- **Tier 2/3 (siguiente):** portar/adaptar `verificador-clinico`, `security-audit`, `testing-and-validation`, `qa-carga-admision`, `optimizador-prompts`; autorear `docs/REGLAS-ESTABILIDAD.md` y `docs/PROTOCOLO-CAMBIOS-DB.md` con hechos reales de la HCE.

## Reversibilidad

Todo es config del harness + playbook. Revertir = borrar los 3 archivos nuevos + revertir los edits de `CLAUDE.md`. Sin migración, sin estado, sin impacto en prod.
