# Diseño — Módulo Finanzas Clínicas (DentHCE)

> **Estado:** PROPUESTA DE DISEÑO — pendiente de aprobación del Super Admin.
> **Autor:** Agente `architect` (con investigacion de dominio del agente `product`)
> **Fecha:** 2026-06-16
> **Basado en:** flujo real de cobro odontologico particular en Argentina.
> **Precedente:** `docs/design/mockup_financiero_protesis.html` (patron de UI replicado).
> **No cubre:** integracion con medios de pago electronicos (Mercado Pago, etc.).

---

## 0. Glosario

| Termino | Significado |
|---|---|
| **Presupuesto** | Documento que detalla el plan de tratamiento con costos, entregado al paciente. |
| **Seña** | Adelanto (30-50%) que el paciente paga al aceptar el presupuesto para iniciar el tratamiento. |
| **Cuota** | Pago parcial vinculado a una visita/evolucion, contra el saldo del presupuesto. |
| **Deuda** | Saldo pendiente del paciente = total presupuestado - total pagado. |
| **Nomenclador** | Catalogo de precios del consultorio por prestacion (SNOMED + precio). |
| **Gasto** | Egreso operativo (insumos, alquiler, sueldos, etc.). |
| **Rentabilidad** | Total cobrado - total gastos (en un periodo). |

---

## 1. Modelo de dominio

### 1.1 Entidades

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLINICAL_PRICE_LIST_ITEMS                    │
│                    (nomenclador del consultorio)                 │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid PK                                                      │
│ tenant_id: varchar NOT NULL                                      │
│ snomed_code: varchar NOT NULL   -- codigo SNOMED de prestacion   │
│ snomed_display: varchar NOT NULL -- nombre legible               │
│ precio: numeric(12,2) NOT NULL  -- precio actual                 │
│ active: boolean DEFAULT true    -- baja logica                   │
│ created_at / updated_at                                          │
│                                                                  │
│ UNIQUE (tenant_id, snomed_code, active)                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CLINICAL_PRESUPUESTOS                         │
│                    (presupuesto del paciente)                    │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid PK                                                      │
│ tenant_id: varchar NOT NULL                                      │
│ patient_id: uuid NOT NULL   -- FK logica a fhir_patients         │
│ numero: varchar NOT NULL    -- numero legible (ej. PRES-0001)    │
│ estado: varchar DEFAULT 'borrador'                               │
│   -- borrador | presentado | aceptado | en_curso | pagado |     │
│   -- cancelado | vencido                                         │
│ fecha_emision: timestamptz NOT NULL                              │
│ fecha_validez: timestamptz NULL   -- vencimiento del presupuesto │
│ fecha_aceptacion: timestamptz NULL -- cuando el paciente acepta  │
│ subtotal: numeric(12,2) NOT NULL                                 │
│ descuento: numeric(12,2) DEFAULT 0                               │
│ total: numeric(12,2) NOT NULL   -- subtotal - descuento          │
│ senha_porcentaje: numeric(5,2) DEFAULT 30  -- % de senha         │
│ senha_monto: numeric(12,2) -- calculado automaticamente          │
│ notas: text NULL                                                 │
│ created_by: varchar NOT NULL   -- preferred_username del creador │
│ created_at / updated_at                                          │
│                                                                  │
│ INDEX (tenant_id, patient_id)                                    │
│ INDEX (tenant_id, estado)                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  CLINICAL_PRESUPUESTO_ITEMS                      │
│                (lineas del presupuesto)                          │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid PK                                                      │
│ presupuesto_id: uuid NOT NULL  -- FK a clinical_presupuestos     │
│ tenant_id: varchar NOT NULL                                      │
│ snomed_code: varchar NOT NULL                                    │
│ snomed_display: varchar NOT NULL                                 │
│ diente: varchar NULL  -- ej. "16", "26", "todo"                  │
│ cara: varchar NULL    -- ej. "O", "MOD", null si no aplica       │
│ cantidad: integer DEFAULT 1                                      │
│ precio_unitario: numeric(12,2) NOT NULL  -- precio al momento    │
│ subtotal: numeric(12,2) NOT NULL  -- cantidad * precio_unitario  │
│ orden: integer DEFAULT 0          -- para mantener el orden      │
│                                                                  │
│ INDEX (presupuesto_id)                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      CLINICAL_PAGOS                              │
│                   (pagos recibidos del paciente)                 │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid PK                                                      │
│ tenant_id: varchar NOT NULL                                      │
│ patient_id: uuid NOT NULL   -- FK logica a fhir_patients         │
│ presupuesto_id: uuid NULL   -- opcional, vinculo al presupuesto  │
│ tipo: varchar NOT NULL      -- 'senha' | 'cuota' | 'pago_directo'│
│ monto: numeric(12,2) NOT NULL                                    │
│ metodo_pago: varchar NOT NULL  -- 'efectivo','transferencia',    │
│                                -- 'mercadopago','tarjeta','otro' │
│ fecha_pago: timestamptz NOT NULL                                 │
│ comprobante: varchar NULL    -- numero de comprobante o ref      │
│ notas: text NULL                                                 │
│ registered_by: varchar NOT NULL  -- quien registro el pago       │
│ created_at                                                       │
│                                                                  │
│ INDEX (tenant_id, patient_id)                                    │
│ INDEX (tenant_id, presupuesto_id)                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CLINICAL_GASTOS                               │
│                 (gastos operativos del consultorio)              │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid PK                                                      │
│ tenant_id: varchar NOT NULL                                      │
│ categoria: varchar NOT NULL -- 'insumos','alquiler','sueldos',   │
│                             -- 'servicios','equipamiento','otro' │
│ descripcion: varchar NOT NULL                                     │
│ monto: numeric(12,2) NOT NULL                                    │
│ fecha_gasto: timestamptz NOT NULL                                │
│ metodo_pago: varchar NOT NULL                                    │
│ comprobante: varchar NULL                                        │
│ insumo_id: uuid NULL   -- FK opcional a protesis_insumos         │
│                        -- (si es consumo de inventario)          │
│ registered_by: varchar NOT NULL                                  │
│ created_at                                                       │
│                                                                  │
│ INDEX (tenant_id, categoria)                                     │
│ INDEX (tenant_id, fecha_gasto)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Relaciones clave

