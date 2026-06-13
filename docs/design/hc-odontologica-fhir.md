# Mapeo de Interoperabilidad FHIR R4 — Historia Clínica Odontológica (PAMI / Círculo Odontológico de Jujuy)

> ⚠️ **SUPERSEDIDO PARCIAL (2026-05-29).** El mapeo FHIR sigue vigente, pero la implementación real usa una **tabla/endpoints AISLADOS** (`odontology_clinical_resources` / `/odontology`) y, para el odontograma de doble capa, `Procedure.status` + extensión `odontogram-layer` (no `ServiceRequest/CarePlan`). **Fuente de verdad:** `docs/walkthroughs/2026-05-29_hc_odontologica_modulo_aislado.md`.

> Agente: `fhir-mcp`. Fase: DISEÑO de interoperabilidad.
> Alcance: mapeo campo-a-campo a HL7 FHIR R4 + terminologías (SNOMED CT, LOINC, CIE-10) para el módulo "Historia Clínica Odontológica".
> NO contiene SQL ni implementación. El modelo de persistencia lo define `architect`.

## 0. Principios de diseño

1. **Reutilizar lo existente.** El repo ya persiste el odontograma como `Condition` (caries, ausente) y `Procedure` (restauración, endodoncia, corona, implante, sellador) vía `POST /fhir/r4/Patient/:id/clinical-resource`, con `bodySite.coding[0]` = pieza FDI y `bodySite.coding[1]` = cara. Mantenemos esa convención.
2. **No duplicar datos.** Alergias → `AllergyIntolerance` (pestaña existente). Antecedentes/enfermedades crónicas → `Condition`. La anamnesis NO copia estos valores; los **referencia**.
3. **EXISTENTE vs A REALIZAR** es la decisión transversal del odontograma. Se modela con `Procedure.status` + `CarePlan`/`ServiceRequest`, no con códigos distintos.
4. **Sistemas de codificación canónicos:**
   - SNOMED CT → `http://snomed.info/sct`
   - LOINC → `http://loinc.org`
   - CIE-10 → `http://hl7.org/fhir/sid/icd-10` (alias proyecto: CIE-10)
   - Caras dentales (FDI surface) → `http://terminology.hl7.org/CodeSystem/FDI-surface`
   - Numeración dental → la pieza FDI se codifica con SNOMED del diente (ver §3.4); el número FDI crudo (11–48 / 51–85) se conserva en `bodySite.coding[].code` como identificador operativo, compatible con el odontograma actual.

---

## 1. ANAMNESIS / Cuestionario PAMI

### 1.1 Decisión: `Questionnaire` + `QuestionnaireResponse` (NO Observation individual por pregunta)

**Recomendación:** modelar el cuestionario PAMI como **un `Questionnaire` canónico** (la plantilla, versionada) y **una `QuestionnaireResponse` por consulta/afiliado** (las respuestas).

Justificación:
- El cuestionario es un formulario sí/no con campos condicionales ("¿sufre enfermedad? → ¿cuál?"). `Questionnaire.item.enableWhen` modela exactamente esa lógica condicional.
- Genera **1 recurso** por anamnesis en vez de ~20 `Observation`, reduciendo ruido y facilitando versionado del formulario.
- **Excepción — promover a recurso de primera clase** los datos clínicamente accionables que otros módulos consultan:
  - **Tabaquismo** → además de la respuesta, emitir una `Observation` LOINC **72166-2** (Tobacco smoking status) con el conteo de cigarrillos/día en `Observation.component` LOINC **8663-7** (Cigarettes smoked current).
  - **Alergias** → NO se guardan en la QR como valor; el ítem de alergia tiene `enableWhen` y, si es positivo, la UI deriva al alta de `AllergyIntolerance` (pestaña existente). La QR solo guarda una referencia/booleano "ver AllergyIntolerance".
  - **Enfermedades crónicas (diabetes, HTA, cardiopatía)** → se reflejan como `Condition` (ver §1.4). La QR guarda el sí/no; el `Condition` es la fuente de verdad clínica.
  - **Medicación / anticoagulantes / aspirina** → `MedicationStatement` (uso reportado por paciente), no MedicationRequest (no es una prescripción nuestra).

