# Especificación Funcional — Historia Clínica Odontológica (Modelo PAMI/INSSJP + Ficha Catastral Jujuy)

> ⚠️ **NOTA (2026-05-29).** Las historias de usuario siguen vigentes, pero se implementó como **módulo AISLADO** (no integrado en la ficha original) y por fases. Estado real y pendientes (PDF PAMI) en: `docs/walkthroughs/2026-05-29_hc_odontologica_modulo_aislado.md`.

> **Agente responsable:** `product` (Producto Clínico)
> **Fecha:** 2026-05-28
> **Estado:** Borrador para aprobación del Orquestador / Super Admin
> **Módulo destino:** 3 — Historia Clínica y Notas SOAP (extensión odontológica)
> **Idioma de trabajo:** español (regla obligatoria del proyecto)

## 0. Objetivo y alcance

Replicar fielmente, dentro de DentHCE, dos instrumentos clínicos reales argentinos solicitados por un odontólogo:

1. **Modelo 1 — Historia Clínica PAMI/INSSJP** (formulario oficial de obra social, 3 hojas): datos de afiliado/profesional, anamnesis sí/no, historia clínica odontológica, odontograma, estado bucal general, diagnóstico/plan/observaciones, consentimiento informado y anexo de evolución con conformidad.
2. **Modelo 2 — Ficha Catastral del Círculo Odontológico de Jujuy**: odontograma con simbología rica y **convención de color clave: ROJO = prestaciones existentes (ya realizadas), AZUL = prestaciones a realizar (planificadas)**, más cuestionario de antecedentes médicos.

El entregable funcional debe permitir que la HC generada sea **válida ante la obra social** y **legalmente defendible** (consentimiento + firma + trazabilidad).

### 0.1 Convención de color y semántica de doble capa (decisión del Orquestador)

| Capa | Color | Significado clínico | Estado FHIR de referencia |
| :--- | :--- | :--- | :--- |
| Existente | ROJO | Prestación/hallazgo ya presente o tratamiento ya realizado | `Procedure.status = completed` / `Condition.clinicalStatus = active` |
| A realizar | AZUL | Prestación planificada, aún no ejecutada | Intención de plan (`Procedure.status = preparation` o equivalente de planificación) |

Regla de transición: **al marcar un tratamiento planificado (azul) como ejecutado, pasa automáticamente a existente (rojo)**, conservando la trazabilidad de cuándo fue planificado y cuándo realizado (no se borra el azul; se transiciona).

> Nota de dominio: la representación FHIR concreta (extension, `intent`, `basedOn`, etc.) la define `architect` + `fhir-mcp`. Aquí se fija únicamente la semántica clínica observable por el usuario.

---

## 1. Reutilización vs. novedad (mapa contra el repo actual)

### Se reutiliza (ya existe)
- **Odontograma SVG interactivo** (`hce-frontend/src/components/Odontogram.tsx`): piezas por caras V/D/L/M/O, vistas adulto/infantil/mixto, herramientas (caries, restauración, conducto, corona, implante, sellador, ausente), persistencia FHIR `Condition`/`Procedure` con `bodySite` (pieza+cara) y SNOMED, herramienta "limpiar".
- **Antecedentes** (`tabs/AntecedentsTab.tsx`): `Condition` personal/familiar en texto libre — base para la anamnesis, pero insuficiente como cuestionario estructurado.
- **Alergias** (`AllergyTab.tsx` / `AllergyIntolerance`): cubre parcialmente "¿es alérgico a alguna droga?".
- **Datos demográficos + cobertura** (`PatientForm` / FHIR `Patient`): base para datos de afiliado.
- **Recetas** (`PrescriptionsTab` / `MedicationRequest`) y **CDS Hooks de interacciones**: cruzan con "¿toma medicación / anticoagulantes?".
- **Documentos** (`DocumentsTab` / `DocumentReference`-`Media`): destino del PDF exportado y de adjuntos.
- **Firma digital del profesional** sobre notas clínicas (ya existe en Encounter/SOAP).
- **Historial / AuditEvent** (`AuditTab`): trazabilidad inmutable.
- **Multi-inquilino Zero Trust**: todo recurso nuevo se filtra por `tenantId`.

