# Auditoría de Responsividad, Usabilidad y Accesibilidad Móvil (Android) — HCE Denta Cloud · v2

> **v2 (2026-06-15):** versión **realineada al sistema actual**. La v1 apuntaba a componentes hoy reemplazados u ocultos (LandingLogin, HC general con `tabs/`, SOAP, Receta/CDS). Esta versión audita lo que **realmente existe y es accesible** en producción/local. Mantiene el marco profesional de la v1 (matriz de control + lente de seguridad clínica) y le agrega la **capa de automatización** y un **gate de release**.

## Objetivo
Auditoría End-to-End (E2E) de la HCE odontológica desde un **Android moderno** en movilidad asistencial, detectando: problemas de responsividad/overflow, errores de maquetación/alineación, controles táctiles inadecuados, defectos de accesibilidad **WCAG 2.1 AA**, riesgos clínicos por UI confusa (ocultamiento de alertas/datos), inconsistencias entre pantallas y fatiga cognitiva.

> **Nota de criterio (decisión de producto):** se evalúa accesibilidad **WCAG 2.1 AA genérica**. Se **descartó** el encuadre "operadores de +65 años" (ver memoria `feedback-directiva-65-anos-descartada`). La legibilidad base se mantiene (`html{font-size:17px}`, piso de inputs ~13.5px) por buena práctica, no por ese perfil.

---

## 0. Alineación con la arquitectura actual (qué se audita y qué NO)

**EN ALCANCE (lo que el usuario realmente ve):**
| # | Pantalla | Componente real |
| :-- | :-- | :-- |
| 1 | Landing pública (pre-login) | `components/landing/LandingDentaCloud.tsx` |
| 2 | Login | **Tema Keycloak `denta-cloud`** (no es React; `configs/keycloak/themes/denta-cloud/`) |
| 3 | Home / Dashboard | `components/HomeScreen.tsx` + `index.css` (header L≈360-470) |
| 4 | HC Odontológica (grilla + ficha) | `components/odontology/OdontologyHC.tsx` |
| 4a | · Odontograma | `odontology/OdontogramPAMI.tsx` + `odontogram.css` |
| 4b | · Anamnesis (+ firma canvas) | `odontology/AnamnesisPAMI.tsx` |
| 4c | · Estado bucal y plan | `odontology/OralStatusPAMI.tsx` |
| 4d | · Afiliado / Obra social | `odontology/CoverageForm.tsx` |
| 4e | · Consentimiento | `odontology/ConsentForm.tsx` |
| 4f | · Evolución | `odontology/EvolutionPAMI.tsx` |
| 4g | · Imágenes y documentos | `odontology/OdontologyDocuments.tsx` |
| 5 | Admisión de paciente (+ SISA + cobertura) | `components/PatientForm.tsx` |
| 6 | Agenda de turnos | `components/agenda/AgendaView.tsx` |
| 7 | Personalización / Personal | `BrandingSettings.tsx` / `UserManagement.tsx` |

**FUERA DE ALCANCE (código existe pero está OCULTO del menú → no accesible para el usuario):**
- HC **general**: `PatientSearch.tsx` + `components/tabs/*` (Alergias, Signos Vitales, Documentos, Antecedentes, Auditoría, Encuentros, Recetas), `SoapEditor.tsx`, `PrescriptionForm.tsx` (Receta + CDS Hooks). Reemplazados por HC Odontológica. **No auditar** salvo que se reactiven (entonces volver a la v1 para esas secciones).

---

## Configuración inicial

### Matriz de dispositivos (viewports)
| Perfil | Width × Height | DPR | Uso |
| :-- | :-- | :-- | :-- |
| **Android moderno (referencia)** | 390 × 844 | 3 | Principal |
| Android legacy compacto | 360 × 640 | 2-3 | Stress de ancho mínimo |
| Android Max/Plus | 412 × 915 | ~2.6 | Pantallas grandes |
| Landscape | 844 × 390 | 3 | Odontograma / gráficos |

Touch **Enabled**, User-Agent **Android Chrome**.

