# Spec UX — Pestaña "Estado Contable": carga rápida de pagos (DentHCE)

> **Agente:** UX/HCE · **Fecha:** 2026-07-28 · **Estado:** Propuesta de rediseño (no implementada)
> **Alcance:** interacción + estructura visual de la pestaña "Estado contable" del `PresupuestoOdontologicoModal.tsx`. NO incluye código de producción.
> **Fuente de verdad de diseño:** skill `design-system` (tokens/componentes/white-label/accesibilidad/responsive). Usa exclusivamente tokens ya presentes en el repo (`--color-primary`, `--color-emerald`, `--color-rose`, `--color-amber`, `--color-muted`, `--color-text`, `--bg-surface`, `--bg-card`, `--border-color`, `--shadow-sm`, `--font-title`) y patrones inline ya usados en el modal (`inputStyle`, `labelStyle`, `headerCellStyle`, `MONEY`, `btnGhost`).
> **Supersede parcialmente:** la sección "Estado contable" de `docs/design/modal-presupuesto-odontologico.md` en lo relativo a jerarquía y bloqueo de pagos. El resto de ese doc sigue vigente.
> **Coordinación pendiente:** ver §8 (campos del pago) — a confirmar con el agente `product`.

---

## 1. Problema (estado actual)

La pestaña "Estado contable" hoy muestra, en este orden:

1. Cabecera administrativa: Cantidad de cuotas · Obra social · Fecha presentación · Fecha liquidación (4 inputs arriba de todo).
2. Cards: Total · Pagado · Saldo · Valor cuota.
3. Estado + botón **Presentar** / **Aceptar** / **Cancelar**.
4. "Pagos registrados: sin pagos".
5. El bloque **Registrar pago** solo aparece si `PUEDE_PAGAR(estado)` (estado `aceptado` o `en_curso`); si no, muestra: *"Para registrar pagos, el presupuesto debe estar aceptado."*

**Fricción diagnosticada:**

- Lo administrativo (cuotas/OS/fechas) compite visualmente con lo que el odontólogo hace 20 veces por semana: **anotar un pago**.
- El registro de pago está **enterrado abajo** y, peor, **bloqueado** detrás de un flujo de estados (presentar → aceptar) que en el sillón nadie quiere hacer. En el papel PAMI se escribe la línea `Fecha | Pago | Saldo` sin pedir permiso a nadie.
- El saldo, que es LA información que importa, aparece como una card más entre otras cuatro del mismo tamaño.

**Meta:** anotar un pago en **2-3 toques** con el **saldo bajando al instante**, replicando la grilla de papel. La grilla + la fila de carga rápida son el CENTRO de la pestaña.

---

## 2. Principio rector del rediseño

> La pestaña "Estado contable" es una **planilla de pagos**, no un formulario de trámite. El dinero manda; el trámite (presentar/liquidar a la OS) es secundario y colapsable.

Tres decisiones:

1. **Invertir la jerarquía:** Saldo grande arriba → grilla de pagos + fila de carga rápida (protagonista) → administrativo colapsado abajo.
2. **Desbloquear el pago:** registrar un pago NO exige "aceptar" el presupuesto primero. Ver §7 (coordinación con architect sobre el gate de estado).
3. **Fila siempre visible:** la fila de carga rápida está SIEMPRE presente y lista (fecha = hoy, foco en Importe), como el renglón en blanco del papel esperando que escribas.

---

## 3. Jerarquía nueva (orden vertical de la pestaña)

```
┌─ ESTADO CONTABLE ─────────────────────────────────────────┐
│                                                            │
│  A. RESUMEN ECONÓMICO (banda superior)                     │
│     Total ·  Pagado ·  [ SALDO — grande, protagonista ]    │
│                                                            │
│  B. PAGOS (protagonista)                                   │
│     ── Fila de carga rápida (siempre visible) ──           │
│     [ Fecha=hoy ] [ Importe* ] [ Concepto ] [ + Agregar ]  │
│     ── Grilla de pagos ──                                   │
│     Fecha · Importe · Concepto · Saldo · (anular)          │
│                                                            │
│  C. DATOS ADMINISTRATIVOS  ▸ (colapsable, cerrado)         │
│     Cuotas · Obra Social · F. presentación · F. liquidación│
│     Estado del presupuesto + Presentar/Aceptar             │
└────────────────────────────────────────────────────────────┘
```

