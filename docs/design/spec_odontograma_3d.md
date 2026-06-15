# Especificaciones Técnicas — Odontograma 3D Interactivo
## Fase 1: SVG Multi-Capa + CSS 3D Transform

**Preparado por:** Orquestador  
**Fecha:** 2026-06-13  
**Destino:** Agente de desarrollo del odontograma  
**Archivo objetivo:** componente React del odontograma HCE

---

## Contexto y Objetivo

Rediseñar el odontograma para diferenciarse de la competencia mediante un **diente 3D interactivo giratorio** donde el profesional puede marcar superficies afectadas directamente sobre el modelo visual.

**Decisión técnica aprobada por el Orquestador:**
> Implementar Fase 1 con SVG multi-capa + CSS 3D transform. Si la experiencia convence, migrar a Three.js (Fase 2) con modelo GLTF real del diente.

---

## Fase 1 — SVG Multi-Capa + CSS 3D Transform

### ¿Por qué esta tecnología primero?

| Ventaja | Detalle |
|---|---|
| Sin dependencias externas | No requiere Three.js, Babylon.js ni WebGL |
| Rendimiento excelente en móvil | CSS GPU-accelerated, sin overhead de canvas |
| Compatible con React | Se integra como JSX sin librerías adicionales |
| Tiempo de validación rápido | Se puede prototipar en horas, no días |
| Accesibilidad nativa | SVG soporta aria-labels y keyboard navigation |

---

## Arquitectura del Componente

```
ToothViewer3D/
├── ToothViewer3D.tsx        ← Componente principal
├── ToothSVG.tsx             ← SVG del diente por capas
├── SurfaceSelector.tsx      ← Chips de superficie (móvil)
├── ToothRotationControls.tsx ← Controles de rotación
├── useTooth3D.ts            ← Hook: estado de rotación y marcado
├── toothConstants.ts        ← Definición de superficies y colores
└── tooth3d.css              ← Transformaciones CSS 3D
```

---

## Estructura SVG Multi-Capa del Diente

El diente se construye como **6 capas SVG apiladas** usando `position: absolute` + `transform-style: preserve-3d`:

```
Capa 0 — Base (Oclusal/Incisal)   ← vista desde arriba
Capa 1 — Cara Vestibular/Bucal    ← cara frontal (hacia labio)
Capa 2 — Cara Lingual/Palatina    ← cara posterior (hacia lengua)
Capa 3 — Cara Mesial              ← cara izquierda (hacia centro)
Capa 4 — Cara Distal              ← cara derecha (hacia afuera)
Capa 5 — Raíz                     ← base del diente (referencia)
```

### Cada capa es un `<svg>` con:
- `id`: superficie identificada (`surface-vestibular`, `surface-mesial`, etc.)
- `fill`: color según estado clínico (ver sistema de colores)
- `onClick`: handler que registra la superficie marcada
- `aria-label`: descripción accesible de la superficie
- `data-surface`: código FDI de superficie (`V`, `L`, `M`, `D`, `O`)

---

## Lógica de Rotación CSS 3D

### Variables CSS necesarias

```css
.tooth-scene {
  perspective: 600px;
  perspective-origin: 50% 50%;
}

.tooth-model {
  transform-style: preserve-3d;
  transition: transform 0.3s ease-out;
  /* Rotación controlada por variables JS */
  transform: rotateX(var(--rot-x, -15deg)) rotateY(var(--rot-y, 0deg));
}

.tooth-face {
  position: absolute;
  backface-visibility: visible;
  cursor: pointer;
  transition: fill 0.2s ease, filter 0.2s ease;
}

.tooth-face:hover {
  filter: brightness(1.15);
}

.tooth-face.marked {
  fill: var(--surface-color-marked);
  filter: drop-shadow(0 0 4px var(--surface-color-marked));
}
```

### Hook `useTooth3D.ts` — lógica de rotación por drag

```typescript
interface ToothRotation {
  x: number;  // rotateX en grados
  y: number;  // rotateY en grados
}

interface MarkedSurfaces {
  [surface: string]: {
    estado: 'existente' | 'a_realizar' | 'sano';
    diagnostico?: string;
    color: string;
  }
}

// El hook expone:
// - rotation: ToothRotation
// - markedSurfaces: MarkedSurfaces
// - handleDragStart, handleDragMove, handleDragEnd
// - handleTouchStart, handleTouchMove, handleTouchEnd
// - markSurface(surface, estado, diagnostico)
// - resetRotation()
// - rotateTo(preset: 'frontal' | 'lingual' | 'mesial' | 'distal' | 'oclusal')
```

### Presets de rotación rápida (botones de vista)

```typescript
const ROTATION_PRESETS = {
  frontal:  { x: -10, y: 0   },   // Vista vestibular
  lingual:  { x: -10, y: 180 },   // Vista lingual/palatina
  mesial:   { x: -10, y: -90 },   // Vista mesial
  distal:   { x: -10, y: 90  },   // Vista distal
  oclusal:  { x: 90,  y: 0   },   // Vista desde arriba
};
```

---

## Sistema de Colores por Estado Clínico

Mantener consistencia con el odontograma existente del Módulo 9:

