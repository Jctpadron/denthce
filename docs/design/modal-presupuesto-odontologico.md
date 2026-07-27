# Spec UX — Modal de Plan de Tratamiento / Presupuesto odontológico (DentHCE)

> **Agente:** UX/HCE · **Fecha:** 2026-07-21 · **Estado:** Propuesta de diseño (no implementada)
> **Alcance:** especificación de interacción, layout, campos, estados y mapeo de datos. NO incluye código de producción.
> **Fuente de verdad de diseño:** skill `design-system` (tokens/componentes/white-label/accesibilidad). Este doc usa exclusivamente los tokens ya presentes en el repo (`--color-primary`, `--color-emerald`, `--color-rose`, `--color-amber`, `--color-violet`, `--color-muted`, `--color-text`, `--bg-surface`, `--bg-base`, `--bg-card`, `--border-color`, `--shadow-card`, `--shadow-sm`, `--font-title`) y las clases utilitarias existentes (`.btn`, `.btn-primary`, `.btn-secondary`, `.segmented-control`, `.segmented-button`, `.search-input`, `.panel`). No se introducen estilos nuevos que ya existan como token/clase.

---

## 1. Contexto y objetivo

En la Historia Clínica Odontológica (`OdontologyHC.tsx` → `OdontogramPAMI.tsx`) el odontólogo trabaja con un odontograma de dos capas mediante un toggle **"Existente / Plan"**:

- **Existente** (rojo): patologías/estados que el paciente ya tiene.
- **Plan** (azul, líneas discontinuas): tratamientos futuros que se van a proponer/ejecutar.

El pedido del odontólogo es digitalizar su formulario de papel de **PRESUPUESTO + ESTADO CONTABLE + FICHA DE ATENCIÓN**, y que se enganche con lo que ya pinta en azul en el odontograma. Este modal materializa ese formulario y lo **unifica con el módulo Finanzas** existente (`clinica_presupuestos`, `clinica_presupuesto_items`, `clinica_pagos`), para que un solo presupuesto alimente pagos, cuenta corriente y dashboard, sin duplicar datos.

**Principio rector:** el modal NO crea un sistema de presupuestos paralelo. Es una **vista odontológica** (con lenguaje y auto-carga desde el diente) sobre el MISMO presupuesto de Finanzas. Un presupuesto creado desde acá aparece idéntico en `FinanzasClinicas.tsx`, y viceversa.

---

## 2. Disparador: cómo se abre el modal (decisión justificada)

Hay dos opciones sobre la mesa:

| Opción | Descripción | Problema |
| :--- | :--- | :--- |
| **A** | Click directo en el toggle "Plan" abre el modal de una | El toggle "Plan" es un **modo de dibujo**; el odontólogo lo usa muchas veces para pintar pieza por pieza. Abrir un modal en cada activación bloquea el flujo de pintado y es intrusivo. |
| **B (recomendada)** | El toggle "Plan" solo cambia la capa de dibujo (comportamiento actual, sin cambios). Aparece un **botón contextual "Ver / armar presupuesto"** que se muestra únicamente cuando `activeLayer === 'planned'`, y ese botón abre el modal. | Ninguno relevante. Separa "pintar el plan" de "presupuestar el plan". |

**Decisión: Opción B.** Justificación:

1. **No rompe el flujo de dibujo.** Pintar el plan (acción frecuente, muchos clicks) queda intacto; presupuestar (acción puntual, 1 vez por plan) es un paso explícito.
2. **Descubribilidad.** El botón aparece contextualmente en modo Plan, con un badge que indica cuántos tratamientos planificados hay pendientes de presupuestar (ej. `Ver / armar presupuesto (4)`), señalizando que hay algo que convertir en dinero.
3. **Reversible/idempotente.** El odontólogo puede pintar, cerrar, volver, pintar más y recién ahí abrir el modal, que reflejará el estado acumulado.

### Ubicación del botón disparador
Dentro de la barra de estado dinámica del odontograma (`OdontogramPAMI.tsx`, el bloque azul `#eff6ff` que ya existe cuando `activeLayer === 'planned'`), alineado a la derecha del bloque de texto "Modo Plan de Tratamiento", junto al segmented control de capa. En mobile pasa a fila propia (100% ancho) debajo del texto.