### Es nuevo (a construir)
1. **Doble capa en el odontograma** (existente rojo / a realizar azul) + transición azul→rojo. El componente actual **no distingue estado/intención** ni color rojo/azul.
2. **Simbología odontológica ampliada**: restauración simple/compuesta, endodoncia uni/multirradicular, momificación, formocresol, incrustación, corona, perno corona / corona espiga, perno pilar, ausente, sellante, extracción indicada, extracción realizada. Hoy hay solo 7 herramientas.
3. **Anamnesis odontológica estructurada PAMI** (cuestionario sí/no con condicional "¿cuál?", + higiene + motivo de consulta) con **firma del paciente/familiar**. Hoy solo hay texto libre.
4. **Cuestionario de antecedentes médicos ampliado (modelo Jujuy)**: catálogo cerrado de patologías.
5. **Estado Bucal General + Diagnóstico presuntivo + Plan de tratamiento con fecha + Observaciones** como sección estructurada.
6. **Consentimiento informado del paciente** (texto legal versionado + firma del paciente/tutor + firma y sello del profesional con M.N./M.P. + fecha).
7. **Anexo de evolución con conformidad del afiliado** (tabla Fecha | Tratamiento realizado | Conformidad).
8. **Datos de afiliado/obra social** (Nº afiliado, titular/parentesco, código prestador, médico de cabecera).
9. **Exportación PDF oficial PAMI (3 hojas)** con disposición fiel al formulario.

---

## 2. Épicas e historias de usuario

> Formato: Como/Quiero/Para + criterios de aceptación verificables. Donde aplica flujo, se usa Gherkin (Dado/Cuando/Entonces).
> Roles: **Odontólogo** (profesional tratante), **Recepción/Administrativo**, **Paciente/Tutor**.

---

### ÉPICA A — Anamnesis odontológica estructurada (PAMI + Jujuy)

#### HU-A1 — Cuestionario de anamnesis sí/no con condicional
**Como** Odontólogo
**Quiero** registrar la anamnesis con preguntas cerradas sí/no y un campo condicional "¿cuál?/¿qué?"
**Para** documentar antecedentes de forma rápida, comparable y exportable al formato PAMI.

Criterios de aceptación:
- Incluye exactamente las preguntas PAMI: ¿Sufre alguna enfermedad? / ¿Realiza tratamiento médico? / ¿Consume medicación? / ¿Es alérgico a alguna droga? / Diabetes / Fuma / ¿Problemas cardíacos? / Hipertensión arterial / ¿Toma Aspirina o anticoagulantes? / ¿Fue operado?
- Cada pregunta con respuesta afirmativa **habilita** su campo condicional ("¿cuál?", "¿qué tratamiento?", "¿cuántos por día?" en Fuma).
- El campo condicional es **obligatorio** cuando la respuesta es "Sí".

```gherkin
Escenario: Detalle obligatorio al responder afirmativamente
  Dado que el odontólogo abre la pestaña Anamnesis de un paciente
  Cuando marca "Sí" en "¿Es alérgico a alguna droga?"
  Y deja vacío el campo "¿cuál?"
  Entonces el sistema impide guardar y resalta el campo condicional como obligatorio
```

- Si responde "Sí" en alergia a droga, el sistema **sugiere** crear/abrir el recurso `AllergyIntolerance` correspondiente (puente con la pestaña Alergias existente; no duplica el dato).
- Todas las respuestas se persisten asociadas al paciente y al `tenantId`, y quedan auditadas (AuditEvent).

#### HU-A2 — Cuestionario de antecedentes médicos ampliado (modelo Jujuy)
**Como** Odontólogo
**Quiero** un catálogo cerrado de antecedentes (cardíacos, presión alta/baja, enfermedades venéreas, fiebre reumática, hepatitis, úlcera, dolores de cabeza, VIH/sida, epilepsia, artritis, cáncer, diabetes, alteración nerviosa, sinusitis), más hábitos (fuma, bebe), embarazo y "se cansa al caminar/subir escaleras"
**Para** evaluar riesgo médico antes de cualquier procedimiento.

Criterios de aceptación:
- El catálogo se presenta como lista de ítems sí/no; "embarazo" solo se habilita/visualiza cuando el sexo registrado lo permite (o siempre, pero marcado como no aplicable).
- "Toma medicamentos" enlaza con la lista de `MedicationRequest`/medicación activa del paciente.
- Los ítems marcados "Sí" generan un **resumen de riesgo** visible en la cabecera de la ficha (alerta no bloqueante).

