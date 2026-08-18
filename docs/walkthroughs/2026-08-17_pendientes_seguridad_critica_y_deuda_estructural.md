# PENDIENTES: seguridad crítica y deuda estructural

**Creado:** 2026-08-17 · **Responsable:** Claude (Orquestador)
**Origen:** auditoría integral del 2026-08-17 (5 subagentes) + punto cero del repositorio + 2 deploys.

> **Si venís nuevo, leé este documento antes que cualquier otro.** El día 2026-08-17 cambió la relación entre el repositorio y producción, y dejó una lista de pendientes verificados contra el código.

---

## ⚠️ LO QUE FALTA — resumen ejecutivo

**Ninguno de los críticos de seguridad de la auditoría fue corregido.** Verificado por inspección el 2026-08-17:

| # | Pendiente | Dónde | Gravedad |
| :-- | :-- | :-- | :-- |
| 1 | `/uploads` sirve ePHI **sin autenticación** (radiografías, firma del odontólogo con nombre predecible) | `main.ts:24` | Crítico |
| 2 | **Clave RDS de producción versionada** en 8 archivos | `testing/scripts/*.js` | Crítico |
| 3 | Admin de Keycloak y `client_secret` hardcodeados | `tenant/keycloak-admin.service.ts` | Crítico |
| 4 | Contraseñas semilla vivas en prod (`doctor_julio`/`doctor_pass_2026`) + ROPC habilitado | Keycloak realm | Crítico |
| 5 | `hceWebhookSecret` devuelto a cualquier rol autenticado | `tenant-config.entity.ts` | Crítico |
| 6 | DTOs como `interface` → **el `ValidationPipe` no valida nada** (mass-assignment cross-tenant) | 0 archivos `*.dto.ts` | Crítico |
| 7 | `RolesGuard` **fail-open** + `/api/sisa/verificar` sin `@Roles` | `auth/roles.guard.ts` | Alto |
| 8 | `deleteFile` ignora el tenant (borra archivos de cualquier clínica) | `patient/file-upload.controller.ts` | Alto |
| 9 | Sin paginación · sin transacciones · sin migraciones versionadas · `tenantId` de doble semántica · sin auditoría de lectura de ePHI | transversal | Alto |
| 10 | 13 bugs reales de React (3 render impuro, 8 remontaje, 2 mutación) | listados en `hce-frontend/eslint.config.js` | Medio |

**Acciones que requieren a una persona:** desactivar las 2 claves root de AWS · decidir qué hacer con los $188 de `PRES-0001` · avisar a los tenants del cambio de números · responder las 3 decisiones de producto (§4.3).

**Por dónde empezar:** §5 — Fase 1, con el orden ya medido por radio de impacto.

---

## Contexto: qué SÍ se hizo el 2026-08-17

Lo que sigue explica por qué el estado de partida es el que es. Si sólo venís a trabajar en los pendientes, saltá a §4 y §5.

---

## 1. Qué se pidió y qué pasó realmente

Se pidió una **auditoría integral** (inconsistencias, calidad, seguridad, UX). Se ejecutó con 5 subagentes en paralelo (`security`, `revisor`, `ux`, `architect`, `qa`) sobre el árbol de trabajo.

El Super Admin objetó, con razón, que la auditoría podía no reflejar **lo que está en producción**. Verificar esa objeción produjo el hallazgo más importante del día, y no en la dirección que ninguno esperaba.

### El hallazgo: producción no era reconstruible desde git

Contrastando el bundle servido por `app.systia.ar` contra el repositorio:

- `ClinicalAlerts.tsx` existía sólo en `b8f37ff` (rama `codex/...`), **no en `main`**.
- Los cambios de `OdontologyHC.tsx`, `OdontogramPAMI.tsx`, `PresupuestoOdontologicoModal.tsx` e `index.css` estaban **sin commitear** y **sí desplegados**.

Marcadores encontrados en el CSS/JS de producción y ausentes de todo commit: `.odonto-page-shell`, `.odonto-back-btn`, `.odonto-patient-status`, `"Visita en curso"`, `"Paciente activo"`.

**Consecuencia:** producción no se podía reconstruir, revertir ni auditar. La fuente de verdad era el disco de una máquina.

> ⚠️ **Nota metodológica.** En el camino afirmé que producción "no correspondía a ningún commit" apoyándome en comandos `git` que corrían desde `/tmp` y fallaban con *not a git repository*; leí esos fallos como respuestas. Me retracté, y después probé lo mismo por un método válido (marcadores en el bundle). **La conclusión era correcta, la primera evidencia no.** Vale como recordatorio: verificar el `cwd` antes de creerle a un `git` que "no encuentra" algo.