- **Presupuesto → Paciente**: N presupuestos por paciente (historico).
- **Presupuesto → Items**: 1:N (lineas del presupuesto).
- **Presupuesto → Pagos**: 1:N (pagos contra ese presupuesto).
- **Pago → Paciente**: N pagos por paciente (pagos directos sin presupuesto tambien posibles).
- **Gasto → Tenant**: gastos del consultorio, no vinculados a paciente.

### 1.3 Diferencia clave con el modulo de Protesis

| Aspecto | Protesis (B2B) | Finanzas Clinicas (B2C) |
|---|---|---|
| Quien paga | La clinica al laboratorio | El paciente al consultorio |
| Entidad principal | `ProtesisOrder` (orden de trabajo) | `ClinicalPresupuesto` (plan de tratamiento) |
| Vinculo a visita | No aplica | Opcional: pago vinculado a `OdontologyEncounter` |
| Seña | No (presupuesto estimado ≠ seña) | Si (seña del 30-50% al aceptar) |
| Cuotas por sesion | No (pago por orden completada) | Si (cuotas contra saldo del presupuesto) |
| Gastos operativos | Consumo de insumos del lab | Gastos generales del consultorio |
| Nomenclador | Precio por insumo | Precio por prestacion SNOMED |

---

## 2. Maquina de estados del Presupuesto

