# Maquetación UX — Historia Clínica Odontológica (DentHCE)

> ⚠️ **SUPERSEDIDO PARCIAL (2026-05-29).** Se diseñó como pestaña integrada; la implementación real es un **módulo AISLADO** (pantalla separada colgada del dashboard). Los criterios de UX siguen siendo válidos, pero la navegación final difiere. **Fuente de verdad:** `docs/walkthroughs/2026-05-29_hc_odontologica_modulo_aislado.md`.

> Entregable del agente **UX**. Fuente de verdad visual: skill `design-system` (tokens, componentes, white-label, A11y, responsividad).
> Modelos base: **PAMI/INSSJP** (3 hojas) y **Ficha Catastral — Círculo Odontológico Jujuy** (simbología + convención de color).
> Identidad: tema CLARO/clínico (no es deuda), 100% responsivo mobile-first, WCAG 2.1 AA.
> NO contiene código React. Es especificación + wireframes ASCII de alta fidelidad.

---

## 0. Principios y tokens aplicados

Todo color/medida sale de tokens (prohibido hex nuevo). Mapeo usado en esta pantalla:

| Rol UX | Token | Valor |
| :--- | :--- | :--- |
| Acción primaria / nav activa / foco | `--color-primary` (= `--color-cyan`) | tenant (default `#0284c7`) |
| **EXISTENTE / Diagnóstico (rojo)** | `--color-rose` | `#ef4444` |
| **A REALIZAR / Plan (azul)** | `--color-primary` | tenant (default cian) |
| Éxito / salud / firmado | `--color-emerald` | `#10b981` |
| Advertencia / endodoncia | `--color-amber` | `#f59e0b` |
| Texto / secundario | `--color-text` / `--color-muted` | `#1e293b` / `#64748b` |
| Superficies | `--bg-base` / `--bg-surface` / `--bg-card` | `#f6f8f9` / `#fff` / `#f8f9fa` |

