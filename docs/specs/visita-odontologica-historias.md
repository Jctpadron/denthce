# Historias de Usuario — Ciclo de vida de la Visita Odontológica (Episodio de atención)

> **Agente responsable:** `product` (Producto Clínico)
> **Fecha:** 2026-06-15
> **Estado:** Borrador para Quality Gate funcional y aprobación del Super Admin
> **Alcance:** SOLO definición funcional. No incluye diseño técnico, modelo de datos ni código.
> **Idioma de trabajo:** español (regla obligatoria del proyecto).
> **Módulo afectado:** Historia Clínica Odontológica (módulo AISLADO `odontology` — tabla `odontology_clinical_resources`, endpoints `/odontology`). NO toca la HC original ni `fhir_clinical_resources`.
> **Insumos verificados en repo:**
> - `hce-backend/src/odontology/odontology-resource.entity.ts` — hoy cada prestación (Condition/Procedure/QuestionnaireResponse/Observation/CarePlan) se guarda SUELTA contra `patientId` con `createdAt`, sin agrupador de "visita".
> - `hce-backend/src/appointment/appointment.entity.ts` — turno con estados FHIR `proposed → booked → arrived → fulfilled / cancelled / noshow`; marcado manual; hoy NO está vinculado al registro clínico.
> - `docs/specs/hc-odontologica-pami.md` y `docs/specs/hc-odontologica-vendibilidad.md` — anamnesis/consentimiento firmados, inmutabilidad legal, odontograma rojo/azul.
> - Memoria `hce-odontologia-modulo-aislado` — odontograma: color = capa, glifo = tipo.

---

## 0. Problema que resuelve (caso del Super Admin)

> "El paciente va a la consulta, el odontólogo le hace los procedimientos necesarios en el diente, y después de ~2 horas se va a su casa. Hoy el sistema no registra cuándo terminó la visita ni la cierra; las prestaciones quedan sueltas."

**Estado actual (verificado):** las prestaciones odontológicas se persisten una por una contra el paciente, cada una con su `createdAt`, sin un concepto que las agrupe como un único acto de atención. No existe "inicio" ni "fin" de la atención, ni un cierre firmado del episodio.

**Modelo a especificar funcionalmente — la Visita (Episodio de atención):**
- La **Visita se ABRE** al iniciar la atención (el paciente llegó / el profesional abre la ficha para atenderlo).
- Las prestaciones (odontograma, evolución, anamnesis del día, observaciones, plan) se registran **DENTRO de la visita activa**.
- La **Visita se CIERRA** con "Finalizar visita" (firma del profesional → contenido inmutable).
- La **Evolución** muestra el historial como **lista de visitas (episodios)**, cada una con sus prestaciones, profesional(es), y fecha/hora de inicio y de fin.

**Glosario:**
- **Visita / Episodio:** unidad de atención del paciente en una sesión. Tiene estado, inicio, fin, profesional responsable y prestaciones asociadas.
- **Prestación:** cada acto clínico registrado dentro de la visita (marca en el odontograma, nota de evolución, observación, etc.).
- **Visita activa (abierta):** visita iniciada y aún no finalizada; admite carga y edición de prestaciones.
- **Visita finalizada (cerrada/firmada):** visita con "Finalizar visita" confirmado; contenido inmutable, solo corregible por addenda.
- **Addenda:** nota de corrección/aclaración posterior a la firma, que NO altera el contenido original.

---

## 1. Historias de Usuario

### HU-V1 — Abrir / iniciar una visita

```json
{
  "historia_usuario": {
    "titulo": "Abrir una visita odontológica",
    "como": "Odontólogo (o Recepción, según rol)",
    "quiero": "Iniciar una visita para el paciente al comenzar la atención",
    "para": "Agrupar todas las prestaciones de esta sesión en un único episodio con inicio registrado"
  }
}
```

**Criterios de aceptación (Gherkin):**

