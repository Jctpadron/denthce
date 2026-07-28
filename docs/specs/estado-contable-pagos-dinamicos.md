# Spec funcional — Registro DINÁMICO de pagos parciales (Estado Contable)

> Modulo: Presupuesto odontologico → pestaña "Estado Contable".
> Agente: `product`. Fecha: 2026-07-28. Estado: propuesta para `architect`.
> Referencia: formulario de papel PAMI ("ESTADO CONTABLE" = libro de pagos + presentacion a Obra Social).

## 1. Problema y decision de fondo

El formulario de papel tiene DOS ejes **independientes**:

1. **Libro de pagos** (`Fecha · Concepto · Pago · Saldo`): el odontologo/recepcion anota cada
   pago parcial a medida que el paciente paga. El saldo baja solo. Sin tramite previo.
2. **Presentacion a Obra Social** (`Obra Social · Fecha Presentacion · Fecha Liquidacion`):
   eje administrativo, separado del cobro.

La implementacion actual ato el registro de pagos al ESTADO del presupuesto
(`registrarPago` exige `aceptado` | `en_curso`, ver `clinica-finanzas.service.ts:304`).
Vino del fix BUG-2 para no dejar pagos sobre un borrador que luego se descarta. Pero **choca
con el flujo real**: el odontologo no quiere "presentar/aceptar", quiere anotar el pago directo,
y hoy recibe *"el presupuesto debe estar aceptado"* y se traba.

### Decision (DEC-1): desacoplar estado ↔ pagos

- **Se puede registrar un pago apenas el presupuesto esta GUARDADO** (tiene `presupuestoId`),
  en cualquier estado **distinto de `cancelado`**. Ya no se exige `aceptado`.
- **El estado se DERIVA de los pagos**, no al reves. Al registrarse el primer pago sobre un
  presupuesto `borrador`/`presentado`/`aceptado`, el sistema lo lleva a `en_curso`
  automaticamente; cuando Σpagos ≥ total, a `pagado`. El odontologo nunca tiene que tocar el estado
  para cobrar.
- **"Presentar" y "Aceptar" NO se eliminan, pero salen del camino critico del cobro.** Quedan
  como acciones **opcionales del eje Obra Social / conformidad**, no como pre-requisito del pago.
  En la pestaña Estado Contable el odontologo cobra sin verlas.
- **Se preserva el espiritu de BUG-2** por otra via: un presupuesto **con al menos un pago no se
  puede eliminar** (regla ya existente en `deletePresupuesto`, se mantiene) y **no se puede
  cancelar sin anular antes los pagos** (regla nueva, ver CA-13). Asi el desacople no reabre el
  agujero que BUG-2 cerro.

Motivo: el eje "cobro" es puramente contable y dinamico; el eje "estado comercial/OS" es
administrativo. Atar uno al otro fue el error. El papel los tiene separados y funciona.

---

## 2. Historias de usuario

```json
{
  "historia_usuario": {
    "titulo": "Registro dinamico de pago parcial en Estado Contable",
    "como": "Recepcionista o Odontologo del consultorio",
    "quiero": "Anotar cada pago que hace el paciente (fecha, importe, concepto) directo sobre el presupuesto, sin tramite de estado previo",
    "para": "Llevar el libro de pagos como en el formulario de papel y ver el saldo bajar al instante",
    "criterios_aceptacion": [
      "Puedo cargar un pago apenas el presupuesto esta guardado, sin 'presentar' ni 'aceptar'.",
      "El formulario pide lo minimo: fecha (default hoy), importe y (opcional) concepto/nota.",
      "El saldo por fila y el saldo total se recalculan al agregar el pago.",
      "Si me equivoco puedo anular un pago, y queda auditado quien y cuando."
    ]
  }
}
```

```json
{
  "historia_usuario": {
    "titulo": "Presentacion a Obra Social (eje administrativo separado)",
    "como": "Administrador del consultorio",
    "quiero": "Registrar Obra Social, fecha de presentacion y fecha de liquidacion aparte del cobro",
    "para": "Seguir el reintegro de la OS sin que interfiera con el libro de pagos del paciente",
    "criterios_aceptacion": [
      "Los datos de presentacion a OS no bloquean ni condicionan el registro de pagos.",
      "El cobro al paciente y el reintegro de la OS se ven como dos secciones distintas."
    ]
  }
}
```