### 1.2 `Questionnaire` (plantilla) — estructura de `item` y `linkId`

`Questionnaire.status = active`, `Questionnaire.url = http://denthce.local/Questionnaire/anamnesis-pami`, `version = 1.0.0`.

| linkId | Texto | type | Código/derivación | enableWhen |
| :-- | :-- | :-- | :-- | :-- |
| `enf-cronica` | ¿Sufre alguna enfermedad? | boolean | → genera `Condition` | — |
| `enf-cronica-cual` | ¿Cuál? | string/choice | SNOMED diagnóstico + CIE-10 | `enf-cronica = true` |
| `trat-medico` | ¿Realiza tratamiento médico? | boolean | — | — |
| `trat-medico-cual` | ¿Cuál? | string | — | `trat-medico = true` |
| `medicacion` | ¿Consume medicación? | boolean | → `MedicationStatement` | — |
| `medicacion-cual` | ¿Cuál? | string/choice | SNOMED/ATC del fármaco | `medicacion = true` |
| `alergia` | ¿Es alérgico a alguna droga? | boolean | → `AllergyIntolerance` | — |
| `alergia-cual` | ¿Cuál? | string/choice | SNOMED sustancia | `alergia = true` |
| `diabetes` | Diabetes | boolean | LOINC **45765-7** / `Condition` 73211009 | — |
| `fuma` | ¿Fuma? | boolean | LOINC **72166-2** → `Observation` | — |
| `fuma-cantidad` | Cigarrillos por día | integer | LOINC **8663-7** | `fuma = true` |
| `card` | Problemas cardíacos | boolean | `Condition` 56265001 | — |
| `hta` | Hipertensión arterial | boolean | LOINC **55284-4** / `Condition` 38341003 | — |
| `aspirina-anticoag` | ¿Toma aspirina / anticoagulantes? | boolean | → `MedicationStatement` | — |
| `operado` | ¿Fue operado? | boolean | → `Procedure` (histórico) | — |
| `operado-cual` | ¿De qué? | string | — | `operado = true` |
| `motivo-consulta` | Motivo de consulta | text | LOINC **42349-1** (Reason for visit) | — |
| `otro-profesional` | Consulta reciente con otro profesional | boolean | — | — |
| `dif-masticar` | Dificultad para masticar | boolean | SNOMED 78164000 | — |
| `dif-hablar` | Dificultad para hablar | boolean | SNOMED 29164008 | — |
| `movilidad-dentaria` | Movilidad dentaria | boolean | SNOMED 56918001 | — |
| `sangrado-encias` | Sangrado de encías | boolean | SNOMED 76705004 (Gingival bleeding) | — |
| `cepillados-dia` | Cepillados por día | integer | hábito de higiene | — |
| `momentos-azucar` | Momentos de azúcar/día | integer | hábito dietético | — |

> `Questionnaire.item.code` lleva el coding LOINC/SNOMED cuando aplica, para que la QR sea autodescriptiva terminológicamente.

### 1.3 `QuestionnaireResponse` (por consulta)

```json
{
  "resourceType": "QuestionnaireResponse",
  "status": "completed",
  "questionnaire": "http://denthce.local/Questionnaire/anamnesis-pami|1.0.0",
  "subject": { "reference": "Patient/<id>" },
  "encounter": { "reference": "Encounter/<id>" },
  "authored": "2026-05-28",
  "author": { "reference": "PractitionerRole/<id>" },
  "item": [
    { "linkId": "fuma", "answer": [{ "valueBoolean": true }] },
    { "linkId": "fuma-cantidad", "answer": [{ "valueInteger": 10 }] },
    { "linkId": "motivo-consulta", "answer": [{ "valueString": "Dolor pieza 36" }] }
  ]
}
```