```gherkin
Escenario: Abrir visita desde un turno del día
  Dado que el paciente tiene un turno en estado "arrived" (llegó)
  Y el odontólogo abre la ficha odontológica del paciente
  Cuando confirma "Iniciar visita"
  Entonces se crea una visita en estado "abierta"
  Y se registra la fecha/hora de inicio (automática, no editable a mano)
  Y se registra al profesional que la abre como profesional responsable
  Y la visita queda vinculada al turno de origen
  Y todas las prestaciones que se carguen a continuación quedan asociadas a esta visita

Escenario: Abrir visita sin turno previo (walk-in)
  Dado que el paciente NO tiene turno para hoy
  Y el odontólogo abre su ficha odontológica
  Cuando confirma "Iniciar visita"
  Entonces se crea una visita en estado "abierta" con origen "espontáneo/walk-in"
  Y NO se exige un turno para poder atender
  Y la visita queda registrada igual con su inicio y profesional responsable

Escenario: Evitar abrir una segunda visita el mismo día por error
  Dado que el paciente ya tiene una visita "abierta" hoy con el mismo profesional
  Cuando el profesional intenta "Iniciar visita" otra vez
  Entonces el sistema NO crea una nueva visita automáticamente
  Y muestra un aviso: "Ya existe una visita abierta de hoy. ¿Continuar esa o abrir una nueva?"
  Y ofrece "Continuar la visita abierta" como acción primaria

Escenario: Aviso de visita abierta de días anteriores al abrir ficha
  Dado que el paciente tiene una visita "abierta" de una fecha anterior a hoy (quedó sin cerrar)
  Cuando el profesional abre la ficha del paciente
  Entonces el sistema muestra un aviso destacado: "Hay una visita sin finalizar del [fecha]"
  Y ofrece "Revisar y finalizar" o "Iniciar visita de hoy"
  Y NO mezcla las prestaciones de hoy con la visita vieja sin acción explícita del profesional
```

---

### HU-V2 — Registrar prestaciones dentro de la visita activa

```json
{
  "historia_usuario": {
    "titulo": "Registrar prestaciones en la visita activa",
    "como": "Odontólogo",
    "quiero": "Cargar los procedimientos realizados (odontograma, evolución, observaciones) dentro de la visita en curso",
    "para": "Que todo lo hecho en la sesión quede agrupado en el mismo episodio"
  }
}
```

**Criterios de aceptación (Gherkin):**

```gherkin
Escenario: Toda prestación se asocia a la visita abierta
  Dado que existe una visita "abierta" para el paciente
  Cuando el odontólogo marca una pieza en el odontograma o agrega una nota de evolución
  Entonces esa prestación queda asociada a la visita abierta actual
  Y NO requiere que el profesional elija manualmente a qué visita pertenece

Escenario: Editar libremente mientras la visita está abierta
  Dado que la visita está "abierta"
  Cuando el odontólogo corrige o elimina una prestación que cargó en esta misma sesión
  Entonces el cambio se aplica sin restricción (aún no hay inmutabilidad)
  Y queda registrado en la auditoría quién y cuándo lo modificó

Escenario: No se puede cargar prestación sin visita abierta
  Dado que NO hay una visita "abierta" para el paciente
  Cuando el profesional intenta registrar una prestación odontológica
  Entonces el sistema solicita primero "Iniciar visita"
  Y no permite dejar prestaciones "sueltas" fuera de un episodio

Escenario: Indicador permanente de visita en curso
  Dado que hay una visita "abierta"
  Cuando el profesional está en cualquier pestaña de la ficha odontológica
  Entonces se muestra de forma visible el estado "Visita en curso desde [hora de inicio]"
  Y un acceso directo a "Finalizar visita"
```

---

### HU-V3 — Finalizar y firmar la visita

```json
{
  "historia_usuario": {
    "titulo": "Finalizar y firmar la visita",
    "como": "Odontólogo responsable",
    "quiero": "Cerrar la visita con mi firma cuando termino de atender al paciente",
    "para": "Dejar registrado el fin de la atención y consolidar el episodio como documento clínico inmutable"
  }
}
```

