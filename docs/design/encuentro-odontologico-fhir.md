# Mapeo HL7 FHIR R4 — Encuentro / Visita odontológica (módulo odontológico aislado)

> Agente: `fhir-mcp`. Fase: **SOLO DISEÑO de interoperabilidad** (no implementa código, SQL ni odontograma SVG/ProtesisTab).
> Alcance: modelar la **visita odontológica** como recurso `Encounter` FHIR R4, vincular las prestaciones (`Procedure`/`Condition`/`Observation`) a ese encuentro, definir la auditoría (`AuditEvent`) y la inmutabilidad/firma (`Provenance` + campos), y listar la terminología (SNOMED CT / LOINC) necesaria.
> Documentos relacionados (no los contradice; los complementa):
> - `docs/design/hc-odontologica-fhir.md` — mapeo de anamnesis, estado bucal, odontograma doble capa, consentimiento y evolución (sigue vigente).
> - `docs/walkthroughs/2026-05-29_hc_odontologica_modulo_aislado.md` — fuente de verdad de la implementación aislada.

---

## 0. Contexto verificado (no re-derivado)

Verificado contra el repo en esta sesión:

| Elemento | Realidad en el código | Fuente |
| :-- | :-- | :-- |
| `EncounterEntity` (tabla `fhir_encounters`) | Existe; la usa la **HC original SOAP**. Tiene `status` (in-progress/finished/cancelled), `class_code` (AMB/URG/CTRL/INTER), `start_date`, `end_date`, `payload` JSONB, `signed_by`, `signed_at`, `content_hash`. El módulo odontológico **NO la usa hoy**. | `hce-backend/src/encounter/encounter.entity.ts` |
| Recursos odontológicos | Se guardan **sueltos** (`Procedure`/`Condition`/`Observation`/`CarePlan`/`QuestionnaireResponse`) en `odontology_clinical_resources` (payload JSONB), **sin referencia a encuentro**. | `hce-backend/src/odontology/odontology-resource.entity.ts` |
| Turno | Recurso FHIR `Appointment` (`proposed→booked→arrived→fulfilled→cancelled/noshow`) en `fhir_appointments`. | `hce-backend/src/appointment/appointment.entity.ts` |
| Catálogo de prestaciones | `hce-frontend/src/components/odontology/odontogram-catalog.ts` — cada estado con `snomed.code/display` + `resourceType` (Condition/Procedure). | catálogo |
| Patrón de auditoría existente | `appointment_audit_log` (action CREATE/CANCEL/UPDATE, actor, `is_service_account`, `origin_channel`, `payload_snapshot`), declarado "compatible con AuditEvent FHIR R4". | `hce-backend/src/appointment/appointment-audit.entity.ts` |

> **Nota de reutilización de entidad (decisión para `architect`, fuera de mi dominio):** la `EncounterEntity` actual ya modela exactamente lo que necesita la visita odontológica (status, class, period, firma, hash). Recomiendo **reutilizar la misma entidad/tabla `fhir_encounters`** con un discriminador de módulo (p. ej. `Encounter.serviceType` = odontología, o una columna `module`), en vez de crear una tabla nueva. Esto NO mezcla datos clínicos: los `Procedure/Condition/Observation` odontológicos siguen en su tabla aislada `odontology_clinical_resources`; solo el contenedor `Encounter` se comparte. Si `architect` prefiere aislamiento total, puede crear `odontology_encounters` con el mismo esquema. Cualquiera de las dos es conforme a FHIR. Yo defino el **recurso FHIR**; la persistencia la decide `architect`.

---

## 1. Recurso `Encounter` R4 — Visita odontológica

### 1.1 Mapeo del ciclo de vida (modelo elegido → `Encounter.status` R4)

`Encounter.status` es un value set R4 obligatorio (`http://hl7.org/fhir/encounter-status`). Mapeo del ciclo de la visita odontológica:

| Estado de la visita (negocio) | `Encounter.status` (R4) | `period` | Notas |
| :-- | :-- | :-- | :-- |
| Planificada (turno reservado, aún no llegó) | `planned` | sin `period.start` | Opcional; normalmente la visita se materializa recién al llegar/abrir. El turno ya vive en `Appointment` (booked). |
| Paciente llegó (sala de espera) | `arrived` | sin `period.start` (o tentativo) | Espejo de `Appointment.status = arrived`. |
| Atención en curso (en el sillón) | `in-progress` | `period.start` = apertura | **Estado de apertura.** Editable. Equivale al `in-progress` que ya usa la entidad. |
| Visita cerrada y firmada | `finished` | `period.start` + `period.end` | **Cierre + firma.** Bloqueado/inmutable (ver §4). Dispara `Appointment.status = fulfilled`. |
| Visita anulada | `cancelled` | `period.start` opcional, sin `end` | Anulación administrativa antes de firmar. |
| (no usar) `entered-in-error` | — | — | Reservado para corrección de error grosero; preferimos `cancelled` + `Provenance` (§4). |

