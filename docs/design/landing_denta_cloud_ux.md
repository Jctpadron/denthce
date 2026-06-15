# Spec de UX/UI — Landing Pública "Denta Cloud"

**Preparado por:** Agente UX/HCE
**Fecha:** 2026-06-14
**Marca:** Denta Cloud — *Odontología Digital*
**Fuente de contenido:** `docs/design/landing_denta_cloud_estrategia.md` (copy y secciones — NO se reinventa)
**Biblia de diseño (obligatoria):** `.claude/skills/design-system/SKILL.md` (tokens, tema claro, Inter, WCAG AA, responsive 360/768/1280)
**Componente a reemplazar:** `hce-frontend/src/components/LandingLogin.tsx` (se conserva el SVG del logo; el resto se reescribe)
**Destino:** `code-generator` / Orquestador para implementación. Este documento define el **CÓMO se ve y se estructura**, no el código final.

> Regla rectora: **cero hex hardcodeado nuevo**. Todo color sale de un token CSS de `index.css`. El acento de acción es `var(--color-primary)` (color del tenant), NO un azul fijo. Esto corrige la deuda #1 del white-label que hoy tiene `LandingLogin.tsx` (usa `#1e6fd9`, `#030f26` literales).

---

## 0. Decisiones de diseño clave (resumen para el dev)

