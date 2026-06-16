# Walkthrough — Maquetación y Base del Módulo de Protesistas Dentales (DentaLab)

> **Estado:** Implementado y Compilado · **Fecha:** 2026-06-15
> **Autor:** Orquestador (Gemini)

Este documento registra los cambios físicos y lógicos aplicados en el repositorio para dar soporte al módulo de protesistas dentales (**DentaLab / ProtesisChat**) integrado modularmente (Opción B).

---

## 🛠️ Cambios Realizados

### 1. Backend (NestJS + TypeORM)

*   **[NEW] [protesis-order.entity.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis-order.entity.ts):** Entidad TypeORM que representa la orden de trabajo dental compatible con el recurso `DeviceRequest` de HL7 FHIR R4. Incluye soporte multi-tenant lógico dual (`tenant_id` y `performer_tenant_id`).
*   **[NEW] [protesis-chat.entity.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis-chat.entity.ts):** Entidad TypeORM que representa los mensajes de chat y adjuntos 3D, compatible con el recurso `Communication` de HL7 FHIR R4.
*   **[NEW] [protesis.service.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis.service.ts):** Servicio con la lógica de negocio para crear órdenes, listar según el tipo de tenant (clínica o laboratorio), actualizar el estado del trabajo, y gestionar la comunicación del chat.
*   **[NEW] [protesis.controller.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis.controller.ts):** Controlador expuesto bajo el endpoint `/protesis` protegido por seguridad JWT y `RolesGuard` de Keycloak.
*   **[NEW] [protesis.module.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/protesis/protesis.module.ts):** Módulo de NestJS que registra proveedores y controladores del módulo de prótesis.
*   **[MODIFY] [app.module.ts](file:///d:/APP-jct/app-historias-clinicas/hce-backend/src/app.module.ts):** Integración de `ProtesisModule` y registro de las nuevas entidades en TypeORM para sincronización automática de tablas en Postgres.

### 2. Frontend (React + Vite)

*   **[NEW] [ProtesisTab.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/ProtesisTab.tsx):** Interfaz para el odontólogo dentro de la HCE. Permite prescribir una prótesis, ver el historial del paciente, descargar adjuntos CAD/STL y chatear con el laboratorio asignado en tiempo real.
*   **[NEW] [DentaLabPortal.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/protesis/DentaLabPortal.tsx):** Portal del Protesista. Ofrece una bandeja de entrada de órdenes con buscador y filtros por estado, detalles de la prescripción, control de estados (Diseño CAD, Cerámica, etc.), descarga directa de archivos STL y panel de chat lateral.
*   **[MODIFY] [OdontologyHC.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontologyHC.tsx):** Agregada la pestaña "Prótesis / Laboratorio" (icono `Wrench`) e inyectado el renderizado de `ProtesisTab`.
*   **[MODIFY] [App.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/App.tsx):** Modificada la navegación principal. Si el usuario logueado en Keycloak posee roles de laboratorio, se oculta la HCE clínica y se le redirige automáticamente de forma exclusiva al `DentaLabPortal`.
*   **[MODIFY] [roles.ts](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/utils/roles.ts) & [useRoles.ts](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/hooks/useRoles.ts):** Agregados los roles de Keycloak `laboratorio-operador` y `laboratorio-admin` con sus respectivas banderas de verificación reactivas (`isLaboratorio`, `isLabAdmin`, etc.).

### 3. Correcciones de Calidad Realizadas (Quality Gates)

*   **[MODIFY] [OdontogramPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontogramPAMI.tsx):**
    *   Remoción de la función remanente no definida `handleAddManualPiece` que bloqueaba el build.
    *   Corrección del atributo `title` no permitido directamente en etiquetas SVG (se movió al `div` contenedor).
    *   Eliminación de propiedades CSS duplicadas (`border`) en el botón del modal de referencias (línea 835) y en el botón del drawer lateral (línea 1303) que infringían las reglas de TypeScript.

---

## 🧪 Verificación y Compilación

Ambas plataformas fueron compiladas localmente de manera satisfactoria:

1.  **Backend:** Ejecución de `npm run build` en NestJS → **COMPILADO EXITOSO** sin errores.
2.  **Frontend:** Ejecución de `npm run build` (`tsc -b && vite build`) → **COMPILADO EXITOSO** con generación correcta de assets estáticos minificados en el directorio `dist`.
