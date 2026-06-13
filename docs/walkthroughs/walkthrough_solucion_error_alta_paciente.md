# Walkthrough: Solución de Error en Alta de Paciente en Producción y Layout Responsivo

Hemos identificado y solucionado exitosamente los fallos de base de datos en producción y optimizado por completo el diseño de las pantallas para que sean 100% responsivas y amigables en dispositivos móviles y celulares Android (Mobile-Safe).

## 1. Problemas de Raíz Detectados y Solucionados

### A. Tablas Faltantes en la Base de Datos de Producción (RDS)
* **Diagnóstico**: La base de datos de producción RDS (`hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com`) carecía de la tabla de auditoría `patient_audit_log`. Al intentar crear un paciente, la transacción de inserción en `fhir_patients` fallaba en cascada con un `ROLLBACK` debido al error `QueryFailedError: relation "patient_audit_log" does not exist`. Tampoco existían las tablas de encuentros (`fhir_encounters`), recetas (`fhir_medication_requests`) y recursos odontológicos (`odontology_clinical_resources`).
* **Solución**: Creamos y ejecutamos el script unificado [create_production_tables.js](file:///d:/APP-jct/app-historias-clinicas/testing/scripts/create_production_tables.js) para inicializar todas las tablas e índices faltantes de forma segura e idempotente en RDS.

### B. Error "Unauthorized" por Expiración de Token
* **Diagnóstico**: El Access Token de Keycloak expiraba tras 5 minutos de inactividad o mientras el médico completaba pausadamente el formulario de Admisión. Al no tener renovación automática, las llamadas daban 401.
* **Solución**: Modificamos [main.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/main.tsx) agregando un interceptor de solicitudes de Axios global que invoca `keycloak.updateToken(30)` antes de cada llamada HTTP, manteniendo el token siempre fresco y actualizado.

### C. Layout Rígido de la Ficha Clínica y Descompresión del Odontograma
* **Diagnóstico**: Al abrir la Ficha Clínica en pantallas móviles, las pestañas y el odontograma se veían comprimidos o no se visualizaban en lo absoluto. Esto ocurría porque la rejilla principal de [PatientSearch.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PatientSearch.tsx) forzaba un ancho rígido en línea:
  `gridTemplateColumns: '290px minmax(0, 1fr)'`
  Esto dejaba solo unos 70px de espacio útil en pantallas móviles, reduciendo a cero el odontograma y la visualización de servicios.
* **Solución**:
  * Diseñamos e inyectamos la clase responsiva `.ficha-clinica-layout` en [index.css](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/index.css), la cual se apila en **1 columna vertical en móviles** (dando el 100% de ancho de pantalla al odontograma y pestañas) y cambia a 2 columnas en pantallas grandes (`>= 1024px`).
  * Reemplazamos la rejilla rígida en `PatientSearch.tsx` para usar esta clase responsiva.
  * Modificamos el formulario de admisión [PatientForm.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PatientForm.tsx) usando rejillas responsivas (`grid-form-2col`) y botones táctiles adaptados.

### D. Cabecera Principal y Cinta de Navegación Desfasada en Celular
* **Diagnóstico**: En pantallas móviles, el menú de navegación de la cabecera en [App.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/App.tsx) se salía de la pantalla de forma desfasada. Esto pasaba porque el contenedor `<header>` forzaba de forma rígida y horizontal el Logo, las 6 pestañas de navegación y el Panel de Usuario/Salir uno al lado de la otra.
* **Solución**:
  * Rediseñamos la cabecera en `index.css` usando **Rejillas CSS Flexibles (`grid-template-areas`)**.
  * En móviles, la cabecera se organiza automáticamente en **2 filas**:
    * **Fila 1 (Superior)**: El Logo se alinea a la izquierda y el Panel del Profesional a la derecha de forma compacta (ocultando el nombre del usuario y el texto "Salir" para mostrar solo el ícono si el espacio es muy pequeño).
    * **Fila 2 (Inferior)**: La barra de navegación se convierte en una **cinta deslizable horizontalmente (carrusel)** que permite navegar suavemente arrastrando el dedo de izquierda a derecha.
  * En pantallas de PC, el diseño regresa dinámicamente a una fila horizontal clásica limpia.
  * Modificamos `App.tsx` para aplicar las nuevas clases `.app-header`, `.app-logo-container`, `.app-nav`, `.app-user-container`, `.logout-btn-text` y `.user-info-text`.

### E. Desfases de Rejilla en Buscador de Pacientes y Tarjetas en Móviles
* **Diagnóstico**: Al buscar pacientes en móviles, el layout se desbordaba horizontalmente por dos motivos:
  1. El panel de **Búsqueda Avanzada** forzaba rígidas 4 columnas de inputs en una línea horizontal (`gridTemplateColumns: showAdvanced ? '1.5fr 1fr 1fr 1.2fr' : '1fr'`).
  2. Cada **Tarjeta de Paciente** en los resultados de búsqueda forzaba horizontalmente el Avatar de usuario, el texto descriptivo largo y el botón "Ficha Clínica", empujando el diseño.
* **Solución**:
  * Creamos la clase responsiva `.grid-filters-advanced` en `index.css` para que en móviles los campos se apilen verticalmente en **1 columna** y cambien a 4 en PC.
  * Creamos la clase responsiva `.patient-card` para que en móviles la tarjeta se apile verticalmente en una sola columna con el botón de ancho completo abajo, evitando la compresión del texto y eliminando el scroll horizontal.
  * Actualizamos `PatientSearch.tsx` para incorporar estas clases de maquetación responsiva.

---

## 2. Despliegue Realizado

1. **Compilación del Frontend**: Compilamos el código en modo producción utilizando Vite y TypeScript de forma exitosa.
2. **Sincronización con S3**: Subimos los archivos estáticos generados al bucket de producción `s3://odontocloud-frontend-2026`.
3. **Invalidación de CloudFront**: Solicitamos la invalidación de la caché de CloudFront en la distribución `E1UKXKQOWMVBOM` para que el nuevo código optimizado esté inmediatamente activo para todos los usuarios médicos en `https://app.systia.ar`.

---

## 3. Estado de Tablas en Producción

Tras correr el script unificado de DDL en RDS, la estructura de tablas es:
* `clinical_audit_events`
* `fhir_clinical_resources`
* `fhir_encounters`
* `fhir_medication_requests`
* `fhir_patients`
* `odontology_clinical_resources`
* `patient_audit_log`
* `tenant_config`
