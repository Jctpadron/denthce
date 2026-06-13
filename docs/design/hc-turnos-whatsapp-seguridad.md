# Seguridad Zero Trust — Integración de Turnos por WhatsApp (CliniChat ↔ HCE)

> Agente: `security` · Fecha: 2026-05-30 · Estado: DISEÑO (no implementado)
> Parte de: `docs/design/hc-turnos-whatsapp-arquitectura.md` (architect). Este documento cierra el handoff de la sección 6 ("Para `security`").
> Stack verificado: NestJS + Keycloak OIDC (`passport-jwt`/`jwks-rsa`), multi-tenant Zero Trust (filtrado por `tenantId` extraído del JWT). Roles de realm: `medico`, `enfermero`, `recepcionista`, `administrador`, `paciente`.

---

## 0. Contexto verificado contra el código real (no re-derivado)

Leído en este repo:

- **`hce-backend/src/auth/jwt.strategy.ts`** — `validate(payload)`:
  ```ts
  let tenantId = payload.tenant_id || payload.sub;   // ← FALLBACK A sub
  ...
  const roles = (payload.realm_access || {}).roles || [];
  return { userId: payload.sub, tenantId, username, email, roles };
  ```
  El token se valida contra el JWKS del realm (`RS256`, `issuer` fijo, `ignoreExpiration:false`). **Cualquier** token firmado por el realm `hce-realm` y no expirado es aceptado: NO hay validación de `azp`/`client_id`, NI de audiencia (`aud`), NI lista blanca de clientes.
- **`roles.guard.ts`** — autoriza si el usuario tiene **alguno** de los roles requeridos (OR). Si el endpoint no declara `@Roles(...)`, **deja pasar** (`return true`).
- **`patient-audit.service.ts` / `patient-audit.entity.ts`** — auditoría inmutable: tabla `patient_audit_log`, solo INSERT vía `save()`, sin UPDATE/DELETE, columnas `user_id`, `user_name`, `action`, `changed_fields` (JSONB diff), `payload_snapshot` (JSONB), `created_at`. Compatible con AuditEvent FHIR R4. **No registra IP, canal ni client_id del actor.**
- **`patient.service.ts`** — `create()` audita con `userCtx?.userId || 'system'` / `userCtx?.userName || 'Sistema'`. Si el controller no pasa `userCtx`, el evento queda imputado a "Sistema" (anónimo).
- **`configs/keycloak/hce-realm.json`** y **`aws/keycloak/hce-realm.json`** — existe un cliente confidencial `hce-backend` con `serviceAccountsEnabled:true` PERO **sin protocol mapper de `tenant_id`** y con **secret hardcodeado en el JSON** (`hce_backend_super_secret_key_2026`). El mapper `tenant_id` (tipo `oidc-usermodel-attribute-mapper`, lee `user.attribute=tenant_id`) solo existe en el cliente público `hce-app`. No existe rol `servicio-turnos`.

### Hallazgos de seguridad PREEXISTENTES (fuera del alcance de esta tarea, pero bloquean producción)

| # | Severidad | Hallazgo | Acción |
| :-- | :-- | :-- | :-- |
| H-0 | **CRÍTICA** | Secret de `hce-backend` hardcodeado en ambos realm JSON, versionado en git. | `devops`: rotar y mover a variable/secret de import; purgar del historial si el repo es accesible. |
| H-1 | **ALTA** | `jwt.strategy` no valida `aud` ni `azp`/cliente emisor. Cualquier cliente del realm puede llamar al backend. | Endurecer `validate()` (ver §1.4). |
| H-2 | **ALTA** | Fallback `tenant_id \|\| sub`: un token **sin** `tenant_id` NO se rechaza; opera bajo `tenantId = sub`. Para un service account mal configurado esto NO causa fuga cruzada (su `sub` es único) pero **rompe silenciosamente** el aislamiento esperado y deja datos huérfanos en un "tenant fantasma". | Rechazar tokens de servicio sin `tenant_id` (ver §1.4). |
| H-3 | MEDIA | Auditoría no registra `client_id`/canal/IP del actor. | Extender el modelo de auditoría (ver §4). |

> Estos hallazgos NO los introduce CliniChat, pero la integración los **amplifica** (un actor máquina, no humano, automatizado y de alto volumen). Se documentan como requisitos duros para `devops`/`architect`.

