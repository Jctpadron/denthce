# Walkthrough: Rediseño Premium de la HC Odontológica y del Espacio de Trabajo del Odontograma

**Fecha:** 2026-06-14  
**Autor:** Antigravity (AI Developer)

## Objetivo
Replicar el diseño premium y la estructura visual por paneles de la **Historia Clínica** general en la pantalla de **Historia Clínica Odontológica (HC Odontológica)**, e instrumentar un rediseño unificado del espacio de trabajo del odontograma para guiar visualmente al odontólogo en el modo activo (Diagnóstico vs. Plan), eliminando desbordamientos ocultos en el menú de categorías de tratamientos y fortaleciendo la unificación cromática padre-hijo.

## Cambios Realizados

### 1. Replicación del Layout de Dos Columnas (`ficha-clinica-layout`)
- Modificado el archivo [OdontologyHC.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontologyHC.tsx).
- Se reemplazó el diseño de cabecera lineal viejo por la distribución de 2 columnas al seleccionar un paciente:
  * **Columna Izquierda:** Panel vertical demográfico (`.panel`) con avatar, nombre en formato `Apellido, Nombre`, DNI, Edad, Género (con símbolo e icono interactivo), Teléfono, Email, Domicilio, Fecha de Ingreso y el badge de estandarización HL7 FHIR R4.
  * **Columna Derecha:** Contenedor de ancho flexible para las pestañas segmentadas (`.segmented-control`) y el contenido clínico envuelto en la clase `.panel.ficha-clinica-content-panel`.

### 2. Icono Identificador de Género en Ficha
- Se implementó el helper `genderInfo` en el panel de datos demográficos de la ficha de paciente seleccionado.
- Se agregó el símbolo del género correspondiente (`♂` para Masculino, `♀` para Femenino, `⚧` para Otros) en negrita junto al texto y se coloreó el icono de corazón y el símbolo según corresponda.

### 3. Unificación del Espacio de Trabajo en el Odontograma
- Modificado el archivo [OdontogramPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontogramPAMI.tsx).
- Se combinaron la antigua tarjeta de "Capa de Registro" y la "Barra de Herramientas" en un **único panel de trabajo integrado** con bordes y sombra homogéneos.
- **Barra de Estado Dinámica (Header Informativo):** Se colocó una franja superior que cambia dinámicamente según la capa seleccionada:
  * **Diagnóstico (Existente):** Fondo rojo suave (`#fff5f5`), borde rojo claro, y un mensaje que aclara que se están registrando patologías existentes en la boca del paciente (que se pintarán en ROJO en el odontograma).
  * **Plan de Tratamiento:** Fondo azul suave (`#eff6ff`), borde azul claro, y un mensaje que indica que se están planificando intervenciones a realizar en el futuro (que se pintarán en AZUL).
  * Se integró en esta misma barra, a la derecha, el alternador de capa de forma sumamente compacta y estética.

### 4. Menú de Categorías 100% Visible (Sin Scroll Horizontal)
- Se aplicó `flexWrap: 'wrap'` en el contenedor de solapas principales del odontograma (Fila 1).
- Si el espacio de la pantalla es menor, las pestañas se reacomodan en varias filas de botones legibles, garantizando que el profesional siempre visualice todas las especialidades de tratamiento (Diagnóstico, Restauraciones, Endodoncia, Cirugía, Prevención) y eliminando la duda de si hay más opciones ocultas a los lados.

### 5. Coherencia Cromática e Iconografía Unificada Padre/Hijo
- Se importaron iconos de `lucide-react` (`Search`, `Sparkles`, `Activity`, `Scissors`, `Shield`) para darles una representación semántica a las solapas de grupos.
- Se implementó `GRUPO_COLORS` de manera que tanto la solapa activa (padre) como la herramienta activa de abajo (hijo) compartan el color exacto de la categoría (azul para Diagnóstico, verde esmeralda para Restauraciones, violeta para Endodoncia, naranja para Cirugía y cerceta/teal para Prevención).
- Los botones hijos ahora cuentan con un **indicador LED dinámico** y estilos hover de previsualización que refuerzan esta relación jerárquica y el contraste general de la UI.

