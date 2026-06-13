---
name: design-system
description: Fuente única de verdad de diseño e identidad de la HCE (DentHCE). Define el catálogo de tokens (color, tipografía, espaciado, sombras, radios), el inventario de componentes reutilizables, las reglas de white-label multi-inquilino (propagación del primaryColor y modo oscuro), la identidad de marca (voz, iconografía, estados vacíos/error/carga) y los checklists de accesibilidad (WCAG 2.1 AA) y responsividad. Consúltala SIEMPRE antes de diseñar (agente ux) o generar UI (skill code-generator), y úsala como Quality Gate visual.
---

# Skill: Sistema de Diseño e Identidad (design-system)

Canon de diseño de **DentHCE**. Evita que cada componente reinvente estilos inline y garantiza coherencia visual, white-label real, accesibilidad y responsividad. El agente `ux` la cita en sus specs; la skill `code-generator` la aplica al generar UI.

> Implementación de referencia: `hce-frontend/src/index.css` (tokens y componentes), `src/context/ThemeContext.tsx` (white-label) y `src/components/BrandingSettings.tsx` (editor de identidad).

---

## 1. Tokens de diseño (única fuente)

Todo color/medida sale de una variable CSS. **Prohibido el hex hardcodeado** en componentes (`#2962ff`, `#ffffff`, etc.) — usar el token. Tokens vigentes en `:root`:

### Superficies y texto
| Token | Valor (light) | Uso |
| :--- | :--- | :--- |
| `--bg-base` | `#f6f8f9` | Fondo de la app |
| `--bg-surface` | `#ffffff` | Tarjetas/paneles |
| `--bg-card` | `#f8f9fa` | Celdas/inputs |
| `--border-color` | `#ebedef` | Bordes finos |
| `--border-hover` | `#2962ff` | Foco/borde activo |
| `--color-text` | `#1e293b` | Texto principal |
| `--color-muted` | `#64748b` | Texto secundario |

### Acentos semánticos
| Token | Valor | Significado |
| :--- | :--- | :--- |
| `--color-cyan` | `#0284c7` (= primario del tenant) | Acción primaria/marca |
| `--color-emerald` | `#10b981` | Éxito/salud |
| `--color-violet` | `#6366f1` | Admin/informativo |
| `--color-amber` | `#f59e0b` | Advertencia |
| `--color-rose` | `#ef4444` | Error/alerta clínica |

### Forma y movimiento
- Radios: inputs/botones `12px`, tarjetas `16px`, celdas `8px`, pills `14px`.
- Sombras: `--shadow-sm`, `--shadow-md`, `--shadow-card`.
- Transición: `--transition-smooth` (`0.2s cubic-bezier(0.4,0,0.2,1)`).

### Identidad visual canónica: TEMA CLARO
DentHCE es deliberadamente **claro, limpio y clínico** (estilo "Mercado Pago": fondos casi blancos, bordes finísimos, sombras sutiles, mucho aire). Esta es la identidad oficial y **no se debe oscurecer** la app. Verificado en todas las pantallas (incl. `LandingLogin`, fondo `#ffffff`). El único tono oscuro intencional es la pantalla de arranque/error pre-React en `main.tsx` (Slate-950 con gradiente cian/esmeralda) — es un *splash* de sistema, no el tema.

### Reglas de tokens
1. Nuevo color → primero token en `:root`, luego usarlo. Nunca literal.
2. El acento de "acción" debe derivar de `--color-primary` (color del tenant), no de un azul fijo. **(Este es el punto más importante del white-label, ver §3.)**
3. Mantener superficies claras y de alto contraste con el texto. El modo oscuro es **opcional por tenant** (baja prioridad), no el modo por defecto.

---

## 2. Escala tipográfica y de espaciado

**Tipografía:** familia `Inter` (`--font-title`). *Solo se usa Inter* — Outfit/Lato están importados pero sin uso: o se adoptan con un rol claro o se eliminan del `@import` (deuda a saldar).

Escala recomendada (rem): `0.68` (badge) · `0.75` (label) · `0.83` (body sm) · `0.9` (body) · `1.1` (título card) · `1.3–1.6` (título sección, fluido con `clamp()`). Pesos: 500 (normal), 600/700 (énfasis), 800 (marca).

**Espaciado:** múltiplos coherentes — `0.25 · 0.5 · 0.75 · 1 · 1.25 · 1.75 · 2 rem`. Padding de tarjetas fluido: `clamp(1.25rem, 4vw, 1.75rem)`. Evitar números mágicos sueltos.

---

## 3. White-label multi-inquilino

El sistema es white-label: cada consultorio configura su identidad vía `BrandingSettings` → `TenantConfig`. El diseño DEBE respetar (en orden de prioridad):