Sin presupuesto guardado todavía, ver §6 (estado "sin presupuesto").

---

## 4. Bloque A — Resumen económico (banda superior)

Reemplaza la grilla de 4 cards iguales por una **banda de 3 celdas con el Saldo destacado**.

### Desktop (≥768px)
Fila con `display:flex; gap:0.75rem; flex-wrap:wrap`. Las dos primeras celdas (Total, Pagado) son chicas; la tercera (Saldo) ocupa más y crece.

```
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐
│ TOTAL        │ │ PAGADO       │ │ SALDO                         │
│ $120.000,00  │ │ $ 45.000,00  │ │  $ 75.000,00                  │
│              │ │  (emerald)   │ │  (rose si >0 / emerald si =0) │
└──────────────┘ └──────────────┘ └──────────────────────────────┘
        (chicas, 1fr)                    (destacada, ~1.6fr)
```

- **Saldo:** celda destacada. `flex: 1.6`, borde `2px solid` del color del saldo (`--color-rose` si `saldo > 0`, `--color-emerald` si `saldo <= 0`), fondo `color-mix(in srgb, <colorSaldo> 8%, var(--bg-surface))`, número `font-size: clamp(1.6rem, 5vw, 2rem)`, `font-weight: 800`.
- **Total / Pagado:** celdas normales (`--bg-card`, borde `1px --border-color`), número `1rem`. Pagado en `--color-emerald`.
- Cuando `saldo <= 0`: además del color emerald, mostrar micro-badge con ícono `CheckCircle` + texto "Saldado" (el color NUNCA es el único indicador — checklist a11y §6 del design-system).
- **Valor cuota** deja de ser una card de primer nivel: pasa como línea informativa chica bajo el Saldo ("Cuota sugerida: $X × N") SOLO si hay `cantidadCuotas`. No compite.

### Mobile (<768px)
Las tres celdas se apilan. El Saldo va **primero** y a ancho completo (es lo que el odontólogo quiere ver al abrir):

```
┌──────────────────────────────┐
│ SALDO            $ 75.000,00  │  ← primero, full width, grande
├───────────────┬──────────────┤
│ TOTAL 120.000 │ PAGADO 45.000│  ← dos chicas lado a lado
└───────────────┴──────────────┘
```

---

## 5. Bloque B — Pagos (protagonista)

### 5.1 Fila de carga rápida (siempre visible)

Es el corazón del rediseño: un renglón en blanco permanente, como el papel. Va **arriba de la grilla** (no abajo), pegado al resumen, para que sea lo primero que se toca.

**Layout desktop** — una sola fila, alineada a `end`:

```
┌ Registrar pago ───────────────────────────────────────────────────┐
│ Fecha          Importe *        Concepto (opcional)      [        ]│
│ [ 28/07/2026 ] [ $ ________ ]   [ OS/B, implante… ]      [+ Agregar]│
└───────────────────────────────────────────────────────────────────┘
```

- Contenedor: `border:1px solid var(--border-color); border-radius:12px; padding:0.85rem; background:var(--bg-card)` (idéntico al bloque "Registrar pago" actual, reutiliza estilo).
- Título chico "Registrar pago" (`0.78rem`, `800`, `--color-text`).
- Grid: `grid-template-columns: 130px 1fr 1.4fr auto; gap:0.6rem; align-items:end`. En pantallas medias usa `repeat(auto-fit, minmax(130px,1fr))` como ya hace hoy, para no romper.
- **Fecha:** `type="date"`, **default = hoy** (hoy queda vacío → default hoy es un cambio de comportamiento a implementar).
- **Importe:** `type="number" min=0 step=0.01`, es el ÚNICO obligatorio. Placeholder `$`. **Recibe foco automático** al entrar a la pestaña y después de cada alta.
- **Concepto:** input de texto libre corto (mapea a `tipo`/nota; ver §8), opcional. Placeholder con ejemplos del papel: `"OS/B, implante, seña…"`.
- **[+ Agregar]:** botón primario (`--color-primary`, texto blanco, `font-weight:800`, ícono `Plus`), `min-height:44px` (objetivo táctil, checklist a11y). Deshabilitado mientras `pagoSaving` (texto "Registrando…").

**Comportamiento de teclado:**
- **Enter** en el campo Importe (o Concepto) = dispara "Agregar" (igual que tocar el botón).
- Tras agregar: se limpia Importe y Concepto, la Fecha vuelve a hoy, y el **foco vuelve a Importe** para cargar el siguiente pago sin tocar el mouse. Esto habilita cargar 3 cuotas seguidas tecleando `monto ⏎ monto ⏎ monto ⏎`.

