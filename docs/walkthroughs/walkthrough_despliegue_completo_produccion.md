# Walkthrough: Despliegue Completo y Exitoso en AWS (Producción)

Este documento detalla el proceso ejecutado de principio a fin para realizar el despliegue del Frontend, Backend y Keycloak en AWS, y la inyección segura de las URIs de redirección definitivas bajo el dominio seguro HTTPS de producción.

---

## 1. Despliegue del Frontend (React/Vite)
* **Acción realizada:** Se compilaron los assets estáticos de producción y se sincronizaron con el bucket S3 de AWS.
* **Comandos ejecutados automáticamente:**
  * Compilación: `tsc -b && vite build`
  * Sincronización S3: `aws s3 sync dist/ s3://odontocloud-frontend-2026 --delete`
  * Involucró invalidación en CloudFront para propagar cambios de inmediato en `app.systia.ar` (ID de Distribución: `E1UKXKQOWMVBOM`, Invalidation ID: `IEBKXCKHS3W80SAXU1MXTEHDVD`).

---

## 2. Despliegue del Backend (NestJS API)
* **Acción realizada:** Se compiló el backend con soporte para módulos odontológicos y se subió el paquete comprimido al entorno de AWS Elastic Beanstalk.
* **Detalles del empaquetado y despliegue:**
  * Compilación: `nest build`
  * Archivo generado: `aws/scripts/hce-backend-aws-20260529-0817.zip`
  * Copia a S3 de Beanstalk: `s3://elasticbeanstalk-us-east-1-751835847253/hce-backend/hce-backend-aws-20260529-0817.zip`
  * Versión en Beanstalk: `v-20260529-0817`
  * Entorno actualizado: `Odontocloud-env` (Estado actual: **Ready / Green**).

---

## 3. Despliegue de Keycloak (Identidad y Seguridad)
* **Acción realizada:** Se empaquetó la configuración de Docker Compose para AWS Beanstalk con estrictos parámetros de HTTPS (`KC_HOSTNAME_STRICT_HTTPS: "true"`, `KC_PROXY: edge`) y se actualizó el entorno.
* **Detalles:**
  * Archivo generado: `aws/scripts/hce-keycloak-aws-20260529-0819.zip`
  * Copia a S3 de Beanstalk: `s3://elasticbeanstalk-us-east-1-751835847253/keycloak/hce-keycloak-aws-20260529-0819.zip`
  * Versión en Beanstalk: `v-20260529-0819`
  * Entorno actualizado: `Odontocloud-Keycloak-env` (Estado actual: **Ready / Green**).

---

## 4. Inyección de Seguridad en Base de Datos (RDS)
Para evitar el error *Invalid redirect_uri* al usar `https://app.systia.ar`, se diseñó y ejecutó un script en Node.js para actualizar la base de datos PostgreSQL de Keycloak (`keycloak_db`) alojada en Amazon RDS:
* **Archivo de script utilizado:** `testing/scripts/update_keycloak_client.js`
* **Cambios inyectados directamente en base de datos:**
  * Se borraron las URIs de redirección anteriores y se inyectaron los Redirect URIs válidos seguros:
    * `https://app.systia.ar/*`
    * `http://localhost:5173/*`
  * Se borraron los orígenes web anteriores y se inyectaron los Web Origins válidos:
    * `https://app.systia.ar`
    * `http://localhost:5173`

---

## Verificación Final
* La infraestructura de AWS se encuentra completamente desplegada y saludable (**Green**).
* Los dominios están enlazados con terminación HTTPS a través de CloudFront:
  * Aplicación: `https://app.systia.ar`
  * Servicios API: `https://api.systia.ar`
  * Autenticación: `https://auth.systia.ar`
* La aplicación se encuentra lista para pruebas de inicio de sesión de extremo a extremo sin errores de redirección ni de contexto inseguro (Web Crypto API activa).
