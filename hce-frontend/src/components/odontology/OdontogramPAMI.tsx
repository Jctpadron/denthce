import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, RotateCcw, AlertCircle, Sparkles, Search, Plus, X as XIcon, Activity, Shield, Scissors, ChevronDown, ChevronUp } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import {
  ODONTOGRAM_CATALOG, GRUPOS, byGrupo, getById, getBySnomed,
  type OdontoState, type OdontogramLayer, type Grupo,
} from './odontogram-catalog';
import { useOdontoVisit } from './OdontoVisitContext';

interface OdontogramProps {
  patientId: string;
  birthDate?: string;
}

const ODONTOGRAM_LAYER_URL = 'http://denthce.local/fhir/StructureDefinition/odontogram-layer';
const LAYER_EXISTING_COLOR = 'var(--color-rose)';
const LAYER_PLANNED_COLOR = 'var(--color-primary)';

function readLayer(payload: any): OdontogramLayer {
  const ext = (payload?.extension || []).find((e: any) => e.url === ODONTOGRAM_LAYER_URL);
  return ext?.valueCode === 'planned' ? 'planned' : 'existing';
}

interface CellState {
  state: OdontoState;
  color: string;
  layer: OdontogramLayer;
}

const FACES = ['V', 'D', 'L', 'M', 'O'] as const;
// Centroides aproximados de cada cara dentro del viewBox 0 0 100 110.
const FACE_CENTROID: Record<string, { x: number; y: number }> = {
  V: { x: 50, y: 16 }, D: { x: 70, y: 32 }, L: { x: 50, y: 46 }, M: { x: 30, y: 32 }, O: { x: 50, y: 32 },
};

const GRUPO_ICONS: Record<Grupo, React.ReactNode> = {
  'Diagnóstico': <Search style={{ width: '0.95rem', height: '0.95rem' }} />,
  'Restauraciones': <Sparkles style={{ width: '0.95rem', height: '0.95rem' }} />,
  'Endodoncia': <Activity style={{ width: '0.95rem', height: '0.95rem' }} />,
  'Cirugía': <Scissors style={{ width: '0.95rem', height: '0.95rem' }} />,
  'Prevención': <Shield style={{ width: '0.95rem', height: '0.95rem' }} />
};

const GRUPO_COLORS: Record<Grupo, { solid: string; light: string; border: string }> = {
  'Diagnóstico': { solid: '#ef4444', light: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)' }, // Rojo para Diagnóstico y patologías
  'Restauraciones': { solid: '#059669', light: 'rgba(5, 150, 105, 0.08)', border: 'rgba(5, 150, 105, 0.2)' }, // Verde
  'Endodoncia': { solid: '#7c3aed', light: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.2)' }, // Violeta
  'Cirugía': { solid: '#ea580c', light: 'rgba(234, 88, 12, 0.08)', border: 'rgba(234, 88, 12, 0.2)' }, // Naranja
  'Prevención': { solid: '#0d9488', light: 'rgba(13, 148, 136, 0.08)', border: 'rgba(13, 148, 136, 0.2)' } // Cerceta/Teal
};

