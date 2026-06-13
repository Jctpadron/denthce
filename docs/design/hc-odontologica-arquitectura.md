# Diseño técnico — Módulo Historia Clínica Odontológica (PAMI + Círculo Odontológico de Jujuy)

> ⚠️ **SUPERSEDIDO (2026-05-29).** Este documento describe el **plan original** (HC integrada en la ficha + backend compartido). La implementación real adoptó un **módulo AISLADO** (tabla `odontology_clinical_resources` y endpoints `/odontology` propios; pantalla separada colgada del dashboard). **Fuente de verdad:** `docs/walkthroughs/2026-05-29_hc_odontologica_modulo_aislado.md`.

> Autor: agente `architect`. Fase: Diseño técnico base. **No incluye código de implementación.**
> Stack: NestJS 11 + TypeORM + PostgreSQL (JSONB FHIR R4) + Keycloak (multi-inquilino Zero Trust, todo filtrado por `tenantId`).
> Documentos hermanos: el mapeo HL7 fino (Questionnaire / QuestionnaireResponse / Consent / Coverage) lo cierra `fhir-mcp`; las políticas de firma/cifrado las cierra `security`; la maquetación la cierra `ux`.

---

## 0. Contexto del repositorio (lo que ya existe y NO se rompe)

- `ClinicalResourceEntity` → tabla `fhir_clinical_resources` (`id`, `tenant_id`, `patient_id`, `resource_type`, `payload` JSONB, timestamps). Es la base del odontograma actual.
- `ClinicalResourceService.saveResource()` permite hoy: `Condition`, `Procedure`, `AllergyIntolerance`, `Observation`, `DocumentReference`, `Media`, `MedicationStatement`. Hace **upsert por pieza+cara+tipo** (clave compuesta lógica `bodySite.coding[0].code` + `bodySite.coding[1].code`).
- `EncounterEntity` (`fhir_encounters`) ya implementa el patrón maduro de **firma lógica**: columnas promovidas (`status`, `signed_by`, `signed_at`, `content_hash` SHA-256) + `payload` JSONB. Es el modelo de referencia para todo lo que requiere firma/inmutabilidad.
- Aislamiento: **todos** los servicios filtran `where: { ..., tenantId }` y validan que el paciente pertenezca al tenant antes de tocar nada. Esto es innegociable y se replica en todo lo nuevo.
- Frontend: `Odontogram.tsx` consume el endpoint genérico `clinical-resource` y reconstruye el `toothMap` parseando `Condition`/`Procedure` planos. **No tiene concepto de "existente vs a realizar"** hoy.

---

## 1. Modelo de datos

### Decisión central: enfoque híbrido (genérico extendido + 2 entidades dedicadas)

No es "todo genérico" ni "todo dedicado". Cada recurso se ubica donde su ciclo de vida lo pide:

| Recurso clínico | Dónde vive | Justificación |
| :--- | :--- | :--- |
| Odontograma (hallazgos doble capa) | **`fhir_clinical_resources`** (extendido) — `Condition` + `Procedure` | Reutiliza upsert pieza/cara existente; solo añade la dimensión `intent` (existente vs a-realizar). Cero migración estructural. |
| Anamnesis (cuestionario sí/no + higiene) | **`fhir_clinical_resources`** — nuevo tipo `QuestionnaireResponse` | Es un documento por encuentro, sin upsert por pieza. Encaja en el JSONB genérico añadiendo el tipo a la allowlist. |
| Consentimiento informado firmado | **Entidad dedicada `fhir_consents`** | Requiere firma lógica + hash + inmutabilidad (igual que Encounter). El genérico no modela firma. |
| Afiliado / Obra social | **Entidad dedicada `fhir_coverages`** | Dato maestro de larga vida, 1..n por paciente, consultable independientemente (código prestador, plan, médico de cabecera). No es "hallazgo clínico". |
| Anexo de evolución | **`fhir_clinical_resources`** — `Procedure` con `intent=order/completed` + `Encounter` existente | Cada renglón de evolución = un `Procedure` ligado a un `Encounter`; reutiliza lo que ya hay. |
| Estado bucal / diagnóstico presuntivo / plan / observaciones | **`fhir_clinical_resources`** — `Observation` + `Condition` + `CarePlan` (nuevo tipo) | Texto estructurado; encaja en JSONB genérico. |

