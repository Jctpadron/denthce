# Mapeo FHIR R4 — Turnos por WhatsApp (CliniChat ↔ HCE)

> Entregable del agente **fhir-mcp**. Complementa `hc-turnos-whatsapp-arquitectura.md` (architect) y `hc-turnos-whatsapp-seguridad.md` (security).
> Estado: diseño aprobado. Las correcciones marcadas para architect/integrations deben aplicarse en la fase de codificación.

## 1. Recurso `Appointment` (FHIR R4) — Tarea 5.1

Perfil canónico que el HCE persiste como JSONB FHIR en `payload`, con columnas desnormalizadas para indexar.

| Campo FHIR | Card. | Notas / sistema de códigos |
| :--- | :--- | :--- |
| `status` | 1..1 | `proposed \| pending \| booked \| arrived \| fulfilled \| cancelled \| noshow \| entered-in-error \| checked-in \| waitlist`. La IA crea turnos sugeridos como `proposed`; confirmados como `booked`. |
| `cancelationReason` | 0..1 | CodeableConcept, sistema `http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason` (`pat`, `prov`, `oth-cms`) + `text`. |
| `serviceCategory` | 0..* | `http://terminology.hl7.org/CodeSystem/service-category`. |
| `serviceType` | 0..* | SNOMED CT cuando se codifique; en 5.1 puede ir como `text`. |
| `specialty` | 0..* | SNOMED CT (especialidad del profesional). |
| `appointmentType` | 0..1 | `http://terminology.hl7.org/CodeSystem/v2-0276` (`ROUTINE`, `EMERGENCY`, `FOLLOWUP`...). |
| `reasonCode` | 0..* | SNOMED CT (motivo de consulta). |
| `start` / `end` | 0..1 | **Regla `app-3`**: si hay `start` y el estado es `booked/arrived/fulfilled`, `end` es obligatorio (ambos o ninguno). Calcular `end` desde `minutesDuration`. |
| `minutesDuration` | 0..1 | Duración del slot (viene de `specialties.default_slot_minutes` en CliniChat). |
| `participant` | 1..* | **Obligatorio**. Patient + Practitioner, cada uno con `actor`, `status` (`accepted/declined/tentative/needs-action`) y `required`. |
| `created` | 0..1 | Fecha de creación del turno. |
| `comment` | 0..1 | Notas libres. |

**Canal de origen** → extensión propia (consistente con cómo `Patient` ya usa `extension` para `admission-date`):
`http://hospital.gov/fhir/StructureDefinition/origin-channel` con `valueCode` ∈ `{ whatsapp, recepcion, portal }`.

### Ejemplo: turno reservado desde WhatsApp (`booked`)

```json
{
  "resourceType": "Appointment",
  "status": "booked",
  "extension": [
    {
      "url": "http://hospital.gov/fhir/StructureDefinition/origin-channel",
      "valueCode": "whatsapp"
    }
  ],
  "serviceType": [{ "text": "Odontología" }],
  "specialty": [{
    "coding": [{ "system": "http://snomed.info/sct", "code": "1259972006", "display": "Odontología" }]
  }],
  "appointmentType": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
      "code": "ROUTINE", "display": "Rutina"
    }]
  },
  "reasonCode": [{ "text": "Control y limpieza" }],
  "start": "2026-06-03T13:00:00-03:00",
  "end": "2026-06-03T14:00:00-03:00",
  "minutesDuration": 60,
  "created": "2026-05-30T18:20:00-03:00",
  "comment": "Reservado por asistente WhatsApp (CliniChat)",
  "participant": [
    {
      "actor": {
        "reference": "Patient/3f7c...uuid",
        "display": "Juan Pérez"
      },
      "status": "accepted",
      "required": "required"
    },
    {
      "actor": {
        "reference": "Practitioner/ariel-tarcaya",
        "display": "Dr. Ariel Tarcaya"
      },
      "status": "accepted",
      "required": "required"
    }
  ]
}
```

### Ejemplo: turno cancelado (`cancelled`)