---

## 1. Service account `clinichat-service` (OAuth2 Client Credentials)

### 1.1 Principio rector

**Una clínica = un service account = un `tenant_id`.** El aislamiento Zero Trust NO se delega al código de CliniChat; se ancla en el token: cada Worker de cada clínica obtiene tokens de **su** cliente Keycloak, cuyo `tenant_id` está fijado en Keycloak y es **inmutable desde el cliente** (CliniChat no puede elegir ni sobrescribir su tenant). Si CliniChat gestiona N clínicas, hay N clientes Keycloak (`clinichat-<slug-clinica>`), no uno multi-tenant.

> Rechazado explícitamente: un único `clinichat-service` que mande `tenant_id` por parámetro/header. Eso movería la decisión de aislamiento al cliente (anti Zero Trust). El `tenant_id` SIEMPRE viene del claim firmado por Keycloak.

### 1.2 Definición del cliente Keycloak (por clínica)

```jsonc
{
  "clientId": "clinichat-consultorio-dent-hce",   // un clientId por clínica
  "name": "CliniChat - Bot de Turnos (Consultorio DentHCE)",
  "enabled": true,
  "publicClient": false,
  "serviceAccountsEnabled": true,
  "standardFlowEnabled": false,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "authorizationServicesEnabled": false,
  "attributes": {
    "access.token.lifespan": "300",                // 5 min (sobrescribe el del realm)
    "client_credentials.use_refresh_token": "false"
  },
  "protocolMappers": [
    {
      "name": "tenant_id-hardcoded",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "consentRequired": false,
      "config": {
        "claim.name": "tenant_id",
        "claim.value": "mi_consultorio_dent_hce",   // ← tenant FIJO de esta clínica
        "jsonType.label": "String",
        "id.token.claim": "false",
        "access.token.claim": "true",               // debe ir en el access token
        "userinfo.token.claim": "false"
      }
    },
    {
      "name": "audience-hce-backend",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "config": {
        "included.custom.audience": "hce-backend",
        "access.token.claim": "true"
      }
    }
  ]
}
```

**Por qué `oidc-hardcoded-claim-mapper` y NO `oidc-usermodel-attribute-mapper`:** en client-credentials el "usuario" es el *service account user* del cliente. Se podría poner `tenant_id` como atributo de ese usuario de servicio y reutilizar el mapper de atributo (como hace `hce-app`). Ambos funcionan, pero el **hardcoded** es preferible aquí porque:
- El valor queda en la definición del **cliente** (versionable, revisable, una sola fuente), no oculto en un atributo de usuario de servicio.
- Es imposible que un cambio accidental en el usuario de servicio (p. ej. via Admin API) altere el tenant sin pasar por la config del cliente.

> Alternativa válida si `devops` ya gestiona atributos de usuario de servicio por script: usar `oidc-usermodel-attribute-mapper` con `user.attribute=tenant_id` y setear el atributo en el service-account-user. **Decisión de seguridad: cualquiera de las dos, pero el `tenant_id` DEBE viajar en el `access.token` como `String` simple (no array).**

### 1.3 Compatibilidad con `jwt.strategy.validate()` — CONFIRMADO con un ajuste

El claim `tenant_id` (String) producido por el mapper es consumido **tal cual** por:
```ts
let tenantId = payload.tenant_id || payload.sub;
if (Array.isArray(tenantId) && tenantId.length > 0) tenantId = tenantId[0];
```
→ Con `tenant_id` presente como String, `validate()` devuelve `tenantId = "mi_consultorio_dent_hce"`. **No requiere cambios en el backend para funcionar.** El array-guard ya cubre el caso de mappers que emiten array.

Los roles llegan en `payload.realm_access.roles`; el service account los expone igual que un usuario (ver §1.5).

### 1.4 Ajuste OBLIGATORIO en `jwt.strategy` (requisito duro para `architect`)

Para que la integración sea Zero Trust de verdad y no dependa de la suerte del fallback, `validate()` debe **rechazar** tokens cuyo `tenant_id` no esté presente, en lugar de degradar a `sub`. Propuesta exacta:

