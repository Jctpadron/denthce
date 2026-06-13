# Arquitectura — Integración de Turnos por WhatsApp (CliniChat ↔ HCE)

> Agente: `architect` · Fecha: 2026-05-30 · Estado: DISEÑO (no implementado)
> Alcance: Hueco 2 (clave de unicidad `(dni, gender)`) + Módulo 5 Tarea 5.1 (`/fhir/r4/Appointment`) + contrato de integración HCE↔CliniChat con **HCE como dueño único del padrón de pacientes**.
> Stack respetado: NestJS 11 + TypeORM + PostgreSQL (JSONB FHIR R4), auth Keycloak (`passport-jwt`/`jwks-rsa`), multi-tenant Zero Trust (todo filtrado por `tenantId`).

---

## 0. Contexto verificado (resumen de lo leído en el código real)

**HCE (este repo):**
- `PatientEntity` (`fhir_patients`): `dni` tiene `@Column({ unique: true })` → **índice UNIQUE de columna única sobre `dni`, SIN tenant ni gender**. Esto es un bug latente respecto al comentario del servicio que dice "único por tenant".
- `PatientService.create()` rechaza duplicados con `findOne({ where: { dni, tenantId } })` (verificación lógica por tenant), pero el índice físico de la tabla solo mira `dni`.
- `PatientService.update()` repite la misma verificación lógica `{ dni, tenantId }` cuando cambia el DNI.
- `PatientService.search()` filtra siempre por `tenant_id` y permite `dni LIKE`, `name`, `age`, `admissionDate`. **No se toca.**
- `gender` se persiste como código FHIR R4 (`male/female/other/unknown`). En `create()`, si falta, se asume `'unknown'`.
- `SisaService.verificarPorDni(dni, gender)` ya existe y mapea `gender` español→`'M'/'F'` para RENAPER; devuelve `sexo: 'male'|'female'`.
- JWT (`jwt.strategy.ts`): `validate()` expone `{ userId, tenantId, username, email, roles }`. `tenantId` sale de `payload.tenant_id` (o `sub` como fallback). **El token DEBE traer `tenant_id`.**
- `RolesGuard` + `@Roles(...)` filtran por roles de realm Keycloak (`medico`, `recepcionista`, `administrador`, `paciente`).
- Patrón de módulo: cada recurso es `*.entity.ts` + `*.service.ts` + `*.controller.ts` + `*.module.ts`, registrado en `app.module.ts` (entidades en `entities: [...]` y módulo en `imports: [...]`).

**CliniChat (`D:\APP-jct\app-watsap\clinichat-assistant`):**
- Tablas Supabase propias: `patients` (clave `dni UNIQUE`, gender en español), `phone_contacts`, `patient_contacts` (cuentas familiares M-N), `specialties`, `doctors`, `doctor_schedules`, `doctor_unavailability`, `appointments` (status `pending/confirmed/cancelled/completed`), `messages`, `clinic_settings`, `conversation_states`.
- `whatsapp-conversation.ts`: la IA (OpenAI con function calling) ejecuta 4 tools contra Supabase: `lookup_patient(dni)`, `register_patient(...)`, `link_contact_to_patient(...)`, `create_appointment(...)`.
- Hoy **CliniChat crea pacientes propios** en su tabla `patients` con `gender` en español y `dni UNIQUE` (sin gender, sin tenant).

**Decisión del Super Admin (rumbo):** el HCE es dueño único del padrón. CliniChat deja de crear pacientes propios y **absorbe** los del HCE vía REST. Supabase de CliniChat queda solo para auth del panel y estado conversacional (`conversation_states`, `messages`, `phone_contacts`/`patient_contacts` como caché de identidad de WhatsApp).

---

## 1. Hueco 2 — Clave de unicidad del paciente `(dni, gender)`