---

## 3. Criterios de aceptacion (numerados)

### Bloque A — Desacople y registro rapido (MVP, imprescindible)

- **CA-1 (MVP).** Con un presupuesto **guardado y en estado ≠ `cancelado`**, el usuario habilitado
  puede registrar un pago. **No** aparece el mensaje "debe estar aceptado".
- **CA-2 (MVP).** El formulario de pago pide como **obligatorio** solo: **importe** (`monto`) y
  **fecha** (`fechaPago`, con **default = hoy**, editable). Todo lo demas es opcional.
- **CA-3 (MVP).** **Concepto/nota libre** (campo `notas`, tipo "OS/B", "implante", "seña") es
  **opcional** y de texto libre corto; se muestra en la grilla como columna "Concepto". Reproduce
  la columna del papel. No hay lista cerrada.
- **CA-4 (MVP).** **Metodo de pago** (`metodoPago`) es **opcional** con **default "efectivo"**.
  El odontologo no debe verse obligado a elegirlo para cobrar rapido; el administrador puede
  cambiarlo. (Prioridad: minima friccion; el papel ni lo pide.)
- **CA-5 (MVP).** Al confirmar, el pago se persiste con `tipo` derivado automaticamente
  (ver DEC-2) y el modal **no** obliga a pasos extra (un solo click de confirmar).
- **CA-6 (MVP).** El estado del presupuesto se **deriva de los pagos**: primer pago con saldo > 0
  ⇒ `en_curso`; Σpagos ≥ total ⇒ `pagado`. El usuario **no** transiciona estado manualmente para
  cobrar.

### Bloque B — Saldo en vivo (MVP, imprescindible)

- **CA-7 (MVP).** La grilla muestra, por fila: **Fecha · Concepto · Pago · Saldo acumulado** (saldo
  restante despues de ese pago), ordenada por fecha ascendente (como se lee el papel).
- **CA-8 (MVP).** El **saldo total** (total presupuesto − Σpagos) se recalcula y muestra al instante
  tras agregar o anular un pago. Fuente de verdad: `GET /cuenta-corriente/:patientId` o
  `GET /pago?presupuestoId=`.
- **CA-9 (MVP).** **Sobrepago:** por defecto el saldo **no queda negativo en la vista**; se muestra
  `Saldo: 0` y una marca "Sobrepago/Credito: $X". El **backend NO bloquea** el pago que excede el
  saldo (permite registrar el excedente, contemplando el caso "el paciente pago de mas / a cuenta").
  Recomendacion administrativa: permitir el sobrepago pero **advertir** en UI antes de confirmar
  ("Este pago supera el saldo pendiente en $X. Confirmar?"). *Ver CA-16 para el borde.*

### Bloque C — Correccion / anulacion (MVP, imprescindible)

- **CA-10 (MVP).** Se puede **anular** un pago mal cargado. La anulacion **recalcula** el estado del
  presupuesto (si al anular Σpagos baja de total, el estado deja de ser `pagado`; si queda en 0,
  vuelve a `en_curso`/`aceptado` segun corresponda — ver DEC-3).
- **CA-11 (MVP).** La anulacion es **auditada**: queda registrado quien anulo (`registeredBy`/usuario),
  cuando, y el motivo (nota corta obligatoria). **Modelo recomendado: soft-delete** (marcar el pago
  como anulado, no borrarlo fisicamente) para conservar la trazabilidad del libro contable.
- **CA-12 (MVP).** **Rol para anular:** solo `administrador` (y `medico` como responsable del
  consultorio). La `recepcionista` **puede registrar** pero **no anular** (salvaguarda: quien cobra
  no revierte su propio cobro sin control). *Ver Roles, seccion 5.*

### Bloque D — Coherencia con el estado (imprescindible)