```
[📅 Modo Plan de Tratamiento] ............. [ Existente | Plan ]
   Planifica tratamientos futuros...        [ 💲 Ver / armar presupuesto (4) ]
```

- Clase base `btn btn-primary`, icono `lucide-react` `Receipt` o `FileText` + `DollarSign`.
- Texto: `Ver / armar presupuesto` + contador de items planificados sin presupuestar.
- `aria-label`: `"Abrir presupuesto del plan de tratamiento, N tratamientos planificados"`.

**Punto de entrada secundario:** también accesible desde la solapa Finanzas del paciente y desde el drawer "Historial y Planes" (hoy comentado en el código), para no obligar a pasar por el odontograma. Es el mismo modal.

---

## 3. Estructura general del modal

Modal centrado, overlay `color-mix(in srgb, var(--color-text) 35%, transparent)` (patrón idéntico al `Modal` de `FinanzasClinicas.tsx` y al modal de leyenda de `OdontogramPAMI.tsx`). Tamaño **grande** (no el `480px` del modal chico): ancho `min(1040px, 94vw)`, alto máx `90vh` con cuerpo scrolleable y header/footer fijos (sticky).

### Organización por pestañas (3 solapas)
Se usa el patrón `segmented-control` / `segmented-button` ya existente:

1. **Presupuesto** (default) — tabla de líneas + totales + RX presentadas.
2. **Estado contable** — importe total, cuotas, obra social, fechas y la tabla de pagos (Fecha / Pago / Saldo).
3. **Ficha de atención** (opcional, ver §7) — tratamientos ya ejecutados.

> Justificación de pestañas y no un scroll único: el papel son 2–3 hojas conceptualmente distintas (presupuestar ≠ cobrar ≠ registrar lo hecho), con audiencias distintas (odontólogo arma presupuesto; recepción/admin cobra). Separar reduce carga cognitiva y permite permisos por rol a futuro (recepcionista ve "Estado contable" pero no edita líneas clínicas).

### Anatomía (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Presupuesto de tratamiento — Pérez, Juan (DNI 30.111.222)   N°P-0042 │  ← header sticky
│  [ Presupuesto ] [ Estado contable ] [ Ficha de atención ]        [X] │  ← tabs + cerrar
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   (cuerpo scrolleable de la pestaña activa)                            │
│                                                                        │
├──────────────────────────────────────────────────────────────────────┤
│  Estado: [Borrador ▾]        Total $ 000.000,00   [Cancelar] [Guardar] │  ← footer sticky
└──────────────────────────────────────────────────────────────────────┘
```

- **Header:** título + paciente (nombre + DNI, desde FHIR Patient) + número de presupuesto (`P-0042`, o "Nuevo" si aún no existe). El paciente NO se busca acá: viene fijado por el contexto de la HC abierta (`patientId`). Se muestra como texto, no editable.
- **Footer:** badge de estado (con las transiciones borrador→presentado→aceptado→en_curso→pagado del backend), total vivo, y acciones. El botón primario cambia según pestaña (ver §11).

---

## 4. Pestaña "Presupuesto"

Reproduce la tabla del papel: `Código Nomenclador | Cantidad | Importe | Detalle de tratamiento (dientes, cara, etc.)` + `RX Presentadas` + `Total $`.

### 4.1 Auto-carga desde el odontograma (diferenciador clave)

Al abrir el modal con `activeLayer` habiendo pintado plan, se listan los **tratamientos planificados** (recursos FHIR con `extension` layer=`planned`) que NO estén ya volcados en una línea del presupuesto. Se presentan en un panel superior colapsable:

```
┌ Tratamientos planificados en el odontograma (4) ──────────── [Importar todos] ┐
│  ☑ Restauración — Pieza 16, cara O          [precio sugerido $ ____ ]         │
│  ☑ Endodoncia multirradicular — Pieza 26    [precio sugerido $ ____ ]         │
│  ☑ Corona — Pieza 26                         [precio sugerido $ ____ ]         │
│  ☐ Extracción — Pieza 38                     [precio sugerido $ ____ ]         │
│                                          [ + Agregar seleccionados a la tabla ] │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Cada fila propone: `snomedDisplay` (del catálogo) + `pieza`/`cara` (de `bodySite`) + **precio sugerido** buscado en el nomenclador por `snomedCode` (`GET /clinica/finanzas/nomenclador`). Si no hay precio cargado para ese SNOMED, el campo queda vacío y resaltado en `--color-amber` con tooltip "Sin precio en nomenclador".
- Botón **"Importar todos"** / selección múltiple + "Agregar seleccionados": cada tratamiento se convierte en una fila de la tabla de presupuesto (mapeo en §9).
- Los ya importados dejan de aparecer en este panel (se "consumieron"), evitando duplicados. Un tratamiento planificado importado queda vinculado a su línea (ver §9, campo de trazabilidad pendiente).