```ts
async validate(payload: any) {
  const roles = (payload.realm_access || {}).roles || [];

  // 1) Rechazar audiencias no esperadas (cierra H-1)
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes('hce-backend')) {
    throw new UnauthorizedException('Token sin audiencia hce-backend.');
  }

  // 2) tenant_id OBLIGATORIO y explícito. Sin fallback silencioso a sub. (cierra H-2)
  let tenantId = payload.tenant_id;
  if (Array.isArray(tenantId)) tenantId = tenantId[0];
  if (!tenantId || typeof tenantId !== 'string') {
    throw new UnauthorizedException('Token sin claim tenant_id válido.');
  }

  return {
    userId: payload.sub,
    tenantId,
    username: payload.preferred_username || payload.clientId || payload.azp,
    email: payload.email,
    roles,
    // metadatos para auditoría imputable
    clientId: payload.azp || payload.clientId,
    isServiceAccount: !!payload.clientId || payload.preferred_username?.startsWith('service-account-'),
  };
}
```

> Nota de compatibilidad: hoy los usuarios humanos `nurse_maria` NO tienen `tenant_id` (ver realm). Si se aplica el rechazo estricto, **todo usuario humano debe tener su atributo `tenant_id`** o quedará fuera. Esto es lo correcto (un usuario sin tenant no debería poder operar) pero `devops` debe completar el atributo en todos los usuarios antes de desplegar el ajuste. Mientras tanto, una variante menos disruptiva: aplicar el rechazo estricto **solo a service accounts** (`if (isServiceAccount && !payload.tenant_id) throw`), manteniendo el fallback para humanos. Decisión recomendada: **estricto para todos**, completando atributos primero.

### 1.5 Rol mínimo — análisis y decisión

Endpoints que CliniChat necesita (de la tabla §2.4 y §3.2 de architect):

| Acción | Endpoint | Roles que hoy lo permiten |
| :-- | :-- | :-- |
| Buscar paciente | `GET /fhir/r4/Patient?identifier=` | `medico, recepcionista, administrador` (según controller) |
| Crear paciente | `POST /fhir/r4/Patient` | `medico, recepcionista, administrador` |
| Crear turno | `POST /fhir/r4/Appointment` | `medico, recepcionista, administrador` |
| Cancelar turno | `PATCH /fhir/r4/Appointment/:id/cancel` | `medico, recepcionista, administrador` |
| Ver turno | `GET /fhir/r4/Appointment/:id` | + `paciente` |

`recepcionista` **alcanza** funcionalmente. PERO `recepcionista` es un rol humano con más superficie de la que el bot necesita (puede editar toda la demografía, ver agendas completas, etc.). Por **mínimo privilegio** se define un rol dedicado:

**DECISIÓN: crear rol de realm `servicio-turnos`** con acceso acotado exactamente a las 5 operaciones de arriba. Esto:
- Permite revocar/auditar al bot sin tocar a las recepcionistas humanas.
- Hace explícito en los logs y en el realm que "esto es una máquina".
- Permite endurecer endpoints futuros (p. ej. negar a `servicio-turnos` el `PUT /Patient` de edición masiva si se decide que el bot solo crea, no edita).

```jsonc
// roles.realm += 
{
  "name": "servicio-turnos",
  "description": "Cuenta de servicio (no humana) para bots de reserva de turnos (CliniChat). Mínimo privilegio: crear/buscar paciente y crear/cancelar turnos en su tenant."
}
```

El cliente `clinichat-<clinica>` recibe este rol vía `serviceAccountRealmRoles` (o asignación de rol al service-account-user). **NO** se le asignan `medico`/`administrador`/`enfermero`.

**Requisito duro para `architect`/`code-generator`:** los `@Roles(...)` de `PatientController` y `AppointmentController` deben **añadir** `'servicio-turnos'` a las operaciones que el bot usa, p. ej.:
```ts
@Roles('medico', 'recepcionista', 'administrador', 'servicio-turnos')
```
Decisión fina recomendada: dar a `servicio-turnos` `POST/GET Patient`, `GET Patient`, `POST Appointment`, `PATCH /Appointment/:id/cancel`. **NO** darle `PUT /Patient/:id` (edición demográfica) salvo que producto lo exija; si CliniChat necesita actualizar teléfono/consentimiento, ver §6.

