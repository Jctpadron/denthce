# Variantes UX — Historia Clínica Odontológica (DentHCE)

> Entregable del agente **UX**. Fuente de verdad visual: skill `design-system` (tokens, componentes, white-label, A11y, responsividad).
> Modelos base de papel: **PAMI/INSSJP** (3 hojas) y **Ficha Catastral — Círculo Odontológico de Jujuy** (simbología rica + convención rojo=existente / azul=a realizar).
> Identidad: tema CLARO/clínico (decisión deliberada, no deuda), 100% responsivo mobile-first, WCAG 2.1 AA.
> Objetivo de este documento: **decidir el diseño más funcional y vendible** para odontólogos de Jujuy que hoy trabajan con planillas en papel, y resolver la duda **pantalla separada vs. integrada**.

---

## 0. Marco de decisión

El público objetivo (odontólogos de Jujuy con flujo de papel) impone tres tensiones que toda variante debe equilibrar:

1. **Familiaridad** — el papel PAMI/Jujuy es su modelo mental. Cuanto más se parezca, menor el rechazo inicial.
2. **Profesionalismo y venta** — debe verse moderno y serio para justificar el cambio y el precio.
3. **Robustez y escalabilidad** — la HC debe crecer (más prestaciones, más obras sociales, multi-inquilino) sin reescribirse.

**Requisitos invariantes en las 3 variantes** (no se negocian):
- Odontograma de **doble capa rojo/azul** con simbología rica (caries, restauración, endodoncia uni/multi, momificación, formocresol, incrustación, corona, perno, implante, sellante, extracción indicada/realizada, ausente).
- Convención cromática: **rojo = `--color-rose` (existente/diagnóstico)**, fijo por seguridad clínica; **azul = `--color-primary` del tenant (a realizar/plan)**, para mantener white-label vivo.
- **Firma del paciente** (canvas táctil) en anamnesis y consentimiento.
- El color **nunca** es el único portador de información (símbolo + etiqueta + relleno sólido vs. punteado).
- Mobile-safe verificado a 360 / 768 / 1280 px; tablas degradan a tarjetas < 768.

Todas reutilizan el inventario de `design-system`: `.segmented-control`/`.segmented-button`, `.panel`, `.btn`/`.btn-primary`/`.btn-secondary`, `.search-input`, `.tooth-polygon`, `@keyframes fadeIn`. Sin hex nuevo.

---

## VARIANTE A — "Fiel a la planilla" (skeuomórfica)

### Filosofía
Replicar visualmente las **3 hojas PAMI + la ficha de Jujuy** como un **único documento de scroll vertical continuo**, igual que el odontólogo voltearía las hojas de papel. Una sola página larga, sin pestañas, dividida en secciones tipo formulario con encabezados de hoja ("Hoja 1 — Anamnesis", "Hoja 2 — Examen y plan", "Hoja 3 — Evolución"). El odontograma vive embebido en su lugar exacto dentro del flujo, como en el papel. Barra de progreso lateral/superior que indica en qué "hoja" se está.

### Wireframe ASCII — Desktop (>=1024px)