- **CA-13 (MVP).** Un presupuesto **con pagos activos no se puede cancelar**: para cancelar hay que
  anular antes los pagos. Mantiene el espiritu de BUG-2 tras el desacople.
- **CA-14 (MVP).** Un presupuesto **con pagos activos no se puede eliminar** (regla actual de
  `deletePresupuesto`, se mantiene sin cambios).

### Bloque E — Casos borde (MVP los criticos, resto deseable)

- **CA-15 (MVP).** **Sin `presupuestoId`** (presupuesto no guardado): el boton "Registrar pago" esta
  **deshabilitado** con tooltip "Guarda el presupuesto para empezar a cobrar". No se permite pago
  huerfano desde esta pestaña. (Un pago sin presupuesto sigue siendo posible por API para caja
  general, pero **no** desde Estado Contable.)
- **CA-16 (MVP).** **Importe ≤ 0:** el backend **rechaza** `monto <= 0` con 400
  ("El importe debe ser mayor a cero"). Hoy el DTO no valida esto (es una `interface` sin
  `class-validator`) ⇒ **cambio requerido** (ver seccion 4).
- **CA-17 (deseable).** **Pago que deja el presupuesto totalmente pagado:** al llegar a Σ = total el
  sistema pasa a `pagado` y la UI muestra "Saldado" con la fecha del ultimo pago.
- **CA-18 (deseable).** **Fecha futura:** advertir (no bloquear) si `fechaPago` > hoy.

### Bloque F — Cuotas (deseable / informativo)

- **CA-19 (deseable).** "Valor cuota" y "Cantidad de cuotas" son **solo informativos**:
  `valor cuota = total / cantidad de cuotas`, mostrado como referencia. **NO** se casan pagos con
  cuotas concretas (el papel las lista 23/24/25 como guia, no como conciliacion). Recomendacion:
  mantener simple — el libro de pagos es libre, las cuotas son una sugerencia visual.

---

## 4. Cambios de backend (para `architect`)

> Todo esto es handoff a `architect`; `product` no define la implementacion, solo el contrato funcional.

### Imprescindibles (MVP)

1. **Relajar `registrarPago`** (`clinica-finanzas.service.ts:304`):
   - Cambiar la guarda `estado ∈ {aceptado, en_curso}` por `estado ≠ cancelado`.
   - Mantener el check cross-tenant (presupuesto del mismo `tenantId`) — **no tocar** eso.

2. **Ajustar `recalcularEstadoPresupuesto`** (`:466`) para que **derive el estado tambien desde
   `borrador`/`presentado`**:
   - Σpagos > 0 y < total y estado ∈ {borrador, presentado, aceptado} ⇒ `en_curso`.
   - Σpagos ≥ total ⇒ `pagado`.
   - Permitir **bajar** de estado al anular (Σpagos vuelve a 0 ⇒ volver a `aceptado` si tenia
     `fechaAceptacion`, si no a `presentado`/`borrador` — DEC-3, definir con `architect`).
   - **Ojo `ESTADOS_VALIDOS`** (`:74`): hoy `borrador` solo permite `presentado`. La derivacion
     por pagos debe poder saltar `borrador → en_curso` sin pasar por `presentado`. Definir si se
     amplia la matriz o si el recalculo es una via privilegiada que no usa `transicionarEstado`.

3. **Validacion de importe** en el DTO de pago (`RegistrarPagoDto`, `:51`): hoy es una `interface`
   plana **sin `class-validator`** ⇒ convertir a clase con `@IsNumber`, `@IsPositive` (o `@Min`)
   para rechazar `monto <= 0`. Confirmar que hay `ValidationPipe` global.

4. **Endpoint de anular pago** (NO existe hoy):
   - `PATCH /clinica/finanzas/pago/:id/anular` (o `DELETE` con soft-delete). Roles: `administrador`,
     `medico`.
   - Body: `{ motivo: string }` (obligatorio).
   - Efecto: soft-delete (columna `anulado`/`deleted_at` + `motivo_anulacion` + usuario/fecha) y
     **`recalcularEstadoPresupuesto`** del presupuesto afectado.
   - Requiere migracion (columnas nuevas en `clinica_pagos`).
   - **Auditoria:** registrar la anulacion (patron `clinical_evidence_audit_log`/auditoria del
     modulo si aplica).