```
                    ┌──────────┐
                    │ BORRADOR │
                    └────┬─────┘
                         │ presentar
                    ┌────▼──────┐
                    │ PRESENTADO│ ◄── el paciente ve el presupuesto
                    └────┬──────┘
                         │ paciente acepta (registra seña)
                    ┌────▼──────┐
                    │ ACEPTADO  │── seña registrada, tratamiento arranca
                    └────┬──────┘
                         │ primer pago de cuota
                    ┌────▼──────┐
                    │ EN_CURSO  │── pagos parciales vinculados a visitas
                    └────┬──────┘
                         ├────────────────────┐
                         │ todos los pagos    │ se cancela el tratamiento
                    ┌────▼──────┐       ┌────▼──────┐
                    │  PAGADO   │       │ CANCELADO │
                    └───────────┘       └───────────┘
                         ▲
                         │ si pasa fecha_validez sin aceptar
                    ┌────▼──────┐
                    │  VENCIDO  │
                    └───────────┘
```

**Reglas de transicion:**

| Desde | A | Condicion |
|---|---|---|
| `borrador` | `presentado` | POST /:id/presentar |
| `presentado` | `aceptado` | POST /:id/aceptar + registra primer pago (seña) |
| `presentado` | `vencido` | Automatico si fecha_validez < hoy y no fue aceptado |
| `aceptado` | `en_curso` | Se registra el primer pago de cuota (post-seña) |
| `en_curso` | `pagado` | Suma de pagos >= total del presupuesto |
| `aceptado` | `cancelado` | POST /:id/cancelar (solo si no hubo pagos) |
| `en_curso` | `cancelado` | POST /:id/cancelar (con pagos registrados, queda deuda) |

---

## 3. Reglas de negocio (automatizaciones)

### 3.1 Calculo automatico de seña
- `senha_monto = total * (senha_porcentaje / 100)`
- Se recalcula al cambiar `total` o `senha_porcentaje`.

### 3.2 Estado de pago automatico
- `saldo_pendiente = presupuesto.total - SUM(pagos.monto WHERE presupuesto_id = :id)`
- Si `saldo_pendiente <= 0` y hay seña registrada → estado `pagado`.
- Si `saldo_pendiente > 0` y hay al menos 1 cuota → estado `en_curso`.
- Si `saldo_pendiente == total` y paso fecha_validez → estado `vencido`.

### 3.3 Deuda del paciente
- `deuda_total = SUM(presupuestos.total WHERE estado IN ('aceptado','en_curso')) - SUM(pagos.monto)`
- Se calcula en tiempo real (no se persiste).

### 3.4 Rentabilidad
- `rentabilidad = SUM(pagos.monto en periodo) - SUM(gastos.monto en periodo)`
- Dashboard por periodo (dia, semana, mes, personalizado).

### 3.5 Vinculo opcional con visita
- Un `ClinicalPago.tipo = 'cuota'` puede registrar opcionalmente un `encounter_id` (FK a `OdontologyEncounterEntity`).
- Permite saber en que visita se pago que cuota.

---

## 4. Endpoints Backend

Prefijo: **`/clinica/finanzas`** (nuevo modulo independiente).

### 4.1 Nomenclador (precios por prestacion)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/clinica/finanzas/nomenclador` | Lista precios activos del tenant |
| POST | `/clinica/finanzas/nomenclador` | Crear o actualizar precio (upsert por snomed_code) |
| PATCH | `/clinica/finanzas/nomenclador/:id` | Actualizar precio |
| DELETE | `/clinica/finanzas/nomenclador/:id` | Baja logica (active=false) |

### 4.2 Presupuestos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/clinica/finanzas/presupuesto` | Lista presupuestos (filtros: paciente, estado, fecha) |
| GET | `/clinica/finanzas/presupuesto/:id` | Obtener presupuesto + items + pagos vinculados |
| POST | `/clinica/finanzas/presupuesto` | Crear presupuesto con items |
| PATCH | `/clinica/finanzas/presupuesto/:id` | Editar borrador (solo si estado=borrador) |
| POST | `/clinica/finanzas/presupuesto/:id/presentar` | Transicion a presentado |
| POST | `/clinica/finanzas/presupuesto/:id/aceptar` | Transicion a aceptado + registra seña |
| POST | `/clinica/finanzas/presupuesto/:id/cancelar` | Transicion a cancelado |
| DELETE | `/clinica/finanzas/presupuesto/:id` | Eliminar borrador (solo si estado=borrador) |