**Criterios de aceptación (Gherkin):**

```gherkin
Escenario: Finalizar visita correctamente
  Dado que existe una visita "abierta" con al menos una prestación registrada
  Cuando el odontólogo responsable confirma "Finalizar visita" y firma
  Entonces la visita pasa a estado "finalizada"
  Y se registra la fecha/hora de fin (automática)
  Y se registra la identidad del profesional firmante
  Y el contenido de la visita queda inmutable (no editable ni borrable destructivamente)
  Y la acción queda asentada en la auditoría

Escenario: Inmutabilidad post-firma
  Dado que una visita está "finalizada"
  Cuando cualquier usuario intenta editar o borrar una prestación de esa visita
  Entonces el sistema lo impide
  Y ofrece la única vía válida: "Agregar addenda" (ver HU-V5)

Escenario: Aviso al finalizar una visita vacía
  Dado que existe una visita "abierta" SIN ninguna prestación cargada
  Cuando el profesional intenta "Finalizar visita"
  Entonces el sistema advierte "La visita no tiene prestaciones registradas"
  Y exige confirmación explícita o cancelar la visita en lugar de finalizarla vacía

Escenario: Finalizar visita marca el turno como atendido (vínculo opcional)
  Dado que la visita está vinculada a un turno
  Cuando la visita se finaliza
  Entonces el sistema propone marcar el turno como "fulfilled" (atendido)
  Y si no hay turno vinculado (walk-in), la finalización igualmente se completa sin tocar la agenda

Escenario: Solo el profesional responsable (o rol autorizado) firma
  Dado que una visita está "abierta"
  Cuando un usuario sin rol de firma clínica intenta "Finalizar visita"
  Entonces el sistema no permite firmar
  Y la opción de finalizar queda reservada al profesional responsable o rol autorizado
```

---

### HU-V4 — Ver el historial por visitas (Evolución como lista de episodios)

```json
{
  "historia_usuario": {
    "titulo": "Ver el historial clínico organizado por visitas",
    "como": "Odontólogo (o Administrador, según permisos)",
    "quiero": "Ver la evolución del paciente como una lista de visitas, cada una con sus prestaciones, profesional y fecha/hora de inicio y fin",
    "para": "Entender qué se hizo en cada sesión y poder auditar la atención"
  }
}
```

**Criterios de aceptación (Gherkin):**

```gherkin
Escenario: Listado de visitas ordenado
  Dado que el paciente tiene varias visitas registradas
  Cuando el profesional abre la pestaña "Evolución / Historial"
  Entonces ve una lista de visitas ordenada de la más reciente a la más antigua
  Y cada visita muestra: fecha y hora de inicio y de fin, profesional(es), estado (abierta/finalizada) y resumen de prestaciones

Escenario: Detalle de una visita
  Dado que el profesional selecciona una visita de la lista
  Cuando se expande su detalle
  Entonces ve todas las prestaciones de esa visita (odontograma de la sesión, notas de evolución, observaciones, plan)
  Y ve si la visita fue firmada, por quién y cuándo
  Y ve las addendas asociadas, si existen, marcadas como posteriores a la firma

Escenario: Distinción visual abierta vs finalizada
  Dado que hay una visita "abierta" y otras "finalizadas"
  Cuando se muestra el historial
  Entonces la visita "abierta" se distingue claramente (etiqueta "En curso / Sin finalizar")
  Y las "finalizadas" se muestran como cerradas/inmutables

Escenario: Fin de visita visible
  Dado que una visita está "finalizada"
  Cuando se muestra en el historial
  Entonces el "fin de visita" se representa con la fecha/hora de finalización registrada al firmar
  Y, si esa marca no existiera por ser una visita migrada/heredada, se indica "Fin no registrado"
```

---

### HU-V5 — Corregir mediante addenda después de la firma