#### HU-A3 — Historia clínica odontológica e higiene
**Como** Odontólogo
**Quiero** registrar motivo de consulta, consulta previa con otro profesional, dificultad para masticar/hablar, movilidad dentaria, sangrado de encías, cantidad de cepillados diarios y momentos de azúcar
**Para** completar la sección "Historia Clínica Odontológica" del formulario PAMI.

Criterios de aceptación:
- "Motivo de consulta" es **obligatorio** para guardar la anamnesis.
- "Cantidad de cepillados diarios" y "momentos de azúcar" aceptan solo valores numéricos ≥ 0.
- Las respuestas alimentan directamente la Hoja 1 del PDF PAMI.

#### HU-A4 — Firma del paciente sobre la declaración de anamnesis
**Como** Paciente o Tutor
**Quiero** firmar la declaración de veracidad de la anamnesis
**Para** dejar constancia legal de que los datos fueron aportados por mí.

```gherkin
Escenario: Anamnesis firmada queda bloqueada
  Dado que el paciente ha firmado la declaración de anamnesis
  Cuando el odontólogo intenta modificar una respuesta ya firmada
  Entonces el sistema exige crear una nueva versión (enmienda) y registra autor, fecha y motivo del cambio
```

Criterios de aceptación:
- La firma del paciente registra fecha/hora y queda asociada a la versión exacta del cuestionario firmado.
- Si firma un familiar/tutor, se registra nombre y parentesco (consistente con "Titular Sí/No + Parentesco").
- La anamnesis firmada es **inmutable**: cualquier corrección genera una enmienda versionada auditada.

---

### ÉPICA B — Odontograma de doble capa + simbología ampliada

#### HU-B1 — Doble capa existente (rojo) / a realizar (azul)
**Como** Odontólogo
**Quiero** registrar en cada pieza/cara tanto las prestaciones existentes (rojo) como las planificadas (azul)
**Para** distinguir lo ya hecho de lo que falta hacer, igual que la ficha catastral de Jujuy.

Criterios de aceptación:
- Antes de aplicar una herramienta, el odontólogo elige la capa: **Existente (rojo)** o **A realizar (azul)**.
- El color renderizado respeta estrictamente la convención: rojo = existente, azul = a realizar.
- Ambas capas pueden coexistir sobre la misma pieza (p. ej. corona existente en 11 y extracción indicada azul en 12).
- Una leyenda visible explica la convención de color y la simbología.
- La selección de capa es operable por teclado y accesible (contraste y etiqueta textual, no solo color, para no depender únicamente del color — accesibilidad).

#### HU-B2 — Transición de planificado a realizado
**Como** Odontólogo
**Quiero** marcar una prestación planificada como realizada
**Para** que el odontograma refleje el avance del plan de tratamiento.

```gherkin
Escenario: Completar un tratamiento planificado
  Dado que la pieza 36 tiene una endodoncia planificada (azul)
  Cuando el odontólogo la marca como "realizada"
  Entonces la prestación pasa a existente (rojo)
  Y se conserva el registro de la fecha de planificación y la fecha de realización
  Y la acción queda auditada con el profesional que la ejecutó
```

Criterios de aceptación:
- La transición azul→rojo **no elimina** el historial de la planificación.
- Se registra fecha de planificación y fecha de realización por separado.
- Opcional: la prestación realizada puede generar/sugerir una fila en el Anexo de evolución (ÉPICA E).

#### HU-B3 — Simbología odontológica ampliada
**Como** Odontólogo
**Quiero** disponer de la simbología completa: restauración simple, restauración compuesta, endodoncia unirradicular, endodoncia multirradicular, momificación, formocresol, incrustación, corona, perno corona / corona espiga, perno pilar, pieza ausente, sellante, extracción indicada, extracción realizada
**Para** representar con precisión clínica el estado bucal.

Criterios de aceptación:
- Cada símbolo tiene representación visual distinguible y **etiqueta textual** (tooltip/leyenda), no solo color.
- "Extracción indicada" se registra naturalmente en capa **azul** (a realizar) y "extracción realizada" en capa **roja** (existente); el sistema lo sugiere por defecto pero permite corrección.
- "Pieza ausente" inhabilita el registro de caras nuevas sobre esa pieza (comportamiento ya existente que se conserva), salvo herramienta de limpieza/corrección.
- Cada símbolo persiste con su pieza, cara (cuando aplica) y capa, manteniendo compatibilidad con la persistencia FHIR actual (`Condition`/`Procedure` + `bodySite`).
- Símbolos que aplican a la pieza completa (corona, perno, ausente, extracción) se registran a nivel pieza; símbolos de superficie (restauración, sellante) a nivel cara.

