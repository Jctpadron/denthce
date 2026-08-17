---
name: backlog-sync
description: Sincroniza el estado del proyecto entre el tablero humano (tablero_control.md), la base de datos del backlog (docs/backlog.json) y la ejecución real de los agentes. Recalcula barras de progreso por módulo, registra nuevas tareas escritas en el buzón del tablero y mantiene la auditoría. Úsalo al iniciar/cerrar tareas o cuando el usuario marque checkboxes o agregue funciones en el tablero.
---

# Skill: Sincronización de Backlog (backlog-sync)

Mantiene la consistencia bidireccional entre lo que el humano ve (`tablero_control.md`), los datos (`docs/backlog.json`) y la ejecución de los agentes. Fusiona los antiguos `skill_requirements_parser` y `skill_orchestration_loop`.

## Cuándo usar
- Al **iniciar** un módulo/tarea: leer el backlog para saber qué está pendiente y su prioridad.
- Al **completar** una tarea: marcar `[x]`, recalcular el progreso y registrar auditoría.
- Cuando el usuario **marca un checkbox** o **agrega** una línea `- [ ] Tarea X.Y: ...` en el tablero o en el buzón de propuestas.

## Entradas
- `tablero_control.md` (interfaz humana, checkboxes y porcentajes).
- `docs/backlog.json` (estado de datos + auditoría).
- `HCE_Analisis_Funcional_Mejorado_2025.txt` (fuente para parsear nuevos requerimientos).

## Procedimiento
1. Leer ambos archivos y detectar divergencias (checkbox en MD que no coincide con JSON, o viceversa).
2. Para cada nueva línea de tarea en el tablero o en el "Buzón de Entrada", crear la entrada en `backlog.json` con `task_id`, módulo, prioridad y asignatarios sugeridos.
3. Recalcular Tareas Completadas/Totales y la barra `[██████░░░░] %` por módulo y el PROGRESO GLOBAL.
4. Escribir de vuelta el tablero y el JSON, dejando registro en el campo de auditoría.

## Herramienta existente
El repo ya tiene `scripts/orchestration_runner.py` (servidor HTTP + SSE + sync MD↔JSON). Esta skill puede **invocarlo** o replicar su lógica de parseo. Reutiliza, no dupliques.

## Salida
- `tablero_control.md` con progreso recalculado.
- `docs/backlog.json` sincronizado y auditado.

## Criterio de aprobación
- Porcentajes exactos y checkboxes/tareas sincronizados sin pérdida de datos.

## Idioma
Logs y mensajes en **español**.