### Herramientas (cómo se ejecuta, en capas)
1. **Exploración manual:** Chrome DevTools → Device Mode, a los 4 viewports.
2. **Automatización + evidencia (lo que usamos):** Playwright/puppeteer-core contra Chrome instalado → login real (`doctor_julio`) y **screenshots por pantalla/breakpoint** que se analizan visualmente + **detección programática de overflow** (`scrollWidth > innerWidth` y elementos con `right > viewport`). Script de referencia: `D:\tmp\a24_audit.js` (puppeteer-core, viewport 390/360, login E2E).
   - ⚠️ **Caveat técnico:** el headless de Chrome **clampea el viewport** (nos devolvió 504px en vez de 360). Forzar con `--window-size` + `--force-device-scale-factor`, o re-fijar `setViewport` tras la cadena de redirects del login.
3. **Accesibilidad automatizada:** **axe-core** (inyectado por Playwright) y/o **Lighthouse** (categoría Accessibility) → contraste, labels, ARIA, foco, roles. No evaluar contraste "a ojo".
4. **Performance percibido:** **Lighthouse** móvil con throttling de gama media → CLS, LCP, TBT.
5. **Dispositivo real (sign-off final):** **BrowserStack/Sauce Labs** con un Android físico (A24/Pixel) → fuentes Samsung, `safe-area`, barra de Chrome. La emulación NO sustituye esto para el OK final.

### Credenciales de prueba
- Local: `doctor_julio` / `doctor_pass_2026` (Keycloak local). Prod: `https://app.systia.ar`.

---

## Criterios de evaluación (matriz de control)

### 📐 Layout y maquetación
- Sin **scroll horizontal** en la página base ni en contenedores internos.
- Textos largos **se truncan con elipsis** o reflowean; botones no se cortan.
- Sin **superposición** de inputs/labels/iconos.
- **Modales** centrados, ancho ≤ 92% del viewport, con **scroll interno propio**.
- **Tablas/grillas**: scroll horizontal encapsulado o conversión a tarjetas.

### 👆 Interacción táctil
- Objetivo táctil **≥ 44×44 px**; separación ≥ 8 px entre controles.
- Inputs numéricos → `inputMode="numeric"`; fechas → date picker nativo.
- Selects/dropdowns operables con el pulgar; `datalist` sobre el teclado virtual.

### ♿ Accesibilidad (WCAG 2.1 AA)
- Contraste texto normal **≥ 4.5:1**; grande ≥ 3:1 (medir con axe, no a ojo).
- Base de fuente respetada (17px) e inputs ≥ ~13.5px reales.
- **Foco visible** (`:focus-visible`) navegando por teclado.
- Todo input con **label asociado** (`htmlFor`/`id`) para lectores (TalkBack).
- El **color nunca** es el único portador de info (sumar ícono/texto) — crítico en alertas.

### ⚡ Feedback visual y rendimiento
- **CLS**: sin saltos bruscos al cargar catálogos/APIs.
- **Estados de carga**: spinners/skeletons en peticiones async.
- Botones de envío **se deshabilitan** al hacer clic (evitar doble submit).

### 🛡️ Seguridad clínica y legalidad
- **Sin borrado físico destructivo** de registros clínicos consolidados (evoluciones) en móvil → inmutabilidad legal.
- **Doble confirmación / advertencia** antes de acciones críticas (firmar, alergias severas).
- Dosis/advertencias **nunca truncadas con `…`** ilegibles.

---

## Flujo E2E realineado

### 1. Landing pública (`LandingDentaCloud.tsx`)
- Sin overflow horizontal a 360/390/412; hero (ilustración) **completo, sin recorte**; los "glows" decorativos quedan clipeados (OK).
- Nav: solo **"Iniciar sesión"** (el CTA "Solicitar demo" vive en hero/sección final/footer). En mobile, colapsa a hamburguesa/drawer.
- CTAs táctiles ≥44px; secciones en una columna; footer legible.

### 2. Login (tema Keycloak `denta-cloud`)
- Tarjeta **centrada** vertical/horizontal; ícono de marca; en **español**; **sin selector de idioma**; **sin registro**; título "Ingresá a Denta Cloud".
- Campos **no autocompletan** usuario/contraseña (`no-autofill.js`).
- Teclado Android: foco correcto; el botón "Iniciar sesión" ocupa el ancho.
- **Error de identidad**: emular caída de Keycloak/red → validar mensaje responsivo y legible.

