# Diseño técnico — Encuentro / Visita odontológica (módulo aislado)

> **Estado:** PROPUESTA DE DISEÑO (solo papel, sin código). Pendiente de aprobación del Super Admin.
> **Autor:** Agente `architect`
> **Fecha:** 2026-06-15
> **Tarea:** Modelo del "Encuentro/Visita odontológica" para el módulo odontológico aislado.
> **Ámbito:** Backend NestJS 11 + TypeORM + PostgreSQL (JSONB FHIR R4), multi-inquilino Zero Trust.
> **No cubre (otros agentes):** políticas Keycloak/cifrado (`security`), maquetación React (`ux`).
> **No tocar en implementación:** `ProtesisTab.tsx`, odontograma SVG (trabajo en paralelo).

---

## 0. Contexto verificado en el repo (punto de partida)

- `EncounterEntity` (`fhir_encounters`) existe y modela el ciclo completo de una visita FHIR Encounter:
  `status` (in-progress/finished/cancelled), `classCode` (AMB/URG/CTRL/INTER), `startDate`/`endDate`,
  `payload` JSONB, firma lógica (`signedBy`/`signedAt`/`contentHash` SHA-256). **Lo usa solo la HC
  original (nota SOAP), hoy oculta/sin uso.** El módulo odontológico NO lo toca.
- `OdontologyResourceEntity` (`odontology_clinical_resources`): `id`, `tenantId`, `patientId`,
  `resourceType`, `payload` JSONB, `createdAt`, `updatedAt`. Índice `(tenantId, patientId, resourceType)`.
  Guarda TODO suelto, **sin agrupación por visita ni referencia a encuentro**.
- `AppointmentEntity` (`fhir_appointments`): status FHIR `proposed→booked→arrived→fulfilled→cancelled/noshow`.
  Marcado manual desde la agenda. **Hoy NO está vinculado al registro clínico odontológico.**
- Patrón de firma/inmutabilidad ya probado en `EncounterService.sign()`: hash SHA-256 del contenido +
  `status='finished'` + bloqueo de `update()` cuando `status==='finished'` (`ForbiddenException`).
- `OdontologyService.completeResource()` ya setea `performedDateTime` al pasar una prestación
  planificada (azul) → existente (rojo).

---

## 1. ¿Reusar `EncounterEntity` o crear uno propio del módulo? → **Crear uno propio**

### Recomendación: nueva entidad `OdontologyEncounterEntity` (tabla `odontology_encounters`).

**Justificación (trade-off):**

| Criterio | Reusar `fhir_encounters` | **Nueva `odontology_encounters` (elegida)** |
| :-- | :-- | :-- |
| Aislamiento del módulo (regla del Super Admin) | Lo rompe: mezcla SOAP de la HC original con visitas odonto en la misma tabla | Respeta la decisión arquitectónica: tabla propia, cero acoplamiento |
| Consultas / índices | Habría que discriminar por `classCode` o un flag de origen en cada query | Índices limpios, todo en la tabla es odontológico |
| Evolución independiente del esquema | Cambiar el modelo odonto impactaría la HC original | Se evoluciona sin tocar la HC original |
| Reutilización de lógica de firma | Alta (mismo service) | Media: se **replica el patrón** (no el código), es trivial y ya está probado |
| Riesgo de regresión sobre la HC original (oculta pero existente) | Alto | Nulo |

El módulo odontológico es **deliberadamente aislado** (ya tiene tabla y endpoints propios). Reusar
`EncounterEntity` genérico contradice esa decisión y acopla dos historias clínicas que el proyecto
mantiene separadas a propósito. El costo de duplicar la entidad es bajo y la lógica de firma se replica
copiando un patrón ya validado. **Se crea `OdontologyEncounterEntity`.**

### Esquema propuesto `OdontologyEncounterEntity` (tabla `odontology_encounters`)

