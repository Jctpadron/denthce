<!--
  Plantilla de PR — DentHCE (gobernanza multi-agente).
  Cualquier agente (Claude, Gemini, DeepSeek, Qwen, Kimi…) o persona DEBE completarla.
  Fuente de verdad = el repo (AGENTS.md). La memoria privada de un modelo NO cuenta como contexto compartido.
-->

## Qué cambia y por qué
<!-- Resumen en español. Enlazá la tarea del tablero / issue / ADR que lo motiva. -->

- Tarea / issue del tablero:
- ADR relacionado (si aplica):
- Responsable declarado en `tablero_control.md`:

## Tipo de cambio
- [ ] Feature
- [ ] Fix
- [ ] Refactor / chore
- [ ] Docs / gobernanza

## Definition of Done (obligatorio — marcar todo)
- [ ] **Idioma:** todo el cambio, comentarios y descripción están en **español**.
- [ ] **CI verde:** `lint` + `build` + `jest` (back) y `build` + `lint` (front) pasan.
- [ ] **Tests:** se agregaron/actualizaron tests para lo que se construyó (no solo "compila").
- [ ] **Verificación real:** se probó en runtime/endpoint, no solo build. Pegar evidencia abajo.
- [ ] **Responsive:** si toca UI, es 100% mobile-safe (sin overflow ni roturas).
- [ ] **Multi-inquilino:** todo dato nuevo se filtra por tenant (Zero Trust).
- [ ] **Seguridad:** acciones sensibles auditadas; sin secretos/credenciales hardcodeadas en el diff.
- [ ] **Migraciones:** si hay cambios de esquema, incluye SQL/migración y nota de aplicación (LOCAL/PROD).
- [ ] **Handoff:** walkthrough en `docs/walkthroughs/` + tablero/backlog actualizados + diseños superados marcados.

## Evidencia de verificación
<!-- Output de tests, capturas, respuestas de endpoint (200/403), etc. -->

## Riesgos / rollout
<!-- ¿Toca prod? ¿Hay un orden seguro? (ej. setear tenant_id antes de activar un guard). -->
