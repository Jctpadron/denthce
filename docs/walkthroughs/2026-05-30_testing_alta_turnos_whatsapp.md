# QA — Testing del flujo de alta de paciente (integración Turnos por WhatsApp / clave `(dni, gender)`)

> Agente: `qa` · Fecha: 2026-05-30 · Quality Gate de calidad
> Alcance: testing exhaustivo del alta de paciente en adelante, con foco en la nueva regla de unicidad `(dni, gender, tenantId)` diseñada para integrar CliniChat (turnos por WhatsApp).
> Diseños de referencia: `hc-turnos-whatsapp-arquitectura.md` (architect), `hc-turnos-whatsapp-fhir.md` (fhir-mcp), `hc-turnos-whatsapp-seguridad.md` (security).
> **Regla respetada: este agente NO modificó código de producción.** Solo se crearon archivos de test.

---

## 1. Línea base — `npm test` (antes de tocar nada)

Ejecutado en `hce-backend/`:

```
Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total
Time:        ~2 s
```

Specs preexistentes: `app.controller.spec.ts`, `odontology/odontology.controller.spec.ts`, `odontology/odontology.service.spec.ts`.
**Cobertura del alta de paciente antes de esta tarea: 0 (no existía ningún spec de `patient`).**

## 2. Resultado tras agregar la suite de QA

`npm test` (unitarios):

```
Test Suites: 4 passed, 4 total
Tests:       32 passed, 32 total   (+14 nuevos en patient.service.spec.ts)
```

`npm run test:e2e -- patient-alta` (contra stack real):

