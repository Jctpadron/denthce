> ⚠️ **DOCUMENTO SUPERSEDIDO (2026-06-15).**
> Esta versión quedó **desalineada** con el sistema actual (apunta a `LandingLogin`, a la HC general con `tabs/`/SOAP/Receta hoy **ocultas del menú**, y mantiene el encuadre "65 años" que fue **descartado**).
> **Documento canónico vigente:** [`docs/qa/auditoria_responsividad_movil.md`](../qa/auditoria_responsividad_movil.md) (v2, realineada: login Keycloak temático, HC Odontológica como hub + Imágenes/documentos, Home nuevo, landing pública; + capa de automatización axe/Lighthouse/BrowserStack y gate de release).
> **No usar este archivo para auditar.** Se conserva solo como referencia histórica.

---

# Auditoría Integral de Responsividad, Usabilidad y Accesibilidad Móvil (Android) – HCE

## Objetivo

Actúa como un Auditor Senior de Calidad (QA), UX Clínico y Accesibilidad Digital especializado en sistemas sanitarios de alta disponibilidad.

Tu misión es realizar una auditoría End-to-End (E2E) completa de la Historia Clínica Electrónica (HCE) desde la perspectiva de un profesional de la salud (médicos, odontólogos, enfermeros y personal administrativo) utilizando un teléfono móvil Android moderno en contextos de movilidad asistencial.

Debes identificar y documentar:

* Problemas de responsividad y adaptabilidad de layouts.
* Errores visuales, de maquetación y alineación.
* Desbordamientos de texto o contenedores (overflow).
* Controles interactivos inaccesibles o de tamaño inadecuado.
* Problemas de usabilidad táctil y flujos de trabajo lentos.
* Defectos de accesibilidad digital bajo los estándares WCAG 2.1 AA (especialmente para operadores de más de 65 años).
* Riesgos clínicos derivados de interfaces confusas (ej. ocultamiento involuntario de alertas o fármacos).
* Inconsistencias de interfaz y diseño entre pantallas.
* Elementos que provoquen desgaste cognitivo o fatiga clínica ( burnouts de HCE).

---

# Configuración Inicial

## Dispositivo Simulado

Configurar el emulador de Chrome DevTools con el siguiente Viewport de referencia (Android moderno):

* **Ancho (Width):** 390 px
* **Alto (Height):** 844 px
* **DPR (Device Pixel Ratio):** 3
* **Touch (Entrada Táctil):** Enabled
* **User Agent:** Android Chrome

Adicionalmente, verificar la interfaz en los siguientes puntos de quiebre para asegurar el diseño responsivo obligatorio (mobile-safe):

* **Pantallas compactas:** 360x640 px (Android legacy)
* **Pantallas grandes:** 412x915 px (Android Max/Plus)
* **Orientación horizontal:** Landscape 844x390 px (para validación de gráficos y odontograma)

---

# Criterios de Evaluación

Cada pantalla y componente del sistema deberá evaluarse bajo la siguiente matriz de control:

## 📐 Layout y Maquetación
* **Desbordamientos horizontales:** Comprobar la ausencia de barra de scroll horizontal en la página base.
* **Scroll horizontal involuntario:** Confirmar que no existan desfases en contenedores internos.
* **Elementos cortados:** Verificar que los textos largos se ajusten elásticamente y los botones no queden truncados.
* **Superposición de componentes:** Asegurar que los inputs, labels e iconos no se encimen.
* **Modales fuera del viewport:** Validar que los diálogos flotantes se centren y se auto-ajusten al ancho de la pantalla móvil con scroll interno independiente.
* **Tablas de datos:** Confirmar el comportamiento responsivo (scroll controlado mediante envoltura de tabla o conversión a tarjetas móviles).

## 👆 Interacción Táctil y Ergonomía
* **Área táctil mínima:** Garantizar un tamaño mínimo de interacción de 44x44 px en todos los botones, checkbox, radios y enlaces.
* **Separación ergonómica:** Mantener suficiente margen entre controles interactivos contiguos para evitar clics accidentales.
* **Entrada de datos:** Validar que al hacer clic en inputs numéricos se despliegue el teclado numérico (`inputMode="numeric"`) o de fecha nativo en Android.
* **Dropdowns y Selects:** Asegurar la facilidad de apertura y selección de opciones con el pulgar.