**Layout mobile** — se apila en tarjeta, campos a ancho completo, botón full-width abajo:

```
┌ Registrar pago ──────────────┐
│ Importe *                    │  ← primero en mobile (lo más usado)
│ [ $ __________________ ]     │
│ Fecha                        │
│ [ 28/07/2026 ]               │
│ Concepto (opcional)          │
│ [ OS/B, implante…        ]   │
│ [      + Agregar pago      ] │  ← full width, min 48px alto
└──────────────────────────────┘
```

En mobile el orden de campos se invierte respecto a desktop: **Importe primero** (es lo que casi siempre se toca), luego Fecha, luego Concepto.

### 5.2 Grilla de pagos (`Fecha · Importe · Concepto · Saldo`)

Debajo de la fila de carga. Ordenada cronológica ascendente (como el papel), con **saldo decreciente fila por fila** — la lógica ya existe (`filas` con `saldoTras`).

**Encabezado desktop** (`headerCellStyle`, reutilizado):

```
FECHA        IMPORTE      CONCEPTO         SALDO        ·
28/07/2026   $ 30.000,00  Seña            $ 90.000,00   ⊘
04/08/2026   $ 30.000,00  OS/B            $ 60.000,00   ⊘
…
```

- Grid: `grid-template-columns: 0.9fr 1fr 1.2fr 1fr auto; gap:0.6rem`. Filas con zebra (`i % 2 ? var(--bg-card) : transparent`), `border-radius:8px`, `font-size:0.82rem`.
- **Importe:** alineado a la derecha, `font-weight:700`, `--color-text`.
- **Concepto:** `--color-muted`; si vacío, `—`.
- **Saldo (tras el pago):** alineado a la derecha. `--color-muted` normal; `--color-emerald` cuando la fila lleva el saldo a `<= 0`.
- **Columna anular:** botón discreto ícono `Trash2` (o `Ban`/`XCircle`), `--color-muted` en reposo, `--color-rose` en `:hover`/`:active`, `aria-label="Anular pago del DD/MM por $X"`. Ver §5.3.

**Mobile:** cada pago es una tarjeta apilada (patrón idéntico a las líneas del presupuesto en mobile):

```
┌──────────────────────────────┐
│ $ 30.000,00          [ ⊘ ]   │  ← importe protagonista + anular
│ 28/07/2026 · Seña            │  ← fecha · concepto (muted)
│ Saldo tras el pago: $90.000  │  ← saldo de la fila
└──────────────────────────────┘
```

Botón anular ≥ 44×44px, separado del contenido.

### 5.3 Anular un pago

- Al tocar el botón anular → **confirmación** (no borrado directo). Usar un diálogo de confirmación inline/modal chico coherente con el resto (ej. `window.confirm` es aceptable como MVP, o mejor un mini-popover con "Anular pago de $X del DD/MM — [Anular] [Volver]").
- Texto: *"¿Anular este pago de $30.000,00 del 28/07? El saldo volverá a subir."*
- Al confirmar: la fila desaparece, el **saldo sube al instante**, y las filas siguientes recalculan su `saldoTras`. Feedback: micro-mensaje "Pago anulado" (`--color-muted`, se desvanece).
- **Nota de dominio:** "anular" no es lo mismo que "borrar físico" si el pago ya tiene valor contable/auditoría. Confirmar con `product`/`architect` si es soft-delete o reversa. Visualmente, para el odontólogo, es "sacar la línea mal cargada".

---

## 6. Bloque C — Datos administrativos (colapsable, secundario)

Todo lo administrativo se agrupa en UN acordeón **cerrado por defecto**, al fondo de la pestaña, para que NO compita con la carga de pagos.

```
▸ Datos administrativos y obra social            (fila clickeable)
```

Al expandir (`▾`):

```
▾ Datos administrativos y obra social
  ┌──────────────┬──────────────┬───────────────┬───────────────┐
  │ Cuotas       │ Obra Social  │ F. presentación│ F. liquidación│
  │ [ 3 ]        │ [ PAMI    ]  │ [ __/__/__ ]  │ [ __/__/__ ]  │
  └──────────────┴──────────────┴───────────────┴───────────────┘

  Estado del presupuesto:  [ Borrador ]  [ Presentar ]  [ Aceptar ]
```