1. **[CRÍTICO] `primaryColor` del tenant se propaga de verdad.** `applyTheme()` setea `--color-primary`/`--color-cyan`; **todo** acento de acción (botones primarios, nav activa, foco, links) debe usar ese token, no un `#2962ff` fijo. Si el médico elige "Esmeralda", los botones se vuelven esmeralda. Hoy esto está a medias: hay `#2962ff` hardcodeado que ignora la elección del tenant — **esta es la deuda de diseño #1 a saldar.**
2. **`logoUrl`** manda en header y documentos; fallback = inicial del `clinicName` sobre gradiente del primario.
3. **Datos del profesional** (`doctorName`, `doctorLicense`, `specialty`, firma) alimentan encabezados de recetas/informes.
4. **Modo oscuro (`darkMode`) — OPCIONAL, baja prioridad.** La identidad por defecto es clara (§1). El flag existe en `TenantConfig` pero no está cableado, y **no es prioridad**: solo implementarlo si un tenant lo pide explícitamente. Si se hace: `applyTheme` aplicaría `data-theme="dark"` y un bloque `:root[data-theme="dark"]` redefiniría `--bg-*`/`--color-text`. No oscurecer la app "por defecto".

---

## 4. Inventario de componentes (reutilizar, no reinventar)

Antes de inventar un estilo inline, usar lo existente en `index.css`:

| Clase | Uso |
| :--- | :--- |
| `.btn` + `.btn-primary` / `.btn-secondary` | Botones de acción |
| `.panel` | Tarjeta/contenedor de sección |
| `.search-input` | Inputs y selects |
| `.segmented-control` + `.segmented-button` | Pestañas tipo pill (scroll horizontal en móvil) |
| `.tooth-polygon` | Interacción del odontograma SVG |
| `.animate-fade-in-up` / `@keyframes fadeIn,slideIn` | Animaciones de entrada |

Patrones de tarjeta del dashboard (hero, KPI, módulo) viven en `HomeScreen.tsx`: reutilizar su estructura. Si un patrón se repite ≥3 veces, promoverlo a clase en `index.css`.

---

## 5. Identidad de marca — DentHCE

- **Nombre/voz:** "DentHCE", HCE odontológica. Tono cercano y profesional, en **español rioplatense** (vos: "Buscá", "Registrá"). Firma persistente: *"Powered by DentHCE · HL7 FHIR R4"*.
- **Iconografía:** criterio único — preferir **`lucide-react`** (consistente, accesible, escalable) sobre emoji para UI funcional; los emoji solo como decoración con `aria-hidden`. (Hoy hay mezcla → converger a lucide.)
- **Estados obligatorios** en toda vista con datos:
  - *Carga:* skeleton/placeholder, nunca salto en blanco.
  - *Vacío:* mensaje positivo ("No tenés recetas pendientes ✓"), no tabla muerta.
  - *Error:* contenido contenido (no rompe el resto de la pantalla).
- **Login/Landing** (`LandingLogin`) es la primera impresión de marca: logo, propuesta de valor, paleta. Mantener coherencia con el resto.
- **Favicon/PWA y `document.title`:** el título ya se setea con `clinicName`; el favicon debería seguir la marca del tenant (deuda).

---

## 6. Checklist de Accesibilidad (WCAG 2.1 AA) — Quality Gate

- [ ] Contraste texto normal ≥ 4.5:1; grande ≥ 3:1. `--color-muted` sobre blanco ≈ 4.8:1 (OK, no bajar).
- [ ] Acentos (emerald/amber) **no** como único texto pequeño portador de información.
- [ ] El color **nunca** es el único indicador (sumar ícono/texto) — crítico en alertas clínicas.
- [ ] Foco visible por teclado (`:focus-visible`, ya global en `index.css`).
- [ ] Objetivos táctiles ≥ 44×44 px; separación ≥ 8 px.
- [ ] Emojis decorativos con `aria-hidden="true"`; botones multi-nodo con `aria-label`.
- [ ] Jerarquía de encabezados coherente; `<section aria-labelledby>`.
- [ ] Respeta `prefers-reduced-motion` (ya global).

---

## 7. Checklist Responsivo (regla innegociable de AGENTS.md) — Quality Gate

- [ ] Mobile-first. Verificado en **360 / 768 / 1280 px**.
- [ ] Sin scroll horizontal. `box-sizing: border-box` (global) + `width: 100%`.
- [ ] Grids fluidos con `repeat(auto-fit, minmax(min(100%, X), 1fr))` — el `min(100%, …)` evita overflow en 360 px.
- [ ] Sin alto fijo que recorte texto (`min-height` con `clamp()`, no px duro).
- [ ] Tipografía fluida con `clamp()` en títulos.
- [ ] Hover solo bajo `@media (hover: hover)`; en táctil usar `:active`.

---

## 8. Criterio de aprobación (cuándo el diseño "pasa")
Un entregable de UI cumple cuando: usa solo tokens (cero hex hardcodeado nuevo), reutiliza componentes del inventario, respeta white-label (incl. dark mode y primaryColor), y pasa los checklists §6 y §7. El agente `ux` certifica; discrepancias se elevan al Orquestador.
