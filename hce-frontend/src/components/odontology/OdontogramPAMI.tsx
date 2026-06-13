import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, RotateCcw, AlertCircle, Sparkles, Search, Plus, X as XIcon } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import {
  ODONTOGRAM_CATALOG, GRUPOS, byGrupo, getById, getBySnomed,
  type OdontoState, type OdontogramLayer, type Grupo,
} from './odontogram-catalog';

interface OdontogramProps {
  patientId: string;
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

export const OdontogramPAMI: React.FC<OdontogramProps> = ({ patientId }) => {
  const [activeTool, setActiveTool] = useState<string>('caries'); // id del catálogo o 'limpiar'
  const [activeToolTab, setActiveToolTab] = useState<Grupo>('Diagnóstico');
  const [activeLayer, setActiveLayer] = useState<OdontogramLayer>('existing');
  const [viewMode, setViewMode] = useState<'adult' | 'child' | 'mixed'>('mixed');
  const [clinicalResources, setClinicalResources] = useState<any[]>([]);
  const [toothMap, setToothMap] = useState<Record<string, CellState>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedNewPiece, setSelectedNewPiece] = useState('11');
  const [manuallyAddedPieces, setManuallyAddedPieces] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'afectados' | 'todos'>('afectados');
  const [showLegend, setShowLegend] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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
      const color = layer === 'planned' ? LAYER_PLANNED_COLOR : LAYER_EXISTING_COLOR;
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
        const existing = clinicalResources.find((res) => {
          const rPiece = res.bodySite?.coding?.[0]?.code;
          const rFace = res.bodySite?.coding?.[1]?.code || 'all';
          return rPiece === piece && rFace === face && readLayer(res) === activeLayer;
        });
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

