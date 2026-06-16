# 2026-06-15 — Auditoría móvil: ficha odontológica tab por tab + resolución del contraste WCAG AA

> Continuación de la auditoría A24 (390×844). Doc canónico de hallazgos: `docs/qa/auditoria_responsividad_movil.md` (v2). Memoria: `hce-auditoria-movil-en-curso`.

## Qué se hizo

### 1. Auditoría de la ficha odontológica, tab por tab
Recorrido E2E con puppeteer-core + Chrome + axe-core (login real `doctor_julio`), de los **7 tabs activos** del control segmentado: Odontograma, Anamnesis, Estado bucal y plan, Afiliado/Obra social, Consentimiento, Evolución, Imágenes y documentos.
- **0 overflow horizontal** en los 7 tabs + odontograma en landscape (844×390).
- **7 críticos** de accesibilidad (form controls sin nombre accesible) → **corregidos** con `aria-label`:
  - `AnamnesisPAMI.tsx`: Motivo de consulta, Cepillados, Momentos de azúcar, cigarrillos, detalle Sí/No (+`inputMode="numeric"`).
  - `OralStatusPAMI.tsx`: Diagnóstico, Plan, Observaciones (textareas), Zona, Tipo, Fecha.
  - `OdontologyDocuments.tsx`: `input[type=file]`, `select` Categoría, input Descripción.

### 2. Resolución del contraste WCAG AA (white-label `--accent-text`)
Decisión del Super Admin: implementar `--accent-text`. El color de marca/acento fallaba 4.5:1 como texto chico sobre blanco/base.
- **`ThemeContext.tsx`**: `applyTheme` deriva `--accent-text` oscureciendo el `primaryColor` del tenant hasta ≥4.5:1, **calculado sobre `--bg-base` (#e9edf3)** (superficie más exigente). El acento puro se reserva para rellenos/bordes/íconos/títulos grandes.
- **`index.css`**: default `--accent-text: #075985` + tokens "texto seguro": `--color-blue-text #1d4ed8`, `--color-amber-text #b45309`, `--color-violet-text #4338ca`, `--color-emerald-text #047857`. Nav activo/hover → `--accent-text`.
- **Aplicado en**: `App.tsx` (wordmark), `HomeScreen.tsx` (subtítulo, links de agenda, footer, footers de módulo, CTAs primarios usan `--accent-text` como **fondo**), `landing.css` (`--brand-blue`/`--brand-mint` oscurecidos + badge violeta), `agenda-utils.ts` (colores de estado/urgencia de turno), `OdontologyHC.tsx` (género, DNI, badge FHIR), `EvolutionPAMI.tsx`, `OralStatusPAMI.tsx`, `ConsentForm.tsx`.

## Verificación (axe color-contrast, A24 390px)
| Pantalla | Antes | Después |
| :-- | :-- | :-- |
| Landing | 9 | **0** |
| Home | 17 | **0** |
| Ficha (anamnesis/estado bucal/afiliado/consentimiento/evolución/imágenes) | 2–22 | **0** |
| Ficha — Odontograma | 8 | **6** (residual) |

Críticos de label/select-name reverificados = **0**. `tsc --noEmit` OK.

## Pendiente / handoff
1. **Odontograma** (`OdontogramPAMI.tsx`): residual de contraste ×6 — etiquetas de capa/herramienta donde el color del texto = color de la marca SVG (Diagnóstico `#ef4444` 3.76:1; slate inactivo `#64748b` 4.35:1). Fix: `--color-rose-text` para el texto, manteniendo el rojo en el trazo SVG. No tocado (componente sensible, zona de trabajo paralelo).
2. **Tab 8 "Prótesis / Laboratorio"** (`ProtesisTab.tsx`): en desarrollo paralelo → no auditado.
3. Faltan: **Agenda** (crear/editar turno, modal), **Personalización**, y **firma canvas + odontograma táctil** en dispositivo real.
4. `scrollable-region-focusable` (Media) en Odontograma y Consentimiento.

## ⚠️ Gotcha del entorno (importante para la próxima sesión)
El frontend corre en **Docker** (`hce-frontend-client`, mount `D:\...\hce-frontend → /usr/src/app`). El `vite.config.ts` **no tiene `server.watch.usePolling`**, así que el watcher no capta cambios del bind-mount de Windows → Vite sirve transforms **stale** y HMR no refresca. **Tras editar el frontend: `docker restart hce-frontend-client`** (o agregar `usePolling: true` para arreglarlo de raíz).

## Scripts de auditoría (en `D:\tmp\`)
- `a24_ficha_tabs.js` — recorrido de tabs + screenshots + axe + overflow.
- `a24_verify_labels.js` — verificación de críticos label/select-name.
- `a24_contrast_dump.js` — dump de violaciones color-contrast con colores FG/BG (Landing + Home).
- `a24_ficha_final.js` — contraste por tab de la ficha (scope al 1er segmented-control).