### 4.2 Tabla de líneas (tabla editable)

| Col. papel | Control | Campo modelo | Notas |
| :--- | :--- | :--- | :--- |
| Código Nomenclador | input texto corto / autocomplete nomenclador | **`codigoNomenclador` (FALTA, ver §9)** | El nº del nomenclador nacional/PAMI/OS. Distinto del SNOMED. |
| — (prestación) | autocomplete contra nomenclador | `snomedCode` + `snomedDisplay` | Al elegir del nomenclador se autocompletan código, display y precio. |
| Cantidad | input number (min 1) | `cantidad` | |
| Importe | input number (moneda) | `precioUnitario` | Se muestra `subtotal = cantidad × precioUnitario` en columna derecha calculada. |
| Detalle de tratamiento (dientes, cara, etc.) | input texto libre + chips pieza/cara | `diente` + `cara` (+ **`detalle` libre, FALTA §9**) | Diente/cara estructurados; texto libre para "distal-oclusal", "puente 15-17", etc. |
| (acción) | botón borrar fila (`Trash2`) | — | |

- Filas dinámicas: botón **"+ Agregar línea"** al pie (papel tiene ~10 renglones fijos; digital = ilimitadas, con placeholder de fila vacía como en papel).
- **Fila de subtotal por línea:** columna calculada a la derecha (no editable), `MONEY(cantidad × precioUnitario)`, reusando el helper `MONEY` de Finanzas.
- Orden persistido en `orden` (drag futuro; v1 = orden de inserción).

### 4.3 Campos de cierre de la sección

- **RX Presentadas:** control numérico pequeño (o checkbox + nº). En papel es un conteo de radiografías presentadas a la OS. → **`rxPresentadas` (FALTA §9)**. Alternativa v1 sin cambiar modelo: guardarlo dentro de `notas` con prefijo, pero se recomienda campo propio.
- **Descuento ($):** input number → `descuento` (ya existe).
- **Total $:** calculado, no editable → `total`. `subtotal = Σ líneas`; `total = subtotal − descuento`. Se muestra grande, alineado a la derecha, en `--color-text` bold.

---

## 5. Pestaña "Estado contable"

Reproduce: `Importe Total $`, `Cantidad de cuotas`, tabla `Fecha | Pago | Saldo`, `Obra Social`, `Fecha de Presentación`, `Fecha de Liquidación`.

### 5.1 Cabecera contable (grid 2 columnas → 1 en mobile)

| Campo papel | Control | Campo modelo | Notas |
| :--- | :--- | :--- | :--- |
| Importe Total $ | solo lectura (viene del presupuesto) | `total` | Espejo del total de la pestaña Presupuesto. |
| Cantidad de cuotas | input number | **`cantidadCuotas` (FALTA §9)** | Al setear, se sugiere valor de cuota = `total / cuotas` (informativo). |
| Obra Social | select/autocomplete | **`obraSocial` (FALTA §9)** | Idealmente contra un catálogo de OS del tenant; v1 texto libre. |
| Fecha de Presentación | date | **`fechaPresentacion` (FALTA §9)** | Fecha de presentación a la OS. |
| Fecha de Liquidación | date | **`fechaLiquidacion` (FALTA §9)** | Fecha de liquidación/pago de la OS. |
| Seña (%) | input number (default 30) | `senhaPorcentaje` | Ya existe; se muestra el `senhaMonto` calculado. |
| Validez | date | `fechaValidez` | Ya existe. |