### 1.1 Motivación
En Argentina, por el sistema histórico de Libreta de Enrolamiento (varones) y Libreta Cívica (mujeres), **existen dos personas distintas con el mismo número de documento y distinto sexo**. Por lo tanto el DNI **no** es único por sí solo. La clave natural de identidad demográfica es `(dni, gender)`. Bajo multi-tenant Zero Trust, la clave física debe ser `(dni, gender, tenant_id)`.

### 1.2 Cambio EXACTO en la entidad (`patient.entity.ts`)

Quitar el `unique: true` de la columna `dni` y declarar un índice compuesto único a nivel de tabla:

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('fhir_patients')
@Index('uq_patient_dni_gender_tenant', ['dni', 'gender', 'tenantId'], { unique: true })
export class PatientEntity {
  // ...
  @Column()                 // ANTES: @Column({ unique: true })
  dni: string;
  // ...
}
```

Justificación de incluir `tenant_id` en la clave: el aislamiento Zero Trust ya filtra todas las consultas por tenant; dos consultorios distintos pueden tener al mismo paciente (mismo `dni`+`gender`) sin que eso sea un conflicto. El UNIQUE debe ser por tenant, alineando por fin el índice físico con la regla lógica que el servicio ya pretendía aplicar.

### 1.3 Cambio EXACTO en el servicio (`patient.service.ts`)

**`create()`** — la verificación de duplicado pasa de `{ dni, tenantId }` a `{ dni, gender, tenantId }`:

```typescript
const gender = fhirPatient.gender || 'unknown';
// ...
const existing = await this.patientRepository.findOne({ where: { dni, gender, tenantId } });
if (existing) {
  throw new ConflictException(
    `El paciente con DNI ${dni} y sexo ${gender} ya se encuentra registrado en tu consultorio.`,
  );
}
```

**`update()`** — la verificación al cambiar identidad pasa a comparar la tupla `(dni, gender)` y a buscar por `{ dni, gender, tenantId }`:

```typescript
// Recalcular gender ANTES de la verificación (hoy se hace después)
const gender = fhirPatient.gender || 'unknown';
// ...
if (dni !== entity.dni || gender !== entity.gender) {
  const existing = await this.patientRepository.findOne({ where: { dni, gender, tenantId } });
  if (existing && existing.id !== entity.id) {
    throw new ConflictException(
      `El paciente con DNI ${dni} y sexo ${gender} ya se encuentra registrado en tu consultorio.`,
    );
  }
}
```

> Nota: el `existing.id !== entity.id` evita un falso positivo si se reedita el mismo registro.

**`search()`** — NO SE TOCA (decisión del Super Admin). La búsqueda sigue solo por DNI (`dni LIKE :dni`). Si el DNI devuelve dos filas (un varón y una mujer), ambas aparecen en el `Bundle` y el operador elige en la grilla. Esto es deseable: la desambiguación es humana en el front, no en la API.

### 1.4 Plan de migración del índice/constraint

`synchronize` está gobernado por `DB_SYNCHRONIZE` (hoy normalmente `false` en producción). El cambio de índice UNIQUE **no debe** dejarse a `synchronize`; se aplica con una migración SQL controlada y verificación previa de duplicados:

1. **Detección previa de colisiones** (debe devolver 0 filas antes de migrar):
   ```sql
   SELECT dni, gender, tenant_id, COUNT(*)
   FROM fhir_patients
   GROUP BY dni, gender, tenant_id
   HAVING COUNT(*) > 1;
   ```
   Si hay filas, se resuelven manualmente (merge/anulación) antes de continuar.

2. **Eliminar el UNIQUE viejo sobre `dni`.** El nombre real lo genera Postgres/TypeORM; localizarlo:
   ```sql
   SELECT conname FROM pg_constraint
   WHERE conrelid = 'fhir_patients'::regclass AND contype = 'u';
   -- típicamente algo como "UQ_<hash>" o "fhir_patients_dni_key"
   ALTER TABLE fhir_patients DROP CONSTRAINT "<nombre_constraint_dni>";
   ```

3. **Crear el índice compuesto único.** Usar `CONCURRENTLY` si la tabla está en producción con carga (no bloquea escrituras):
   ```sql
   CREATE UNIQUE INDEX CONCURRENTLY uq_patient_dni_gender_tenant
     ON fhir_patients (dni, gender, tenant_id);
   ```
   (En una migración TypeORM normal, sin `CONCURRENTLY`, queda implícito por el decorador `@Index`.)

4. **Verificación post-migración:** intentar insertar un duplicado `(dni, gender, tenant_id)` debe fallar; insertar mismo `dni` con `gender` distinto debe pasar.

> Riesgo de filas con `tenant_id` NULL: la entidad declara `tenantId` como `nullable: true`. Un índice UNIQUE en Postgres trata cada NULL como distinto, así que filas con tenant NULL no colisionarían entre sí. En la práctica todos los pacientes reales tienen tenant; conviene además respaldar con un backfill que garantice `tenant_id NOT NULL` antes de migrar (fuera de alcance de este diseño, lo coordina `devops`).

---

## 2. Módulo 5 — Tarea 5.1: Endpoint FHIR `Appointment`

### 2.1 Decisión de alcance (qué entra ahora y qué queda para 5.2)

**Entra en 5.1 (este diseño):**
- `AppointmentEntity` (`fhir_appointments`), tenant-scoped, payload JSONB FHIR R4 `Appointment`.
- Controlador `/fhir/r4/Appointment`: crear (POST), buscar (GET por fecha/paciente/profesional/estado), cancelar (PATCH/PUT).
- Vínculo al `Patient` por `patientId` (UUID del HCE), resuelto a partir de la clave `(dni, gender)`.
- Profesional modelado como **referencia ligera** (`practitionerRef` string + nombre desnormalizado), SIN entidad `Practitioner` propia todavía.

**Queda para 5.2 (NO se modela ahora):**
- Entidades `Practitioner` / `PractitionerRole` / `Schedule` / `Slot` FHIR (agenda nativa del HCE: horarios, slots, disponibilidad, bloqueos). Hoy esa lógica vive en CliniChat (`doctors`, `doctor_schedules`, `doctor_unavailability`). En 5.1 el HCE solo **registra** el turno que CliniChat ya resolvió contra su propia agenda; el HCE todavía no es la fuente de verdad de la disponibilidad.
- Validación de solapamiento de turnos / doble booking server-side (depende de tener `Slot`/agenda nativa).

Esto evita doble trabajo: hasta 5.2, CliniChat sigue calculando slots; el HCE persiste el turno como recurso FHIR canónico y auditable.

### 2.2 Entidad TypeORM (`appointment.entity.ts`)

Sigue exactamente el patrón de `EncounterEntity` (columnas indexables desnormalizadas + `payload` JSONB + timestamps).

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * AppointmentEntity — Tarea 5.1
 * Recurso FHIR R4 Appointment. Representa un turno reservado (origen WhatsApp/CliniChat o recepción).
 * Tenant-scoped (Zero Trust). El payload JSONB guarda el recurso FHIR completo;
 * las columnas desnormalizadas existen para indexar búsquedas frecuentes.
 */
@Entity('fhir_appointments')
@Index('idx_appt_tenant_start', ['tenantId', 'startDate'])
@Index('idx_appt_tenant_patient', ['tenantId', 'patientId'])
@Index('idx_appt_tenant_practitioner', ['tenantId', 'practitionerRef'])
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  /** UUID del PatientEntity del HCE (resuelto por (dni, gender)). Puede ser null si el paciente aún no existe. */
  @Column({ name: 'patient_id', nullable: true })
  patientId: string;

  /** DNI desnormalizado para trazabilidad y reconciliación con CliniChat. */
  @Column({ name: 'patient_dni', nullable: true })
  patientDni: string;

  /**
   * Estado FHIR R4 Appointment.status:
   * 'booked'      → reservado/confirmado
   * 'cancelled'   → cancelado
   * 'fulfilled'   → atendido (cumplido)
   * 'noshow'      → ausente
   * 'pending'     → propuesto, sin confirmar
   */
  @Column({ default: 'booked' })
  status: string;

  /** Referencia ligera al profesional (en 5.1 aún no hay entidad Practitioner). Ej: 'doctor:Dr. Ariel Tarcaya' o un id externo. */
  @Column({ name: 'practitioner_ref', nullable: true })
  practitionerRef: string;

  /** Nombre desnormalizado del profesional para mostrar en grilla sin join. */
  @Column({ name: 'practitioner_name', nullable: true })
  practitionerName: string;

  /** Especialidad / tipo de servicio (texto libre; mapea a Appointment.serviceType). */
  @Column({ name: 'service_type', nullable: true })
  serviceType: string;

  /** Inicio del turno (Appointment.start). */
  @Column({ name: 'start_date', type: 'timestamp with time zone' })
  startDate: Date;

  /** Fin del turno (Appointment.end). Opcional; se calcula con la duración del slot. */
  @Column({ name: 'end_date', type: 'timestamp with time zone', nullable: true })
  endDate: Date;

  /** Canal de origen: 'whatsapp' | 'recepcion' | 'portal'. Para auditoría y reconciliación. */
  @Column({ name: 'origin_channel', default: 'recepcion' })
  originChannel: string;

  /** Clave de idempotencia provista por el cliente (CliniChat) para evitar turnos duplicados por reintentos. */
  @Column({ name: 'idempotency_key', nullable: true, unique: true })
  idempotencyKey: string;

  /** Motivo de cancelación (Appointment.cancelationReason), cuando status='cancelled'. */
  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  /** Recurso FHIR R4 Appointment completo en JSONB. */
  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
```

