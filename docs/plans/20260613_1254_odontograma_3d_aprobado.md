# Plan de Ejecución — Odontograma 3D Interactivo
## Fase 1: SVG Multi-Capa + CSS 3D Transform

**Orquestador:** Aprobado para ejecución  
**Fecha:** 2026-06-13  
**Estado:** APROBADO POR EL SUPER ADMIN (EJECUCIÓN EN PROGRESO)

---

## Diagnóstico del Código Existente

Tras leer `OdontogramPAMI.tsx` (499 líneas) y `odontogram-catalog.ts` (100 líneas):

### Lo que YA existe y se conserva intacto
- ✅ SVG del diente con 5 caras interactivas (V, D, L, M, O) — paths ya definidos
- ✅ Sistema de 2 capas (existente rojo / a realizar azul)
- ✅ Integración FHIR completa con endpoint `/odontology`
- ✅ Catálogo de 13 estados clínicos con SNOMED
- ✅ Detección de móvil con `isMobile`
- ✅ Toast flotante de mensajes
- ✅ Panel de historial derecho (existente / plan)
- ✅ Glifos clínicos (circulo, X, tornillo, letra, líneas)

### Lo que se AGREGA (sin romper nada)
- 🆕 Rotación CSS 3D del diente con drag/touch
- 🆕 Presets de vista (V/L/M/D/O)
- 🆕 Upload de imagen/radiografía por diente
- 🆕 Atributos ARIA + navegación por teclado WCAG 2.1 AA
- 🆕 Vista enfocada en móvil (un diente a la vez, grande)
- 🆕 CSS dedicado con micro-animaciones

---

## Archivos del Plan

### NUEVOS
```
hce-frontend/src/components/odontology/
├── ToothViewer3D.tsx          ← Diente SVG con rotación CSS 3D
├── useTooth3D.ts              ← Hook: estado de rotación por drag/touch
└── __tests__/
    └── OdontogramPAMI.test.tsx ← Tests unitarios

hce-frontend/src/
└── odontogram.css             ← Estilos 3D, responsive, micro-animaciones
```

### MODIFICADOS
```
hce-frontend/src/components/odontology/
└── OdontogramPAMI.tsx         ← Integra ToothViewer3D + upload + ARIA
```

### SIN CAMBIOS
```
hce-backend/src/odontology/   ← Backend intacto
odontogram-catalog.ts          ← Catálogo intacto
hce-frontend/src/index.css     ← Estilos globales intactos
```

---

## Detalle de Cada Archivo

### 1. `useTooth3D.ts` — Hook de rotación

**Responsabilidad:** Gestionar el estado de rotación X/Y del modelo 3D por drag de mouse y touch.

**Expone:**
```typescript
interface UseTooth3DResult {
  rotation: { x: number; y: number };       // grados actuales
  isDragging: boolean;
  handlers: {                                // eventos para el contenedor SVG
    onMouseDown, onMouseMove, onMouseUp,
    onTouchStart, onTouchMove, onTouchEnd
  };
  rotateTo: (preset: ViewPreset) => void;   // V|L|M|D|O
  resetRotation: () => void;
}

type ViewPreset = 'frontal' | 'lingual' | 'mesial' | 'distal' | 'oclusal';

const PRESETS = {
  frontal:  { x: -10, y: 0   },
  lingual:  { x: -10, y: 180 },
  mesial:   { x: -10, y: -90 },
  distal:   { x: -10, y: 90  },
  oclusal:  { x:  90, y: 0   },
};
```

**Sin dependencias externas.** Solo React hooks.

---

### 2. `ToothViewer3D.tsx` — Diente 3D

**Responsabilidad:** Renderizar el diente SVG existente con efecto 3D CSS, rotación interactiva y accesibilidad.

**Props:**
```typescript
interface ToothViewer3DProps {
  piece: string;                             // número de diente FDI
  toothMap: Record<string, CellState>;       // estado de cada cara
  onFaceClick: (face: string) => void;       // handler existente
  isAusente: boolean;
  size?: 'normal' | 'focused';              // normal = grilla, focused = móvil
}
```

**Características:**
- Reutiliza los paths SVG exactos del `OdontogramPAMI.tsx` actual
- Envuelve el SVG en `div.tooth-scene` con `perspective: 600px`
- Aplica `transform: rotateX(Xdeg) rotateY(Ydeg)` mediante variables CSS
- 5 botones de preset de vista: `[V] [L] [M] [D] [O]`
- `cursor: grab` durante rotación, `cursor: grabbing` al arrastrar
- Atributos ARIA: `role="img"`, `aria-label="Diente {piece}"`, `tabIndex` en cada cara
- Soporte teclado: `ArrowLeft/Right` rotan 15°, `R` resetea vista

**NO usa Three.js, NO usa Canvas, NO usa WebGL.**

---

### 3. `odontogram.css` — Estilos dedicados

**Contenido:**

