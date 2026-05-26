# Skill: orchestration_loop

## Problema que resuelve
Mantener la consistencia entre el estado del proyecto en el tablero interactivo del usuario (`tablero_control.md`), la base de datos del backlog (`backlog.json`) y la ejecución física de las tareas por los agentes de IA en el repositorio.

## Justificación
Permite que el desarrollo sea ágil y bidireccional. Si el usuario marca una tarea en el Markdown del editor, el script actualiza el JSON. Si un agente de IA escribe código y lo completa, el script actualiza la base de datos y dibuja la barra de progreso en el Markdown. Garantiza la sincronía.

## Riesgo de no crearlo
Descoordinación entre lo que el desarrollador humano ve en su editor y lo que la IA procesa. Pérdida del control de porcentaje de avance en el tablero.

## Entradas
* Archivo `tablero_control.md` (interfaz humana).
* Archivo `docs/backlog.json` (interfaz de datos).
* Solicitudes HTTP de la interfaz web `/api/action`.

## Salidas
* Tablero `tablero_control.md` actualizado con barras de progreso recalculadas.
* Backlog `docs/backlog.json` con estados y auditorías sincronizadas.
* Stream de logs SSE enviado al navegador.

## Permisos
* Lectura y Escritura: `tablero_control.md`, `docs/backlog.json`.

## MCP o herramientas
* `MCP-Planning` (sincronizador de backlog).

## Criterio de aprobación
* Recalculo exacto del progreso del proyecto y sincronización instantánea de marcas de checkboxes y nuevas tareas entre el archivo Markdown y el JSON.

## Estado
* Aprobado