> **Estados R4 NO usados** en odontología ambulatoria: `triaged`, `onleave`, `unknown`. Documentado para evitar que la IA o el front los emitan.

> **Compatibilidad con la entidad actual:** la `EncounterEntity` hoy define `status` con valores `in-progress|finished|cancelled`. Para soportar el ciclo completo hay que admitir además `planned` y `arrived` (cambio de dominio del campo, lo evalúa `architect`). El `payload` JSONB siempre lleva el `Encounter.status` FHIR canónico, que es la fuente de verdad terminológica.

### 1.2 Campos del recurso `Encounter` (mapeo campo-a-campo)

| Campo FHIR | Card. | Valor odontológico | Columna desnormalizada sugerida |
| :-- | :-- | :-- | :-- |
| `resourceType` | 1..1 | `"Encounter"` | — |
| `id` | 0..1 | UUID del encuentro | `fhir_encounters.id` |
| `status` | 1..1 | ver §1.1 | `status` |
| `class` | 1..1 | `AMB` (ambulatorio) — ver §1.3 | `class_code` |
| `type` | 0..* | "Consulta odontológica" (SNOMED) — ver §1.4 | — (en payload) |
| `serviceType` | 0..1 | "Odontología / Servicio dental" (SNOMED) — ver §1.5; **también actúa de discriminador de módulo** | `service_type` (si se reutiliza la entidad) |
| `priority` | 0..1 | urgencia (opcional; ESI/ActPriority) | — |
| `subject` | 0..1 (1..1 en la práctica) | `Patient/<id>` del paciente | `patient_id` |
| `participant` | 0..* | profesional interviniente (ver §1.6) | — (en payload) |
| `appointment` | 0..* | `Appointment/<id>` que originó la visita (ver §1.7) | nueva col. `appointment_id` (sugerida) |
| `period` | 0..1 | `start` = apertura, `end` = cierre/firma | `start_date`, `end_date` |
| `reasonCode` | 0..* | motivo de consulta (SNOMED/LOINC) — ver §1.8 | — (en payload) |
| `reasonReference` | 0..* | `Condition/<id>` (p. ej. caries que motiva) | — |
| `diagnosis` | 0..* | `Condition/<id>` diagnosticadas en la visita + `use` | — |
| `serviceProvider` | 0..1 | `Organization/<tenant>` | (derivable de `tenant_id`) |
| `meta.tag` | 0..* | etiqueta de tenant (Zero Trust) | `tenant_id` |

**Multi-inquilino (Zero Trust):** `tenant_id` se conserva como columna (filtrado obligatorio) y se refleja en `Encounter.serviceProvider → Organization/<tenant>` y/o `meta.tag`. Ningún recurso cruza tenant.

### 1.3 `class` — clase del encuentro

```json
"class": {
  "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  "code": "AMB",
  "display": "ambulatory"
}
```
Odontología de consultorio = **siempre AMB** (ambulatorio). `URG` (urgencia) y `CTRL` (seguimiento/control) quedan disponibles si en el futuro se distingue, alineado con el `class_code` que ya admite la entidad.

> `v3-ActCode` es el CodeSystem correcto y obligatorio para `Encounter.class` en R4 (no SNOMED).

### 1.4 `type` — tipo de encuentro (SNOMED)

```json
"type": [{
  "coding": [{
    "system": "http://snomed.info/sct",
    "code": "53110001",
    "display": "Consulta odontológica"
  }],
  "text": "Consulta odontológica"
}]
```

| Concepto | Sistema | Código propuesto | Display | Estado |
| :-- | :-- | :-- | :-- | :-- |
| Consulta odontológica (tipo de encuentro) | SNOMED | **53110001** | Dental care / Consulta odontológica | **A CONFIRMAR** contra edición SNOMED CT vigente / extensión argentina. Alternativas candidatas: `327121000000104`, `225362009`. |

> **Marcado A CONFIRMAR (qa):** el código exacto para "consulta/atención odontológica" como `Encounter.type` debe verificarse con la terminología oficial. El `text` "Consulta odontológica" es siempre válido aunque el `code` se ajuste.