```
id            uuid  PK (generado)
tenant_id     varchar      NOT NULL   -- Zero Trust
patient_id    uuid         NOT NULL
appointment_id uuid        NULL       -- vínculo al turno (FK lógica a fhir_appointments); null = atención sin cita
status        varchar      DEFAULT 'in-progress'  -- in-progress | finished | cancelled
class_code    varchar      DEFAULT 'AMB'          -- AMB | URG | CTRL  (reusa la convención FHIR)
reason_text   varchar      NULL       -- motivo de consulta libre (anamnesis breve de la sesión)
start_date    timestamptz  NOT NULL   -- period.start = apertura de la visita
end_date      timestamptz  NULL       -- period.end = cierre/firma
payload       jsonb        NULL       -- recurso FHIR R4 Encounter completo
signed_by     varchar      NULL       -- profesional que firmó (preferred_username)
signed_by_id  varchar      NULL       -- sub del JWT (trazabilidad estable; mejora sobre la HC original)
signed_at     timestamptz  NULL
content_hash  varchar      NULL       -- SHA-256 del set de prestaciones + reason al firmar
addenda       jsonb        DEFAULT '[]'  -- lista de correcciones post-firma (ver §5)
created_at    timestamptz  (CreateDateColumn)
updated_at    timestamptz  (UpdateDateColumn)
```

**Índices:**
- `idx_odo_enc_tenant_patient (tenant_id, patient_id)` — listar visitas del paciente.
- `idx_odo_enc_tenant_patient_status (tenant_id, patient_id, status)` — resolver "visita activa" (ver §4).
- `idx_odo_enc_appointment (appointment_id)` — reconciliación turno↔encuentro.

> **Mejora sobre la HC original:** se agrega `signed_by_id` (sub del JWT). En `fhir_encounters` solo se
> guarda `signedBy` (nombre legible), que no es identificador estable. Para integridad legal conviene el `sub`.

---

## 2. Cambios de esquema y vínculo de `odontology_clinical_resources`

### 2.1 Nueva columna FK lógica `encounter_id`

Agregar a `odontology_clinical_resources`:

```
encounter_id  uuid  NULL   -- referencia a odontology_encounters.id
```

- **FK lógica, no física** (consistente con el estilo del repo: `patient_id`/`appointment_id` no usan
  constraints `REFERENCES`). Se valida en el service.
- Nuevo índice: `idx_odo_res_encounter (tenant_id, encounter_id)` para traer todas las prestaciones de una visita.
- En el `payload` FHIR de cada `Procedure`/`Observation` de la sesión se setea
  `encounter: { reference: "Encounter/<encounter_id>" }` y, para Procedure, `performedDateTime`.

> El odontograma sigue siendo **estado acumulado del paciente** (la boca completa, capas existing/planned).
> El `encounter_id` NO fragmenta el odontograma: marca **qué prestaciones se generaron/completaron en qué
> sesión**. Una pieza arreglada en la visita 3 conserva `encounter_id` = visita 3 aunque se siga viendo en
> el odontograma actual. La Evolución (§ entrada) se arma agrupando recursos por `encounter_id`.

### 2.2 Migración de los 184 registros legacy

Estrategia **no destructiva, en una sola migración**:

1. `ALTER TABLE odontology_clinical_resources ADD COLUMN encounter_id uuid NULL;`
2. `CREATE INDEX idx_odo_res_encounter ON odontology_clinical_resources (tenant_id, encounter_id);`
3. Los 184 registros quedan con `encounter_id = NULL` → semántica explícita **"pre-visita" / legacy**.
4. **No** se inventan encuentros sintéticos retroactivos (sería falsear fechas/firmas → riesgo legal).

**Tratamiento del legacy en lectura:**
- La Evolución muestra una entrada especial **"Registros previos (sin visita)"** que agrupa todos los
  recursos con `encounter_id IS NULL` del paciente, ordenados por `createdAt`. No firmable, no editable
  como visita; es un cajón histórico.
- El odontograma los sigue renderizando igual (no depende de `encounter_id`).

**Opcional (fase posterior, NO en la migración inicial):** *backfill* asistido — si un recurso legacy
cae temporalmente dentro del rango `[start_date, end_date]` de un encuentro creado luego para el mismo
paciente/tenant, ofrecer asociarlo manualmente. Se deja fuera del alcance inicial por riesgo de falsos positivos.

---

## 3. Endpoints NestJS (tenant-scoped, Zero Trust)

Prefijo propio del módulo aislado, anidado bajo paciente: **`/odontology/patient/:patientId/encounter`**.
Todos: `@UseGuards(AuthGuard('jwt'), RolesGuard)`, filtro `req.user.tenantId` en cada query.
Contexto de usuario: `userId = req.user.sub`, `userName = req.user.preferred_username` (igual que `EncounterController.getUserCtx`).