#### HU-B4 — Responsividad del odontograma
**Como** Odontólogo
**Quiero** usar el odontograma en tablet/móvil sin roturas
**Para** registrar en el sillón odontológico.

Criterios de aceptación:
- 100% responsivo (mobile-safe), sin overflow, conservando el modo lista dinámica ya existente para pantallas pequeñas.
- Selección de capa, herramienta y símbolo accesibles en táctil con áreas de toque adecuadas.

---

### ÉPICA C — Estado Bucal General, Diagnóstico, Plan y Observaciones

#### HU-C1 — Estado bucal general
**Como** Odontólogo
**Quiero** registrar presencia de placa bacteriana (Sí/No), enfermedad periodontal (Sí/No) y lesiones en mucosa/tejido blando (Sí/No + zona y tipo)
**Para** documentar la Hoja 2 del formulario PAMI.

Criterios de aceptación:
- "¿Presenta lesiones en mucosa o tejido blando? = Sí" **obliga** a indicar zona y tipo.
- Los tres campos se incluyen tal cual en la Hoja 2 del PDF.

#### HU-C2 — Diagnóstico presuntivo y plan de tratamiento con fecha
**Como** Odontólogo
**Quiero** registrar diagnóstico presuntivo (texto), plan de tratamiento con fecha y observaciones
**Para** dejar el plan documentado y fechado.

Criterios de aceptación:
- El plan admite múltiples ítems, cada uno con fecha.
- Donde sea posible, el diagnóstico es **codificable** (CIE-10 / SNOMED) reutilizando el motor de autocompletado existente, sin perder el texto libre.
- El plan registrado puede vincularse con las prestaciones azules del odontograma (coherencia entre plan textual y plan gráfico).

---

### ÉPICA D — Consentimiento informado

#### HU-D1 — Consentimiento informado firmado
**Como** Paciente o Tutor
**Quiero** leer y firmar el consentimiento informado
**Para** autorizar legalmente el tratamiento.

```gherkin
Escenario: No se puede iniciar tratamiento sin consentimiento
  Dado que un paciente no tiene consentimiento informado firmado para el plan vigente
  Cuando el odontólogo intenta marcar una prestación como realizada
  Entonces el sistema muestra una advertencia de consentimiento ausente
  Y registra la decisión del profesional (continuar/cancelar) en la auditoría
```

Criterios de aceptación:
- El texto legal del consentimiento está **versionado**; la firma queda atada a la versión exacta de texto mostrada.
- Registra firma del paciente o tutor (con parentesco si aplica) + **firma y sello del profesional con M.N./M.P.** + fecha.
- El consentimiento firmado es inmutable; revocar/actualizar genera un nuevo registro versionado.
- Se incluye íntegro en la Hoja 2 del PDF PAMI.
- Cruce con backlog: alinea con REQ-007-POR-7.4 (firmas electrónicas de consentimiento); esta spec adelanta el caso odontológico presencial.

---

### ÉPICA E — Anexo de evolución con conformidad

#### HU-E1 — Registro de evolución con conformidad del afiliado
**Como** Odontólogo
**Quiero** registrar en una tabla cronológica Fecha | Tratamiento realizado | Conformidad del afiliado
**Para** documentar la evolución sesión por sesión, como exige el Anexo PAMI (Hoja 3).

Criterios de aceptación:
- Cada fila registra fecha, descripción del tratamiento realizado y la **conformidad del afiliado** (firma o confirmación).
- Encabezado del anexo: Nombre y Apellido + Nº de beneficio (tomados de los datos de afiliado).
- Las filas son **inmutables** una vez firmada la conformidad; correcciones por enmienda auditada.
- Una prestación marcada como realizada en el odontograma (HU-B2) puede precargar una fila del anexo (sin duplicar).
- El anexo se imprime como Hoja 3 del PDF y admite múltiples páginas si hay muchas filas.

---

### ÉPICA F — Datos de afiliado / obra social