5. **`getPagos` / `getCuentaCorriente`** deben **excluir pagos anulados** del calculo de saldo
   (o marcarlos como anulados en la grilla, mostrados tachados pero sin sumar).

### Deseables

6. **`tipo` derivado (DEC-2):** hoy `tipo` es obligatorio en el DTO (`senha|cuota|pago_directo`).
   Para minimizar friccion, que el front no lo pida y el back lo derive: primer pago = `senha` si
   quisieran, o simplemente **default `pago_directo`** siempre. Recomendacion `product`: **default
   `pago_directo`** y no exponer el campo en la UI de cobro rapido.

7. **Bloqueo de cancelacion con pagos (CA-13):** en `transicionarEstado`, si destino = `cancelado`
   y hay pagos activos ⇒ `ForbiddenException`.

8. **Advertencia de sobrepago (CA-9):** el backend permite, el front advierte. No requiere cambio de
   backend salvo devolver el saldo resultante para que el front lo muestre.

---

## 5. Roles

- **Registrar pago:** `recepcionista`, `administrador`, `medico`. **Cambio requerido:** el endpoint
  `POST /pago` hoy es `@Roles('medico', 'administrador')` (controller `:115`) ⇒ **agregar
  `recepcionista`** (en el consultorio suele cobrar recepcion). Esta es la unica ampliacion de rol
  del pedido.
- **Anular pago:** `administrador`, `medico` (NO `recepcionista`) — salvaguarda CA-12.
- **Presentacion a OS / estado comercial:** `administrador`.

---

## 6. Resumen MVP vs Deseable

| # | Item | Prioridad |
|---|------|-----------|
| DEC-1 | Desacople estado ↔ pagos (pagar en cualquier estado ≠ cancelado) | **MVP** |
| CA-1..CA-8 | Registro rapido + saldo en vivo | **MVP** |
| CA-9 | Sobrepago: permitir + advertir (no bloquear) | **MVP** |
| CA-10..CA-12 | Anular pago con soft-delete + auditoria + rol | **MVP** |
| CA-13, CA-14 | No cancelar/eliminar con pagos activos | **MVP** |
| CA-15, CA-16 | Bordes: sin presupuestoId, importe ≤ 0 | **MVP** |
| Roles: recepcionista puede cobrar | **MVP** |
| Backend 1-5 | Relajar guarda, derivar estado, validar DTO, endpoint anular, excluir anulados | **MVP** |
| CA-17, CA-18 | Bordes secundarios (saldado, fecha futura) | Deseable |
| CA-19 | Cuotas informativas (valor cuota = total/N) | Deseable |
| DEC-2 | `tipo` derivado / oculto en UI | Deseable |

---

## 7. Quality Gate (certificacion funcional `product`)

El entregable se certifica si:
1. Un usuario `recepcionista` puede cargar un pago sobre un presupuesto recien guardado (borrador)
   sin ningun tramite de estado, y ve el saldo bajar (CA-1, CA-6, CA-8).
2. El importe 0/negativo se rechaza (CA-16) y el pago sin presupuesto guardado esta deshabilitado
   en la pestaña (CA-15).
3. Un `administrador` puede anular un pago mal cargado, el saldo se restaura y queda auditado
   (CA-10, CA-11); un `recepcionista` NO puede anular (CA-12).
4. No se puede cancelar/eliminar un presupuesto con pagos activos (CA-13, CA-14).
5. Presentar/Aceptar ya no son requisito para cobrar y no aparecen en el camino del cobro (DEC-1).

---

## 8. EXTENSION — Editabilidad del presupuesto como "documento vivo" (DEC-4)

> Agente: `product`. Fecha: 2026-07-28. Estado: propuesta para `architect`.
> Extiende DEC-1 (desacople estado↔pagos). Referencia: formulario de papel PAMI — el odontologo
> AGREGA tratamientos a la misma hoja a medida que los realiza (el total sube) mientras REGISTRA
> pagos (el saldo baja). Una sola hoja viva.

