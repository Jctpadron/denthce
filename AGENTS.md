Archivo: `AGENTS.md`

```md
# AGENTS.md

## Objetivo del repositorio
Este repositorio contiene el blueprint operativo de una HCE gobernada por agentes de IA.

## Reglas generales
- El Orquestador tiene prioridad sobre el resto de agentes.
- Ningún agente puede crear o modificar skills sin justificación explícita.
- Toda nueva skill requiere aprobación del Super Admin.
- Toda acción sensible debe quedar auditada.
- No asumir permisos fuera del catálogo.
- Usar Markdown y Mermaid para toda documentación estructural.[2][4][1]

## Flujo de trabajo
1. Leer el contexto del proyecto.
2. Consultar el skill o agente adecuado.
3. Si no existe, elevar propuesta al Orquestador.
4. El Orquestador justifica la necesidad.
5. El Super Admin aprueba o rechaza.
6. Si aprueba, registrar el skill en el catálogo.

## Convención de archivos
- Un archivo por agente.
- Un archivo por skill nuevo.
- Diagramas en `diagrams/`.
- Instrucciones globales en `AGENTS.md`.
```