#### HU-F1 — Datos de afiliado y profesional PAMI
**Como** Recepción/Administrativo
**Quiero** registrar Nº de afiliado, Nº documento, fecha de nacimiento, apellido, nombre, titular Sí/No + parentesco, domicilio, localidad, CP, teléfono, y los datos del profesional (domicilio, localidad, CP, teléfono, código prestador, médico de cabecera)
**Para** completar la Hoja 1 del formulario y garantizar validez ante la obra social.

Criterios de aceptación:
- Los datos demográficos reutilizan el FHIR `Patient` existente; solo se **añaden** los campos específicos PAMI faltantes (Nº afiliado, titular/parentesco, código prestador, médico de cabecera).
- "Titular = No" **obliga** a indicar parentesco.
- El Nº de afiliado / Nº de beneficio se valida con formato no vacío antes de exportar el PDF.
- Los datos del profesional pueden precargarse desde el perfil del odontólogo/tenant.

---

### ÉPICA G — Exportación PDF oficial PAMI

#### HU-G1 — Exportar HC en PDF formato oficial (3 hojas)
**Como** Odontólogo
**Quiero** exportar la historia clínica en PDF con la disposición oficial PAMI de 3 hojas
**Para** presentarla ante la obra social y archivarla.

```gherkin
Escenario: Exportación bloqueada por datos faltantes
  Dado un paciente sin Nº de afiliado ni consentimiento firmado
  Cuando el odontólogo solicita exportar el PDF oficial PAMI
  Entonces el sistema lista los campos obligatorios faltantes (afiliado, anamnesis, consentimiento)
  Y no genera el PDF hasta que se completen o el profesional confirme exportación parcial marcada como "borrador"
```

Criterios de aceptación:
- Hoja 1: datos afiliado/profesional + anamnesis + historia clínica odontológica + declaración firmada del paciente.
- Hoja 2: odontograma + estado bucal general + diagnóstico presuntivo + plan con fecha + observaciones + consentimiento informado con firmas/sello/M.N./M.P.
- Hoja 3: anexo de evolución (Fecha | Tratamiento realizado | Conformidad) con encabezado Nombre/Apellido + Nº beneficio; pagina automáticamente.
- El odontograma del PDF refleja la convención rojo (existente) / azul (a realizar).
- El PDF se guarda como `DocumentReference`/`Media` en la ficha del paciente (reutiliza módulo Documentos) y queda auditado.
- El PDF distingue claramente versión "definitiva" (todo firmado) de "borrador".
- 100% legible en impresión A4 monocroma con texto alternativo de símbolos (no depender solo del color para la versión B/N).

---

## 3. Plan de fases (orden propuesto, por valor clínico)

### Fase 1 — Núcleo legal y de captura (MVP usable y defendible)
**Incluye:** ÉPICA F (datos afiliado), ÉPICA A (anamnesis estructurada + firma paciente HU-A1, A3, A4 y antecedentes A2), ÉPICA C (estado bucal/diagnóstico/plan), ÉPICA D (consentimiento informado).
**Justificación:** entrega de inmediato lo que hace la HC **válida y legalmente defensible** (anamnesis firmada + consentimiento + datos de afiliado). No depende de la complejidad gráfica del odontograma. Es el mayor valor con menor riesgo técnico, reutilizando Patient, Antecedentes, Alergias y firma existentes.

### Fase 2 — Odontograma clínico avanzado
**Incluye:** ÉPICA B completa (doble capa rojo/azul, transición, simbología ampliada, responsividad).
**Justificación:** es el componente de mayor riesgo técnico (modificar el `Odontogram.tsx` existente: estado/intención + color + nuevos símbolos + persistencia FHIR). Se aborda después de asegurar el núcleo legal. Aporta la diferenciación clínica clave (plan visual existente vs. a realizar).

### Fase 3 — Evolución y salida oficial
**Incluye:** ÉPICA E (anexo de evolución con conformidad) + ÉPICA G (exportación PDF oficial 3 hojas).
**Justificación:** el anexo y el PDF **consolidan** todo lo anterior; el PDF solo tiene sentido cuando las Fases 1 y 2 producen datos completos. El anexo se nutre de la transición azul→rojo de la Fase 2. Cierra el ciclo de presentación ante la obra social.

> Entrega incremental: cada fase es desplegable y certificable de forma independiente por los Quality Gates (`security`, `qa`, `product`/`ux`).

---

## 4. Riesgos clínicos y legales