### 1.4 Relación con recursos existentes (anti-duplicación)

| Dato anamnesis | Fuente de verdad | Rol de la QR |
| :-- | :-- | :-- |
| Alergia a droga | `AllergyIntolerance` (pestaña Alergias) | Solo booleano + `enableWhen` que dispara alta del recurso real |
| Diabetes / HTA / cardiopatía / enfermedad crónica | `Condition` | Booleano; al positivo, crear `Condition` (códigos §1.5) |
| Medicación habitual / anticoagulantes | `MedicationStatement` | Booleano; al positivo, crear `MedicationStatement` |
| Tabaquismo | `Observation` LOINC 72166-2 (+ component 8663-7) | Booleano + integer que poblan la Observation |
| Cirugías previas | `Procedure` con `status=completed` histórico | Booleano + string descriptivo |

### 1.5 Códigos LOINC/SNOMED de la anamnesis

| Concepto | Sistema | Código | Display |
| :-- | :-- | :-- | :-- |
| Tabaquismo (estado) | LOINC | 72166-2 | Tobacco smoking status |
| Cigarrillos/día actuales | LOINC | 8663-7 | Cigarettes smoked current (pack per day) |
| Diabetes (tamizaje) | LOINC | 45765-7 | History of Diabetes mellitus |
| Diabetes mellitus | SNOMED | 73211009 | Diabetes mellitus |
| Diabetes mellitus tipo 2 | SNOMED | 44054006 | Diabetes mellitus tipo 2 |
| HTA (panel) | LOINC | 55284-4 | Blood pressure systolic & diastolic |
| Hipertensión arterial | SNOMED | 38341003 | Trastorno hipertensivo |
| Enfermedad cardíaca | SNOMED | 56265001 | Enfermedad cardíaca |
| Motivo de consulta | LOINC | 42349-1 | Reason for visit |
| Sangrado gingival | SNOMED | 76705004 | Sangrado de encías |
| Movilidad dentaria | SNOMED | 56918001 | Movilidad dental anormal |
| Dificultad para masticar | SNOMED | 78164000 | Dificultad para masticar |
| Dificultad para hablar | SNOMED | 29164008 | Trastorno del habla |
| CIE-10 Diabetes | CIE-10 | E11 | Diabetes mellitus tipo 2 |
| CIE-10 HTA | CIE-10 | I10 | Hipertensión esencial (primaria) |

---

## 2. ESTADO BUCAL GENERAL

Cada hallazgo es una `Observation` (o `Condition` para diagnóstico). Boca completa → `bodySite` omitido o "cavidad oral" SNOMED 21082005.

| Dato | Recurso | code (SNOMED) | Notas |
| :-- | :-- | :-- | :-- |
| Placa bacteriana sí/no | Observation | 70819003 (Placa dental) | `valueBoolean` o `valueCodeableConcept` presente/ausente |
| Enfermedad periodontal sí/no | Condition | 2556008 / 18718003 (Enf. periodontal) | `clinicalStatus=active` |
| Lesión en mucosa/tejido blando | Condition | 118946009 (Trastorno de mucosa oral) | `bodySite`=zona; `note`/extensión=tipo |
| Diagnóstico presuntivo (texto) | Condition | `verificationStatus=provisional` | `code.text`=texto libre + SNOMED/CIE-10 si aplica |
| Plan de tratamiento con fecha | CarePlan | — | `period.start`/`activity` (ver §3) |
| Observaciones | Observation (note) o `Composition.section` | — | texto libre |

> El **diagnóstico presuntivo** usa `Condition.verificationStatus = provisional` (vs `confirmed`), distinción FHIR estándar para "presuntivo".

---

## 3. ODONTOGRAMA DOBLE CAPA — EXISTENTE vs A REALIZAR

### 3.1 Decisión de modelado (la clave del módulo)