**Índices y rendimiento:**
- `idx_appt_tenant_start` → agenda diaria/semanal por tenant (la consulta más frecuente).
- `idx_appt_tenant_patient` → historial de turnos de un paciente.
- `idx_appt_tenant_practitioner` → agenda de un profesional.
- `idempotency_key UNIQUE` → garantiza que reintentos de CliniChat no creen turnos duplicados.

### 2.3 Mapeo a FHIR R4 `Appointment` (payload JSONB)

El `payload` guarda el recurso canónico. Estructura mínima generada por el servicio:

```jsonc
{
  "resourceType": "Appointment",
  "id": "<uuid generado>",
  "status": "booked",
  "serviceType": [{ "text": "Odontología" }],
  "start": "2026-06-02T09:00:00-03:00",
  "end": "2026-06-02T10:00:00-03:00",
  "participant": [
    {
      "actor": { "reference": "Patient/<patientId>", "display": "Juan Pérez" },
      "status": "accepted"
    },
    {
      "actor": { "display": "Dr. Ariel Tarcaya" },   // en 5.1, sin reference a Practitioner
      "status": "accepted"
    }
  ],
  "comment": "Turno reservado por WhatsApp",
  "extension": [
    { "url": "http://hospital.gov/fhir/StructureDefinition/origin-channel", "valueCode": "whatsapp" }
  ]
}
```

