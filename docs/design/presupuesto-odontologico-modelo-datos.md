# Diseño de modelo de datos — Presupuesto odontológico (PAMI / OS) sobre Finanzas

> **Agente:** architect · **Fecha:** 2026-07-21 · **Estado:** Diseño aprobado para implementación
> **Task:** digitalizar el formulario de papel PRESUPUESTO + ESTADO CONTABLE odontológico.
> **Fuente UX:** `docs/design/modal-presupuesto-odontologico.md` (§9 mapeo papel→modelo, §9.4 cambios).
> **Migración:** `hce-backend/src/migrations/20260721_1500_presupuesto_odontologico_campos.sql`.
> **Decisión de negocio (Super Admin):** reusar Finanzas, NO crear tablas nuevas.

---

## 1. Resumen de la decisión

El formulario de papel del odontólogo (presupuesto + estado contable) se digitaliza **reusando
el módulo Finanzas existente**. No se crea un sistema de presupuestos paralelo: un presupuesto
armado desde la vista odontológica es el **mismo** `ClinicalPresupuesto` que ve `FinanzasClinicas.tsx`,
alimenta pagos, cuenta corriente y dashboard sin duplicar datos.

El único cambio de esquema es **aditivo**: 8 columnas nuevas, todas **nullable**, repartidas
entre la cabecera (`clinica_presupuestos`) y las líneas (`clinica_presupuesto_items`).
No se toca `clinica_pagos`.

---

## 2. Por qué reusar en vez de crear tabla nueva

| Criterio | Reusar `clinica_presupuestos` (elegido) | Tabla odontológica nueva (descartado) |
| :--- | :--- | :--- |
| **Fuente única de verdad** | Un presupuesto = un registro; pagos, deuda y dashboard ya lo consumen. | Dos fuentes de presupuesto → conciliación manual, riesgo de divergencia. |
| **Reuso de endpoints** | `POST/PATCH /clinica/finanzas/presupuesto`, `POST /pago`, cuenta corriente, transiciones de estado y numeración ya existen. | Habría que reimplementar todo el ciclo (crear, pagar, transicionar, numerar). |
| **Cuenta corriente / saldo** | `clinica_pagos` ya vincula por `presupuesto_id`; saldo = total − Σ pagos. | Otra tabla de pagos o un JOIN cruzado frágil. |
| **Deuda técnica** | Cero tablas nuevas; delta mínimo. | Duplicación estructural = deuda permanente. |
| **Costo** | 8 `ALTER TABLE ADD COLUMN` idempotentes. | Nuevas tablas + índices + migración de datos + servicios. |

Los campos que faltaban son **atributos del mismo presupuesto**, no una entidad distinta;
por definición pertenecen a la tabla existente, no a una tabla nueva.

---

## 3. Modelo actual (leído del repo)

- **`clinica_presupuestos`** (`ClinicalPresupuesto`): `id`, `tenant_id`, `patient_id`, `numero`,
  `estado` (borrador→presentado→aceptado→en_curso→pagado / cancelado / vencido), `fecha_emision`,
  `fecha_validez`, `fecha_aceptacion`, `subtotal`, `descuento`, `total`, `senha_porcentaje`,
  `senha_monto`, `notas`, `created_by`, `created_at`, `updated_at`. Relación 1:N a items y a pagos.
- **`clinica_presupuesto_items`** (`ClinicalPresupuestoItem`): `id`, `presupuesto_id`, `tenant_id`,
  `snomed_code`, `snomed_display`, `diente`, `cara`, `cantidad`, `precio_unitario`, `subtotal`, `orden`.
- **`clinica_pagos`** (`ClinicalPago`): `id`, `tenant_id`, `patient_id`, `presupuesto_id` (nullable),
  `tipo` (senha|cuota|pago_directo), `monto`, `metodo_pago`, `fecha_pago`, `comprobante`, `notas`,
  `registered_by`, `created_at`. **Sin cambios en esta migración.**

Aislamiento multi-inquilino: a nivel aplicación, por filtro `tenant_id` en el servicio (Zero Trust).
No se agregan índices porque no se crean tablas.

---

## 4. Campos nuevos

### 4.1 `clinica_presupuesto_items` (líneas)