### 5.2 Tabla de pagos `Fecha | Pago | Saldo`

Es la **cuenta corriente del presupuesto**. Reusa `clinica_pagos` (NO se inventa tabla). Cada fila = un `ClinicalPago` con `presupuestoId` = este presupuesto.

| Col. papel | Origen | Notas |
| :--- | :--- | :--- |
| Fecha | `pago.fechaPago` | |
| Pago | `pago.monto` (+ `tipo`: seña/cuota, + `metodoPago`) | |
| Saldo | **calculado** en front: `total − Σ pagos hasta esa fila` | Saldo decreciente, como el papel. NO se persiste por fila. |

- Fila final: **Saldo actual** resaltado (`--color-amber` si > 0, `--color-emerald` si 0), idéntico al patrón de la tabla de presupuestos en `FinanzasClinicas.tsx` (`saldo > 0 ? amber : emerald`).
- Botón **"+ Registrar pago"**: reusa el flujo/DTO de `handleRegistrarPago` (`POST /clinica/finanzas/pago`) con `presupuestoId` prefijado y `patientId` del contexto → así el pago cae en la cuenta corriente y el dashboard sin código nuevo de backend.
- Estado vacío: "Aún no se registraron pagos para este presupuesto."

> **Regla de negocio a validar:** registrar pagos suele requerir que el presupuesto esté `aceptado`/`en_curso` (en Finanzas el botón "+ Pago" solo aparece en esos estados). El modal debe respetar la misma máquina de estados: si está en `borrador`/`presentado`, el botón "+ Registrar pago" se muestra deshabilitado con tooltip "Acepte el presupuesto para registrar pagos".

---

## 6. Estados de la interfaz

| Estado | Comportamiento |
| :--- | :--- |
| **Vacío / Nuevo** | Sin presupuesto previo para el paciente. Título "Nuevo". Tabla con 1 fila vacía. Panel de auto-carga muestra los planificados. Total $0,00. Estado inicial `borrador`. |
| **Cargando** | Al abrir con presupuesto existente: skeleton en el cuerpo + texto "Cargando presupuesto..." (patrón `initialLoading` de Finanzas). Botones del footer deshabilitados. |
| **Guardando** | Botón primario con spinner + label "Guardando...", deshabilitado; resto del footer bloqueado. Optimista NO (esperar respuesta por seguridad de importes). |
| **Guardado OK** | Toast flotante verde reusando el patrón `message` de `OdontogramPAMI.tsx` ("Presupuesto guardado."). El número `P-00XX` aparece en el header si era nuevo. Modal permanece abierto en modo lectura/edición. |
| **Error** | Banner rojo dentro del modal (patrón `formError` de Finanzas: fondo `color-mix rose 8%`, borde `rose 20%`, icono `AlertCircle`), con el mensaje del backend. No cierra el modal ni pierde lo tipeado. |
| **Solo lectura** | Si el presupuesto está `pagado`/`cancelado`, o si el rol es `recepcionista` en la pestaña Presupuesto: campos deshabilitados, sin "+ Agregar línea", footer sin "Guardar". |

---

## 7. Pestaña "Ficha de atención" (opcional / fase 2)

Digitaliza la 2ª hoja: `Fecha (D/M/A) | Tratamiento realizado (Código, Diente N°, Cara, Firma)` — lo YA ejecutado.

**Propuesta (no crear entidad nueva):** esta pestaña es una **vista de solo lectura derivada**, no un formulario de captura. Se alimenta de:

1. Los tratamientos del odontograma que pasaron de `planned` a realizado (en el código, `handleComplete` marca `status: 'completed'`; y los `Procedure` con capa `existing` ejecutados).
2. La visita/encounter odontológico (`odontology_encounters`, firma inmutable al finalizar — ver memoria "Visita/Encounter odontológico").

| Col. papel | Origen | Notas |
| :--- | :--- | :--- |
| Fecha (D/M/A) | fecha del Procedure / encounter | |
| Código | `code.coding[0].code` (SNOMED) + `codigoNomenclador` si existe | |
| Diente N° | `bodySite.coding[0]` | |
| Cara | `bodySite.coding[1]` | |
| Firma | profesional del encounter (usuario Keycloak) + estado firmado del encounter | La "firma" del papel = trazabilidad del encounter firmado, no una firma manuscrita. |