---

## 2. Flujo de obtención y uso del token (Cloudflare Worker)

```
Cloudflare Worker (CliniChat, por clínica)
  │
  │ 1) ¿token en caché y no expira en < 60s?  ──► sí ──► reusar
  │ 2) no ──►
  ▼
POST {KEYCLOAK_ISSUER}/protocol/openid-connect/token
   Content-Type: application/x-www-form-urlencoded
   grant_type=client_credentials
   client_id=clinichat-consultorio-dent-hce
   client_secret={env.CLINICHAT_CLIENT_SECRET}     ← Wrangler secret, NUNCA en código
  │
  ▼
{ access_token (JWT RS256, exp 300s, claim tenant_id + roles + aud=hce-backend), expires_in: 300 }
  │  cachear en memoria del Worker (o KV con TTL = expires_in - 60s)
  ▼
Llamadas al HCE:  Authorization: Bearer {access_token}
                  + X-Idempotency-Key (turnos)   + X-Request-Origin: whatsapp (informativo)
```

Reglas:
- **No** usar `refresh_token` en client-credentials (`client_credentials.use_refresh_token=false`): ante expiración, se pide un token nuevo. Más simple y sin estado.
- **Caché con margen:** renovar cuando falte < 60s para `exp`, evitando 401 por reloj.
- **Manejo de 401:** un 401 del HCE ⇒ invalidar el token cacheado y reintentar **una** vez con token fresco. Si el segundo 401 persiste ⇒ alertar (secret rotado/cliente deshabilitado), NO reintentar en bucle.
- **Rate limiting al endpoint de token:** cachear evita martillar Keycloak; el Worker no debe pedir token por request.

---

## 3. Gestión del client secret (requisito duro para `devops` + `integrations`)

| Aspecto | Decisión |
| :-- | :-- |
| Almacenamiento | **Wrangler secret** (`wrangler secret put CLINICHAT_CLIENT_SECRET`). NUNCA en `wrangler.toml`, código, ni git. Una entrada por clínica/entorno. |
| Acceso en código | Solo vía `env.CLINICHAT_CLIENT_SECRET` (binding de secret). Prohibido loguearlo, devolverlo en respuestas, o ponerlo en mensajes de error. |
| Rotación | Cada **90 días** o ante sospecha. Procedimiento sin downtime: en Keycloak generar **secret nuevo** → actualizar Wrangler secret → desplegar → confirmar tokens OK → invalidar secret viejo. Keycloak permite regenerar; coordinar ventana corta. |
| Caducidad de tokens | `access.token.lifespan = 300s` (5 min) en el cliente. Sin refresh token. |
| Separación de entornos | Un cliente/secret distinto por entorno (`clinichat-...-dev`, `-prod`) y por clínica. El secret de prod jamás se comparte con dev. |
| Secret del realm versionado | **H-0**: el `secret` de `hce-backend` en los realm JSON debe salir del repo (placeholder + import por variable). El cliente `clinichat-*` NO debe tener `secret` en el JSON versionado; se genera en Keycloak y se exporta solo a Wrangler. |

---

## 4. Auditoría — `AppointmentAuditService` (inmutable, FHIR AuditEvent)

Análogo a `PatientAuditService`, con tabla **append-only** `appointment_audit_log`. Toda operación del bot debe quedar **imputable al service account** y marcar el **canal de origen**.

### 4.1 Entidad `AppointmentAuditEntity` (`appointment_audit.entity.ts`)

```ts
@Entity('appointment_audit_log')
export class AppointmentAuditEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'appointment_id' }) appointmentId: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'patient_id', nullable: true }) patientId: string;

  /** 'CREATE' | 'CANCEL' | 'UPDATE' | 'READ'  (READ opcional para GET de ePHI) */
  @Column() action: string;

  /** Actor: usuario humano o service account. */
  @Column({ name: 'actor_id', nullable: true }) actorId: string;          // payload.sub
  @Column({ name: 'actor_name', nullable: true }) actorName: string;       // username / service-account-...
  @Column({ name: 'actor_client_id', nullable: true }) actorClientId: string; // payload.azp → 'clinichat-...'
  @Column({ name: 'is_service_account', default: false }) isServiceAccount: boolean;

  /** Canal: 'whatsapp' | 'recepcion' | 'portal' | 'api'. Para turnos del bot SIEMPRE 'whatsapp'. */
  @Column({ name: 'origin_channel', default: 'api' }) originChannel: string;

  /** IP/Origen de red del actor (del header X-Forwarded-For tras el proxy). */
  @Column({ name: 'source_ip', nullable: true }) sourceIp: string;

  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields: Record<string, { before: any; after: any }>;

  @Column({ name: 'cancellation_reason', nullable: true }) cancellationReason: string;
  @Column({ name: 'payload_snapshot', type: 'jsonb', nullable: true }) payloadSnapshot: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
```