```json
{
  "historia_usuario": {
    "titulo": "Corregir una visita finalizada mediante addenda",
    "como": "Odontólogo",
    "quiero": "Agregar una aclaración o corrección a una visita ya firmada sin alterar su contenido original",
    "para": "Mantener la trazabilidad legal y corregir errores sin violar la inmutabilidad"
  }
}
```

**Criterios de aceptación (Gherkin):**

```gherkin
Escenario: Agregar addenda a visita finalizada
  Dado que una visita está "finalizada" e inmutable
  Cuando el profesional selecciona "Agregar addenda" y escribe la corrección/aclaración
  Y firma la addenda
  Entonces la addenda se adjunta a la visita como nota posterior
  Y el contenido original de la visita NO se modifica
  Y la addenda registra su propia fecha/hora y profesional firmante

Escenario: La addenda es visible y atribuible
  Dado que una visita tiene una o más addendas
  Cuando se consulta el detalle de la visita
  Entonces cada addenda se muestra como posterior a la firma original, con autor y fecha
  Y queda claro qué es contenido original y qué es corrección posterior

Escenario: No se permite addenda sobre visita abierta
  Dado que una visita está "abierta"
  Cuando el profesional busca "Agregar addenda"
  Entonces el sistema indica que en una visita abierta se edita directamente (no hace falta addenda)
  Y la addenda solo está disponible para visitas finalizadas
```

---

## 2. Reglas de negocio

| # | Regla | Detalle funcional |
| :- | :--- | :--- |
| RN1 | **Una sola visita abierta por paciente y profesional** | No pueden coexistir dos visitas "abiertas" del mismo paciente con el mismo profesional. Si se intenta, se ofrece continuar la existente. |
| RN2 | **Editable vs solo addenda** | Mientras la visita está **abierta**: edición/borrado libre de prestaciones (auditado). Una vez **finalizada/firmada**: contenido inmutable; toda corrección es por **addenda** (HU-V5). |
| RN3 | **Inicio y fin automáticos** | La fecha/hora de inicio se toma al abrir la visita y la de fin al finalizar/firmar. No se editan manualmente. (Excepción acotada de auditoría/corrección de hora queda FUERA de v1.) |
| RN4 | **"Fin de visita" = firma de finalización** | El indicador de fin de la atención es la marca de fecha/hora de finalización registrada al firmar "Finalizar visita". Una visita sin esa marca está "abierta" o, si es heredada, "fin no registrado". |
| RN5 | **Vínculo opcional con el turno** | Si la visita nace de un turno, al finalizar se propone marcar el turno como `fulfilled`. El vínculo es **opcional**: una visita walk-in se atiende y finaliza sin turno; un turno puede marcarse atendido aunque no se quiera abrir el flujo de visita (compatibilidad hacia atrás). El estado del turno (`arrived`) puede ofrecer "Iniciar visita" como atajo. |
| RN6 | **Toda prestación pertenece a una visita** | A partir de la entrada en vigor del modelo, no se crean prestaciones odontológicas "sueltas": siempre dentro de una visita abierta. |
| RN7 | **Profesional responsable** | Cada visita tiene un profesional responsable (quien la abre/firma). El historial debe poder mostrar el/los profesional(es) que intervinieron (ver RN8). |
| RN8 | **Múltiples profesionales en una visita** | Si más de un profesional carga prestaciones en la misma visita abierta, cada prestación conserva la atribución de quién la registró. El responsable de la firma final es quien finaliza la visita; la atribución por prestación no se pierde. (Visitas paralelas por especialista distinto = visitas separadas, ver RN1: distinto profesional, distinta visita.) |
| RN9 | **Datos heredados (prestaciones previas sueltas)** | Las prestaciones existentes anteriores al modelo de visita NO se rompen: se muestran en el historial agrupadas por su `createdAt` como "Registros previos (sin visita)" o como visitas heredadas con "fin no registrado". No se inventan firmas ni horas de fin que nunca existieron. |
| RN10 | **Auditoría** | Abrir, editar mientras abierta, finalizar/firmar y agregar addenda quedan registrados (quién, qué, cuándo), conforme a la regla de auditoría del proyecto. |
| RN11 | **Aislamiento multi-inquilino** | Toda visita y prestación se filtra por `tenantId` (Zero Trust). Una visita nunca cruza tenants. |
| RN12 | **Cancelar visita vacía** | Una visita abierta sin prestaciones puede **cancelarse** (descartarse) en lugar de finalizarse; queda registrada como cancelada, no como atención válida. |

