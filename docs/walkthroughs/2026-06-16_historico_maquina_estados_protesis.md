# 2026-06-16 — Histórico de trabajos y máquina de estados del módulo DentaLab/Prótesis

> Feature: agregar trazabilidad de cambios de estado (quién, cuándo, desde/hacia) y vista de trabajos completados (históricos) en el módulo de protesistas. Implementado en 4 fases y verificado.

## Qué se implementó

### Fase 1 — Modelo de datos (Backend)
- **Entidad:** `protesis-status-history.entity.ts` (tabla `protesis_status_history`) con columnas: `id`, `order_id` (FK→protesis_orders), `from_status`, `to_status`, `changed_by`, `changed_by_name`, `actor_type` (clinica|laboratorio), `reason`, `created_at`.
- **Migración SQL:** nuevo CREATE TABLE + índice en `scripts/create_protesis_tables.sql`.
- **Relación:** `ProtesisOrder.statusHistory` OneToMany con cascade delete.
- **Registro:** `ProtesisStatusHistory` en `TypeOrm.forFeature` del módulo.

### Fase 2 — Máquina de estados formal
- **Transiciones válidas:** `received→designing|cancelled`, `designing→processing|cancelled`, `processing→ceramic|cancelled`, `ceramic→ready|cancelled`, `ready→delivered|cancelled`. `delivered`/`cancelled` son terminales.
- `updateStatus` ahora valita la transición contra `VALID_TRANSITIONS`, rechaza cambios a estados terminales, y audita automáticamente en `status_history`.
- `signConformidad` también audita la transición `*→ready` al firmar.
- Controller pasa `userSub`, `userName` y `reason` opcional desde el token Keycloak.

### Fase 3 — Endpoints nuevos
- `GET /protesis/history` — lista órdenes en estado `delivered` o `cancelled`, filtrado por tenant (laboratorio o clínica).
- `GET /protesis/:id/history` — timeline completo de cambios de estado de una orden específica (ordenado ASC por fecha).

### Fase 4 — Frontend React
- **DentaLabPortal.tsx:** nueva pestaña "📜 Históricos" con:
  - Lista de trabajos completados agrupables por mes (filtro)
  - Timeline visual con burbujas de color por estado, quién cambió, fecha y actor
- **ProtesisTab.tsx:** separación visual entre "Trabajos en Curso" e "Histórico" con secciones y badges de estado.

## Archivos modificados/creados

| Archivo | Cambio |
|---|---|
| `hce-backend/src/protesis/protesis-status-history.entity.ts` | **CREATE** — Nueva entidad |
| `hce-backend/src/protesis/protesis.service.ts` | **MODIFY** — Máquina de estados, auditoría, endpoints history |
| `hce-backend/src/protesis/protesis.controller.ts` | **MODIFY** — Endpoints history + user info en status |
| `hce-backend/src/protesis/protesis-order.entity.ts` | **MODIFY** — Relación OneToMany statusHistory |
| `hce-backend/src/protesis/protesis.module.ts` | **MODIFY** — Registro ProtesisStatusHistory |
| `hce-backend/src/protesis/protesis.controller.spec.ts` | **MODIFY** — Test actualizado a nueva firma |
| `scripts/create_protesis_tables.sql` | **MODIFY** — Tabla + índice status_history |
| `hce-frontend/src/components/protesis/DentaLabPortal.tsx` | **MODIFY** — Pestaña Históricos + timeline |
| `hce-frontend/src/components/odontology/ProtesisTab.tsx` | **MODIFY** — Separación activos/históricos |

## Verificación
- `tsc --noEmit` en backend: solo errores preexistentes en `protesis.service.spec.ts` (3 errores de null check, documentados en walkthrough previo como ajenos a este feature).
- `tsc --noEmit` en frontend: 0 errores.
- Rutas nuevas no entran en conflicto con rutas existentes (`GET history` definido antes que `GET :id`).
