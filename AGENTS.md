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
- **Idioma obligatorio:** Toda la comunicación con el usuario, pensamientos internos (bloques de pensamiento del modelo), procesos, logs y notificaciones de todos los agentes deben realizarse exclusivamente en español.
- **Diseño Responsivo Obligatorio:** Toda interfaz de usuario, vista y componente desarrollado en el frontend debe ser 100% responsivo (mobile-safe), adaptándose dinámicamente mediante CSS flexible (Flexbox, Grid, Media Queries) a pantallas pequeñas, medianas y grandes, evitando roturas de cajas, desbordamientos de texto o inaccesibilidad de botones clínicos.

## Flujo de trabajo de Orquestación y Desarrollo
El Orquestador liderará el desarrollo de cada módulo o requerimiento invocando a los agentes especializados de forma secuencial y estructurada. Ningún cambio de código o configuración se dará por completado sin cumplir con los siguientes pasos y controles de calidad:

1. **Recepción e Ingesta:** El Orquestador recibe el requerimiento funcional del Super Administrador y actualiza el estado en `docs/backlog.json`.
2. **Fase de Diseño Técnico Base:** 
   - Invoca al **Arquitecto** para estructurar la base de datos y endpoints de API.
   - Invoca al agente **FHIR/MCP** para mapear los recursos de salud (HL7 FHIR R4/R5).
   - Invoca a **Seguridad** para definir políticas de acceso (Zero Trust/Keycloak) y auditoría inmutable.
3. **Fase de Definición Funcional y Usabilidad:**
   - Invoca a **Producto Clínico** para definir criterios de aceptación e historias de usuario médicas.
   - Invoca a **UX/HCE** para diseñar la interfaz de usuario, atajos de teclado y flujos de navegación optimizados para mitigar el desgaste médico.
   - Invoca al **Diseñador Android** para adaptar la usabilidad clínica a pantallas táctiles compactas y contextos de uso en movilidad bajo Material Design 3.
   - Invoca a **Integraciones** si el requerimiento interactúa con sistemas externos (LIS, PACS, SISA, etc.).
4. **Fase de Codificación:** El Orquestador consolida los diseños y especificaciones en `docs/design/` y `docs/specs/` y ejecuta el motor de generación de código (skills) para escribir la solución.
5. **Quality Gates (Control de Calidad Obligatorio):**
   - **Auditoría de Seguridad:** El agente de **Seguridad** debe auditar el código generado buscando vulnerabilidades o filtración de datos sensibles.
   - **Pruebas y Verificación:** El agente de **QA/Test** debe escribir y ejecutar pruebas unitarias y de integración automatizadas, validando también que los JSON sean conformes a los esquemas oficiales de HL7 FHIR.
   - **Revisión de Producto y UX:** Los agentes de **Producto** y **UX** deben certificar que el frontend cumple con las especificaciones del diseño funcional.
6. **Consolidación y Entrega:** El Orquestador recopila los reportes de calidad, actualiza el estado de las tareas e historial de auditoría en `docs/backlog.json` y presenta los entregables unificados al **Super Administrador** para su aprobación final e inicio del despliegue mediante el agente **DevOps**.

## Flujo de Creación de Nuevos Skills
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
- Guardar los registros de cambios (walkthroughs) en la carpeta `docs/walkthroughs/` utilizando un nombre de archivo descriptivo en minúsculas y separado por guiones bajos que corresponda al título del mismo (ej. `walkthrough_titulo_descriptivo.md`).
```