| Capa | Significado | Recurso FHIR | Marcador |
| :-- | :-- | :-- | :-- |
| **EXISTENTE** (ya hecho) | Trabajo presente en boca | `Procedure` (tratamientos) / `Condition` (patología) | `Procedure.status = completed` ; `Condition.clinicalStatus = active` |
| **A REALIZAR** (planificado) | Tratamiento propuesto/aprobado | `ServiceRequest` (la orden de cada prestación) agrupadas en un `CarePlan` (el plan completo) | `ServiceRequest.intent = plan` (o `order` al autorizar), `status = active` |

**Por qué `ServiceRequest`+`CarePlan` y NO `Procedure.status=preparatory`:**
- `preparatory`/`in-progress` describen un procedimiento que **ya empezó** (paciente en sillón), no algo "a realizar a futuro". Usarlo para planificación es semánticamente incorrecto.
- `ServiceRequest` es el recurso FHIR canónico para "tratamiento solicitado/planificado", con `intent` (`proposal` → `plan` → `order`) que modela perfectamente el ciclo presupuesto → plan → autorizado.
- `CarePlan.activity[].reference → ServiceRequest` agrupa el plan odontológico completo con su fecha (`CarePlan.period`), cubriendo el requisito B "plan de tratamiento con fecha".

**Ciclo de vida de una prestación planificada:**
```
ServiceRequest(intent=plan, status=active)        ← A REALIZAR (capa plan del odontograma)
        │ al ejecutarse
        ▼
Procedure(status=completed, basedOn→ServiceRequest) ← EXISTENTE (capa realizado)
```
`Procedure.basedOn` enlaza lo hecho con lo que se planificó (trazabilidad y conformidad, §4).

### 3.2 Convención de `bodySite` (compatible con lo existente)

Se mantiene la del odontograma actual:
- `bodySite.coding[0]` → **pieza FDI** (`code` = 11–48 adulto / 51–85 infantil; `system` SNOMED del diente, ver §3.4).
- `bodySite.coding[1]` → **cara dental** (V/D/L/M/O), `system = http://terminology.hl7.org/CodeSystem/FDI-surface`.

Caras (FDI surface CodeSystem):

| Cara | Código FDI-surface | Display |
| :-- | :-- | :-- |
| Vestibular/Bucal | V (B) | Vestibular |
| Distal | D | Distal |
| Lingual/Palatina | L | Lingual |
| Mesial | M | Mesial |
| Oclusal/Incisal | O (I) | Oclusal |

### 3.3 Tabla maestra: símbolo → código SNOMED → recurso → intent

> **intent** = EXISTENTE (`Procedure.status=completed`) o A-REALIZAR (`ServiceRequest.intent=plan`). El mismo código SNOMED sirve para ambas capas; lo que cambia es el recurso/estado.

