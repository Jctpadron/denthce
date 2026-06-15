# 0004 — Identidad visual: tema claro/clínico

**Estado:** Aceptada · **Fecha:** 2026-05-28 (ratificada 2026-06)

## Contexto
Dudas recurrentes sobre si el sistema "debería" tener modo oscuro por defecto.

## Decisión
La identidad oficial es **clara, limpia y clínica** (estilo "Mercado Pago": fondos casi blancos, bordes finos, sombras sutiles). El **modo oscuro NO es deuda**: es **opcional por tenant** (baja prioridad), nunca el default. Fuente de verdad de diseño: skill `design-system` (`.claude/skills/design-system/SKILL.md`).

## Consecuencias
- No "oscurecer" la app por defecto.
- El gap real de white-label es la **propagación del `primaryColor` del tenant** (usar tokens, no hex fijos).
