# Walkthrough — Tarea 3.12: Dashboard dinámico por rol Keycloak

**Fecha:** 2026-05-28 · **Orquestador:** Claude Code · **Agentes:** product, ux, architect · **Módulo:** 3 (Historia Clínica)

## Objetivo
Rediseñar el HomeScreen para mostrar **widgets y accesos directos según el rol** del usuario leído del token Keycloak, e incorporar el widget de **recetas pendientes de firma**.

## Orquestación
Fase de Diseño con tres agentes en paralelo (`product`, `ux`, `architect`), cada uno con su persona. Hallazgos clave convergentes:
- La taxonomía de roles del realm y del frontend **ya coinciden**: `medico, enfermero, recepcionista, administrador, paciente`. (El "bloqueante" inicial fue un error del brief del Orquestador, no del código.)
- `ThemeContext` ya leía `realm_access.roles`, pero la lógica de roles estaba **duplicada y acoplada** al theming.
- El widget de recetas requería un **endpoint agregado** inexistente (solo había listado por paciente).
- Modo oscuro y `:focus-visible` estaban ausentes/rotos (mejoras señaladas).

## Cambios implementados

### Backend (NestJS)
- `medication-request.service.ts` — nuevo método `findPendingDrafts(tenantId)`: lista borradores (`status='draft'`) del consultorio, enriquecido con nombre de paciente (`In()`), aislado por `tenantId`.
- `medication-request-summary.controller.ts` (nuevo) — `GET /fhir/r4/MedicationRequest?status=draft`, `@Roles('medico')`.
- `medication-request.module.ts` — registra `PatientEntity` y el nuevo controlador.

### Frontend (React)
- `utils/roles.ts` (nuevo) — taxonomía `ROLES`/`AppRole`, `getRolesFromToken`, `hasAnyRole`, `roleDisplayName`. Punto único de lectura de roles.
- `hooks/useRoles.ts` (nuevo) — hook reactivo a refresh de token; expone `roles`, `has()`, `isMedico`, `canConfigure`, etc.
- `config/dashboard-modules.ts` (nuevo) — catálogo declarativo rol→módulo + `getVisibleModules(roles)`.
- `components/HomeScreen.tsx` — rediseño en 4 zonas (Hero / Widgets por rol / Accesos a módulos / Footer). Widget W3 (recetas pendientes, médico) y W5 (checklist de configuración, médico/admin). Estilos dark-safe (variables CSS en vez de `#ffffff`), grids `minmax(min(100%, X), 1fr)`, padding/typografía fluidos.
- `App.tsx` — consume `useRoles()` (fuente única); chips de rol vía `roleDisplayName`.
- `context/ThemeContext.tsx` — se retiran `isAdmin`/`canConfigure` (movidos a `useRoles`, sin duplicar).
- `index.css` — `:focus-visible` accesible y `prefers-reduced-motion`.

## Quality Gates
- ✅ Build backend (`nest build`).
- ✅ Build frontend (`tsc -b && vite build`) — sin errores de tipos.
- ✅ Lint limpio en los archivos tocados (la deuda de lint preexistente en otros archivos queda fuera de alcance).
- ✅ Seguridad: endpoint con `@Roles('medico')` + aislamiento por `tenantId`. El ocultamiento por rol en frontend es solo UX; la autorización real la impone el backend.
- ⚠️ No se ejecutó el suite e2e de Jest (requiere DB/Keycloak en ejecución).

## Pendientes / futuro
- Widget de Agenda: deshabilitado hasta construir Módulo 5 (0%).
- Wiring completo de modo oscuro (`data-theme`) — señalado por UX, fuera del alcance de 3.12.
- Migración total de estilos inline → clases CSS (incremental).