```json
{
  "resourceType": "Appointment",
  "id": "a12b...uuid",
  "status": "cancelled",
  "cancelationReason": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason",
      "code": "pat", "display": "Paciente"
    }],
    "text": "El paciente canceló por WhatsApp"
  },
  "start": "2026-06-03T13:00:00-03:00",
  "end": "2026-06-03T14:00:00-03:00",
  "participant": [
    { "actor": { "reference": "Patient/3f7c...uuid" }, "status": "declined", "required": "required" },
    { "actor": { "reference": "Practitioner/ariel-tarcaya" }, "status": "accepted", "required": "required" }
  ]
}
```

## 2. Search params FHIR R4 — Appointment

Usar los nombres **estándar FHIR**, no inventados. Correcciones sobre lo propuesto por architect:

| Necesidad | Estándar FHIR R4 | Corrección |
| :--- | :--- | :--- |
| Rango de fechas | `date=ge2026-06-01&date=le2026-06-07` | Reemplaza `dateFrom`/`dateTo`. |
| Por paciente (UUID) | `patient=Patient/{uuid}` | Referencia. |
| Por paciente (DNI) | `patient.identifier=http://hospital.gov/dni\|12345678` | Chained search; alternativa: alias propio `patient-dni` documentado en CapabilityStatement. |
| Por profesional | `practitioner=Practitioner/{id}` | Referencia. |
| Por nombre de profesional | `practitioner-name` (alias propio, LIKE) | NO es estándar → documentar como extensión local. |
| Por estado | `status=booked` | Estándar. |
| Por tipo de servicio | `service-type` | Estándar. |

## 3. Validación del recurso `Patient`

- **`gender`** → `Patient.gender` (administrativeGender, value set *required* `male\|female\|other\|unknown`). El sexo registral del DNI va aquí. **NO hace falta extensión** para cumplir la clave `(dni, gender)` — es lo más simple y conforme.
- **DNI** → `Patient.identifier` con `system: http://hospital.gov/dni`. Recomendado añadir `identifier.type` con código `NI` (sistema `http://terminology.hl7.org/CodeSystem/v2-0203`).
- ⚠️ El sexo NUNCA debe modelarse como `identifier` (anti-patrón).
- ⚠️ `extractDni()` del HCE hoy toma "el primer identifier con value" → debe seleccionar por `system === 'http://hospital.gov/dni'` o `type.code === 'NI'`.

## 4. Mapeo de género español→FHIR

| CliniChat (español) | HCE / FHIR (administrativeGender) |
| :--- | :--- |
| `masculino` | `male` |
| `femenino` | `female` |
| `otro` | `other` |
| `no_especificado` | `unknown` |

**Riesgo:** `unknown`/`other` son componentes de clave débiles. Resolver el sexo con **SISA/RENAPER** antes de crear el paciente; tratar `unknown` como estado transitorio, nunca como destino persistido para un paciente verificable.

## 5. Contrato MCP

**REST directo contra la API del HCE es suficiente** — no se requiere capa MCP para esta integración (CliniChat ya hace function-calling propio). Si en el futuro se expone a una IA genérica vía MCP, los contratos serían `lookup_patient(dni, gender)`, `create_appointment(...)`, `cancel_appointment(appointment_id, reason)`. **Regla de seguridad invariante: `tenant_id` JAMÁS es parámetro de herramienta — se toma del token.**

## 6. Correcciones derivadas (resumen para codificación)

**architect (conformidad FHIR R4):**
1. `end` obligatorio si `status ∈ {booked,arrived,fulfilled}` y hay `start` (regla `app-3`); calcular desde `minutesDuration`.
2. Usar `proposed` (no `pending`) para turnos sugeridos por IA sin confirmar.
3. Cuidado: columna `cancellation_reason` (doble "l") vs. campo FHIR `cancelationReason` (una "l").
4. Search params: `date=ge..&date=le..`; desdoblar `patient` (UUID) de DNI (`patient.identifier`); desdoblar `practitioner` de `practitioner-name`.
5. `participant` ≥1 con `status` válido; al cancelar, participante paciente → `status: declined`.
6. Endurecer `extractDni()` por `system`/`type.code`.

**integrations (tools CliniChat):**
1. `mapGenderToFhir()` antes de cada llamada; resolver sexo con SISA para evitar `unknown`.
2. Tratar `409 Conflict` del POST Patient como "ya existe → lookup", no como error.
3. `idempotency_key` determinística para `create_appointment`.
4. Enviar `identifier.system = http://hospital.gov/dni` para el chained search por DNI.