### 1.5 `serviceType` — servicio prestado (SNOMED) + discriminador de módulo

```json
"serviceType": {
  "coding": [{
    "system": "http://snomed.info/sct",
    "code": "9482002",
    "display": "Servicio odontológico"
  }],
  "text": "Odontología"
}
```

| Concepto | Sistema | Código propuesto | Display | Estado |
| :-- | :-- | :-- | :-- | :-- |
| Servicio odontológico (área/servicio) | SNOMED | **9482002** | Dental service / Servicio odontológico | **A CONFIRMAR**. (HL7 define también un value set `service-type` propio; si se prefiere ese, usar `system = http://terminology.hl7.org/CodeSystem/service-type` con el código de "Dental".) |

Este campo cumple doble función: terminología FHIR **y** discriminador para separar las visitas odontológicas del resto si se comparte `fhir_encounters` (ver §0).

### 1.6 `participant` — profesional interviniente

```json
"participant": [{
  "type": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
      "code": "PPRF",
      "display": "primary performer"
    }]
  }],
  "period": { "start": "2026-06-15T10:00:00-03:00" },
  "individual": { "reference": "PractitionerRole/<id>" }
}]
```

- `participant.individual` → `PractitionerRole/<id>` (preferido sobre `Practitioner/<id>` porque liga al rol en el tenant/obra social; consistente con `hc-odontologica-fhir.md §6.3`).
- `participant.type.code = PPRF` (primary performer) para el odontólogo tratante. Si hay ayudante/auxiliar, segundo participant con `SPRF` (secondary performer).
- En el repo, `Appointment` guarda `practitioner_ref` / `practitioner_name` desnormalizados; el `Encounter` hereda ese profesional al abrirse.

### 1.7 `appointment` — vínculo turno ↔ visita

```json
"appointment": [{ "reference": "Appointment/<id>" }]
```

- El `Encounter` referencia el `Appointment` que lo originó (relación FHIR estándar y direccional: el Encounter apunta al Appointment).
- **Regla de negocio del modelo elegido:** al pasar `Encounter.status` a `finished` (cierre + firma), el sistema actualiza `Appointment.status → fulfilled` (atendido). Esta transición debe quedar auditada (§3).
- Visitas sin turno (paciente espontáneo / urgencia sin agenda): `Encounter.appointment` ausente — **válido** (cardinalidad 0..*).
- Persistencia sugerida: columna `appointment_id` en `fhir_encounters` para join rápido agenda↔evolución (lo decide `architect`).

### 1.8 `reasonCode` — motivo de la visita

```json
"reasonCode": [{
  "coding": [{ "system": "http://snomed.info/sct", "code": "29857009", "display": "Dolor dental" }],
  "text": "Dolor en pieza 36"
}]
```

- `reasonCode` para el motivo codificado; `reasonReference → Condition/<id>` cuando el motivo es un diagnóstico ya registrado (p. ej. la caries de la pieza 36).
- Se alinea con el ítem de anamnesis `motivo-consulta` (LOINC 42349-1) de `hc-odontologica-fhir.md`: el texto del motivo puede copiarse a `reasonCode.text` y/o la `QuestionnaireResponse` referenciar este `Encounter`.

### 1.9 Ejemplo — apertura (visita en curso)

```json
{
  "resourceType": "Encounter",
  "status": "in-progress",
  "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB", "display": "ambulatory" },
  "type": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "53110001", "display": "Consulta odontológica" }], "text": "Consulta odontológica" }],
  "serviceType": { "coding": [{ "system": "http://snomed.info/sct", "code": "9482002", "display": "Servicio odontológico" }], "text": "Odontología" },
  "subject": { "reference": "Patient/<id>" },
  "participant": [{
    "type": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", "code": "PPRF", "display": "primary performer" }] }],
    "individual": { "reference": "PractitionerRole/<id>" }
  }],
  "appointment": [{ "reference": "Appointment/<id>" }],
  "period": { "start": "2026-06-15T10:00:00-03:00" },
  "reasonCode": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "29857009", "display": "Dolor dental" }], "text": "Dolor en pieza 36" }],
  "serviceProvider": { "reference": "Organization/<tenant>" }
}
```

### 1.10 Ejemplo — cierre (visita finalizada y firmada)