### 3. Home / Dashboard (`HomeScreen.tsx` + header)
- **< 1024px:** el nav inline colapsa en `.app-burger`; el `.app-drawer` abre con **nav clínico + administración + Salir**, sin tapar el header base.
- Header mobile **limpio** (logo + nombre + ☰); el nombre largo **se trunca con elipsis** (no empuja); avatar/Salir **van al drawer** (corregido — antes "Salir" quedaba fuera de pantalla).
- **KPIs y widgets** fluyen en **una sola columna** sin desbordes; "Agenda de hoy", "Pendientes" y módulos legibles.
- Acciones rápidas (Nuevo turno / paciente / HC) apiladas y táctiles.

### 4. HC Odontológica (`OdontologyHC.tsx`)
**Grilla de pacientes:** búsqueda por nombre; **paginación** ("Mostrar más"); cada tarjeta muestra DNI · género (ícono petit) · edad · última visita · obra social → verificar que **no desborde** ni se encime en 360px (texto con `flex-wrap`).
**Ficha (7 tabs en `.segmented-control` con scroll táctil + máscara degradada):**
- **4a Odontograma** (`OdontogramPAMI` SVG): arcadas **auto-escalan** al ancho sin romperse; dentición (adulto/infantil/mixto) según edad; **precisión táctil** al tocar caras (V/D/L/M/O); capa Diagnóstico (rojo) / Plan (azul); **landscape** reorganiza SVG + paneles sin superposición.
- **4b Anamnesis** (`AnamnesisPAMI`): selectores Sí/No con espacio táctil; campos dinámicos al responder "Sí" sin empujar botones fuera; **firma canvas** (`touch-action:none` bloquea scroll; trazo fluido; limpiar; guardar en base64 FHIR).
- **4c Estado bucal y plan** (`OralStatusPAMI`): alta + **editar**; **sin botón de borrado físico** en historial (inmutabilidad).
- **4d Cobertura / Obra social** (`CoverageForm`): inputs `flex:1 1 auto`, no anchos fijos.
- **4e Consentimiento** (`ConsentForm`).
- **4f Evolución** (`EvolutionPAMI`): timeline responsivo; firmas legibles sin distorsión.
- **4g Imágenes y documentos** (`OdontologyDocuments`): subir (cámara/archivos Android); progreso; **galería responsiva** (miniaturas se ajustan a la rejilla); vista previa con scroll interno; categorías; borrar.

### 5. Admisión (`PatientForm.tsx`)
- `.grid-form-2col` colapsa a **una columna** < 768px.
- **SISA**: ingresar DNI → "Verificar SISA" → autocompletar sin descuadrar; toast legible.
- Selector de **Género** nativo/operable.
- **Cobertura**: catálogo de obras sociales (`/insurance`) en `datalist` sobre el teclado; agregar afiliado/plan; lista con botón eliminar (`Trash2`); guardar.
- Enviar → alta FHIR Patient con feedback.

### 6. Agenda (`AgendaView.tsx`)
- Vista día/semana usable en móvil; grilla horaria con scroll; sala de espera; crear/editar turno en modal centrado.

### 7. Personalización / Personal (`BrandingSettings` / `UserManagement`)
- Formularios en una columna; subida de logo/firma; tablas/listas responsivas.

---

## Checklist técnico de responsividad (mobile-safe)
| Componente | Criterio | Estado (P/C/NC) |
| :-- | :-- | :-- |
| Header + nav | Inline oculto < 1024px; drawer abre/cierra sin tapar header; nombre clínica con elipsis; avatar/Salir en drawer | |
| Home KPIs/widgets | Una columna, sin overflow; agenda del día legible | |
| Grilla HC odonto | Tarjetas sin desborde; paginación; datos (género/edad/visita/OS) con `flex-wrap` | |
| Tabs ficha | `.segmented-control` con swipe + máscara degradada; estado activo claro; no se pierde estado al alternar | |
| Odontograma SVG | Escalado elástico; precisión táctil en caras; landscape OK | |
| Firma canvas | Trazo sin lag; `touch-action:none` bloquea scroll | |
| Formularios | Una columna < 768px; inputs `flex:1 1 auto`; labels asociados | |
| Modales | Centrados, ≤92% ancho, scroll interno | |
| Toasts/alertas | Visibles, contraste AA, no tapan botones | |
| Imágenes/docs | Galería se ajusta a la rejilla; miniaturas no se cortan | |

---

## Gate de release (criterio de salida)
- **Crítica/Alta = 0** para promover a producción. Media/Baja → backlog priorizado.
- Accesibilidad: **0 violaciones serias/críticas de axe** en las pantallas en alcance.
- Performance: **CLS < 0.1** en Home y ficha odontológica (Lighthouse móvil).
- Sign-off final: al menos **1 pasada en dispositivo real** (BrowserStack) de Login → Home → HC Odontológica.

