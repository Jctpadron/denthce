# Bitácora HCE: Filtros por Edad y Fecha de Ingreso en Búsqueda de Pacientes

*   **Fecha de Entrega:** 2026-05-26
*   **Agente Responsable:** Orquestador (Antigravity)
*   **Estado:** ✅ 100% Completado y Validado (Passed)

---

## ✏️ Resumen del Cambio
Se han realizado mejoras de usabilidad en el buscador de historias clínicas:
1.  **Cambio de Visualización:** Se reemplazó la visualización de la fecha de nacimiento (`Nac.: YYYY-MM-DD`) en las tarjetas del listado de pacientes por la **Edad actual calculada** del paciente (ej: `Edad: 37 años`).
2.  **Búsqueda Avanzada Mejorada:**
    *   Se eliminó el filtro de búsqueda por *Fecha de Nacimiento*.
    *   Se reemplazó por el filtro de **Edad** en años (buscando a nivel de base de datos SQL mediante funciones de cálculo de edad).
    *   Se incorporó el filtro de **Fecha de Ingreso** en la búsqueda avanzada para localizar pacientes admitidos en una fecha determinada.

---

## 🛠️ Detalles de Implementación

### 1. Backend (Filtros SQL Dinámicos)
*   **[`PatientController`](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/patient/patient.controller.ts):** Se adaptó el endpoint `@Get()` para recibir y parsear los parámetros opcionales `age` y `admissionDate`.
*   **[`PatientService`](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/patient/patient.service.ts):**
    *   **Filtro por Edad:** Se implementó una cláusula SQL nativa en TypeORM: `EXTRACT(YEAR FROM AGE(patient.birth_date)) = :age`. Esto calcula dinámicamente la edad comparando la fecha de nacimiento con la fecha actual del servidor PostgreSQL.
    *   **Filtro por Fecha de Ingreso:** Se implementó la comparación de la fecha de creación: `DATE(patient.created_at) = :admissionDate`, ignorando la zona horaria/hora para coincidir con la fecha seleccionada.

### 2. Frontend (Formulario y Tarjetas)
*   **Buscador y Tarjetas ([`PatientSearch`](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PatientSearch.tsx)):**
    *   **Tarjetas:** Se cambió el renderizado para mostrar `Edad: {calculateAge(patient.birthDate)} años` en lugar de `Nac.`.
    *   **Búsqueda Avanzada:**
        *   Se amplió la cuadrícula a 4 columnas cuando se expande el panel avanzado (`gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr'`).
        *   Se reemplazó el campo *Fecha de Nacimiento* por un campo de texto numérico para ingresar la **Edad (Años)**.
        *   Se añadió un selector de tipo fecha (`date`) para ingresar la **Fecha de Ingreso** que se desea filtrar.
        *   Se adaptó el estado interno (`ageFilter`, `admissionDateFilter`), la limpieza de filtros (`handleClearFilters`) y la lógica de debounce.

---

## 🧪 Plan de Validación Manual
1.  Ingresa a la sección **Historia Clínica**.
2.  Observa que las tarjetas de paciente muestran ahora la edad calculada en tiempo real (ej: `Edad: 24 años`) en lugar del texto `Nac.: YYYY-MM-DD`.
3.  Haz clic en **"Búsqueda Avanzada"**.
4.  Prueba ingresar una edad específica (ej: `35` o la edad de alguno de tus pacientes creados) y verifica que el listado se filtre de inmediato mostrando solo aquellos con esa edad exacta.
5.  Prueba ingresar una fecha de ingreso (ej: la fecha de hoy `26/05/2026`) y confirma que se filtren los pacientes creados en ese día.