**Regla rectora:** *firma/inmutabilidad o dato maestro independiente → entidad dedicada con columnas promovidas. Hallazgo/documento clínico mutable ligado al paciente → `fhir_clinical_resources` genérico.* Esto evita deuda técnica (no duplicamos el patrón genérico) y a la vez no metemos firma/coverage forzados en un JSONB sin garantías.

### 1.1 Odontograma doble capa — el cambio clave

El modelo dual **NO requiere tabla nueva**. Se modela con el campo FHIR estándar:

- **Capa EXISTENTE (rojo, ya hecho):**
  - `Condition` → patologías presentes (caries, ausencia).
  - `Procedure` con `status: 'completed'` → tratamiento ya realizado.
- **Capa A REALIZAR (azul, planificado):**
  - `Procedure` con `status: 'preparation'` + `intent: 'plan'` → tratamiento planificado.
  - (Alternativa que `fhir-mcp` puede preferir: recurso `ServiceRequest`. Decisión arquitectónica: **reutilizar `Procedure` con `status`** para no ampliar la allowlist ni cambiar el parser del frontend más de lo necesario; `ServiceRequest` queda como evolución futura si PAMI lo exige.)

Se añade un discriminador explícito en el payload JSONB para que el frontend pinte sin ambigüedad y para indexar:

```jsonc
// payload de un Procedure planificado (capa azul)
{
  "resourceType": "Procedure",
  "status": "preparation",          // preparation = a realizar | completed = existente
  "subject": { "reference": "Patient/<id>" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "23450005", "display": "Restauración dental" }] },
  "bodySite": { "coding": [ {piece}, {face} ] },
  "extension": [
    { "url": "https://denthce.app/fhir/odontogram-layer", "valueCode": "planned" }  // planned | existing
  ]
}
```

**Transición plan → completado:** cambia `status: preparation → completed`, `extension.layer: planned → existing`, y registra `performedDateTime` + autor. NO se borra ni se duplica el recurso: es la misma fila, mutada, preservando trazabilidad en auditoría.

> Importante sobre el upsert actual: hoy `saveResource` hace upsert por `pieza+cara+tipo`. Con doble capa, una misma pieza/cara puede tener **un planificado Y un existente** a la vez. **La clave de upsert debe ampliarse a `pieza + cara + resourceType + layer`** para no pisar la capa existente con la planificada. Este es el ajuste de mayor riesgo del módulo (ver §4).

### 1.2 Entidades TypeORM nuevas

**`ConsentEntity` → `fhir_consents`** (espejo del patrón `EncounterEntity`):

| Columna | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | uuid PK | |
| `tenant_id` | varchar | aislamiento |
| `patient_id` | varchar | FK lógica a `fhir_patients` |
| `encounter_id` | uuid null | liga el consentimiento al encuentro |
| `status` | varchar | `draft` / `active` (firmado) / `rejected` / `inactive` |
| `scope_code` | varchar | `treatment` (FHIR Consent.scope) |
| `category_code` | varchar | tipo de consentimiento (tratamiento odontológico) |
| `signed_by_patient` | varchar null | nombre/identidad del firmante |
| `signed_at` | timestamptz null | |
| `content_hash` | varchar null | SHA-256 del texto consentido (integridad) |
| `payload` | jsonb | recurso FHIR `Consent` R4 completo |
| `created_at` / `updated_at` | timestamptz | |

**`CoverageEntity` → `fhir_coverages`** (dato maestro de obra social/afiliado):