1. **Tema claro clínico**, consistente con el resto de la app. Fondo base `--bg-base` (#f6f8f9), superficies `--bg-surface` (#ffffff). Sin modo oscuro en la landing.
2. **Ancho máximo de contenido: 1200px**, centrado, con padding lateral fluido. La landing es de **ancho completo (full-bleed)** por sección; el contenido se contiene a 1200px.
3. **Hero**: la ilustración `landing_hero.png` es **pieza gráfica protagonista**, NO background con texto encima. Texto arriba/al costado, imagen completa y sin recortar.
4. **CTA "Solicitar demo"** → abre un **modal con formulario corto** (recomendado, ver §7). Fallback degradado a `mailto:`.
5. **"Iniciar sesión"** → `keycloak.login()` (se conserva el comportamiento actual).
6. **Acento = `var(--color-primary)`** en todos los CTAs primarios, kickers y focos.
7. Componentizar en **~13 componentes React** (§9) para mantenibilidad y reutilización.

---

## 1. Sistema visual de la landing

### 1.1 Grilla y contenedor
- **Contenedor maestro (`SectionContainer`)**: `max-width: 1200px; margin-inline: auto; width: 100%`.
- **Padding lateral fluido (gutter):** `padding-inline: clamp(1rem, 5vw, 2rem)`.
  - En 360px → ~1rem (16px). En 1280px → 2rem (32px).
- **Grilla interna de secciones de 2 columnas (hero, odontograma, whatsapp):** CSS Grid.
  - Desktop (≥768px): `grid-template-columns: 1.05fr 0.95fr` (o `1fr 1fr` según sección).
  - Mobile (<768px): `grid-template-columns: 1fr` (apilado).
- **Grillas de tarjetas (beneficios, módulos, etc.):**
  `grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr))`.
  El `min(100%, 260px)` es **obligatorio** (evita overflow en 360px, regla §7 de la skill).

### 1.2 Ritmo de espaciado vertical
Escala de espaciado de la skill (`0.25 · 0.5 · 0.75 · 1 · 1.25 · 1.75 · 2 rem`), extendida para secciones grandes:
- **Padding vertical por sección (`section-pad-y`):** `clamp(3rem, 8vw, 6rem)` (top y bottom).
- **Separación título de sección ↔ contenido:** `clamp(1.5rem, 4vw, 2.5rem)`.
- **Gap entre tarjetas en grilla:** `clamp(1rem, 2.5vw, 1.5rem)`.
- **Gap entre kicker → título → subtítulo:** `0.5rem` / `0.75rem`.

Resultado: el "ritmo" se percibe como respiración generosa (estilo Mercado Pago), idéntico tanto en mobile (comprimido) como en desktop (amplio), sin saltos bruscos gracias a `clamp()`.

### 1.3 Escala tipográfica (con clamp)
Base Inter (`var(--font-title)`). Fluida en todos los tamaños mayores a body:

| Rol | Tamaño (clamp) | Peso | Color |
| :-- | :-- | :-- | :-- |
| H1 hero | `clamp(2rem, 5.5vw, 3.25rem)` | 800 | `--color-text` |
| H2 sección | `clamp(1.5rem, 3.5vw, 2.25rem)` | 700 | `--color-text` |
| H3 destacada (odontograma/whatsapp) | `clamp(1.4rem, 3vw, 2rem)` | 700 | `--color-text` |
| Kicker (etiqueta) | `0.75rem` | 700 | `--color-primary` |
| Título de tarjeta | `clamp(1rem, 2vw, 1.15rem)` | 600 | `--color-text` |
| Subtítulo de sección | `clamp(0.95rem, 2vw, 1.1rem)` | 500 | `--color-muted` |
| Body / descripción tarjeta | `0.9rem` (line-height 1.5) | 500 | `--color-muted` |
| Microcopy / legal | `0.75rem` | 500 | `--color-muted` |

- **Kicker:** mayúsculas, `letter-spacing: 0.06em`, color `--color-primary`. Es el separador semántico de las secciones destacadas.
- **H1 line-height:** 1.12; **H2** 1.2; **body** 1.5.
- **`text-wrap: balance`** en H1/H2 para evitar viudas y líneas huérfanas feas.

### 1.4 Color, sombra y radio (solo tokens)
- **Acento de acción/marca:** `var(--color-primary)` (≈ `--color-cyan` #0284c7 por defecto, configurable por tenant).
- **Acentos de apoyo (solo decorativos, nunca único portador de info):** `--color-emerald` (salud/check), `--color-violet` (admin/seguridad). Usar con moderación, p.ej. el ícono de check de los bullets en emerald.
- **Superficies:** secciones alternan `--bg-base` ↔ `--bg-surface` (ver §1.5). Tarjetas: `--bg-surface` con `border: 1px solid var(--border-color)`.
- **Sombras:** tarjetas en reposo `--shadow-sm`; hover `--shadow-card`. Hero/CTA final pueden usar `--shadow-md`.
- **Radios:** botones/inputs `12px`; tarjetas `16px`; tarjetas premium (módulos destacados) `var(--radius-premium)` (24px); pills/badges `14px`.
- **Transición:** `var(--transition-smooth)` en todos los hover/focus.

### 1.5 Fondos alternados (separación visual de las 12 secciones)
Para que las secciones "se lean" como bloques distintos sin líneas duras:

| # | Sección | Fondo |
| :-- | :-- | :-- |
| 0 | Nav | `--bg-surface` translúcido (sticky, ver §6) |
| 1 | Hero | `--bg-surface` (#fff) |
| 2 | Trust bar | `--bg-base` (banda gris suave, contrasta con hero) |
| 3 | Beneficios | `--bg-surface` |
| 4 | Módulos | `--bg-base` |
| 5 | Odontograma (destacado) | `--bg-surface` |
| 6 | WhatsApp (destacado) | `--bg-base` |
| 7 | Cómo funciona | `--bg-surface` |
| 8 | Confianza/seguridad | `--bg-base` |
| 9 | Para quién es | `--bg-surface` |
| 10 | CTA final | **banda de acento**: fondo `--bg-surface` con un panel interno de gradiente sutil derivado de `--color-primary` (ver §3, sección 10) |
| 11 | Footer | `--color-text` (slate oscuro) como pie, texto claro — único bloque oscuro, intencional como cierre |

Patrón: zebra `surface / base`. La transición entre bandas es por contraste de fondo, sin bordes; opcionalmente un `border-top: 1px solid var(--border-color)` muy sutil entre bandas del mismo color (no aplica aquí porque alternan).

---

## 2. Componentes reutilizables a crear

Crear en `hce-frontend/src/components/landing/`. Reutilizar del inventario de `index.css` donde se indica.

| Componente | Rol | Reutiliza de `index.css` |
| :-- | :-- | :-- |
| `SectionContainer` | Wrapper: ancho máx 1200px + gutter + padding vertical. Prop `bg="base"|"surface"`. Renderiza `<section aria-labelledby>`. | — (layout puro) |
| `SectionHeading` | Kicker opcional + H2 + subtítulo, centrado o izquierda. | tipografía de §1.3 |
| `LandingNav` | Barra superior sticky con logo SVG + anclas + 2 CTAs. | `.btn`, `.btn-primary`, `.btn-secondary` |
| `Hero` | Layout 2 col (texto + ilustración). | `.btn-primary`, `.animate-fade-in-up` |
| `TrustBar` | Fila de 4 sellos (ícono + label + texto corto). | — |
| `FeatureCard` | Tarjeta de beneficio: ícono + título + descripción. | `.panel` como base |
| `ModuleCard` | Tarjeta de módulo: ícono + nombre + frase. Variante más compacta que FeatureCard. | `.panel` |
| `HighlightSection` | Sección destacada 2 col (imagen + texto + kicker + bullets + CTA contextual). Prop `reverse` para alternar lado de la imagen. | `.btn-primary` |
| `StepCard` | Paso numerado (badge nº + ícono + título + texto). | — |
| `TrustCard` | Tarjeta de seguridad: ícono + título + texto. (Puede ser `FeatureCard` con variante.) | `.panel` |
| `AudienceCard` | Tarjeta "para quién es". (Variante de `FeatureCard`.) | `.panel` |
| `FinalCTA` | Banda de cierre con título grande + 2 CTAs. | `.btn-primary`, `.btn-secondary` |
| `LandingFooter` | Pie oscuro con marca, columnas de enlaces, legal, firma de estándares. | — |
| `DemoModal` | Modal con formulario corto "Solicitar demo" (§7). | `.search-input`, `.btn-primary` |
| `LandingImage` | Wrapper de imagen con `loading="lazy"`, `aspect-ratio` fijo y **placeholder elegante** (skeleton/ilustración de fallback) si el archivo aún no existe. | `--bg-card`, `--border-color` |

> **Nota de consolidación:** `FeatureCard`, `ModuleCard`, `TrustCard`, `AudienceCard` comparten estructura (ícono + título + texto). Implementar **un único `InfoCard`** con props (`icon`, `title`, `body`, `variant`, `accent`) y derivar las demás como presets. Si el patrón se repite ≥3 veces, promover `.info-card` a clase en `index.css` (regla §4 de la skill).

### 2.1 Placeholder elegante (`LandingImage`)
Mientras la imagen no exista en `public/img/`:
- Caja con `aspect-ratio` correcto, fondo `--bg-card`, borde `1px dashed var(--border-color)`, radio 16px.
- Centro: ícono lucide grande (`ImageIcon`) en `--color-muted` + texto chico "Ilustración: `landing_xxx.png`".
- Detección: `onError` del `<img>` → muestra el placeholder. Así la sección **nunca rompe** aunque falte el asset.

---

## 3. Spec sección por sección

> En cada sección: `<section id="..." aria-labelledby="...">`. Padding vertical `clamp(3rem, 8vw, 6rem)` salvo trust bar (más comprimida) y nav/footer.

---

### Sección 0 — Nav (`LandingNav`)
- **Estructura:** `[Logo SVG + "Denta Cloud / Odontología Digital"]` ··· `[Beneficios · Módulos · Cómo funciona]` ··· `[Iniciar sesión] [Solicitar demo]`.
- **Logo:** se **conserva el SVG existente** de `LandingLogin.tsx` (líneas 78–98). Migrar sus fills literales a tokens donde aplique (el SVG de marca puede mantener su paleta propia de logo, pero el texto "Denta Cloud" usa `--color-text`).
- **Jerarquía de CTAs:** `Solicitar demo` = `.btn .btn-primary` (relleno `--color-primary`). `Iniciar sesión` = `.btn .btn-secondary` (outline/ghost). Demo domina visualmente; login subordinado.
- **Comportamiento:** **sticky** (`position: sticky; top: 0; z-index: 50`), fondo `--bg-surface` con `backdrop-filter: blur(8px)` y `border-bottom: 1px solid var(--border-color)` que aparece al hacer scroll (>16px). Scroll suave a anclas (`scroll-behavior: smooth` + `scroll-margin-top` en cada `<section>` = altura del nav, ~72px).
- **Responsive:**
  - **1280:** todo en una fila.
  - **768:** se ocultan las anclas de texto centrales; quedan logo + 2 CTAs.
  - **360:** logo (puede colapsar el subtítulo "Odontología Digital") + botón hamburguesa que abre un **drawer** con anclas + CTAs apilados a ancho completo. Alternativa simple si no se quiere drawer: dejar solo `Solicitar demo` (primario) visible y mover anclas al footer.
- **Estados:** anclas con `:hover`/`:focus-visible` → color `--color-primary` + subrayado animado. Foco visible global ya existe.
- **Touch:** botones y links ≥44px de alto.

---

### Sección 1 — Hero (`Hero`)
**Restricción crítica resuelta:** `landing_hero.png` es una ilustración con contenido a lo ancho (papel a la izquierda, digital a la derecha). **NO** va de background con texto encima. Se trata como **pieza gráfica protagonista, completa y sin recortar.**

- **Layout desktop (≥768px):** Grid 2 columnas `1.05fr 0.95fr`.
  - **Columna izquierda (texto):** H1 + subtítulo + fila de CTAs + microcopy.
    - H1: "Tu clínica odontológica, ordenada y en la nube."
    - Subtítulo (copy de la estrategia, sección 1).
    - CTAs: `[Solicitar demo]` (`.btn-primary`, grande) + `[Ver cómo funciona]` (link/ghost que ancla a `#como-funciona`).
    - Microcopy bajo el botón: "Te mostramos la plataforma funcionando con un caso real de tu especialidad. Sin compromiso." en `--color-muted`, `0.83rem`.
  - **Columna derecha (imagen):** `landing_hero.png` mediante `LandingImage`, `object-fit: contain`, `width: 100%`, sin recorte. `aspect-ratio` según la imagen real (medir; estimar **~4:3 / ~16:10**). Sombra suave opcional (`--shadow-card`) sobre un sutil panel `--bg-card` redondeado detrás para "asentarla".
- **Layout mobile (<768px):** **una columna, texto arriba, imagen debajo a todo el ancho** del contenedor (con su gutter). Imagen `object-fit: contain` para que **se vea completa** (ambos lados), sin crop. CTAs a ancho completo (`width: 100%`) apilados, `Solicitar demo` primero.
- **Responsive específico:**
  - **360:** H1 baja a `~2rem` (clamp), CTAs full-width apilados, imagen completa debajo.
  - **768:** transición: aún puede ser 1 columna (texto arriba, imagen abajo centrada con `max-width: 560px`) o ya 2 columnas; recomendado **2 columnas desde 900px** y 1 columna entre 768–899 para que la imagen no quede minúscula. Definir breakpoint del hero en **900px**.
  - **1280:** 2 columnas amplias, imagen a tamaño cómodo.
- **Imagen:** `public/img/landing_hero.png` (ya existe). Rol: protagonista. Aspecto: el real de la imagen (no forzar crop).
- **Íconos lucide:** ninguno obligatorio dentro del hero (la ilustración lleva el peso); opcional un `ArrowRight` dentro del CTA primario y `PlayCircle`/`ChevronDown` en "Ver cómo funciona".
- **Animación:** `.animate-fade-in-up` en el bloque de texto (ya existe).
- **Estados hover/focus:** CTA primario hover → leve `translateY(-1px)` + `--shadow-md`; foco visible.

---

### Sección 2 — Trust bar (`TrustBar`)
- **Fondo:** `--bg-base` (banda gris que separa del hero blanco).
- **Layout:** fila de **4 sellos**. Grid `repeat(auto-fit, minmax(min(100%, 220px), 1fr))`.
  - Cada sello: ícono (color `--color-primary`, strokeWidth 1.5) + **título corto en `--color-text`** + descripción en `--color-muted` (`0.83rem`).
- **Contenido (copy estrategia §2):** 100% en la nube (`Cloud`) · Datos seguros (`ShieldCheck`) · Estándar HL7 FHIR R4 (`Network`) · Hecho para Argentina (`MapPin`).
- **Responsive:**
  - **1280/768:** 4 en fila → 2×2.
  - **360:** apilan a 1 columna O quedan 2×2 compactos (preferir 2×2 con texto más chico para no alargar). Sin scroll horizontal.
- **Padding vertical:** más comprimido que las demás: `clamp(1.5rem, 4vw, 2.5rem)`.
- **Accesibilidad:** el ícono es decorativo (`aria-hidden`); el texto porta la info (no depender del color).

---

### Sección 3 — Beneficios clave (`FeatureCard` ×6)
- **Fondo:** `--bg-surface`.
- **Encabezado:** `SectionHeading` centrado — H2 "Todo lo que tu consultorio necesita, en un solo lugar" + subtítulo "Menos papeles, menos sistemas sueltos, más tiempo para tus pacientes."
- **Grilla:** `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`.
  - 1280 → 3 columnas (6 tarjetas = 2 filas). 768 → 2 columnas. 360 → 1 columna.
- **FeatureCard:** `.panel`-base; padding `clamp(1.25rem, 4vw, 1.75rem)`; en la parte superior un **chip de ícono** (caja 44×44, radio 12px, fondo tinte del primario — `--color-pastel-blue` o `color-mix` del primario al ~10%, ícono `--color-primary`); título (600) + descripción (`--color-muted`).
- **Contenido + íconos (estrategia §3 y §6):**
  1. Historia clínica completa → `FileText`
  2. Odontograma interactivo de doble capa → `Layers`
  3. Agenda y turnos sin fricción → `CalendarDays`
  4. Turnos por WhatsApp con IA → `MessageCircle` (+ `Sparkles` chico)
  5. Obras sociales y PAMI → `FileCheck2`
  6. Tu marca, no la nuestra → `Palette`
- **Hover:** `border-color: var(--color-primary)` + eleva a `--shadow-card` + `translateY(-2px)`. Bajo `@media (hover:hover)`; en táctil `:active`.
- **Jerarquía:** ícono → título → texto, lectura vertical clara.

---

### Sección 4 — Módulos (`ModuleCard` ×6)
- **Fondo:** `--bg-base`.
- **Encabezado:** H2 "Activá solo lo que tu clínica necesita" + subtítulo modular.
- **Grilla:** igual a beneficios (`auto-fit` 3/2/1). `ModuleCard` más compacta (ícono inline a la izquierda del nombre, frase corta debajo).
- **Contenido + íconos (estrategia §4 y §6):** Historia Clínica Odontológica (`Stethoscope`) · Agenda y Turnos (`CalendarDays`) · Turnos por WhatsApp IA (`MessageCircle`) · Obras Sociales y PAMI (`FileCheck2`) · White-label (`Palette`) · Seguridad y Auditoría (`ShieldCheck`).
- **Microcopy de cierre del bloque** (estrategia): centrado bajo la grilla, `--color-muted`, con `Solicitar demo` como link/ghost: "¿No sabés por dónde empezar? En la demo armamos el combo justo para tu clínica."
- **Diferenciación visual vs. Beneficios:** los módulos pueden llevar un pequeño **badge "Módulo"** (pill, `--color-violet` tinte) en la esquina para reforzar que son activables. Beneficios = valor; Módulos = piezas activables.
- **Responsive/hover:** idéntico patrón a Beneficios.

---

### Sección 5 — Odontograma destacado (`HighlightSection`)
- **Fondo:** `--bg-surface`.
- **Layout:** 2 columnas. **Imagen a la izquierda, texto a la derecha** (o al revés; ver alternancia con sección 6).
  - **Texto:** Kicker "EL CORAZÓN DE LA HISTORIA CLÍNICA" (`--color-primary`) + H3 "Un odontograma que se entiende de un vistazo" + párrafo + lista de 3 bullets (cada bullet con `Check`/`CheckCircle2` en `--color-emerald`) + CTA contextual `[Quiero verlo en acción]` (`.btn-primary`).
  - **Imagen:** `public/img/landing_odontograma.png` (a generar). Rol: captura/ilustración del odontograma de doble capa. **Aspecto recomendado 4:3** (o 3:2). `LandingImage` con placeholder.
- **Íconos:** kicker puede ir acompañado de `Layers`; bullets con check emerald.
- **Responsive:**
  - **1280/768 (≥900px):** 2 columnas.
  - **<900px / 360:** 1 columna → **imagen arriba, texto abajo** (en destacadas, la imagen primero para enganchar). CTA full-width.
- **Hover/focus:** CTA igual a hero. La imagen puede tener un hover sutil de escala (`scale(1.01)`) solo en `@media (hover:hover)`.

---

### Sección 6 — Turnos por WhatsApp con IA (`HighlightSection reverse`)
- **Fondo:** `--bg-base`.
- **Layout:** 2 columnas **alternadas** respecto a la sección 5 (prop `reverse`): **texto a la izquierda, imagen a la derecha** en desktop. Esta alternancia crea el ritmo visual zigzag.
  - **Texto:** Kicker "MENOS TELÉFONO, MÁS CONSULTORIO" + H3 "Tus pacientes sacan turno por WhatsApp, solos" + párrafo + 3 bullets + CTA `[Sumá WhatsApp a tu clínica]`.
  - **Imagen:** `public/img/landing_whatsapp.png` (a generar). Rol: mockup conversación WhatsApp ↔ agenda. **Aspecto 4:3** o **9:16 recortado en marco de teléfono** (preferir 4:3 para consistencia con sección 5).
- **Íconos:** kicker con `MessageCircle` + `Sparkles` (IA); bullets con check emerald.
- **Responsive:** igual a sección 5 (1 columna en <900px, imagen arriba).
- **Detalle de marca:** el acento de los checks puede usar el verde WhatsApp solo si se agrega como token; **NO** hardcodear `#25D366`. Por defecto usar `--color-emerald`.

---

### Sección 7 — Cómo funciona (`StepCard` ×3)
- **Fondo:** `--bg-surface`. `id="como-funciona"` (destino del ancla del hero/nav).
- **Encabezado:** H2 "Empezar es simple".
- **Layout:** 3 pasos en fila (grid 3 col). Cada `StepCard`: **badge numérico** (círculo 36px, fondo `--color-primary`, número blanco) + ícono lucide + título + texto.
  - En desktop, un conector visual sutil (línea/flecha tenue `--border-color`) entre pasos — decorativo, `aria-hidden`.
- **Contenido + íconos (estrategia §3 y §6):**
  1. Solicitás tu demo → `MousePointerClick`
  2. Configuramos tu clínica → `Settings2`
  3. Empezás a atender digital → `Rocket`
- **Responsive:** 1280/768 → 3 en fila (en 768 si aprieta, 1 col); 360 → 1 columna apilada (el conector pasa a vertical o se oculta).
- **Hover:** tarjetas estáticas; foco visible si son interactivas (no lo son → no foco).

---

### Sección 8 — Confianza / seguridad (`TrustCard` ×4)
- **Fondo:** `--bg-base`.
- **Encabezado:** H2 "La información de tus pacientes, protegida en serio" + subtítulo "La seguridad no es un extra: es la base de Denta Cloud."
- **Grilla:** `auto-fit` → 4/2/1 (1280: 4 col o 2×2; 768: 2 col; 360: 1 col).
- **Contenido + íconos (estrategia §8 y §6):** Aislamiento por clínica (`Lock`) · Identidad y accesos (`KeyRound`) · Auditoría de accesos (`History`) · Estándar HL7 FHIR R4 (`Network`).
- **Tono visual:** estas tarjetas pueden llevar el ícono en `--color-violet` (admin/seguridad) para diferenciarlas semánticamente de los beneficios (primario). Mantener contraste AA.
- **Responsive/hover:** patrón de tarjetas estándar.

---

### Sección 9 — Para quién es (`AudienceCard` ×3)
- **Fondo:** `--bg-surface`.
- **Encabezado:** H2 "Pensada para cómo trabaja la odontología argentina".
- **Grilla:** 3 col / 1 col. (3 tarjetas → 3 en fila desktop, apiladas en mobile.)
- **Contenido + íconos (estrategia §9 y §6):** Consultorios independientes (`User`) · Clínicas multi-profesional (`Users`) · Clínicas con obras sociales y PAMI (`Building2`).
- **Layout de tarjeta:** ícono grande arriba, título, texto. Estas pueden ser un poco más "ilustradas" (ícono más grande, 2.5rem).
- **Opcional:** una ilustración chica por tarjeta — archivos `landing_audiencia_*.png` (NO obligatorio; con ícono lucide alcanza). Si se usan, aspecto 1:1.

---

### Sección 10 — CTA final (`FinalCTA`)
- **Layout:** banda destacada. Panel interno a ancho de contenido con **fondo de acento sutil**: gradiente derivado de `--color-primary` mediante `color-mix(in srgb, var(--color-primary) 8%, var(--bg-surface))` → tinte claro del color del tenant (white-label respetado). Radio `var(--radius-premium)` (24px), padding generoso, centrado.
- **Contenido (estrategia §10):** H2 "Llevá tu clínica odontológica a la nube" + subtítulo + `[Solicitar demo]` (`.btn-primary` grande) + `[Ya soy cliente — Iniciar sesión]` (`.btn-secondary`).
- **Jerarquía:** demo dominante; login secundario claramente subordinado pero accesible.
- **Responsive:** texto centrado; CTAs en fila en desktop, apilados full-width en 360.
- **Hover/focus:** estándar de CTA.

---

### Sección 11 — Footer (`LandingFooter`)
- **Fondo:** `--color-text` (slate oscuro) — único bloque oscuro intencional, como cierre de página. Texto en blanco/`--bg-base`; enlaces en gris claro con hover a blanco.
- **Layout:** grid de 4 zonas (1280): `[marca + tagline]` `[Producto]` `[Empresa]` `[Cuenta]`. 768 → 2×2. 360 → 1 columna apilada.
- **Contenido (estrategia §11):**
  - Marca: logo SVG (versión clara) + "Denta Cloud · Odontología Digital" + tagline.
  - Producto: Beneficios · Módulos · Cómo funciona (anclas).
  - Empresa: Solicitar demo · Contacto.
  - Cuenta: Iniciar sesión (`keycloak.login()`).
  - Firma: "Powered by Denta Cloud · HL7 FHIR R4".
  - Legal (línea inferior, `0.75rem`): "© 2026 Denta Cloud — systia.ar · Términos · Privacidad".
- **Contraste:** verificar texto gris claro sobre slate oscuro ≥ 4.5:1.

---

## 4. Nav y CTAs — comportamiento y jerarquía

### 4.1 Nav
- **Sticky** con `backdrop-filter: blur(8px)` y borde inferior que aparece al scrollear (clase condicional `is-scrolled`).
- **Scroll suave** a anclas: `html { scroll-behavior: smooth }` + `scroll-margin-top: 80px` en cada `<section>` con `id`.
- **Anclas:** `#beneficios`, `#modulos`, `#como-funciona`.
- **Mobile:** drawer con hamburguesa (recomendado) o reducción a logo + CTA primario.

### 4.2 Jerarquía de CTAs
| CTA | Estilo | Peso visual |
| :-- | :-- | :-- |
| `Solicitar demo` | `.btn .btn-primary` (relleno `--color-primary`) | **Dominante** — aparece en nav, hero, secciones 5/6, CTA final |
| `Iniciar sesión` | `.btn .btn-secondary` (outline/ghost) | Subordinado — nav, CTA final, footer |
| `Ver cómo funciona` | link/ghost con `ChevronDown` | Terciario — solo hero |

Todos los "Solicitar demo" abren el **mismo destino** (consistencia de medición de conversión).

### 4.3 Mecanismo recomendado para "Solicitar demo": **Modal con formulario corto** (`DemoModal`)
**Recomendación: modal con formulario corto.** Justificación:
- **Califica el lead** (Producto lo pide): campos **Nombre · Clínica · Teléfono/WhatsApp · Especialidad** (+ email opcional). 4 campos = baja fricción.
- **No saca al usuario de la página** (a diferencia de `mailto:`, que depende de que tenga cliente de correo configurado — falla seguido en desktop sin Outlook).
- **Medible:** un solo punto de conversión, fácil de instrumentar.
- **Accesible:** modal con `role="dialog"`, `aria-modal="true"`, foco atrapado, cierre con `Esc` y click en overlay, foco devuelto al disparador al cerrar.
- **Envío:** como no hay backend de la landing en alcance, el envío puede:
  1. POST a un endpoint de leads (si DevOps lo provee), o
  2. **Fallback degradado:** botón de envío que arma un **enlace `wa.me`** (WhatsApp) o `mailto:` con los datos prellenados en el cuerpo. Recomendado **WhatsApp (`https://wa.me/<numero>?text=...`)** por ser el canal natural del mercado y del producto.
- **UX del modal:** validación inline mínima (teléfono requerido), estado de carga en el botón, mensaje de éxito ("¡Listo! Te contactamos a la brevedad."). Reutiliza `.search-input` y `.btn-primary`.

> Decisión final del canal de envío (endpoint vs. WhatsApp vs. mailto) la confirma el dueño; el diseño del modal es agnóstico al transporte.

---

## 5. Checklist de accesibilidad (WCAG 2.1 AA) y responsividad

### 5.1 Accesibilidad
- [ ] Contraste texto normal ≥ 4.5:1 (`--color-text`/`--color-muted` sobre superficies claras OK; verificar footer claro sobre slate).
- [ ] El color **nunca** es único portador de info: todo sello/beneficio tiene texto; íconos son apoyo.
- [ ] Íconos decorativos con `aria-hidden="true"`; CTAs con texto (o `aria-label` si solo ícono).
- [ ] Jerarquía de encabezados: un solo `<h1>` (hero); secciones con `<h2>`; tarjetas con `<h3>`. Cada `<section aria-labelledby="id-del-h2">`.
- [ ] Foco visible (`:focus-visible` global ya en `index.css`) en nav, CTAs, links, campos del modal.
- [ ] Modal accesible: `role="dialog"`, `aria-modal`, focus trap, `Esc` cierra, foco restaurado.
- [ ] Objetivos táctiles ≥ 44×44px (botones, links de nav, ítems de drawer), separación ≥ 8px.
- [ ] `prefers-reduced-motion` respetado (global) — desactiva fade-in/parallax/scale.
- [ ] Imágenes con `alt` descriptivo (hero: "Ilustración del pasaje del papel a la historia clínica digital en la nube").
- [ ] `scroll-behavior: smooth` no rompe navegación por teclado (anclas siguen enfocables).

### 5.2 Responsividad (360 / 768 / 1280)
- [ ] Mobile-first; verificado en 360, 768, 1280px.
- [ ] **Sin scroll horizontal** en ningún breakpoint. `box-sizing: border-box` global + `width: 100%` + `overflow-x: hidden` en el wrapper raíz de la landing.
- [ ] Grids fluidos con `repeat(auto-fit, minmax(min(100%, X), 1fr))` (el `min(100%, …)` es obligatorio).
- [ ] Tipografía fluida con `clamp()` en todos los títulos.
- [ ] Sin alto fijo en px que recorte texto; usar `min-height` con `clamp()` y `aspect-ratio` en imágenes.
- [ ] Hero: imagen completa sin recorte en mobile (`object-fit: contain`).
- [ ] Hover solo bajo `@media (hover: hover)`; táctil usa `:active`.
- [ ] CTAs full-width en 360px.
- [ ] Imágenes `loading="lazy"` (excepto hero, que puede ser `eager` por estar above-the-fold) + `aspect-ratio` para evitar layout shift.

---

## 6. Plan de implementación sugerido

**Partir la landing en ~13 componentes** (carpeta `hce-frontend/src/components/landing/`), más el contenedor principal que reemplaza a `LandingLogin.tsx`.

### Orden recomendado de construcción
1. **Tokens/CSS base:** agregar a `index.css` (o `landing.css` importado) las clases compartidas que falten (`.info-card`, `.landing-section`, utilidades de gutter). Confirmar que `--color-primary` está disponible pre-login (ojo: `ThemeContext` puede no haber cargado tenant aún → la landing usa el **default** `--color-cyan`; asegurar fallback).
2. **`SectionContainer` + `SectionHeading`** (layout y tipografía base) — todo lo demás depende de esto.
3. **`LandingNav`** (con sticky, scroll suave, drawer mobile) — esqueleto navegable.
4. **`Hero`** (resolver layout 2col/1col + `LandingImage` con `landing_hero.png`).
5. **`LandingImage`** (con placeholder elegante) — necesario para hero y destacadas.
6. **`InfoCard`** y sus presets (`FeatureCard`, `ModuleCard`, `TrustCard`, `AudienceCard`).
7. **`TrustBar`** (sección 2) y **Beneficios** (sección 3) — primeras grillas.
8. **`Módulos`** (sección 4) con badge "Módulo".
9. **`HighlightSection`** (secciones 5 y 6, con prop `reverse`).
10. **`StepCard`** + Cómo funciona (sección 7).
11. **Confianza** (8) y **Para quién es** (9) — reusan `InfoCard`.
12. **`FinalCTA`** (sección 10) con tinte de primario.
13. **`LandingFooter`** (sección 11, bloque oscuro).
14. **`DemoModal`** (formulario corto, accesible) — cablear a todos los `Solicitar demo`.
15. **Ensamble** en el componente raíz `LandingDentaCloud.tsx` que reemplaza/renombra a `LandingLogin.tsx`; mantener export usado por el router.
16. **QA responsive** en 360/768/1280 + checklist §5; certificación UX.

### Nombres de archivo de imágenes esperados (`hce-frontend/public/img/`)
| Sección | Archivo | Aspecto | Estado |
| :-- | :-- | :-- | :-- |
| 1 Hero | `landing_hero.png` | real (~4:3/16:10) | **ya existe** |
| 5 Odontograma | `landing_odontograma.png` | 4:3 (o 3:2) | a generar |
| 6 WhatsApp | `landing_whatsapp.png` | 4:3 | a generar |
| 9 Para quién (opcional) | `landing_audiencia_consultorio.png`, `landing_audiencia_clinica.png`, `landing_audiencia_obrasocial.png` | 1:1 | opcional / a generar |

Todas las secciones deben **funcionar con placeholder** si la imagen no existe (`LandingImage`, §2.1).

---

## 7. Notas de handoff

- **Conservar el SVG del logo** de `LandingLogin.tsx` (líneas 78–98). El resto del componente se reescribe.
- **Reemplazar todos los literales hex** del archivo actual (`#030f26`, `#1e6fd9`, `#155bb5`, etc.) por tokens. El acento de acción = `var(--color-primary)`.
- **Quitar** la imagen vieja `landing_dental_clinical.png` del hero (se usa `landing_hero.png` como pieza, no como background).
- **No usar `useState` para `isMobile`** con listeners de resize como hoy: resolver el responsive con **CSS (media queries / Grid `auto-fit` / `clamp`)**, no con JS. Es más robusto y evita parpadeos en SSR/primer render.
- **Pendiente de confirmación del dueño:** canal de envío del `DemoModal` (endpoint de leads vs. `wa.me` vs. `mailto:`). Diseño agnóstico al transporte.
- **Verificación de runtime obligatoria** (regla del proyecto): probar la landing renderizada en 360/768/1280 antes de dar por terminada, no solo que compile.