```
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

Todo en verde. Los casos RED están escritos afirmando el **comportamiento actual** (rechazo 409) con la aserción objetivo documentada en comentario, para dejar trazada la regresión sin romper el pipeline.

## 3. Tests nuevos creados (rutas absolutas)

| Archivo | Tipo | Qué cubre |
| :-- | :-- | :-- |
| `D:\APP-jct\app-historias-clinicas\hce-backend\src\patient\patient.service.spec.ts` | Unitario (mocks) | Alta válida, gender persistido, caso Argentina (RED), duplicado real, campos FHIR faltantes, auditoría con/sin actor, aislamiento tenant en findOne/update/create, búsqueda Bundle con 2 personas. 14 tests. |
| `D:\APP-jct\app-historias-clinicas\hce-backend\test\patient-alta.e2e-spec.ts` | E2E (HTTP real + token Keycloak) | Mismo flujo contra el backend desplegado en `:3000` con JWT real emitido por Keycloak (`hce-app`, grant password). 8 tests. Autodescarta (skip suave) si el stack no está disponible. |

## 4. Viabilidad de E2E — VERIFICADA Y APROVECHADA

El stack docker-compose **está levantado y operativo** en esta máquina:

- Postgres (`hce-database`), Keycloak (`hce-keycloak`), backend (`hce-backend-api`), frontend — todos `Up`.
- Backend responde `401` sin token y `200` con token → auth activa y funcional.
- Keycloak realm `hce-realm` OK; cliente público `hce-app` con `directAccessGrantsEnabled:true` → se obtienen **tokens reales** por password grant.
- Usuarios de test disponibles: `doctor_julio` (tenant `mi_consultorio_dent_hce`, rol `medico`), `admin_hce` (mismo tenant, `administrador`), `nurse_maria` (**sin** `tenant_id`, rol `enfermero`).

Por eso el e2e NO es simulado: golpea el backend real. Pacientes de prueba creados durante la verificación fueron **eliminados** de la BD al terminar.

### Limitaciones reales del entorno (no inventadas)
- **Solo existe UN tenant real** (`mi_consultorio_dent_hce`). No hay un segundo tenant/usuario para ZT-01..ZT-05 (aislamiento cruzado real). Esos casos quedan **PENDIENTES (requieren entorno)**.
- **No existe** el cliente `clinichat-*` ni el rol `servicio-turnos` (aún no implementados por security/devops). ZT-11..ZT-18 quedan **PENDIENTES**.
- Los tokens humanos actuales **NO traen `aud`** (`aud=None`, confirmado decodificando el JWT) → ZT-08 ya es reproducible pero el backend hoy lo acepta (H-1 sin cerrar).

## 5. Tabla de casos — flujo de alta

| # | Caso | Estado | Evidencia / Motivo |
| :-- | :-- | :-- | :-- |
| 1 | Alta válida (payload FHIR completo) persiste `gender` correcto | **PASS** | Unit + E2E (POST → 201, `gender='female'`) |
| 2 | `gender` ausente → `unknown` (transitorio) | **PASS** | Unit |
| 3 | **Argentina: mismo DNI, distinto gender (2 personas)** | **RED** | E2E real: 1er alta `male` → 201; 2do `female` mismo DNI → **409 Conflict**. Debe ser 201. Código no implementado. |
| 4 | Duplicado real mismo `(dni, gender, tenant)` → Conflict | **PASS** | Unit + E2E (2º POST idéntico → 409) |
| 5 | Campos FHIR obligatorios faltantes → BadRequest | **PASS** | Unit (identifier/name/birthDate) + E2E (400) |
| 6 | Búsqueda por DNI devuelve Bundle con AMBAS personas | **PARCIAL/RED** | La FORMA del Bundle (`searchset`, filtra por tenant) → PASS. Que traiga las 2 personas depende del caso 3: hoy `total=1` porque el 2º alta se rechaza. Tras el cambio, `total=2`. La búsqueda NO se toca (correcto). |
| 7 | Auditoría: cada alta genera registro CREATE con actor | **PASS con HALLAZGO** | E2E: existe evento `CREATE`, `userId` correcto, **pero `userName='Desconocido'`** (ver §7). |
| 8 | Aislamiento: paciente de A no visible/editable desde B | **PASS (unit)** / **PENDIENTE (e2e real)** | Unit demuestra que `findOne`/`update` filtran por `tenantId` → NotFound. E2E cruzado real requiere 2º tenant (no hay). |

## 6. Validación FHIR R4 (skill fhir-validator — validación estructural por reglas; no hay HAPI instalado)

| Recurso | Válido | Errores bloqueantes | Advertencias semánticas |
| :-- | :-- | :-- | :-- |
| `Patient` (el que **genera** `PatientService.create`) | Sí | 0 | `identifier.type` con código `NI` (v2-0203) recomendado y ausente (fhir-mcp §3). `gender` conforme al value set required. |
| `Appointment` booked (ejemplo doc fhir-mcp) | Sí | 0 | Ninguna. Cumple regla `app-3` (start+end presentes). |
| `Appointment` cancelled (ejemplo doc fhir-mcp) | Sí | 0 | Ninguna. `cancelationReason` (una "l") correcto. |
| `Appointment` esqueleto que **architect propone generar** (§2.3) | Sí (estructura) | 0 | Falta `participant[].required` (lo señala fhir-mcp §6.5). `participant[].status` presente OK. |

**No conformidades a corregir en codificación (cuando se implemente):**
1. `Patient.identifier`: añadir `type.coding = {system v2-0203, code NI}` y endurecer `extractDni()` para seleccionar por `system='http://hospital.gov/dni'` (hoy toma "el primer identifier con value" — anti-patrón señalado por fhir-mcp §3).
2. `Appointment`: poblar `participant[].required` y respetar `app-3` (`end` obligatorio si `status∈{booked,arrived,fulfilled}`); usar `proposed` (no `pending`) para turnos sugeridos por IA. Cuidado columna `cancellation_reason` (doble l) vs campo FHIR `cancelationReason` (una l).

Cero errores bloqueantes en los payloads existentes/ejemplo. Las advertencias son recomendaciones para la fase de implementación de Appointment.

## 7. HALLAZGOS de QA (verificados end-to-end, NO se corrigieron)

| ID | Severidad | Hallazgo | Evidencia |
| :-- | :-- | :-- | :-- |
| QA-1 | **ALTA (bloquea el feature)** | El alta rechaza el caso argentino legítimo (mismo DNI, distinto sexo). Doble bloqueo: (a) `PatientService.create` verifica `{dni, tenantId}`; (b) la BD real tiene `CONSTRAINT unique_dni_tenant UNIQUE (dni, tenant_id)` (de `scripts/init.sql`). El diseño requiere cambiar ambos a `(dni, gender, tenant_id)`. | E2E: 2º alta `female` → 409. `\d` en Postgres confirma `unique_dni_tenant`. |
| QA-2 | **MEDIA (integridad de auditoría)** | La auditoría imputa `userName='Desconocido'` para altas reales. `PatientController.getUserCtx()` lee `req.user?.preferred_username`/`req.user?.name`, pero `jwt.strategy.validate()` expone `username` (no `preferred_username`) y no expone `name`. `userId` sí sale bien por el fallback `req.user?.userId`. Bajo Ley 26.529 la imputabilidad del actor es obligatoria. | E2E real con `doctor_julio`: evento CREATE con `userName='Desconocido'`. |
| QA-3 | **INFO (desalineación entidad↔BD)** | `patient.entity.ts` declara `@Column({ unique: true })` sobre `dni` (índice solo-`dni`), pero la BD real **no** tiene ese índice: tiene `unique_dni_tenant (dni, tenant_id)` aplicado por `init.sql`. La entidad y el esquema real divergen. Relevante para la migración del índice. | `pg_constraint` / `pg_indexes` sobre `fhir_patients`. |
| QA-4 | **ALTA (preexistente, doc security)** | Tokens humanos no traen `aud` (`aud=None`). El backend los acepta (H-1 sin cerrar). Si se aplica el `validate()` estricto §1.4 sin antes setear `aud`, los usuarios humanos quedarían fuera (401). | JWT decodificado de `doctor_julio`. |

## 8. Checklist Zero Trust (ZT-01..ZT-18 del doc de security §5)

Estado: `cubierto por test` / `RED` / `PENDIENTE (requiere entorno: 2º tenant, rol servicio-turnos, ajuste §1.4)`.

### 8.1 Aislamiento de tenant (CRÍTICOS — bloquean el merge)
| ID | Caso | Estado | Motivo |
| :-- | :-- | :-- | :-- |
| ZT-01 | Token tenant A busca DNI de tenant B → Bundle vacío | **PENDIENTE** | Solo hay 1 tenant real en el entorno. Lógica cubierta indirectamente: `search()` siempre filtra por `tenant_id` (unit test verifica el `where`). Falta 2º tenant para prueba cruzada real. |
| ZT-02 | Token A crea Appointment con DNI solo de B → falla resolución | **PENDIENTE** | Módulo Appointment NO implementado + falta 2º tenant. |
| ZT-03 | Token A hace GET Appointment de B → 404 | **PENDIENTE** | Appointment no implementado. |
| ZT-04 | Token A cancela Appointment de B → 404 | **PENDIENTE** | Appointment no implementado. |
| ZT-05 | Dos clínicas con mismo `(dni, gender)`; cada una ve solo la suya | **PENDIENTE** | Falta 2º tenant; además depende de la clave `(dni,gender)` (RED). |

### 8.2 Token mal formado / sin tenant (CRÍTICOS)
| ID | Caso | Estado | Motivo |
| :-- | :-- | :-- | :-- |
| ZT-06 | Token sin `tenant_id` → 401 | **RED / PENDIENTE** | Ajuste §1.4 NO implementado. HOY el fallback `tenant_id\|\|sub` hace operar bajo tenant fantasma (no 401). `nurse_maria` (sin tenant_id) sirve para reproducirlo cuando se aplique el ajuste. **Bloquea despliegue del bot.** |
| ZT-07 | Token con tenant_id forjado, firma de otra clave → 401 | **cubierto (por diseño)** | `jwt.strategy` valida firma contra JWKS del realm; un token mal firmado es rechazado por passport-jwt (no requiere código nuevo). Test e2e: petición sin token válido → 401 (verificado). Forja con clave ajena → 401 garantizado por la verificación RS256. |
| ZT-08 | Token sin `aud=hce-backend` → 401 | **RED** | H-1 sin cerrar: hoy se ACEPTA (confirmado: `doctor_julio` tiene `aud=None` y opera 200). Tras §1.4 debe dar 401. |
| ZT-09 | Token expirado (>300s) → 401 | **cubierto (por diseño)** | `ignoreExpiration:false` en la estrategia. passport-jwt rechaza expirados. |
| ZT-10 | `tenant_id` como array `["A"]` → se normaliza a `"A"` | **cubierto (por diseño)** | `validate()` ya tiene array-guard (`if Array.isArray... tenantId[0]`). |

### 8.3 Mínimo privilegio del rol (ALTOS)
| ID | Caso | Estado | Motivo |
| :-- | :-- | :-- | :-- |
| ZT-11 | `servicio-turnos` intenta endpoint clínico → 403 | **PENDIENTE** | Rol `servicio-turnos` no existe aún. `RolesGuard` haría 403 si el rol no está en la lista del endpoint (lógica verificada). |
| ZT-12 | `servicio-turnos` intenta auditoría/usuarios → 403 | **PENDIENTE** | Ídem. |
| ZT-13 | `servicio-turnos` hace sus 5 operaciones → 2xx | **PENDIENTE** | Requiere el rol + Appointment implementado. |
| ZT-14 | `servicio-turnos` intenta `PUT /Patient/:id` → 403 | **PENDIENTE** | Requiere decisión de producto + rol. |

### 8.4 Auditoría e idempotencia (ALTOS)
| ID | Caso | Estado | Motivo |
| :-- | :-- | :-- | :-- |
| ZT-15 | POST Appointment audita CREATE con canal/actor_client_id/is_service_account | **PENDIENTE** | `AppointmentAuditService` no implementado. Para Patient, la auditoría existe pero **sin** `actor_client_id`/canal y con `userName` roto (QA-2). |
| ZT-16 | PATCH cancel audita CANCEL con motivo | **PENDIENTE** | Appointment no implementado. |
| ZT-17 | Reintento con misma `idempotencyKey` no duplica | **PENDIENTE** | Idempotencia no implementada. |
| ZT-18 | UPDATE/DELETE directo sobre `*_audit_log` → rechazado | **PENDIENTE** | Falta `REVOKE`/trigger a nivel BD (H-3). `patient_audit_log` hoy es append-only solo por convención de código, no por la BD. |

**Resumen ZT:** 3 cubiertos por diseño (ZT-07/09/10), 2 RED críticos (ZT-06/08), el resto PENDIENTE por features no implementadas (Appointment, rol `servicio-turnos`, ajuste §1.4) o por falta de 2º tenant en el entorno.

## 9. Veredicto del Quality Gate

```json
{
  "reporte_calidad": {
    "linea_base": "3 suites / 18 tests passed",
    "tras_qa": "unitarios 4 suites / 32 tests passed; e2e 1 suite / 8 tests passed (stack real)",
    "pruebas_clave": [
      { "nombre": "Alta valida FHIR persiste gender", "status": "passed" },
      { "nombre": "Argentina: mismo DNI distinto gender", "status": "RED (409, debe ser 201)" },
      { "nombre": "Duplicado real (dni,gender,tenant)", "status": "passed (409)" },
      { "nombre": "Campos FHIR faltantes", "status": "passed (400)" },
      { "nombre": "Auditoria del alta", "status": "passed con hallazgo QA-2 (userName=Desconocido)" }
    ],
    "validacion_fhir": "Patient y Appointment de ejemplo: 0 errores bloqueantes. Advertencias semanticas: identifier.type NI, participant[].required.",
    "zero_trust": "ZT-07/09/10 cubiertos; ZT-06/08 RED criticos; resto pendiente por features no implementadas o falta de 2o tenant.",
    "veredicto": "rechazado"
  }
}
```

### Por qué RECHAZADO
1. **QA-1 (RED funcional bloqueante):** el feature central — soportar `(dni, gender)` para el caso argentino — NO está implementado. El alta legítima del 2º paciente se rechaza (409). Requiere: quitar `unique:true` de `dni` en la entidad, cambiar `create`/`update` a `{dni, gender, tenantId}`, y migrar el constraint `unique_dni_tenant` → `UNIQUE(dni, gender, tenant_id)` en BD.
2. **ZT-06 y ZT-08 (CRÍTICOS de seguridad en rojo):** sin el ajuste `validate()` §1.4, un token sin `tenant_id` opera en tenant fantasma y un token sin `aud` se acepta. El doc de security marca que cualquier CRÍTICO en rojo bloquea el merge.
3. **QA-2 (integridad de auditoría):** las altas se imputan a "Desconocido", inaceptable bajo Ley 26.529.

### Qué desbloquea el Quality Gate
- Implementar el cambio `(dni, gender, tenantId)` (entidad + servicio + migración del índice) → convierte QA-1/caso 3 de RED a PASS (ya hay aserción objetivo lista en ambos specs).
- Aplicar el `validate()` endurecido (§1.4) + setear `aud` y `tenant_id` en todos los usuarios → cierra ZT-06/08.
- Corregir `getUserCtx()` para leer `req.user.username`/`req.user.userId` (alinear con lo que `jwt.strategy` expone) → cierra QA-2.
- Para cobertura ZT completa: crear un 2º tenant/usuario de test y el rol `servicio-turnos` + cliente `clinichat-*` en el realm de pruebas, e implementar el módulo Appointment.

---

## Anexo — cómo reproducir

```powershell
# Unitarios (incluye el nuevo patient.service.spec.ts)
cd hce-backend; npm test

# E2E contra stack real (requiere docker compose up; usa tokens reales de Keycloak)
cd hce-backend; npm run test:e2e -- patient-alta
# La suite e2e se autodescarta (skip suave con aviso en consola) si :3000/:8080 no responden.
```