### 3.1 Abrir visita — `POST /odontology/patient/:patientId/encounter`
Roles: `medico`, `enfermero`, `administrador`.

Request:
```json
{ "appointmentId": "uuid|null", "classCode": "AMB", "reasonText": "Control y limpieza" }
```
Comportamiento:
- Valida pertenencia del paciente al tenant (`assertPatient`).
- **Guarda contra duplicados:** si ya existe un encuentro `in-progress` para `(tenantId, patientId)`,
  lo devuelve en vez de crear otro (idempotencia de apertura → una sola visita activa por paciente, §4).
- Crea `status='in-progress'`, `start_date=now`, arma `payload` Encounter FHIR R4.
- Si llega `appointmentId`: lo guarda y (opcional) transiciona el turno `booked/arrived → arrived`.

Response `201` (FHIR Encounter):
```json
{
  "resourceType": "Encounter", "id": "<uuid>", "status": "in-progress",
  "class": { "code": "AMB", "display": "Ambulatorio" },
  "subject": { "reference": "Patient/<patientId>" },
  "appointment": [{ "reference": "Appointment/<appointmentId>" }],
  "period": { "start": "2026-06-15T13:00:00Z" },
  "reasonCode": [{ "text": "Control y limpieza" }],
  "participant": [{ "individual": { "display": "<userName>" }, "type": [{ "coding": [{ "code": "ATND" }] }] }]
}
```

### 3.2 Agregar prestación a la visita activa
**No se crea un endpoint nuevo.** Se extiende el existente
`POST /odontology/patient/:patientId/resource` para aceptar `encounterId` opcional en el body:
```json
{ "resourceType": "Procedure", "encounterId": "<uuid>", "payload": { ... } }
```
- `saveResource()` valida que el `encounterId` exista, pertenezca al tenant/paciente y esté `in-progress`
  (no se puede agregar a una visita `finished` → `ForbiddenException`).
- Persiste `encounter_id` en la fila y `encounter.reference` + `performedDateTime` en el `payload`.
- Si `encounterId` es null → comportamiento legacy actual (recurso suelto). Compatibilidad hacia atrás total.

> Esto evita romper el flujo del odontograma actual y el upsert por (pieza, cara, tipo, capa).

### 3.3 Finalizar + firmar visita — `POST /odontology/patient/:patientId/encounter/:id/sign`
Roles: `medico`, `administrador` (firma = acto profesional; recepción no firma).

Request: vacío (el contexto sale del JWT). Comportamiento (replica patrón `EncounterService.sign`):
- Verifica `in-progress` (si ya `finished` → `BadRequestException` "ya firmada").
- Reúne las prestaciones de la visita (`encounter_id = :id`). **Regla:** no se firma una visita sin
  al menos una prestación o `reasonText` (evita visitas vacías).
- `content_hash = SHA-256( canonical(prestaciones[] ordenadas + reasonText + start_date) )`.
- `status='finished'`, `end_date=now`, `signed_by`, `signed_by_id`, `signed_at`.
- Marca el turno asociado `fulfilled` (§6).

Response `200`: Encounter `finished` con `signedBy`, `signedAt`, `contentHash`.

### 3.4 Listar visitas del paciente — `GET /odontology/patient/:patientId/encounter`
Roles: `medico`, `enfermero`, `recepcionista`, `administrador`.
- Devuelve visitas ordenadas `start_date DESC`, cada una con resumen (estado, fecha, nº de prestaciones, firmante).
- Incluye al final la pseudo-entrada **"Registros previos (sin visita)"** si hay recursos con `encounter_id IS NULL`.

Response `200`:
```json
{
  "visitas": [
    { "id": "<uuid>", "status": "finished", "start": "...", "end": "...",
      "reasonText": "Control", "prestaciones": 3, "signedBy": "dra.lopez", "signedAt": "...",
      "appointmentId": "<uuid|null>", "hasAddenda": false }
  ],
  "legacy": { "count": 12 }
}
```

### 3.5 Obtener una visita — `GET /odontology/patient/:patientId/encounter/:id`
Roles: `medico`, `administrador`.
- Devuelve el Encounter + las prestaciones embebidas (`Procedure`/`Observation` con `encounter_id = :id`) + `addenda[]`.