```
┌─ HISTORIA CLÍNICA ODONTOLÓGICA · GÓMEZ, María (Nº 150/2 03-1) ──── [Guardar] [PDF PAMI]┐
│ Progreso:  ●━━━ Hoja 1 ──── Hoja 2 ──── Hoja 3        (scroll para avanzar ↓)           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ════════════════════════ HOJA 1 — ANAMNESIS ════════════════════════                    │
│  Afiliado: GÓMEZ, María   DNI 17.222.333   F.Nac 04/06/1958   Cód. prestador 7788        │
│  CUESTIONARIO MÉDICO                                                                      │
│   ¿Padece enfermedad? (Sí)(No)  ¿Cuál?[______]   │  Diabetes (Sí)(No)   Fuma (Sí)(No)    │
│   ¿Medicación? (Sí)(No) ¿Cuál?[______]           │  HTA (Sí)(No)   Cardíaco (Sí)(No)     │
│  ⚠ Alergia a droga (Sí)(No) ¿Cuál?[______]       │  Anticoagulantes (Sí)(No)             │
│  Motivo de consulta [_______________________________________________________________]    │
│  ── FIRMA DEL PACIENTE ──  [ canvas firma ]  [Limpiar] [✔ Firmar]   ● Sin firmar         │
│                                                                                           │
│ ════════════════════════ HOJA 2 — EXAMEN, ODONTOGRAMA Y PLAN ════════════════════════    │
│  Estado bucal: Placa(Sí)(No)  Periodontal(Sí)(No)  Lesiones mucosa(Sí)(No)               │
│  ┌─ ODONTOGRAMA (embebido, doble capa) ─────────────────────────────────────────────┐   │
│  │ Capa:(●Diagnóstico rojo)(Plan azul)  Vista:(Adulto)(Infantil)(Mixto)              │   │
│  │  18 17 16 15 14 …   ┌──┐┌──┐┌──┐  caras V/D/L/M/O SVG                              │   │
│  │  48 47 46 45 44 …   └──┘└──┘└──┘  rojo=existente · azul punteado=a realizar       │   │
│  │  LEYENDA: ●Caries ●Restaur ▲Endo ⬡Corona ⊕Perno ⌷Implante •Sellante ✕Extrac …   │   │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│  Diagnóstico presuntivo [____________________________]                                    │
│  Plan:  28/05 Restauración resina · P16   │   04/06 Corona · P21   [+ fila]              │
│  ── CONSENTIMIENTO ──  ☐ Leí y comprendí.  Firma paciente[canvas]  Firma prof.[canvas]   │
│                                                                                           │
│ ════════════════════════ HOJA 3 — EVOLUCIÓN ════════════════════════                     │
│  28/05 Restauración resina P16 ……… ✔ Conforme (firma)         [+ Nueva evolución]        │
│  21/05 Tartrectomía completa ……… ✔ Conforme (firma)                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Wireframe ASCII — Mobile (360px)

```
┌─ HC Odontológica · GÓMEZ ───┐
│ ●━━ H1 ── H2 ── H3   [Guardar]│ ◀ progreso sticky arriba
├──────────────────────────────┤
│ ═══ HOJA 1 — ANAMNESIS ═══   │
│ DNI 17.222.333               │
│ ¿Padece enfermedad?(Sí)(No)  │
│ ⚠ Alergia a droga (Sí)(No)   │ ◀ si Sí: tarjeta borde rose
│ Motivo [__________________]  │
│ FIRMA [ canvas 100% ][✔]     │
│ ═══ HOJA 2 — EXAMEN ═══      │
│ Placa(Sí)(No) Period.(Sí)(No)│
│ ┌ ODONTOGRAMA ────────────┐  │
│ │Capa:(●Dx)(Plan) full-w  │  │
│ │ ┌──┐┌──┐┌──┐  scroll int │  │
│ │ Leyenda [▾ acordeón]    │  │
│ └─────────────────────────┘  │
│ Dx [__________________]      │
│ Plan: 28/05 Restaur. P16     │
│ CONSENT. ☐ Leí · 2 firmas    │
│ ═══ HOJA 3 — EVOLUCIÓN ═══   │
│ 28/05 Restaur. P16 ✔Conforme │
└──────────────────────────────┘
   (todo en un solo scroll largo)