| Columna | Tipo | Nullable | Justificación |
| :--- | :--- | :--- | :--- |
| `codigo_nomenclador` | `varchar(50)` | Sí | Código de facturación a la OS/PAMI. **Eje distinto de `snomed_code`** (terminología clínica). Ambos coexisten: SNOMED describe qué es, el nomenclador dice cómo se factura. |
| `detalle` | `varchar(255)` | Sí | Texto libre del "Detalle de tratamiento" del papel (puentes multi-pieza, "distal-oclusal", notas) que no encaja en `diente`/`cara` estructurados. |
| `source_resource_id` | `varchar(255)` | Sí | Trazabilidad al recurso FHIR planificado del odontograma que originó la línea. Evita re-importar duplicados y permite marcar el plan como "presupuestado". |

### 4.2 `clinica_presupuestos` (cabecera)

| Columna | Tipo | Nullable | Justificación |
| :--- | :--- | :--- | :--- |
| `rx_presentadas` | `int` | Sí | Conteo de radiografías presentadas a la OS (campo del papel). |
| `obra_social` | `varchar(255)` | Sí | OS a la que se presenta. v1 texto libre; futuro: FK a catálogo de OS por tenant. |
| `cantidad_cuotas` | `int` | Sí | Cuotas pactadas. Informativo: sugiere cuota = `total / cantidad_cuotas`. |
| `fecha_presentacion` | `date` | Sí | Fecha de presentación del presupuesto a la OS. |
| `fecha_liquidacion` | `date` | Sí | Fecha de liquidación/pago por la OS. |

### 4.3 Saldo — NO se persiste (confirmado)

El **saldo NO es una columna**. Es un valor **derivado**:

```
saldo = total − Σ(clinica_pagos.monto WHERE presupuesto_id = presupuesto.id)
```

Los pagos ya viven en `clinica_pagos` vinculados por `presupuesto_id`. Persistir el saldo crearía
una segunda fuente de verdad que se desincroniza en cada pago. Se calcula en front (tabla
`Fecha | Pago | Saldo`, saldo decreciente por fila) y/o en el servicio (cuenta corriente ya existente).

---

## 5. Mapeo papel → columna

### Cabecera (formulario de presupuesto / estado contable)

| Campo del papel | Columna |
| :--- | :--- |
| N° | `numero` (existente) |
| Total $ / Descuento | `total` / `descuento` (existentes) |
| Seña % / monto | `senha_porcentaje` / `senha_monto` (existentes) |
| Validez / Emisión / Estado / Notas | `fecha_validez` / `fecha_emision` / `estado` / `notas` (existentes) |
| **RX Presentadas** | `rx_presentadas` (nuevo) |
| **Obra Social** | `obra_social` (nuevo) |
| **Cantidad de cuotas** | `cantidad_cuotas` (nuevo) |
| **Fecha de Presentación** | `fecha_presentacion` (nuevo) |
| **Fecha de Liquidación** | `fecha_liquidacion` (nuevo) |

### Línea (tabla de prestaciones)

| Campo del papel | Columna |
| :--- | :--- |
| Prestación (semántica clínica) | `snomed_code` + `snomed_display` (existentes) |
| **Código Nomenclador** | `codigo_nomenclador` (nuevo) |
| Cantidad / Importe unitario / Subtotal | `cantidad` / `precio_unitario` / `subtotal` (existentes) |
| Diente / Cara | `diente` / `cara` (existentes) |
| **Detalle de tratamiento (libre)** | `detalle` (nuevo) |
| (trazabilidad al plan del odontograma) | `source_resource_id` (nuevo) |

### Pagos (Fecha / Pago / Saldo)

| Campo del papel | Origen |
| :--- | :--- |
| Fecha | `clinica_pagos.fecha_pago` (existente) |
| Pago (monto/tipo/método) | `clinica_pagos.monto` / `tipo` / `metodo_pago` (existentes) |
| **Saldo** | Calculado: `total − Σ pagos` (NO columna) |

---

## 6. Flujo de datos (auto-carga + edición manual)

1. El odontólogo pinta tratamientos en la capa **Plan** del odontograma (recursos FHIR `layer=planned`).
2. Al abrir el modal, el front lista los planificados **no volcados aún** (los que no tienen una línea
   con `source_resource_id` = su id). Sugiere precio por `snomed_code` contra el nomenclador.
