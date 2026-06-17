# Walkthrough — Integración del Módulo Finanzas Clínicas en Frontend

Este walkthrough documenta los cambios realizados para conectar el módulo de Finanzas Clínicas (backend ya implementado) con el frontend React y la navegación del shell principal.

---

## Cambios Realizados

### 1. [MODIFICADO] `hce-frontend/src/App.tsx`
- **Import:** Se agregó `FinanzasClinicas` desde `./components/finanzas/FinanzasClinicas` y `DollarSign` de lucide-react.
- **Tipo** `AppView`: se añadió `'finanzas'` al union type.
- **NAV_ITEMS:** Se agregó `{ key: 'finanzas', label: 'Finanzas', Icon: DollarSign }` a la barra de navegación clínica.
- **Render:** Se agregó `{activeView === 'finanzas' && !isLaboratorio && <FinanzasClinicas />}` en el bloque de render condicional.
- **HomeScreen mapping:** Se agregó `finanzas: 'finanzas'` al mapa `views` para que la navegación desde el dashboard funcione.

### 2. [MODIFICADO] `hce-frontend/src/config/dashboard-modules.ts`
- **Tipo** `ModuleKey`: se añadió `'finanzas'` al union type.
- **Catálogo:** Se agregó entrada `Finanzas Clínicas` con icono `💰`, color `var(--color-emerald)`, badge `Nuevo`, y roles `MEDICO, ADMINISTRADOR, RECEPCIONISTA`.

### 3. [NUEVO] `hce-frontend/src/components/tabs/FinanzasTab.tsx`
Componente de pestaña para la ficha del paciente que muestra:
- 4 KPIs: Total Presupuestado, Total Pagado, Deuda Pendiente, Presupuestos Activos.
- Tabla de presupuestos del paciente con columnas: N°, Fecha, Total, Pagado, Saldo, Estado.
- Consume `GET /clinica/finanzas/cuenta-corriente/:patientId`.
- Diseño responsivo con CSS-in-JS, badges de estado y códigos de colores.

### 4. [MODIFICADO] `hce-frontend/src/components/PatientSearch.tsx`
- **Import:** Se agregó `FinanzasTab` y `DollarSign` de lucide-react.
- **Tipo** `activeTab`: se añadió `'finanzas'` al union type.
- **TABS:** Se agregó entrada `{ key: 'finanzas', label: 'Finanzas', icon: <DollarSign .../> }`.
- **Render:** Se agregó `{activeTab === 'finanzas' && <FinanzasTab patientId={selectedPatient.id} />}`.

### 5. [MODIFICADO] `hce-frontend/src/components/odontology/OdontologyHC.tsx`
Misma integración que PatientSearch:
- **Import:** `FinanzasTab` y `DollarSign`.
- **Tipo** `OdontoTab`: se añadió `'finanzas'`.
- **TABS:** Se agregó entrada `Finanzas`.
- **Render:** Se agregó render condicional.

---

## Verificación

- TypeScript compila sin errores (`npx tsc -b --noEmit`).
- Backend responde en `localhost:3000/clinica/finanzas/*` con 17 endpoints.
- Frontend con ruta `/finanzas` funcional: nav item + dashboard card + pestaña en ficha del paciente (ambas vistas: PatientSearch y OdontologyHC).

## Próximos pasos sugeridos

- Probar end-to-end con un token real de Keycloak: crear presupuesto, registrar pagos, verificar estado automático.
- Agregar tests unitarios para `FinanzasTab`.
- Validación FHIR `AuditEvent` para transiciones de estado de presupuesto.