```

### Cómo se siente para un odontólogo que viene del papel
**Inmediatamente familiar.** Es "su planilla en la pantalla": el orden de las hojas, los bloques y hasta los nombres de sección coinciden con lo que ya completa a mano. Cero curva de traducción mental. La adopción emocional es la más alta de las tres.

### Ventajas
- Máxima familiaridad → menor resistencia al cambio, argumento de venta directo ("es tu ficha de siempre, pero digital").
- Visión completa de la HC de un vistazo (todo en una página); buena para imprimir/exportar fiel al PDF PAMI.
- Implementación conceptualmente simple: una pantalla, sin lógica de navegación.

### Desventajas
- Página muy larga → en escritorio obliga a mucho scroll; localizar un dato puntual es lento.
- En móvil, una sola columna larguísima fatiga y enotorpece la carga rápida en ronda.
- Pobre escalabilidad: agregar una obra social nueva o un módulo (p. ej. periodontograma) hace crecer la página sin estructura; se vuelve inmanejable.
- El odontograma (componente pesado) embebido en medio del scroll compite por espacio con el resto y complica el rendimiento en móviles modestos.
- Difícil guardado parcial/granular: el modelo "documento único" empuja a guardar todo junto.

### Escalabilidad: **Baja.**
### Curva de aprendizaje: **Muy baja** (idéntica al papel).
### Esfuerzo de implementación (sobre lo existente): **Medio.** Hay que crear una pantalla nueva de página larga y re-embeber el `Odontogram.tsx` actual; no reaprovecha el patrón de pestañas ya presente en `PatientSearch.tsx`. La firma (canvas) es nueva en cualquier variante.
### Vendibilidad Jujuy: **Alta** (gancho de demo potentísimo), pero con techo: impresiona al inicio y decepciona en uso intensivo.

---

## VARIANTE B — "Clínica moderna por pestañas/secciones" (la ya bocetada)

### Filosofía
Integrar la HC odontológica **dentro de la ficha existente** como una pestaña madre "HC Odontológica" con sub-pestañas modulares: Anamnesis · Odontograma · Estado Bucal · Plan y Dx · Consentimiento · Evolución. Cada módulo es autónomo, se guarda por separado y reutiliza el `.segmented-control` ya presente. Navegación no lineal: el profesional salta a la sección que necesita. Es el enfoque de software clínico moderno (estilo EHR profesional).

### Wireframe ASCII — Desktop (>=1024px)

```
┌─ Ficha: GÓMEZ, María ──────────────────────────────────────────── [Guardar][PDF PAMI]──┐
│ (Consultas)(HC Odontológica ●)(Antecedentes)(Alergias)(Vitales)(Recetas)(Documentos) ◀▶ │
│   └─ sub: (Anamnesis)(Odontograma)(Estado Bucal)(Plan y Dx)(Consentimiento)(Evolución)  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Sub-pestaña activa: ODONTOGRAMA ]                                                        │
│ ┌─ Capa ─────────────────────────┐   ┌─ Vista ──────────────┐                            │
│ │(●Diagnóstico rojo)(Plan azul)  │   │(Adulto)(Infantil)(Mixto)│                          │
│ └────────────────────────────────┘   └──────────────────────┘                            │
│ Herram: ●Caries ●Restaur ▲Endo ◆Form ◇Incrust ⬡Corona ⊕Perno ⌷Implante •Sellante ✕Extr  │
│ ┌──────────────────────────────────────────────┐ ┌─ HALLAZGOS ─────────────────────┐     │
│ │ 18 17 16 15 …   ┌──┐┌──┐┌──┐  caras SVG       │ │ EXISTENTE (rojo)                │     │
│ │ 48 47 46 45 …   └──┘└──┘└──┘                   │ │  ● P16 O · Caries               │     │
│ │ rojo=existente · azul punteado=a realizar      │ │  ▲ P26 · Endodoncia             │     │
│ │ …grilla scroll interno…                        │ │ PLAN A REALIZAR (azul)          │     │
│ │                                                 │ │  ○ P16 O · Restauración         │     │
│ │ LEYENDA fija: rojo=existente · azul=a realizar │ │  ⬡ P21 · Corona  [✔ Completar]  │     │
│ └──────────────────────────────────────────────┘ └─────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────────────────────┘
   (cambiar de sub-pestaña intercambia el panel; el resto de la ficha sigue accesible arriba)
```

### Wireframe ASCII — Mobile (360px)

```
┌─ GÓMEZ, María ──────────────┐
│ (HC Odonto ●)(Antec.)(Alerg)→│ ◀ scroll horiz pestañas madre
│ (Anamnesis)(Odonto●)(Estado)→│ ◀ scroll horiz sub-pestañas
├──────────────────────────────┤
│ Capa:(●Dx)(Plan)  full-width │
│ Vista:(Adulto)(Inf)(Mixto)   │
│ Herram: ●Car ●Rest ▲Endo →   │ ◀ scroll horiz
│ ┌──┐┌──┐┌──┐  grilla 1-2 col │
│ └──┘└──┘└──┘                 │
│ ▸ Leyenda [▾]                │
│ ┌ EXISTENTE (rojo) ────────┐ │
│ │ ● P16 O · Caries         │ │
│ └──────────────────────────┘ │
│ ┌ PLAN (azul) ─────────────┐ │
│ │ ○ P16 · Restaur [✔ Compl]│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
   (solo el módulo activo en pantalla)