export const OdontogramPAMI: React.FC<OdontogramProps> = ({ patientId, birthDate }) => {
  const { activeEncounterId } = useOdontoVisit();
  const [activeTool, setActiveTool] = useState<string>('caries'); // id del catálogo o 'limpiar'
  const [activeToolTab, setActiveToolTab] = useState<Grupo>('Diagnóstico');
  const [activeLayer, setActiveLayer] = useState<OdontogramLayer>('existing');

  // Calcular modo de visualización inicial en base a la edad (menor a 13 años = mixto)
  const getInitialViewMode = (): 'adult' | 'child' | 'mixed' => {
    console.log("OdontogramPAMI - getInitialViewMode called with birthDate:", birthDate);
    if (!birthDate) {
      console.log("OdontogramPAMI - No birthDate provided, default to 'adult'");
      return 'adult';
    }
    const b = new Date(birthDate);
    if (isNaN(b.getTime())) {
      console.log("OdontogramPAMI - Invalid birthDate, default to 'adult'");
      return 'adult';
    }
    const age = Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970);
    console.log("OdontogramPAMI - Calculated age:", age);
    const mode = age < 13 ? 'mixed' : 'adult';
    console.log("OdontogramPAMI - Calculated viewMode:", mode);
    return mode;
  };

  const [viewMode, setViewMode] = useState<'adult' | 'child' | 'mixed'>(getInitialViewMode());
  const [clinicalResources, setClinicalResources] = useState<any[]>([]);
  const [toothMap, setToothMap] = useState<Record<string, CellState>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showLegend, setShowLegend] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showArcada, setShowArcada] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  // Sincronizar viewMode si cambia el birthDate del paciente
  useEffect(() => {
    const mode = getInitialViewMode();
    console.log("OdontogramPAMI - useEffect triggered, setting viewMode to:", mode);
    setViewMode(mode);
  }, [birthDate]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Toast flotante: se autocierra a los 3s y NO desplaza el layout.
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };
  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;

  const loadResources = async () => {
    try {
      const response = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      setClinicalResources(response.data);
      parseResources(response.data);
    } catch (err) {
      console.error('Error cargando recursos clínicos:', err);
    }
  };

  useEffect(() => { loadResources(); /* eslint-disable-next-line */ }, [patientId]);

  const parseResources = (resources: any[]) => {
    const map: Record<string, CellState> = {};
    resources.forEach((res) => {
      const piece = res.bodySite?.coding?.[0]?.code;
      if (!piece) return;
      const face = res.bodySite?.coding?.[1]?.code || 'all';
      const snomed = res.code?.coding?.[0]?.code;
      const state = getBySnomed(snomed, res.resourceType);
      if (!state) return;
      const layer = readLayer(res);
      // El color de la marca se toma del color sólido de la categoría del tratamiento
      const color = GRUPO_COLORS[state.grupo].solid;
      map[`${piece}_${face}`] = { state, color, layer };
    });
    setToothMap(map);
  };

  const handleCellClick = async (piece: string, face: string) => {
    setMessage(null);
    const pieceAll = toothMap[`${piece}_all`];
    if (pieceAll?.state.id === 'ausente' && activeTool !== 'limpiar') return;

    try {
      if (activeTool === 'limpiar') {
        // Intentar limpiar primero la cara cliqueada
        let existing = clinicalResources.find((res) => {
          const rPiece = res.bodySite?.coding?.[0]?.code;
          const rFace = res.bodySite?.coding?.[1]?.code || 'all';
          return rPiece === piece && rFace === face && readLayer(res) === activeLayer;
        });

        // Si no hay de esa cara, buscar si hay a nivel general de pieza ('all')
        if (!existing) {
          existing = clinicalResources.find((res) => {
            const rPiece = res.bodySite?.coding?.[0]?.code;
            const rFace = res.bodySite?.coding?.[1]?.code || 'all';
            return rPiece === piece && rFace === 'all' && readLayer(res) === activeLayer;
          });
        }

        if (existing?.id) {
          await axios.delete(`${apiBase}/resource/${existing.id}`, authHeader);
          setMessage({ type: 'success', text: 'Estado dental limpiado.' });
          loadResources();
        }
        return;
      }

      const state = getById(activeTool);
      if (!state) return;
      const targetFace = state.alcance === 'cara' ? face : 'all';
      const layer: OdontogramLayer = state.capaFija || activeLayer;
      const faceLabel = targetFace === 'all' ? 'Toda la pieza' : `Cara ${targetFace}`;

      const payload: any = {
        code: { coding: [{ system: 'http://snomed.info/sct', code: state.snomed.code, display: state.snomed.display }], text: state.text },
        bodySite: {
          coding: [
            { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
            { system: 'http://snomed.info/sct', code: targetFace, display: faceLabel },
          ],
        },
        extension: [{ url: ODONTOGRAM_LAYER_URL, valueCode: layer }],
      };
      if (state.resourceType === 'Condition') {
        payload.clinicalStatus = { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] };
      } else {
        payload.status = layer === 'planned' ? 'preparation' : 'completed';
      }

      await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: state.resourceType, payload, encounterId: activeEncounterId }, authHeader);
      setMessage({ type: 'success', text: 'Estado dental guardado.' });
      loadResources();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar el recurso clínico.' });
    }
  };

  const handleComplete = async (resourceId: string) => {
    setMessage(null);
    try {
      await axios.patch(`${apiBase}/resource/${resourceId}/complete`, {}, authHeader);
      setMessage({ type: 'success', text: 'Tratamiento marcado como realizado.' });
      loadResources();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo completar el tratamiento.' });
    }
  };

  // const handleAddManualPiece = () => {
  //   if (!manuallyAddedPieces.includes(selectedNewPiece)) setManuallyAddedPieces([...manuallyAddedPieces, selectedNewPiece]);
  // };

  const getToothSummaryState = (piece: string) => {
    const pieceKey = `${piece}_all`;
    const pieceCell = toothMap[pieceKey];
    if (pieceCell?.state.id === 'ausente') return 'ausente';

    let hasExisting = false;
    let hasPlanned = false;

    FACES.forEach((f) => {
      const cell = toothMap[`${piece}_${f}`];
      if (cell) {
        if (cell.layer === 'planned') {
          hasPlanned = true;
        } else {
          hasExisting = true;
        }
      }
    });

    const cellAll = toothMap[`${piece}_all`];
    if (cellAll) {
      if (cellAll.layer === 'planned') {
        hasPlanned = true;
      } else {
        hasExisting = true;
      }
    }

    if (hasExisting && hasPlanned) return 'mixed-layers';
    if (hasExisting) return 'existing';
    if (hasPlanned) return 'planned';
    return 'healthy';
  };

  const renderMiniToothSVG = (piece: string) => {
    const pieceAllKey = `${piece}_all`;
    const pieceAllCell = toothMap[pieceAllKey];
    const isAusente = pieceAllCell?.state.id === 'ausente';
    const pieceGlyphCell = pieceAllCell && pieceAllCell.state.id !== 'ausente' ? pieceAllCell : null;

    const getFaceFillColor = (face: string) => {
      if (isAusente) return 'transparent';
      const faceCell = toothMap[`${piece}_${face}`];
      // Si la cara tiene restauración, caries o incrustación se rellena
      if (faceCell && (faceCell.state.glifo === 'rellenoCara' || faceCell.state.glifo === 'lineasHorizontales')) {
        return faceCell.color;
      }
      const allCell = toothMap[`${piece}_all`];
      if (allCell && (allCell.state.glifo === 'rellenoCara' || allCell.state.glifo === 'lineasHorizontales')) {
        return allCell.color;
      }
      return '#ffffff';
    };

    const isFDIInfantil = parseInt(piece) > 50;
    const isSuperior = ['1', '2', '5', '6'].includes(piece.charAt(0));

    // Si la herramienta activa afecta a toda la pieza (ej. implante, extracción, etc.),
    // cualquier clic en una de sus caras se aplica a toda la pieza ('all').
    const handleFaceClick = (face: string) => {
      if (activeTool === 'limpiar') {
        handleCellClick(piece, face);
        return;
      }
      const toolState = getById(activeTool);
      if (toolState && toolState.alcance === 'pieza') {
        handleCellClick(piece, 'all');
      } else {
        handleCellClick(piece, face);
      }
    };

    // Renderizado simplificado de glifos de pieza para 30x30
    const renderMiniPieceGlyph = (state: any, color: string) => {
      switch (state.glifo) {
        case 'circulo': // corona
          return <circle cx="15" cy="15" r="9" fill="none" stroke={color} strokeWidth="1.8" pointerEvents="none" />;
        case 'pernoCorona': // perno corona
          return (
            <g pointerEvents="none">
              <circle cx="15" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="1.5" />
              <line x1="15" y1="17.5" x2="15" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" />
            </g>
          );
        case 'poste': // poste
          return <line x1="15" y1="7" x2="15" y2="23" stroke={color} strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />;
        case 'lineasVerticales': { // endodoncia
          const n = state.variante === 3 ? 3 : 1;
          if (n === 3) {
            return (
              <g pointerEvents="none">
                <line x1="11" y1="8" x2="11" y2="22" stroke={color} strokeWidth="1.2" />
                <line x1="15" y1="8" x2="15" y2="22" stroke={color} strokeWidth="1.2" />
                <line x1="19" y1="8" x2="19" y2="22" stroke={color} strokeWidth="1.2" />
              </g>
            );
          } else {
            return <line x1="15" y1="8" x2="15" y2="22" stroke={color} strokeWidth="1.6" pointerEvents="none" />;
          }
        }
        case 'letra': // momificación M, formocresol F
          return (
            <text
              x="15"
              y="18.5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="900"
              fill={color}
              pointerEvents="none"
              style={{ userSelect: 'none', fontFamily: 'sans-serif' }}
            >
              {state.letra}
            </text>
          );
        case 'X': // extracción indicada/realizada
          return (
            <g pointerEvents="none">
              <line x1="4" y1="4" x2="26" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="26" y1="4" x2="4" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          );
        case 'tornillo': // implante
          return (
            <g pointerEvents="none">
              <rect x="13" y="7" width="4" height="13" fill="#64748b" rx="0.5" stroke={color} strokeWidth="0.6" />
              <line x1="11" y1="9" x2="19" y2="9" stroke={color} strokeWidth="0.8" />
              <line x1="11" y1="12" x2="19" y2="12" stroke={color} strokeWidth="0.8" />
              <line x1="11" y1="15" x2="19" y2="15" stroke={color} strokeWidth="0.8" />
              <polygon points="13,20 17,20 15,24" fill={color} />
            </g>
          );
        default:
          return null;
      }
    };

    // Renderizado simplificado de glifos por cara para 30x30
    const renderMiniFaceGlyph = (face: string, state: any, color: string) => {
      const centroids: Record<string, { x: number; y: number }> = {
        V: { x: 15, y: 5 },
        D: { x: 25, y: 15 },
        L: { x: 15, y: 25 },
        M: { x: 5, y: 15 },
        O: { x: 15, y: 15 },
      };
      const c = centroids[face];
      if (!c) return null;

      if (state.glifo === 'lineasHorizontales') { // incrustación
        return (
          <g key={`minigf-${face}`} pointerEvents="none">
            <line x1={c.x - 3} y1={c.y - 1.5} x2={c.x + 3} y2={c.y - 1.5} stroke={color} strokeWidth="0.8" />
            <line x1={c.x - 3} y1={c.y} x2={c.x + 3} y2={c.y} stroke={color} strokeWidth="0.8" />
            <line x1={c.x - 3} y1={c.y + 1.5} x2={c.x + 3} y2={c.y + 1.5} stroke={color} strokeWidth="0.8" />
          </g>
        );
      }
      if (state.glifo === 'letra') { // sellante S
        return (
          <text
            key={`minigf-${face}`}
            x={c.x}
            y={c.y + 2.5}
            textAnchor="middle"
            fontSize="7"
            fontWeight="900"
            fill={color}
            pointerEvents="none"
            style={{ userSelect: 'none', fontFamily: 'sans-serif' }}
          >
            {state.letra}
          </text>
        );
      }
      return null;
    };

    // Estructura del botón interactivo con número y mini-diente SVG
    return (
      <div
        key={piece}
        title={`Pieza FDI ${piece}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.15rem'
        }}
      >
        {/* Número de pieza (arriba si es superior) */}
        {isSuperior && (
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#475569', userSelect: 'none' }}>
            {piece.slice(-1)}
          </span>
        )}

        <svg
          width="36"
          height="36"
          viewBox="0 0 30 30"
          style={{
            cursor: 'pointer',
            border: isAusente ? 'none' : '1px solid #475569',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            transition: 'transform 0.15s ease',
            background: isAusente ? '#f1f5f9' : '#ffffff',
            borderRadius: '3px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.zIndex = '10';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.zIndex = '1';
          }}
        >
          {isAusente ? (
            <g onClick={() => handleFaceClick('all')} style={{ cursor: 'pointer' }}>
              <rect x="0" y="0" width="30" height="30" fill="#f1f5f9" />
              <line x1="2" y1="2" x2="28" y2="28" stroke="var(--color-rose)" strokeWidth="3" strokeLinecap="round" />
              <line x1="28" y1="2" x2="2" y2="28" stroke="var(--color-rose)" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              {/* Cara Vestibular (arriba) */}
              <polygon className="tooth-polygon" points="0,0 30,0 20,10 10,10" fill={getFaceFillColor('V')} stroke="#475569" strokeWidth="0.8" onClick={() => handleFaceClick('V')} />
              {/* Cara Distal (derecha) */}
              <polygon className="tooth-polygon" points="30,0 30,30 20,20 20,10" fill={getFaceFillColor('D')} stroke="#475569" strokeWidth="0.8" onClick={() => handleFaceClick('D')} />
              {/* Cara Lingual (abajo) */}
              <polygon className="tooth-polygon" points="30,30 0,30 10,20 20,20" fill={getFaceFillColor('L')} stroke="#475569" strokeWidth="0.8" onClick={() => handleFaceClick('L')} />
              {/* Cara Mesial (izquierda) */}
              <polygon className="tooth-polygon" points="0,30 0,0 10,10 10,20" fill={getFaceFillColor('M')} stroke="#475569" strokeWidth="0.8" onClick={() => handleFaceClick('M')} />
              {/* Cara Oclusal (centro) */}
              <polygon className="tooth-polygon" points="10,10 20,10 20,20 10,20" fill={getFaceFillColor('O')} stroke="#475569" strokeWidth="0.8" onClick={() => handleFaceClick('O')} />

              {/* Glifos por cara (incrustación, sellante) */}
              {FACES.map((f) => {
                const cell = toothMap[`${piece}_${f}`];
                return cell ? renderMiniFaceGlyph(f, cell.state, cell.color) : null;
              })}

              {/* Glifo de pieza completa (corona, implante, endodoncia, etc.) */}
              {pieceGlyphCell && renderMiniPieceGlyph(pieceGlyphCell.state, pieceGlyphCell.color)}
            </g>
          )}
        </svg>

        {/* Número de pieza (abajo si es inferior) */}
        {!isSuperior && (
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#475569', userSelect: 'none' }}>
            {piece.slice(-1)}
          </span>
        )}
      </div>
    );
  };


  const existing = clinicalResources.filter((r) => readLayer(r) === 'existing');
  const planned = clinicalResources.filter((r) => readLayer(r) === 'planned');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minWidth: 0, position: 'relative' }}>

      {/* TOAST flotante (no desplaza el layout) */}
      {message && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 1.1rem', borderRadius: '12px', fontSize: '0.85rem', maxWidth: '360px',
          background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
          color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)',
          boxShadow: 'var(--shadow-md)', animation: 'fadeIn 0.2s ease',
        }}>
          {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} /> : <AlertCircle style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />}
          <span style={{ fontWeight: 500 }}>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}><XIcon style={{ width: '0.9rem', height: '0.9rem' }} /></button>
        </div>
      )}

      {/* Espacio de trabajo del Odontograma unificado en un único panel con bordes limpios */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '0.35rem', // padding mínimo externo para que la barra de estado llegue a los bordes
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>

        {/* 1. Barra de Estado Dinámica: Qué está haciendo el profesional y Selector de Capa */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: activeLayer === 'existing' ? '#fff5f5' : '#eff6ff',
          borderBottom: `1px solid ${activeLayer === 'existing' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)'}`,
          padding: '0.75rem 1rem',
          margin: '-0.35rem -0.35rem 0.5rem -0.35rem', // sangría negativa para ocupar todo el ancho superior del panel
          borderRadius: '14px 14px 0 0',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '1.1rem',
              lineHeight: 1
            }}>
              {activeLayer === 'existing' ? '📋' : '📅'}
            </span>
            <div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: activeLayer === 'existing' ? '#991b1b' : '#1e40af',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                {activeLayer === 'existing' ? 'Modo Diagnóstico (Existente)' : 'Modo Plan de Tratamiento'}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: activeLayer === 'existing' ? '#b91c1c' : '#2563eb',
                fontWeight: 500,
                marginTop: '0.05rem'
              }}>
                {activeLayer === 'existing'
                  ? 'Registra patologías activas y piezas ausentes que ya posee el paciente (se pintarán en ROJO).'
                  : 'Planifica tratamientos futuros (se pintarán en AZUL, luego podrás marcarlos como realizados).'}
              </div>
            </div>
          </div>

          {/* Alternador de Capa Integrado */}
          <div className="segmented-control" style={{ background: 'rgba(0, 0, 0, 0.05)', padding: '0.15rem' }}>
            <button
              type="button"
              onClick={() => setActiveLayer('existing')}
              className={`segmented-button ${activeLayer === 'existing' ? 'active' : ''}`}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: activeLayer === 'existing' ? 700 : 500
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: LAYER_EXISTING_COLOR }} />
              Existente
            </button>
            <button
              type="button"
              onClick={() => setActiveLayer('planned')}
              className={`segmented-button ${activeLayer === 'planned' ? 'active' : ''}`}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: activeLayer === 'planned' ? 700 : 500
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: LAYER_PLANNED_COLOR, border: `1px dashed ${LAYER_PLANNED_COLOR}` }} />
              Plan
            </button>
          </div>
        </div>

        {/* Caja interior para las pestañas y las herramientas con padding adecuado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0 0.85rem 0.85rem 0.85rem' }}>

          {/* Fila 1: Pestañas (Solapas) de Grupos (Responsive wrap, sin scroll oculto) */}
          <div className="segmented-control" style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.02)',
            padding: '0.3rem',
            borderRadius: '12px',
            border: '1px solid rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexWrap: 'wrap', // Envoltura automática para evitar scroll horizontal y solapas cortadas
            gap: '0.35rem',
            alignItems: 'center'
          }}>
            {GRUPOS.map((g) => {
              const isActive = activeToolTab === g;
              const gColor = GRUPO_COLORS[g];
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setActiveToolTab(g);
                    const herramientas = byGrupo(g);
                    if (herramientas.length > 0) {
                      setActiveTool(herramientas[0].id);
                    }
                  }}
                  className={`segmented-button ${isActive ? 'active' : ''}`}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.82rem',
                    flex: '1 0 auto',
                    justifyContent: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? gColor.solid : '#64748b',
                    border: isActive ? `1px solid ${gColor.solid}40` : '1px solid transparent',
                    boxShadow: isActive ? `0 4px 12px ${gColor.solid}15` : 'none',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = gColor.solid;
                      e.currentTarget.style.background = gColor.light;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isActive ? gColor.solid : '#94a3b8'
                  }}>
                    {GRUPO_ICONS[g]}
                  </span>
                  {g}
                </button>
              );
            })}

            {/* Botón de limpiar / resetear prestación activa */}
            <button
              type="button"
              onClick={() => setActiveTool('limpiar')}
              className="btn"
              title="Limpiar herramienta seleccionada"
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                background: activeTool === 'limpiar' ? '#f1f5f9' : '#ffffff',
                borderColor: activeTool === 'limpiar' ? '#94a3b8' : 'rgba(0, 0, 0, 0.08)',
                color: activeTool === 'limpiar' ? '#475569' : '#64748b',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderWidth: '1px',
                borderStyle: 'solid',
                height: '38px',
                width: '38px',
                minWidth: '38px',
                marginLeft: 'auto'
              }}
              onMouseOver={(e) => {
                if (activeTool !== 'limpiar') {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.background = '#f1f5f9';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTool !== 'limpiar') {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.background = '#ffffff';
                }
              }}
            >
              <RotateCcw style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>

          {/* Fila 2: Botones de la Pestaña Activa (Toolbox Panel Conectado) con botón Limpiar al final */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            minHeight: '48px',
            background: '#ffffff',
            padding: '0.85rem 1.1rem',
            borderRadius: '12px',
            border: '1px solid rgba(0, 0, 0, 0.04)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
          }}>
            {byGrupo(activeToolTab).map((s) => {
              const isActive = activeTool === s.id;
              const activeColorConfig = GRUPO_COLORS[activeToolTab];

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveTool(s.id)}
                  className="btn"
                  style={{
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.8rem',
                    borderRadius: '20px',
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? activeColorConfig.light : '#ffffff',
                    borderColor: isActive ? activeColorConfig.solid : 'var(--border-color)',
                    color: isActive ? activeColorConfig.solid : '#64748b',
                    boxShadow: isActive ? `0 2px 8px ${activeColorConfig.solid}20` : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    borderWidth: isActive ? '2px' : '1px',
                    borderStyle: 'solid'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = activeColorConfig.solid;
                      e.currentTarget.style.color = activeColorConfig.solid;
                      e.currentTarget.style.background = activeColorConfig.light;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.background = '#ffffff';
                    }
                  }}
                >
                  {isActive && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: activeColorConfig.solid,
                      display: 'inline-block'
                    }} />
                  )}
                  {s.label}
                </button>
              );
            })}

          </div>

        </div>
      </div>

      {/* Modal / Popup de Referencias de Simbología */}
      {showLegend && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowLegend(false)}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '600px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'zoomIn 0.2s ease',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📖 Referencias de Simbología Dental
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', marginTop: '0.25rem' }}>
                  <span><strong>Estilo:</strong> ─ Línea Continua (Existente) &nbsp;/&nbsp; ╎ Línea Discontinua (Plan)</span>
                </span>
              </div>
              <button
                onClick={() => setShowLegend(false)}
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.35rem',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <XIcon style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>

            {/* Contenido del Modal (Grilla de referencias) */}
            <div style={{
              padding: '1.5rem',
              maxHeight: '60vh',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1rem'
            }}>
              {ODONTOGRAM_CATALOG.filter((s) => !s.hidden).map((s) => {
                const renderLegendGlyph = () => {
                  const color = GRUPO_COLORS[s.grupo].solid;
                  if (s.alcance === 'pieza') {
                    switch (s.glifo) {
                      case 'ausente':
                        return (
                          <g>
                            <rect x="2" y="2" width="26" height="26" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.8" rx="2" />
                            <line x1="4" y1="4" x2="26" y2="26" stroke={color} strokeWidth="2.5" />
                            <line x1="26" y1="4" x2="4" y2="26" stroke={color} strokeWidth="2.5" />
                          </g>
                        );
                      case 'circulo': // corona
                        return <circle cx="15" cy="15" r="9" fill="none" stroke={color} strokeWidth="1.8" />;
                      case 'pernoCorona':
                        return (
                          <g>
                            <circle cx="15" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="1.5" />
                            <line x1="15" y1="17.5" x2="15" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" />
                          </g>
                        );
                      case 'poste':
                        return <line x1="15" y1="7" x2="15" y2="23" stroke={color} strokeWidth="2.5" strokeLinecap="round" />;
                      case 'lineasVerticales': {
                        const n = s.variante === 3 ? 3 : 1;
                        if (n === 3) {
                          return (
                            <g>
                              <line x1="11" y1="8" x2="11" y2="22" stroke={color} strokeWidth="1.2" />
                              <line x1="15" y1="8" x2="15" y2="22" stroke={color} strokeWidth="1.2" />
                              <line x1="19" y1="8" x2="19" y2="22" stroke={color} strokeWidth="1.2" />
                            </g>
                          );
                        } else {
                          return <line x1="15" y1="8" x2="15" y2="22" stroke={color} strokeWidth="1.6" />;
                        }
                      }
                      case 'letra':
                        return <text x="15" y="19" textAnchor="middle" fontSize="10" fontWeight="900" fill={color} style={{ fontFamily: 'sans-serif' }}>{s.letra}</text>;
                      case 'X':
                        return (
                          <g>
                            <line x1="4" y1="4" x2="26" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="26" y1="4" x2="4" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
                          </g>
                        );
                      case 'tornillo':
                        return (
                          <g>
                            <rect x="13" y="7" width="4" height="13" fill="#64748b" rx="0.5" stroke={color} strokeWidth="0.6" />
                            <line x1="11" y1="9" x2="19" y2="9" stroke={color} strokeWidth="0.8" />
                            <line x1="11" y1="12" x2="19" y2="12" stroke={color} strokeWidth="0.8" />
                            <line x1="11" y1="15" x2="19" y2="15" stroke={color} strokeWidth="0.8" />
                            <polygon points="13,20 17,20 15,24" fill={color} />
                          </g>
                        );
                      default:
                        return null;
                    }
                  } else {
                    if (s.glifo === 'rellenoCara') {
                      return <rect x="8" y="8" width="14" height="14" fill={color} rx="2" />;
                    }
                    if (s.glifo === 'lineasHorizontales') {
                      return (
                        <g>
                          <rect x="8" y="8" width="14" height="14" fill="none" stroke={color} strokeWidth="1" rx="2" />
                          <line x1="10" y1="11" x2="20" y2="11" stroke={color} strokeWidth="0.8" />
                          <line x1="10" y1="15" x2="20" y2="15" stroke={color} strokeWidth="0.8" />
                          <line x1="10" y1="19" x2="20" y2="19" stroke={color} strokeWidth="0.8" />
                        </g>
                      );
                    }
                    if (s.glifo === 'letra') {
                      return (
                        <g>
                          <rect x="8" y="8" width="14" height="14" fill="none" stroke={color} strokeWidth="1" rx="2" />
                          <text x="15" y="18" textAnchor="middle" fontSize="9" fontWeight="900" fill={color} style={{ fontFamily: 'sans-serif' }}>{s.letra}</text>
                        </g>
                      );
                    }
                  }
                  return null;
                };

                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <svg width="28" height="28" viewBox="0 0 30 30" style={{ flexShrink: 0, border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}>
                      {renderLegendGlyph()}
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>{s.label}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--color-muted)', textTransform: 'capitalize' }}>
                        {s.alcance === 'pieza' ? 'Toda la pieza' : 'Por cara dental'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie del Modal */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                className="btn btn-secondary"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.82rem',
                  borderRadius: '10px'
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor inferior de control comentado para uso futuro según indicaciones del usuario:
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button 
            type="button"
            onClick={() => setShowDrawer(true)} 
            className="btn btn-primary" 
            style={{ 
              padding: '0.45rem 1rem', 
              fontSize: '0.78rem', 
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              fontWeight: 600,
              border: 'none'
            }}
          >
            📋 Historial y Planes ({existing.length + planned.length})
          </button>
        </div>
        */}

      {/* Vista Rápida de Arcada Dental Completa (Opción A) en base a cruz FDI */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        transition: 'all 0.2s ease',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowArcada(!showArcada)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>🦷</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
              Vista Rápida de Arcada Dental Completa (FDI)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Botón Ver referencias reubicado en la cabecera */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Evitar colapsar la arcada al abrir referencias
                setShowLegend(true);
              }}
              className="btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.74rem',
                borderRadius: '8px',
                background: '#ffffff',
                color: 'var(--color-text)',
                borderColor: 'var(--border-color)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.color = 'var(--border-hover)';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--color-text)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              📖 Ver referencias
            </button>

            <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 500 }}>
              {showArcada ? 'Click para colapsar' : 'Click para expandir'}
            </span>
            {showArcada ? <ChevronUp style={{ width: '1rem', height: '1rem', color: '#64748b' }} /> : <ChevronDown style={{ width: '1rem', height: '1rem', color: '#64748b' }} />}
          </div>
        </div>

        {showArcada && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            overflowX: 'auto',
            padding: '0.5rem 0',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
            animation: 'fadeIn 0.2s ease',
            alignItems: 'center'
          }}>

            {/* 1. Arcada de Adultos (Cuadrantes 1, 2, 4, 3) */}
            {(viewMode === 'adult' || viewMode === 'mixed') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Dientes Permanentes (Adultos)</div>

                {/* Grid de 2x2 para cruz FDI */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  position: 'relative',
                  minWidth: '680px',
                  maxWidth: '100%',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.5rem'
                }}>
                  {/* Cuadrante 1 (Superior Derecha Paciente / Izquierda Pantalla) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0.85rem 1.25rem 0.85rem 0.5rem',
                    borderRight: '3px solid #000000',
                    borderBottom: '3px solid #000000',
                    gap: '0.4rem'
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000000', marginRight: 'auto', userSelect: 'none' }}>1</span>
                    {['18', '17', '16', '15', '14', '13', '12', '11'].map((t) => renderMiniToothSVG(t))}
                  </div>

                  {/* Cuadrante 2 (Superior Izquierda Paciente / Derecha Pantalla) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '0.85rem 0.5rem 0.85rem 1.25rem',
                    borderBottom: '3px solid #000000',
                    gap: '0.4rem'
                  }}>
                    {['21', '22', '23', '24', '25', '26', '27', '28'].map((t) => renderMiniToothSVG(t))}
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000000', marginLeft: 'auto', userSelect: 'none' }}>2</span>
                  </div>

                  {/* Cuadrante 4 (Inferior Derecha Paciente / Izquierda Pantalla) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0.85rem 1.25rem 0.85rem 0.5rem',
                    borderRight: '3px solid #000000',
                    gap: '0.4rem'
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000000', marginRight: 'auto', userSelect: 'none' }}>4</span>
                    {['48', '47', '46', '45', '44', '43', '42', '41'].map((t) => renderMiniToothSVG(t))}
                  </div>

                  {/* Cuadrante 3 (Inferior Izquierda Paciente / Derecha Pantalla) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '0.85rem 0.5rem 0.85rem 1.25rem',
                    gap: '0.4rem'
                  }}>
                    {['31', '32', '33', '34', '35', '36', '37', '38'].map((t) => renderMiniToothSVG(t))}
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000000', marginLeft: 'auto', userSelect: 'none' }}>3</span>
                  </div>
                </div>
              </div>
            )}

            {/* Separador de dentición si es mixto */}
            {viewMode === 'mixed' && (
              <div style={{ borderTop: '2px dashed var(--border-color)', width: '100%', margin: '0.5rem 0' }} />
            )}

            {/* 2. Arcada Temporal / Infantil (Cuadrantes 5, 6, 8, 7) */}
            {(viewMode === 'child' || viewMode === 'mixed') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Dientes Temporales (Niños)</div>

                {/* Grid de 2x2 para cruz FDI Infantil */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  position: 'relative',
                  minWidth: '480px',
                  maxWidth: '100%',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.5rem'
                }}>
                  {/* Cuadrante 5 (Derecha 5) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0.85rem 1.25rem 0.85rem 0.5rem',
                    borderRight: '3px solid #000000',
                    borderBottom: '3px solid #000000',
                    gap: '0.4rem'
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#000000', marginRight: 'auto', whiteSpace: 'nowrap', userSelect: 'none' }}>Derecha 5</span>
                    {['55', '54', '53', '52', '51'].map((t) => renderMiniToothSVG(t))}
                  </div>

                  {/* Cuadrante 6 (6 Izquierda) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '0.85rem 0.5rem 0.85rem 1.25rem',
                    borderBottom: '3px solid #000000',
                    gap: '0.4rem'
                  }}>
                    {['61', '62', '63', '64', '65'].map((t) => renderMiniToothSVG(t))}
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#000000', marginLeft: 'auto', whiteSpace: 'nowrap', userSelect: 'none' }}>6 Izquierda</span>
                  </div>

                  {/* Cuadrante 8 (8) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0.85rem 1.25rem 0.85rem 0.5rem',
                    borderRight: '3px solid #000000',
                    gap: '0.4rem'
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#000000', marginRight: 'auto', userSelect: 'none' }}>8</span>
                    {['85', '84', '83', '82', '81'].map((t) => renderMiniToothSVG(t))}
                  </div>

                  {/* Cuadrante 7 (7) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '0.85rem 0.5rem 0.85rem 1.25rem',
                    gap: '0.4rem'
                  }}>
                    {['71', '72', '73', '74', '75'].map((t) => renderMiniToothSVG(t))}
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#000000', marginLeft: 'auto', userSelect: 'none' }}>7</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <AlertCircle style={{ width: '1rem', height: '1rem', color: 'var(--color-primary)', flexShrink: 0 }} />
        <span>Elegí la capa (existente/plan) y una prestación de la barra; después tocá la cara del diente directamente en el odontograma FDI superior para registrarla.</span>
      </div>

      {/* Drawer Deslizable Lateral para Historial y Tratamientos */}
      {showDrawer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 1050,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowDrawer(false)}
        >
          <div
            style={{
              width: isMobile ? '85%' : '380px',
              height: '100%',
              background: 'var(--bg-surface)',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInFromRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Drawer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-title)' }}>Historial y Planificación</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Resumen de prestaciones del paciente</span>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.35rem',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff'
                }}
              >
                <XIcon style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>

            {/* Contenido del Drawer */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {[{ key: 'existing', list: existing, color: LAYER_EXISTING_COLOR, title: 'Existente (rojo)' }, { key: 'planned', list: planned, color: LAYER_PLANNED_COLOR, title: 'Plan a realizar (azul)' }].map((col) => (
                <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: col.color, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: `2px ${col.key === 'planned' ? 'dashed' : 'solid'} ${col.color}`, paddingBottom: '0.5rem', margin: 0, fontFamily: 'var(--font-title)' }}>
                    {col.key === 'planned' ? <Sparkles style={{ width: '1rem', height: '1rem', color: col.color }} /> : <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />}
                    {col.title} · {col.list.length}
                  </h4>
                  {col.list.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.25rem 0' }}>{col.key === 'planned' ? 'Sin tratamientos planificados.' : 'Sin prestaciones existentes.'}</p>
                  ) : col.list.map((res) => {
                    const pieceCode = res.bodySite?.coding?.[0]?.code;
                    const faceCode = res.bodySite?.coding?.[1]?.code || 'all';
                    const isCondition = res.resourceType === 'Condition';
                    const snomed = res.code?.coding?.[0]?.code;
                    const state = getBySnomed(snomed, res.resourceType);
                    const groupColor = state ? GRUPO_COLORS[state.grupo].solid : col.color;
                    const groupLight = state ? GRUPO_COLORS[state.grupo].light : 'var(--bg-surface)';
                    
                    return (
                      <div key={res.id} style={{ padding: '0.85rem 1rem', background: 'var(--bg-card)', border: `1px ${col.key === 'planned' ? 'dashed' : 'solid'} var(--border-color)`, borderLeft: `4px solid ${groupColor}`, borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.15rem 0.45rem', borderRadius: '5px', background: groupLight, color: groupColor, border: `1px solid ${groupColor}40`, letterSpacing: '0.03em' }}>{isCondition ? 'Diagnóstico' : 'Tratamiento'}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Pieza {pieceCode} ({faceCode === 'all' ? 'Completa' : `Cara ${faceCode}`})</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>{res.code?.text || 'Intervención'}</p>
                        {col.key === 'planned' && (
                          <button type="button" className="btn" onClick={() => handleComplete(res.id)} style={{ marginTop: '0.15rem', fontSize: '0.74rem', padding: '0.35rem 0.6rem', borderRadius: '8px', borderColor: LAYER_EXISTING_COLOR, color: LAYER_EXISTING_COLOR, background: 'var(--bg-surface)', gap: '0.35rem' }}>
                            <CheckCircle style={{ width: '0.85rem', height: '0.85rem' }} /> Marcar como realizado
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