### 4.3 Pagos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/clinica/finanzas/pago` | Lista pagos (filtros: paciente, fecha, tipo) |
| POST | `/clinica/finanzas/pago` | Registrar pago (seña, cuota o pago directo) |
| GET | `/clinica/finanzas/pago/:id` | Obtener detalle del pago |

### 4.4 Gastos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/clinica/finanzas/gasto` | Lista gastos (filtros: categoria, fecha) |
| POST | `/clinica/finanzas/gasto` | Registrar gasto |
| GET | `/clinica/finanzas/gasto/:id` | Obtener detalle |

### 4.5 Dashboard / Reportes

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/clinica/finanzas/dashboard` | KPIs: cobrado hoy/mes, gastos, rentabilidad, deuda total, pacientes morosos |
| GET | `/clinica/finanzas/cuenta-corriente/:patientId` | Deuda detallada del paciente (presupuestos + pagos) |
| GET | `/clinica/finanzas/reporte?desde=&hasta=` | Reporte de caja por periodo |

---

## 5. Frontend

### 5.1 Nueva ruta y modulo

- Ruta: `/finanzas` (nueva entrada en `App.tsx` y `dashboard-modules.ts`)
- Roles: `medico`, `administrador`, `recepcionista` (solo lectura para recepcionista)

### 5.2 Vistas

```
Finanzas (pestaña principal)
├── Dashboard (widgets)
│   ├── Cobrado hoy
│   ├── Cobrado este mes
│   ├── Gastos este mes
│   ├── Rentabilidad neta
│   ├── Deuda total pacientes
│   └── Presupuestos vencidos
├── Presupuestos (tabla + filtros)
│   ├── Crear presupuesto (modal/wizard)
│   ├── Detalle del presupuesto (items + pagos vinculados)
│   └── Acciones: presentar, aceptar, cancelar
├── Pacientes (cuenta corriente)
│   ├── Buscador de paciente
│   ├── Deuda actual
│   ├── Historial de presupuestos
│   └── Historial de pagos
├── Pagos (registro + historial)
│   ├── Registrar pago (modal: seleccionar paciente, presupuesto opcional)
│   └── Tabla historica con filtros
└── Gastos
    ├── Registrar gasto (modal)
    └── Tabla historica + dashboard de egresos
```

### 5.3 Integracion con ficha del paciente

Dentro de la ficha del paciente (`PatientSearch`), agregar pestaña **"Finanzas"** que muestre:
- Deuda actual del paciente
- Presupuestos activos y historicos
- Historial de pagos
- Boton "Registrar pago" y "Nuevo presupuesto"

---

## 6. Mockup funcional

Ver `docs/design/mockup_finanzas_clinicas.html` para el mockup interactivo.

---

## 7. Calidad y seguridad

- **Auditoria:** cada transicion de estado, creacion de presupuesto, pago y gasto se audita en `AuditEvent` FHIR R4.
- **Inmutabilidad:** presupuestos `pagados` o `cancelados` no se modifican.
- **Zero Trust:** todos los endpoints filtran por `tenant_id` del JWT.
- **Validacion:** un presupuesto no puede tener items vacios; un pago no puede superar el saldo pendiente (con advertencia, no bloqueante, porque pueden ser pagos directos sin presupuesto).

---

## 8. Plan de implementacion

| Etapa | Contenido |
|---|---|
| **E1** | Entidades + migracion SQL + registro en modulo NestJS |
| **E2** | Endpoints CRUD de nomenclador y presupuestos |
| **E3** | Endpoints de pagos + calculo automatico de estado/deuda |
| **E4** | Endpoints de gastos + dashboard/reportes |
| **E5** | Frontend: ruta Finanzas + Dashboard + tablas |
| **E6** | Frontend: modales (crear presupuesto, registrar pago, registrar gasto) |
| **E7** | Frontend: pestaña Finanzas en ficha del paciente |
| **E8** | Quality Gates: tests, auditoria, validacion FHIR |