**Decisión para el Super Admin:** ¿la Ficha de atención v1 es solo-lectura derivada (recomendado, evita doble carga y respeta la firma inmutable del encounter), o el odontólogo quiere cargarla manualmente aparte? Marcar como pregunta abierta (§13).

---

## 8. Responsive (mobile-safe, obligatorio)

Verificación objetivo: **360px, 768px, 1280px** sin overflow ni cajas rotas.

### Modal
- Desktop (≥1024px): `min(1040px, 94vw)`, alto `90vh`, header/footer sticky, cuerpo scroll.
- Tablet (768–1023px): `94vw`, tabs siguen horizontales (con `flex-wrap` del `segmented-control`).
- Mobile (<768px): modal a **pantalla casi completa** (`100vw`, `100dvh`, sin border-radius o solo superior), evitando el clásico modal centrado inusable en teléfono. Header/footer fijos; el cuerpo hace todo el scroll.

### Tabla de líneas de presupuesto en mobile (punto crítico)
Una tabla de 5 columnas con inputs NO entra en 360px. **No se usa scroll horizontal de inputs** (inaccesible para tipear). Estrategia **card-per-row**:

- En `<768px`, cada línea del presupuesto se renderiza como una **tarjeta apilada** (patrón "tabla → tarjetas"):

```
┌ Línea 1 ──────────────────────────── [🗑] ┐
│ Prestación:  [ Restauración        ▾ ]    │
│ Cód. nomencl.:[ 12.01.01 ]  Cant: [ 1 ]   │
│ Diente/cara:  [ 16 ] [ O ] [ + detalle ]  │
│ Importe:      [ $ 15.000,00 ]              │
│ Subtotal:                  $ 15.000,00     │
└───────────────────────────────────────────┘
```

- Cada control ocupa el ancho necesario con `flex-wrap`; nada se corta. Los labels (ocultos como `<th>` en desktop) reaparecen como labels visibles en la tarjeta.
- La tabla de pagos (Fecha/Pago/Saldo) en mobile: solo 3 columnas cortas → se mantiene como tabla con `overflow-x: auto` (patrón existente en Finanzas), ya que son numéricas/cortas y no requieren edición inline.
- Panel de auto-carga: chips/filas que envuelven con `flex-wrap`.

### Reglas anti-rotura (checklist design-system)
- Contenedores con `min-width: 0` para permitir shrink de flex/grid (ya usado en `OdontogramPAMI`).
- Texto largo (prestación, detalle) con `overflow: hidden; text-overflow: ellipsis` + `title` en celdas de solo lectura.
- Sin anchos fijos en px que fuercen scroll horizontal del modal completo.
- Botones clínicos (Guardar, +Pago, +Línea) siempre visibles y con hit-area ≥ 40×40px en mobile (footer sticky garantiza acceso a Guardar sin scrollear).

---

## 9. Mapeo campo del papel → modelo de datos existente (y gaps)

Modelo actual: `ClinicalPresupuesto` / `ClinicalPresupuestoItem` / `ClinicalPago` (leídos del repo).

### 9.1 Cabecera del presupuesto → `ClinicalPresupuesto`
| Papel | Campo existente | ¿Falta? |
| :--- | :--- | :--- |
| N° | `numero` | OK (lo genera el backend) |
| Total $ | `total` | OK |
| Descuento | `descuento` | OK |
| Seña % / monto | `senhaPorcentaje` / `senhaMonto` | OK |
| Validez | `fechaValidez` | OK |
| Fecha emisión | `fechaEmision` | OK |
| Estado | `estado` | OK (máquina borrador→…→pagado) |
| Notas | `notas` | OK |
| **RX Presentadas** | — | **FALTA** → `rxPresentadas` (int, nullable) |
| **Obra Social** | — | **FALTA** → `obraSocial` (varchar / FK catálogo OS) |
| **Cantidad de cuotas** | — | **FALTA** → `cantidadCuotas` (int, nullable) |
| **Fecha de Presentación** | — | **FALTA** → `fechaPresentacion` (date, nullable) |
| **Fecha de Liquidación** | — | **FALTA** → `fechaLiquidacion` (date, nullable) |

