# Skill: requirements_parser

## Problema que resuelve
Traducir especificaciones funcionales clínicas extensas y no estructuradas en un listado de tareas lógicas, organizadas y cuantificables en base de datos.

## Justificación
Sin una extracción estructurada inicial, los subagentes no tienen una guía clara de qué tareas implementar, lo que genera desorden en el código, dependencias rotas y solapamiento de funciones.

## Riesgo de no crearlo
Inexistencia de un backlog físico dinámico. Los agentes trabajarían a ciegas sin saber qué módulos se encuentran pendientes o cuáles tienen prioridad clínica.

## Entradas
* Documento clínico de especificaciones técnicas y funcionales (`HCE_Analisis_Funcional_Mejorado_2025.txt`).
* Expresiones regulares de captura de secciones y bloques de tareas.

## Salidas
* Archivo base de datos estructurado del backlog (`docs/backlog.json`).

## Permisos
* Lectura: `HCE_Analisis_Funcional_Mejorado_2025.txt`
* Escritura: `docs/backlog.json`

## MCP o herramientas
* `MCP-Planning` (herramientas para crear y actualizar tareas en el backlog).

## Criterio de aprobación
* Generación del JSON válido conteniendo las 49 tareas estructuradas con módulo, prioridad, agentes y campos de auditoría correspondientes.

## Estado
* Aprobado
