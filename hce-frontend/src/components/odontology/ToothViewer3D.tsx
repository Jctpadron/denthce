import React, { useRef, useEffect } from 'react';
import { useTooth3D, type ViewPreset, PRESETS, type Rotation } from './useTooth3D';
import { type OdontoState, type OdontogramLayer } from './odontogram-catalog';

export interface CellState {
  state: OdontoState;
  color: string;
  layer: OdontogramLayer;
}

interface ToothViewer3DProps {
  piece: string;
  toothMap: Record<string, CellState>;
  onFaceClick: (face: string) => void;
  isAusente: boolean;
  size?: 'normal' | 'focused';
}

const FACES = ['V', 'D', 'L', 'M', 'O'] as const;

const FACE_CENTROID: Record<string, { x: number; y: number }> = {
  V: { x: 50, y: 16 },
  D: { x: 70, y: 32 },
  L: { x: 50, y: 46 },
  M: { x: 30, y: 32 },
  O: { x: 50, y: 32 },
};

const FACE_NAMES: Record<string, string> = {
  V: 'Vestibular / Frontal',
  D: 'Distal / Lateral Derecha',
  L: 'Lingual / Trasera',
  M: 'Mesial / Lateral Izquierda',
  O: 'Oclusal / Triturante'
};

export const ToothViewer3D: React.FC<ToothViewer3DProps> = ({
  piece,
  toothMap,
  onFaceClick,
  isAusente,
  size = 'normal'
}) => {
  const { rotation, activePreset, rotateTo, handlers, resetRotation } = useTooth3D();
  const sceneRef = useRef<HTMLDivElement>(null);

  const pieceCell = toothMap[`${piece}_all`];
  const pieceGlyphCell = pieceCell && pieceCell.state.id !== 'ausente' ? pieceCell : null;

  const faceFill = (f: string) => {
    const cell = toothMap[`${piece}_${f}`];
    if (!cell) return '#ffffff';
    // Rellenan la cara: caries, restauración, incrustación.
    return (cell.state.glifo === 'rellenoCara' || cell.state.glifo === 'lineasHorizontales') ? cell.color : '#ffffff';
  };

  // Dibujar glifos de la pieza completa (corona, perno, implante, etc.)
  const renderPieceGlyph = (state: OdontoState, color: string) => {
    switch (state.glifo) {
      case 'circulo':
        return <ellipse cx="50" cy="32" rx="34" ry="24" fill="none" stroke={color} strokeWidth="3.5" pointerEvents="none" />;
      case 'pernoCorona':
        return (
          <g pointerEvents="none">
            <ellipse cx="50" cy="30" rx="22" ry="16" fill="none" stroke={color} strokeWidth="3" />
            <line x1="50" y1="46" x2="50" y2="92" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
          </g>
        );
      case 'poste':
        return <line x1="50" y1="40" x2="50" y2="94" stroke={color} strokeWidth="5" strokeLinecap="round" pointerEvents="none" />;
      case 'lineasVerticales': {
        const n = state.variante === 3 ? 3 : 1;
        const xs = n === 3 ? [38, 50, 62] : [50];
        return (
          <g pointerEvents="none">
            {xs.map((x) => (
              <line key={x} x1={x} y1="52" x2={x} y2="96" stroke={color} strokeWidth="3" strokeLinecap="round" />
            ))}
          </g>
        );
      }
      case 'letra':
        return <text x="50" y="40" textAnchor="middle" fontSize="30" fontWeight="800" fill={color} pointerEvents="none">{state.letra}</text>;
      case 'X':
        return (
          <g pointerEvents="none">
            <line x1="18" y1="14" x2="82" y2="86" stroke={color} strokeWidth="5" strokeLinecap="round" />
            <line x1="82" y1="14" x2="18" y2="86" stroke={color} strokeWidth="5" strokeLinecap="round" />
          </g>
        );
      case 'tornillo':
        return (
          <g transform="translate(0,10)" pointerEvents="none">
            <rect x="46" y="38" width="8" height="45" fill="#94a3b8" rx="2" stroke={color} strokeWidth="1.2" />
            {[46, 54, 62, 70].map((y) => <line key={y} x1="43" y1={y} x2="57" y2={y} stroke={color} strokeWidth="1.5" />)}
            <polygon points="46,83 54,83 50,90" fill={color} />
          </g>
        );
      default:
        return null;
    }
  };

  // Dibujar glifos específicos de cara (incrustación, sellante, etc.)
  const renderFaceGlyph = (face: string, state: OdontoState, color: string) => {
    const c = FACE_CENTROID[face];
    if (!c) return null;
    if (state.glifo === 'lineasHorizontales') {
      return (
        <g key={`gf-${face}`} pointerEvents="none">
          {[-3, 0, 3].map((dy) => (
            <line key={dy} x1={c.x - 7} y1={c.y + dy} x2={c.x + 7} y2={c.y + dy} stroke={color} strokeWidth="1.4" />
          ))}
        </g>
      );
    }
    if (state.glifo === 'letra') {
      return (
        <text key={`gf-${face}`} x={c.x} y={c.y + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill={color} pointerEvents="none">
          {state.letra}
        </text>
      );
    }
    return null;
  };

  // Manejo de teclado (WCAG 2.1 AA) para rotación de la pieza y clic en caras
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Si presiona R resetea la rotación
    if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      resetRotation();
      return;
    }
    
    // Rotaciones rápidas con flechas de dirección al estar enfocada la escena
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Rotar Y a la izquierda
      rotateToAngle(rotation.x, rotation.y - 15);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Rotar Y a la derecha
      rotateToAngle(rotation.x, rotation.y + 15);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Rotar X arriba
      rotateToAngle(rotation.x - 15, rotation.y);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Rotar X abajo
      rotateToAngle(rotation.x + 15, rotation.y);
    }
  };

  const rotateToAngle = (x: number, y: number) => {
    let limitedX = Math.max(-85, Math.min(85, x));
    let normalizedY = y % 360;
    
    // Ejecución forzada en el hook
    const event = new CustomEvent('tooth-keyboard-rotate', { detail: { x: limitedX, y: normalizedY } });
    window.dispatchEvent(event);
  };

  // Escuchar eventos de teclado si cambian de forma global o local
  useEffect(() => {
    const handleGlobalRotation = (e: Event) => {
      const customEvent = e as CustomEvent<Rotation>;
      if (customEvent.detail && sceneRef.current?.contains(document.activeElement)) {
        // Si el elemento activo está dentro de esta escena, actualizamos localmente
        const { x, y } = customEvent.detail;
        const modelEl = sceneRef.current.querySelector('.tooth-model') as HTMLDivElement;
        if (modelEl) {
          modelEl.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
        }
      }
    };

    window.addEventListener('tooth-keyboard-rotate', handleGlobalRotation);
    return () => {
      window.removeEventListener('tooth-keyboard-rotate', handleGlobalRotation);
    };
  }, []);

  const handleFaceKeyDown = (e: React.KeyboardEvent, face: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFaceClick(face);
    }
  };

  // Dimensiones del visor
  const viewerWidth = size === 'focused' ? 160 : 84;
  const viewerHeight = size === 'focused' ? 180 : 96;

  return (
    <div 
      ref={sceneRef}
      className="tooth-scene"
      {...handlers}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`Visualizador 3D Diente ${piece}. Use flechas de teclado para rotar, R para restaurar vista.`}
      style={{
        width: `${viewerWidth + 20}px`,
        height: `${viewerHeight + 48}px`
      }}
    >
      <div 
        className="tooth-model" 
        style={{ 
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          width: `${viewerWidth}px`,
          height: `${viewerHeight}px`
        }}
      >
        <svg 
          width={viewerWidth} 
          height={viewerHeight} 
          viewBox="0 0 100 110" 
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="toothRootGradViewer" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Raíces (si no es ausente y no tiene tornillo/implante) */}
          {!isAusente && pieceCell?.state.glifo !== 'tornillo' && (
            <path 
              d="M 22,50 C 22,75 28,95 32,100 C 35,102 38,98 40,82 C 43,68 47,62 50,62 C 53,62 57,68 60,82 C 62,98 65,102 68,100 C 72,95 78,75 78,50 Z"
              fill="url(#toothRootGradViewer)" 
              stroke="#94a3b8" 
              strokeWidth="1.5" 
              strokeLinejoin="round" 
            />
          )}

          {/* Corona del diente */}
          {!isAusente && (
            <path 
              d="M 20,50 C 16,50 14,24 24,14 C 34,4 66,4 76,14 C 86,24 84,50 80,50 Z" 
              fill="none" 
              stroke="#475569" 
              strokeWidth="2" 
              strokeLinejoin="round" 
            />
          )}

          {/* Caras interactivas */}
          {!isAusente && (
            <>
              {/* Vestibular (V) */}
              <path 
                d="M 24,14 C 34,4 66,4 76,14 L 62,26 C 55,22 45,22 38,26 Z" 
                fill={faceFill('V')} 
                className="tooth-face"
                role="button"
                aria-label={`Cara ${FACE_NAMES.V} del diente ${piece}`}
                tabIndex={0}
                onKeyDown={(e) => handleFaceKeyDown(e, 'V')}
                onClick={(e) => { e.stopPropagation(); onFaceClick('V'); }} 
              />
              
              {/* Distal (D) */}
              <path 
                d="M 76,14 C 86,24 84,50 80,50 L 62,38 C 67,34 67,28 62,26 Z" 
                fill={faceFill('D')} 
                className="tooth-face"
                role="button"
                aria-label={`Cara ${FACE_NAMES.D} del diente ${piece}`}
                tabIndex={0}
                onKeyDown={(e) => handleFaceKeyDown(e, 'D')}
                onClick={(e) => { e.stopPropagation(); onFaceClick('D'); }} 
              />
              
              {/* Lingual (L) */}
              <path 
                d="M 20,50 C 24,54 76,54 80,50 L 62,38 C 55,42 45,42 38,38 Z" 
                fill={faceFill('L')} 
                className="tooth-face"
                role="button"
                aria-label={`Cara ${FACE_NAMES.L} del diente ${piece}`}
                tabIndex={0}
                onKeyDown={(e) => handleFaceKeyDown(e, 'L')}
                onClick={(e) => { e.stopPropagation(); onFaceClick('L'); }} 
              />
              
              {/* Mesial (M) */}
              <path 
                d="M 20,50 C 14,50 16,24 24,14 L 38,26 C 33,28 33,34 38,38 Z" 
                fill={faceFill('M')} 
                className="tooth-face"
                role="button"
                aria-label={`Cara ${FACE_NAMES.M} del diente ${piece}`}
                tabIndex={0}
                onKeyDown={(e) => handleFaceKeyDown(e, 'M')}
                onClick={(e) => { e.stopPropagation(); onFaceClick('M'); }} 
              />
              
              {/* Oclusal (O) */}
              <path 
                d="M 38,26 C 45,22 55,22 62,26 C 67,28 67,34 62,38 C 55,42 45,42 38,38 C 33,34 33,28 38,26 Z" 
                fill={faceFill('O')} 
                className="tooth-face"
                role="button"
                aria-label={`Cara ${FACE_NAMES.O} del diente ${piece}`}
                tabIndex={0}
                onKeyDown={(e) => handleFaceKeyDown(e, 'O')}
                onClick={(e) => { e.stopPropagation(); onFaceClick('O'); }} 
              />

              {/* Glifos por cara (incrustación, sellante) */}
              {FACES.map((f) => {
                const cell = toothMap[`${piece}_${f}`];
                return cell ? renderFaceGlyph(f, cell.state, cell.color) : null;
              })}

              {/* Glifo de pieza completa (corona, perno, endodoncia, implante) */}
              {pieceGlyphCell && renderPieceGlyph(pieceGlyphCell.state, pieceGlyphCell.color)}
            </>
          )}

          {/* Pieza ausente: raíces fantasma + X */}
          {isAusente && (
            <>
              <path 
                d="M 22,50 C 22,75 28,95 32,100 C 35,102 38,98 40,82 C 43,68 47,62 50,62 C 53,62 57,68 60,82 C 62,98 65,102 68,100 C 72,95 78,75 78,50 Z" 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="1.5" 
                strokeDasharray="3 3" 
              />
              <line x1="15" y1="15" x2="85" y2="85" stroke={pieceCell!.color} strokeWidth="4.5" strokeLinecap="round" />
              <line x1="85" y1="15" x2="15" y2="85" stroke={pieceCell!.color} strokeWidth="4.5" strokeLinecap="round" />
            </>
          )}
        </svg>
      </div>

      {/* Botones de Preset de Vista */}
      {!isAusente && (
        <div className="tooth-presets-container" onClick={(e) => e.stopPropagation()}>
          {(['frontal', 'lingual', 'mesial', 'distal', 'oclusal'] as ViewPreset[]).map((preset) => {
            const labels: Record<ViewPreset, string> = {
              frontal: 'V',
              lingual: 'L',
              mesial: 'M',
              distal: 'D',
              oclusal: 'O'
            };
            const fullLabels: Record<ViewPreset, string> = {
              frontal: 'Vestibular',
              lingual: 'Lingual',
              mesial: 'Mesial',
              distal: 'Distal',
              oclusal: 'Oclusal'
            };
            return (
              <button
                key={preset}
                type="button"
                className={`tooth-preset-btn ${activePreset === preset ? 'active' : ''}`}
                onClick={() => rotateTo(preset)}
                aria-label={`Rotar vista a ${fullLabels[preset]}`}
                title={fullLabels[preset]}
              >
                {labels[preset]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