---

## 2. Lo ejecutado, en orden

### 2.1 Punto cero del repositorio (PR #3)

Punto de partida: **163 entradas pendientes**, 10 ramas locales, frontend de producción sin commitear.

Antes de tocar nada se creó la red de seguridad: rama **`snapshot/pre-limpieza-2026-08-17`** (`106accd`), pusheada, con el estado íntegro incluidos los archivos sin trackear. Se creó con *plumbing* (`write-tree` + `commit-tree`) para no alterar el árbol de trabajo.

La premisa "todo lo que no está en producción es basura" **falló tres veces seguidas, siempre en la misma dirección**: lo pendiente no era basura, era trabajo terminado que nunca se commiteó.

| Rescatado | Qué era |
| :-- | :-- |
| `clinica-finanzas.service.ts` +16 / spec +51 | Validación de pagos: rechaza `NaN`, fecha inválida y **fecha futura** |
| `testing/scripts/lib.js` | **Fix de seguridad**: los scripts de carga de QA apuntaban a **producción por defecto** |
| `hce-frontend/.env.production` | Sin ella no se puede compilar el frontend de prod. Vivía en una sola máquina |
| `scripts/` (7), `.agents/`, `.codex/`, 2 walkthroughs | Tooling y gobernanza multi-agente que sólo existían en un disco |

Basura real eliminada: `aws/scripts/build-backend/` (115 archivos — copia del backend versionada por error, divergida en 158 líneas del real; es salida de build que `deploy-aws.ps1` regenera), **13 MB de `hce-backend/uploads/` con evidencia clínica de pacientes dentro de git**, 7 MB de salidas de auditoría, y 7 ramas muertas (todas verificadas con 0 commits fuera de `origin/main`).

**Resultado: 163 → 0 pendientes.**

### 2.2 Guard de trazabilidad (PR #4)

`deploy-aws.ps1 -Frontend` no empaqueta: **publica** (`npm run build` + `aws s3 sync --delete` + invalidación de CloudFront), sin verificar el estado del árbol. Esa fue la vía por la que llegó código sin commitear.

Se agregó `Assert-DeploySafe`, invocada por `-Backend`, `-Frontend` y `-Keycloak`:

| Condición | Efecto |
| :-- | :-- |
| Árbol sucio (modificados, borrados o **no trackeados**) | 🔴 bloquea |
| HEAD sin tag | 🟡 advierte · 🔴 bloquea con `-RequireTag` |
| Commit no publicado en origin | 🟡 advierte |
| `-Force` | continúa, en rojo y con registro |

Cada corrida deja procedencia en `aws/scripts/deploy-log.txt` (gitignorado). Verificado en 5 casos, sin ejecutar ningún deploy real (dot-source sin switches).

### 2.3 Tags de producción

No se tagueó `main` como "producción" porque **habría mentido**: `main` ya estaba adelante. Se tagueó por componente:

- `prod-backend-20260730` → `b8f37ff` (versión EB `prod-20260730-1341-...`)
- `prod-frontend-20260803` → `5464d92`
- `prod-backend-20260817` → `17fddd6` (primer deploy con guard)
- `prod-backend-20260818` → `6a474d5` (segundo deploy)

**Había desfasaje**: frontend del 3/8 con backend del 30/7. Eliminado.

### 2.4 Sobrepago (PR #5) — decisión del Super Admin: rechazar

Se podía cobrar $1.000.000 sobre un presupuesto de $10.000. `registrarPago` ahora compara contra el saldo pendiente y devuelve 400 informando el saldo, con tolerancia de medio centavo por punto flotante. Se extrajo `sumarPagosVigentes()` como único punto de suma (y se le agregó el `tenantId` que faltaba).

### 2.5 CI verde (PR #6) — el cambio de mayor apalancamiento

El CI estaba en rojo desde el **2026-06-18**. La consecuencia real no era "el lint falla": `test-backend` declaraba `needs: lint`, así que **los tests no se ejecutaron ni una vez en GitHub durante dos meses**. Todo deploy de ese período se hizo sin red automatizada.

Causa medida en el runner: 1.280 errores, todos de `@typescript-eslint/no-unsafe-*`, consecuencia de `noImplicitAny: false`.

1. **`test-backend` ya no depende de `lint`.** Es el cambio que importa.
2. Baseline congelado como `warn` + `--max-warnings` como trinquete (backend 1508, frontend 328, exactos).
3. Se quitó `--fix` del lint en CI y `--passWithNoTests` de los tests.
4. **Descubrimiento:** el `--fix` estaba enmascarando **1.418 desviaciones de prettier**. Al quitarlo quedaron expuestas y se resolvieron formateando una vez (117 archivos, tests y build idénticos antes y después).

