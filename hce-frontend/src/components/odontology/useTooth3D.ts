import { useState, useRef, useCallback } from 'react';

export type ViewPreset = 'frontal' | 'lingual' | 'mesial' | 'distal' | 'oclusal';

export interface Rotation {
  x: number;
  y: number;
}

export const PRESETS: Record<ViewPreset, Rotation> = {
  frontal: { x: -10, y: 0 },
  lingual: { x: -10, y: 180 },
  mesial: { x: -10, y: -90 },
  distal: { x: -10, y: 90 },
  oclusal: { x: 80, y: 0 } // Ajustado a 80 para mejor perspectiva tridimensional
};

export const useTooth3D = (initialPreset: ViewPreset = 'frontal') => {
  const [rotation, setRotation] = useState<Rotation>(PRESETS[initialPreset]);
  const [isDragging, setIsDragging] = useState(false);
  const [activePreset, setActivePreset] = useState<ViewPreset | null>(initialPreset);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const startRotation = useRef({ x: 0, y: 0 });

  // Cambiar a un preset específico
  const rotateTo = useCallback((preset: ViewPreset) => {
    setRotation(PRESETS[preset]);
    setActivePreset(preset);
  }, []);

  const resetRotation = useCallback(() => {
    rotateTo('frontal');
  }, [rotateTo]);

  // Manejo de Inicio de Arrastre (Mouse)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setActivePreset(null);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startRotation.current = { ...rotation };
  }, [rotation]);

  // Manejo de Movimiento (Mouse)
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;

    // Sensibilidad de rotación (0.5 grados por píxel arrastrado)
    const factor = 0.6;
    
    // Rotar Y sobre el eje horizontal del mouse (eje vertical del diente)
    // Rotar X sobre el eje vertical del mouse (eje horizontal del diente)
    let newX = startRotation.current.x - deltaY * factor;
    let newY = startRotation.current.y + deltaX * factor;

    // Restricciones físicas en el eje X para evitar inversión completa de la perspectiva
    if (newX > 85) newX = 85;
    if (newX < -85) newX = -85;

    // Mantener Y en el rango -360 a 360 para evitar números infinitamente grandes
    newY = newY % 360;

    setRotation({ x: newX, y: newY });
  }, [isDragging]);

  // Fin de Arrastre (Mouse)
  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Manejo de Inicio de Arrastre (Touch en Móviles)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setActivePreset(null);
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    startRotation.current = { ...rotation };
  }, [rotation]);

  // Manejo de Movimiento (Touch)
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - dragStart.current.x;
    const deltaY = e.touches[0].clientY - dragStart.current.y;
    
    const factor = 0.8; // Mayor sensibilidad para pantallas táctiles

    let newX = startRotation.current.x - deltaY * factor;
    let newY = startRotation.current.y + deltaX * factor;

    if (newX > 85) newX = 85;
    if (newX < -85) newX = -85;
    
    newY = newY % 360;

    setRotation({ x: newX, y: newY });
  }, [isDragging]);

  // Fin de Arrastre (Touch)
  const onTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    rotation,
    isDragging,
    activePreset,
    rotateTo,
    resetRotation,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp, // Manejar cuando el mouse sale del área interactiva
      onTouchStart,
      onTouchMove,
      onTouchEnd
    }
  };
};