### 3.6 Visita activa — `GET /odontology/patient/:patientId/encounter/active`
Ver §4. Roles: `medico`, `enfermero`, `administrador`.

### 3.7 Addenda — `POST /odontology/patient/:patientId/encounter/:id/addenda`
Ver §5. Roles: `medico`, `administrador`.

### 3.8 Cancelar visita — `POST /odontology/patient/:patientId/encounter/:id/cancel`
- Solo si `in-progress`. `status='cancelled'`. No marca el turno fulfilled. Las prestaciones quedan
  pero se desvinculan (`encounter_id → NULL`, pasan a legacy) o se conservan según decisión clínica:
  **recomendado desvincular** para no perder el trabajo registrado por error de cierre.

---

## 4. Estado "visita activa": cómo lo sabe el front

**Invariante:** a lo sumo **una** visita `in-progress` por `(tenantId, patientId)`. Se garantiza en
`POST .../encounter` (§3.1, devuelve la existente en vez de duplicar).

**Mecanismo recomendado (explícito, sin auto-creación oculta):**
- Al abrir la ficha odontológica, el front llama `GET /odontology/patient/:patientId/encounter/active`.
  - Si hay visita activa → la devuelve (el front continúa esa sesión).
  - Si no hay → devuelve `204 No Content` / `{ "active": null }`. El front muestra el botón
    **"Iniciar visita"** que dispara `POST .../encounter`.
- **No** se crea la visita automáticamente al abrir la ficha (evita visitas fantasma cuando el
  profesional solo consulta el historial sin atender). La apertura es un acto explícito.
- **Disparador alternativo recomendado:** al marcar el turno `arrived` en la agenda, ofrecer
  "Iniciar atención" que crea la visita y abre la ficha ya con `encounterId` activo.

Resolución backend de `active`:
```sql
SELECT * FROM odontology_encounters
WHERE tenant_id = :t AND patient_id = :p AND status = 'in-progress'
ORDER BY start_date DESC LIMIT 1;
```
(El índice `idx_odo_enc_tenant_patient_status` lo cubre.)

---

## 5. Inmutabilidad post-firma y modelo de addenda

**Bloqueo de edición (replica `EncounterService`):**
- `status='finished'` ⇒ toda mutación del encuentro y de sus prestaciones se rechaza con
  `ForbiddenException('Una visita firmada no puede modificarse. Use una addenda.')`.
- En `saveResource()` / `completeResource()` / `deleteResource()`: si el recurso tiene `encounter_id`
  apuntando a una visita `finished`, se bloquea. (Recursos sin `encounter_id` o de visita activa: editables.)
- Verificación de integridad: re-hash y comparación contra `content_hash` para detectar adulteración.

**Addenda (corrección legal sin alterar el original):**
- No modifica nada firmado. Se **agrega** una entrada al array `addenda` JSONB del encuentro:
```json
{
  "id": "<uuid>", "text": "Corrección: la pieza 16 era 17.",
  "authoredBy": "dra.lopez", "authoredById": "<sub>", "authoredAt": "2026-06-16T09:00:00Z",
  "supersedes": null
}
```
- Modelado FHIR: cada addenda se refleja en `payload.note[]` con marca de extensión
  `…/StructureDefinition/odonto-addenda` y `time`/`authorString`. El Encounter sigue `finished`.
- La addenda **no** abre nuevas prestaciones; si la corrección implica un acto clínico nuevo (p. ej.
  rehacer un tratamiento), eso es **una nueva visita**, no una addenda.
- Las addenda son append-only (no se borran ni editan). Quedan auditadas.

---

## 6. Vínculo con `Appointment`

**Cuándo se setea `fulfilled`:** al **firmar** la visita (§3.3), si `encounter.appointment_id` no es null:
- Transición del turno `arrived/booked → fulfilled`, `payload.status` y columna `status` actualizados.
- Se hace en la **misma transacción** que la firma (consistencia: visita cerrada ⇒ turno cumplido).

**Trazabilidad bidireccional:**
- `odontology_encounters.appointment_id` → turno.
- `Appointment.payload` puede llevar `extension` `…/odonto-encounter` con el `encounterId` (opcional,
  para navegación desde la agenda a la visita).