```json
{
  "resourceType": "Encounter",
  "id": "<id>",
  "status": "finished",
  "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB", "display": "ambulatory" },
  "type": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "53110001", "display": "Consulta odontológica" }] }],
  "subject": { "reference": "Patient/<id>" },
  "participant": [{ "individual": { "reference": "PractitionerRole/<id>" } }],
  "appointment": [{ "reference": "Appointment/<id>" }],
  "period": { "start": "2026-06-15T10:00:00-03:00", "end": "2026-06-15T10:35:00-03:00" },
  "diagnosis": [{
    "condition": { "reference": "Condition/<id-caries-36>" },
    "use": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role", "code": "AD", "display": "Admission diagnosis" }] }
  }]
}
```
> La firma y el hash NO viven dentro del `Encounter` (que es mutable por diseño FHIR); viven en `Provenance` + los campos `signed_by`/`signed_at`/`content_hash`. Ver §4.

---

## 2. Vínculo de prestaciones (`Procedure`/`Condition`/`Observation`) al `Encounter`

Cada recurso clínico generado durante la visita **referencia el Encounter abierto**. Esto convierte la lista de Encounters en la **evolución** (línea de tiempo), y permite reconstruir "qué se hizo en cada visita".

### 2.1 `Procedure` (prestaciones realizadas — capa EXISTENTE del odontograma)

| Campo | Valor |
| :-- | :-- |
| `Procedure.encounter` | `{ "reference": "Encounter/<id>" }` — visita en la que se realizó |
| `Procedure.subject` | `Patient/<id>` |
| `Procedure.status` | `completed` (realizado) — coherente con el odontograma doble capa |
| `Procedure.code` | SNOMED del catálogo (`odontogram-catalog.ts`) |
| `Procedure.bodySite` | `coding[0]` = pieza FDI, `coding[1]` = cara (convención existente) |
| `Procedure.performer` | `PractitionerRole/<id>` (mismo profesional del Encounter.participant) |
| **`performedDateTime` vs `performedPeriod`** | **Regla:** acto puntual (extracción, sellante, una restauración en el día) → `performedDateTime` (instante, normalmente = `Encounter.period.start`). Tratamiento que abarca varias sesiones/se extiende en el tiempo (endodoncia multisesión, colocación de corona con preparación + cementado) → `performedPeriod` (`start`/`end`). Si el tratamiento cruza **varias visitas**, cada sesión es un `Procedure` ligado a su propio `Encounter`, y pueden encadenarse con `Procedure.partOf → Procedure/<id-principal>`. |

```json
{
  "resourceType": "Procedure",
  "status": "completed",
  "encounter": { "reference": "Encounter/<id>" },
  "subject": { "reference": "Patient/<id>" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "30097004", "display": "Extracción simple de pieza dental" }], "text": "Extracción simple" },
  "bodySite": [{ "coding": [
    { "system": "http://snomed.info/sct", "code": "36", "display": "Pieza dental 36" }
  ] }],
  "performedDateTime": "2026-06-15T10:20:00-03:00",
  "performer": [{ "actor": { "reference": "PractitionerRole/<id>" } }]
}
```

> **Capa A REALIZAR:** las prestaciones planificadas se modelan con `ServiceRequest`/`CarePlan` (ver `hc-odontologica-fhir.md §3`). Un `ServiceRequest` planificado **no** se liga a un `Encounter` de ejecución (todavía no ocurrió); cuando se ejecuta, nace el `Procedure(completed, basedOn→ServiceRequest, encounter→Encounter)`. Así el `Encounter` solo agrupa lo efectivamente realizado en esa visita.

### 2.2 `Condition` (diagnósticos / hallazgos)

| Campo | Valor |
| :-- | :-- |
| `Condition.encounter` | `{ "reference": "Encounter/<id>" }` — visita donde se diagnosticó |
| `Condition.subject` | `Patient/<id>` |
| `Condition.recordedDate` | fecha/hora en que se registró (≈ `Encounter.period.start`) |
| `Condition.onsetDateTime` | inicio del problema, si se conoce (puede ser anterior a la visita) |
| `Condition.code` | SNOMED del catálogo (caries 80967001, ausencia 272673000, etc.) |
| `Condition.clinicalStatus` | `active` (hallazgo presente) |
| `Condition.verificationStatus` | `confirmed` o `provisional` (diagnóstico presuntivo) |
| `Condition.bodySite` | pieza FDI (+ cara) |

```json
{
  "resourceType": "Condition",
  "clinicalStatus": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active" }] },
  "verificationStatus": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "confirmed" }] },
  "encounter": { "reference": "Encounter/<id>" },
  "subject": { "reference": "Patient/<id>" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "80967001", "display": "Caries dental" }], "text": "Caries dental activa" },
  "bodySite": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "36", "display": "Pieza dental 36" }] }],
  "recordedDate": "2026-06-15T10:05:00-03:00"
}
```

