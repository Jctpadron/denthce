# Skill: security_audit

## Problema que resuelve
Identificar vulnerabilidades de seguridad, fugas de credenciales o fallos de cumplimiento regulatorio (HIPAA/GDPR) en el código desarrollado por los agentes de IA antes de integrarse al repositorio principal.

## Justificación
La HCE maneja datos de salud extremadamente confidenciales. Cada componente debe ser auditado de forma automática bajo políticas Zero Trust para bloquear endpoints sin autorización JWT, detectar configuraciones TLS mutuas inseguras y evitar inyecciones de datos.

## Riesgo de no crearlo
Vulneración potencial de ePHI por configuraciones inseguras, accesos clínicos no auditados (ausencia de AuditEvent) o credenciales expuestas en repositorios.

## Entradas
* Código fuente en el directorio de desarrollo `src/`.
* Manifiestos de configuración de Keycloak y Kubernetes.

## Salidas
* Reporte de vulnerabilidades de seguridad y cumplimiento normativo en `docs/design/validation_report.json`.

## Permisos
* Lectura: Todo el directorio `src/` e infraestructura.
* Escritura: Carpeta `docs/design/` para reportes.

## MCP o herramientas
* `MCP-Security` (leer logs de red, auditar dependencias y escanear secretos).

## Criterio de aprobación
* Reporte con 0 vulnerabilidades críticas/altas detectadas y verificación exitosa de cobertura de logs de auditoría clínica.

## Estado
* Aprobado