```css
/* ── Escena 3D ─────────────────────────────── */
.tooth-scene {
  perspective: 600px;
  perspective-origin: 50% 40%;
  cursor: grab;
  user-select: none;
}
.tooth-scene:active { cursor: grabbing; }

.tooth-model {
  transform-style: preserve-3d;
  transition: transform 0.25s ease-out;
  will-change: transform;
}

/* ── Caras interactivas ─────────────────────── */
.tooth-face {
  transition: fill 0.18s ease, filter 0.18s ease;
  cursor: pointer;
}
.tooth-face:hover {
  filter: brightness(0.88) saturate(1.2);
}
.tooth-face:focus-visible {
  outline: 2px solid #007AFF;
  outline-offset: 2px;
}

/* ── Preset buttons ─────────────────────────── */
.tooth-preset-btn {
  min-width: 36px;
  min-height: 36px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: 'Inter', sans-serif;
}
.tooth-preset-btn:hover {
  background: #007AFF;
  color: white;
  border-color: #007AFF;
}
.tooth-preset-btn.active {
  background: #007AFF;
  color: white;
  border-color: #007AFF;
}

/* ── Upload por diente ──────────────────────── */
.tooth-upload-btn {
  width: 100%;
  min-height: 32px;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
  background: transparent;
  font-size: 10px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.tooth-upload-btn:hover {
  border-color: #007AFF;
  color: #007AFF;
  background: #f0f7ff;
}
.tooth-upload-thumb {
  width: 100%;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
}

/* ── Vista enfocada móvil ───────────────────── */
.tooth-focused-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.tooth-focused-sheet {
  background: white;
  width: 100%;
  border-radius: 20px 20px 0 0;
  padding: 24px 16px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

/* ── Surface chips (móvil) ──────────────────── */
.surface-chip {
  min-width: 52px;
  min-height: 48px;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.surface-chip:hover { border-color: #007AFF; color: #007AFF; }
.surface-chip.marked-existing { background: #fef2f2; border-color: #ef4444; color: #ef4444; }
.surface-chip.marked-planned  { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }

/* ── Micro-animaciones ──────────────────────── */
@keyframes toothSelect {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.04); }
  100% { transform: scale(1); }
}
.tooth-selected-anim { animation: toothSelect 0.25s ease; }

/* ── Responsive: modo móvil grilla ─────────── */
@media (max-width: 767px) {
  .tooth-card { min-width: 90px; padding: 0.6rem; }
  .tooth-preset-btn { min-width: 28px; font-size: 9px; }
}
```

---

### 4. `OdontogramPAMI.tsx` — Modificaciones quirúrgicas

**Solo se agregan 4 cosas. No se toca el código existente:**

#### 4.1 Import del nuevo componente y hook
```typescript
import { ToothViewer3D } from './ToothViewer3D';
import '../../../odontogram.css';
```

#### 4.2 Estado de upload por diente
```typescript
const [toothImages, setToothImages] = useState<Record<string, string>>({});
const handleImageUpload = (piece: string, file: File) => { /* FileReader → base64 → preview */ };
```

#### 4.3 Estado de diente enfocado (móvil)
```typescript
const [focusedTooth, setFocusedTooth] = useState<string | null>(null);
```

#### 4.4 En `renderTooth()` — reemplazar el bloque SVG actual por `<ToothViewer3D>`
```tsx
// ANTES: bloque SVG de 40+ líneas hardcodeado
// DESPUÉS:
<ToothViewer3D
  piece={piece}
  toothMap={toothMap}
  onFaceClick={(face) => handleCellClick(piece, face)}
  isAusente={isAusente}
  size={isMobile ? 'focused' : 'normal'}
/>
```

**Y bajo el SVG, agregar el botón de upload:**
```tsx
<label className="tooth-upload-btn" aria-label={`Adjuntar imagen al diente ${piece}`}>
  <input type="file" accept="image/*,application/pdf" hidden
    onChange={(e) => e.target.files?.[0] && handleImageUpload(piece, e.target.files[0])} />
  {toothImages[piece]
    ? <img src={toothImages[piece]} className="tooth-upload-thumb" alt={`Rx diente ${piece}`} />
    : <><Paperclip size={10} /> Rx</>}
</label>
```

---

### 5. Tests — `__tests__/OdontogramPAMI.test.tsx`

```typescript
// Tests con React Testing Library
describe('OdontogramPAMI — Odontograma 3D', () => {
  test('renderiza sin errores con patientId', () => { ... });
  test('ToothViewer3D responde a drag y actualiza rotación', () => { ... });
  test('preset V rota a frontal (rotateY 0deg)', () => { ... });
  test('botón de upload acepta archivo imagen', () => { ... });
  test('cara SVG tiene aria-label accesible', () => { ... });
  test('tecla ArrowRight rota el diente 15°', () => { ... });
  test('vista móvil muestra chips de superficie', () => { ... });
});
```

---

## Secuencia de Ejecución

```
Paso 1 → Crear odontogram.css
Paso 2 → Crear useTooth3D.ts
Paso 3 → Crear ToothViewer3D.tsx
Paso 4 → Modificar OdontogramPAMI.tsx (4 cambios quirúrgicos)
Paso 5 → Crear tests
Paso 6 → Verificar build (npm run build)
```

**Tiempo estimado:** 2-3 horas de implementación limpia.

---

## Criterios de Aceptación

- [ ] El diente rota al hacer drag con mouse o touch
- [ ] Los 5 presets de vista (V/L/M/D/O) funcionan
- [ ] Las caras siguen siendo clickeables durante/después de la rotación
- [ ] El upload de imagen funciona y muestra preview en miniatura
- [ ] En móvil se puede marcar superficie desde los chips de la grilla
- [ ] Los atributos ARIA están presentes en todas las caras
- [ ] La navegación por teclado (ArrowKeys, R) funciona
- [ ] No hay regresiones en el guardado FHIR existente
- [ ] `npm run build` sin errores ni warnings críticos

---

## Lo que NO se toca

- ❌ Backend (`hce-backend/`) — sin cambios
- ❌ `odontogram-catalog.ts` — sin cambios
- ❌ Endpoints FHIR — sin cambios
- ❌ `index.css` — sin cambios
- ❌ pgvector — no integrar

---

## Normas aplicables

- **Ley 26.529** — Derechos del Paciente / HC Electrónica
- **Ley 25.326** — Protección de Datos Personales
- **Normas PAMI** — Protocolo HC Odontológica
- **WCAG 2.1 AA** — Accesibilidad web