| Columna | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | uuid PK | |
| `tenant_id` | varchar | aislamiento |
| `patient_id` | varchar | beneficiario |
| `payer_code` | varchar | obra social (PAMI, Círculo Odont. Jujuy, etc.) |
| `member_id` | varchar | nº de afiliado |
| `plan_code` | varchar null | plan/categoría |
| `provider_code` | varchar null | **código prestador** (requisito PAMI) |
| `primary_care_physician` | varchar null | médico de cabecera |
| `status` | varchar | `active` / `cancelled` |
| `period_start` / `period_end` | date null | vigencia |
| `payload` | jsonb | recurso FHIR `Coverage` R4 completo |
| `created_at` / `updated_at` | timestamptz | |

> Anamnesis (`QuestionnaireResponse`) y plan de tratamiento (`CarePlan`) **no** llevan entidad nueva: se añaden a la allowlist del servicio genérico. Si más adelante la anamnesis requiere firma del paciente con hash (alcance §1 lo menciona), se promueve a entidad dedicada `fhir_questionnaire_responses` siguiendo el mismo patrón Encounter — queda señalado como punto de decisión para `fhir-mcp`/`security`.

### 1.3 Índices y rendimiento

- `fhir_clinical_resources`: índice compuesto **`(tenant_id, patient_id, resource_type)`** (la consulta caliente del odontograma). Hoy no consta índice explícito → **añadirlo es prioridad** porque el parser carga TODOS los recursos del paciente.
- Índice GIN parcial sobre `payload` para filtrar por `extension.layer` y `bodySite` si el volumen crece: `CREATE INDEX ... USING gin (payload jsonb_path_ops)`.
- `fhir_consents` / `fhir_coverages`: índice `(tenant_id, patient_id)` y, en coverage, `(tenant_id, member_id)` para búsqueda por afiliado.
- Todas las consultas DEBEN incluir `tenant_id` en el `WHERE` (no solo por índice: por Zero Trust).

---

## 2. Contratos de API REST (NestJS)

Convención: se mantiene el prefijo `fhir/r4` y el patrón `@UseGuards(AuthGuard('jwt'), RolesGuard)` con `req.user.tenantId`. Roles odontológicos: se reutiliza `medico` como profesional odontólogo (no se inventa rol nuevo sin `security`).

### 2.1 Anamnesis (QuestionnaireResponse) — vía genérico extendido
- `POST /fhir/r4/Patient/:patientId/clinical-resource` con `{ resourceType: 'QuestionnaireResponse', payload }` → guarda/actualiza el cuestionario.
- `GET  /fhir/r4/Patient/:patientId/clinical-resource` → ya devuelve todos; el frontend filtra por `resourceType`.
- Roles: `medico`, `administrador`. Lectura también `paciente`.

### 2.2 Odontograma doble capa — vía genérico extendido (con upsert ampliado)
- `POST /fhir/r4/Patient/:patientId/clinical-resource` con `Condition` / `Procedure` + `extension.layer`.
- `DELETE /fhir/r4/Patient/clinical-resource/:id` (ya existe, sin cambios).
- **Transición plan → completado** (nuevo, endpoint dedicado por claridad semántica y auditoría):
  - `PATCH /fhir/r4/Patient/clinical-resource/:id/complete`
  - Body: `{ performedDateTime?, note? }`
  - Efecto: `status: preparation→completed`, `extension.layer: planned→existing`, sella autor/fecha. Valida tenant. Devuelve el payload actualizado.

### 2.3 Consentimiento informado (Consent) — entidad dedicada
- `POST   /fhir/r4/Patient/:patientId/Consent` → crea borrador.
- `GET    /fhir/r4/Patient/:patientId/Consent` → lista.
- `GET    /fhir/r4/Consent/:id` → uno.
- `PATCH  /fhir/r4/Consent/:id/sign` → firma del paciente: `status→active`, `signed_by_patient`, `signed_at`, `content_hash`. **Inmutable tras firmar** (replica regla de `EncounterService.sign`).
- Roles escritura: `medico`, `administrador`. Firma: `medico` (registra la firma presencial del paciente). Política fina → `security`.