- Cabecera del acordeón: fila con ícono chevron (`ChevronRight`/`ChevronDown` de lucide), título `0.85rem 700`, `role="button"`, `aria-expanded`, controlable por teclado (Enter/Espacio), `aria-controls` al panel.
- Grid interno: `repeat(auto-fit, minmax(180px, 1fr))` (el mismo de hoy) → colapsa a 1 columna en mobile.
- El bloque **Estado + Presentar/Aceptar/Cancelar** vive DENTRO de este acordeón. Deja de ser un prerequisito visible para pagar. Sigue disponible para quien haga el trámite a la OS, pero no estorba.
- **Señal, no bloqueo:** si el presupuesto está en `borrador` y se registra un pago, mostrar un aviso NO bloqueante junto al acordeón (o al confirmar el primer pago): badge `--color-amber` + ícono `AlertTriangle` "Presupuesto en borrador — recordá presentarlo a la OS cuando corresponda". Es informativo, no impide cargar.

---

## 7. Desbloqueo del pago — dependencia con architect/product

**Hoy** el frontend bloquea con `PUEDE_PAGAR(estado)` y el backend replica la regla (según el walkthrough del 2026-07-27, `registrarPago` valida estado `aceptado`/`en_curso`). Para cumplir "pagar en 2-3 toques sin trámite previo" hay que decidir, junto a `architect`/`product`, UNA de estas vías:

| Opción | Qué implica | Recomendación UX |
| :--- | :--- | :--- |
| **7.A — Auto-transición** | Al registrar el primer pago sobre un `borrador`/`presentado`, el backend lo pasa solo a `aceptado`/`en_curso` (un pago ES la aceptación de hecho). El odontólogo no ve el trámite. | **Recomendada.** Cero fricción, coherente con el papel, mantiene la integridad de estados que pide architect. |
| **7.B — Ampliar el gate** | Permitir pagos también en `borrador`. | Más simple, pero deja presupuestos "borrador con pagos", que architect marcó como incoherente. Evitar salvo que product lo apruebe. |

**Postura UX:** preferimos **7.A**. La pestaña no debe mostrar "aceptá primero"; el sistema acepta implícitamente al recibir plata. El control manual de estado queda en el acordeón administrativo para casos de trámite formal a la OS.

> ⚠️ Esta decisión NO es de UX en soledad: requiere OK de `architect` (integridad de la máquina de estados) y `product` (¿un pago implica aceptación contable?). Elevar al Orquestador antes de codear.

---

## 8. Campos de un pago — coordinación con `product`

El backend ya persiste por pago: `monto`, `fechaPago`, `tipo` (`senha`/`cuota`/`pago_directo`), `metodoPago` (efectivo/transferencia/débito/crédito/mercadopago), `comprobante`.

**Tensión UX:** la fila de carga rápida debe ser mínima (Fecha · Importe · Concepto) para lograr los 2-3 toques. Pero hoy hay 2 selects más (Tipo, Medio). Propuesta a validar con `product`:

- **Mínimo obligatorio en la fila rápida:** solo **Importe** (Fecha tiene default hoy).
- **Concepto** (texto libre corto) mapea a lo que product defina: podría ser una nota, o pre-cargar `tipo` por palabras clave ("seña" → `tipo=senha`). A definir.
- **Tipo y Medio:** sacarlos de la fila rápida a un **"⚙ Más opciones"** plegable dentro de la propia fila (para quien necesite registrar el medio de pago), con defaults sensatos (`tipo=cuota`, `metodoPago=efectivo`) que cubren el caso común sin tocarlos. Así el 90% de las cargas son Importe + Enter, y el detalle contable sigue disponible.

**Pregunta abierta para `product`:** ¿el "Concepto" del papel (OS/B, implante) es puramente descriptivo (nota) o debe mapear a `tipo`/`comprobante`? De eso depende si "Concepto" es texto libre o un mapeo. **Bloqueante para la implementación final de la fila.**

---

## 9. Flujo "agregar un pago" — paso a paso

**Camino feliz (desktop, teclado):**