## ♿ Accesibilidad (WCAG 2.1 AA)
* **Contraste de color:** Verificar contraste suficiente (mínimo 4.5:1 para texto normal) entre el texto (ej. `.search-input::placeholder` o `.user-info-text`) y el fondo.
* **Tamaño mínimo de fuente:** Respetar la base de legibilidad (`html { font-size: 17px }` e inputs con un mínimo de `13.5px` reales) diseñada para profesionales seniors.
* **Estados de Foco (Focus-Visible):** Confirmar que el foco sea claramente distinguible al navegar con interfaces de accesibilidad o atajos.
* **Etiquetas de formulario (Labels):** Validar que todo input tenga su etiqueta HTML correspondiente asociada mediante `htmlFor` e ID único para lectores de pantalla.

## ⚡ Rendimiento Percibido y Feedback Visual
* **CLS (Cumulative Layout Shift):** Monitorear y eliminar saltos bruscos en el contenido durante la carga de catálogos o llamadas a APIs.
* **Estados de Carga:** Confirmar la presencia de indicadores de carga (spinners de carga en botones o esqueletos de texto) durante las peticiones asíncronas de guardado.
* **Bloqueos de Interfaz:** Verificar que el botón de envío se deshabilite tras hacer clic para evitar peticiones duplicadas.

## 🛡️ Seguridad Clínica y Legalidad
* **Auditoría Inmutable:** Comprobar que en ninguna pantalla móvil se expongan controles de borrado físico destructivo para registros clínicos consolidados (ej. evoluciones SOAP), de acuerdo con las normativas legales de HCE.
* **Acciones Críticas:** Confirmar la presencia de advertencias explícitas o flujos de doble confirmación antes de firmar recetas o registrar alergias severas.
* **Información Completa:** Evitar que datos de dosis o advertencias de interacción fármaco-alergias queden truncados con elipsis (`...`) ilegibles para el médico.

---

# Flujo E2E Obligatorio y Mapeo de Componentes

## 1. Login y Acceso de Identidad
* **Componente Frontend:** [LandingLogin.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/LandingLogin.tsx) e integración con [keycloak-config.ts](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/utils/keycloak-config.ts)
* **URL de Acceso:** `https://app.systia.ar`
* **Credenciales de Prueba:** Usuario: `doctor_julio` / Contraseña: `dorctor_pass_2026`
* **Acciones de Auditoría:**
  1. Acceder al portal y comprobar que la caja de login y los logotipos de la clínica se centren vertical y horizontalmente.
  2. Introducir credenciales y comprobar el comportamiento del teclado virtual Android.
  3. Desconectar temporalmente el servicio Keycloak localmente o emular error de red para validar el mensaje responsivo: *"No se pudo establecer conexión con el servidor de identidad Keycloak..."*.
  4. Iniciar sesión correctamente y capturar el tiempo de redirección.

---

