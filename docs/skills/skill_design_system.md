# Skill: design_system

## Problema que resuelve
Las reglas de diseño e identidad estaban dispersas (parte en `code-generator`, parte en el agente `ux`, parte implícita en `index.css`), lo que provocaba estilos inline reinventados, hex hardcodeados, white-label a medias y modo oscuro roto. Centraliza el diseño en una única fuente de verdad.

## Justificación
El proyecto necesita trabajar fuertemente en diseño e identidad (white-label multi-inquilino). Un sistema de diseño canónico garantiza coherencia visual, accesibilidad (WCAG 2.1 AA), responsividad obligatoria y propagación real de la marca del tenant.

## Riesgo de no crearlo
Deuda visual creciente: cada componente reinventa estilos, el color del tenant no se propaga, el modo oscuro queda muerto, y la accesibilidad/responsividad no se auditan de forma consistente.

## Entradas
* `hce-frontend/src/index.css` (tokens y componentes), `src/context/ThemeContext.tsx` (white-label), `src/components/BrandingSettings.tsx` (editor de identidad).
* Specs de UX de `docs/specs/` y diseños de `docs/design/`.

## Salidas
* Catálogo de tokens, inventario de componentes, reglas de white-label e identidad, checklists de accesibilidad y responsividad aplicables por `ux` y `code-generator`.

## Permisos
* Lectura: `hce-frontend/src/`, `docs/design/`, `docs/specs/`.
* Escritura: documentación de diseño; no toca lógica de negocio.

## MCP o herramientas
* Ninguna externa. Se apoya en los built-in `/verify` y `/run` para validación visual real.

## Criterio de aprobación
* UI sin hex hardcodeado nuevo, reutiliza componentes del inventario, respeta white-label (incl. dark mode y primaryColor) y pasa los checklists de accesibilidad y responsividad.

## Estado
* Aprobado (Super Admin, 2026-05-28). Implementada en `.claude/skills/design-system/SKILL.md`.