> Diferencias clave frente a `PatientAuditEntity`: añade `actor_client_id`, `is_service_account`, `origin_channel`, `source_ip`. Esto hace **imputable** la acción del bot: un turno creado por WhatsApp queda como `action=CREATE, origin_channel=whatsapp, actor_client_id=clinichat-consultorio-dent-hce, is_service_account=true`. Sin esto no se puede distinguir un turno del bot de uno de recepción.

### 4.2 Inmutabilidad (refuerzo a nivel BD — requisito duro para `devops`)

`save()` de TypeORM solo INSERTa, pero a nivel DB hay que **garantizar** que nadie haga UPDATE/DELETE:
- `REVOKE UPDATE, DELETE ON appointment_audit_log FROM <rol-app>;` (y lo mismo para `patient_audit_log`, que hoy no lo tiene → H-3 ampliado).
- Ideal: trigger `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION` o tabla particionada/WORM. Alinear con `scripts/audit_init.sql` (recurso AuditEvent ya diseñado en el proyecto).

### 4.3 Qué se audita (mínimo obligatorio)

| Operación | action | Se registra |
| :-- | :-- | :-- |
| `POST /Appointment` | CREATE | actor (client_id), canal `whatsapp`, patientId, snapshot, idempotencyKey |
| `PATCH /Appointment/:id/cancel` | CANCEL | actor, canal, `cancellation_reason`, snapshot previo |
| `PUT /Appointment/:id` | UPDATE | diff `changed_fields` |
| `POST /Patient` (por el bot) | CREATE | reusar `PatientAuditService` extendido con actor_client_id + canal (ver §4.4) |

### 4.4 Requisito duro para `architect`: propagar el contexto del actor

Hoy `PatientService.create()` recibe `userCtx?: { userId, userName }`. Debe **extenderse** a:
```ts
userCtx?: { userId; userName; clientId?; isServiceAccount?; originChannel?; sourceIp? }
```
y el controller debe poblarlo desde `req.user` (que ahora trae `clientId`/`isServiceAccount` por §1.4) y headers (`X-Request-Origin`, `X-Forwarded-For`). Sin esto, los turnos/pacientes del bot quedan auditados como "Sistema" y se pierde la imputabilidad — **inaceptable** para ePHI bajo Ley 26.529.

### 4.5 Mapeo a AuditEvent FHIR R4 (para reporting)

Cada fila se proyecta a `AuditEvent`: `type` (rest), `subtype` (create/cancel), `action` (C/U), `recorded` (created_at), `agent[]` (who=actor_id, requestor, `agent.network.address`=source_ip, `agent.purposeOfUse`), `source.observer` (HCE), `entity[]` (what=Appointment/Patient + canal en `entity.detail`). Cierre fino del perfil → `fhir-mcp`.

---

## 5. Quality Gate Zero Trust — casos de prueba para `qa`

Objetivo: **demostrar que un `tenant_id` ausente, mal mapeado o cruzado NO permite leer/escribir datos de otra clínica.** `qa` debe ejecutar estos casos (Jest e2e contra el backend con tokens reales/forjados firmados por un realm de test).

### 5.1 Aislamiento de tenant (CRÍTICOS — bloquean el merge)

