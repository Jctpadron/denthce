# Saneamiento del registro: tablero, backlog y sincronizador

**Creado:** 2026-08-19 · **Responsable:** Claude (Orquestador) · **Rama:** `chore/saneamiento-registro`
**Origen:** continuidad del handoff `2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`.

> **Qué cambió acá:** ningún código de producción. Este trabajo arregla la **fuente única de verdad del estado** (`tablero_control.md` + `docs/backlog.json`) y el script que los mantiene sincronizados. El 2026-08-17 se arregló la relación entre el repo y producción; esto arregla la relación entre el tablero y la realidad.

---

## 1. Por qué hacía falta

El tablero y el backlog venían divergiendo en silencio. Cuatro clases de deriva, todas verificadas contra el código:

| Deriva | Efecto |
| :--- | :--- |
| **Numeración corrida** en el Módulo 4 | El tablero saltaba de `4.3` a `4.5` y tenía una `4.7` inexistente. Cada checkbox marcaba la tarea equivocada. |
| **Colisión de códigos** entre módulos | Finanzas estaba numerada `REQ-009-FIN-9.x`, chocando con la HC Odontológica (`9.x`). |
| **Tareas invisibles** | Módulo 12 (Finanzas, 12 tareas) y las tareas `1.12`–`1.14` existían en el backlog pero **nunca se listaron en el tablero**. |
| **Estados sobredeclarados y subdeclarados** | Tareas marcadas completas que no existen en el código, y tareas ya resueltas que seguían pendientes. |

---

## 2. El bug del sincronizador

`scripts/orchestration_runner.py` identificaba cada tarea por el **sufijo de su ID**:

```python
if task["id"].endswith(code):   # code = "2.5" tomado del tablero
```

`"2.5"` no identifica una tarea: `REQ-002-PAT-2.5` **y** `REQ-012-FIN-12.5` terminan igual. El primero del array ganaba.

**Alcance medido, sin exagerar:** hoy hay **11 colisiones de sufijo**, de las cuales **2 tienen estados distintos** (`2.5` y `2.6` contra `12.5` y `12.6`). En el árbol actual el daño estaba **enmascarado por el orden del array** — los IDs cortos (`REQ-002-…`) aparecen antes que los largos (`REQ-012-…`), así que el ganador resultaba ser el correcto. Es decir: **no encontré estados corrompidos por esta vía**, pero la protección era accidental y se caía con cualquier reordenamiento o alta de módulo.

**Corrección:** la clave pasa a ser el par `(modulo_id, código)`, en las dos direcciones de sincronización. Se agregó además:

- soporte para sufijos de letra (`9.10a` / `9.10b`), que el regex `[0-9.]+` descartaba;
- exclusión de las entradas en estado `duplicado` del conteo (inflaban el denominador y se cerraban dos veces);
- **newline final** al reescribir el tablero — sin él, cada corrida ensuciaba el diff con un cambio fantasma.

También había código JavaScript dentro del Python (`match[1].trim().toLowerCase()`), inalcanzable gracias a un `hasattr` que siempre daba falso. Se reemplazó por Python real.

---

## 3. Correcciones de estado, una por una

Cada cambio se verificó **contra el código**, no contra la memoria. El detalle queda en `historial_auditoria` de cada entrada del backlog.

### Bajadas (estaban sobredeclaradas)

| Tarea | Antes | Ahora | Evidencia |
| :--- | :--- | :--- | :--- |
| `4.4` Firma digital + PDF + QR | completado | **pendiente** | La firma **sí existe** (hash SHA-256, `signedBy`/`signedAt`, extensiones FHIR en `medication-request.service.ts`). **No existe el PDF** (`pdfkit` solo se usa en `odontology-pdf.service.ts`) **ni el QR** (`qrCodeData` apunta a `dentariehr.gov`, dominio inexistente; el frontend solo pinta el ícono `QrCode` de lucide-react). |
| `4.5` Kardex / eMAR | completado | **pendiente** | 0 coincidencias de `kardex`, `emar` o `MedicationAdministration` en `hce-backend/src` y `hce-frontend/src`. |

### Subidas (estaban subdeclaradas)

| Tarea | Antes | Ahora | Evidencia |
| :--- | :--- | :--- | :--- |
| `5.1`–`5.5` Agenda | pendiente | **completado** | `hce-frontend/src/components/agenda/{AgendaView,AgendaGrid,AppointmentModal,WaitingRoom}.tsx` + `hce-backend/src/appointment/` con `POST :id/reminder` y `PATCH :id/status`. Cerrado desde el 2026-06-13; el backlog nunca se sincronizó. |
| `10.1`–`10.5` Prótesis | pendiente | **completado** | El tablero ya las daba por hechas; nunca se sincronizaron porque se escriben `PRO.N` y no `Tarea 10.N`. |
| `12.11` deuda global | pendiente | **completado** | **Resuelto por `AUD.6`** y desplegado en `prod-backend-20260818`: `ESTADOS_DEVENGAN_DEUDA` + `saldoDePresupuesto()` (clamp) + `excedentePagado`, verificado en `clinica-finanzas.service.ts` y cubierto por `clinica-finanzas.service.spec.ts`. |

### Duplicado

`REQ-001-INF-1.11` describía el mismo hallazgo que `AUD.8` (`/uploads` sirve ePHI sin autenticación). Se marcó `duplicado` con `superseded_by: REQ-011-AUD-8` y **queda fuera del conteo**. La canónica es `AUD.8`.