| # | Símbolo (simbología PAMI) | SNOMED code | Display (es) | Recurso | EXISTENTE | A REALIZAR |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Caries (patología base) | 80967001 | Caries dental | Condition | clinicalStatus=active | — (es hallazgo) |
| 2 | Restauración simple | 23450005 | Restauración dental | Procedure / ServiceRequest | status=completed | intent=plan |
| 3 | Restauración compuesta | 234971000 | Restauración compuesta multifaz | Procedure / ServiceRequest | completed | plan |
| 4 | Endodoncia unirradicular | 234961008 | Endodoncia de conducto único | Procedure / ServiceRequest | completed | plan |
| 5 | Endodoncia multirradicular | 42425007 | Tratamiento de conducto radicular | Procedure / ServiceRequest | completed | plan |
| 6 | Momificación pulpar | 234959006 | Momificación pulpar (pulpotomía) | Procedure / ServiceRequest | completed | plan |
| 7 | Formocresol (pulpotomía) | 56433008 | Pulpotomía con formocresol | Procedure / ServiceRequest | completed | plan |
| 8 | Incrustación (inlay/onlay) | 60116006 | Incrustación dental (inlay/onlay) | Procedure / ServiceRequest | completed | plan |
| 9 | Corona | 172922005 | Corona protésica | Procedure / ServiceRequest | completed | plan |
| 10 | Perno-corona / espiga | 49454002 | Corona con perno (perno-muñón colado) | Procedure / ServiceRequest | completed | plan |
| 11 | Perno pilar (muñón) | 79827002 | Perno-muñón / pilar protésico | Procedure / ServiceRequest | completed | plan |
| 12 | Prótesis fija (puente) | 27468000 | Prótesis parcial fija (puente) | Procedure / ServiceRequest | completed | plan |
| 13 | Prótesis removible | 71166009 | Prótesis parcial removible | Procedure / ServiceRequest | completed | plan |
| 14 | Pieza ausente | 272673000 | Ausencia de pieza dental | Condition | clinicalStatus=active | — |
| 15 | Sellante / sellador | 418705001 | Aplicación de sellador de fisuras | Procedure / ServiceRequest | completed | plan |
| 16 | Implante dental | 36653000 | Implante dental | Procedure / ServiceRequest | completed | plan |
| 17 | Extracción indicada | 65546002 | Extracción dental | **ServiceRequest** | — | intent=plan (indicada) |
| 18 | Extracción realizada | 65546002 | Extracción dental | **Procedure** | status=completed | — |

> **Extracción indicada vs realizada** es el caso paradigmático: **mismo SNOMED 65546002**, diferenciado solo por el recurso/estado (`ServiceRequest.intent=plan` = indicada; `Procedure.status=completed` = realizada). Esto demuestra por qué el `intent`/recurso —y no el código— porta la semántica "existente/a-realizar".

### 3.4 SNOMED de diente (para `bodySite.coding[0].system`)

Para conformidad estricta, el diente se puede codificar con SNOMED de dentición permanente (ej. 245644006 "Diente 11", etc.). **Decisión pragmática:** se conserva el `code` FDI numérico (11–48 / 51–85) en `bodySite.coding[0].code` —como ya hace el odontograma— y se añade `bodySite.coding[0].system = http://snomed.info/sct` solo cuando se disponga del SNOMED por diente; mientras tanto el número FDI con `display "Pieza dental NN"` es la clave operativa. No se rompe lo existente.

### 3.5 Ejemplos

**A REALIZAR — extracción indicada pieza 36:**
```json
{
  "resourceType": "ServiceRequest",
  "status": "active",
  "intent": "plan",
  "subject": { "reference": "Patient/<id>" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "65546002", "display": "Extracción dental" }] },
  "bodySite": [{ "coding": [
    { "system": "http://snomed.info/sct", "code": "36", "display": "Pieza dental 36" }
  ] }],
  "occurrenceDateTime": "2026-06-10"
}
```

**EXISTENTE — restauración compuesta realizada en 36 caras O/M:**
```json
{
  "resourceType": "Procedure",
  "status": "completed",
  "basedOn": [{ "reference": "ServiceRequest/<id>" }],
  "subject": { "reference": "Patient/<id>" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "234971000", "display": "Restauración compuesta multifaz" }] },
  "bodySite": [{ "coding": [
    { "system": "http://snomed.info/sct", "code": "36", "display": "Pieza dental 36" },
    { "system": "http://terminology.hl7.org/CodeSystem/FDI-surface", "code": "O", "display": "Oclusal" }
  ] }]
}
```

**Plan completo:**
```json
{
  "resourceType": "CarePlan",
  "status": "active",
  "intent": "plan",
  "subject": { "reference": "Patient/<id>" },
  "period": { "start": "2026-05-28" },
  "activity": [
    { "reference": { "reference": "ServiceRequest/<id-extraccion>" } },
    { "reference": { "reference": "ServiceRequest/<id-corona>" } }
  ]
}
```

---

## 4. CONSENTIMIENTO INFORMADO

Recurso **`Consent`** FHIR R4.

