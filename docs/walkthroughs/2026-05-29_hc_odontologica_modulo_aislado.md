# Walkthrough — Historia Clínica Odontológica (módulo AISLADO)

**Fecha:** 2026-05-29 · **Estado:** funcional en LOCAL, sin desplegar en AWS · **Pendiente:** PDF oficial PAMI.

Este documento es la **fuente de verdad operativa** del módulo de HC Odontológica. Si retomás el trabajo en otra sesión, leé esto primero. Los `docs/design/hc-odontologica-*` describen el **plan original (integrado)** que **fue reemplazado** por el enfoque aislado descrito acá.

---

## 1. Decisiones clave (el "por qué")

1. **Aislamiento total (Opción 1).** La HC odontológica es un **módulo separado** con **tabla y endpoints propios**. NO comparte datos clínicos con la HC original (la ficha de pacientes). Motivo: el usuario pidió que la nueva HC "no modifique en nada el funcionamiento de la primera HC".
2. **Se revirtió la HC original.** Cambios previos en `Odontogram.tsx`, `clinical-resource.service.ts` y `clinical-resource.controller.ts` se devolvieron a `HEAD` con `git restore`. La primera HC quedó intacta.
3. **Padrón de pacientes y Admisión COMPARTIDOS (Opción A).** Un paciente es una sola persona; lo aislado son los **datos clínicos**, no el registro demográfico. La HC odontológica **lee** `/fhir/r4/Patient` (solo lectura) para elegir paciente.
4. **Coexistencia para evaluar.** Ambas HC funcionan en paralelo; el usuario decidirá más adelante cuál conservar y dará de baja la otra.
5. **Odontograma: color = capa, glifo = tipo.** 🔴 rojo = existente · 🔵 azul = a realizar. Cada prestación tiene su glifo. Extracción indicada (azul) vs realizada (roja) = mismo código SNOMED, distinguidas por capa.
6. **Simbología en catálogo en código** (`odontogram-catalog.ts`), editable. Evolución futura posible: catálogo en BD + panel de administración (si el colegio quiere autogestión sin dev).

---

## 2. Arquitectura real

### Backend — `hce-backend/src/odontology/`
- `odontology-resource.entity.ts` → tabla **`odontology_clinical_resources`** (`id`, `tenant_id`, `patient_id`, `resource_type`, `payload` jsonb, timestamps; índice `(tenant_id, patient_id, resource_type)`).
- `odontology.service.ts` → CRUD + `completeResource` (transición plan→existente). `allowedTypes`: Condition, Procedure, Observation, QuestionnaireResponse, CarePlan, Coverage, Consent. Upsert por `(pieza, cara, tipo, capa)`. Aislamiento por `tenantId`; valida pertenencia del paciente leyendo `PatientEntity`.
- `odontology.controller.ts` → prefijo **`/odontology`**:
  - `POST /odontology/patient/:patientId/resource`
  - `GET  /odontology/patient/:patientId/resource`
  - `PATCH /odontology/resource/:id/complete`
  - `DELETE /odontology/resource/:id`
- `odontology.module.ts` → registrado en `app.module.ts` (entidad en `entities[]` + módulo en `imports`).
- Extensión de capa: `http://denthce.local/fhir/StructureDefinition/odontogram-layer` con `valueCode` `existing|planned` (lectura defensiva: sin extensión = existing).

### Frontend — `hce-frontend/src/components/odontology/`
- `OdontologyHC.tsx` → contenedor. Busca paciente (padrón compartido, autocarga al entrar) y abre 6 sub-pestañas.
- `OdontogramPAMI.tsx` → odontograma doble capa, glifos por tipo (del catálogo), barra agrupada, **toast flotante**, leyenda autogenerada, paneles Existente/Plan, "marcar como realizado".
- `odontogram-catalog.ts` → **fuente única** de los 13 estados (label, grupo, alcance cara/pieza, glifo, SNOMED).
- `AnamnesisPAMI.tsx` → cuestionario PAMI + firma del paciente (canvas) → `QuestionnaireResponse`.
- `OralStatusPAMI.tsx` → estado bucal + diagnóstico + plan + observaciones → `Observation` (code `oral-status`).
- `CoverageForm.tsx` → afiliado/obra social → `Coverage`.
- `ConsentForm.tsx` → consentimiento doble firma + matrícula → `Consent`.
- `EvolutionPAMI.tsx` → anexo (fecha/tratamiento/conformidad) → `Procedure` (system `http://denthce.local/evolution`).

