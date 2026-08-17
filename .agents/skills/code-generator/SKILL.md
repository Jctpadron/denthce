---
name: code-generator
description: Genera andamiaje de código consistente para la HCE siguiendo los patrones reales del repo — módulos/controladores/servicios/entidades NestJS 11 + TypeORM en hce-backend/, y componentes React 19 + Vite + TypeScript responsivos en hce-frontend/. Úsalo en la Fase de Codificación, tomando como entrada los diseños de docs/design/ (architect, fhir-mcp) y las specs de docs/specs/ (product, ux).
---

# Skill: Generador de Código (code-generator)

Genera código fuente backend y frontend consistente con los estándares del proyecto, evitando deuda técnica.

## Cuándo usar
En la Fase de Codificación, una vez que existen los diseños técnicos (`docs/design/`) y las especificaciones funcionales/UX (`docs/specs/`).

## Entradas
- Diseños de `docs/design/` (modelo de datos, contratos FHIR, endpoints) — del agente `architect` y `fhir-mcp`.
- Especificaciones de `docs/specs/` (historias de usuario, UI) — de `product` y `ux`.

## Patrones a respetar

### Backend (`hce-backend/`, NestJS 11 + TypeORM)
1. Un módulo por dominio: `xxx.module.ts`, `xxx.controller.ts`, `xxx.service.ts`, `entities/xxx.entity.ts`, `dto/`.
2. Controladores REST compatibles con rutas FHIR (`/fhir/r4/<Recurso>`).
3. Persistencia FHIR en columnas **JSONB** de PostgreSQL.
4. **Multi-inquilino obligatorio:** todo query filtra por tenant; nunca exponer datos de otro inquilino.
5. Autorización con guards JWT (Keycloak, `passport-jwt`). Generar `AuditEvent` en accesos clínicos.
6. Validar entradas con DTOs + `class-validator`.

### Frontend (`hce-frontend/`, React 19 + Vite + TS)
1. Componentes funcionales + hooks; tipado estricto.
2. **100% responsivo (mobile-first)** — Flexbox/Grid/Media Queries, sin roturas ni overflow (regla obligatoria de `AGENTS.md`).
3. Iconos con `lucide-react`; auth con `keycloak-js`; HTTP con `axios`.
4. Paleta: fondo Slate-950, acentos cian/esmeralda.

## Salida
- Código en `hce-backend/src/` y/o `hce-frontend/src/`.

## Criterio de aprobación
- Compila sin errores (`npm run build`) y pasa el linter (`npm run lint`).
- Pasa los Quality Gates de `qa`, `security` y (frontend) `ux`.

## Idioma
Comentarios, mensajes y nombres de cara al usuario en **español**.
