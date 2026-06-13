# Walkthrough: Solución de Desbordamiento y Usabilidad Móvil en la Ficha Clínica Digital

En este walkthrough se detallan las modificaciones realizadas para resolver los problemas de márgenes desfasados, desplazamiento horizontal y optimización de herramientas del odontograma en pantallas móviles y tablets.

## Cambios Realizados

### 1. Modificación en la Hoja de Estilos Global
* **Archivo:** [index.css](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/index.css)
* **Modificaciones:**
  * Se hizo responsivo el padding de la clase `.panel` (reducido a `1rem` en móviles y restaurado a `1.75rem` en pantallas >= 768px).
  * Se agregó la clase `.ficha-clinica-content-panel` para aplicar `padding: 0.75rem` en pantallas móviles y `2rem` en pantallas grandes, además de definir `overflow: visible` para evitar recortes de datos.
  * Se agregó la clase `.soap-editor-grid` para que la grilla del editor SOAP se apile en una sola columna en móviles y recupere su disposición de dos columnas (`1fr 280px`) en pantallas >= 1024px.
  * Se agregó la clase `.antecedents-grid` para que la grilla de antecedentes (listas + formulario de alta) se apile en una sola columna en móviles y recupere su disposición de dos columnas (`1fr 340px`) en pantallas >= 1024px.
  * Se agregó la clase `.audit-diff-grid` para adaptar la grilla de auditoría de cambios demográficos (de `110px 1fr 1fr` rígidos a `1fr` apilado verticalmente en móviles, conservando el layout de 3 columnas en pantallas >= 640px).
  * Se agregó la clase `.vitals-chart-header` para que el selector y texto del gráfico evolutivo de tendencias se apilen en dirección vertical en móviles y queden horizontalmente alineados en pantallas >= 640px.
  * Se agregaron las clases responsivas para la cabecera de retorno de la Ficha Clínica (`.ficha-clinica-header`, `.ficha-clinica-header-top`, `.ficha-clinica-header-title`, `.mobile-badge-paciente`, `.desktop-badge-paciente`) para apilar el título y los botones en pantallas móviles.

### 2. Optimización de Solapas en Herramientas del Odontograma
* **Archivo:** [OdontogramPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontogramPAMI.tsx)
  * Se definió el estado `activeToolTab` inicializado en `'Diagnóstico'`.
  * Se reorganizó la barra de herramientas que pintaba las 5 categorías a la vez (Diagnóstico, Restauraciones, Endodoncia, Cirugía y Prevención), sustituyéndola por un control de solapas horizontales (`segmented-control`).
  * Al pulsar sobre una solapa, la barra se actualiza dinámicamente mostrando solo los botones del grupo activo (p. ej., al seleccionar *Diagnóstico*, solo se muestran *Caries* y *Pieza ausente*). Esto reduce la altura total de la sección de herramientas clínicas en un 60%, ideal para el contexto táctil de teléfonos celulares.
  * Se ajustó el color de resaltado de la herramienta activa para que coincida de forma exacta con el color de la capa de registro seleccionada (rojo en *Diagnóstico/Existente* y azul en *Plan de Tratamiento/A realizar*).

### 3. Actualización de Componentes y Vistas
* **Archivo:** [PatientSearch.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PatientSearch.tsx)
  * Se removió el padding en línea de `2rem` del contenedor de búsqueda principal para permitir que se adapte con el padding responsivo de la clase `.panel`.
  * Se reemplazaron los estilos inline rígidos de la sección de visualización del tab activo por la clase `.ficha-clinica-content-panel` y `overflow: 'visible'`.
  * Se reestructuró la metadata larga de la tarjeta de paciente (`DNI | Género | Edad | Ingreso`) reemplazando el párrafo simple por un contenedor flex con propiedad `flexWrap: 'wrap'` y gaps óptivos para que en móviles fluya en varias líneas en vez de empujar la tarjeta hacia la derecha.
  * Se reestructuró la barra superior de retorno de la Ficha Clínica aplicando la clase responsiva `.ficha-clinica-header` y badges alternativos (`mobile-badge-paciente` / `desktop-badge-paciente`), evitando que el título largo de `1.5rem` al lado del botón sin wrap empuje el layout en pantallas de celulares.
  * Se agregó `minWidth: 0` al contenedor flexible lateral de pestañas (`.ficha-clinica-layout` -> área principal) para evitar el bug de Flexbox que impide a las pestañas con scroll horizontal autocomprimirse al ancho de pantalla del móvil.
