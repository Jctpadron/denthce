import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToothViewer3D, type CellState } from '../ToothViewer3D';
import { useTooth3D, PRESETS } from '../useTooth3D';

// Mock del hook useTooth3D
jest.mock('../useTooth3D', () => {
  const original = jest.requireActual('../useTooth3D');
  return {
    ...original,
    useTooth3D: jest.fn().mockImplementation(() => ({
      rotation: { x: -10, y: 0 },
      isDragging: false,
      activePreset: 'frontal',
      rotateTo: jest.fn(),
      resetRotation: jest.fn(),
      handlers: {
        onMouseDown: jest.fn(),
        onMouseMove: jest.fn(),
        onMouseUp: jest.fn(),
        onMouseLeave: jest.fn(),
        onTouchStart: jest.fn(),
        onTouchMove: jest.fn(),
        onTouchEnd: jest.fn()
      }
    }))
  };
});

describe('Componente ToothViewer3D (Odontograma 3D)', () => {
  const mockOnFaceClick = jest.fn();
  const mockToothMap: Record<string, CellState> = {
    '11_V': { state: { id: 'caries', text: 'Caries', glifo: 'rellenoCara' }, color: '#ef4444', layer: 'existing' },
    '11_O': { state: { id: 'restauracion', text: 'Restauración', glifo: 'rellenoCara' }, color: '#3b82f6', layer: 'planned' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza el diente y sus presets sin errores', () => {
    render(
      <ToothViewer3D
        piece="11"
        toothMap={mockToothMap}
        onFaceClick={mockOnFaceClick}
        isAusente={false}
      />
    );

    // Verifica que el visualizador 3D se renderice con el label correcto
    expect(screen.getByRole('region', { name: /visualizador 3d diente 11/i })).toBeInTheDocument();

    // Verifica que existan los botones de presets
    expect(screen.getByRole('button', { name: /rotar vista a vestibular/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotar vista a lingual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotar vista a mesial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotar vista a distal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotar vista a oclusal/i })).toBeInTheDocument();
  });

  test('llama a onFaceClick cuando se hace clic en una cara del diente', () => {
    render(
      <ToothViewer3D
        piece="11"
        toothMap={mockToothMap}
        onFaceClick={mockOnFaceClick}
        isAusente={false}
      />
    );

    // Clic en la cara vestibular (V)
    const faceV = screen.getByRole('button', { name: /cara vestibular \/ frontal del diente 11/i });
    expect(faceV).toBeInTheDocument();
    
    fireEvent.click(faceV);
    expect(mockOnFaceClick).toHaveBeenCalledWith('V');
  });

  test('soporta eventos de teclado para caras (accesibilidad WCAG 2.1)', () => {
    render(
      <ToothViewer3D
        piece="11"
        toothMap={mockToothMap}
        onFaceClick={mockOnFaceClick}
        isAusente={false}
      />
    );

    const faceO = screen.getByRole('button', { name: /cara oclusal \/ triturante del diente 11/i });
    
    // Simula presionar Enter
    fireEvent.keyDown(faceO, { key: 'Enter', code: 'Enter' });
    expect(mockOnFaceClick).toHaveBeenCalledWith('O');

    // Simula presionar Barra Espaciadora
    fireEvent.keyDown(faceO, { key: ' ', code: 'Space' });
    expect(mockOnFaceClick).toHaveBeenCalledTimes(2);
  });

  test('renderiza correctamente el estado de pieza ausente (raíces fantasma y cruz)', () => {
    const { container } = render(
      <ToothViewer3D
        piece="11"
        toothMap={{
          '11_all': { state: { id: 'ausente', text: 'Ausente', glifo: 'X' }, color: '#94a3b8', layer: 'existing' }
        }}
        onFaceClick={mockOnFaceClick}
        isAusente={true}
      />
    );

    // Al estar ausente, no se renderizan los botones de presets
    expect(screen.queryByRole('button', { name: /rotar vista a vestibular/i })).not.toBeInTheDocument();

    // Debe contener las líneas de la cruz de ausencia
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
