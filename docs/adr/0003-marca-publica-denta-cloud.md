# 0003 — Marca pública del producto = "Denta Cloud"

**Estado:** Aceptada · **Fecha:** 2026-06-14

## Contexto
Convivían tres nombres: "Denta Cloud" (código de la landing), "DentHCE" (design-system/docs internos) y "Systia" (dominio systia.ar).

## Decisión
La **marca de cara al cliente es "Denta Cloud"** (subtítulo "Odontología Digital"). Paleta: **azul `#1e6fd9` + menta `#2aa57c`**. Internamente el producto puede seguir nombrándose DentHCE en docs históricos; los dominios siguen en `systia.ar`.

## Consecuencias
- Landing pública, tema de login Keycloak y fallbacks de marca usan "Denta Cloud".
- El acento de UI sale de tokens (`var(--color-primary)`), respetando el white-label por tenant.
