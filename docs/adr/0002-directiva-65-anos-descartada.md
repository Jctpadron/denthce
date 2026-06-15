# 0002 — Directiva "operador de 65 años" descartada

**Estado:** Aceptada · **Fecha:** 2026-06-14

## Contexto
En una etapa de testing se diseñó la UX pensando en "un operador de 65 años, intuitivo y amigable". El dueño decidió dejar esa premisa sin efecto.

## Decisión
**No** se diseña ni evalúa la UI con el sesgo "65 años". Se mantiene **accesibilidad WCAG 2.1 AA genérica** y la legibilidad base del design-system (`html{font-size:17px}`, piso de inputs ~13.5px) por buena práctica, no por ese perfil.

## Consecuencias
- Documentos/auditorías no deben repetir "especialmente para operadores de +65 años".
- WCAG AA sigue siendo requisito.