3. Al "Importar seleccionados", cada tratamiento se convierte en una línea con
   `source_resource_id` seteado → no se re-importa.
4. El odontólogo edita a mano: agrega `codigo_nomenclador`, `detalle`, líneas nuevas sin origen
   en el odontograma (`source_resource_id = NULL`), ajusta precios/cantidades.
5. Guardar → `POST/PATCH /clinica/finanzas/presupuesto`. El presupuesto aparece idéntico en Finanzas.
6. Pagos → `POST /clinica/finanzas/pago` con `presupuesto_id` → suma a cuenta corriente y dashboard.

Rendimiento: las columnas nuevas son escalares livianos; no requieren índices. La consulta de
presupuesto ya trae `items` y `pagos` por relación. Ninguna es filtrable en volumen (no son
predicados de búsqueda masiva), por lo que no se justifica indexar `source_resource_id` en v1;
si a futuro se hace anti-join masivo plan↔presupuesto se evaluará un índice parcial por tenant.

---

## 7. Impacto en entidades TypeORM (aplicado)

- **`clinical-presupuesto-item.entity.ts`**: `+ codigoNomenclador` (`codigo_nomenclador`),
  `+ detalle`, `+ sourceResourceId` (`source_resource_id`). Todos `nullable: true`.
- **`clinical-presupuesto.entity.ts`**: `+ rxPresentadas` (`rx_presentadas`, int),
  `+ obraSocial` (`obra_social`), `+ cantidadCuotas` (`cantidad_cuotas`, int),
  `+ fechaPresentacion` (`fecha_presentacion`, date), `+ fechaLiquidacion` (`fecha_liquidacion`, date).
  Todos `nullable: true`.

Con `DB_SYNCHRONIZE=false`, las entidades no crean el esquema: los `@Column` sólo mapean columnas
que **la migración manual ya creó**. El SQL es la fuente de verdad; las entidades deben quedar
alineadas para que TypeORM sepa leer/escribir las columnas.

---

## 8. Impacto en endpoints / DTOs (aplicado)

No se agregan rutas nuevas. Se extienden los DTOs existentes (retro-compatibles: todo opcional):

- **`CreatePresupuestoDto`** (`clinica-finanzas.service.ts`): `+ rxPresentadas?`, `+ obraSocial?`,
  `+ cantidadCuotas?`, `+ fechaPresentacion?` (ISO `YYYY-MM-DD`), `+ fechaLiquidacion?`.
- **`CreatePresupuestoItemDto`**: `+ codigoNomenclador?`, `+ detalle?`, `+ sourceResourceId?`.

Endpoints afectados (mismos handlers, aceptan/devuelven los nuevos campos):

| Ruta | Método | Cambio |
| :--- | :--- | :--- |
| `/clinica/finanzas/presupuesto` | POST | `createPresupuesto` persiste cabecera + items con los campos nuevos. |
| `/clinica/finanzas/presupuesto/:id` | PATCH | `updatePresupuesto` actualiza cabecera contable (OS, cuotas, fechas, RX) y re-crea items con los campos nuevos. |
| `/clinica/finanzas/presupuesto[/:id]` | GET | Devuelven los nuevos campos automáticamente por la relación `items`/`pagos` (sin cambio de código). |

Roles sin cambio: `POST/PATCH` restringidos a `medico`/`administrador`; `recepcionista` sólo `GET`.
El servicio ya filtra por `tenant_id` en toda operación (Zero Trust intacto).

Nota de comportamiento existente: `updatePresupuesto` sólo permite editar en estado `borrador` y,
si viene `items`, los borra y recrea. Los nuevos campos de item viajan en ese recreado; el
`source_resource_id` debe reenviarse desde el front en cada PATCH para no perder la trazabilidad.

---

## 9. Cumplimiento del PROTOCOLO-CAMBIOS-DB (checklist)