## 2. Dashboard y Consola de Mando
* **Componente Frontend:** [HomeScreen.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/HomeScreen.tsx) e [index.css: L359-455](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/index.css#L359-L455)
* **Acciones de Auditoría:**
  1. Verificar que en pantallas de menos de 1024px de ancho, el menú superior horizontal colapse por completo en el botón hamburguesa (`.app-burger`).
  2. Desplegar el drawer menú (`.app-drawer`) y verificar que todos los enlaces (Admisión, Búsqueda, Configuración) queden perfectamente alineados y sin solaparse con el contenido principal.
  3. Comprobar que las tarjetas de resumen clínico (KPIs y widgets) fluyan en una sola columna vertical sin desbordes.
  4. Verificar que el texto de bienvenida e información del usuario logueado (`.user-info-text`) no se rompa ni empuje el botón de cerrar sesión.

---

## 3. Formulario de Admisión de Paciente (Alta)
* **Componente Frontend:** [PatientForm.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PatientForm.tsx) y estilos en [index.css: L295-342](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/index.css#L295-L342)
* **Acciones de Auditoría:**
  1. Ingresar a la sección "Admisión de Paciente".
  2. Validar que la cuadrícula `.grid-form-2col` colapse correctamente a una única columna vertical en móviles.
  3. Ingresar un DNI de prueba (ej. `38450123`) y presionar el botón "SISA". Confirmar la consulta al servicio `/api/sisa/verificar`, la respuesta simulada y que el toast de éxito se despliegue y autocomplete los campos (Nombre, Apellido, Nacimiento, Sexo) sin descuadrar el formulario.
  4. Desplegar el selector de Género y validar que el dropdown sea nativo de Android o fácilmente operable con scroll táctil.
  5. Desplegar la sección de Cobertura de Salud y pulsar "Agregar cobertura".
  6. Escribir en el input de búsqueda de Obra Social, verificar que el `datalist` con la lista de obras sociales se despliegue correctamente sobre el teclado virtual de Android.
  7. Agregar número de afiliado, plan y presionar "Guardar cobertura". Comprobar la adición a la lista de coberturas activas y la visualización del botón de eliminar (`Trash2`).
  8. Enviar el formulario y capturar la alerta de registro exitoso en formato compatible con FHIR Patient.

---

## 4. Búsqueda Universal y Selección de Paciente
* **Componente Frontend:** [PatientSearch.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PatientSearch.tsx)
* **Acciones de Auditoría:**
  1. Escribir el apellido o DNI del paciente creado en el campo de búsqueda universal.
  2. Validar la velocidad de filtrado dinámico.
  3. Desplegar los filtros avanzados (`.grid-filters-advanced`) y comprobar que el formulario de filtros se adapte en vertical.
  4. Comprobar que las tarjetas de resultados de pacientes (`.patient-card`) distribuyan la información del paciente de forma vertical en móviles y en fila en desktops.
  5. Hacer clic en "Ver Ficha" y verificar la carga instantánea de la ficha clínica del paciente.

---

## 5. Navegación Clínica por Pestañas
* **Componente Frontend:** Contenedor en `PatientSearch.tsx` y subcomponentes en [components/tabs/](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/tabs/)
* **Acciones de Auditoría:**
  1. Verificar que la barra segmentada de pestañas (`.segmented-control`) permita el desplazamiento horizontal táctil (swipe) de forma nativa en pantallas pequeñas.
  2. Confirmar que las máscaras degradadas de CSS (`mask-image` en `index.css`) indiquen visualmente que hay más pestañas a los lados.
  3. Comprobar que la pestaña activa posea la clase `.active`, cambiando el color de texto a azul y aplicando sombra sutil.
  4. Navegar entre las pestañas "Alergias", "Signos Vitales", "Documentos", "Antecedentes", y "Ficha Odontológica" validando que el estado interno no se pierda al alternar secciones.

---

## 6. Ficha Odontológica y Odontograma Interactivo (PAMI)
* **Componente Frontend:** [OdontogramPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontogramPAMI.tsx) y estilos en [odontogram.css](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/odontogram.css)
* **Acciones de Auditoría:**
  1. Acceder a la pestaña "Ficha Odontológica".
  2. Verificar que las arcadas superior e inferior del odontograma en formato SVG se auto-escalen al ancho de la pantalla móvil sin romperse ni desbordarse.
  3. Confirmar que el selector de dentadura (Adulto, Infantil, Mixto) se calcule automáticamente en base a la edad del paciente.
  4. Seleccionar la solapa de categoría "Diagnóstico" y la herramienta "Caries".
  5. Hacer clic en una de las caras específicas (V, D, L, M, O) de un diente en el odontograma. Comprobar la precisión táctil de la selección de caras en pantallas móviles pequeñas.
  6. Confirmar que la cara seleccionada se rellene de color ROJO (Modo Diagnóstico/Existente) tras la confirmación de la petición POST del recurso clínico.
  7. Cambiar la capa del alternador a "Plan de Tratamiento" (planned) y seleccionar la categoría "Restauraciones" -> "Restauración de Resina".
  8. Hacer clic en otra cara dental y verificar que se rellene de color AZUL (Modo Plan de Tratamiento).
  9. Comprobar que al rotar el dispositivo Android a vista horizontal (Landscape), el SVG y los paneles de herramientas se reorganicen fluidamente sin superponerse.

---

## 7. Formulario de Anamnesis Dinámico
* **Componente Frontend:** [AnamnesisPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/AnamnesisPAMI.tsx)
* **Acciones de Auditoría:**
  1. Navegar a la pestaña "Anamnesis".
  2. Validar que la cuadrícula de preguntas y los selectores "Sí" / "No" mantengan suficiente espacio táctil para evitar clics accidentales.
  3. Marcar la opción "Sí" en la pregunta *"¿Sufre alguna enfermedad?"* y verificar la aparición inmediata del campo de texto dinámico para detallar la patología.
  4. Comprobar el reflow del formulario para asegurar que la expansión de inputs dinámicos no empuje los botones de opción fuera de los límites de la pantalla.
  5. Completar los campos de entrada de texto ("Motivo de consulta", "Cepillados por día") y validar que no causen scroll horizontal involuntario.

---

## 8. Firma Digital Táctil del Paciente
* **Componente Frontend:** Canvas de Firma en `AnamnesisPAMI.tsx` (L240-258)
* **Acciones de Auditoría:**
  1. Desplazarse al panel "Firma del paciente".
  2. Realizar un trazo de firma continuo sobre el canvas utilizando el dedo o puntero.
  3. Confirmar que la propiedad `touch-action: none` en los estilos del canvas evite con éxito que el navegador haga scroll vertical en la página mientras se está dibujando.
  4. Validar que la firma sea fluida y no presente retraso (lag) perceptible en teléfonos de gama media.
  5. Presionar el botón "Limpiar firma" y validar que borre los trazos y restaure el estado del canvas.
  6. Presionar "Guardar anamnesis" y verificar que la firma se codifique en base64 (PNG) y se guarde de forma persistente en la extensión FHIR de la respuesta.

---

## 9. Estado Bucal, Diagnóstico y Plan de Tratamiento
* **Componente Frontend:** [OralStatusPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OralStatusPAMI.tsx)
* **Acciones de Auditoría:**
  1. Navegar a la sección de registro de Diagnóstico y Plan.
  2. Completar los campos requeridos (Diagnóstico, Tratamiento, Pieza dental) y guardarlos.
  3. Localizar el registro recién guardado en la lista y presionar el botón "Editar".
  4. Modificar la descripción del diagnóstico o plan y re-guardarlo.
  5. Confirmar que los cambios se reflejen de inmediato en la interfaz móvil.
  6. Validar que el componente **no muestre ningún botón de eliminación total (borrado físico)** en la vista de evoluciones/historial, cumpliendo con la inmutabilidad legal e inalterabilidad de los registros médicos de salud.

---

## 10. Evoluciones y SOAP Clínico
* **Componente Frontend:** [SoapEditor.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/SoapEditor.tsx) y [EvolutionPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/EvolutionPAMI.tsx)
* **Acciones de Auditoría:**
  1. Abrir la pantalla de evolución SOAP (Subjetivo, Objetivo, Apreciación, Plan).
  2. Validar que los textareas de cada sección se adapten al 100% del ancho del dispositivo móvil.
  3. Completar las notas de evolución y guardarlas.
  4. Comprobar que el historial cronológico de evoluciones se organice con un diseño de línea de tiempo responsivo y legible.
  5. Asegurar que las firmas de los profesionales de la salud vinculadas a las evoluciones se muestren legibles y no sufran distorsión de escala.

---

## 11. Receta Electrónica y Autocompletado del Vademécum
* **Componente Frontend:** [PrescriptionForm.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/PrescriptionForm.tsx)
* **Acciones de Auditoría:**
  1. Abrir el formulario de creación de recetas.
  2. Escribir un fármaco en la barra de búsqueda del Vademécum (ej. "Amoxicilina").
  3. Verificar que el dropdown de autocompletado flote correctamente por encima del resto del formulario y teclado móvil, sin truncar los nombres comerciales ni las monodrogas.
  4. Validar que al seleccionar el fármaco, se completen los parámetros posológicos por defecto.
  5. Confirmar que los campos de Dosis, Frecuencia y Duración se adapten de forma responsiva en móviles colapsando a una columna vertical para evitar el apiñamiento.
  6. Comprobar que el área de "Indicaciones al Paciente" (posología detallada) sea de tamaño táctil cómodo y escalable.

---

## 12. Alertas Clínicas CDS Hooks
* **Componente Frontend:** Panel de alertas en `PrescriptionForm.tsx` (L317-339)
* **Acciones de Auditoría:**
  1. Forzar una alerta clínica (ej. seleccionar un medicamento al que el paciente es alérgico o interactúa con sus antecedentes de HTA).
  2. Comprobar que el panel de alertas de seguridad de CDS Hooks se despliegue dinámicamente con color de fondo rosado/rojo de advertencia y un icono de alerta claro (`ShieldAlert`).
  3. Validar que todo el texto de advertencia sea completamente legible, sin truncamientos de texto.
  4. Verificar que se bloquee el botón de firma e inmutable si la interacción fármaco-alergia es severa e irreversible según la configuración del sistema.

---

## 13. Gestión de Documentos Clínicos y Adjuntos
* **Componente Frontend:** [DocumentsTab.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/tabs/DocumentsTab.tsx) e integración con el backend.
* **Acciones de Auditoría:**
  1. Navegar a la pestaña "Documentos".
  2. Presionar el botón de selección de archivos. Confirmar que en Android despliegue la cámara del dispositivo móvil o el selector de archivos del sistema.
  3. Subir un archivo de prueba (ej. una foto o PDF de hasta 20 MB).
  4. Validar que se muestre un indicador de progreso de carga y que la miniatura de previsualización en la galería se ajuste correctamente al ancho de la rejilla móvil.
  5. Abrir la visualización modal del documento y confirmar que el modal o galería permita hacer scroll interno para ver el documento ampliado.

---

# Checklist Técnico Específico de Responsividad

| Componente UI | Criterio de Aceptación (Mobile-Safe) | Estado (P / C / NC) |
| :--- | :--- | :--- |
| **Menú y Navegación** | Menú inline oculto en móviles. El drawer lateral abre y cierra sin desplazar ni tapar el header base. | |
| **Formularios Demográficos** | Una sola columna en viewports menores a 768px. Los inputs y checkboxes tienen labels legibles asociados. | |
| **Odontograma SVG** | SVG responsivo, escalado elástico del mapa dental y precisión táctil en el clickeo de caras (V, D, L, M, O). | |
| **Firma Canvas** | Dibujo continuo con PointerEvents sin retraso (lag). El canvas bloquea el scroll de fondo de página (`touch-action: none`). | |
| **Tablas de Historial** | Scroll horizontal interno encapsulado sin estirar el layout base. Headers siempre visibles. | |
| **Diálogos Modales** | Modales centrados con un ancho máximo del 92% del viewport móvil y scroll de contenido interno. | |
| **Mensajes y Toasts** | Mensajes de éxito o alerta de CDS Hooks visibles, de contraste accesible y que no obstruyan botones de confirmación. | |
| **Inputs Auxiliares** | Inputs dinámicos flexibles (`flex: 1 1 auto`) en lugar de anchos fijos en pixeles (`width: 180px`). | |

*(Estado: P = Pendiente, C = Conforme, NC = No Conforme)*

---

# Evidencia Obligatoria y Estructura de Reporte

Para cada hallazgo o fallo de visualización responsivo detectado, el auditor clínico deberá registrar los siguientes campos:

1. **Identificador de Pantalla:** (ej. Admisión, Odontograma, Receta).
2. **Componente Específico:** (ej. Botón de firma, Selector de Dosis).
3. **Severidad:** (Crítica, Alta, Media, Baja).
4. **Tipo de Defecto:** (Responsividad, Accesibilidad, Usabilidad, Riesgo Clínico).
5. **Pasos detallados para reproducir.**
6. **Comportamiento observado frente a comportamiento esperado.**
7. **Impacto Clínico:** (ej. *"El médico puede emitir una dosis incorrecta si la frecuencia queda oculta en móviles"*).
8. **Recomendación Técnica de Solución:** (ej. *"Cambiar display a flex y utilizar media queries"*).

---

# Formato Final del Reporte de Auditoría

Los hallazgos se consolidarán en la siguiente estructura tabular unificada para su revisión por el orquestador y equipo de desarrollo antes de producción:

### Resumen Ejecutivo
* **Total de Hallazgos:** [Número]
* **Hallazgos Críticos:** [Número]
* **Hallazgos de Alta Severidad:** [Número]
* **Hallazgos de Media/Baja Severidad:** [Número]
* **Riesgos Clínicos Mitigados:** [Detalle]

### Tabla de Hallazgos Consolidada

| Severidad | Pantalla / Componente | Defecto Visual o Técnico | Impacto Clínico | Recomendación Técnica | Estado de Corrección |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[Severidad]** | `NombreComponente.tsx` | Descripción detallada del desfase o error visual encontrado en móviles. | Explicación del riesgo asistencial o dificultad para el profesional. | Declaración de la clase CSS o cambio de layout recomendado. | Pendiente / Corregido / En proceso |
