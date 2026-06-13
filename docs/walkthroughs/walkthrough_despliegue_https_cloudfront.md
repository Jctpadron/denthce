# Despliegue de HTTPS End-to-End con CloudFront y ACM

Este documento resume las acciones realizadas para resolver los problemas de seguridad detectados en el entorno de producción y la habilitación de HTTPS real para la Historia Clínica Electrónica.

## Problemas Originales Resueltos
1. **Bloqueo de Web Crypto API (`crypto.subtle`)**: Solucionado. Al pasar el frontend a HTTPS, el navegador vuelve a habilitar esta API, permitiendo usar `pkceMethod: 'S256'` en Keycloak sin errores.
2. **Vulnerabilidad XSS en Cookies**: Solucionado. Con HTTPS, las cookies de sesión (como los tokens JWT de Keycloak) se emiten con el atributo `Secure`, impidiendo que sean leídas por scripts maliciosos o interceptadas en la red.

## Infraestructura AWS Creada

Se configuró una arquitectura de proxy reverso basada en **Amazon CloudFront**, con un certificado SSL emitido por **AWS Certificate Manager (ACM)** para el dominio `*.systia.ar`.

### 1. Certificado SSL
* Se emitió y validó un certificado comodín para `*.systia.ar` y `systia.ar`.

### 2. Distribuciones CloudFront
Se crearon tres distribuciones independientes que actúan como terminadores TLS frente a nuestros recursos HTTP actuales:
* **Frontend (app.systia.ar)**: Apunta al bucket S3 `odontocloud-frontend-2026`. Fuerza redirección HTTPS y optimiza la caché de assets estáticos de Vite.
* **Keycloak (auth.systia.ar)**: Apunta al entorno Elastic Beanstalk de Keycloak. Configurado para pasar todos los headers, cookies y query strings (esencial para OAuth2) con caché deshabilitada (TTL=0).
* **Backend API (api.systia.ar)**: Apunta al entorno Elastic Beanstalk del backend NestJS. Configurado sin caché y permitiendo el paso del header de autorización.

## Cambios en el Código

### Frontend (React/Vite)
* **[MODIFIED]** `src/main.tsx`: Se restauró `pkceMethod: 'S256'` en la inicialización de Keycloak, dado que ahora ejecutamos en un contexto seguro (HTTPS).
* **[MODIFIED]** `.env.production`: Se actualizaron las variables de entorno para usar las nuevas URLs de producción definitivas:
  * `VITE_API_URL=https://api.systia.ar`
  * `VITE_KEYCLOAK_URL=https://auth.systia.ar`

### Backend y Keycloak
* **[MODIFIED]** `aws/keycloak/docker-compose.yml`: Se actualizó para usar el nuevo dominio de CloudFront (`KEYCLOAK_CF_DOMAIN`) y se reactivó `KC_HOSTNAME_STRICT_HTTPS: "true"`. Al recibir tráfico vía CloudFront, Keycloak detecta automáticamente `X-Forwarded-Proto: https` por el `KC_PROXY: edge`.
* **[MODIFIED]** `aws/keycloak/hce-realm.json`: Se configuró `sslRequired: "external"` y se agregaron las URLs seguras `https://app.systia.ar` a `webOrigins` y `redirectUris`.

> [!NOTE]
> Por solicitud explícita, **no se aplicaron cambios a la base de datos de producción (RDS)**. El entorno Elastic Beanstalk de Keycloak se actualizó con sus nuevas variables de entorno, pero el esquema de la base de datos no fue limpiado. Si Keycloak experimenta problemas con los `redirectUris` (error de *Invalid redirect_uri*), será necesario actualizar el cliente `hce-app` en la base de datos, ya sea vía el panel de administración de Keycloak, o reimportando el realm modificado.

## Script de Despliegue Extendido
* **[MODIFIED]** `aws/scripts/deploy-aws.ps1`:
  * Se agregó soporte para invalidación automática de la caché de CloudFront al finalizar el despliegue del frontend, usando la variable de entorno `$env:CF_FRONTEND_ID`.
  * Se incluyeron rutinas para empaquetar Keycloak independientemente (`-Keycloak`).
  * Se incluyeron las instrucciones para crear automáticamente las distribuciones en CloudFront (`-CloudFront`).