### 6. Limpieza y Reubicación de Controles Secundarios (Opción B)
- **Botón "Limpiar" en Fila 1 (Pestañas de Categorías):** Se ubicó al extremo derecho de la Fila 1 (dentro de la caja de control segmentado de solapas principales) en formato de botón cuadrado, fondo blanco y con el icono de recarga `RotateCcw` (flecha circular). Esto reduce al mínimo la sobrecarga del panel de herramientas y permite un reset inmediato de la prestación seleccionada desde el menú raíz.
- **Selector de Dentición (Adulto / Infantil / Mixto) Comentado:** Siguiendo la indicación del profesional para limpiar la barra de filtros inferiores y evitar redundancia, se comentó el selector de modo del odontograma de la barra inferior, ocultándolo del render de la interfaz para mayor simpleza visual.
- **Enlace de Referencias en Barra Inferior:** El botón para alternar las referencias se reubicó al extremo derecho de la barra de filtros inferior (`marginLeft: 'auto'`), permitiendo desplegar la leyenda explicativa de prestaciones y colores en la parte baja sin ocupar espacio vertical permanente.

### 7. Vista Rápida de Arcada Dental Completa (Opción A)
- Se removió por completo la lógica de maximización y pantalla completa (`isMaximized` y overlays).
- **Lógica de Estado General (`getToothSummaryState`):** Se creó una función que consolida el estado de cada pieza evaluando sus caras individuales del mapa clínico (caries/patología activa, tratamiento planificado, estado mixto, ausente o sano).
- **Diseño Anatómico e Interactividad:** Se incorporó un panel superior plegable con transición dinámica (header con cheurones de colapso) que grafica la boca del paciente en dos filas horizontales de dientes (Arcada Superior e Inferior) ordenados por cuadrantes y hemiarcadas.
- **Scroll Suave y Foco en Tarjeta:** Cada diente en la arcada rápida es un botón circular con estilo cromático semántico según su estado (rojo = patología, azul = planificado, amarillo = mixto, gris tachado = ausente, blanco = sano). Al hacer clic en un diente, la pantalla ejecuta un scroll automático suave enfocando y parpadeando el contorno de la tarjeta detallada de abajo para facilitar una edición inmediata. Si el filtro de la grilla oculta la pieza, el sistema cambia automáticamente el filtro a "Ver todos" para permitir el foco.

## Verificación Realizada

1. **Recompilación y Despliegue:**
   - Se ejecutó `npm run build` en el frontend y se comprobó que el proyecto compila al 100% sin advertencias ni errores.
   - Se reinició el contenedor frontend `hce-frontend-client` para forzar la compilación en vivo con Vite en el entorno de desarrollo.
2. **Validación en Navegador:**
   - Se ingresó a la ficha de **Carlos Alberto Gómez** (DNI: `68646769`).
   - Se comprobó la presencia de la nueva sección **Vista Rápida de Arcada Dental Completa (Estado General)** con los colores correspondientes de cada pieza (ej: Nº 11 y 54 en rojo suave por patología existente; Nº 16 en azul por planificado).
   - Se probó el colapsado del acordeón de la arcada, reduciendo su visibilidad al hacer clic en el encabezado.
   - Se probó el scroll interactivo: al hacer clic en la Pieza Nº 21 en la arcada superior, la página se desplazó automáticamente de forma muy suave enfocando y enmarcando de forma destacada la tarjeta detallada de la pieza 21 en la grilla inferior.
   - Se generaron las siguientes capturas de pantalla de la verificación final:
     * `odontogram_initial_view`: Carga inicial de la ficha del paciente.
     * `odontogram_arcada_visible`: Vista de la sección de arcada completa desplegada arriba de los dientes detallados.
     * `odontogram_collapsed`: Vista de la sección de arcada colapsada para liberar espacio vertical.
     * `odontogram_focused_tooth_21`: Vista del scroll suave y foco destacado sobre la pieza 21 de la grilla tras pulsarla en la arcada rápida.

## Actualización: Odontograma FDI 100% Interactivo Directo y Remoción de Grilla Redundante