**Atención sin cita (walk-in):**
- `POST .../encounter` con `appointmentId = null` es válido. La visita existe igual.
- Al firmar, si no hay `appointment_id` no se toca ningún turno (no se crea uno sintético).
- La función `enrichPatients` ya deriva "última visita" tanto de turnos `fulfilled` como de actividad
  odontológica (`MAX(updated_at)`), así que un walk-in sin turno **igual** aparece como última visita.
  Conviene, a futuro, que esa derivación use `odontology_encounters.end_date` como fuente preferente.

**Estados del turno vs. visita (tabla de verdad):**

| Turno | Visita odonto |
| :-- | :-- |
| `booked` | sin visita |
| `arrived` | visita `in-progress` (si se inició atención) |
| `fulfilled` | visita `finished` (firmada) |
| `noshow`/`cancelled` | sin visita |
| (sin turno) | visita `in-progress`/`finished` (walk-in) |

---

## 7. Trade-offs, riesgos y plan de implementación

### Trade-offs
- **Tabla propia vs. reuso:** se prioriza aislamiento del módulo y cero regresión sobre HC original,
  a costa de duplicar el patrón de firma (bajo costo, ya validado).
- **FK lógica vs. física:** se sigue el estilo del repo (sin constraints `REFERENCES`); menos garantías
  a nivel DB, validación en el service. Coherente con `appointment_id`/`patient_id` actuales.
- **`encounterId` opcional en `saveResource`:** mantiene compatibilidad total con el odontograma actual
  y el legacy; el precio es una rama condicional en el service.

### Riesgos y mitigaciones
- **Doble visita activa por carrera (dos pestañas):** mitigado por el guard de unicidad en apertura +
  índice; opcional unique index parcial `WHERE status='in-progress'` (PostgreSQL lo soporta) para forzarlo en DB.
- **Legacy mal interpretado:** `encounter_id NULL` = "pre-visita" explícito; UI lo separa. No se firman.
- **Inmutabilidad eludida:** todos los puntos de mutación de recursos deben chequear el estado de la
  visita asociada (no solo el endpoint de firma). QA debe cubrir `saveResource`/`complete`/`delete`.
- **`offline-first` rural:** la apertura/cierre de visita debe tolerar reintentos → la apertura es
  idempotente (devuelve la activa); la firma debe ser idempotente por `content_hash` (re-firmar la
  misma visita ya firmada devuelve la firma, no error fatal, o error controlado).

### Plan por etapas
1. **Etapa 1 — Esquema (no disruptivo):** crear `OdontologyEncounterEntity` + migración `encounter_id`
   nullable + índices. Sin cambios de comportamiento. Legacy intacto.
2. **Etapa 2 — Backend ciclo de vida:** endpoints abrir / active / sign / list / get / cancel /
   addenda + extensión de `saveResource` con `encounterId`. Validaciones Zero Trust e inmutabilidad.
3. **Etapa 3 — Vínculo turno:** `fulfilled` transaccional al firmar; trazabilidad bidireccional.
4. **Etapa 4 — Evolución por visitas (front, agente `ux`):** la Evolución pasa de lista de recursos
   sueltos a lista de visitas; entrada "Registros previos (sin visita)" para legacy. (Diseño UI fuera
   del alcance de este doc.)
5. **Etapa 5 — Quality Gates:** `qa` (Jest: unicidad de visita activa, bloqueo post-firma en TODOS los
   endpoints de mutación, hash, fulfilled transaccional, aislamiento de tenant) + `fhir-validator`
   (Encounter R4 + Procedure.encounter) + `security` (auditoría de firma/addenda).

### Decisiones que requieren validación del Super Admin
- Confirmar tabla propia (vs. reuso de `fhir_encounters`).
- Confirmar que cancelar visita **desvincula** prestaciones a legacy (no las borra).
- Confirmar que la apertura de visita es **explícita** (botón), no automática al abrir ficha.

---

## Apéndice — recursos FHIR R4 implicados
- **Encounter** (nuevo en el módulo): `status`, `class`, `subject`, `appointment[]`, `period`,
  `reasonCode[]`, `participant[]`, `note[]` (addenda), `extension[]` (firma/hash).
- **Procedure** (existente, se extiende): `encounter`, `performedDateTime`.
- **Observation** (existente, se extiende): `encounter`.
- **Appointment** (existente): `status='fulfilled'` + extensión opcional al encounter.