```

### Cómo se siente para un odontólogo que viene del papel
**Requiere una pequeña traducción mental:** las "hojas" ahora son pestañas. Al inicio puede preguntar "¿dónde quedó tal cosa?", pero una vez aprendido, es más rápido que el papel porque va directo a lo que necesita. Sensación de "software profesional", no de "planilla escaneada".

### Ventajas
- **Máxima escalabilidad:** agregar un módulo = agregar una sub-pestaña, sin tocar el resto.
- Reutiliza el patrón de pestañas y el `Odontogram.tsx` ya existentes → menor esfuerzo y coherencia con la ficha actual.
- Carga rápida en ronda: el médico abre la sub-pestaña puntual sin scrollear.
- Guardado granular por módulo; mejor rendimiento (solo se monta el panel activo).
- Se integra naturalmente con Alergias/Vitales/Recetas ya existentes (no duplica datos).

### Desventajas
- Menos "wow" de familiaridad inmediata; la HC se reparte en pestañas y se pierde la visión de página completa.
- Riesgo de saturar la barra de pestañas → mitigado con el patrón de 2 niveles (pestaña madre + sub).
- Un usuario muy poco técnico puede no saber por dónde empezar (no hay orden impuesto).

### Escalabilidad: **Muy alta.**
### Curva de aprendizaje: **Media-baja.**
### Esfuerzo de implementación (sobre lo existente): **Bajo-medio.** Es el camino más cercano a lo que ya hay (pestañas en `PatientSearch.tsx`, `Odontogram.tsx`); se agregan sub-pestañas y los 5 módulos nuevos. Detallado en `hc-odontologica-ux.md`.
### Vendibilidad Jujuy: **Media-alta.** Vende "modernidad y eficiencia"; pierde un poco frente al impacto skeuomórfico de A en la primera impresión.

---

## VARIANTE C — "Wizard guiado por flujo de consulta" (paso a paso)

### Filosofía
Guiar al profesional en el **orden real de la atención**: Admisión → Anamnesis → Odontograma → Diagnóstico/Plan → Consentimiento → Evolución. Un asistente de pasos (stepper) con avance Anterior/Siguiente, barra de progreso, y validaciones por paso (no se firma el consentimiento sin plan, no se avanza sin motivo de consulta). Estandariza la carga y reduce errores u omisiones. Pensado para usuarios poco técnicos y para garantizar HC completas (auditables para PAMI). Permite "saltar a paso" para usuarios expertos.

### Wireframe ASCII — Desktop (>=1024px)

```
┌─ Nueva consulta · GÓMEZ, María ──────────────────────────────── [Guardar borrador][Salir]┐
│  ①Admisión ─ ②Anamnesis ─ ③Odontograma ─ ④Dx/Plan ─ ⑤Consent. ─ ⑥Evolución             │
│  ●━━━━━━━━━━━━━●━━━━━━━━━━━━○────────────○──────────○──────────○   (paso 3 de 6)          │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  PASO 3 — ODONTOGRAMA                                  "Registrá hallazgos y lo que vas a hacer"│
│  ┌─ Capa ─────────────────────┐  ┌─ Vista ──────────┐                                      │
│  │(●Diagnóstico rojo)(Plan azul)│ │(Adulto)(Inf)(Mixto)│                                    │
│  └──────────────────────────────┘ └──────────────────┘                                      │
│  Herram: ●Caries ●Restaur ▲Endo ⬡Corona ⊕Perno ⌷Implante •Sellante ✕Extracción           │
│  ┌────────────────────────────────────────────┐ ┌─ Resumen del paso ──────────────────┐    │
│  │ 18 17 16 …  ┌──┐┌──┐┌──┐  caras SVG          │ │ Existente: P16 caries, P26 endod.   │    │
│  │ 48 47 46 …  └──┘└──┘└──┘                       │ │ Plan: P16 restaur., P21 corona      │    │
│  │ LEYENDA fija: rojo=existente · azul=a realizar │ │ (alimenta el Paso 4 Dx/Plan)        │    │
│  └────────────────────────────────────────────┘ └─────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                   [◀ Anterior: Anamnesis]      [Siguiente: Dx/Plan ▶]        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Wireframe ASCII — Mobile (360px)