---

## Evidencia y estructura de reporte (por hallazgo)
1. Identificador de pantalla · 2. Componente (`Archivo.tsx`) · 3. Severidad (Crítica/Alta/Media/Baja) · 4. Tipo (Responsividad/Accesibilidad/Usabilidad/Riesgo clínico) · 5. Pasos para reproducir (+ viewport) · 6. Observado vs esperado · 7. Impacto clínico · 8. Recomendación técnica (clase/CSS/layout) · 9. Evidencia (captura).

### Resumen ejecutivo
- Total de hallazgos · Críticos · Altos · Medios/Bajos · Riesgos clínicos mitigados.

### Tabla consolidada
| Severidad | Pantalla / Componente | Defecto | Impacto clínico | Recomendación técnica | Estado |
| :-- | :-- | :-- | :-- | :-- | :-- |
| | | | | | Pendiente / En proceso / Corregido |

---

## Ejecución 2026-06-15 — A24 (390×844, DPR2) · axe-core + screenshots + overflow
**Método:** puppeteer-core + Chrome, login real (`doctor_julio`), por pantalla: screenshot + `axe.run` (tags wcag2a/2aa/21aa) + chequeo de overflow horizontal. **Responsable:** Claude.

### Resumen ejecutivo
- **Overflow horizontal: 0** en las 6 pantallas auditadas (390px) ✓.
- **Críticos: 2** (Admisión: label/select sin nombre) → **CORREGIDOS** en esta sesión.
- **Serios: 1 tema transversal** — **contraste de color** (texto en color de marca sobre blanco < 4.5:1) en Landing, Home, HC Odonto, Admisión y Agenda.
- **Login**: 0 violaciones ✓.
- **Riesgo clínico:** no se detectó truncamiento de dosis/alergias en lo auditado (la Receta/CDS está fuera de alcance por estar oculta — ver §0).

### Tabla de hallazgos consolidada
| Severidad | Pantalla / Componente | Defecto | Impacto | Recomendación técnica | Estado |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Crítica** | Admisión / `PatientForm.tsx` | `<input type="date">` (Fecha de Nacimiento) sin label asociado | Lector de pantalla no anuncia el campo | `htmlFor`+`id`+`aria-label` | ✅ Corregido |
| **Crítica** | Admisión / `PatientForm.tsx` | `<select>` Género sin nombre accesible | Idem | `htmlFor`+`id`+`aria-label` | ✅ Corregido |
| **Alta** | Home / `App.tsx` header | En < 1024px el nombre de la clínica empujaba el contenido → **avatar cortado y "Salir" fuera de pantalla** | No se podía cerrar sesión en móvil | Nombre con `ellipsis`; avatar+Salir al **drawer** (`.app-user-desktop` oculto < 1024) | ✅ Corregido |
| **Media** | Nav / `App.tsx` | Íconos emoji "grayscale" apagados + ítems que no entraban | Prolijidad / consistencia | Migrado a **lucide** + admin al avatar; hover/activo por tokens | ✅ Corregido |
| **Alta** | Landing / `landing.css` (`content.tsx`) | **Contraste**: texto en **menta `#2aa57c`** (wordmark "Cloud", kickers, links) sobre blanco ≈ 3:1 (axe ×9) | Texto poco legible (WCAG AA) | Usar variante **oscurecida del acento para texto** (`--accent-text`) o reservar la menta para rellenos/íconos, no texto chico | 🔴 Pendiente |
| **Alta** | Home / Odonto / Agenda (varias) | **Contraste**: texto en **color primario del tenant** (naranja) sobre blanco < 4.5:1 (axe: Home ×17, Agenda ×11, Odonto ×3, Admisión ×1) | Subtítulos/links/acentos poco legibles | White-label seguro: derivar un `--accent-text` con contraste garantizado; no usar `var(--color-primary)` crudo en texto chico sobre blanco | 🔴 Pendiente |

### Pendiente de auditar (próximas pantallas)
Ficha odontológica tab por tab (odontograma SVG táctil + landscape, anamnesis + firma canvas, estado bucal, cobertura, consentimiento, evolución, imágenes/documentos), Agenda (crear/editar turno, modal), Personalización. Registrar en esta misma tabla.