### Enganche al dashboard
- `config/dashboard-modules.ts`: módulo `odonto-hc` (🦷, badge "Nuevo").
- `App.tsx`: `AppView` `'odonto-hc'` + ítem de navegación + render `<OdontologyHC/>`.
- `HomeScreen.tsx`: tipo `onNavigate` incluye `'odonto-hc'`.

### Mapeo FHIR por sección (todo en `odontology_clinical_resources`)
| Sección | resourceType | Identificador |
| :-- | :-- | :-- |
| Odontograma | Condition / Procedure | SNOMED + bodySite (pieza FDI, cara) + extensión capa |
| Anamnesis | QuestionnaireResponse | `questionnaire = http://denthce.local/Questionnaire/anamnesis-pami` |
| Estado bucal/Dx/Plan | Observation | `code.coding[0].code = oral-status` |
| Afiliado | Coverage | — |
| Consentimiento | Consent | firmas en `firmaPaciente`/`firmaProfesional` (base64) |
| Evolución | Procedure | `code.coding[0].system = http://denthce.local/evolution` |

> Nota: Coverage y Consent se guardan en la tabla genérica del módulo (MVP). Evolución futura (per `architect`): entidades dedicadas `odontology_consents`/`odontology_coverages` con hash/firma fuerte.

---

## 3. Estado del entorno (IMPORTANTE)

- **Todo en LOCAL.** Docker Compose: backend `:3000`, frontend `:5173`, Keycloak `:8080`, Postgres `:5432`.
- La tabla `odontology_clinical_resources` **se creó SOLO en la base local** (`hce_fhir` del contenedor `hce-database`). **NO existe en AWS RDS todavía.**
- `DB_SYNCHRONIZE=false` en todos los entornos → las tablas NO se autocrean; hay que correr el SQL.
- Usuario de prueba: `doctor_julio` / `doctor_pass_2026` · tenant `mi_consultorio_dent_hce`.

### Cómo correr y probar
```powershell
# Levantar (si no está arriba)
docker compose up -d
# Crear la tabla en local (si hiciera falta)
docker exec hce-database psql -U hce_admin -d hce_fhir -f - < scripts/odontology_init.sql
# Probar el backend end-to-end
node testing/scripts/test_odontology.js
```
Navegador: http://localhost:5173 → login → tarjeta 🦷 "Historia Clínica Odontológica".

### Scripts útiles
- `scripts/odontology_init.sql` — DDL de la tabla (idempotente).
- `testing/scripts/create_odontology_tables.js` — crea la tabla en **RDS/AWS** (para el despliegue).
- `testing/scripts/get_token.js` — obtiene token local (host) para tests.
- `testing/scripts/test_odontology.js` — prueba funcional del módulo.
- Patrón de test con axios dentro del contenedor: token desde host (`get_token.js`) + `docker exec -e TOKEN=$t hce-frontend-client node ...` (evita desajuste de issuer y keep-alive del raw http).

---

## 4. Qué falta (pendiente)

1. **PDF oficial PAMI (3 hojas)** — backend `pdfkit` en un módulo de reporte + botón "Generar HC PAMI". Es el "momento ajá" de venta.
2. **Quality Gates** — `security` (firma/inmutabilidad/aislamiento) + `qa` (tests + FHIR).
3. **Llevar a AWS** — crear la tabla en RDS (`create_odontology_tables.js`), recompilar backend, empaquetar y desplegar.
4. (Futuro) Entidades dedicadas Consent/Coverage con hash; panel admin del catálogo; asistente de completitud previo a exportar.

---

## 5. Verificaciones realizadas (todas OK)
- Odontograma: POST/GET/PATCH(complete azul→rojo)/DELETE + aislamiento (no aparece en `fhir_clinical_resources`).
- Anamnesis: QuestionnaireResponse + firma + "una sola por paciente".
- Estado bucal, Afiliado (Coverage), Consentimiento (doble firma), Evolución: round-trip OK.
- Catálogo: corona, incrustación (cara), extracción (plan/azul) round-trip OK.
- Builds backend y frontend en verde.