> El mapeo fino (perfiles, `serviceCategory`, `cancelationReason` con CodeableConcept) lo cierra `fhir-mcp`. Aquí se fija el esqueleto consistente con cómo `PatientService` arma su payload.

### 2.4 Contrato de endpoints (`appointment.controller.ts`)

Mismo patrón que `PatientController`: `@UseGuards(AuthGuard('jwt'), RolesGuard)`, `tenantId` desde `req.user.tenantId`, `@Roles(...)`.

| Método | Ruta | Roles | Body | Respuesta |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/fhir/r4/Appointment` | `medico`, `recepcionista`, `administrador` | FHIR `Appointment` JSON (o DTO simplificado con `patientDni`+`gender`, `start`, `serviceType`, `practitionerName`, `idempotencyKey`) | FHIR `Appointment` JSON con `id` |
| GET | `/fhir/r4/Appointment` | `medico`, `recepcionista`, `administrador` | — (query: `?date=&patient=&practitioner=&status=`) | FHIR `Bundle` (searchset) |
| GET | `/fhir/r4/Appointment/:id` | `medico`, `recepcionista`, `administrador`, `paciente` | — | FHIR `Appointment` JSON |
| PATCH | `/fhir/r4/Appointment/:id/cancel` | `medico`, `recepcionista`, `administrador` | `{ reason?: string }` | FHIR `Appointment` con `status:'cancelled'` |
| PUT | `/fhir/r4/Appointment/:id` | `medico`, `recepcionista`, `administrador` | FHIR `Appointment` JSON | FHIR `Appointment` actualizado |

Detalle de parámetros de búsqueda GET (alineado con FHIR search params):
- `date` → filtra por `DATE(start_date) = :date` (un día) o rango `dateFrom`/`dateTo`.
- `patient` → `patient_id` (UUID) **o** `patient_dni`.
- `practitioner` → `practitioner_ref` / `practitioner_name LIKE`.
- `status` → `booked` | `cancelled` | `fulfilled` | `noshow` | `pending`.
- Todo siempre `AND tenant_id = :tenantId` (Zero Trust, igual que `PatientService.search`).

La respuesta de búsqueda es un `Bundle` idéntico en forma al de `PatientService.search` (`resourceType:'Bundle'`, `type:'searchset'`, `total`, `entry[].resource`).

### 2.5 Servicio (`appointment.service.ts`) — comportamientos clave

- **`create(dto, tenantId, userCtx)`**:
  1. Resolver `patientId` desde `(patientDni, gender)` → `patientRepository.findOne({ where: { dni, gender, tenantId } })`. Si no existe, dos opciones (decisión de producto): rechazar con `400`/`404` indicando "registrar paciente primero", o crear el turno con `patientId=null` y solo `patientDni`. **Recomendación:** exigir paciente existente (el HCE es dueño del padrón; CliniChat ya debió crearlo vía `/fhir/r4/Patient` antes).
  2. **Idempotencia:** si llega `idempotencyKey` y ya existe un turno con esa key en el tenant → devolver el turno existente (200) en vez de crear otro.
  3. Construir entidad + `payload` FHIR, `save`, inyectar `id` en payload (igual que `PatientService.create`).
  4. Registrar auditoría (reusar el patrón de `PatientAuditService` o uno equivalente para turnos; lo confirma `security`).
- **`cancel(id, reason, tenantId, userCtx)`**: cargar por `{ id, tenantId }`, set `status='cancelled'` + `cancellationReason`, actualizar `payload.status`, auditar.
- **`search(query, tenantId)`**: `QueryBuilder` con `where('appointment.tenant_id = :tenantId')` y los filtros opcionales; retornar `Bundle`.

### 2.6 Registro del módulo
- Crear `appointment.module.ts` con `TypeOrmModule.forFeature([AppointmentEntity])`, provider `AppointmentService`, controller `AppointmentController`.
- En `app.module.ts`: añadir `AppointmentEntity` al array `entities` y `AppointmentModule` a `imports`.

---

## 3. Arquitectura de integración HCE ↔ CliniChat (HCE master)

### 3.1 Principio
El HCE es la **única fuente de verdad del padrón de pacientes**. CliniChat deja de escribir su tabla `patients` propia y reescribe sus 4 tools para que operen contra la **API REST del HCE** (`/fhir/r4/Patient` y `/fhir/r4/Appointment`). Supabase de CliniChat se reduce a: auth del panel, `messages`, `conversation_states`, y `phone_contacts`/`patient_contacts` como **caché de identidad de WhatsApp** (qué teléfono gestiona a qué pacientes; el campo de enlace pasa de UUID Supabase a `patient_id` del HCE).

### 3.2 Contrato que CliniChat necesita del HCE

| Acción CliniChat (tool actual) | Llamada al HCE | Notas |
| :--- | :--- | :--- |
| `lookup_patient(dni)` | `GET /fhir/r4/Patient?identifier={dni}` | Devuelve `Bundle`. Si vuelven 2 (varón/mujer), la IA debe desambiguar preguntando el sexo. |
| `register_patient(...)` | `POST /fhir/r4/Patient` con `gender` mapeado a FHIR | El HCE valida `(dni, gender, tenant)` único. Antes de crear, CliniChat puede validar con SISA (vía HCE) — coordinar con `integrations`. |
| `create_appointment(...)` | `POST /fhir/r4/Appointment` con `idempotencyKey` | El HCE resuelve `patientId` por `(dni, gender)`. |
| (cancelar turno) | `PATCH /fhir/r4/Appointment/{id}/cancel` | — |

### 3.3 Autenticación (contrato; lo detalla `security`)

CliniChat es una **máquina** (Cloudflare Worker), no un usuario interactivo. Necesita un token de servicio:

- Flujo **OAuth2 Client Credentials** contra Keycloak (`POST {issuer}/protocol/openid-connect/token`, `grant_type=client_credentials`), con un **service account client** dedicado (p. ej. `clinichat-service`).
- El access token resultante **DEBE** incluir:
  - **`tenant_id`**: el `jwt.strategy.ts` del HCE lo lee de `payload.tenant_id`. Sin él, todo cae al fallback `sub` y rompe el aislamiento. → `security` debe configurar un **protocol mapper** en Keycloak que inyecte el `tenant_id` correcto del consultorio en el token del service account. **Una clínica = un service account con su `tenant_id`.**
  - **`realm_access.roles`** con al menos `recepcionista` (para `POST Patient` y `POST/PATCH Appointment`). No darle `medico`/`administrador` (mínimo privilegio).
- CliniChat cachea el token y lo renueva por expiración. Detalle de rotación/secret storage → `security` + `devops`.

> Lo que `architect` fija como requisito duro: **el endpoint del HCE no cambia su contract de auth**; sigue siendo `Bearer` JWT con `tenant_id` y roles. El trabajo es de Keycloak, no del backend.

### 3.4 Mapeo de género español → FHIR (y dónde vive)

| CliniChat (español) | HCE / FHIR R4 |
| :--- | :--- |
| `masculino` | `male` |
| `femenino` | `female` |
| `otro` | `other` |
| `no_especificado` | `unknown` |

**Dónde vive el mapeo:** en el **lado de CliniChat**, en una función pura única (p. ej. `src/lib/hce-client.ts` → `mapGenderToFhir()` / `mapGenderFromFhir()`), aplicada justo antes de llamar a la API del HCE y justo después de leerla. Razón: el HCE ya habla FHIR nativo (`male/female/other/unknown`); no debe ensuciarse con español. Mantener el mapeo en un solo módulo evita divergencias entre los 4 tools.

> SISA: cuando el HCE valida `(dni, gender)` contra RENAPER vía `SisaService`, ya espera `gender` en formato FHIR (`male/female`), así que el mapeo debe ocurrir **antes** de tocar el HCE.

### 3.5 Diagrama de flujo (reserva de turno por WhatsApp)

```
Paciente (WhatsApp)
      │  "Quiero un turno"
      ▼
