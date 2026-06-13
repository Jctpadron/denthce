# Walkthrough — Despliegue de la Historia Clínica Odontológica a Producción en AWS

**Fecha:** 2026-05-30 · **Estado:** Completado y Desplegado en AWS · **Tarea del Tablero:** 9.10b (Despliegue a AWS).

Este documento registra los pasos técnicos ejecutados para publicar el módulo aislado de Historia Clínica Odontológica en el entorno de producción de AWS (Base de Datos RDS, Backend en Elastic Beanstalk, Frontend en S3 y CDN CloudFront).

---

## 1. Acciones de Despliegue Realizadas

### 1.1 Inicialización de la Base de Datos RDS
Se ejecutó el script de inicialización DDL de forma remota contra la instancia de base de datos RDS de producción:
* **Comando:** `node testing/scripts/create_odontology_tables.js`
* **Host RDS:** `hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com` (Puerto `5432`, Base `hce_fhir`)
* **Resultado:** Tabla `odontology_clinical_resources` creada con éxito, junto a su índice compuesto `idx_odontology_tenant_patient_type` sobre `(tenant_id, patient_id, resource_type)` para optimizar búsquedas.

### 1.2 Empaquetamiento y Despliegue del Backend
1. **Compilación:** Se compiló el backend de NestJS en TypeScript a JavaScript nativo de producción (`npm run build`).
2. **Empaquetado:** Se utilizó el script de PowerShell `.\deploy-aws.ps1 -Backend` para crear el archivo ZIP compatible con Linux y Elastic Beanstalk (`hce-backend-aws-20260530-0847.zip`).
3. **Subida a S3:** Se copió el ZIP al bucket de versiones de Beanstalk (`s3://elasticbeanstalk-us-east-1-751835847253`).
4. **Registro de Versión:** Se registró la versión de la aplicación `v-20260530-0847` en AWS Elastic Beanstalk.
5. **Actualización de Entorno:** Se actualizó el entorno de producción `Odontocloud-env` con la nueva versión del backend. La actualización finalizó de manera exitosa, quedando el entorno en estado **Ready** y **Health Green**.

### 1.3 Compilación y Despliegue del Frontend
1. **Compilación y Subida:** Se ejecutó el script de PowerShell `.\deploy-aws.ps1 -Frontend` el cual corrió la compilación de producción en Vite (`npm run build`) y sincronizó los activos al bucket de alojamiento del frontend (`s3://odontocloud-frontend-2026`).
2. **Invalidación de CDN CloudFront:** Para evitar que los navegadores sirvan copias en caché del frontend anterior (que no tendrían la tarjeta del módulo de odontología ni la descarga del PDF PAMI), se ejecutó una invalidación global en CloudFront:
   * **Distribución ID:** `E1UKXKQOWMVBOM` (para el dominio `app.systia.ar`)
   * **Ruta de invalidación:** `/*`
   * **Estado:** Solicitado y completado exitosamente.

---

## 2. Direcciones y Entornos de Producción

* **Aplicación Frontend Web:** [https://app.systia.ar](https://app.systia.ar)
* **API Gateway Backend:** [https://api.systia.ar](https://api.systia.ar)
* **Proveedor de Identidades (Keycloak):** [https://auth.systia.ar](https://auth.systia.ar)

---

## 3. Plan de Verificación en Producción

Para validar que el módulo de odontología esté 100% operativo en la nube, sigue este flujo manual desde tu navegador:

1. Accede a la URL de producción: [https://app.systia.ar](https://app.systia.ar).
2. Inicia sesión con tus credenciales de Keycloak asociadas al tenant (por ejemplo, tu usuario médico de producción).
3. Selecciona un paciente del padrón demográfico.
4. Entra a la sección de **Historia Clínica Odontológica** (identificada con el icono 🦷 en tu barra lateral/dashboard).
5. Completa y guarda registros en las distintas pestañas (Odontograma, Anamnesis, Estado Bucal, Consentimiento Informado).
6. Presiona el botón de **"Descargar PDF PAMI"** en la esquina superior y comprueba que se descargue correctamente el archivo en formato PDF de 3 páginas con tu matrícula y las firmas vectoriales correspondientes.