> Afirmé antes que esos errores de prettier eran artefacto de CRLF en Windows. **No lo eran** — el runner Linux los reportó idénticos. Lo que los ocultaba era el `--fix`.

**Los 13 bugs reales de React NO se enterraron**: 3 `purity` (leen `Date.now()` durante el render), 8 `static-components` (se remontan en cada render y pierden el foco del input), 2 `immutability`. Están a `warn` pero **listados uno por uno con archivo y línea en `hce-frontend/eslint.config.js`**, para corregir y volver a `error`.

### 2.6 Definición canónica de deuda

Bug reproducido **contra la API de producción** antes de corregir: el paciente `3521ef29` devolvía `deudaActual: -188` mientras el `saldo` del mismo presupuesto, en la misma respuesta, decía `0`.

Caso real: `PRES-0001`, total $45.112, cobrado $45.300 (exceso **$188**). Entre sus pagos anulados hay uno de **$100.000** sobre ese mismo presupuesto: **el problema ya había ocurrido y hubo que limpiarlo a mano**.

Cuatro bugs corregidos:

1. `getCuentaCorriente` sin clamp → el excedente de un presupuesto **compensaba la deuda de otro** (un moroso figuraba al día).
2. `getCuentaCorriente` sin filtro de estado → sumaba borradores y cancelados.
3. `getDashboard` excluía `vencido` → la deuda incobrable no aparecía en el KPI.
4. `pacientesMorosos` contaba **presupuestos, no pacientes**.

Solución: `ESTADOS_DEVENGAN_DEUDA` + `saldoDePresupuesto()` como definición única, consumida por ambas pantallas.

**Decisión: el excedente se reporta, no se oculta.** `excedentePagado` lo hace visible. **No se modificó ningún dato** — los $188 son dinero que un paciente pagó de verdad; corregirlo es decisión de la clínica.

### 2.7 IAM de mínimo privilegio (PR #7 y #8)

Estado hallado: **cero usuarios IAM**, **dos claves root activas**. Todo se hacía con root, que da acceso irrestricto incluido el bucket `odontocloud-clinical-evidence` con datos de pacientes.

Se creó `denthce-deploy`. El primer diseño (política propia minimalista) **falló dos veces en el deploy real**: `s3:CreateBucket` (EB verifica su bucket aunque exista) y `cloudformation:GetTemplate` (EB orquesta CFN por debajo).

**Se invirtió el enfoque:** la política gestionada de AWS `AdministratorAccess-AWSElasticBeanstalk` **otorga** la superficie de EB (AWS la mantiene al día) y `DentHCE-Deploy` **resta** con `Deny` explícito, que en IAM gana siempre. Verificado después de adjuntar la gestionada: **evidencia clínica, IAM y RDS siguen bloqueados**.

### 2.8 Dos deploys a producción

| Versión | Contenido | Verificación funcional |
| :-- | :-- | :-- |
| `prod-backend-20260817-17fddd6` | Validación de pagos + sobrepago | `monto="abc"` → 400 (el código viejo daba 500 desde Postgres); fecha futura → 400 |
| `prod-backend-20260818-6a474d5` | Definición canónica de deuda | `deudaActual` del paciente real: **-188 → 0**, con `excedentePagado: 188` |

El segundo se ejecutó **íntegramente con el usuario IAM acotado**. Ambos pasaron por el guard con `-RequireTag`. Antes de subir se verificó que el compilado contuviera los fixes (no alcanza con que el build no falle).

---

## 3. Estado al cierre

| | |
| :-- | :-- |
| Backend en prod | `prod-backend-20260818-6a474d5` = `main` @ `6a474d5` · Green / Ready |
| Frontend en prod | `main` (sin cambios de código desde `prod-frontend-20260803`) |
| Repositorio | `main` + `snapshot/pre-limpieza-2026-08-17` · **0 pendientes** · 0 PRs abiertos |
| CI | **verde en `main`** — 184 tests / 16 suites |
| Rollback backend | `aws elasticbeanstalk update-environment --environment-name Odontocloud-env --version-label prod-backend-20260817-17fddd6` |

---

## 4. Pendientes — verificados contra el código el 2026-08-17

### 4.1 Seguridad: los críticos de la auditoría siguen ABIERTOS

Ninguno de estos se tocó hoy. Confirmado por inspección:

| Hallazgo | Ubicación |
| :-- | :-- |
| `/uploads` servido estático **sin autenticación** (radiografías, firma del odontólogo con nombre predecible) | `hce-backend/src/main.ts:24` |
| **Clave RDS de producción en el repo** — 8 archivos | `testing/scripts/*.js` |
| Admin de Keycloak y `client_secret` hardcodeados | `tenant/keycloak-admin.service.ts` |
| `hceWebhookSecret` devuelto a cualquier rol autenticado | `tenant/tenant-config.entity.ts` (sin `select: false`) |
| `RolesGuard` **fail-open** (sin `@Roles` → permite) | `auth/roles.guard.ts` |
| `/api/sisa/verificar` sin `@Roles` | `sisa/sisa.controller.ts` |
| `deleteFile` ignora el tenant (borra archivos de cualquier clínica) | `patient/file-upload.controller.ts` |
| DTOs como `interface` → **el `ValidationPipe` no valida nada** (mass-assignment cross-tenant) | 0 archivos `*.dto.ts` en el backend |

**Contraseñas semilla vivas en producción**: `doctor_julio` / `doctor_pass_2026` emite token válido; están versionadas en `INTEGRACION-HCE-TEST-CREDENTIALS.md` y `testing/scripts/lib.js`. El password grant (ROPC) está habilitado.

### 4.2 Deuda estructural — ABIERTA

Sin paginación en ningún service · sin transacciones en operaciones multi-tabla · sin migraciones versionadas (`MigrationInterface`: 0 archivos) · `tenantId` con doble semántica y `AUTH_STRICT=false` · sin auditoría de **lectura** de ePHI.

### 4.3 Acciones que requieren a una persona

1. **Desactivar las claves root de AWS.** Orden seguro en `aws/iam/README.md` (Last used → migrar → desactivar → esperar → borrar). El deploy de hoy ya demostró funcionar sin ellas.
2. **Los $188 de `PRES-0001`** — dejarlo (visible en `excedentePagado`) o registrar un ajuste.
3. **Avisar a los tenants**: la deuda que ven cambió a propósito (negativa → 0; `deudaTotal` sube al incluir vencidos; `pacientesMorosos` baja porque antes contaba presupuestos).
4. **Tres decisiones de producto** que bloquean sus ADR: ¿se vende a clínicas multi-profesional (hoy `Practitioner` se sintetiza desde `tenant_config`: **un profesional por clínica cableado en la capa de datos**)? ¿qué pasa con la Ficha Clínica general, hoy inalcanzable desde el menú? ¿sobrepago resuelto — ya decidido: rechazar?

### 4.4 Los 13 bugs de React

Listados con archivo y línea en `hce-frontend/eslint.config.js`. Corregir y devolver las reglas a `error`.

---

## 5. Cómo seguir

El plan de remediación completo (5 fases) se acordó en sesión. Lo de hoy fue esencialmente la **Fase 0 — la mesa de operaciones**: sin CI, sin trazabilidad y sin deploy reproducible, cualquier corrección era una apuesta.

**Lo siguiente es la Fase 1 — cerrar exposición**, en este orden por radio de impacto medido:

1. **Firma del odontólogo y adjuntos de paciente → endpoint autenticado.** Colateral casi nulo: ambos persisten URL absoluta `http://localhost:3000/...`, o sea que **como funcionalidad ya están rotos en producción**, mientras que como exposición están vivos.
2. **Separar `/uploads/logos/`** (es público por diseño, aparece pre-login) **antes** de apagar el estático, o se rompe el login de todos los tenants.
3. **Documentos odontológicos → S3 con lectura dual**, y recién ahí eliminar `express.static`.
4. **Invertir el spread** `create({ ...dto, tenantId })` — cierra el mass-assignment sin tocar el `ValidationPipe`, que es lo que ya rompió endpoints una vez.
5. **Rotar secretos en 4 pasos** (env con fallback → deploy → setear variable → rotar → quitar fallback). Rotar antes del paso 1 rompe el alta de clínicas.

Regla que se validó hoy y conviene mantener: **medir el radio de impacto antes de proponer el orden.** Tres veces cambió el plan por medir (el deploy que empaquetaba desde la copia fantasma, las URLs `localhost` ya rotas, los permisos de EB).

---

## Referencias

- Auditoría completa: en el historial de la sesión (5 subagentes).
- PRs: #3 punto cero · #4 guard · #5 sobrepago · #6 CI · #7 y #8 IAM.
- Respaldo íntegro previo a la limpieza: `snapshot/pre-limpieza-2026-08-17` (`106accd`).
- `aws/iam/README.md` — diseño de permisos y pasos para las claves root.