```json
{
  "resourceType": "Consent",
  "status": "active",
  "scope": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/consentscope", "code": "treatment", "display": "Treatment" }] },
  "category": [{ "coding": [{ "system": "http://loinc.org", "code": "59284-0", "display": "Consent Document" }] }],
  "patient": { "reference": "Patient/<id>" },
  "dateTime": "2026-05-28T10:00:00-03:00",
  "performer": [{ "reference": "Patient/<id>" }],
  "organization": [{ "reference": "Organization/<tenant>" }],
  "sourceAttachment": {
    "contentType": "application/pdf",
    "title": "Consentimiento informado firmado",
    "data": "<base64>"
  },
  "provision": {
    "type": "permit",
    "period": { "start": "2026-05-28" },
    "actor": [{
      "role": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", "code": "PRCP" }] },
      "reference": { "reference": "PractitionerRole/<profesional>" }
    }],
    "action": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/consentaction", "code": "collect" }] }]
  }
}
```

Decisiones:
- `scope = treatment` (consentimiento para tratamiento, no para divulgación de datos).
- **Firmas:** el PDF/imagen firmado por paciente **y** profesional va en `Consent.sourceAttachment` (base64) o como `DocumentReference` referenciado en `Consent.sourceReference` si se quiere versionar el documento aparte. Para firma criptográfica fuerte, coordinar con `security` (`Consent` no almacena llaves).
- `provision.actor` registra al profesional interviniente; `patient`/`performer` registran al afiliado firmante.

---

## 5. ANEXO DE EVOLUCIÓN (fecha, tratamiento realizado, conformidad del afiliado)

**Decisión:** cada renglón de evolución = **un `Procedure`** (lo realizado) + **conformidad como `Provenance`** que firma ese Procedure. NO un `Consent` por procedimiento (sería sobreingeniería; `Consent` es para autorización previa, no conformidad posterior).

| Dato anexo | Mapeo |
| :-- | :-- |
| Fecha | `Procedure.performedDateTime` |
| Tratamiento realizado | `Procedure.code` (SNOMED §3.3) + `bodySite` |
| Conformidad del afiliado | `Provenance` con `agent` paciente + `signature` (firma de aceptación) sobre `target → Procedure/<id>` |

```json
{
  "resourceType": "Provenance",
  "target": [{ "reference": "Procedure/<id>" }],
  "recorded": "2026-05-28T11:30:00-03:00",
  "agent": [{
    "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type", "code": "performer" }] },
    "who": { "reference": "PractitionerRole/<profesional>" }
  }, {
    "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type", "code": "informant" }] },
    "who": { "reference": "Patient/<id>" }
  }],
  "signature": [{
    "type": [{ "system": "urn:iso-astm:E1762-95:2013", "code": "1.2.840.10065.1.12.1.7", "display": "Consent Signature" }],
    "when": "2026-05-28T11:30:00-03:00",
    "who": { "reference": "Patient/<id>" },
    "data": "<base64 firma de conformidad>"
  }]
}
```

> Esto enlaza con `AuditEvent` (ya en uso) para la traza de auditoría; coordinar con `security`.

---

## 6. AFILIADO / OBRA SOCIAL

### 6.1 `Coverage` (cobertura PAMI / Círculo Odontológico)

```json
{
  "resourceType": "Coverage",
  "status": "active",
  "beneficiary": { "reference": "Patient/<id>" },
  "payor": [{ "reference": "Organization/<obra-social>" }],
  "subscriberId": "<Nº afiliado>",
  "identifier": [
    { "system": "http://denthce.local/identifier/nro-beneficio", "value": "<Nº beneficio>" }
  ],
  "class": [{
    "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/coverage-class", "code": "plan" }] },
    "value": "PAMI"
  }]
}
```

### 6.2 `Patient.identifier` (Nº afiliado / Nº beneficio)