> **Decisión de convención de color (resuelve Modelo 2):** el rojo del odontograma Jujuy = `--color-rose` (existente). El azul "a realizar" se mapea al **primario del tenant** (`--color-primary`), no a un azul fijo. Así el white-label sigue vivo: si el tenant elige esmeralda, el "plan a realizar" se vuelve esmeralda y mantenemos coherencia de marca. El rojo de diagnóstico se mantiene fijo por seguridad clínica (semántica de alerta universal). **(Punto abierto #1 más abajo.)**

Componentes reutilizados del inventario: `.segmented-control`/`.segmented-button` (pestañas y toggles), `.panel`, `.btn`+`.btn-primary`/`.btn-secondary`, `.search-input`, `.tooth-polygon`, `@keyframes fadeIn`. Iconografía `lucide-react`.

---

## 1. Arquitectura de navegación

La ficha hoy tiene 8 pestañas (control segmentado con scroll horizontal en móvil) en `PatientSearch.tsx`:
`Consultas · Antecedentes · Odontograma · Alergias · Signos Vitales · Recetas · Documentos · Historial`.

### Set final propuesto (11 pestañas, agrupadas)

Para no saturar la barra, las pestañas nuevas se agrupan bajo un patrón de **2 niveles**: pestañas principales + sub-secciones dentro de cada panel cuando aplica. La barra principal queda:

```
Consultas · Anamnesis · Odontograma · Estado Bucal · Plan y Diagnóstico · Consentimiento · Evolución · Antecedentes · Alergias · Signos Vitales · Recetas · Documentos · Historial
```

Decisiones por pestaña:

| Pestaña | Acción | Origen modelo | Notas |
| :--- | :--- | :--- | :--- |
| **Anamnesis** | NUEVA | PAMI Hoja 1 | Cuestionario sí/no + condicionales + higiene + **firma del paciente**. |
| **Odontograma** | MODIFICADA → DUAL | PAMI H2 + Jujuy | Doble capa Diagnóstico(rojo)/Plan(azul), leyenda simbología siempre visible. |
| **Estado Bucal** | NUEVA | PAMI Hoja 2 | Placa, periodontal, lesiones mucosa/tejido blando (zona+tipo). |
| **Plan y Diagnóstico** | NUEVA | PAMI Hoja 2 | Dx presuntivo + plan con fecha + observaciones. Lee del odontograma. |
| **Consentimiento** | NUEVA | PAMI Hoja 2 | Texto legal + doble firma (paciente + profesional M.N./M.P.). |
| **Evolución** | NUEVA | PAMI Hoja 3 | Tabla Fecha · Tratamiento realizado · Conformidad del afiliado. |
| Antecedentes/Alergias/Vitales/Recetas/Documentos/Historial | SIN CAMBIO | — | Ya existen. |

> **Alternativa de menor ruido (punto abierto #2):** agrupar `Anamnesis + Estado Bucal + Plan y Dx + Consentimiento` bajo una sola pestaña madre **"Historia Clínica PAMI"** con sub-pestañas internas, dejando la barra principal en ~9 ítems. Recomendado para móvil. Elegir con el Orquestador.

Barra global de acciones (sticky arriba del panel, derecha): `[Guardar borrador]` `[Generar HC PAMI (PDF)]`.

---

## 2. Wireframes ASCII

### 2.1 Barra de pestañas (reflujo responsivo)

**Desktop (≥1024px)** — todo visible, scroll si excede:
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ (Consultas)(Anamnesis)(Odontograma)(Estado Bucal)(Plan y Dx)(Consentimiento)(Evol…)│ ◀▶
└──────────────────────────────────────────────────────────────────────────────────┘
   ▲ pill activa: fondo tenue --color-primary, texto --color-primary, ícono lucide
```

**Mobile (360px)** — scroll horizontal táctil (patrón `.segmented-control` ya existente, `scrollbar-width:none`):
```
┌───────────────────────────────┐
│ (Anamnesis)(Odonto…)(Estado…) →│  ← swipe horizontal, sin overflow vertical
└───────────────────────────────┘
```

---

### 2.2 ANAMNESIS (PAMI Hoja 1) — pantalla nueva

**Desktop — Grid 2 columnas, colapsa a 1 en <768px**
```
┌─ Anamnesis odontológica ───────────────────────────────  [Guardar borrador] [PDF]─┐
│  Afiliado: GÓMEZ, María (Nº 150/2 03-1)   DNI 17.222.333   F.Nac 04/06/1958        │
│  Médico de cabecera: Dr. Pérez   Cód. prestador: 7788                              │
├───────────────────────────────────────────────────────────────────────────────────┤
│  CUESTIONARIO MÉDICO                                                                 │
│  ┌─────────────────────────────────────────────┐ ┌──────────────────────────────┐ │
│  │ ¿Padece alguna enfermedad?        ( Sí )(No)│ │ Diabetes              (Sí)(No)│ │
│  │   ¿Cuál? [____________________________]     │ │ Fuma                  (Sí)(No)│ │
│  │ ¿Tratamiento médico actual?       (Sí)( No )│ │   ¿Cuántos/día? [___]         │ │
│  │ ¿Toma medicación?                 ( Sí )(No)│ │ Problemas cardíacos   (Sí)(No)│ │
│  │   ¿Cuál? [____________________________]     │ │ Hipertensión (HTA)    (Sí)(No)│ │
│  │ ⚠ Alergia a alguna droga          ( Sí )(No)│ │ Aspirina/anticoagul.  (Sí)(No)│ │
│  │   ¿Cuál? [____________________________]     │ │ ¿Fue operado?         (Sí)(No)│ │
│  └─────────────────────────────────────────────┘ └──────────────────────────────┘ │
│  ▸ Una respuesta "Sí" en Alergia/Anticoagulantes resalta con borde --color-rose +  │
│    ícono ⚠ (AlertTriangle) — bandera clínica bloqueante, no solo color.            │
├───────────────────────────────────────────────────────────────────────────────────┤
│  HISTORIA CLÍNICA ODONTOLÓGICA                                                       │
│  Motivo de consulta                                                                  │
│  [______________________________________________________________________________]  │
│  ┌──────────────────────────────┐ ┌──────────────────────────────────────────────┐ │
│  │ Consulta reciente otro prof.(Sí)(No)│ Dificultad para masticar      (Sí)(No)  │ │
│  │ Dificultad para hablar (Sí)(No)│ Movilidad dentaria            (Sí)(No)       │ │
│  │ Sangrado de encías     (Sí)(No)│ Cepillados por día    [ 2 ▾ ]               │ │
│  │ Momentos de azúcar/día [ 3 ▾ ] │                                              │ │
│  └──────────────────────────────┘ └──────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────────┤
│  FIRMA DEL PACIENTE                                                                  │
│  ┌──────────────────────────────────────┐   Declaro que los datos son verídicos.   │
│  │   [ canvas de firma / huella ]        │   [ Limpiar ]   [✔ Firmar y guardar]    │
│  └──────────────────────────────────────┘   Estado: ● Sin firmar                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Mobile (360px)** — 1 columna, toggles a ancho completo (≥44px alto):
```
┌─ Anamnesis ───────── [⋮ acciones]┐
│ Afiliado: GÓMEZ, María           │
│ DNI 17.222.333                   │
├──────────────────────────────────┤
│ CUESTIONARIO MÉDICO              │
│ ¿Padece alguna enfermedad?       │
│   ( Sí )( No )                   │
│   ¿Cuál? [__________________]    │
│ ⚠ Alergia a droga  ( Sí )( No )  │ ◀ si Sí: tarjeta borde rose + ícono
│   ¿Cuál? [__________________]    │
│ Diabetes           ( Sí )( No )  │
│ Fuma               ( Sí )( No )  │
│   ¿Cuántos/día? [___]            │
│ … (resto apilado)                │
├──────────────────────────────────┤
│ FIRMA DEL PACIENTE              │
│ [   canvas firma a ancho 100%  ] │
│ [ Limpiar ]  [✔ Firmar ]        │
└──────────────────────────────────┘
```

Microcopy: pares Sí/No como `.segmented-control` de 2 botones (no checkbox suelto). Campo "¿cuál?" aparece con `fadeIn` solo si "Sí" (campo condicional). Selects numéricos para cepillados/azúcar/cigarrillos.

---

### 2.3 ODONTOGRAMA DUAL + LEYENDA — pantalla modificada

**Toggle global de capa** (decisión tomada #1): conmuta el modo de pintado y el filtro visual.

**Desktop — grilla de piezas (izq, `auto-fill minmax(130px,1fr)`) + panel lateral dividido (der, `minmax(260px,300px)`)**
```
┌─ Odontograma ──────────────────────────────────  [Guardar] [Generar HC PAMI]──────┐
│ ┌─ Capa activa ───────────────────────────┐   ┌─ Vista ─────────────┐             │
│ │( ● Diagnóstico (rojo) )( Plan a realizar )│   │(Adulto)(Infantil)(Mixto)│           │
│ └──────────────────────────────────────────┘   └─────────────────────┘            │
│                                                                                     │
│ Herramientas:  ● Caries  ● Restauración  ▲ Endodoncia  ◆ Incrustación  ⬡ Corona    │
│   ⊕ Perno corona  ⌷ Implante  • Sellante  ✕ Extracción ind.  ⊘ Ausente  ↺ Limpiar  │
│   (las herramientas heredan el color de la CAPA activa: rojo si Dx, azul si Plan)   │
│                                                                                     │
│ Registrar Pieza:[Nº 11 ▾][+ Añadir]  | 🔍[Buscar pieza] [Ver afectados ▾]          │
│ ┌──────────────────────────────────────────────────┐ ┌─────────────────────────┐  │
│ │  Nº18  Nº17  Nº16  Nº15 …  (caras V/D/L/M/O SVG)  │ │ HALLAZGOS                │  │
│ │  ┌────┐┌────┐┌────┐                                │ │ ┌─ EXISTENTE (rojo) ──┐ │  │
│ │  │ 🦷 ││ 🦷 ││ 🦷 │   ← cara pintada en rojo=Dx     │ │ │● P16 O · Caries     │ │  │
│ │  └────┘└────┘└────┘      azul=plan a realizar       │ │ │▲ P26 · Endodoncia   │ │  │
│ │  …grilla completa, scroll vertical interno…        │ │ │✕ P38 · Extrac. ind. │ │  │
│ └──────────────────────────────────────────────────┘ │ └─────────────────────┘ │  │
│                                                        │ ┌─ PLAN A REALIZAR(azul)┐│  │
│ ┌─ LEYENDA / REFERENCIAS (siempre visible) ─────────┐ │ │○ P16 O · Restauración ││  │
│ │ ●Caries(R) ●Restaur(A) ▲Endod.uni ▲▲Endod.multi  │ │ │⬡ P21 · Corona        ││  │
│ │ ◯Momificación ◆Formocresol ◇Incrustación ⬡Corona │ │ │⌷ P36 · Implante      ││  │
│ │ ⊕PernoCorona/Espiga ⊗PernoPilar ⊘Ausente •Sellante│ │ └─────────────────────┘│  │
│ │ ✕Extrac.indicada ✖Extrac.realizada                │ │  [✔ Completar → pasa a │  │
│ │ ── ROJO = existente   ── AZUL = a realizar ──     │ │   EXISTENTE (azul→rojo)]│  │
│ └───────────────────────────────────────────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Mobile (<1024px)** — 1 columna; orden: capa → herramientas (scroll horiz) → grilla → **leyenda colapsable** → paneles Existente/Plan apilados:
```
┌─ Odontograma ─────────────────┐
│ Capa: (●Diagnóstico)(Plan)    │ ◀ segmented full-width
│ Vista:(Adulto)(Infantil)(Mixto)│
│ Herram: ●Caries ●Restau ▲Endo →│ ◀ scroll horizontal
│ [Nº 11 ▾][+Añadir] 🔍[Buscar] │
│ ┌────┐┌────┐┌────┐            │ ◀ grilla 1-2 cols según ancho
│ │ 🦷 ││ 🦷 ││ 🦷 │            │
│ └────┘└────┘└────┘            │
│ ▸ Leyenda / referencias  [▾]  │ ◀ acordeón (abierto por defecto en táctil grande)
│ ┌─ EXISTENTE (rojo) ────────┐ │
│ │ ● P16 O · Caries          │ │
│ └───────────────────────────┘ │
│ ┌─ PLAN A REALIZAR (azul) ──┐ │
│ │ ○ P16 O · Restauración    │ │
│ │ [✔ Completar]             │ │
│ └───────────────────────────┘ │
└────────────────────────────────┘
```

Comportamiento dual: cada hallazgo lleva bandera `capa: 'diagnostico' | 'plan'`. En la pieza SVG, el plan se dibuja en `--color-primary` con **trazo punteado** (no solo color → cumple A11y); el existente, relleno sólido en `--color-rose`. Al pulsar "Completar" un ítem del plan, su color azul→rojo y migra al panel EXISTENTE con animación `fadeIn`. La leyenda es `<section aria-labelledby>` y nunca se oculta en desktop.

---

### 2.4 LEYENDA DE SIMBOLOGÍA — mapa símbolo → significado → color (Modelo 2 Jujuy)

| Símbolo | Significado | Capa por defecto | Color | Render SVG |
| :--- | :--- | :--- | :--- | :--- |
| ● relleno cara | Caries | Diagnóstico | `--color-rose` | cara pintada sólida |
| ● relleno cara | Restauración simple | a elección capa | rojo (hecha) / azul (a realizar) | cara sólida o punteada |
| ▦ multi-cara | Restauración compuesta | — | igual | varias caras |
| ▲ | Endodoncia unirradicular | — | `--color-amber` | 1 canal en raíz |
| ▲▲ | Endodoncia multirradicular | — | `--color-amber` | 2+ canales |
| ◯ | Momificación | — | `--color-amber` | círculo en cámara |
| ◆ | Formocresol | — | `--color-amber` | rombo en corona |
| ◇ | Incrustación | — | rojo/azul | rombo hueco en O |
| ⬡ | Corona | — | rojo/azul | contorno hexagonal en corona |
| ⊕ | Perno corona / espiga | — | rojo/azul | línea en raíz + corona |
| ⊗ | Perno pilar | — | rojo/azul | línea raíz, sin corona |
| ⊘ | Pieza ausente | Existente | `--color-muted` | X gris + raíces fantasma |
| • | Sellante | — | `--color-emerald` | punto verde en cara |
| ✕ | Extracción **indicada** | Plan | `--color-primary` | X azul punteada |
| ✖ | Extracción **realizada** | Existente | `--color-rose` | X roja sólida |

Regla A11y transversal: el color **nunca** es el único portador → cada hallazgo tiene símbolo + etiqueta de texto en el panel lateral. La barra inferior `── ROJO = existente · AZUL = a realizar ──` queda fija.

---

### 2.5 ESTADO BUCAL GENERAL (PAMI Hoja 2) — pantalla nueva
```
┌─ Estado bucal general ───────────────────────────────────────────┐
│ Placa bacteriana            ( Sí )( No )                          │
│ Enfermedad periodontal      ( Sí )( No )                          │
│ Lesiones mucosa/t. blando   ( Sí )( No )                          │
│   ▸ Zona  [Paladar ▾]   Tipo [_______________________________]   │ ◀ condicional (Sí)
└───────────────────────────────────────────────────────────────────┘
```
Mobile: apila los 3 toggles a ancho completo; el bloque zona/tipo aparece debajo con `fadeIn`.

---

### 2.6 PLAN Y DIAGNÓSTICO (PAMI Hoja 2) — pantalla nueva
```
┌─ Plan y diagnóstico ──────────────────────────────────────────────┐
│ Diagnóstico presuntivo                                             │
│ [_______________________________________________________________] │
│ Plan de tratamiento                                               │
│ ┌ Fecha ──── Procedimiento ───────────────────── Pieza ── [+]┐    │
│ │ 28/05/26   Restauración resina                  16     [🗑]  │    │ ◀ filas desde odontograma "Plan"
│ │ 04/06/26   Corona                               21     [🗑]  │    │
│ └────────────────────────────────────────────────────────────┘    │
│ Observaciones                                                     │
│ [_______________________________________________________________] │
└───────────────────────────────────────────────────────────────────┘
```
Las filas se autopueblan desde los hallazgos de capa "Plan" del odontograma (fuente única). Mobile: la tabla se convierte en tarjetas apiladas (Fecha arriba, Procedimiento, Pieza, acción).

---

### 2.7 CONSENTIMIENTO INFORMADO (PAMI Hoja 2) — pantalla nueva
```
┌─ Consentimiento informado ────────────────────────────────────────┐
│ ┌ Texto legal (scroll, --bg-card) ───────────────────────────────┐ │
│ │ Yo, GÓMEZ María, DNI 17.222.333, declaro haber sido informada…  │ │
│ │ …del plan de tratamiento, riesgos y alternativas…              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ☐ Confirmo que leí y comprendí el tratamiento propuesto.           │ ◀ obligatorio p/ habilitar firmas
│                                                                     │
│ ┌─ Firma paciente ──────────┐   ┌─ Firma profesional ───────────┐ │
│ │ [ canvas firma ]          │   │ [ canvas firma ]              │ │
│ │ [Limpiar]                 │   │ Dr. Pérez  M.N. 12345 / M.P.  │ │
│ │ ● Sin firmar              │   │ [Limpiar]   ● Sin firmar      │ │
│ └───────────────────────────┘   └───────────────────────────────┘ │
│                              [✔ Confirmar y firmar consentimiento]  │ ◀ disabled hasta check + 2 firmas
└─────────────────────────────────────────────────────────────────────┘
```
Mobile: las dos firmas se apilan (paciente arriba, profesional abajo), cada canvas a ancho 100%. Botón sticky inferior.

---

### 2.8 EVOLUCIÓN / ANEXO (PAMI Hoja 3) — pantalla nueva
```
┌─ Evolución (anexo) ──────────────────────────── [+ Nueva evolución]┐
│ ┌ Fecha ───── Tratamiento realizado ──────────── Conformidad ─────┐│
│ │ 28/05/26    Restauración resina pieza 16        ✔ Conforme (firma)││
│ │ 21/05/26    Tartrectomía completa               ✔ Conforme (firma)││
│ │ 14/05/26    Apertura cameral pieza 26           ⏳ Pendiente firma ││
│ └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```
Mobile: cada fila → tarjeta (`Fecha` como encabezado, `Tratamiento` cuerpo, `Conformidad` como pill de estado + botón "Firmar conformidad").

---

## 3. Estados (obligatorios en toda vista con datos)

| Estado | Tratamiento UX |
| :--- | :--- |
| **Carga** | Skeleton de filas/tarjetas (no salto en blanco). Toggles deshabilitados con shimmer. |
| **Vacío** | Mensaje positivo en español rioplatense: *"Todavía no cargaste la anamnesis. Empezá registrando el motivo de consulta."* / *"Sin hallazgos en el odontograma. Registrá una pieza para comenzar."* |
| **Error** | Tarjeta contenida borde `--color-rose` + ícono `ShieldAlert` + texto + `[Reintentar]`; no rompe el resto del panel. |
| **Éxito/guardado** | Banner `--color-emerald` + `CheckCircle` con `fadeIn`, autodescarta a los 3 s: *"Anamnesis guardada."* |
| **Firmado** | Sello visual: pill `--color-emerald` *"✔ Firmado por [nombre] · 28/05/26 14:02"*; canvas se bloquea (solo lectura) y muestra `[Ver]`. Botón de firma desaparece. |
| **Borrador** | Pill ámbar *"Borrador sin firmar"* en cabecera de la pestaña afectada. |

---

## 4. Accesibilidad (WCAG 2.1 AA — Quality Gate)

- **Foco visible** por teclado en todo control (`:focus-visible` global). Orden de tabulación lógico: cabecera → cuestionario (fila por fila) → firma → acciones.
- **Color nunca único indicador:** cada toggle Sí/No muestra texto; cada hallazgo del odontograma lleva símbolo + etiqueta; capas Dx/Plan se distinguen por relleno sólido vs **punteado**, no solo por tono.
- **Banderas clínicas (alergia/anticoagulantes):** color rose + ícono `AlertTriangle` + `role="alert"` + texto. Contraste ≥ 4.5:1.
- **Etiquetas:** cada `input`/`select` con `<label for>`; canvas de firma con `aria-label="Área de firma del paciente"`; botones multi-ícono con `aria-label`.
- **Objetivos táctiles** ≥ 44×44 px con separación ≥ 8 px (toggles Sí/No, botones de cara del diente en móvil agrandados).
- **Encabezados** jerárquicos; cada sección `<section aria-labelledby="...">`. Leyenda del odontograma `aria-labelledby="leyenda-simbologia"`.
- **`prefers-reduced-motion`** respetado (sin `fadeIn` si el usuario lo pide).
- **Lectores de pantalla:** al completar un ítem (azul→rojo) anunciar por `aria-live="polite"`: *"Pieza 16 cara oclusal: restauración completada."*

---

## 5. Responsividad (breakpoints — Quality Gate, verificado 360/768/1280)

| Sección | ≥1280 (desktop) | 768 (tablet) | 360 (móvil) |
| :--- | :--- | :--- | :--- |
| Pestañas | todas visibles | scroll horiz | scroll horiz táctil |
| Anamnesis | grid 2 col | grid 2 col | 1 col apilada |
| Odontograma | grilla + panel lateral 300px | grilla, panel debajo | 1 col, leyenda acordeón |
| Estado Bucal / Plan / Consent. | 2 col donde aplica | mixto | 1 col, tablas→tarjetas |
| Evolución | tabla | tabla con scroll-x suave | tarjetas apiladas |

Reglas: grids `repeat(auto-fit, minmax(min(100%, X), 1fr))` (el `min(100%,…)` evita overflow a 360); `box-sizing:border-box` + `width:100%`; sin alto fijo (usar `min-height` con `clamp()`); tipografía de títulos `clamp(1.3rem,4vw,1.6rem)`; `hover` solo bajo `@media (hover:hover)`, `:active` en táctil. Tablas PAMI **siempre** degradan a tarjetas en <768 para no romper cajas.

---

## 6. Microcopy clínico (español rioplatense)

- Toggles: pares *"Sí / No"*. Condicional: *"¿Cuál?"*, *"¿Cuántos por día?"*.
- Botones: *"Firmar y guardar"*, *"Generar HC PAMI"*, *"Completar tratamiento"*, *"Nueva evolución"*, *"Firmar conformidad"*.
- Vacíos: *"Empezá registrando el motivo de consulta."*, *"Registrá una pieza para comenzar el examen."*
- Capas: *"Diagnóstico (rojo · existente)"* / *"Plan a realizar (azul)"*.
- Firma: *"Sin firmar"* → *"✔ Firmado por … · fecha"*.
- Firma persistente del producto: *"Powered by DentHCE · HL7 FHIR R4"* en el PDF.

---

## 7. Mapeo a datos / fases (handoff a `architect` / `fhir-mcp`)

- Anamnesis → `Observation`/`QuestionnaireResponse`; banderas alergia → enlazan con pestaña Alergias (`AllergyIntolerance`).
- Hallazgos odontograma: `Condition` (existente/Dx, rojo) y `Procedure` (plan azul `status:preparation` → al completar `status:completed` y migra a existente).
- Consentimiento → `Consent` (+ firmas como `provenance`/adjunto).
- Evolución → `Procedure`/`ClinicalImpression` con conformidad firmada.

**Fases incrementales sugeridas:** F1 Anamnesis + firma · F2 Odontograma dual + leyenda · F3 Estado Bucal + Plan/Dx · F4 Consentimiento doble firma · F5 Evolución · F6 Export PDF PAMI.

---

## 8. Decisiones de diseño ABIERTAS (para el Orquestador)

1. **Color "a realizar":** ¿se mapea al `--color-primary` del tenant (recomendado, mantiene white-label) o se fija un azul `#2962ff` para fidelidad literal con Jujuy? UX recomienda el token del tenant; el rojo de Dx queda fijo por seguridad.
2. **Agrupación de pestañas:** ¿13 pestañas planas o pestaña madre "Historia Clínica PAMI" con sub-pestañas (mejor en móvil)? UX recomienda agrupar.
3. **Firma:** ¿canvas táctil (dibujo) o firma por PIN/biometría del afiliado? Define alcance legal con `security`/`product`.
4. **Simbología extendida (momificación, formocresol, perno pilar):** el odontograma SVG actual no las dibuja. ¿Se renderizan como glifos sobre la pieza (más trabajo) o como etiqueta en el panel lateral en F2, y glifos SVG en una fase posterior? UX sugiere etiqueta primero, glifo después.
5. **Edición tras firma:** ¿bloqueo total (solo addendum/evolución) o desbloqueo con doble factor? Recomendado bloqueo + addendum.
```
