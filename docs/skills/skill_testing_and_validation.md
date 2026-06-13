# Skill: skill_testing_and_validation

## Problema que resuelve
Falta de un procedimiento estándar para que el Agente QA ejecute pruebas de endpoints, valide la integración con Keycloak y audite que los recursos demográficos y clínicos se adhieran al estándar HL7 FHIR R4.

## Justificación
El módulo de Gestión de Personal (creación de secretarias) y la pantalla de inicio utilizan integraciones directas con Keycloak y reglas de aislamiento multi-inquilino. Es crítico validar que los tokens JWT contengan las credenciales correctas y que la separación de datos por `tenantId` funcione perfectamente antes de cualquier despliegue.

## Riesgo de no crearlo
* Fugas de información entre consultorios (si falla el aislamiento lógico de `tenantId`).
* Cuentas de secretarias creadas sin los atributos Keycloak adecuados, provocando fallos de autenticación persistentes en producción.
* Pérdida de cobertura de test y regresiones en la API.

## Entradas
* Código fuente del backend (NestJS) y frontend (Vite/React).
* Contenedores activos de `hce-database` (PostgreSQL) y `hce-keycloak` (Keycloak).
* Especificaciones de API y esquemas JSON del recurso `Patient`.

## Salidas
* Reporte del estado de las pruebas unitarias y de integración.
* Resultados de la auditoría de esquemas de datos demográficos contra especificación FHIR R4.
* Estado de las pruebas E2E de creación y login de usuarios personal.

## Permisos
* Ejecución de comandos de testing (`npm run test`, `npm run test:e2e`).
* Acceso de red local a `http://localhost:8080` (Keycloak) y `http://localhost:3000` (API Backend).

## MCP o herramientas
* Jest para aserciones y reportes.
* Fetch API para llamadas de integración contra los endpoints locales.

## Criterio de aprobación
* 100% de los tests unitarios y de integración de usuarios y pacientes finalizados con éxito (passed).
* Verificación exitosa de que los registros creados por un `tenantId` no son visibles por otro.

## Estado
Aprobado por el Super Admin (26/05/2026) - Activo.