> **Distinción `encounter` vs `recordedDate` vs `onsetDateTime`:** `encounter` = en qué visita se registró (vínculo estructural); `recordedDate` = cuándo se anotó en la HCE (auditoría temporal); `onsetDateTime` = cuándo empezó clínicamente el problema (puede preceder a la visita). Las tres son independientes y deben distinguirse para no falsear la cronología.

### 2.3 `Observation` (estado bucal, mediciones, tabaquismo)

| Campo | Valor |
| :-- | :-- |
| `Observation.encounter` | `{ "reference": "Encounter/<id>" }` |
| `Observation.subject` | `Patient/<id>` |
| `Observation.status` | `final` |
| `Observation.effectiveDateTime` | momento de la observación |
| `Observation.code` | LOINC/SNOMED según el dato (placa, sangrado, tabaquismo LOINC 72166-2, etc.) |
| `Observation.value[x]` | `valueBoolean`/`valueQuantity`/`valueCodeableConcept` |

```json
{
  "resourceType": "Observation",
  "status": "final",
  "encounter": { "reference": "Encounter/<id>" },
  "subject": { "reference": "Patient/<id>" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "70819003", "display": "Placa dental" }] },
  "valueBoolean": true,
  "effectiveDateTime": "2026-06-15T10:08:00-03:00"
}
```

### 2.4 `QuestionnaireResponse` (anamnesis)

Ya contempla `encounter` en `hc-odontologica-fhir.md §1.3`. La anamnesis tomada/actualizada en una visita liga su QR a ese `Encounter`.

### 2.5 La evolución = lista de Encounters

La **evolución clínica** se construye consultando los `Encounter` del paciente ordenados por `period.start` desc. Cada Encounter expone (vía `_revinclude` o consulta por `encounter`) sus `Procedure`/`Condition`/`Observation`/`QuestionnaireResponse`. Resultado: timeline navegable "visita → qué pasó".

---

## 3. `AuditEvent` FHIR R4 — apertura, cierre y firma de la visita

Acciones sensibles (apertura, cierre, firma) → **una entrada de auditoría por acción**. Se alinea con el patrón ya existente `appointment_audit_log` ("compatible con AuditEvent FHIR R4"). Recomiendo el mismo enfoque para encuentros (tabla `odontology_encounter_audit_log` o reúso del esquema), persistiendo además el `AuditEvent` FHIR canónico en `payload_snapshot`.

### 3.1 Mapeo acción → `AuditEvent`

| Acción de la visita | `AuditEvent.action` | `AuditEvent.type` / `subtype` | `outcome` |
| :-- | :-- | :-- | :-- |
| Apertura (in-progress) | `C` (Create) | type `rest`; subtype `create` | `0` (success) |
| Edición de borrador | `U` (Update) | subtype `update` | `0` |
| Cierre + firma (finished) | `U` (Update) | subtype `update` + acto de firma | `0` |
| Anulación (cancelled) | `D`/`U` | subtype `update` (cambio de estado) | `0` |
| Addendum tras firma | `C` (Create) | nuevo recurso enmienda | `0` |

> `AuditEvent.action` usa el value set R4 `audit-event-action` (`C/R/U/D/E`). `outcome`: `0` success, `4` minor failure, `8` serious failure (CodeSystem `audit-event-outcome`).

### 3.2 Estructura de `AuditEvent`

| Campo FHIR | Valor |
| :-- | :-- |
| `type` | `{ system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest" }` |
| `subtype` | `create` / `update` (`http://hl7.org/fhir/restful-interaction`) |
| `action` | `C` / `U` / `D` (`http://terminology.hl7.org/CodeSystem/audit-event-action`) |
| `recorded` | timestamp de la acción |
| `outcome` | `0` (success) |
| `agent[]` | **profesional** que ejecutó (`who → PractitionerRole/<id>`, `requestor=true`); si fue un service-account (p. ej. CliniChat al marcar fulfilled), `agent.type` lo identifica y `is_service_account` se refleja como ya hace el log de turnos |
| `agent.network` | IP/host del cliente (Zero Trust) |
| `source` | `Organization/<tenant>` + `source.observer` del sistema HCE |
| `entity[]` | **el Encounter** (`what → Encounter/<id>`, `type=2` system-object, `role=4` domain resource); entidad secundaria = `Patient/<id>` (`role=1` patient) |