---

## 3. Casos borde y riesgos clínicos

| # | Caso borde / riesgo | Riesgo clínico/legal | Mitigación funcional |
| :- | :--- | :--- | :--- |
| CB1 | **Se olvidan de finalizar la visita** (queda abierta de días anteriores). | Pérdida de trazabilidad del fin real; la sesión siguiente podría mezclarse con la vieja; documento clínico que nunca se consolida. | Aviso destacado al abrir la ficha (HU-V1) y al iniciar visita de hoy; no mezclar automáticamente; opción "Revisar y finalizar" con el fin estimado a confirmar por el profesional. |
| CB2 | **Doble visita el mismo día.** | Duplicación del episodio; confusión en facturación y auditoría. | RN1 (una abierta por paciente+profesional) + aviso al intentar reabrir (HU-V1). Permitir explícitamente una segunda visita el mismo día solo si el profesional lo confirma (p. ej. dos sesiones reales). |
| CB3 | **Visita abierta indefinidamente** (días/semanas sin cerrar). | Documento sin valor legal hasta firmarse; riesgo de edición tardía sobre algo que ya "pasó". | Alerta de visitas abiertas con antigüedad; la antigüedad se hace visible en el historial; (auto-cierre forzado NO entra en v1, ver fuera de alcance — el cierre siempre lo decide una persona). |
| CB4 | **Walk-in sin turno.** | Si el sistema exigiera turno, se perdería el registro o se atendería en papel. | HU-V1 soporta walk-in nativamente; la visita no depende del turno. |
| CB5 | **Múltiples profesionales en la misma sesión.** | Pérdida de atribución de quién hizo qué; firma ambigua. | RN8: atribución por prestación + firmante único de la finalización. |
| CB6 | **Caída de conexión durante la visita.** | Pérdida de prestaciones cargadas en la sesión. | Definir comportamiento de borrador/persistencia (decisión técnica para `architect`); a nivel producto: no perder lo cargado y poder reanudar la visita abierta. |
| CB7 | **Editar después de firmar (intento).** | Adulteración del documento clínico; ilegalidad. | Inmutabilidad estricta (RN2) + addenda como única vía (HU-V5). |
| CB8 | **Finalizar visita vacía por inercia.** | Episodio "atendido" sin contenido; ruido en el historial. | Advertencia + opción de cancelar en lugar de finalizar (RN12, HU-V3). |
| CB9 | **Prestaciones heredadas sueltas previas al modelo.** | Romper el historial existente o falsear datos. | RN9: mostrarlas como "registros previos / fin no registrado", sin inventar firmas. |
| CB10 | **Turno marcado `fulfilled` pero sin visita** (uso antiguo). | Inconsistencia entre agenda y registro clínico. | El vínculo es opcional (RN5); el historial muestra el turno atendido aunque no haya visita asociada, sin forzar coherencia retroactiva. |

---

## 4. Definición de Hecho (Definition of Done) — funcional

Una entrega de este ciclo de vida se considera **funcionalmente terminada** cuando:

1. Se puede **abrir** una visita desde un turno `arrived` y también como **walk-in** sin turno (HU-V1).
2. Toda prestación odontológica cargada queda **asociada a la visita abierta** y no existen prestaciones nuevas "sueltas" (HU-V2, RN6).
3. Se puede **finalizar y firmar** la visita; queda registrado **inicio, fin y profesional firmante**; el contenido pasa a **inmutable** (HU-V3, RN2/RN3/RN4).
4. El **historial muestra la lista de visitas** (episodios) con prestaciones, profesional(es) y fecha/hora inicio-fin, distinguiendo abiertas de finalizadas (HU-V4).
5. Se puede **corregir por addenda** una visita finalizada sin alterar el original, con autor y fecha (HU-V5).
6. Los **avisos de visita sin cerrar** (de hoy y de días previos) funcionan y no se mezclan sesiones automáticamente (CB1).
7. Al finalizar, se **propone marcar el turno como atendido** (`fulfilled`) cuando hay turno vinculado; walk-in finaliza sin tocar agenda (RN5).
8. Las **prestaciones heredadas previas** siguen visibles sin romperse y sin firmas inventadas (RN9).
9. Todo (abrir/editar/finalizar/addenda) queda **auditado** y **filtrado por tenant** (RN10/RN11).
10. La interfaz cumple **responsive obligatorio** (usable en tablet/celular en el sillón) — certificación de `ux`.
11. **Verificado en runtime** (no solo que compila): el flujo completo abrir → cargar → finalizar → ver historial → addenda probado de punta a punta — certificación de `qa`.

---

## 5. Fuera de alcance (v1)

- **Auto-cierre automático** de visitas abiertas vencidas (el cierre siempre lo decide una persona; solo se alerta).
- **Edición manual de las horas** de inicio/fin de la visita (corrección de timestamps por auditoría diferida).
- **Reapertura** de una visita ya finalizada (la corrección es exclusivamente por addenda).
- **Facturación / cobro por visita** y conteo de prestaciones para presentación a obra social (se cubre en la línea PAMI/cobrabilidad, specs existentes).
- **Visita multi-especialidad orquestada** (un mismo episodio compartido formalmente entre especialistas con flujos de firma múltiple). En v1: distinto profesional = visita separada (RN1/RN8).
- **PDF oficial del episodio** firmado (queda atado al PDF PAMI de 3 hojas ya especificado por separado).
- **Migración masiva** de las prestaciones sueltas históricas a visitas reconstruidas (solo se muestran como "registros previos").
- **Recordatorios/notificaciones** al profesional por visitas abiertas (más allá del aviso en pantalla al abrir la ficha).

---

## 6. Dependencias y handoff para el resto de agentes

- **`architect`:** modelo de datos del agregador "Visita" (estados abierta/finalizada/cancelada, vínculo prestación→visita, vínculo visita→turno opcional), inmutabilidad post-firma, comportamiento ante caída de conexión (CB6). El módulo es el aislado `odontology`, NO la HC original.
- **`fhir-mcp`:** mapeo del episodio a FHIR R4 (candidato natural: `Encounter` con `period.start`/`period.end` y `status`; las prestaciones como recursos referenciando el Encounter; la firma como `Provenance`/firma de nota). El módulo 3 ya usa el concepto Encounter en la HC original — alinear sin acoplar.
- **`security`:** firma de finalización, inmutabilidad, auditoría de abrir/editar/finalizar/addenda, rol autorizado a firmar, aislamiento por tenant.
- **`ux`:** indicador de "visita en curso", avisos de visita sin cerrar, historial como lista de episodios, flujo de addenda, responsive en sillón.
- **`qa`:** pruebas de punta a punta del ciclo de vida y de los casos borde CB1-CB10; validación FHIR del recurso de episodio.

---

> **Trazabilidad:** este documento define funcionalmente el "Ciclo de vida de la visita odontológica" sobre el módulo aislado `odontology`. Complementa `docs/specs/hc-odontologica-pami.md` y `docs/specs/hc-odontologica-vendibilidad.md`. Pendiente de certificación del Quality Gate de `product` y de aprobación del Super Admin antes de pasar a diseño técnico (`architect`/`fhir-mcp`).