### 2.4 Evolución (anexo) — vía Encounter + Procedure existentes
- `POST /fhir/r4/Patient/:patientId/Encounter` (ya existe) → crea el episodio/renglón de evolución (fecha).
- `POST /fhir/r4/Patient/:patientId/clinical-resource` con `Procedure` ligado (`encounter.reference`) → tratamiento realizado.
- Conformidad del afiliado → se modela como `extension` en el `Encounter` o como `Consent` por evolución (decisión de `fhir-mcp`). Recomendación: campo de conformidad firmada dentro del payload del Encounter para no multiplicar entidades.

### 2.5 Afiliado / Coverage — entidad dedicada
- `POST  /fhir/r4/Patient/:patientId/Coverage`
- `GET   /fhir/r4/Patient/:patientId/Coverage`
- `PATCH /fhir/r4/Coverage/:id`
- `DELETE/fhir/r4/Coverage/:id` (soft → `status: cancelled`).
- Roles: `recepcionista`, `administrador`, `medico`.

### 2.6 Exportación PDF
- `GET /fhir/r4/Patient/:patientId/odontology-report.pdf`
- Devuelve `application/pdf` (stream). Detalle en §3.

---

## 3. Servicio de exportación PDF (formato oficial PAMI, 3 hojas)

### Decisión: **server-side con `pdfkit`**, NO client-side, NO puppeteer.

**Trade-offs evaluados:**

| Opción | Pros | Contras | Veredicto |
| :--- | :--- | :--- | :--- |
| Client-side (jsPDF/print) | Sin carga de servidor | ePHI viaja al navegador y depende de él; formato oficial difícil de fijar; riesgo de divergencia entre clientes; difícil auditar | **Descartada** |
| Server `puppeteer` (HTML→PDF) | Maquetación HTML/CSS cómoda | Chromium headless = ~300MB, alto consumo de RAM/CPU, arranque lento, mal candidato para entornos rurales/contenedor liviano; superficie de ataque mayor | **Descartada** |
| Server `pdfkit` | Liviano, sin navegador, control absoluto del layout fijo PAMI, streaming, fácil de containerizar | Layout más verboso (coordenadas) | **ELEGIDA** |

El formato PAMI es **fijo y oficial** (3 hojas), justamente el caso donde un layout por coordenadas con `pdfkit` es más robusto y reproducible que HTML/CSS variable.

### Dónde vive
Nuevo módulo backend **`hce-backend/src/odontology-report/`**:
- `odontology-report.service.ts` — orquesta: lee recursos FHIR del paciente (Patient, Coverage, QuestionnaireResponse, Condition/Procedure del odontograma, Consent, Encounters de evolución) **siempre filtrando por `tenantId`**, y arma el PDF.
- `odontology-report.controller.ts` — endpoint §2.6.
- `pami-template.ts` — define las 3 hojas (constantes de layout). El branding/tokens los aporta el skill `design-system` vía `ux` si el formato lo permite (PAMI es oficial: branding mínimo).

### Cómo arma las 3 hojas desde FHIR
- **Hoja 1 — Datos del afiliado + Anamnesis:** `PatientEntity` (demográficos) + `CoverageEntity` (obra social, nº afiliado, código prestador, médico de cabecera) + `QuestionnaireResponse` (cuestionario sí/no + higiene) + firma del paciente.
- **Hoja 2 — Odontograma + Estado bucal + Diagnóstico + Plan:** renderiza el odontograma doble capa (símbolos existentes en rojo, a-realizar en azul) desde `Condition`/`Procedure`, más `Observation`/`CarePlan` (estado bucal, diagnóstico presuntivo, plan, observaciones).
- **Hoja 3 — Consentimiento + Anexo de evolución:** `Consent` firmado (con `content_hash` visible como sello de integridad) + tabla de evolución (fecha / tratamiento / conformidad) construida desde `Encounter` + `Procedure`.