| ID | Escenario | Resultado esperado |
| :-- | :-- | :-- |
| ZT-01 | Token de `clinichat-clinicaA` (`tenant_id=A`) hace `GET /fhir/r4/Patient?identifier=<dni de clínica B>` | `Bundle` **vacío** (total=0). NUNCA devuelve el paciente de B. |
| ZT-02 | Token tenant=A hace `POST /Appointment` con `patientDni` que solo existe en B | Falla resolución de paciente (404/400). NO crea turno apuntando a paciente de B. |
| ZT-03 | Token tenant=A hace `GET /Appointment/:id` de un turno de B | 404 (no encontrado en su tenant), no 403 con datos. |
| ZT-04 | Token tenant=A hace `PATCH /Appointment/:id/cancel` de un turno de B | 404. El turno de B queda intacto (verificar en BD). |
| ZT-05 | Dos clínicas con **mismo `(dni, gender)`**: crear paciente en A y en B; verificar que son filas distintas y cada token solo ve la suya | Cada tenant ve exactamente 1; no hay colisión ni fuga. |

### 5.2 Token mal formado / sin tenant (CRÍTICOS)

| ID | Escenario | Resultado esperado |
| :-- | :-- | :-- |
| ZT-06 | Token **sin** claim `tenant_id` (mapper olvidado) | **401** (tras ajuste §1.4). NO debe operar con `tenantId=sub`. Si el ajuste no está, documentar que cae a tenant fantasma y BLOQUEAR despliegue. |
| ZT-07 | Token con `tenant_id` **distinto** al del cliente (forjado/manipulado) firmado por OTRA clave | 401 (firma inválida, JWKS no valida). |
| ZT-08 | Token sin audiencia `hce-backend` (de cliente `hce-app` u otro) | 401 (tras ajuste §1.4 / cierre H-1). |
| ZT-09 | Token **expirado** (> 300s) | 401 (`ignoreExpiration:false`). |
| ZT-10 | `tenant_id` como **array** `["A"]` | Se normaliza a `"A"` (array-guard existente), opera en A. |

### 5.3 Mínimo privilegio del rol (ALTOS)

| ID | Escenario | Resultado esperado |
| :-- | :-- | :-- |
| ZT-11 | Token `servicio-turnos` intenta un endpoint clínico (`POST /fhir/r4/Encounter`, SOAP, prescripción) | **403** (rol no autorizado). El bot NO escribe historia clínica. |
| ZT-12 | Token `servicio-turnos` intenta `GET` de auditoría / gestión de usuarios | 403. |
| ZT-13 | Token `servicio-turnos` hace las 5 operaciones permitidas (lookup/create Patient, create/cancel/get Appointment) | 2xx en todas. |
| ZT-14 | Token `servicio-turnos` intenta `PUT /Patient/:id` (si producto NO lo habilitó) | 403. |

### 5.4 Auditoría e idempotencia (ALTOS)

| ID | Escenario | Resultado esperado |
| :-- | :-- | :-- |
| ZT-15 | `POST /Appointment` por el bot | Existe fila en `appointment_audit_log` con `action=CREATE, origin_channel=whatsapp, actor_client_id=clinichat-..., is_service_account=true`. |
| ZT-16 | `PATCH .../cancel` | Fila `action=CANCEL` con `cancellation_reason` y actor correcto. |
| ZT-17 | Reintento de `POST /Appointment` con misma `idempotencyKey` | Devuelve el MISMO turno (no duplica) y **no** genera un segundo CREATE espurio en auditoría (o lo marca como reintento). |
| ZT-18 | Intentar `UPDATE`/`DELETE` directo sobre `appointment_audit_log` | Rechazado por permisos/trigger (inmutabilidad). |

> `qa` reporta este Quality Gate como **aprobado/rechazado**. Cualquier CRÍTICO en rojo ⇒ veredicto **rechazado**, no se fusiona.

---

## 6. Consentimiento (Ley 26.529 / 25.326) y ePHI

### 6.1 Qué captura CliniChat hoy

CliniChat setea `consent_data_treatment` (tratamiento de datos, Ley 25.326 de Protección de Datos Personales) y `consent_whatsapp` (consentimiento de contacto por WhatsApp). Bajo Ley 26.529 (derechos del paciente / HCE), el consentimiento informado es parte del expediente.

### 6.2 Cómo se refleja en el `Patient` del HCE — DOS opciones, decisión recomendada

**Opción A (mínima, recomendada para 5.1): extensiones en `Patient`.** Reusar el patrón de extensión que ya usa `PatientService` (`extension[]` con `url` propia + valor). Añadir:

```jsonc
"extension": [
  {
    "url": "http://hospital.gov/fhir/StructureDefinition/consent-data-treatment",
    "extension": [
      { "url": "granted", "valueBoolean": true },
      { "url": "law", "valueString": "Ley 25.326" },
      { "url": "channel", "valueCode": "whatsapp" },
      { "url": "timestamp", "valueDateTime": "2026-05-30T12:00:00-03:00" }
    ]
  },
  {
    "url": "http://hospital.gov/fhir/StructureDefinition/consent-whatsapp-contact",
    "extension": [
      { "url": "granted", "valueBoolean": true },
      { "url": "law", "valueString": "Ley 26.529" },
      { "url": "timestamp", "valueDateTime": "2026-05-30T12:00:00-03:00" }
    ]
  }
]
```
Ventaja: cero entidades nuevas, viaja con el paciente, se audita con el snapshot del payload que ya guarda `PatientAuditService`.

**Opción B (completa, para fase posterior): recurso `Consent` FHIR R4 propio** (`/fhir/r4/Consent`), con `status`, `scope=patient-privacy`, `category`, `patient`, `dateTime`, `policyRule`, `provision`. Es lo correcto a largo plazo (permite revocación con histórico, granularidad por propósito) pero excede 5.1. → diferir y dejar nota para `architect`/`fhir-mcp`.

**DECISIÓN:** Opción A ahora; planificar Opción B cuando exista módulo de consentimiento. El bot, al crear/actualizar el paciente, envía las extensiones de consentimiento. Si se necesita **actualizar** consentimiento sin reescribir todo el paciente, esa es la justificación para darle a `servicio-turnos` un `PATCH` acotado de consentimiento (no un `PUT` total) — decisión de producto.

### 6.3 Trazabilidad del consentimiento

Toda alta/cambio de consentimiento se audita (ya cubierto: `PatientAuditService` versiona `payload_snapshot` y `changed_fields` debe incluir los flags de consentimiento → añadir `consentDataTreatment`, `consentWhatsapp` a `trackedFields` de `PatientAuditService`). El "quién" debe ser el `clientId` del bot (§4.4), no "Sistema".

### 6.4 ePHI moviéndose entre Supabase (CliniChat) y el HCE — implicaciones

- **Minimización (GDPR art. 5 / espíritu Ley 25.326):** Supabase de CliniChat debe dejar de ser fuente de verdad de la demografía (decisión de architect: HCE master). Tras la migración, Supabase retiene solo lo necesario para la conversación (`messages`, `conversation_states`, mapeo teléfono→`patient_id`). **No** debe acumular copias de ePHI clínica (diagnósticos, historia) — el bot solo toca demografía + turnos.
- **Cifrado en tránsito (mTLS / TLS):** toda llamada CliniChat→HCE va por HTTPS/TLS. Requisito duro: el endpoint del HCE expuesto a CliniChat debe forzar TLS 1.2+; idealmente mTLS si el canal es servidor-a-servidor por red privada. Para el túnel actual (Cloudflare), TLS estricto extremo a extremo, sin terminación insegura intermedia.
- **Cifrado en reposo:** Supabase (Postgres gestionado) y el Postgres del HCE deben tener cifrado en reposo activado (TDE/volumen cifrado). `devops` confirma.
- **Residencia/transferencia:** mover demografía de un paciente argentino a Supabase (infra fuera del país) es una transferencia internacional de datos personales (Ley 25.326). El consentimiento de tratamiento debe contemplarlo. Recomendación: minimizar lo que persiste en Supabase y documentar la base legal. Punto a elevar al Super Admin / responsable legal — fuera del alcance técnico de `security`, pero **señalado como riesgo**.
- **Derecho de supresión / rectificación:** al ser el HCE el master, una baja/rectificación en el HCE debe propagarse o invalidar la caché de Supabase. Coordinar con `integrations`.

---

## 7. Resumen de decisiones y requisitos duros