### 9.2 Línea del presupuesto → `ClinicalPresupuestoItem`
| Papel | Campo existente | ¿Falta? |
| :--- | :--- | :--- |
| Prestación (semántica) | `snomedCode` + `snomedDisplay` | OK |
| Cantidad | `cantidad` | OK |
| Importe unitario | `precioUnitario` | OK |
| Subtotal | `subtotal` | OK |
| Diente | `diente` | OK |
| Cara | `cara` | OK |
| Orden | `orden` | OK |
| **Código Nomenclador** | — (hoy solo `snomedCode`) | **FALTA** → `codigoNomenclador` (varchar, nullable). SNOMED es terminología clínica; el código de nomenclador es el de facturación a la OS/PAMI. Son ejes distintos y ambos hacen falta. |
| **Detalle libre** ("dientes, cara, etc.") | parcialmente en `diente`/`cara` | **FALTA** → `detalle` (varchar, nullable) para casos que no encajan en diente/cara estructurados (puentes multi-pieza, notas). |
| **Trazabilidad al plan del odontograma** | — | **FALTA (recomendado)** → `sourceResourceId` (varchar, nullable): id del recurso FHIR planificado que originó la línea. Evita re-importar duplicados y permite marcar el plan como "presupuestado". |

### 9.3 Pagos → `ClinicalPago`
| Papel | Campo existente | ¿Falta? |
| :--- | :--- | :--- |
| Fecha | `fechaPago` | OK |
| Pago (monto) | `monto` | OK |
| Tipo (seña/cuota) | `tipo` | OK |
| Método | `metodoPago` | OK |
| Comprobante | `comprobante` | OK |
| Presupuesto | `presupuestoId` | OK |
| **Saldo** | — | Calculado en front (`total − Σ pagos`); NO requiere columna. OK. |

### 9.4 Resumen de cambios de datos a solicitar al `architect`
- `clinica_presupuestos`: `+ rxPresentadas`, `+ obraSocial`, `+ cantidadCuotas`, `+ fechaPresentacion`, `+ fechaLiquidacion`.
- `clinica_presupuesto_items`: `+ codigoNomenclador`, `+ detalle`, `+ sourceResourceId`.
- Todos **nullable** → migración aditiva no rompe presupuestos existentes ni la UI de Finanzas actual.
- ⚠️ Recordatorio de la memoria del proyecto: esquema por SQL manual (`DB_SYNCHRONIZE=false`) → los `ALTER TABLE` deben ir en la migración manual correspondiente, no confiar en synchronize.

---

## 10. Accesibilidad (WCAG 2.1 AA)

- **Foco atrapado (focus trap):** al abrir, el foco va al primer control (o a la tab activa). `Tab`/`Shift+Tab` ciclan solo dentro del modal; no se escapa al fondo. Al cerrar, el foco vuelve al botón disparador "Ver / armar presupuesto".
- **Cierre por teclado:** `Esc` cierra (con confirmación si hay cambios sin guardar → §12).
- **Roles ARIA:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = id del título. Tabs con `role="tablist"`/`role="tab"`/`role="tabpanel"` y `aria-selected`.
- **Tabla editable:** cada input con `<label>` asociado (visible en mobile, `sr-only`/`aria-label` en desktop donde el header hace de etiqueta). Botón borrar fila con `aria-label="Eliminar línea N"`.
- **Contraste:** usar tokens del design-system; los importes/saldos usan `--color-emerald`/`--color-amber`/`--color-rose` sobre superficie clara — verificar con el token `--accent-text` cuando el color de acento vaya sobre fondo de color (hallazgo de la auditoría móvil: contraste WCAG resuelto con `--accent-text`). No poner texto de color saturado sobre fondo del mismo color sin ese token.
- **No depender solo del color:** el azul del plan y el rojo del existente se acompañan de etiqueta textual ("Plan"/"Existente") y del estilo de línea (discontinua/continua), como ya hace el odontograma. En la Ficha de atención, "realizado" lleva icono `CheckCircle`, no solo color.
- **Live region:** el toast de guardado/errores en `aria-live="polite"` para lectores de pantalla.
- **Objetivo táctil:** controles ≥ 40×40px en mobile.

