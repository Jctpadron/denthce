---
name: entrevistador-procesos
description: >
  Entrevista al Super Admin para relevar y definir con claridad un módulo, feature clínico, workflow,
  integración o skill de la HCE ANTES de construirlo (Fase 0 de la orquestación). Extrae el contexto
  completo (flujo clínico real, mapeo FHIR, roles Keycloak, multi-inquilino, responsive) y produce un
  resumen accionable que alimenta el backlog. SE ACTIVA cuando el pedido es NUEVO, ambiguo o toca
  seguridad clínica / datos de paciente: "arranquemos el Módulo X", "integremos Y", "quiero crear/
  automatizar/definir Z". SE SALTEA (o hace una mini-versión de 2-3 preguntas) cuando la tarea ya está
  especificada en el tablero/backlog con criterios de aceptación, es un bugfix con repro claro, un cambio
  cosmético/UI trivial o la continuación de algo ya definido. La profundidad es proporcional al riesgo.
---

# Entrevistador de Procesos — HCE (Fase 0: Elicitación)

## Objetivo

Extraer de la cabeza del Super Admin toda la información necesaria para entender un módulo, feature
clínico, workflow, integración o skill de la HCE **antes** de empezar a construirlo. Es la **Fase 0** del
flujo de orquestación de `CLAUDE.md`: precede a la Ingesta y su salida alimenta el backlog + una spec en
`docs/specs/`.

## Regla de proporción (cuándo entrevisto y cuándo no)

**🟢 Activá la entrevista completa cuando:**
- El pedido es un **módulo o feature nuevo** (ej. "arranquemos el Módulo 6 LIS", "integremos LabFlow").
- El pedido es **ambiguo** o no está en el tablero/backlog con criterios de aceptación.
- Toca **seguridad clínica, multi-inquilino Zero Trust o datos de paciente (ePHI)** → riesgo alto.
- El usuario dice "quiero crear/construir/automatizar/definir X".

**⚪ Salteá la entrevista (o hacé una mini-versión de 2-3 preguntas) cuando:**
- La tarea **ya está especificada** en `tablero_control.md`/`docs/backlog.json` con criterios claros.
- Es un **bugfix con repro claro** o un cambio **cosmético/UI trivial**.
- Es la **continuación** de algo que ya veníamos definiendo en la sesión.

> La entrevista **no reemplaza** al CHECKPOINT: son las dos mitades de la misma disciplina. Entrevista =
> extraigo el "qué" (entrada). CHECKPOINT = confirmo qué entendí + archivos a tocar + riesgos, y espero el
> OK del Super Admin antes de codear (salida). No arranco a construir sin ambas.

## Regla principal

**No empieces a construir nada hasta terminar la entrevista.** Tu único objetivo ahora es entender. Cuando el
proceso esté claro, generás un resumen estructurado y accionable — y si el objetivo era crear una skill,
también un brief completo.

---

## Comportamiento durante la entrevista

- Hacé **una sola pregunta por vez** (todo en español).
- Tras cada respuesta, resumí brevemente lo entendido y formulá la siguiente pregunta.
- Detectá contradicciones, zonas ambiguas, supuestos débiles y decisiones sin tomar.
- No des por hecho información importante. Si la respuesta es vaga, pedí ejemplos concretos.
- Si el usuario ya parece tenerlo claro, buscá igual huecos, excepciones o casos límite.
- No hagas listas enormes de preguntas de golpe. No seas genérico: preguntas específicas al contexto HCE.

### Formato durante la entrevista

> Lo que entiendo hasta ahora es: [resumen breve].
> Siguiente pregunta: [pregunta concreta]

---

## Fases de la entrevista (adaptadas a la HCE)

### Fase 1 — Contexto clínico y de producto
1. ¿Qué módulo/feature querés construir o definir exactamente?
2. ¿Qué rol clínico/administrativo lo usa (médico, odontólogo, recepción, enfermería, superadmin, paciente)?
3. ¿Qué problema asistencial u operativo concreto resuelve?
4. ¿Es parte de un módulo del tablero o algo nuevo fuera del plan de 70 tareas?
5. ¿Aplica a todos los inquilinos o solo a los que contrataron el módulo (entitlements)?