```
┌─ Nueva consulta · GÓMEZ ────┐
│ Paso 3 de 6 · Odontograma   │
│ ●━━━●━━━○──○──○──○          │ ◀ progreso compacto sticky
├──────────────────────────────┤
│ "Registrá hallazgos y plan"  │
│ Capa:(●Dx)(Plan) full-width  │
│ Vista:(Adulto)(Inf)(Mixto)   │
│ Herram: ●Car ●Rest ▲Endo →   │
│ ┌──┐┌──┐┌──┐ grilla 1-2 col  │
│ └──┘└──┘└──┘                 │
│ ▸ Leyenda [▾]                │
│ Resumen: Existente P16 caries│
│          Plan P16 restaur.   │
├──────────────────────────────┤
│ [◀ Anterior]  [Siguiente ▶]  │ ◀ botones sticky abajo, full-width
└──────────────────────────────┘
```

### Cómo se siente para un odontólogo que viene del papel
**Tranquilizador y didáctico.** Lo lleva de la mano en el orden en que ya atiende: no tiene que decidir nada sobre la herramienta, solo seguir el flujo. Ideal para el que le teme a la computadora. El experto, en cambio, puede sentirlo lento/encorsetado si tiene que reabrir una HC para corregir un solo dato (el wizard está pensado para "crear", no tanto para "consultar/editar puntual").

### Ventajas
- **Estandariza** la carga: HC siempre completas, menos omisiones → fuerte para auditoría PAMI.
- Mejor onboarding para usuarios no técnicos; reduce el miedo a la pantalla en blanco.
- Validaciones por paso evitan errores (firmar sin consentimiento, plan sin diagnóstico).
- Excelente experiencia móvil de "carga en el momento de atender".

### Desventajas
- Malo para **consulta/edición puntual** de un paciente ya cargado (hay que recorrer el flujo o saltar pasos).
- Rígido para el experto; puede generar fricción tras la curva inicial.
- Mayor esfuerzo de implementación: motor de pasos, validaciones, persistencia de estado entre pasos, modo "saltar a paso".
- La visión global de la HC se diluye en pasos; necesita una vista-resumen aparte.

### Escalabilidad: **Media-alta** (agregar un paso es posible, pero altera el flujo lineal).
### Curva de aprendizaje: **La más baja para crear** (guiado), media para editar.
### Esfuerzo de implementación (sobre lo existente): **Alto.** Requiere infraestructura nueva de stepper, validaciones inter-paso y manejo de estado; reaprovecha los paneles de B como contenido de cada paso, pero suma una capa de orquestación.
### Vendibilidad Jujuy: **Alta para captar al no-técnico** ("no te vas a perder, te guía"), pero menos atractiva para el odontólogo que quiere control total y rapidez.

---

## Tabla comparativa

Puntuación 1 (bajo) a 5 (alto). En "Esfuerzo", 5 = MENOS esfuerzo (mejor).

| Criterio | A · Fiel a la planilla | B · Pestañas modernas | C · Wizard guiado |
| :--- | :---: | :---: | :---: |
| Familiaridad (usuario de papel) | **5** | 3 | 4 |
| Profesionalismo / percepción | 3 | **5** | 4 |
| Escalabilidad | 2 | **5** | 3 |
| Amigabilidad (uso diario) | 2 | 4 | **4** |
| Robustez (guardado, rendimiento) | 2 | **5** | 4 |
| Esfuerzo (5 = menos trabajo) | 3 | **4** | 2 |
| Responsividad móvil | 2 | **4** | **4** |
| Vendibilidad Jujuy | 4 | 4 | 4 |
| **Total (/40)** | **23** | **34** | **29** |

> Lectura: **B** gana en escalabilidad, robustez, profesionalismo y esfuerzo (lo más cercano a lo que ya existe). **A** domina solo en familiaridad. **C** brilla en onboarding del no-técnico. Ninguna variante pura cubre las tres tensiones del §0 a la vez.

---

## Recomendación final: **Híbrido B+C+A (base B, asistente C opcional, demo A en el PDF)**