### Seguridad ePHI (frontera de `security`, aquí solo lo arquitectónico)
- El servicio **carga datos exclusivamente del `tenantId` del token** (mismo patrón de validación de paciente que el resto de servicios). Imposible armar un PDF con datos de otro consultorio.
- Doble verificación: el paciente debe pertenecer al tenant ANTES de leer cualquier recurso.
- El PDF se **transmite por stream y no se persiste en disco** (a diferencia de los uploads en `/uploads`). Si se requiere archivado, se guardaría como `DocumentReference` cifrado — decisión de `security`.
- Generación auditada: cada export genera un registro de auditoría (reutilizar `patient-audit`).
- Sin caché del PDF en CDN/Cloudflare (cabeceras `no-store`).

---

## 4. Estrategia de migración (odontograma plano actual → modelo dual)

El odontograma actual ya guarda `Condition`/`Procedure` en `fhir_clinical_resources` **sin** el concepto de capa. Plan **sin pérdida de datos**:

1. **Backfill no destructivo (idempotente):** los recursos existentes representan hallazgos YA hechos → se interpretan como **capa EXISTENTE**. Migración: a todo `Procedure`/`Condition` sin `extension.layer` se le asigna por defecto `layer = 'existing'` y, a los `Procedure`, `status = 'completed'`. Se ejecuta como script de migración TypeORM (o lectura perezosa: ver punto 3).
2. **Compatibilidad de lectura (defensiva):** el servicio y el frontend tratan **ausencia de `extension.layer` como `existing`**. Así, aunque no se corra el backfill, los datos viejos se siguen viendo correctamente (degradación elegante). Esto permite desplegar sin ventana de mantenimiento.
3. **Upsert ampliado:** cambiar la clave lógica de upsert de `(pieza, cara, resourceType)` a `(pieza, cara, resourceType, layer)`. **Riesgo:** si no se hace, marcar un tratamiento "a realizar" sobre una pieza que ya tiene un "existente" pisaría el dato histórico. Es el cambio crítico a validar por `qa`.
4. **Frontend:** `Odontogram.tsx` añade el discriminador de capa en `parseResources` (leer `extension.layer`, default `existing`) y dos paletas (rojo existente / azul a-realizar). Compatible con datos viejos por el default.
5. **Rollback:** como el backfill solo AÑADE campos (no borra ni reescribe códigos), revertir = ignorar `extension.layer`. Bajo riesgo.

---

## 5. Escalabilidad, trade-offs y plan por fases

### Trade-offs de escalabilidad
- **JSONB vs columnas:** se mantiene JSONB para flexibilidad FHIR (igual que todo el repo). Se promueven a columna solo los campos consultados/firmados (status, hash, member_id, provider_code). Equilibrio entre flexibilidad e índice.
- **Carga del odontograma:** hoy se traen TODOS los recursos del paciente y se parsean en cliente. Con doble capa el volumen ~duplica. Mitigación: índice `(tenant_id, patient_id, resource_type)` + posibilidad futura de paginar/filtrar por `resource_type` en el GET (query param) sin romper el contrato actual.
- **PDF:** `pdfkit` por streaming escala horizontalmente sin estado; no bloquea el event loop si se genera en chunks. Apto para nodos pequeños en zonas rurales.
- **Offline-first (mención):** los recursos clínicos son documentos autocontenidos por paciente → buen candidato a sincronización diferida; el modelo no introduce dependencias cruzadas que lo impidan. Detalle fuera de este alcance.

### Plan de implementación por fases

| Fase | Backend | Frontend | Gate |
| :--- | :--- | :--- | :--- |
| **F1 — Odontograma doble capa** | Ampliar allowlist no necesaria (ya hay Procedure/Condition); ampliar upsert a incluir `layer`; añadir `extension.layer`; endpoint `PATCH .../complete`; índice compuesto; backfill defensivo | Añadir capa azul/roja a `Odontogram.tsx`, toggle existente/a-realizar, acción "marcar como realizado" | `qa` valida upsert no pisa datos; `fhir-validator` |
| **F2 — Anamnesis + Plan + Estado bucal** | Allowlist `QuestionnaireResponse`, `CarePlan`; (mapeo `fhir-mcp`) | Tab anamnesis (form sí/no + higiene), plan de tratamiento, observaciones | `product`/`ux` certifican; `fhir-validator` |
| **F3 — Coverage (afiliado/obra social)** | `CoverageEntity` + servicio + endpoints §2.5 | Form datos de afiliado/obra social/código prestador | `security` (datos sensibles) |
| **F4 — Consentimiento** | `ConsentEntity` + firma lógica + hash (patrón Encounter) | Flujo de firma del consentimiento | `security` valida inmutabilidad/firma |
| **F5 — Evolución** | Reutiliza Encounter+Procedure; conformidad firmada | Tab anexo de evolución (tabla fecha/tratamiento/conformidad) | `product` certifica |
| **F6 — Exportación PDF PAMI** | Módulo `odontology-report` + `pdfkit` + 3 hojas + auditoría | Botón "Exportar HC PAMI (PDF)" | `security` (ePHI, no-store, aislamiento) + `qa` |

