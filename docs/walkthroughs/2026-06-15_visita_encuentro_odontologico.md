# 2026-06-15 — Ciclo de vida de la VISITA / ENCUENTRO odontológico

> Feature: cerrar el hueco "el paciente se atiende y se va, pero el sistema nunca cierra la visita". Ahora una visita se **abre**, agrupa las prestaciones de la sesión, y se **finaliza+firma** (inmutable). Implementado por etapas y verificado. Diseño: `docs/design/encuentro-odontologico-modelo.md` (architect), `docs/design/encuentro-odontologico-fhir.md` (fhir-mcp), `docs/specs/visita-odontologica-historias.md` (product).

## Decisión de arquitectura
**Tabla propia** `odontology_encounters` (NO se reusa `fhir_encounters` de la HC SOAP) → mantiene el módulo odontológico aislado. Aprobado por Super Admin junto con: apertura explícita (botón) y SNOMED `53110001` (consulta odontológica) / `9482002` (servicio odontológico).

## Qué se implementó (backend)
- **Entidades:** `odontology-encounter.entity.ts` (tabla `odontology_encounters`), `odontology-encounter-audit.entity.ts` (tabla `odontology_encounter_audit_log`), + columna `encounter_id` en `odontology_clinical_resources`. Migración: `src/migrations/odontology_encounters_migration.sql` (no destructiva; índice único parcial `uq_odo_enc_active_per_patient` para "1 visita activa por paciente"). Entidades registradas en `app.module.ts` (entities) y `odontology.module.ts`.
- **Servicio** `odontology-encounter.service.ts`: `open` (idempotente), `getActive`, `list` (+ conteo legacy), `getOne` (con prestaciones), `sign` (finished + hash SHA-256 + firma + turno→fulfilled), `cancel` (desvincula prestaciones a legacy), `addAddenda` (append-only), `getAuditHistory`. Auditoría inmutable (`odontology-encounter-audit.service.ts`) en OPEN/SIGN/CANCEL/ADDENDA.
- **Controller** `odontology-encounter.controller.ts`: `/odontology/patient/:patientId/encounter` (POST abrir, GET active, GET list, GET :id, POST :id/sign, POST :id/cancel, POST :id/addenda, GET :id/audit). Guards JWT + Roles (firma solo médico/admin).
- **Inmutabilidad transversal:** `OdontologyService.assertResourceMutable(encounterId, tenantId)` bloquea `saveResource`/`completeResource`/`deleteResource` si la prestación pertenece a una visita `finished`. `saveResource` acepta `encounterId` opcional → asocia la prestación + `performedDateTime`.

## Qué se implementó (frontend)
- `OdontoVisitContext.ts`: provee el `activeEncounterId` a los componentes que registran.
- `OdontologyHC.tsx`: barra de visita (estado activo + "Iniciar visita" / "Finalizar y firmar" con confirmación), fetch de visita activa al seleccionar paciente, provider.
- Los 5 componentes que guardan (`OdontogramPAMI`, `OralStatusPAMI`, `EvolutionPAMI`, `AnamnesisPAMI`, `ConsentForm`) envían `encounterId` de la visita activa.
- `EvolutionPAMI`: panel "Visitas del paciente" (episodios con fecha/estado/prestaciones/firma) + "Registros previos (sin visita)" para legacy.

## Verificación
- **Backend E2E (curl + token real):** active→null, abrir, idempotencia, prestación asociada, obtener, **firmar** (hash+end+fulfilled), **inmutabilidad 403**, re-firma 400, addenda, listado con legacy, **auditoría** (OPEN+SIGN registrados). ✓
- **UI E2E (puppeteer):** barra Iniciar→En curso→Finalizar (firma), panel de visitas, confirm dialog. ✓
- **QA (Jest):** 59 tests verdes (`odontology-encounter.service.spec.ts` 29, `odontology.service.spec.ts` 24, `odontology.controller.spec.ts`). Cubre las 7 invariantes (idempotencia, Zero Trust, firma/hash, fulfilled, cancel, addenda, inmutabilidad transversal).
- **Security gate:** resueltos H1 (auditoría inmutable — era bloqueante), H2 (`assertResourceMutable` filtra tenant), H3 (hash con `startDate` ISO normalizado, reproducible). `tsc` limpio.

## Datos legacy
Los registros previos (sin visita) quedan con `encounter_id = NULL` = "Registros previos (sin visita)". No se inventaron visitas retroactivas (evita falsear fechas/firmas).

## Pendiente / backlog (hallazgos de security no bloqueantes)
- **H3 (recomendado):** endpoint/`GET :id/verify` que recompute el hash y exponga `integridadOk` (hoy el hash ya es reproducible, falta el verificador).
- **H4/H5 (Medio, confirmar con product):** ¿enfermería puede abrir visita? ¿recepción debe ver `reasonText` en el listado?
- **H6 (Medio):** `deleteResource` de ePHI legacy (sin visita) no audita (gap PREEXISTENTE en deleteResource, no introducido por este feature); evaluar soft-delete / `entered-in-error`.
- **H7–H10 (Bajo):** discriminar error de unicidad por código `23505` en `open`; doble escritura save+update sin transacción; el PDF expone `err.message`; dependencia de extensión `uuid-ossp`.
- **Auto-cierre** de visitas olvidadas abiertas (fuera de alcance v1 según product).

## Gotchas de entorno
- Backend en Docker `hce-backend-api`, `DB_SYNCHRONIZE=false` → el esquema se crea por **SQL manual**: `docker exec -i hce-database psql -U hce_admin -d postgres < src/migrations/<archivo>.sql`. Tras editar entidades hay que **reiniciar** el contenedor (`docker restart hce-backend-api`).
- Frontend en Docker `hce-frontend-client` con `usePolling` (HMR ya funciona).
- Errores tsc preexistentes en `src/protesis/protesis.service.spec.ts` (otro agente) — ajenos a este feature.