### 3.3 Ejemplo — `AuditEvent` de **cierre + firma**

```json
{
  "resourceType": "AuditEvent",
  "type": { "system": "http://terminology.hl7.org/CodeSystem/audit-event-type", "code": "rest", "display": "RESTful Operation" },
  "subtype": [{ "system": "http://hl7.org/fhir/restful-interaction", "code": "update" }],
  "action": "U",
  "recorded": "2026-06-15T10:35:00-03:00",
  "outcome": "0",
  "agent": [{
    "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", "code": "AUT", "display": "author (originator)" }] },
    "who": { "reference": "PractitionerRole/<id>" },
    "requestor": true,
    "network": { "address": "<ip>", "type": "2" }
  }],
  "source": {
    "site": "DentHCE",
    "observer": { "reference": "Organization/<tenant>" },
    "type": [{ "system": "http://terminology.hl7.org/CodeSystem/security-source-type", "code": "4", "display": "Application Server" }]
  },
  "entity": [
    {
      "what": { "reference": "Encounter/<id>" },
      "type": { "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type", "code": "2", "display": "System Object" },
      "role": { "system": "http://terminology.hl7.org/CodeSystem/object-role", "code": "4", "display": "Domain Resource" },
      "detail": [{ "type": "action-detail", "valueString": "cierre+firma; contentHash=<sha256>" }]
    },
    {
      "what": { "reference": "Patient/<id>" },
      "type": { "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type", "code": "1", "display": "Person" },
      "role": { "system": "http://terminology.hl7.org/CodeSystem/object-role", "code": "1", "display": "Patient" }
    }
  ]
}
```

> Para apertura: `subtype.code = "create"`, `action = "C"`, `agent.type.code = "AUT"`. La estructura es idéntica salvo esos campos.
> **Coordinación con `security`:** la captura de IP/host, la identidad del agente (Keycloak) y la inmutabilidad del log son dominio de `security`. Yo defino el recurso FHIR; las llaves/tokens NO se tocan acá.

---

## 4. Inmutabilidad / firma (modelo FHIR)

### 4.1 Decisión: `Provenance` (firma legal) + campos `signed_by`/`signed_at`/`content_hash` (integridad operativa)

FHIR no congela un recurso por sí mismo (`Encounter` es mutable). La inmutabilidad clínica se logra combinando **dos capas** que ya tienen base en el repo:

1. **Capa de integridad operativa (ya existe en `EncounterEntity`):** al firmar, se calcula `content_hash` = SHA-256 del contenido clínico canónico de la visita (Encounter + sus Procedure/Condition/Observation serializados de forma determinística) y se sellan `signed_by` + `signed_at`. Tras esto la API rechaza toda mutación del Encounter `finished` y sus recursos ligados (regla de negocio, dominio `architect`/`security`). Esto reutiliza exactamente los campos que la entidad ya tiene.

2. **Capa FHIR canónica (`Provenance`):** se emite un `Provenance` que **firma** la visita y es el registro legal/interoperable de quién, cuándo y sobre qué se firmó.

| ¿Por qué `Provenance` y no solo campos? | Motivo |
| :-- | :-- |
| Interoperabilidad | `Provenance` es exportable a otros sistemas FHIR; los campos `signed_by`/`hash` son privados del esquema. |
| Firma criptográfica estándar | `Provenance.signature` usa el value set de tipos de firma ISO (`urn:iso-astm:E1762-95:2013`). |
| Cadena de custodia | `Provenance.target` puede apuntar al Encounter **y** a cada Procedure/Condition firmados en bloque. |

`content_hash` se transporta también dentro de `Provenance.signature.data` (firma) o como `Provenance.signature.sigFormat` + hash, para que la prueba de integridad viaje con el recurso FHIR.

### 4.2 `Provenance` de la firma de cierre

```json
{
  "resourceType": "Provenance",
  "target": [
    { "reference": "Encounter/<id>" },
    { "reference": "Procedure/<id-1>" },
    { "reference": "Condition/<id-1>" }
  ],
  "recorded": "2026-06-15T10:35:00-03:00",
  "activity": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation", "code": "UPDATE", "display": "revise" }] },
  "agent": [{
    "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type", "code": "author", "display": "Author" }] },
    "who": { "reference": "PractitionerRole/<id>" }
  }],
  "signature": [{
    "type": [{ "system": "urn:iso-astm:E1762-95:2013", "code": "1.2.840.10065.1.12.1.1", "display": "Author's Signature" }],
    "when": "2026-06-15T10:35:00-03:00",
    "who": { "reference": "PractitionerRole/<id>" },
    "targetFormat": "application/fhir+json",
    "sigFormat": "application/jose",
    "data": "<base64: firma/JWS que incluye el SHA-256 content_hash>"
  }]
}
```