Orden recomendado: **F1 primero** (mayor valor + mayor riesgo de migración, conviene resolverlo temprano); F6 al final (depende de que existan todos los recursos).

---

## 6. RESUMEN — decisiones arquitectónicas clave

- **Modelo híbrido:** odontograma doble capa, anamnesis, plan y evolución → reutilizan `fhir_clinical_resources` (genérico JSONB). Consentimiento → **`ConsentEntity` (`fhir_consents`)** dedicada con firma+hash. Afiliado/obra social → **`CoverageEntity` (`fhir_coverages`)** dedicada. Criterio: firma/inmutabilidad o dato maestro → entidad dedicada; hallazgo mutable → genérico.
- **Doble capa SIN tabla nueva:** se discrimina con `Procedure.status` (`preparation`=a realizar / `completed`=existente) + `extension.layer` (`planned`/`existing`). Transición vía `PATCH /clinical-resource/:id/complete` (muta la misma fila, no duplica).
- **Cambio crítico:** ampliar la clave de upsert de `(pieza, cara, tipo)` a `(pieza, cara, tipo, layer)` en `ClinicalResourceService`.
- **Endpoints nuevos:** `PATCH .../clinical-resource/:id/complete`; `Consent` (POST/GET/sign); `Coverage` (POST/GET/PATCH/DELETE); `GET .../odontology-report.pdf`.
- **PDF:** server-side con **`pdfkit`** en nuevo módulo `hce-backend/src/odontology-report/`; arma 3 hojas leyendo recursos FHIR filtrados por `tenantId`; stream sin persistir, sin caché, auditado.
- **Migración:** backfill no destructivo + lectura defensiva (`layer` ausente = `existing`) → despliegue sin downtime y compatible con datos cargados.
- **Aislamiento:** todo nuevo servicio replica el patrón `where { tenantId }` + validación de pertenencia del paciente. Zero Trust intacto.

### Riesgos técnicos
1. **Upsert que pisa la capa existente** si no se amplía la clave compuesta con `layer`. Riesgo de pérdida de historial clínico. → Test obligatorio en `qa`.
2. **Carga total de recursos por paciente** en el GET del odontograma; el volumen ~duplica con doble capa. → Mitigar con índice compuesto y filtro opcional por `resource_type`.
3. **Falta de índice explícito** hoy en `fhir_clinical_resources` → degradación con muchos pacientes/recursos. → Añadir en F1.
4. **Firma del consentimiento/anamnesis:** definir si la firma del paciente es manuscrita digitalizada, biométrica o lógica. Frontera de `security`; arquitectura deja el hash+inmutabilidad listos (patrón Encounter).
5. **Fidelidad del formato oficial PAMI** (3 hojas) con `pdfkit` por coordenadas: requiere el machote oficial exacto; riesgo de rechazo administrativo si difiere. → Validar muestra con `product`.
6. **Compatibilidad del parser frontend** con datos viejos durante la transición → mitigado por el default `existing`, pero debe probarse explícitamente.
7. **`Procedure` con `status: preparation` vs `ServiceRequest`:** si PAMI/FHIR exige `ServiceRequest` para "a realizar", habrá refactor. Decisión documentada; revisar con `fhir-mcp`.