### 1. Interacción Directa por Cara en la Arcada FDI
* **Modificación de Polígonos SVG:** Se modificó la función [renderMiniToothSVG](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontogramPAMI.tsx) de [OdontogramPAMI.tsx](file:///d:/APP-jct/app-historias-clinicas/hce-frontend/src/components/odontology/OdontogramPAMI.tsx) para que cada una de las 5 caras de la pieza dental (Vestibular, Distal, Lingual, Mesial y Oclusal) responda individualmente al evento `onClick={() => handleFaceClick(face)}`.
* **Clase CSS de Hover:** Se integró la clase de estilo global `className="tooth-polygon"` a cada uno de los 5 polígonos del mini-diente. Esto habilita que al pasar el mouse por encima de cualquier cara, esta brille con un fondo y borde azul translúcido sutil que le indica al odontólogo de forma inmediata que el elemento es interactivo.
* **Escalabilidad Visual (Dientes más Grandes):** Se incrementó el tamaño de visualización de cada pieza dental de `26x26px` a `36x36px`. Esto ensancha las caras individuales de cada diente (~12px de ancho en pantalla), haciendo que la interacción táctil o mediante puntero sea extremadamente cómoda y precisa.
* **Mapeo Inteligente de Herramientas de Pieza:** Si el profesional selecciona una herramienta que aplica a toda la pieza completa (como *Corona*, *Ausente*, *Extracción* o *Implante*), el sistema intercepta el clic en cualquier cara y registra el tratamiento a nivel de toda la pieza (`all`). Si es una herramienta de cara (*Caries*, *Restauración*, *Incrustación* o *Sellante*), la aplica a la cara exacta pulsada.
* **Limpieza Inteligente:** Al usar la herramienta borradora, el manejador de clic borra prioritariamente la prestación de la cara pulsada, y si no hay ninguna, limpia el estado general de toda la pieza (ej: remover un implante o corona cliqueando en cualquier cara).

### 2. Remoción de la Grilla Redundante e Interfaz Limpia
* Se eliminó por completo el listado de tarjetas detalladas de dientes individuales en la parte inferior, removiendo la función `renderTooth` y las variables colaterales de búsqueda y filtrado (`searchTerm`, `statusFilter`, `baseList`, `manuallyAddedPieces`).
* Esto reduce la sobrecarga visual de la pantalla a cero, elimina la necesidad de realizar scrolls largos y confusos, y permite que la carga se efectúe de forma directa e instantánea sobre la Arcada FDI unificada en la parte superior.
* Se simplificó la barra de filtros inferiores colocándose un texto instructivo sutil para guiar al profesional y alineando el botón de referencias en el extremo derecho.

### 3. Leyenda con Glifos de la Ficha Unificados
* Se rediseñó el panel de leyendas (`showLegend`) implementando un helper local que dibuja mini-glifos SVG del mismo formato y escala 30x30 que los mini-dientes, logrando una consistencia iconográfica absoluta.

---

## Verificación de Usabilidad Realizada

1. **Compilación Exitosa:** Se comprobó que el frontend compila de forma limpia sin advertencias ni errores con `npx tsc --noEmit`.
2. **Prueba Interactiva en Vivo:**
   * Al acceder a la ficha del paciente, la pantalla muestra un único panel limpio y compacto con el odontograma y la barra lateral de intervenciones.
   * Al seleccionar la herramienta **Caries** (Diagnóstico) y pulsar el centro de la pieza **11**, se pintó instantáneamente en rojo el centro de la miniatura del diente y se registró de inmediato en el listado de intervenciones de la derecha.
   * Al pulsar el botón de **Borrador (Limpiar)** y volver a tocar la pieza **11**, esta se actualizó regresando a su color blanco original y se removió la caries del historial clínico del paciente.
   * Se tomaron capturas de pantalla de la verificación final:

### Carrousel de Verificación del Odontograma Interactivo FDI

```carousel
![1. Interfaz Limpia y Compacta (Sin tarjetas abajo)](file:///C:/Users/jctsi/.gemini/antigravity-ide/brain/5fca9186-86ce-4326-af08-15046a9eebc2/interfaz_limpia_1781477223310.png)
<!-- slide -->
![2. Registro Directo de Caries en Pieza 11 (Oclusal)](file:///C:/Users/jctsi/.gemini/antigravity-ide/brain/5fca9186-86ce-4326-af08-15046a9eebc2/diente_11_caries_1781477336972.png)
<!-- slide -->
![3. Borrado Inteligente Directo sobre el Odontograma](file:///C:/Users/jctsi/.gemini/antigravity-ide/brain/5fca9186-86ce-4326-af08-15046a9eebc2/diente_11_limpio_1781477369789.png)
```

## Actualización: Dentición Condicional por Edad y Modal de Referencias Premium

### 1. Dentición Dinámica Condicional por Edad
* **Umbral Clínico de Edad:** En odontología, la dentición temporal o de leche culmina su recambio hacia los 12-13 años. Por ende, se implementó una regla que calcula de forma dinámica la edad del paciente en base a su fecha de nacimiento (`birthDate`) obtenida del recurso Patient de FHIR.
* **Comportamiento Automatizado:** 
  - Si la edad calculada es **menor a 13 años**, la interfaz del odontograma se inicializa en modo mixto (`mixed`), desplegando tanto la arcada de *Dientes Permanentes (Adultos)* como la de *Dientes Temporales (Niños)*.
  - Si la edad calculada es **igual o mayor a 13 años** (adultos), la sección *Dientes Temporales (Niños)* se oculta automáticamente por completo de la pantalla, evitando ocupar espacio vertical innecesario para el odontólogo de adultos.
* **Sincronización:** Se configuró un efecto de React (`useEffect`) para observar cambios en la propiedad `birthDate`, lo que garantiza que si el profesional cambia de paciente en la ficha clínica, la interfaz del odontograma recalcule de forma inmediata y automática el modo de dentición correcto.

### 2. Modal Popup de Referencias Premium
* **Diseño Flotante y Sin Desplazamientos:** Se removió la leyenda de referencias inline que anteriormente se mostraba dentro de la interfaz empujando el layout hacia abajo. En su lugar, el botón **"Ver referencias"** (ahora con un icono de libro 📖) abre una ventana **modal popup flotante**.
* **Estética Premium:** 
  - El modal cuenta con un fondo oscuro translúcido difuminado (`backdrop-filter: blur(4px)`) que aísla visualmente el odontograma y enfoca la atención del usuario en las referencias.
  - La transición de entrada utiliza un sutil efecto de escala y opacidad (`zoomIn 0.2s ease`).
  - Las simbologías se presentan dentro del modal en formato de **tarjetas estructuradas** con bordes finos y fondo suave, mostrando a la izquierda el glifo en alta definición y a la derecha el nombre de la prestación junto con un indicador claro de su alcance (*Toda la pieza* o *Por cara dental*).
* **Interacción Cómoda:** El modal puede cerrarse fácilmente pulsando la "X" de la cabecera, haciendo clic en el backdrop exterior o presionando el botón "Entendido" en el pie de página.

---

## Verificación Final de Modificaciones

1. **Compilación de Tipos:** Se ejecutó `npx tsc --noEmit` de manera exitosa sin ningún error de TypeScript en los componentes modificados.
2. **Pruebas en Navegador:**
   * **Paciente Adulto:** Seleccioné a Carlos Alberto Gómez (51 años) y comprobé que la arcada temporal infantil no aparece abajo.
   * **Modal de Referencias:** Pulsé el botón "Ver referencias" 📖 y se desplegó el modal popup con desenfoque de fondo y tarjetas estructuradas en dos columnas. El cierre con el botón "Entendido" funcionó correctamente.
   * **Paciente Niño:** Seleccioné a Santiago López (11 años) y verifiqué que la sección *Dientes Temporales (Niños)* sí se renderiza de forma óptima bajo los dientes permanentes.

### Carrusel de Capturas de Pantalla Finales

```carousel
![1. Odontograma Limpio para Adulto (Sin dientes temporales y sin barra inferior)](file:///C:/Users/jctsi/.gemini/antigravity-ide/brain/5fca9186-86ce-4326-af08-15046a9eebc2/odontograma_final_perfeccionado_1781479623305.png)
<!-- slide -->
![2. Modal Popup de Referencias Abierto desde la Cabecera](file:///C:/Users/jctsi/.gemini/antigravity-ide/brain/5fca9186-86ce-4326-af08-15046a9eebc2/modal_referencias_cabecera_abierto_1781479631842.png)
<!-- slide -->
![3. Odontograma Mixto para Niño (Con dientes temporales y permanentes)](file:///C:/Users/jctsi/.gemini/antigravity-ide/brain/5fca9186-86ce-4326-af08-15046a9eebc2/nino_odontograma_mixto_1781478712090.png)
```