| # | Riesgo | Impacto | Mitigación (funcional) |
| :- | :--- | :--- | :--- |
| R1 | Consentimiento ausente o firmado sobre texto distinto al mostrado | Invalidez legal; responsabilidad profesional | Texto **versionado**; firma atada a versión exacta; advertencia bloqueante al tratar sin consentimiento (HU-D1). |
| R2 | Anamnesis o evolución modificadas tras la firma | Pérdida de valor probatorio | **Inmutabilidad + enmienda versionada** auditada (HU-A4, HU-E1). |
| R3 | Firma del paciente sin verificación de identidad/parentesco | Repudio posterior | Registro de nombre, parentesco y titular Sí/No; fecha/hora; AuditEvent. |
| R4 | PDF exportado sin campos obligatorios → rechazo de la obra social | Pérdida de cobertura/cobro | Validación previa a exportar; modo "borrador" claramente marcado (HU-G1). |
| R5 | Falta de M.N./M.P. y sello profesional en consentimiento | No reconocido por PAMI | Campo obligatorio de matrícula y sello del profesional en HU-D1. |
| R6 | Confusión existente/planificado por depender solo del color | Error clínico; problemas de accesibilidad | Etiqueta textual + símbolo además del color; leyenda obligatoria (HU-B1, HU-B3). |
| R7 | Duplicación de datos (alergias, medicación, antecedentes) entre anamnesis y módulos existentes | Inconsistencia clínica | Anamnesis **enlaza** con `AllergyIntolerance`/`MedicationRequest` existentes, no los duplica (HU-A1, HU-A2). |
| R8 | Datos sensibles cruzando inquilinos | Brecha Zero Trust | Todos los recursos nuevos filtrados por `tenantId`; certificación del Quality Gate de `security`. |
| R9 | Pérdida del PDF/firma ante auditoría retroactiva | Sin respaldo probatorio | PDF persistido como `DocumentReference`/`Media` + AuditEvent inmutable. |

---

## 5. Puntos de decisión para el Orquestador / Super Admin

1. **Verificación de identidad del paciente al firmar:** ¿firma en pantalla táctil (canvas), OTP, o ambas? Impacta R3 y la dependencia con el Portal del Paciente (Módulo 7).
2. **Alcance de la codificación del diagnóstico:** ¿se exige CIE-10/SNOMED en diagnóstico presuntivo o se acepta texto libre en Fase 1?
3. **Fidelidad del PDF:** ¿réplica pixel-a-pixel del formulario oficial PAMI, o formato propio "equivalente" aceptado por la obra social? Definir antes de Fase 3.
4. **Plantillas de consentimiento por tenant/white-label:** ¿texto legal único o configurable por clínica?
5. **Embarazo/sexo en anamnesis Jujuy:** ¿se muestra siempre o condicionado al sexo registrado?
6. **Bloqueo duro vs. blando** al tratar sin consentimiento (R1): ¿impedir o solo advertir y auditar?

---

## 6. Trazabilidad con el backlog

- Extiende el **Módulo 3** (Historia Clínica). Sugerencia de nuevas entradas en `docs/backlog.json` (a crear por el Orquestador vía `backlog-sync`): REQ-003-ENC-3.13 (Anamnesis estructurada PAMI), 3.14 (Odontograma doble capa + simbología), 3.15 (Estado bucal/diagnóstico/plan), 3.16 (Consentimiento informado odontológico), 3.17 (Anexo de evolución), 3.18 (Datos de afiliado PAMI), 3.19 (Exportación PDF oficial PAMI).
- Reutiliza/cruza: REQ-002-PAT-* (Patient/cobertura), REQ-003-ENC-3.6 (antecedentes), 3.7 (odontograma), 3.8/3.10 (alergias/documentos), 3.4 (firma), REQ-004-RX-* (medicación), REQ-007-POR-7.4 (consentimiento).

---

## 7. Certificación funcional (Quality Gate de `product`)

Una fase se certifica como cumplida cuando:
- Todos los criterios de aceptación de sus HU son verificables y verificados.
- El flujo clínico reproduce el formulario real (PAMI y/o Jujuy) sin pasos faltantes.
- Inmutabilidad, firma y trazabilidad funcionan extremo a extremo (R1-R3, R9).
- La UI es 100% responsiva y no depende solo del color (R6).
- El aislamiento multi-inquilino está verificado por `security` (R8).