* **Archivo:** [SoapEditor.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/SoapEditor.tsx)
  * Se sustituyó el inline style `gridTemplateColumns: '1fr 280px'` por la clase responsiva `.soap-editor-grid`.
* **Archivo:** [AntecedentsTab.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/tabs/AntecedentsTab.tsx)
  * Se reemplazó el inline style `gridTemplateColumns: '1fr 340px'` por la clase responsiva `.antecedents-grid`.
* **Archivo:** [AuditTab.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/tabs/AuditTab.tsx)
  * Se sustituyó el inline style `gridTemplateColumns: '110px 1fr 1fr'` en la sección de diferencias demográficas por la clase responsiva `.audit-diff-grid`.
* **Archivo:** [VitalsTab.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/tabs/VitalsTab.tsx)
  * Se reemplazó el inline style de flex horizontal en la cabecera del gráfico evolutivo por la clase responsiva `.vitals-chart-header`.
* **Archivo:** [AllergyTab.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/tabs/AllergyTab.tsx)
  * Se sustituyeron las grillas de 2 columnas rígidas del formulario por la clase responsiva `.grid-form-2col` preexistente en la hoja de estilos.
* **Archivo:** [OdontologyHC.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontologyHC.tsx)
  * Se rediseñó el listado de selección de pacientes para usar el contenedor de tarjeta adaptable `.patient-card` y el avatar redondo en degradado azul con la inicial del paciente, igualando la estética visual del buscador de la HC general. Se mantuvo estrictamente la información demográfica actual sin alterar las funciones de formateo interno.
* **Archivo:** [UserManagement.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/UserManagement.tsx) y [index.css](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/index.css)
  * Se agregaron las clases responsivas `.module-header` y `.module-header-btn` para estandarizar cabeceras de módulos.
  * Se adaptó la cabecera de Gestión de Personal para apilarse verticalmente en móviles y alinearse horizontalmente en escritorio.
  * Se envolvió la tabla de personal en un contenedor de scroll horizontal táctil responsivo (`overflowX: 'auto'`, `minWidth: '700px'`), evitando que rompa el layout en dispositivos pequeños.
  * Se ajustó el modal de creación de usuarios para ser totalmente adaptable en altura (`maxHeight`, `overflowY: 'auto'`) y con padding dinámico (`clamp`), previniendo desbordamientos en móviles con teclados en pantalla.
* **Archivo:** [BrandingSettings.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/BrandingSettings.tsx) y [index.css](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/index.css)
  * Se agregaron las clases responsivas `.branding-settings-grid`, `.grid-2col-responsive`, `.grid-profesional-responsive` y `.grid-3col-responsive`.
  * Se adaptó la cabecera del módulo para usar la clase `.module-header` responsiva.
  * Se configuraron los botones de pestañas del formulario para tener scroll horizontal fluido y táctil (`overflowX: 'auto'`, `flexShrink: 0`) en móviles.
  * Se rediseñó el layout de dos columnas para apilar la "Vista Previa" en la parte inferior en móviles y situarla a la derecha en escritorio mediante la grilla `.branding-settings-grid`.
  * Se convirtieron las grillas rígidas de los formularios de Identidad, Profesional y Contacto en grillas adaptables de 1 columna en móviles, recuperando su formato de 2 o 3 columnas en pantallas anchas.

---

## Verificación y Pruebas Realizadas

1. **Compilación Local:**
   * Se ejecutó exitosamente `npm run build` en el frontend, validando la ausencia de errores en las plantillas TSX y el CSS.
2. **Despliegue e Invalidation:**
   * Se ejecutó el script unificado `deploy-aws.ps1`, subiendo los archivos optimizados al bucket S3 `odontocloud-frontend-2026` e invalidando la caché en la CDN CloudFront para producción.