```json
"identifier": [
  { "use": "official", "system": "http://denthce.local/identifier/nro-afiliado", "value": "<Nº afiliado>" },
  { "use": "secondary", "system": "http://denthce.local/identifier/nro-beneficio", "value": "<Nº beneficio>" }
]
```
> El Nº afiliado vive en **ambos**: `Patient.identifier` (identidad del paciente) y `Coverage.subscriberId` (vínculo con la cobertura). Es el patrón FHIR recomendado.

### 6.3 `PractitionerRole` (código de prestador y médico de cabecera)

- **Código de prestador** (matrícula/código asignado por la obra social al odontólogo) → `PractitionerRole.identifier`.
- **Médico de cabecera** → `Patient.generalPractitioner → PractitionerRole/<id>` (referencia estándar FHIR).

```json
{
  "resourceType": "PractitionerRole",
  "practitioner": { "reference": "Practitioner/<id>" },
  "organization": { "reference": "Organization/<tenant>" },
  "identifier": [
    { "system": "http://denthce.local/identifier/codigo-prestador", "value": "<código prestador>" }
  ],
  "code": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "106292003", "display": "Odontólogo" }] }]
}
```

---

## 7. Recursos FHIR usados (resumen)

| Requerimiento | Recurso(s) FHIR R4 | Nuevo en el repo |
| :-- | :-- | :-- |
| Anamnesis | `Questionnaire` + `QuestionnaireResponse` (+ `Observation`/`Condition`/`MedicationStatement`/`AllergyIntolerance`) | Questionnaire/QR: SÍ |
| Estado bucal | `Observation`, `Condition` | No |
| Odontograma EXISTENTE | `Procedure` (completed), `Condition` | No |
| Odontograma A REALIZAR | `ServiceRequest` (intent=plan) + `CarePlan` | SÍ |
| Consentimiento | `Consent` (+ `DocumentReference`) | SÍ |
| Anexo evolución | `Procedure` + `Provenance` (firma conformidad) | Provenance: SÍ |
| Afiliado/obra social | `Coverage`, `Patient.identifier`, `PractitionerRole` | Coverage/PractitionerRole: SÍ |

> **Acción para `architect`:** el endpoint `clinical-resource.service.ts` solo admite `Condition, Procedure, AllergyIntolerance, Observation, DocumentReference, Media, MedicationStatement`. Hay que ampliar `allowedTypes` con: `Questionnaire`, `QuestionnaireResponse`, `ServiceRequest`, `CarePlan`, `Consent`, `Provenance`, `Coverage`, `PractitionerRole`. (Lo implementa `architect`, fuera de mi dominio.)

---

## 8. Validación (fhir-validator)

Validación estructural por reglas R4 (skill `fhir-validator`; no hay validador HAPI formal en el entorno):

| Recurso | Campos requeridos verificados | Resultado |
| :-- | :-- | :-- |
| QuestionnaireResponse | status, item.linkId, subject | OK |
| ServiceRequest | status, intent, subject, code | OK |
| CarePlan | status, intent, subject | OK |
| Procedure | status, subject, code | OK |
| Consent | status, scope, category, patient | OK |
| Provenance | target, recorded, agent | OK |
| Coverage | status, beneficiary, payor | OK |
| PractitionerRole | (todos 0..1) practitioner/organization | OK |

Terminología: todos los `system` SNOMED = `http://snomed.info/sct`, LOINC = `http://loinc.org`, CIE-10 = `http://hl7.org/fhir/sid/icd-10`, caras = `FDI-surface`. Sin errores bloqueantes.

**Advertencias semánticas (no bloqueantes):**
- Algunos SNOMED de odontología (momificación 234959006, restauración compuesta 234971000, endodoncia unirradicular 234961008, perno-muñón 79827002) deben confirmarse contra la edición SNOMED CT vigente / extensión argentina antes de producción; pueden variar de concepto. Recomiendo que `qa` los verifique con la terminología oficial cargada.
- `bodySite.coding[0]` usa número FDI con `system` SNOMED sin SNOMED-de-diente real: aceptable transitoriamente, idealmente migrar a SNOMED de dentición.