### Fase 2 — Flujo actual y datos
6. ¿Cómo se hace hoy (papel, otro sistema, no existe)?
7. ¿Qué pasos sigue el flujo clínico real, de principio a fin?
8. ¿Qué datos entran y salen? ¿Cuáles son ePHI (datos sensibles de paciente)?
9. ¿Qué recursos **FHIR R4** modelan esos datos (Patient, Encounter, Observation, DiagnosticReport…)?
10. ¿Interactúa con sistemas externos (Keycloak, CliniChat, LIS/PACS, SISA, aseguradoras)?

### Fase 3 — Resultado deseado
11. ¿Qué debe producir exactamente (pantalla, endpoint, PDF, webhook)?
12. ¿Qué criterios de aceptación clínicos hacen que el resultado sea "correcto"?
13. ¿Qué firma/auditoría/inmutabilidad requiere (nota firmada, AuditEvent, consentimiento)?
14. ¿Qué resultados malos debe evitar a toda costa (fuga entre inquilinos, dato clínico erróneo)?

### Fase 4 — Reglas, seguridad y excepciones
15. ¿Qué roles Keycloak pueden ver/editar? ¿Qué scopes FHIR?
16. ¿Cómo se garantiza el aislamiento multi-inquilino (filtro por tenant en cada query)?
17. ¿Qué casos especiales o de borde hay (paciente sin DNI, animal, menor, cobertura vencida)?
18. ¿Qué límites no debe cruzar y qué debe preguntar antes de actuar?

### Fase 5 — Ejemplos reales
19. Pedí al menos un ejemplo real de entrada (un caso clínico concreto).
20. Pedí un ejemplo del resultado ideal (la salida esperada).
21. Usá esos ejemplos para verificar que entendiste bien el flujo.

### Fase 6 — Responsive y cierre
22. ¿Cómo se usa en móvil/tablet? (toda UI es 100% responsiva, mobile-safe — es innegociable).
23. Antes de cerrar: "¿Hay algo que no te pregunté y que creas importante que sepa?"

---

## Resumen final (siempre)

Al terminar, generá un documento estructurado (candidato a `docs/specs/`) con:

1. **Objetivo** — qué hace y para qué sirve clínicamente.
2. **Rol/destinatario** — quién lo usa y con qué permisos Keycloak.
3. **Flujo paso a paso** — el recorrido clínico en orden.
4. **Inputs / Outputs** — datos que entra/produce, marcando ePHI.
5. **Mapeo FHIR** — recursos R4 y códigos (LOINC/SNOMED/CIE-10) involucrados.
6. **Reglas y seguridad** — roles, scopes, aislamiento multi-inquilino, auditoría.
7. **Excepciones y casos límite** — situaciones especiales contempladas.
8. **Criterios de aceptación** — cómo saber si el resultado es bueno.
9. **Riesgos o ambigüedades pendientes** — lo que todavía no está claro.
10. **Siguiente acción recomendada** — qué construir y qué subagentes convocar (architect → fhir-mcp → security → product → ux…).

> Entregá este resumen como parte del **CHECKPOINT**: el Super Admin lo aprueba antes de que arranque la Fase 1 (Ingesta) y la codificación.

---

## Brief de skill (solo si el objetivo era crear una skill)

Si el pedido era crear una skill nueva, generá también un brief: **nombre recomendado**, **descripción**
(qué hace + cuándo activarse, con lenguaje que favorezca el triggering), **cuándo debe activarse**,
**instrucciones principales**, **flujo de trabajo**, **formato de salida**, **2+ ejemplos de uso**,
**errores a evitar** y **criterios de calidad**. (Recordá: crear/modificar skills requiere justificación
explícita y aprobación del Super Admin — regla de `AGENTS.md`.)

---

## Errores que debés evitar

- Empezar a construir o ejecutar antes de terminar la entrevista.
- Hacer varias preguntas a la vez o preguntas genéricas que aplicarían a cualquier proyecto.
- Dar por hecho información que el usuario no confirmó.
- Aceptar respuestas vagas sin pedir ejemplos concretos.
- Olvidar las excepciones, la seguridad (ePHI/multi-inquilino) y el responsive.
- Disparar la entrevista completa en una tarea trivial o ya especificada (usá la regla de proporción).

---

## Criterios de calidad

Una buena entrevista termina cuando:
- El flujo clínico puede describirse paso a paso sin ambigüedades.
- Hay al menos un ejemplo real de entrada y salida.
- Las excepciones probables, los roles Keycloak y el aislamiento multi-inquilino están contemplados.
- Los criterios de aceptación clínicos están definidos.
- El resumen podría entregarse a otra sesión/agente y sabría exactamente qué construir (handoff-safe).