### Atajos de teclado
| Atajo | Acción |
| :--- | :--- |
| `Esc` | Cerrar modal (confirma si hay cambios) |
| `Alt+G` | Guardar presupuesto |
| `Alt+N` | Agregar nueva línea (en pestaña Presupuesto) |
| `Alt+P` | Registrar pago (en pestaña Estado contable, si el estado lo permite) |
| `Ctrl/⌘ + ←/→` | Cambiar de pestaña |

> Nota: elegir modificadores que no colisionen con los del navegador; validar con el agente `ux`/`qa` en runtime. Documentar los atajos visualmente (tooltip/hint) para que sean descubribles.

---

## 11. Validaciones (clínicas y de importes)

Bloqueantes (impiden guardar):
- Toda línea con `snomedCode`/prestación debe tener `precioUnitario ≥ 0` y `cantidad ≥ 1`.
- No permitir guardar un presupuesto sin al menos 1 línea con importe > 0 (mismo criterio que Finanzas hoy exige un item).
- `descuento` no puede superar el `subtotal` (→ total negativo). Error inline en el campo descuento.
- `senhaPorcentaje` entre 0 y 100.
- Monto de un pago (en el sub-flujo) no puede superar el **saldo** vigente → validación antes de `POST /pago` (evita sobrepago; reusa la lógica de "restantes" que ya calcula Finanzas).

Advertencias (no bloquean, se muestran en `--color-amber`):
- Línea importada del odontograma **sin precio en nomenclador** → resaltar el campo importe.
- Presupuesto cuyo `total` difiere de la suma de tratamientos planificados (por si el odontólogo olvidó importar alguno).
- `cantidadCuotas > 1` sin `senha` cargada → recordatorio informativo.

Clínicas:
- No presupuestar tratamiento sobre pieza marcada **ausente** en la capa existente (coherente con `handleCellClick`, que bloquea marcar sobre ausente). Advertencia, no bloqueo duro (puede ser un implante sobre reborde).

Botón primario del footer según pestaña/estado:
- Pestaña Presupuesto, estado editable → **"Guardar presupuesto"** (`POST`/`PATCH /clinica/finanzas/presupuesto`).
- Pestaña Estado contable → botón secundario **"+ Registrar pago"** (si estado ≥ aceptado); "Guardar" persiste cabecera contable (cuotas, OS, fechas).
- Estados de transición (Presentar/Aceptar/Cancelar) disponibles como acciones secundarias, reusando `POST /presupuesto/:id/{presentar|aceptar|cancelar}`.

---

## 12. Integración con Finanzas (reuso, sin duplicar)

- **Crear/editar:** `POST /clinica/finanzas/presupuesto` con `{ patientId, descuento, senhaPorcentaje, items: [...], + campos nuevos }`; `PATCH /clinica/finanzas/presupuesto/:id` para edición. El DTO `CreatePresupuestoDto` ya acepta `items` con `snomedCode/snomedDisplay/precioUnitario/diente/cantidad`; se extiende con los campos nuevos (§9).
- **Pagos:** `POST /clinica/finanzas/pago` con `presupuestoId` → aparece en la pestaña Pagos de Finanzas y suma al dashboard/deuda automáticamente.
- **Cuenta corriente:** `GET /clinica/finanzas/cuenta-corriente/:patientId` puede alimentar un resumen (opcional) del paciente en el modal.
- **Consistencia visual:** reusar helpers `MONEY`, `badge`, `badgeEstado` y componentes `Modal`/`Field`/`PacienteSearchField` de `FinanzasClinicas.tsx` (aunque acá el paciente viene fijado, `Field` y estilos se reutilizan). Extraer estos helpers a un módulo compartido `finanzas/shared` para no duplicar (tarea para `code-generator`).
- **Cambios sin guardar:** si el usuario intenta cerrar (`Esc`/click overlay/[X]) con ediciones pendientes, confirmar ("Hay cambios sin guardar, ¿descartar?"). Click en overlay NO cierra silenciosamente si hay cambios (a diferencia del `Modal` chico de Finanzas que cierra al click fuera).