Meta WhatsApp Cloud API ──► Cloudflare Worker (CliniChat)
                                   │
                                   ▼
                         IA (OpenAI function calling)
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                            ▼
 lookup_patient(dni)        register_patient(...)        create_appointment(...)
        │                          │                            │
        │  mapGenderToFhir()       │  mapGenderToFhir()         │ (+ idempotencyKey)
        ▼                          ▼                            ▼
   GET /fhir/r4/Patient      POST /fhir/r4/Patient      POST /fhir/r4/Appointment
   ?identifier={dni}         (gender FHIR)              (resuelve patientId por (dni,gender))
        │                          │                            │
        └──────────────┬───────────┴────────────────────────────┘
                       ▼
        HCE Backend (NestJS) — AuthGuard('jwt') + RolesGuard
                       │  token Keycloak: Bearer + tenant_id + roles
                       ▼
        PostgreSQL (fhir_patients / fhir_appointments, filtrado por tenant_id)
                       │
                       ▼
        Respuesta FHIR ──► IA arma mensaje ──► Meta API ──► Paciente
```

Supabase de CliniChat queda en paralelo solo para: `messages` (historial conversacional), `conversation_states` (pausar IA), `phone_contacts`/`patient_contacts` (qué teléfono → qué `patient_id` del HCE).

---

## 4. Trade-offs y riesgos

### 4.1 Doble fuente de verdad de la agenda
- **Hoy:** CliniChat es dueño de la agenda (genera slots desde `doctor_schedules`, evita solapamientos, lee `appointments` Supabase). **Tarea 5.2** moverá esa autoridad al HCE.
- **Riesgo en 5.1:** durante la transición, el turno existe en **dos lugares** (Supabase `appointments` + HCE `fhir_appointments`). Si CliniChat crea en HCE pero su cálculo de slots sigue leyendo Supabase, puede haber descoordinación (doble booking) si dos canales reservan el mismo slot.
- **Mitigación interina:** definir el HCE como destino de escritura "espejo" en 5.1 (CliniChat sigue calculando disponibilidad, pero el HCE es el registro canónico/auditable). En 5.2, invertir: el HCE expone disponibilidad (`Slot`) y CliniChat la **consume** en vez de calcularla. No mantener la agenda en dos motores a largo plazo.

### 4.2 `unknown` como componente de clave débil
- Si CliniChat envía `no_especificado` → `unknown`, dos personas con el mismo DNI ambas como `unknown` colisionarían en `(dni, unknown, tenant)`, perdiendo la desambiguación que justifica la clave.
- **Mitigación:** apoyarse en `SisaService.verificarPorDni(dni, gender)` para **resolver el sexo real** (RENAPER devuelve `male`/`female`) antes de crear el paciente, de modo que `gender` casi nunca sea `unknown` para personas reales argentinas. El flujo de CliniChat debería pedir/confirmar sexo cuando RENAPER no resuelva. Documentar que `unknown` es estado transitorio, no destino.

### 4.3 Idempotencia de creación
- WhatsApp/Meta y la IA pueden reintentar; sin protección se crean turnos duplicados.
- **Mitigación:** `idempotencyKey UNIQUE` en `AppointmentEntity`. CliniChat genera la key de forma determinística (p. ej. `hash(dni + start + practitioner)`); el HCE devuelve el turno existente si la key se repite. Mismo principio que CliniChat ya usa con `whatsapp_message_id UNIQUE` para deduplicar webhooks.
- Para `POST Patient`, la idempotencia natural es la propia clave `(dni, gender, tenant)`: un segundo POST devuelve `409 Conflict` (ya implementado), que CliniChat debe tratar como "ya existe → hacer lookup" en vez de error.

### 4.4 Destino de las tablas Supabase de pacientes de CliniChat
- `patients`, y los `patient_contacts.patient_id` que la referencian, quedan **obsoletos como fuente de verdad**.
- **Plan recomendado:**
  1. **Migración única (one-shot):** por cada fila en Supabase `patients`, hacer `lookup` en el HCE por `(dni, gender mapeado)`; si no existe, `POST /fhir/r4/Patient`. Guardar el `patientId` del HCE devuelto.
  2. **Re-apuntar enlaces:** `patient_contacts.patient_id` deja de referenciar `patients(id)` Supabase y pasa a guardar el **UUID del paciente del HCE** (columna `hce_patient_id` o reutilizando `patient_dni` como clave de reconciliación).
  3. **Congelar/vaciar** la tabla `patients` de CliniChat (no se le escribe más; opcionalmente se deja en solo-lectura como histórico, o se elimina tras validar la migración).
  4. Reescribir los 4 tools para que no toquen `patients` Supabase.
- **Riesgo:** colisiones de género en la migración (CliniChat `gender` en español, a veces `no_especificado`). Resolver con SISA durante la migración; las filas irresolubles se marcan para revisión manual, no se importan a ciegas.
- **Owner:** la ejecución de esta migración la coordinan `integrations` (reescritura de tools) + `devops` (script de backfill). `architect` define el contrato; no ejecuta.

---

## 5. Resumen de decisiones de diseño

1. **Clave de unicidad** pasa de `dni` (columna UNIQUE) a índice compuesto `UNIQUE (dni, gender, tenant_id)`. Verificación lógica en `create()`/`update()` a `{ dni, gender, tenantId }`. **Búsqueda intacta** (solo DNI; desambiguación humana en la grilla). Migración con detección previa de colisiones + `DROP CONSTRAINT` viejo + `CREATE UNIQUE INDEX CONCURRENTLY`.
2. **`/fhir/r4/Appointment`** nuevo módulo (`AppointmentEntity` espejo de `EncounterEntity`: columnas indexables + `payload` JSONB FHIR R4), tenant-scoped, con `idempotencyKey UNIQUE`. POST/GET/GET:id/PATCH cancel/PUT. Profesional como referencia ligera; agenda nativa (`Practitioner`/`Slot`) **diferida a 5.2**.
3. **Integración HCE master:** CliniChat reescribe sus 4 tools para operar contra `/fhir/r4/Patient` y `/fhir/r4/Appointment` con token Keycloak client-credentials que **debe** portar `tenant_id` + rol `recepcionista`. Mapeo género español↔FHIR en un único módulo de CliniChat (`mapGenderToFhir`/`FromFhir`).
4. **Riesgos** acotados: doble agenda (transitorio hasta 5.2), `unknown` débil (mitigado por SISA/RENAPER), idempotencia (key única), y migración/vaciado de la tabla `patients` de Supabase hacia el padrón del HCE.

---

## 6. Handoff — qué resuelven `fhir-mcp` y `security` después de mí

**Para `fhir-mcp`:**
- Cerrar el perfil FHIR R4 de `Appointment`: `serviceCategory`/`serviceType` con CodeableConcept (sistema de códigos para especialidades), `cancelationReason`, `participant[].required`/`status`, `appointmentType`. Definir la extensión `origin-channel`.
- Confirmar el `Bundle searchset` y los `search params` FHIR estándar (`date`, `patient`, `practitioner`, `status`) vs. los nombres de query propuestos.
- Validar el recurso `Patient` con `gender` y los identifiers (`identifier.system` para DNI/RENAPER) para que el contrato de CliniChat sea conforme.
- Definir el contrato MCP si CliniChat consumirá el HCE vía MCP además de REST.

**Para `security`:**
- Configurar en Keycloak el **service account client** `clinichat-service` (client-credentials) con **protocol mapper** que inyecte `tenant_id` por clínica y el rol mínimo `recepcionista`. Una clínica = un service account.
- Política de rotación/almacenamiento del client secret en CliniChat (Cloudflare secrets) y rate-limiting.
- Definir auditoría de los turnos (¿`AppointmentAuditService` análogo a `PatientAuditService`? quién/qué/cuándo, especialmente cancelaciones y creaciones por canal `whatsapp`).
- Revisar el riesgo de que un token de CliniChat con `tenant_id` mal mapeado escriba en el tenant equivocado (Quality Gate Zero Trust).
- Consentimiento Ley 26.529 / 25.326: CliniChat hoy setea `consent_data_treatment`/`consent_whatsapp`; definir cómo se refleja ese consentimiento en el `Patient` del HCE.
```