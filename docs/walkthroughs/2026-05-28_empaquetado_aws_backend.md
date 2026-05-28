# Empaquetado y Configuración del Backend para AWS

**Fecha:** 28 de Mayo de 2026
**Módulo:** Infraestructura (Despliegue AWS Backend)

## Resumen de Cambios
Se completó la configuración del Backend de NestJS para que pueda conectarse de forma segura a una base de datos Amazon RDS y se generó el paquete listo para el despliegue en Elastic Beanstalk.

### Modificaciones en el Código:
- [x] **Soporte SSL dinámico:** Se modificó `hce-backend/src/app.module.ts` para que TypeORM reconozca y requiera el cifrado SSL si la variable de entorno `DB_SSL` es verdadera (`true`). Esto es un requerimiento obligatorio de Amazon RDS para conexiones seguras.

### Empaquetado:
- [x] **Generación de artefacto:** Se ejecutó con éxito el script `deploy-aws.ps1 -Backend`.
- **Resultado:** Se generó el archivo `hce-backend-aws.zip` en la ruta `aws\scripts\hce-backend-aws.zip`.

> [!IMPORTANT]
> **Pasos para desplegar en AWS Elastic Beanstalk:**
> 1. Inicia sesión en tu consola de AWS y ve a **Elastic Beanstalk**.
> 2. Sube el archivo `aws\scripts\hce-backend-aws.zip` creado en este paso.
> 3. Dirígete a la configuración de "Variables de Entorno" en Elastic Beanstalk y añade:
>    - `DB_HOST`: El endpoint de tu RDS.
>    - `DB_PORT`: `5432`
>    - `DB_USER`: `hce_admin`
>    - `DB_PASSWORD`: Tu contraseña de la base de datos.
>    - `DB_NAME`: `hce_fhir`
>    - `DB_SSL`: `true`

---
El entorno local queda listo para continuar el desarrollo clínico, mientras el equipo de DevOps ya cuenta con el artefacto para liberar la versión inicial en la nube.