### 4.3 Addenda / enmiendas tras la firma (cómo corregir sin romper inmutabilidad)

**Principio:** un `Encounter` `finished` **no se edita ni se borra**. Para agregar/corregir información se crea un **nuevo recurso** que se relaciona con el original. Dos mecanismos complementarios:

1. **Recurso enmienda con `relatesTo` (cuando el recurso lo soporta).** Para una nota/anexo se usa una `Composition`/`DocumentReference` de addendum:
   ```json
   "relatesTo": [{
     "code": "appends",
     "targetReference": { "reference": "Composition/<id-nota-original>" }
   }]
   ```
   Códigos R4 de `relatesTo`: `appends` (anexa), `replaces` (reemplaza), `transforms`, `signs`. Para corrección clínica que **sustituye** → `replaces`; para agregado que **suma** sin invalidar → `appends`.

2. **`Provenance` del addendum (siempre).** Todo addendum genera su propio `Provenance` con `activity = "amend"` y `target` apuntando al recurso nuevo **y** al recurso original, dejando la cadena de custodia:
   ```json
   {
     "resourceType": "Provenance",
     "target": [
       { "reference": "Procedure/<id-correccion>" },
       { "reference": "Procedure/<id-original>" }
     ],
     "recorded": "2026-06-16T09:00:00-03:00",
     "activity": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation", "code": "AMEND", "display": "amend" }] },
     "agent": [{ "who": { "reference": "PractitionerRole/<id>" } }],
     "signature": [{ "type": [{ "system": "urn:iso-astm:E1762-95:2013", "code": "1.2.840.10065.1.12.1.6", "display": "Modification Signature" }], "when": "2026-06-16T09:00:00-03:00", "who": { "reference": "PractitionerRole/<id>" }, "data": "<base64>" }]
   }
   ```

3. **Error grosero (no corrección):** si una prestación se cargó por error, el recurso original pasa a `status = entered-in-error` (NO se borra) y un `Provenance` lo registra. El Encounter firmado permanece intacto; el `entered-in-error` deja la traza.

> El addendum **nunca** muta el recurso firmado: o crea uno que lo `replaces`/`appends`, o marca el original `entered-in-error`. La verdad histórica se preserva siempre. Esto enlaza con el `AuditEvent` (§3.1, fila "Addendum") y con la conformidad por `Provenance` ya definida en `hc-odontologica-fhir.md §5`.

---

## 5. Terminología requerida (SNOMED CT / LOINC)

### 5.1 Nuevos códigos que introduce este documento (encuentro)

| Concepto | Sistema | Código | Display | Estado |
| :-- | :-- | :-- | :-- | :-- |
| Tipo de encuentro: Consulta odontológica | SNOMED | **53110001** | Consulta odontológica / Dental care | **A CONFIRMAR (qa)** |
| Servicio: Odontología | SNOMED | **9482002** | Servicio odontológico / Dental service | **A CONFIRMAR (qa)** |
| Motivo: Dolor dental (ejemplo) | SNOMED | 29857009 | Dolor dental | OK |
| Clase de encuentro: Ambulatorio | v3-ActCode | AMB | ambulatory | OK (CodeSystem obligatorio R4) |
| Rol participante: ejecutor primario | v3-ParticipationType | PPRF | primary performer | OK |
| Motivo de consulta (alt. LOINC) | LOINC | 42349-1 | Reason for visit | OK (ya en anamnesis) |

### 5.2 Códigos de infraestructura FHIR usados (CodeSystems estándar, no requieren confirmación)

| Uso | CodeSystem |
| :-- | :-- |
| `Encounter.status` | `http://hl7.org/fhir/encounter-status` |
| `Encounter.class` | `http://terminology.hl7.org/CodeSystem/v3-ActCode` |
| `Encounter.diagnosis.use` | `http://terminology.hl7.org/CodeSystem/diagnosis-role` |
| `AuditEvent.action` | `http://terminology.hl7.org/CodeSystem/audit-event-action` |
| `AuditEvent.outcome` | `http://terminology.hl7.org/CodeSystem/audit-event-outcome` |
| `AuditEvent.entity.type/role` | `audit-entity-type` / `object-role` |
| `Provenance.activity` | `http://terminology.hl7.org/CodeSystem/v3-DataOperation` |
| `*.signature.type` | `urn:iso-astm:E1762-95:2013` (firmas ISO) |
| `relatesTo.code` | value set R4 de relación de documentos (`appends/replaces/...`) |