      await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: state.resourceType, payload }, authHeader);
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

  const handleAddManualPiece = () => {
    if (!manuallyAddedPieces.includes(selectedNewPiece)) setManuallyAddedPieces([...manuallyAddedPieces, selectedNewPiece]);
  };

  // ---- Glifos ----
  const renderPieceGlyph = (state: OdontoState, color: string) => {
    switch (state.glifo) {
      case 'circulo':
        return <ellipse cx="50" cy="32" rx="34" ry="24" fill="none" stroke={color} strokeWidth="3.5" pointerEvents="none" />;
      case 'pernoCorona':
        return (<g pointerEvents="none">
          <ellipse cx="50" cy="30" rx="22" ry="16" fill="none" stroke={color} strokeWidth="3" />
          <line x1="50" y1="46" x2="50" y2="92" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        </g>);
      case 'poste':
        return <line x1="50" y1="40" x2="50" y2="94" stroke={color} strokeWidth="5" strokeLinecap="round" pointerEvents="none" />;
      case 'lineasVerticales': {
        const n = state.variante === 3 ? 3 : 1;
        const xs = n === 3 ? [38, 50, 62] : [50];
        return <g pointerEvents="none">{xs.map((x) => <line key={x} x1={x} y1="52" x2={x} y2="96" stroke={color} strokeWidth="3" strokeLinecap="round" />)}</g>;
      }
      case 'letra':
        return <text x="50" y="40" textAnchor="middle" fontSize="30" fontWeight="800" fill={color} pointerEvents="none">{state.letra}</text>;
      case 'X':
        return (<g pointerEvents="none">
          <line x1="18" y1="14" x2="82" y2="86" stroke={color} strokeWidth="5" strokeLinecap="round" />
          <line x1="82" y1="14" x2="18" y2="86" stroke={color} strokeWidth="5" strokeLinecap="round" />
        </g>);
      case 'tornillo':
        return (<g transform="translate(0,10)" pointerEvents="none">
          <rect x="46" y="38" width="8" height="45" fill="#94a3b8" rx="2" stroke={color} strokeWidth="1.2" />
          {[46, 54, 62, 70].map((y) => <line key={y} x1="43" y1={y} x2="57" y2={y} stroke={color} strokeWidth="1.5" />)}
          <polygon points="46,83 54,83 50,90" fill={color} />
        </g>);
      default:
        return null;
    }
  };

  // Glifo específico por cara (incrustación, sellante). Caries/restauración solo rellenan.
  const renderFaceGlyph = (face: string, state: OdontoState, color: string) => {
    const c = FACE_CENTROID[face];
    if (!c) return null;
    if (state.glifo === 'lineasHorizontales') {
      return <g key={`gf-${face}`} pointerEvents="none">
        {[-3, 0, 3].map((dy) => <line key={dy} x1={c.x - 7} y1={c.y + dy} x2={c.x + 7} y2={c.y + dy} stroke={color} strokeWidth="1.4" />)}
      </g>;
    }
    if (state.glifo === 'letra') {
      return <text key={`gf-${face}`} x={c.x} y={c.y + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill={color} pointerEvents="none">{state.letra}</text>;
    }
    return null;
  };

  const renderTooth = (piece: string) => {
    const pieceCell = toothMap[`${piece}_all`];
    const isAusente = pieceCell?.state.id === 'ausente';
    const pieceGlyphCell = pieceCell && pieceCell.state.id !== 'ausente' ? pieceCell : null;
    const hasPlanned = ['all', ...FACES].some((f) => toothMap[`${piece}_${f}`]?.layer === 'planned');
    const isCorona = pieceCell?.state.id === 'corona';

    const faceFill = (f: string) => {
      const cell = toothMap[`${piece}_${f}`];
      if (!cell) return '#ffffff';
      // Solo rellenan la cara: caries, restauración, incrustación.
      return (cell.state.glifo === 'rellenoCara' || cell.state.glifo === 'lineasHorizontales') ? cell.color : '#ffffff';
    };

    return (
      <div key={piece} style={{
        border: hasPlanned ? `2px dashed ${LAYER_PLANNED_COLOR}` : (isCorona ? `2px solid ${LAYER_EXISTING_COLOR}` : '1px solid var(--border-color)'),
        borderRadius: '12px', padding: '0.85rem', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '0.65rem', boxShadow: 'var(--shadow-sm)', position: 'relative', minWidth: '120px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Nº {piece}</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--color-muted)', fontWeight: 600 }}>{parseInt(piece) > 50 ? 'Infantil' : 'Adulto'}</span>
        </div>

        <div style={{ position: 'relative', width: '84px', height: '96px' }}>
          <svg width="84" height="96" viewBox="0 0 100 110" style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              <linearGradient id="toothRootGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Raíces */}
            {!isAusente && pieceCell?.state.glifo !== 'tornillo' && (
              <path d="M 22,50 C 22,75 28,95 32,100 C 35,102 38,98 40,82 C 43,68 47,62 50,62 C 53,62 57,68 60,82 C 62,98 65,102 68,100 C 72,95 78,75 78,50 Z"
                fill="url(#toothRootGrad)" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
            )}

            {/* Corona del diente */}
            {!isAusente && (
              <path d="M 20,50 C 16,50 14,24 24,14 C 34,4 66,4 76,14 C 86,24 84,50 80,50 Z" fill="none" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />
            )}

            {/* Caras interactivas */}
            {!isAusente && (
              <>
                <path d="M 24,14 C 34,4 66,4 76,14 L 62,26 C 55,22 45,22 38,26 Z" fill={faceFill('V')} stroke="#475569" strokeWidth="1" onClick={() => handleCellClick(piece, 'V')} />
                <path d="M 76,14 C 86,24 84,50 80,50 L 62,38 C 67,34 67,28 62,26 Z" fill={faceFill('D')} stroke="#475569" strokeWidth="1" onClick={() => handleCellClick(piece, 'D')} />
                <path d="M 20,50 C 24,54 76,54 80,50 L 62,38 C 55,42 45,42 38,38 Z" fill={faceFill('L')} stroke="#475569" strokeWidth="1" onClick={() => handleCellClick(piece, 'L')} />
                <path d="M 20,50 C 14,50 16,24 24,14 L 38,26 C 33,28 33,34 38,38 Z" fill={faceFill('M')} stroke="#475569" strokeWidth="1" onClick={() => handleCellClick(piece, 'M')} />
                <path d="M 38,26 C 45,22 55,22 62,26 C 67,28 67,34 62,38 C 55,42 45,42 38,38 C 33,34 33,28 38,26 Z" fill={faceFill('O')} stroke="#475569" strokeWidth="1" onClick={() => handleCellClick(piece, 'O')} />
                {/* Glifos por cara (incrustación, sellante) */}
                {FACES.map((f) => { const cell = toothMap[`${piece}_${f}`]; return cell ? renderFaceGlyph(f, cell.state, cell.color) : null; })}
                {/* Glifo de pieza (corona, perno, endodoncia, M/F, extracción, implante) */}
                {pieceGlyphCell && renderPieceGlyph(pieceGlyphCell.state, pieceGlyphCell.color)}
              </>
            )}

            {/* Pieza ausente: raíces fantasma + X */}
            {isAusente && (
              <>
                <path d="M 22,50 C 22,75 28,95 32,100 C 35,102 38,98 40,82 C 43,68 47,62 50,62 C 53,62 57,68 60,82 C 62,98 65,102 68,100 C 72,95 78,75 78,50 Z" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="15" y1="15" x2="85" y2="85" stroke={pieceCell!.color} strokeWidth="4.5" strokeLinecap="round" />
                <line x1="85" y1="15" x2="15" y2="85" stroke={pieceCell!.color} strokeWidth="4.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </div>

        <button onClick={() => handleCellClick(piece, 'all')} style={{
          width: '100%', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px',
          fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-text)', padding: '0.25rem 0', cursor: 'pointer',
        }}>Toda la Pieza</button>
      </div>
    );
  };

  const adultUpper = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
  const adultLower = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
  const childUpper = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'];
  const childLower = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'];
  const baseList = viewMode === 'adult' ? [...adultUpper, ...adultLower] : viewMode === 'child' ? [...childUpper, ...childLower] : [...adultUpper, ...childUpper, ...childLower, ...adultLower];

  const pieceHasAnything = (piece: string) => ['all', ...FACES].some((f) => !!toothMap[`${piece}_${f}`]);

  const filteredTeeth = baseList.filter((piece) => {
    const affected = pieceHasAnything(piece) || manuallyAddedPieces.includes(piece);
    if (statusFilter === 'afectados' && !affected) return false;
    if (searchTerm.trim() !== '' && !piece.includes(searchTerm.trim())) return false;
    return true;
  });

  const toolBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    background: active ? 'var(--bg-surface)' : 'var(--bg-surface)', borderColor: active ? color : 'var(--border-color)',
    color: active ? color : 'var(--color-text)', padding: '0.4rem 0.75rem', fontSize: '0.78rem', borderRadius: '9px',
    fontWeight: active ? 700 : 500, borderWidth: active ? '2px' : '1px',
  });

  const existing = clinicalResources.filter((r) => readLayer(r) === 'existing');
  const planned = clinicalResources.filter((r) => readLayer(r) === 'planned');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr minmax(260px, 300px)', gap: '1.5rem', width: '100%', alignItems: 'start', overflow: 'hidden', minWidth: 0, position: 'relative' }}>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, overflow: 'hidden' }}>

        {/* Capa */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Capa de registro:</span>
          <div className="segmented-control">
            <button type="button" onClick={() => setActiveLayer('existing')} className={`segmented-button ${activeLayer === 'existing' ? 'active' : ''}`} style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: LAYER_EXISTING_COLOR }} /> Diagnóstico (existente)
            </button>
            <button type="button" onClick={() => setActiveLayer('planned')} className={`segmented-button ${activeLayer === 'planned' ? 'active' : ''}`} style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: LAYER_PLANNED_COLOR, border: `1px dashed ${LAYER_PLANNED_COLOR}` }} /> Plan (a realizar)
            </button>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', flex: 1, minWidth: '180px' }}>
            {activeLayer === 'existing' ? 'Prestaciones existentes → rojo.' : 'Plan de tratamiento → azul. Luego "marcar como realizado".'}
          </span>
        </div>

        {/* Barra de herramientas organizada en solapas interactivas */}
        <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Fila 1: Pestañas (Solapas) de Grupos */}
          <div className="segmented-control" style={{ width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.02)', padding: '0.2rem' }}>
            {GRUPOS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setActiveToolTab(g)}
                className={`segmented-button ${activeToolTab === g ? 'active' : ''}`}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', flex: '1 0 auto', justifyContent: 'center' }}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Fila 2: Botones de la Pestaña Activa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', minHeight: '38px' }}>
            {byGrupo(activeToolTab).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveTool(s.id)}
                className="btn"
                style={toolBtnStyle(activeTool === s.id, activeLayer === 'planned' ? LAYER_PLANNED_COLOR : LAYER_EXISTING_COLOR)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.7rem' }}>
            <button onClick={() => setActiveTool('limpiar')} className="btn" style={{ ...toolBtnStyle(activeTool === 'limpiar', 'var(--color-muted)'), gap: '0.3rem' }}>
              <RotateCcw style={{ width: '0.85rem', height: '0.85rem' }} /> Limpiar
            </button>
            <button onClick={() => setShowLegend((v) => !v)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', borderRadius: '9px' }}>
              {showLegend ? 'Ocultar' : 'Ver'} referencias
            </button>
            <div style={{ flex: 1 }} />
            <div className="segmented-control">
              {(['adult', 'child', 'mixed'] as const).map((m) => (
                <button key={m} onClick={() => setViewMode(m)} className={`segmented-button ${viewMode === m ? 'active' : ''}`} style={{ padding: '0.4rem 0.7rem', fontSize: '0.76rem' }}>
                  {m === 'adult' ? 'Adulto' : m === 'child' ? 'Infantil' : 'Mixto'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leyenda / referencias (autogenerada del catálogo) */}
        {showLegend && (
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '0.85rem', fontFamily: 'var(--font-title)' }}>Referencias</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>🔴 existente · 🔵 a realizar</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem 1rem' }}>
              {ODONTOGRAM_CATALOG.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--color-text)' }}>
                  <svg width="26" height="30" viewBox="0 0 100 110" style={{ flexShrink: 0 }}>
                    {s.alcance === 'pieza'
                      ? (s.glifo === 'ausente'
                        ? (<><line x1="15" y1="15" x2="85" y2="85" stroke="var(--color-muted)" strokeWidth="6" /><line x1="85" y1="15" x2="15" y2="85" stroke="var(--color-muted)" strokeWidth="6" /></>)
                        : renderPieceGlyph(s, 'var(--color-text)'))
                      : (s.glifo === 'rellenoCara'
                        ? <rect x="30" y="18" width="40" height="32" rx="4" fill="var(--color-text)" opacity="0.7" />
                        : renderFaceGlyph('O', s, 'var(--color-text)'))}
                  </svg>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registrar pieza + filtros */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Registrar Pieza:</span>
            <select className="search-input" value={selectedNewPiece} onChange={(e) => setSelectedNewPiece(e.target.value)} style={{ width: '80px', fontSize: '0.82rem', height: '34px', padding: '0.25rem 0.5rem' }}>
              {baseList.map((t) => <option key={t} value={t}>Nº {t}</option>)}
            </select>
            <button type="button" className="btn btn-primary" onClick={handleAddManualPiece} style={{ fontSize: '0.78rem', height: '34px', padding: '0.25rem 0.75rem', gap: '0.25rem' }}>
              <Plus style={{ width: '0.85rem', height: '0.85rem' }} /> Añadir
            </button>
          </div>
          <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }} />
          <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
            <Search style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: '0.85rem', height: '0.85rem', color: 'var(--color-muted)' }} />
            <input type="text" className="search-input" style={{ paddingLeft: '2.1rem', fontSize: '0.8rem', height: '34px' }} placeholder="Buscar pieza..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="search-input" value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)} style={{ width: '150px', fontSize: '0.8rem', height: '34px', padding: '0.25rem 0.5rem' }}>
            <option value="afectados">Ver afectados</option>
            <option value="todos">Ver todos</option>
          </select>
        </div>

        {/* Grilla del odontograma */}
        <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', maxHeight: '440px', overflowY: 'auto', padding: '1.5rem', maxWidth: '100%', boxSizing: 'border-box' }}>
          {filteredTeeth.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
              Sin piezas para mostrar. Usá "Registrar Pieza" o cambiá el filtro a "Ver todos".
            </div>
          ) : filteredTeeth.map((piece) => renderTooth(piece))}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <AlertCircle style={{ width: '1rem', height: '1rem', color: 'var(--color-primary)', flexShrink: 0 }} />
          <span>Elegí la capa (existente/plan) y una prestación de la barra; después tocá la cara o "Toda la pieza".</span>
        </div>
      </div>

      {/* Panel derecho: Existente / Plan */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '720px', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
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
              return (
                <div key={res.id} style={{ padding: '0.85rem 1rem', background: 'var(--bg-card)', border: `1px ${col.key === 'planned' ? 'dashed' : 'solid'} var(--border-color)`, borderLeft: `4px solid ${col.color}`, borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.15rem 0.45rem', borderRadius: '5px', background: 'var(--bg-surface)', color: col.color, border: `1px solid ${col.color}`, letterSpacing: '0.03em' }}>{isCondition ? 'Diagnóstico' : 'Tratamiento'}</span>
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
  );
};