### 8.1 Problema

DEC-1 desacoplo el COBRO del estado, pero la EDICION de lineas sigue atada al estado: el guard de
`updatePresupuesto` (`clinica-finanzas.service.ts:209`) exige `estado === 'borrador'`. Como el
primer pago mueve el presupuesto a `en_curso` (DEC-1), el odontologo ya no puede seguir cargando
tratamientos: recibe *"Solo se puede editar un presupuesto en estado borrador"*. El papel PAMI no
tiene esa restriccion: se sigue escribiendo tratamientos aunque ya haya pagos anotados.

### 8.2 Decision (DEC-4): el presupuesto es editable mientras esté ABIERTO

- **Editable** (lineas / descuento / cabecera contable) mientras el presupuesto esté **ABIERTO** =
  estado ∈ **{`borrador`, `presentado`, `aceptado`, `en_curso`, `vencido`}**.
- **BLOQUEADO** para edicion de lineas solo en **`cancelado`** (documento anulado; no se resucita
  editando — se crea uno nuevo).
- **`pagado` SÍ es editable** (recomendacion): agregar un tratamiento nuevo sube el total, el
  presupuesto deja de estar 100% saldado y **vuelve por derivacion a `en_curso`** (DEC-1). Esto es
  exactamente el "documento vivo": el paciente salda un tramo, sigue el tratamiento, se agregan
  lineas y reaparece saldo. Bloquear `pagado` obligaria a crear un presupuesto nuevo por cada
  tratamiento adicional — rompe la metafora de la hoja unica.
- **Vía de recálculo:** editar lineas debe disparar la MISMA derivacion privilegiada que ya usa el
  cobro (`recalcularEstadoPresupuesto`), que no pasa por `ESTADOS_VALIDOS` y ya contempla subir y
  bajar de estado. **No se necesita ampliar la matriz `ESTADOS_VALIDOS`** (esa gobierna solo las
  transiciones MANUALES `transicionarEstado`; la edicion + recalculo es via interna, igual que el
  pago).

Motivo: coherente con DEC-1. El cobro ya deriva el estado desde los pagos; la edicion de lineas
solo cambia el `total`, y el estado correcto se re-deriva de `Σpagos vs total` sin intervencion
manual. Un solo criterio ("abierto vs terminal") gobierna ambos ejes.

### 8.3 Criterios de aceptacion (numerados, continúan la serie)

#### Bloque G — Editabilidad documento vivo