### Decisiones de seguridad (este agente las certifica)
1. **Un cliente Keycloak `clinichat-<clinica>` por clínica**, confidencial, client-credentials, con **`tenant_id` hardcodeado por mapper** (inmutable desde el cliente) + audiencia `hce-backend`. Una clínica = un service account = un tenant.
2. **Rol dedicado `servicio-turnos`** (no reusar `recepcionista`), acotado a 5 operaciones: buscar/crear paciente, crear/cancelar/ver turno. Sin acceso clínico ni administrativo.
3. **`tenant_id` consumible por `validate()` tal cual** (String) — SIN cambios para funcionar, PERO se exige endurecer `validate()` para rechazar tokens sin `tenant_id` y sin audiencia `hce-backend` (cierra H-1/H-2).
4. **Secret en Wrangler secret**, rotación 90 días, tokens de 5 min sin refresh, separación dev/prod, y sacar secrets versionados del realm JSON (H-0).
5. **`AppointmentAuditService` inmutable** con `actor_client_id`, `is_service_account`, `origin_channel='whatsapp'`, `source_ip`; inmutabilidad reforzada a nivel BD; propagación obligatoria del contexto del actor desde el controller.
6. **Consentimiento por extensiones FHIR en `Patient`** (Opción A) ahora; recurso `Consent` diferido. Auditar flags de consentimiento.

### Requisitos duros para `integrations` (reescritura de tools CliniChat)
- Obtener token vía client-credentials con `client_id`+`secret` desde `env` (Wrangler), **nunca** hardcodeado; cachear con margen de 60s; manejar 401 con un solo reintento.
- Enviar `Authorization: Bearer`, `X-Idempotency-Key` en turnos, `X-Request-Origin: whatsapp`.
- Enviar consentimiento como extensiones FHIR al crear/actualizar paciente.
- No persistir ePHI clínica en Supabase; solo demografía/turnos mínimos y mapeo teléfono→`patient_id` del HCE.
- Tratar `409 Conflict` de `POST /Patient` como "ya existe → lookup", no como error.

### Requisitos duros para `devops`
- Crear rol `servicio-turnos` y los clientes `clinichat-*` en el realm (script de import), **sin** secret versionado; generar secret en Keycloak → Wrangler.
- Completar atributo `tenant_id` en TODOS los usuarios humanos antes de activar el `validate()` estricto.
- Rotar/extraer el secret de `hce-backend` del repo (H-0).
- `REVOKE UPDATE/DELETE` sobre `patient_audit_log` y `appointment_audit_log`; trigger de inmutabilidad; alinear con `scripts/audit_init.sql`.
- TLS estricto extremo a extremo CliniChat↔HCE (mTLS si es servidor-a-servidor); cifrado en reposo en ambos Postgres.

### Para `architect` / `code-generator`
- Endurecer `jwt.strategy.validate()` (§1.4): exigir `tenant_id` + `aud=hce-backend`; exponer `clientId`/`isServiceAccount`.
- Añadir `'servicio-turnos'` a los `@Roles(...)` de las 5 operaciones permitidas (y NO a las clínicas).
- Extender `userCtx` (controller → service → auditoría) con `clientId/isServiceAccount/originChannel/sourceIp`.
- Implementar `AppointmentAuditService`/entidad según §4 y añadir flags de consentimiento a `trackedFields` de `PatientAuditService`.

### Para `fhir-mcp`
- Cerrar perfil AuditEvent (§4.5) y, a futuro, recurso `Consent` (§6.2 Opción B).

---

## 8. Veredicto Quality Gate de seguridad (diseño)

```json
{
  "veredicto_quality_gate": "aprobado_con_condiciones",
  "condiciones_bloqueantes_para_implementacion": [
    "Crear rol servicio-turnos y cliente clinichat-<clinica> con tenant_id hardcodeado por mapper (no reusar recepcionista).",
    "Endurecer jwt.strategy.validate(): exigir tenant_id y aud=hce-backend (cierra H-1/H-2).",
    "Secret en Wrangler, fuera del repo; rotar el secret hardcodeado de hce-backend (H-0).",
    "AppointmentAuditService inmutable con actor_client_id + origin_channel=whatsapp + is_service_account; inmutabilidad a nivel BD.",
    "qa debe pasar TODOS los casos CRÍTICOS de §5 (ZT-01..ZT-09) antes de fusionar."
  ],
  "hallazgos_preexistentes": ["H-0 secret hardcodeado", "H-1 sin validar aud/azp", "H-2 fallback tenant_id->sub", "H-3 auditoria sin actor/canal/ip"]
}
```