### Renumeraciones

- Finanzas: `REQ-009-FIN-9.x` → **`REQ-012-FIN-12.x`** (12 tareas), para no chocar con la HC Odontológica.
- Módulo 4 en el tablero: `4.5/4.6/4.7` → **`4.4/4.5/4.6`**, alineado con el backlog.
- Altas de registro: Módulo 9 (11 tareas de Odontología), `PRO.10`–`PRO.12`, y las tareas `1.12`–`1.14` de Infraestructura.

---

## 4. El progreso global cambió de significado

| | Antes | Ahora |
| :--- | :---: | :---: |
| Completadas / Totales | 53 / 70 | **77 / 116** |
| Progreso global | 76 % | **66 %** |

**No es un retroceso: es un denominador honesto.** El "70" era el plan original de 2026; desde entonces se construyeron tres módulos enteros (10 Prótesis, 11 Auditoría, 12 Finanzas) que se declaraban "fuera del conteo" y por lo tanto no aparecían ni como trabajo hecho ni como trabajo pendiente. Ahora los tres cuentan, con sus 12 tareas terminadas de Prótesis y sus 12 pendientes de seguridad.

| Módulo | Estado |
| :--- | :--- |
| 0, 2, 3, 5, 9, 10 | 100 % |
| 1 Infraestructura | 10/13 — 77 % |
| 4 Receta electrónica | 3/6 — 50 % |
| 6, 7, 8 (LIS/PACS, Portal, IA) | 0 % — no arrancados |
| 11 Auditoría y remediación | 7/19 — 37 % |
| 12 Finanzas | 6/12 — 50 % |

---

## 5. Verificación

No alcanza con que el script corra. Se probó sobre **copias** en un directorio temporal, sin tocar los archivos reales:

1. **El sentido inverso no pisa el backlog.** `__main__` ejecuta `sync_markdown_to_json()` **antes** que el rebuild; con el tablero desalineado eso habría revertido las correcciones de hoy (por ejemplo, `4.4` volvía a "completado"). Con el tablero ya alineado, el sync es un **no-op verificado por hash**.
2. **El rebuild es idempotente.** Dos corridas seguidas producen el mismo hash.
3. **Punto fijo alcanzado:** tablero y backlog son consistentes en las dos direcciones; el tablero regenerado es idéntico al escrito a mano, lo que valida cruzadamente ambas correcciones.
4. `python -m py_compile` sobre el runner: sin errores.

> ⚠️ **Cómo correr el runner sin romper nada.** `python scripts/orchestration_runner.py` levanta además un servidor HTTP en el puerto 8000 y **corre el sync inverso primero**. Si editaste el backlog a mano y el tablero todavía no refleja esos cambios, el sync los revierte. Para regenerar solamente el tablero desde el backlog:
> ```python
> import sys; sys.path.insert(0, 'scripts')
> import orchestration_runner as r
> r.rebuild_markdown_from_json()
> ```

---

## 6. Lo que queda abierto (deuda de registro conocida)

Estas iniciativas **están en el tablero pero no en `docs/backlog.json`**, así que no entran en ningún conteo y sus checkboxes son manuales:

| Iniciativa | Estado en el tablero |
| :--- | :--- |
| `SA.1`–`SA.6` Super Admin / servicios anexables | 5 de 7 hechas · `SA.4B` bloqueada por CliniChat, `SA.6` sin desplegar |
| `QA.1`–`QA.3` Auditoría móvil | `QA.3` en curso |
| `GOV.1`–`GOV.8` Gobernanza LabFlow→HCE | `GOV.3` y `GOV.5`–`GOV.8` pendientes |
| `DEPLOY.1`, `PRES.1` | hechas |

También queda que los módulos 10 y 11 usan prefijos propios (`PRO.N`, `AUD.N`) en vez de `Tarea X.Y`: **cuentan en la tabla de progreso pero sus checkboxes no se sincronizan**. Se decidió no renombrarlos ahora para no alterar la nomenclatura que el Super Admin ya usa.

`GOV.3` sigue vigente y ahora con el número correcto: **`CLAUDE.md` dice "61% global"; el real es 66 %.**

---

## 7. Lo que NO cambió

Los **críticos de seguridad de la auditoría del 2026-08-17 siguen todos abiertos** (`AUD.8`–`AUD.19`). Este saneamiento no tocó código de producción, ni backend, ni frontend, ni infraestructura. El próximo trabajo real es la **Fase 1 — cerrar exposición**, en el orden por radio de impacto de §5 del handoff del 2026-08-17:

1. Firma del odontólogo y adjuntos de paciente → endpoint autenticado.
2. Separar `/uploads/logos/` (público por diseño) **antes** de apagar el estático.
3. Documentos odontológicos → S3 con lectura dual; recién ahí quitar `express.static`.
4. Invertir el spread `create({ ...dto, tenantId })`.
5. Rotar secretos en 4 pasos.

---

## Referencias

- Handoff vigente: `docs/walkthroughs/2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`
- Respaldo del estado previo: **git**, commit `51a8084` (`git show 51a8084:tablero_control.md`). Existe además una copia local `.bak` en `docs/_snapshot-registro-2026-08-19/`, deliberadamente **no versionada**: git ya es el respaldo canónico.
- Gobernanza: `AGENTS.md` → "Fuente Única de Verdad y Arranque de Sesión"