**Arquitectura recomendada: integrada como pestaña madre "HC Odontológica" (Variante B) como columna vertebral**, porque es la más escalable, robusta y la de menor esfuerzo sobre lo que ya existe (`PatientSearch.tsx` + `Odontogram.tsx`), y porque mantiene la HC odontológica en el mismo lugar que Alergias/Vitales/Recetas (fuente única, sin duplicar datos del paciente). Sobre esa base:

1. **Primer turno / paciente nuevo → modo "Asistente" (Variante C) opcional.** Un botón "Iniciar consulta guiada" recorre Anamnesis → Odontograma → Dx/Plan → Consentimiento usando los mismos paneles de B como contenido de cada paso. Resuelve el onboarding del odontólogo no técnico y garantiza HC completas para auditoría PAMI. El experto lo ignora y va directo a las sub-pestañas.

2. **Consulta/edición de paciente existente → navegación libre por sub-pestañas (Variante B).** Acceso directo al dato puntual, sin recorrer el flujo. Es el modo por defecto.

3. **El "alma skeuomórfica" de A se canaliza en el PDF "Generar HC PAMI".** El documento exportado/impreso replica fielmente las 3 hojas PAMI + ficha Jujuy (incluida la simbología del odontograma y las firmas). Así el odontólogo conserva su planilla familiar **en papel cuando la necesita** (presentación a la obra social), sin pagar el costo de usabilidad de una pantalla de scroll infinito. Esto convierte la familiaridad de A en argumento de venta ("imprimís exactamente la ficha de siempre") sin sacrificar la UX digital.

Este híbrido obtiene lo mejor de cada eje: **escalabilidad y robustez de B**, **onboarding y estandarización de C**, y **familiaridad/vendibilidad de A** trasladada al entregable impreso. El odontograma dual rojo/azul con simbología rica y las firmas (paciente + profesional) son transversales a los tres modos.

### ¿Pantalla separada o integrada? → **INTEGRADA** (como pestaña madre dentro de la ficha existente)

Razones:
- **No duplica el contexto del paciente.** Demografía, alergias, vitales y recetas ya viven en la ficha; una HC separada obligaría a recargar/duplicar esos datos y crear navegación extra entre dos vistas del mismo paciente.
- **Coherencia de seguridad multi-inquilino.** El filtrado por tenant y el control de acceso ya operan en la ficha; integrarla reutiliza ese andamiaje (handoff con `security`).
- **Menor esfuerzo y mayor coherencia visual.** Reaprovecha pestañas, `Odontogram.tsx` y los tokens del `design-system`; una pantalla separada implicaría reconstruir cabecera, navegación y estados.
- **Las alergias bloqueantes de la anamnesis** se vinculan directo con la pestaña Alergias (`AllergyIntolerance`) sin saltar de pantalla — clínicamente más seguro.

La sensación de "HC odontológica propia y completa" se logra **dentro** de la ficha vía la pestaña madre con identidad visual fuerte y el botón de consulta guiada + el PDF PAMI fiel, sin el costo de una pantalla aislada.

---

## Quality Gate (aplicado a la variante recomendada)
- Tokens: solo `--color-rose` (Dx fijo), `--color-primary` (plan, white-label), `--color-emerald` (firmado), `--color-amber` (endodoncia/borrador). Cero hex nuevo.
- Componentes reutilizados: `.segmented-control` (pestañas, sub-pestañas, toggles, capas), `.panel`, `.btn*`, `.search-input`, `.tooth-polygon`, `fadeIn`.
- A11y: color + símbolo + etiqueta + sólido/punteado; banderas de alergia con `AlertTriangle` + `role="alert"`; foco visible; objetivos >=44px; `aria-labelledby` por sección; `prefers-reduced-motion`.
- Responsivo: 360/768/1280; grids `repeat(auto-fit, minmax(min(100%, X), 1fr))`; tablas → tarjetas <768; títulos `clamp()`; sin alto fijo.

## Decisiones abiertas heredadas (para el Orquestador)
Se mantienen las del `hc-odontologica-ux.md` §8 (color del tenant para "a realizar", agrupación de pestañas, mecanismo de firma, simbología extendida glifo vs. etiqueta, edición tras firma). Se suma:
6. **Modo Asistente (C):** ¿se entrega en F1 o como fase posterior una vez estabilizada la base B? UX sugiere base B primero, asistente C después (menor riesgo, valor incremental).