> Las prestaciones (Procedure/Condition) ya tienen su SNOMED en `odontogram-catalog.ts` y en `hc-odontologica-fhir.md §3.3`. Este documento **no** redefine esos códigos.

### 5.3 Marcas A CONFIRMAR para `qa` (skill `fhir-validator` + terminología oficial)

1. SNOMED **53110001** (consulta odontológica, `Encounter.type`) — verificar concepto vigente / extensión argentina.
2. SNOMED **9482002** (servicio odontológico, `Encounter.serviceType`) — confirmar o cambiar a value set HL7 `service-type`.
3. Confirmar que la edición SNOMED CT del entorno tenga activos los códigos del catálogo marcados antes como dudosos en `hc-odontologica-fhir.md §8` (no es alcance de este doc, pero afecta `Encounter.diagnosis`/`Procedure` ligados).

---

## 6. Compatibilidad con lo existente

| Situación | ¿Conforme FHIR? | Comportamiento |
| :-- | :-- | :-- |
| Recursos odontológicos ya guardados **sin** `encounter` | **Sí.** `Procedure.encounter`, `Condition.encounter`, `Observation.encounter` son **0..1** en R4. | Quedan válidos. Se interpretan como "registrados fuera del flujo de visita". No requieren migración. |
| Lectura de evolución antigua | OK | Los recursos sin `encounter` se listan por `recordedDate`/`performedDateTime`/`effectiveDateTime` en lugar de agruparse por visita. La timeline degrada con elegancia. |
| Migración opcional | No obligatoria | Si se quiere agrupar histórico, se puede generar un `Encounter` sintético retroactivo por fecha y ligar los recursos vía `relatesTo`/`Provenance`. **No** se altera el contenido clínico original (inmutabilidad §4). |
| HC original SOAP (`fhir_encounters`) | Intacta | Si `architect` reutiliza la tabla, la visita odontológica se distingue por `serviceType`/`module`; los Encounters SOAP no se ven afectados. |
| Odontograma doble capa (`Procedure.status` + extensión `odontogram-layer`) | Intacto | Este doc solo **agrega** `Procedure.encounter`; no toca `status` ni la extensión de capa. |

**Regla de oro de compatibilidad:** el campo `encounter` es **aditivo y opcional**. Activar el flujo de visitas no invalida ni reescribe nada de lo ya persistido.

---

## 7. Resumen para el Orquestador y agentes vecinos

| Tema | Decisión | Agente que continúa |
| :-- | :-- | :-- |
| Recurso de visita | `Encounter` R4 (status planned/arrived/in-progress/finished/cancelled), class AMB, type+serviceType SNOMED, appointment→Appointment, participant→PractitionerRole | `architect` (persistencia: reutilizar `fhir_encounters` con discriminador o tabla nueva) |
| Vínculo prestaciones | `Procedure/Condition/Observation/QuestionnaireResponse`.`encounter → Encounter/<id>` (aditivo, opcional) | `architect` (ampliar servicio para sellar `encounter`) |
| `performedDateTime` vs `performedPeriod` | puntual = DateTime; multisesión = Period; cross-visita = un Procedure por Encounter + `partOf` | `architect` |
| Auditoría | `AuditEvent` por apertura/cierre/firma; reutilizar patrón `appointment_audit_log` | `security` (identidad, IP, inmutabilidad del log) |
| Inmutabilidad/firma | `Provenance` + `signed_by`/`signed_at`/`content_hash` (SHA-256); addenda = recurso nuevo con `relatesTo`/`entered-in-error`, nunca edición | `security` (firma criptográfica), `architect` (bloqueo de mutación) |
| Turno↔visita | al `finished` → `Appointment.status = fulfilled` (auditado) | `architect` (transición de estado) |
| Terminología a confirmar | SNOMED 53110001, 9482002 | `qa` (`fhir-validator` + terminología oficial) |
| Compatibilidad | `encounter` 0..1 → lo existente sin encuentro sigue válido, sin migración | — |

> **Límites de dominio respetados:** este documento es solo mapeo FHIR/terminología. No define SQL, índices, redes, llaves criptográficas ni tokens Keycloak (eso es `architect`/`security`/`devops`). No toca el odontograma SVG ni `ProtesisTab`.