- **CA-20 (MVP).** El guard de `updatePresupuesto` cambia de `estado === 'borrador'` a
  **`estado !== 'cancelado'`**. Con el presupuesto en `borrador|presentado|aceptado|en_curso|vencido`
  el usuario habilitado puede **agregar/quitar/editar lineas** y **cambiar descuento**. En
  `cancelado` la edicion de lineas se rechaza con `403` ("No se puede editar un presupuesto
  cancelado").
- **CA-21 (MVP).** Tras editar lineas y recalcular `subtotal`/`total`, el sistema **re-deriva el
  estado desde los pagos vigentes** (mismo `recalcularEstadoPresupuesto` del cobro). Ejemplo canonico:
  presupuesto `pagado` con total 2441 y Σpagos 2441 → se agregan lineas → total 8119 →
  **vuelve a `en_curso`** con saldo 8119 − 2441 = 5678. **CA verificable end-to-end.**
- **CA-22 (MVP — caso borde: nuevo total < Σ pagado).** Si al editar el nuevo `total` queda **por
  debajo de lo ya cobrado** (Σpagos vigentes), la reduccion **se PERMITE** (no se bloquea): el saldo
  se muestra `0` y el excedente como **"Credito a favor: $X"**, reutilizando el tratamiento de
  sobrepago de CA-9. El estado derivado es `pagado` (Σpagos ≥ total). Coherente con "el paciente ya
  pago de mas respecto a lo que finalmente se le hizo". **No se anulan pagos automaticamente.**
- **CA-23 (MVP — caso borde: editar un `pagado`).** Agregar un tratamiento a un presupuesto `pagado`
  lo saca de `pagado` y lo lleva a `en_curso` (CA-21). **Es el comportamiento esperado y correcto**,
  no un error a bloquear.
- **CA-24 (MVP — integridad).** Editar lineas **NO toca los pagos**: la operacion es delete+recreate
  de `clinical_presupuesto_item`, mientras `clinical_pagos` sigue vinculado por `presupuestoId`
  (FK estable). Los pagos permanecen intactos y siguen contando en el saldo. **Confirmado seguro:**
  no hay FK de pago a item (los pagos referencian el presupuesto, no las lineas). Riesgo nulo de
  huerfanos por la edicion de lineas.
- **CA-25 (deseable — UX aviso).** Al editar un presupuesto que **ya tiene pagos vigentes**, la UI
  muestra un aviso NO bloqueante antes de guardar: *"Estas modificando un presupuesto con pagos
  registrados. El saldo se recalculara."* Sí se recomienda (transparencia contable), pero es
  **deseable**, no requisito de MVP; el backend no lo necesita.
- **CA-26 (deseable).** Si la edicion **reduce** el total por debajo de lo cobrado (CA-22), el aviso
  de CA-25 se refuerza: *"El nuevo total ($X) es menor a lo ya cobrado ($Y). Quedara un credito a
  favor de $Z."*

### 8.4 Cambio de backend (para `architect`)

**Único cambio imprescindible (MVP):**

1. **`updatePresupuesto`** (`clinica-finanzas.service.ts:209`): reemplazar la guarda
   `if (presupuesto.estado !== 'borrador')` por `if (presupuesto.estado === 'cancelado')` con el
   mensaje "No se puede editar un presupuesto cancelado".
2. **Disparar el recalculo:** tras `presupuestoRepo.save(presupuesto)` con `total` nuevo, invocar
   `recalcularEstadoPresupuesto(tenantId, id)` **si el presupuesto tiene pagos** (o siempre — es
   idempotente). Hoy `updatePresupuesto` NO llama al recalculo (solo lo hacen `registrarPago`/
   `anularPago`); **este es el hueco a cerrar** para que editar el total re-derive el estado.
3. **No** se amplia `ESTADOS_VALIDOS` ni se toca `transicionarEstado`, `registrarPago`,
   `deletePresupuesto` (siguen exigiendo `borrador` para borrar — correcto: un presupuesto con
   trabajo/pagos no se elimina, se cancela previa anulacion de pagos).
4. `deletePresupuesto` **no cambia**: sigue restringido a `borrador` — eliminar ≠ editar.

### 8.5 Resumen MVP vs Deseable (extension)

| # | Item | Prioridad |
|---|------|-----------|
| DEC-4 | Editable si estado ≠ cancelado (documento vivo) | **MVP** |
| CA-20 | Relajar guard de `updatePresupuesto` a `≠ cancelado` | **MVP** |
| CA-21 | Editar lineas re-deriva estado desde pagos (recalculo) | **MVP** |
| CA-22 | Nuevo total < Σ pagado ⇒ permitir + credito a favor | **MVP** |
| CA-23 | Editar un `pagado` lo devuelve a `en_curso` | **MVP** |
| CA-24 | Integridad: editar lineas no toca pagos | **MVP** |
| CA-25, CA-26 | Aviso UX al editar con pagos / al reducir bajo lo cobrado | Deseable |

### 8.6 Quality Gate (certificacion `product` — extension)

Se certifica si:
1. Con un presupuesto `en_curso` (ya tiene un pago), el odontologo agrega un tratamiento y el
   guard NO lo rechaza; el total sube y el saldo lo refleja (CA-20, CA-21, CA-24).
2. Editar un presupuesto `pagado` agregando una linea lo devuelve a `en_curso` con saldo positivo
   (CA-23, ejemplo 2441→8119).
3. Reducir el total por debajo de lo cobrado no se bloquea y muestra credito a favor (CA-22).
4. Los pagos previos quedan intactos y siguen vinculados tras la edicion (CA-24).
5. Un presupuesto `cancelado` NO se puede editar (CA-20, rama negativa).