1. El odontólogo entra a la pestaña "Estado contable". Ve el **Saldo** grande arriba y la fila de carga con el **foco ya en Importe**.
2. Teclea `30000`.
3. Presiona **Enter**.
4. Al instante: aparece la fila `28/07/2026 · $30.000,00 · — · $90.000,00` en la grilla; el **Saldo baja** de $120.000 a $90.000 (con micro-animación de resalte, respetando `prefers-reduced-motion`); Importe se limpia; **foco vuelve a Importe**.
5. (Opcional) Teclea el siguiente pago y Enter de nuevo. Sin tocar el mouse.

**Total: 2 toques** (escribir importe + Enter). Con concepto: 3 (importe, Tab/click a concepto, Enter).

**Camino táctil (tablet en el sillón):**

1. Toca el campo Importe → teclado numérico (`inputmode="decimal"`).
2. Escribe el monto.
3. Toca **[+ Agregar]**.
4. El saldo baja, la fila aparece, el campo se limpia para el próximo.

**Errores:**
- Importe vacío o ≤ 0 → borde `--color-rose` en Importe + mensaje inline `AlertCircle` "Ingresá un importe mayor a 0." (reutiliza `contableMsg`). No se agrega fila. El foco permanece en Importe.
- Fallo de red → mensaje `--color-rose` "No se pudo registrar el pago." + el botón vuelve a estar activo para reintentar. El importe tecleado NO se pierde.
- Pago que excede el saldo → NO bloquear (puede haber sobrepago/ajuste), pero avisar suave: badge `--color-amber` "Este pago supera el saldo ($X a favor)". Confirmar política con `product`.

---

## 10. Estados de la pestaña

| Estado | Qué se muestra |
| :--- | :--- |
| **Cargando** | Skeleton en la banda de resumen (3 celdas gris claro) + skeleton de 2 filas en la grilla. Nunca salto en blanco (design-system §5). |
| **Sin presupuesto guardado** | La banda de resumen muestra el Total local (calculado de las líneas) con Saldo = Total. En lugar de la fila de carga: aviso `--bg-card` con borde punteado "Guardá el presupuesto (pestaña **Presupuesto**) para registrar pagos y ver el saldo." + botón que lleva a la pestaña Presupuesto. (Mantiene el gate real: no hay `presupuestoId` → no hay dónde colgar el pago.) |
| **Presupuesto guardado, sin pagos** | Resumen con Saldo = Total. Fila de carga **activa y con foco**. Grilla vacía con mensaje positivo: "Todavía no registraste pagos. Cargá el primero arriba 👆" (emoji `aria-hidden`). |
| **Con pagos** | Resumen actualizado, grilla poblada con saldo decreciente, fila de carga lista para el siguiente. |
| **Saldado (saldo ≤ 0)** | Celda Saldo en emerald + badge "Saldado ✓". La fila de carga sigue disponible (por ajustes/notas de crédito), pero el estado comunica "listo". |
| **Error de carga del resumen** | Se muestra el total local sin pagos + aviso discreto "No pudimos traer los pagos guardados. Reintentá." (no rompe el resto de la pestaña — design-system §5). |

---

## 11. Accesibilidad (WCAG 2.1 AA — Quality Gate design-system §6)

- Cada input de la fila rápida con `<label>` asociado (visible en mobile; `sr-only` en desktop si el encabezado hace de etiqueta), usando el patrón `srOnly` ya definido en el componente.
- La **fila de carga** dentro de `<section aria-labelledby>` con título "Registrar pago"; la **grilla** en otra `<section>` con "Pagos registrados".
- **Foco visible** por teclado (global `:focus-visible`). El foco automático a Importe al entrar/tras alta debe anunciarse suave (no robar foco si el usuario ya está tipeando en otro lado).
- Feedback del alta con `aria-live="polite"` en una región que anuncie "Pago de $30.000 registrado, nuevo saldo $90.000" para lectores de pantalla (el cambio visual del saldo no alcanza).
- Botón anular con `aria-label` explícito (importe + fecha), no solo el ícono. Confirmación accesible por teclado (Esc = cancelar, Enter = confirmar en el diálogo).
- Objetivos táctiles ≥ 44×44px con ≥ 8px de separación (botón Agregar, botón anular).
- El color del Saldo (rose/emerald) **acompañado** de texto/ícono, nunca color solo (badge "Saldado" / "Pendiente").
- El acordeón administrativo: `role="button"` + `aria-expanded` + `aria-controls`, operable con Enter/Espacio.
- Contraste: números grandes del saldo sobre fondo tenue ≥ 3:1 (texto grande); labels muted ≥ 4.5:1 (ya OK con `--color-muted`).

---