---

## 13. Preguntas abiertas / decisiones para el Super Admin

1. **Nomenclador vs SNOMED:** ¿se agrega `codigoNomenclador` a los items (recomendado) y se carga en el nomenclador del tenant junto al SNOMED, o el consultorio factura solo por SNOMED? Impacta la columna "Código Nomenclador" del papel.
2. **Obra Social:** ¿campo libre v1 o catálogo de OS por tenant (con FK)? Un catálogo habilita reportes por OS y las fechas de presentación/liquidación con sentido.
3. **Ficha de atención:** ¿solo-lectura derivada del odontograma + encounter firmado (recomendado), o captura manual independiente? Define si es fase 1 o fase 2.
4. **Permisos por rol:** ¿`recepcionista` puede editar líneas clínicas del presupuesto o solo la pestaña contable/pagos? El backend hoy restringe `POST presupuesto` a `medico`/`administrador`; recepción solo `GET`. Confirmar si el modal debe ocultar edición clínica a recepción.
5. **Un presupuesto por plan vs. múltiples:** ¿el odontograma tiene un único presupuesto "vivo" por paciente, o varios (por tratamiento/etapa)? Afecta cómo el botón disparador elige qué presupuesto abrir (el último no cerrado, o un selector).
6. **Momento de pasar plan→realizado:** ¿marcar una línea del presupuesto como cobrada/ejecutada dispara el `handleComplete` del tratamiento en el odontograma (sincronización bidireccional), o son pasos manuales independientes?
7. **RX presentadas:** ¿es un simple contador o requiere adjuntar las imágenes (link a PACS/uploads)? Hoy hay `uploads/` local pendiente de migrar a S3 (memoria de deploy).

---

## 14. Quality Gate UX (checklist de aceptación)

- [ ] Verificado sin overflow ni cajas rotas en **360px, 768px, 1280px**.
- [ ] Tabla de líneas se convierte en tarjetas apiladas en <768px (sin scroll horizontal de inputs).
- [ ] Footer sticky: "Guardar" siempre accesible sin scrollear en mobile.
- [ ] Focus trap + retorno de foco al disparador + `Esc` cierra (con confirmación si hay cambios).
- [ ] Solo tokens/clases del design-system (sin colores hardcodeados nuevos; contraste con `--accent-text` donde aplique).
- [ ] Todos los importes con helper `MONEY` (formato es-AR).
- [ ] Presupuesto creado desde el modal aparece idéntico en `FinanzasClinicas.tsx` y suma al dashboard.
- [ ] Atajos de teclado documentados y sin colisión con el navegador (validado en runtime).
- [ ] Estados vacío/cargando/guardando/error/solo-lectura implementados.
- [ ] No se duplica lógica de presupuesto/pago: se reusan endpoints de `clinica/finanzas`.

---

## Salida (especificación UX resumida)

```json
{
  "interfaz_usuario": {
    "pantalla": "Modal Plan de Tratamiento / Presupuesto odontológico",
    "disposicion": "Modal grande (min(1040px,94vw)) con 3 pestañas (Presupuesto / Estado contable / Ficha de atención); header y footer sticky; a pantalla casi completa en <768px. Tabla de líneas colapsa a tarjetas apiladas en móvil.",
    "colores": "Tema claro DentHCE. Acento primario (--color-primary) para el plan/azul; --color-rose existente/rojo; saldos en --color-amber (deuda) / --color-emerald (saldado). Contraste con --accent-text donde el acento va sobre color.",
    "atajos_teclado": {
      "Esc": "Cerrar (confirma si hay cambios)",
      "Alt+G": "Guardar presupuesto",
      "Alt+N": "Agregar línea",
      "Alt+P": "Registrar pago",
      "Ctrl+Flechas": "Cambiar de pestaña"
    },
    "componentes": ["Boton disparador contextual (modo Plan)", "Panel auto-carga desde odontograma", "Tabla editable de lineas", "Cabecera contable", "Tabla Fecha/Pago/Saldo (reusa clinica_pagos)", "Ficha de atencion solo-lectura"],
    "responsive_check": "Diseñado para 360px, 768px y 1280px (pendiente verificación en runtime)."
  }
}
```
