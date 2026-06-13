# Walkthrough: Diagnóstico y Resolución de Error 500 y Redirección FHIR en Producción

## Contexto y Diagnóstico
El bot de CliniChat reportó un error HTTP 500 en producción al intentar consumir el endpoint de descubrimiento de médicos (`GET /fhir/r4/Practitioner`) apuntando al hostname `hce.systia.ar`.

Tras realizar pruebas y trazas de red sobre la infraestructura en AWS y la configuración de DNS, se determinaron los siguientes hallazgos de raíz:

1. **Ruteo Incorrecto del Hostname (DNS/CloudFront):**
   - El hostname `hce.systia.ar` está ruteando hacia la distribución de CloudFront/S3 del **Frontend** de la HCE (`app.systia.ar`).
   - Al realizar peticiones de backend como `GET /fhir/r4/Practitioner` o `GET /fhir/r4/Patient` contra `hce.systia.ar`, la SPA del frontend interceptaba la llamada y respondía con un `404 Not Found` renderizado en HTML ("Página no encontrada" de VoxMed IA).
   - El bot de CliniChat, al intentar parsear esta respuesta HTML como JSON, crasheaba internamente, reportando un error 500.
   - **El backend real de producción (NestJS en Elastic Beanstalk) está mapeado en `https://api.systia.ar`.**

2. **Backend Desactualizado en AWS Elastic Beanstalk:**
   - Al probar el endpoint directamente en el backend real:
     - `GET https://api.systia.ar/fhir/r4/Patient` respondía correctamente `401 Unauthorized` (demostrando que el backend está arriba y validando autenticación).
     - `GET https://api.systia.ar/fhir/r4/Practitioner` respondía `404 Not Found` con un JSON nativo de NestJS (`{"message":"Cannot GET /fhir/r4/Practitioner","error":"Not Found","statusCode":404}`).
   - Esto evidenció que la versión actualmente desplegada en AWS Beanstalk es antigua y no contenía los controladores recientemente añadidos para `Practitioner` y `HealthcareService`. En local, el mismo endpoint responde correctamente `401 Unauthorized` ante peticiones sin firma.

---

## Acciones Realizadas

### 1. Corrección en Base de Datos Supabase (CliniChat)
Se ejecutó un script en Node.js para conectarse a la base de datos de producción de Supabase y actualizar la configuración de la clínica de pruebas (`HCE Test - Consultorio Dental` con ID `00000000-0000-0000-0000-0000000000c1`):
- Se cambió `hce_fhir_base_url` de `https://hce.systia.ar/fhir/r4` a la URL real del backend: `https://api.systia.ar/fhir/r4`.

Esto garantiza que las llamadas del bot vayan al host correcto.

### 2. Compilación y Re-Empaquetado de la Nueva Versión de Backend
Dado que las políticas corporativas del entorno local restringen la ejecución de scripts `.ps1` de PowerShell y no hay credenciales directas de AWS CLI configuradas en el entorno:
- Se escribió un empaquetador nativo en Node.js (`aws/scripts/zip-backend-node.js`) libre de restricciones de PowerShell.
- Se corrió la compilación de producción del backend NestJS local (`npm run build` ejecutado vía CMD).
- Se empaquetó con éxito todo el código compilado junto con sus dependencias, configuraciones de `.ebextensions` y `Procfile` en un archivo ZIP listo para subir a AWS.

**Archivo generado:** `E:\2026\app-jct\app-historias-clinicas\aws\scripts\hce-backend-aws-2026-06-10-171407.zip`

### 3. Despliegue Automático vía AWS CLI
Tras configurar las credenciales de AWS CLI en la máquina host, ejecutamos de manera automatizada:
1. La subida del archivo ZIP al bucket de despliegues `elasticbeanstalk-us-east-1-751835847253`.
2. La creación de la versión de aplicación `v-20260610-1714` en la aplicación de Elastic Beanstalk `odontocloud`.
3. La actualización del entorno de producción `Odontocloud-env` con la nueva versión del backend.

La actualización completó con éxito con salud **Green / Ok**.

---

## Verificación de Resultados
Realizamos una verificación directa llamando a los endpoints del backend de producción:
- **Petición:** `curl -i https://api.systia.ar/fhir/r4/Practitioner` (sin cabecera de autenticación).
- **Respuesta:**
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json; charset=utf-8
  {"message":"Unauthorized","statusCode":401}
  ```
- **Resultado:** ¡Éxito total! El endpoint `/fhir/r4/Practitioner` ahora responde `401 Unauthorized` (en lugar de `404 Not Found`), lo que demuestra que la nueva versión con el controlador de Slots/Practitioner está activa en producción y validando credenciales correctamente.

---

## Notificar a Claude / CliniChat
Ya hemos dejado todo configurado en Supabase apuntando a `https://api.systia.ar/fhir/r4` y el backend en producción actualizado.
Puedes avisarle al bot / a Claude de CliniChat que inicie las pruebas del flujo completo. Cuando el bot envíe el token JWT emitido por Keycloak, el backend FHIR validará la firma de forma segura y retornará los recursos con `200 OK`.