- [x] **Aditivo y nullable** (patrón expand): 8 columnas, todas nullable, sin DEFAULT que reescriba filas.
- [x] **Idempotente**: `ADD COLUMN IF NOT EXISTS` en todas; re-ejecutable sin error.
- [x] **`SET lock_timeout = '3s'`** al inicio de la migración.
- [x] **Nombre por timestamp** `YYYYMMDD_HHMM_descripcion.sql`: `20260721_1500_presupuesto_odontologico_campos.sql`.
- [x] **Sin `DELETE` / `TRUNCATE` / `DROP`**.
- [x] **Índice de `tenant_id` sólo si se crea tabla** → acá NO se crean tablas, no se agregan índices.
- [x] **Ubicación por convención del repo**: `hce-backend/src/migrations/` (junto a las existentes,
      todas con `\c hce_fhir;`).
- [x] **`DB_SYNCHRONIZE=false`**: aplicación manual; el `.sql` es la fuente. Entidades alineadas al esquema.
- [x] **No romper multi-inquilino**: aislamiento sigue a nivel app por `tenant_id`; ningún cambio lo afecta.

---

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| Entidad TypeORM con columna que la migración no aplicó en un ambiente | TypeORM falla al leer/escribir (SELECT de columna inexistente, como pasó con `protesis_orders` en prod) | Aplicar el `.sql` en **cada** ambiente antes de desplegar el backend con las entidades nuevas. Verificar con `\d clinica_presupuestos` / `\d clinica_presupuesto_items`. |
| `source_resource_id` no reenviado en un PATCH que recrea items | Se pierde la trazabilidad al plan → riesgo de re-importar duplicados | El front debe incluir `sourceResourceId` de cada línea en el PATCH. Documentado en §8. |
| Fechas como string ISO vs `Date` | Desajuste de zona horaria en `date` | Se usan columnas `date` (sin hora) y conversión `new Date('YYYY-MM-DD')` en el servicio. |
| Presupuesto sólo editable en `borrador` | La cabecera contable (OS, fechas de liquidación) suele completarse **después** de aceptar | Pregunta abierta para producto: ¿permitir editar `obra_social`/`fecha_liquidacion`/`rx_presentadas` en estados ≥ aceptado sin re-tocar líneas clínicas? No se cambia la regla en esta entrega. |
| Nomenclador vs SNOMED cargados por separado | Líneas sin `codigo_nomenclador` | Es nullable; el importe/SNOMED siguen funcionando. Carga de nomenclador es incremental. |

---

## 11. Pendiente / preguntas abiertas para el Orquestador

1. Confirmar con `product` si la cabecera contable (`obra_social`, `fecha_presentacion`,
   `fecha_liquidacion`, `rx_presentadas`, `cantidad_cuotas`) debe poder editarse en estados
   posteriores a `borrador` (hoy `updatePresupuesto` bloquea todo lo que no sea borrador).
2. `obra_social`: mantener texto libre v1 o pasar a catálogo/FK por tenant (habilita reportes por OS).
3. Índice parcial por tenant sobre `source_resource_id` sólo si aparece un anti-join masivo
   plan↔presupuesto (no en v1).

---

## Salida (JSON para el Orquestador)

```json
{
  "diseño_arquitectura": {
    "modulo": "Presupuesto odontológico (PAMI/OS) sobre Finanzas",
    "base_datos": "PostgreSQL — reuso de clinica_presupuestos / clinica_presupuesto_items / clinica_pagos (sin tablas nuevas)",
    "modelo_orm": "TypeORM: ClinicalPresupuesto (+5 columnas) y ClinicalPresupuestoItem (+3 columnas), todas nullable",
    "migracion": "hce-backend/src/migrations/20260721_1500_presupuesto_odontologico_campos.sql",
    "saldo": "derivado (total - Σ pagos); NO se persiste",
    "endpoints": [
      { "path": "/clinica/finanzas/presupuesto", "method": "POST", "handler": "createPresupuesto", "cambio": "acepta rxPresentadas/obraSocial/cantidadCuotas/fechaPresentacion/fechaLiquidacion e items con codigoNomenclador/detalle/sourceResourceId" },
      { "path": "/clinica/finanzas/presupuesto/:id", "method": "PATCH", "handler": "updatePresupuesto", "cambio": "actualiza cabecera contable y campos de item nuevos" },
      { "path": "/clinica/finanzas/presupuesto/:id", "method": "GET", "handler": "getPresupuesto", "cambio": "devuelve los campos nuevos por relación" }
    ]
  }
}
```