## 12. Responsive (regla innegociable — Quality Gate design-system §7)

- **Mobile-first**, verificado en **360 / 768 / 1280 px**.
- Sin scroll horizontal: `box-sizing:border-box` (global) + `width:100%` + `minWidth:0` en celdas de grid (ya usado en el componente).
- **Resumen:** flex-wrap en desktop; en mobile Saldo full-width primero, Total/Pagado en 2 columnas debajo.
- **Fila de carga:** `repeat(auto-fit, minmax(130px,1fr))` en desktop; apilada full-width en mobile, con Importe primero.
- **Grilla de pagos:** grid con columnas en desktop; **tarjetas apiladas** en mobile (usa `useIsMobile()` ya presente, patrón idéntico a las líneas del presupuesto).
- **Acordeón administrativo:** grid `minmax(180px,1fr)` → 1 columna en mobile.
- Sin alto fijo que recorte texto: números del saldo con `clamp()`.
- Hover del botón anular solo bajo `@media (hover:hover)`; en táctil usar `:active`.

---

## 13. Coherencia con el modal (reutilización, no reinvención)

- Reutiliza `inputStyle`, `labelStyle`, `headerCellStyle`, `srOnly`, `btnGhost`, `MONEY` ya definidos en `PresupuestoOdontologicoModal.tsx`.
- El bloque "Registrar pago" mantiene el contenedor `border + bg-card + radius:12px` que ya existe; solo cambia su posición (sube, arriba de la grilla) y su contenido (fila mínima + "más opciones").
- Botón Agregar = mismo estilo que el "Registrar" actual (`--color-primary`, blanco, `800`).
- Iconografía `lucide-react`: `Plus` (agregar), `Trash2`/`Ban` (anular), `ChevronDown`/`ChevronRight` (acordeón), `CheckCircle` (saldado), `AlertTriangle` (aviso borrador/sobrepago), `AlertCircle` (error).
- Cero hex hardcodeado nuevo; todo por token.

---

## 14. Resumen de cambios respecto al actual (para el implementador)

1. **Reordenar** el render de `tab === 'contable'`: Resumen → Pagos (fila + grilla) → acordeón administrativo. Hoy es al revés.
2. **Saldo destacado** (celda grande) en vez de 4 cards iguales.
3. **Fila de carga arriba** de la grilla, siempre visible, con **Fecha default hoy**, **foco automático en Importe**, **Enter para agregar**, y **re-foco tras alta**.
4. **Concepto** como campo nuevo en la fila (mapeo a definir con product); Tipo/Medio a "Más opciones" plegable con defaults.
5. **Columna Concepto + botón anular** en la grilla (con confirmación).
6. **Colapsar** cuotas/OS/fechas/estado en un acordeón cerrado; sacar "Presentar/Aceptar" del camino visible del pago.
7. **Desbloquear** el pago vía auto-transición (§7.A) — coordinar con architect/product antes de implementar.
8. `aria-live` para anunciar el nuevo saldo; estados vacío/carga/error según §10.

---

## Salida (especificación UX)

```json
{
  "interfaz_usuario": {
    "pantalla": "Presupuesto odontológico — pestaña Estado Contable (carga rápida de pagos)",
    "disposicion": "Vertical: Resumen económico (Saldo grande) → Pagos (fila de carga rápida siempre visible + grilla con saldo decreciente) → Datos administrativos colapsables. Grilla en desktop; tarjetas apiladas en mobile (<768px).",
    "colores": "Tema claro DentHCE. Saldo en --color-rose (pendiente) / --color-emerald (saldado); Pagado en emerald; acentos por --color-primary del tenant.",
    "atajos_teclado": { "Enter": "Agregar el pago en foco y limpiar para el siguiente", "Tab": "Importe → Concepto → Agregar", "Esc": "Cancelar confirmación de anulación" },
    "componentes": ["Banda resumen (Total/Pagado/Saldo)", "Fila de carga rápida (Fecha/Importe/Concepto/Agregar)", "Grilla de pagos (Fecha/Importe/Concepto/Saldo/Anular)", "Acordeón administrativo (Cuotas/OS/Fechas/Estado)"],
    "responsive_check": "Verificado en 360px, 768px y 1280px (a validar en runtime tras implementación).",
    "dependencias": ["architect+product: desbloqueo del pago (auto-transición §7)", "product: campos de un pago y semántica de 'Concepto' §8"]
  }
}
```