```typescript
const SURFACE_COLORS = {
  sano:        '#e2e8f0',  // Gris claro — sin intervención
  existente:   '#ef4444',  // Rojo — tratamiento ya realizado
  a_realizar:  '#3b82f6',  // Azul — tratamiento planificado
  en_curso:    '#f59e0b',  // Ámbar — en tratamiento actual
  sellante:    '#10b981',  // Esmeralda — sellante/prevención
  fractura:    '#7c3aed',  // Violeta — fractura
  ausente:     '#1e293b',  // Oscuro — diente ausente/extraído
};
```

---

## Diseño Adaptativo — Mobile vs Desktop

### Desktop / Tablet (≥ 768px)
```
┌─────────────────────────────────────────────┐
│  ARCO SUPERIOR: [ 18 17 16 ... 21 22 23 ]  │
│                                             │
│  ┌──────────────┐  ┌─────────────────────┐ │
│  │  🦷 DIENTE   │  │  PANEL DE MARCADO   │ │
│  │  3D girando  │  │  ○ Diagnóstico      │ │
│  │              │  │  ○ Estado           │ │
│  │  [◀] [▶]    │  │  ○ Tratamiento      │ │
│  │  [↑] [↓]    │  │  [✓ Confirmar]      │ │
│  └──────────────┘  └─────────────────────┘ │
│                                             │
│  ARCO INFERIOR: [ 48 47 46 ... 31 32 33 ]  │
└─────────────────────────────────────────────┘
```

### Móvil (< 768px)
```
┌──────────────┐
│ [18][17][16] │  ← Selector numérico scrolleable
│  ··· ···    │
│              │
│  🦷 DIENTE  │  ← Diente 3D grande, pantalla casi completa
│   girando   │
│   (drag)    │
│              │
│ [M][D][V][L][O] │  ← Chips de superficie
│                 │
│ [Diagnóstico ▼] │  ← Selector de diagnóstico
│ [✓ Confirmar]   │  ← Botón 48px mínimo
└──────────────┘
```

---

## Interacciones Requeridas

### Mouse / Trackpad (Desktop)
- `mousedown + mousemove` → rotar el diente en X e Y
- `click` en superficie SVG → seleccionar superficie
- `mouseup` → soltar rotación

### Touch (Móvil / Tablet)
- `touchstart + touchmove` con 1 dedo → rotar el diente
- `tap` en superficie SVG → seleccionar superficie
- `pinch` (2 dedos) → zoom del modelo (opcional fase 1.1)

### Teclado (Accesibilidad WCAG AA)
- `Tab` → navegar entre superficies
- `Enter / Space` → seleccionar superficie activa
- `ArrowKeys` → rotar el diente 15° por tecla
- `R` → reset de rotación a vista frontal

---

## Integración con el Sistema FHIR Existente

El estado del odontograma debe mapearse al recurso `Procedure` de FHIR R4 existente:

```typescript
// Al confirmar una superficie marcada, emitir:
{
  resourceType: "Procedure",
  subject: { reference: `Patient/${patientId}` },
  code: {
    coding: [{
      system: "http://snomed.info/sct",
      code: "234962002",  // Código SNOMED del procedimiento dental
      display: diagnostico
    }]
  },
  bodySite: [{
    coding: [{
      system: "http://snomed.info/sct", 
      code: toothFDItoSNOMED(toothNumber),  // Helper de conversión FDI → SNOMED
      display: `Diente ${toothNumber} — Superficie ${surface}`
    }]
  }],
  status: estado === 'existente' ? 'completed' : 'planned'
}
```

---

## Criterios para migrar a Fase 2 (Three.js)

Migrar a Three.js + modelo GLTF del diente cuando se cumpla AL MENOS uno:

| Criterio | Descripción |
|---|---|
| ✅ Validación clínica | Los odontólogos confirman que el SVG 3D es suficientemente preciso |
| ✅ Performance ok | El componente corre sin lag en dispositivos de gama media |
| ✅ Demanda de texturas | Se requiere mostrar esmalte, dentina, caries visualmente realistas |
| ✅ Modelo aprobado | Se consigue un modelo GLTF de diente libre de derechos de autor |

---

## Hoja de Ruta

```
Fase 1 (actual):   SVG multi-capa + CSS 3D transform
                   └── Validación clínica con odontólogos

Fase 1.1:          Agregar zoom (pinch) + animación de transición entre dientes

Fase 2 (opcional): Migrar a Three.js con modelo GLTF real
                   └── Texturas de esmalte, caries, restauraciones
                   └── Iluminación dinámica del modelo
                   └── Exportar vista 3D al PDF de la HC
```

---

## Notas para el Agente de Desarrollo

1. **No romper** la integración FHIR existente del Módulo 9 (`odontology_clinical_resources`)
2. **Reutilizar** el catálogo de estados del odontograma actual (13 estados, simbología centralizada)
3. **El componente debe ser lazy-loaded** — no cargar Three.js ni SVGs pesados en el bundle principal
4. **Testear en Samsung Galaxy A series** (gama media) como dispositivo de referencia móvil
5. **Mantener** el odontograma original como fallback si el 3D no carga (progressive enhancement)
