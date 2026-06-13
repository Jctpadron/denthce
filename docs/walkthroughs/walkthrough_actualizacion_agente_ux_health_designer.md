# Walkthrough: Actualización Agente UX/HCE — Fusión Health UX Designer

**Fecha:** 2026-05-30  
**Solicitado por:** Super Admin  
**Ejecutado por:** Orquestador

---

## Contexto

El Super Admin presentó un prompt externo denominado **"Health UX Designer"** con capacidades avanzadas de metodología UX, sistema de diseño explícito y generación de prompts para la herramienta de imágenes **Nanobanana**.

Se realizó un análisis comparativo entre el prompt nuevo y los tres agentes de diseño existentes (UX/HCE, Android Designer, Producto Clínico) para determinar si reemplazar o fusionar.

---

## Decisión del Orquestador

**Fusión parcial — solo agente UX/HCE actualizado.**

| Agente | Acción |
|---|---|
| `ux.md` | ✅ Actualizado con fusión |
| `android-designer.md` | ✅ Sin cambios — cubre MD3 y Jetpack Compose (irreemplazable) |
| `product.md` | ✅ Sin cambios — cubre criterios clínicos y user stories |

---

## Qué se agregó al agente UX/HCE

### Nuevo en §3 — Filosofía de Diseño
- Regla de los 3 segundos explícita.
- Checklist de preguntas antes de proponer cualquier diseño.

### Nuevo en §4 — Principios de Diseño
- 6 principios formalizados: Claridad, Simplicidad, Consistencia, Accesibilidad, Jerarquía Visual, Eficiencia.

### Nuevo en §5 — Sistema de Diseño
- Tipografía: Inter / SamsungOne / SF Pro con escala de 4 niveles.
- Espaciado: sistema de múltiplos de 8px (8/16/24/32/48).
- Iconografía: criterios de minimalismo.
- Tarjetas: border-radius mínimo 12px, padding mínimo 16px.

### Nuevo en §6 — Evaluación UX Obligatoria
- 6 dimensiones estructuradas: Comprensión, Navegación, Legibilidad, Accesibilidad, Sobrecarga Visual, Conversión.

### Nuevo en §7 — Proceso de Trabajo
- 6 pasos estandarizados: Análisis UX → Aspectos Positivos → Problemas → Propuesta → Wireframe → Justificación.

### Nuevo en §8 — Generación de Pantallas
- Proceso de 6 pasos para diseño de nuevas pantallas desde cero.

### Nuevo en §9 — Generación de Prompts para Nanobanana
- Bloque `nanobanana_prompt` estructurado con 9 campos.
- Nota explícita para el Orquestador: ejecutar `generate_image()` y guardar en `docs/design/mockups/`.

### Actualizado en §10 — Contrato de Comunicación
- JSON de salida ampliado incluyendo `evaluacion_ux` (6 dimensiones evaluadas) y `nanobanana_prompt`.

---

## Qué se conservó

- Integración con el Orquestador vía JSON (input/output).
- Contexto clínico: modo oscuro UCI/radiología, burnout médico, atajos de teclado.
- Mobile-first / WCAG 2.1 AA / áreas táctiles mínimas 48dp.
- Límites de dominio (no escribe código, no accede a Keycloak).

---

## Archivos Modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `docs/agents/ux.md` | MODIFY | Fusión completa con Health UX Designer |

---

## Verificación

- [x] El agente mantiene compatibilidad con el protocolo de comunicación del Orquestador.
- [x] El agente Android Designer y Producto Clínico no fueron afectados.
- [x] El bloque `nanobanana_prompt` está documentado con nota de ejecución para el Orquestador.
- [x] El sistema de diseño es consistente con la referencia Samsung Health.
