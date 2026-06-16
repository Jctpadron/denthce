# Walkthrough — DentaLab Pro (Dashboard de Producción & Inventario de Insumos)

Este walkthrough documenta el desarrollo y la integración del **Dashboard de Producción (Pantalla 1)** y el **Control de Almacén e Inventario de Insumos (Pantalla 3)** en el Portal del Protesista (`DentaLabPortal.tsx`) para la gestión autónoma o integrada de laboratorios dentales.

---

## 🛠️ Cambios Realizados

### 1. Base de Datos & Backend (NestJS)

* **[NUEVA ENTIDAD] [protesis-insumo.entity.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis-insumo.entity.ts):** 
  * Tabla `protesis_insumos` en PostgreSQL.
  * Soporte multi-inquilino Zero-Trust mediante filtrado por `tenant_id`.
  * Registro de stock actual, stock mínimo de alerta, categoría y metadatos JSONB (ej: altura de bloque en mm, color VITA y lote de trazabilidad sanitaria).
* **[REGISTRO] [protesis.module.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis.module.ts):** Registro de la nueva entidad en TypeORM.forFeature.
* **[MODIFICADO] [protesis.service.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis.service.ts):**
  * Clases DTO para creación de insumos (`CreateInsumoDto`).
  * Métodos de servicio: `getInsumos(tenantId)`, `createInsumo(tenantId, dto)`, `updateStock(tenantId, insumoId, stock)`.
  * Método estadístico `getDashboardStats(tenantId)` para calcular KPIs de producción (trabajos activos, entregas de urgencia en menos de 3 días y conteo de insumos en alerta).
* **[MODIFICADO] [protesis.controller.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis.controller.ts):** Exposición de los endpoints REST correspondientes, protegidos por Guard de JWT y roles de laboratorio.

---

### 2. Frontend (React)

* **[MODIFICADO] [DentaLabPortal.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/protesis/DentaLabPortal.tsx):**
  * **Navegación por Pestañas:** Inyección de un menú superior interactivo para alternar entre **Dashboard**, **Órdenes** e **Inventario**.
  * **Pestaña Dashboard (Visual):** Muestra tarjetas KPI de estado de producción (Órdenes Activas, Entregas Urgentes, Alertas de Stock) y gráficos de progreso para balance de cargas de trabajo de técnicos y procesos del taller.
  * **Pestaña Inventario (Visual):** Tabla premium que enlista consumibles (bloques, resinas, aditamentos). Resalta en rojo translúcido las alertas cuando `stock <= minStock`.
  * **Modales de Control:** Ventanas emergentes integradas para registrar insumos y ajustar stock real en almacén.

---

## 🔍 Plan de Verificación y Pruebas Realizado

### 1. Pruebas Unitarias del Backend (Jest)
Se ejecutaron y pasaron exitosamente todas las pruebas unitarias y de integración sobre el controlador y servicio del backend (26 de 26 tests aprobados):
```bash
PASS src/protesis/protesis.controller.spec.ts
PASS src/protesis/protesis.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
```

### 2. Compilación del Frontend (TypeScript & Vite)
El build del cliente para producción compiló a la perfección sin fallos:
```bash
vite v8.0.14 building client environment for production...
dist/assets/index-CpBhDTPU.css     29.82 kB │ gzip:   6.14 kB
dist/assets/index-BQA-Xs7v.js   1,299.19 kB │ gzip: 329.15 kB
✓ built in 949ms
```

### 3. Guía de Pruebas Manuales
1. Iniciar sesión como **`protesista_juan`** (`protesista_pass_2026`) en [http://localhost:5173](http://localhost:5173).
2. Verifique la pestaña **Dashboard** (KPIs iniciales).
3. Diríjase a la pestaña **Inventario** y presione **"Registrar Insumo"** para ingresar un material de prueba (ej: stock inicial 1, minStock 2). Verifique la aparición de la tarjeta en rojo de "Stock Crítico".
4. Haga clic en **"Ajustar Stock"**, súbalo a 5, y valide que el indicador cambie dinámicamente a color verde "OK".
