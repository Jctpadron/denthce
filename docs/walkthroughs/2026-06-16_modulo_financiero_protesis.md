# Walkthrough: Módulo Financiero del Sistema de Prótesis (DentaLab)

## Fecha
2026-06-16

## Responsable
Orquestador (Claude)

## Resumen
Se diseñó e implementó el módulo financiero completo para el sistema de prótesis dentales DentaLab, tanto backend como frontend, siguiendo el mockup aprobado en `docs/design/mockup_financiero_protesis.html`.

## Cambios Realizados

### Backend (hce-backend)

1. **Nuevas entidades:**
   - `ProtesisPago` — registro de pagos con monto, método, comprobante, auditoría
   - `ProtesisConsumoInsumo` — consumo de insumos con cantidad, costo, lote, descuento de stock automático

2. **Campos agregados a entidades existentes:**
   - `ProtesisOrder`: `presupuestoEstimado`, `presupuestoFinal`, `fechaVencimiento`, `estadoPago`
   - `ProtesisInsumo`: `precioUnitario`

3. **SQL migration** (`scripts/create_protesis_tables.sql`):
   - Nuevas tablas: `protesis_pagos`, `protesis_consumo_insumos`
   - Nuevas columnas en tablas existentes via ALTER TABLE
   - Foreign keys + índices

4. **TypeORM registration:**
   - `ProtesisPago`, `ProtesisConsumoInsumo` registrados en `app.module.ts` y `protesis.module.ts`

5. **Nuevos DTOs:**
   - `SetPresupuestoDto`, `SetPresupuestoEstimadoDto`
   - `RegistrarPagoDto`, `RegistrarConsumoDto`
   - `UpdateInsumoDto` (incluye `precioUnitario`)

6. **Nuevos métodos de servicio:**
   - `setPresupuestoFinal()` / `setPresupuestoEstimado()` — fijar presupuestos
   - `registrarPago()` — crear pago y recalcular estado
   - `registrarConsumo()` — crear consumo + descontar stock
   - `getFinanzas()` — resumen financiero de una orden
   - `getCuentaCorriente()` — deuda agregada por clínica
   - `recalcularEstadoPago()` — pending/partial/paid/overdue automático
   - `findOrder()` — helper reutilizable de validación multi-tenant

7. **Nuevos endpoints:**
   - `PATCH /protesis/:id/presupuesto-final` (solo laboratorio-admin)
   - `PATCH /protesis/:id/presupuesto-estimado`
   - `POST /protesis/:id/pagos`
   - `POST /protesis/:id/consumos`
   - `GET /protesis/:id/finanzas`
   - `GET /protesis/finanzas/cuenta-corriente` (solo laboratorio-admin)
   - `PATCH /protesis/insumos/:id` (update general de insumo)

### Frontend (hce-frontend)

1. **DentaLabPortal.tsx** — ~430 líneas agregadas al monolito:
   - Nueva pestaña principal "Finanzas" (cuenta corriente por clínica)
   - 4 widgets financieros en Dashboard (presupuestado, cobrado, costo insumos, ganancia neta)
   - Sub-pestaña "Finanzas" en el detalle de orden (junto a Chat y Trazabilidad)
   - Presupuesto, estado de pago con barra de progreso, timeline de pagos, tabla de consumos
   - Modal "Registrar Pago" con campos: monto, método, comprobante, notas
   - Modal "Registrar Consumo" con: selector de insumo, cantidad, costo unitario (precargado), lote
   - Fetch handlers: `fetchOrderFinanzas`, `handleRegistrarPago`, `handleRegistrarConsumo`, `fetchCuentaCorriente`
   - Nuevos íconos: `DollarSign`, `TrendingUp`, `ShoppingCart`, `CreditCard`, `PiggyBank`

## Reglas de Negocio Implementadas
- Consumo de insumo descuenta automáticamente del stock
- Costo unitario se precarga del `precioUnitario` del insumo (ajustable manualmente)
- Estado de pago se recalcula automáticamente: pending → partial → paid
- Si hay fecha de vencimiento vencida y no está pago → `overdue`
- Solo `laboratorio-admin` puede fijar presupuesto final y ver cuenta corriente
- Auditoría: cada pago registra quién lo hizo (`registradoPor`)

## Archivos Modificados/Creados
| Archivo | Acción |
|---|---|
| `hce-backend/src/protesis/protesis-pago.entity.ts` | Creado |
| `hce-backend/src/protesis/protesis-consumo-insumo.entity.ts` | Creado |
| `hce-backend/src/protesis/protesis-order.entity.ts` | Modificado (campos financieros + relaciones) |
| `hce-backend/src/protesis/protesis-insumo.entity.ts` | Modificado (precioUnitario) |
| `hce-backend/src/protesis/protesis.service.ts` | Modificado (+200 líneas) |
| `hce-backend/src/protesis/protesis.controller.ts` | Modificado (+60 líneas) |
| `hce-backend/src/protesis/protesis.module.ts` | Modificado |
| `hce-backend/src/app.module.ts` | Modificado |
| `scripts/create_protesis_tables.sql` | Modificado |
| `hce-frontend/src/components/protesis/DentaLabPortal.tsx` | Modificado (+~430 líneas) |

## Estado Actual
- Backend: compila y corre sin errores (solo pre-existing test errors)
- Frontend: compila sin errores
- API testeada: presupuesto, pagos, estado automático, finanzas funcionando
- Pendiente: nada — módulo financiero completo backend + frontend
