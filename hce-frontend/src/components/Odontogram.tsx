import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Trash2, RotateCcw, AlertCircle, Sparkles, Search, Plus } from 'lucide-react';
import keycloak from '../utils/keycloak-config';

interface OdontogramProps {
  patientId: string;
}

type ClinicalTool = 'caries' | 'restauracion' | 'conducto' | 'ausente' | 'corona' | 'implante' | 'sellador' | 'limpiar';

interface ToothState {
  piece: string;
  face: string;
  resourceType: 'Condition' | 'Procedure';
  code: string; // 'caries', 'restoration', 'endodontics', 'missing', 'corona', 'implant', 'sealant'
  color: string;
  label: string;
}

export const Odontogram: React.FC<OdontogramProps> = ({ patientId }) => {
  const [activeTool, setActiveTool] = useState<ClinicalTool>('caries');
  const [viewMode, setViewMode] = useState<'adult' | 'child' | 'mixed'>('mixed');
  const [clinicalResources, setClinicalResources] = useState<any[]>([]);
  const [toothMap, setToothMap] = useState<Record<string, ToothState>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados de control para la Lista Dinámica (Ocultar Sanos por defecto)
  const [selectedNewPiece, setSelectedNewPiece] = useState('11');
  const [manuallyAddedPieces, setManuallyAddedPieces] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'caries' | 'restored' | 'missing' | 'endo' | 'corona' | 'implante' | 'sellador'>('all');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadResources = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`,
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      setClinicalResources(response.data);
      parseResources(response.data);
    } catch (err) {
      console.error('Error cargando recursos clínicos:', err);
    }
  };

  useEffect(() => {
    loadResources();
  }, [patientId]);

  const parseResources = (resources: any[]) => {
    const map: Record<string, ToothState> = {};

    resources.forEach((res) => {
      const codingPiece = res.bodySite?.coding?.[0];
      const codingFace = res.bodySite?.coding?.[1];

      if (!codingPiece) return;

      const piece = codingPiece.code;
      const face = codingFace ? codingFace.code : 'all';
      const key = `${piece}_${face}`;

      let code = '';
      let color = '';
      let label = '';

      if (res.resourceType === 'Condition') {
        const condCode = res.code?.coding?.[0]?.code;
        if (condCode === '80967001') {
          code = 'caries';
          color = 'var(--color-rose)';
          label = 'Caries dental';
        } else if (condCode === '272673000') {
          code = 'missing';
          color = 'var(--color-muted)';
          label = 'Pieza ausente/extraída';
        } else {
          code = 'fracture';
          color = 'var(--color-amber)';
          label = 'Fractura';
        }
      } else if (res.resourceType === 'Procedure') {
        const procCode = res.code?.coding?.[0]?.code;
        if (procCode === '23450005') {
          code = 'restoration';
          color = '#2962ff';
          label = 'Restauración dental';
        } else if (procCode === '42425007') {
          code = 'endodontics';
          color = 'var(--color-amber)';
          label = 'Tratamiento de conducto';
        } else if (procCode === '172922005') {
          code = 'corona';
          color = '#eab308'; // Dorado
          label = 'Corona protésica';
        } else if (procCode === '36653000') {
          code = 'implant';
          color = '#64748b'; // Acero/Plata
          label = 'Implante dental';
        } else if (procCode === '418705001') {
          code = 'sealant';
          color = 'var(--color-emerald)'; // Verde
          label = 'Sellador de fisuras';
        }
      }

      map[key] = {
        piece,
        face,
        resourceType: res.resourceType,
        code,
        color,
        label,
      };
    });

    setToothMap(map);
  };

  const handleFaceClick = async (piece: string, face: string) => {
    setMessage(null);

    if (toothMap[`${piece}_all`]?.code === 'missing' && activeTool !== 'limpiar') {
      return;
    }

    try {
      if (activeTool === 'limpiar') {
        const existingResource = clinicalResources.find((res) => {
          const rPiece = res.bodySite?.coding?.[0]?.code;
          const rFace = res.bodySite?.coding?.[1]?.code || 'all';
          return rPiece === piece && rFace === face;
        });

        if (existingResource && existingResource.id) {
          await axios.delete(
            `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/clinical-resource/${existingResource.id}`,
            {
              headers: {
                Authorization: `Bearer ${keycloak.token}`,
              },
            }
          );
          setMessage({ type: 'success', text: 'Estado dental limpiado correctamente.' });
          loadResources();
        }
        return;
      }

      let resourceType: 'Condition' | 'Procedure' = 'Condition';
      let payload: any = {};
      const faceLabel = face === 'all' ? 'Toda la pieza' : `Cara ${face}`;

      if (activeTool === 'caries') {
        resourceType = 'Condition';
        payload = {
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          code: { coding: [{ system: 'http://snomed.info/sct', code: '80967001', display: 'Caries dental' }], text: 'Caries dental activa' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: face, display: faceLabel },
            ],
          },
        };
      } else if (activeTool === 'restauracion') {
        resourceType = 'Procedure';
        payload = {
          status: 'completed',
          code: { coding: [{ system: 'http://snomed.info/sct', code: '23450005', display: 'Restauración dental' }], text: 'Restauración con resina compuesta' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: face, display: faceLabel },
            ],
          },
        };
      } else if (activeTool === 'conducto') {
        resourceType = 'Procedure';
        payload = {
          status: 'completed',
          code: { coding: [{ system: 'http://snomed.info/sct', code: '42425007', display: 'Tratamiento de conducto (Endodoncia)' }], text: 'Obturación de conducto radicular' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: 'all', display: 'Conducto radicular completo' },
            ],
          },
        };
      } else if (activeTool === 'ausente') {
        resourceType = 'Condition';
        payload = {
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          code: { coding: [{ system: 'http://snomed.info/sct', code: '272673000', display: 'Ausencia dental (Pieza extraída)' }], text: 'Ausencia de pieza dental' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: 'all', display: 'Toda la pieza' },
            ],
          },
        };
      } else if (activeTool === 'corona') {
        resourceType = 'Procedure';
        payload = {
          status: 'completed',
          code: { coding: [{ system: 'http://snomed.info/sct', code: '172922005', display: 'Corona protésica' }], text: 'Corona protésica' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: 'all', display: 'Toda la pieza' },
            ],
          },
        };
      } else if (activeTool === 'implante') {
        resourceType = 'Procedure';
        payload = {
          status: 'completed',
          code: { coding: [{ system: 'http://snomed.info/sct', code: '36653000', display: 'Implante dental' }], text: 'Implante dental' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: 'all', display: 'Toda la pieza' },
            ],
          },
        };
      } else if (activeTool === 'sellador') {
        resourceType = 'Procedure';
        payload = {
          status: 'completed',
          code: { coding: [{ system: 'http://snomed.info/sct', code: '418705001', display: 'Sellador de fisuras' }], text: 'Sellador de fosas/fisuras' },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: face, display: faceLabel },
            ],
          },
        };
      }

      await axios.post(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`,
        { resourceType, payload },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setMessage({ type: 'success', text: `Estado dental guardado con éxito.` });
      loadResources();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Error al persistir el recurso clínico.' });
    }
  };

  const handleAddManualPiece = () => {
    if (!manuallyAddedPieces.includes(selectedNewPiece)) {
      setManuallyAddedPieces([...manuallyAddedPieces, selectedNewPiece]);
    }
  };

  const renderTooth = (piece: string) => {
    const isMissing = toothMap[`${piece}_all`]?.code === 'missing';
    const isEndo = toothMap[`${piece}_all`]?.code === 'endodontics';
    const isCorona = toothMap[`${piece}_all`]?.code === 'corona';
    const isImplant = toothMap[`${piece}_all`]?.code === 'implant';

    const fillV = toothMap[`${piece}_V`]?.color || 'var(--bg-card)';
    const fillD = toothMap[`${piece}_D`]?.color || 'var(--bg-card)';
    const fillL = toothMap[`${piece}_L`]?.color || 'var(--bg-card)';
    const fillM = toothMap[`${piece}_M`]?.color || 'var(--bg-card)';
    const fillO = toothMap[`${piece}_O`]?.color || 'var(--bg-card)';

    // Determinar puntos de sellador
    const sealV = toothMap[`${piece}_V`]?.code === 'sealant';
    const sealD = toothMap[`${piece}_D`]?.code === 'sealant';
    const sealL = toothMap[`${piece}_L`]?.code === 'sealant';
    const sealM = toothMap[`${piece}_M`]?.code === 'sealant';
    const sealO = toothMap[`${piece}_O`]?.code === 'sealant';

    return (
      <div 
        key={piece} 
        style={{
          border: isCorona ? '2px solid #eab308' : '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '0.85rem',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.65rem',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition-smooth)',
          position: 'relative',
          minWidth: '120px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
            Nº {piece}
          </span>
          <span style={{ fontSize: '0.62rem', color: 'var(--color-muted)', fontWeight: 600 }}>
            {parseInt(piece) > 50 ? 'Infantil' : 'Adulto'}
          </span>
        </div>

        <div style={{ position: 'relative', width: '84px', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="84" height="96" viewBox="0 0 100 110" style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}>
            <defs>
              <linearGradient id="toothRootGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
            </defs>

            {/* RENDERIZADO DE CONDUCTO (ENDODONCIA) - Si está activo, se dibuja como un canal naranja en las raíces */}
            {isEndo && !isMissing && (
              <path d="M 50,45 L 35,95 M 50,45 L 65,95" stroke="var(--color-amber)" strokeWidth="4" strokeLinecap="round" opacity="0.9" style={{ filter: 'drop-shadow(0px 0px 4px var(--color-amber))' }} />
            )}

            {/* RENDERIZADO DE RAÍCES */}
            {!isImplant && (
              <path
                d="M 22,50 C 22,75 28,95 32,100 C 35,102 38,98 40,82 C 43,68 47,62 50,62 C 53,62 57,68 60,82 C 62,98 65,102 68,100 C 72,95 78,75 78,50 Z"
                fill="url(#toothRootGrad)"
                stroke={isCorona ? '#eab308' : '#94a3b8'}
                strokeWidth={isCorona ? '2' : '1.5'}
                strokeLinejoin="round"
                opacity={isMissing ? 0.3 : 1}
              />
            )}

            {/* RENDERIZADO DE IMPLANTE (TORNILLO METALICO) */}
            {isImplant && !isMissing && (
              <g transform="translate(0, 10)">
                <rect x="46" y="38" width="8" height="45" fill="url(#metalGrad)" rx="2" />
                <line x1="43" y1="46" x2="57" y2="46" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="43" y1="54" x2="57" y2="54" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="43" y1="62" x2="57" y2="62" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="43" y1="70" x2="57" y2="70" stroke="#cbd5e1" strokeWidth="2" />
                <polygon points="46,83 54,83 50,90" fill="#475569" />
              </g>
            )}

            {/* RENDERIZADO DE LA CORONA DEL DIENTE */}
            {!isMissing && (
              <path
                d="M 20,50 C 16,50 14,24 24,14 C 34,4 66,4 76,14 C 86,24 84,50 80,50 Z"
                fill="none"
                stroke={isCorona ? '#eab308' : '#475569'}
                strokeWidth={isCorona ? '3' : '2'}
                strokeLinejoin="round"
              />
            )}

            {/* CARAS INTERACTIVAS DEL DIENTE (Se dibujan dentro del contorno de la corona) */}
            {!isMissing && (
              <>
                {/* Cara Vestibular (V) / Superior */}
                <path
                  d="M 24,14 C 34,4 66,4 76,14 L 62,26 C 55,22 45,22 38,26 Z"
                  fill={fillV !== 'var(--bg-card)' ? fillV : '#ffffff'}
                  stroke="#475569"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'V')}
                />

                {/* Cara Distal (D) / Derecha */}
                <path
                  d="M 76,14 C 86,24 84,50 80,50 L 62,38 C 67,34 67,28 62,26 Z"
                  fill={fillD !== 'var(--bg-card)' ? fillD : '#ffffff'}
                  stroke="#475569"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'D')}
                />

                {/* Cara Lingual (L) / Inferior */}
                <path
                  d="M 20,50 C 24,54 76,54 80,50 L 62,38 C 55,42 45,42 38,38 Z"
                  fill={fillL !== 'var(--bg-card)' ? fillL : '#ffffff'}
                  stroke="#475569"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'L')}
                />

                {/* Cara Mesial (M) / Izquierda */}
                <path
                  d="M 20,50 C 14,50 16,24 24,14 L 38,26 C 33,28 33,34 38,38 Z"
                  fill={fillM !== 'var(--bg-card)' ? fillM : '#ffffff'}
                  stroke="#475569"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'M')}
                />

                {/* Cara Oclusal (O) / Centro */}
                <path
                  d="M 38,26 C 45,22 55,22 62,26 C 67,28 67,34 62,38 C 55,42 45,42 38,38 C 33,34 33,28 38,26 Z"
                  fill={fillO !== 'var(--bg-card)' ? fillO : '#ffffff'}
                  stroke="#475569"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'O')}
                />

                {/* RENDERIZADO DE SELLADORES (Puntos verdes sobre las caras correspondientes) */}
                {sealV && <circle cx="50" cy="13" r="3.5" fill="var(--color-emerald)" stroke="#065f46" strokeWidth="0.5" pointerEvents="none" />}
                {sealD && <circle cx="71" cy="32" r="3.5" fill="var(--color-emerald)" stroke="#065f46" strokeWidth="0.5" pointerEvents="none" />}
                {sealL && <circle cx="50" cy="47" r="3.5" fill="var(--color-emerald)" stroke="#065f46" strokeWidth="0.5" pointerEvents="none" />}
                {sealM && <circle cx="29" cy="32" r="3.5" fill="var(--color-emerald)" stroke="#065f46" strokeWidth="0.5" pointerEvents="none" />}
                {sealO && <circle cx="50" cy="32" r="4.5" fill="var(--color-emerald)" stroke="#065f46" strokeWidth="0.5" pointerEvents="none" />}
              </>
            )}

            {/* SI ESTÁ AUSENTE - Dibuja raíces fantasma y una gran X roja */}
            {isMissing && (
              <>
                <path
                  d="M 22,50 C 22,75 28,95 32,100 C 35,102 38,98 40,82 C 43,68 47,62 50,62 C 53,62 57,68 60,82 C 62,98 65,102 68,100 C 72,95 78,75 78,50 Z"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <line x1="15" y1="15" x2="85" y2="85" stroke="var(--color-rose)" strokeWidth="4.5" strokeLinecap="round" />
                <line x1="85" y1="15" x2="15" y2="85" stroke="var(--color-rose)" strokeWidth="4.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
          <button
            onClick={() => handleFaceClick(piece, 'all')}
            style={{
              flex: 1,
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              padding: '0.25rem 0',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#2962ff'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            Toda la Pieza
          </button>
        </div>
      </div>
    );
  };

  const adultUpper = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
  const adultLower = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
  const childUpper = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'];
  const childLower = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'];

  const allTeethList = [...adultUpper, ...childUpper, ...childLower, ...adultLower];

  // Filtrado de la Lista Dinámica (ocultar sanas, mostrar activas o añadidas manualmente)
  const filteredTeeth = allTeethList.filter(piece => {
    const hasCaries = ['V', 'D', 'L', 'M', 'O'].some(f => toothMap[`${piece}_${f}`]?.code === 'caries');
    const hasRestoration = ['V', 'D', 'L', 'M', 'O'].some(f => toothMap[`${piece}_${f}`]?.code === 'restoration');
    const hasSealant = ['V', 'D', 'L', 'M', 'O'].some(f => toothMap[`${piece}_${f}`]?.code === 'sealant');
    const isMissing = toothMap[`${piece}_all`]?.code === 'missing';
    const isEndo = toothMap[`${piece}_all`]?.code === 'endodontics';
    const isCorona = toothMap[`${piece}_all`]?.code === 'corona';
    const isImplant = toothMap[`${piece}_all`]?.code === 'implant';

    const hasAnyTreatment = hasCaries || hasRestoration || hasSealant || isMissing || isEndo || isCorona || isImplant;
    const isManuallyAdded = manuallyAddedPieces.includes(piece);

    if (!hasAnyTreatment && !isManuallyAdded) {
      return false;
    }

    if (searchTerm.trim() !== '' && !piece.includes(searchTerm.trim())) {
      return false;
    }

    if (statusFilter === 'caries') return hasCaries;
    if (statusFilter === 'restored') return hasRestoration;
    if (statusFilter === 'missing') return isMissing;
    if (statusFilter === 'endo') return isEndo;
    if (statusFilter === 'corona') return isCorona;
    if (statusFilter === 'implante') return isImplant;
    if (statusFilter === 'sellador') return hasSealant;

    return true;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr minmax(260px, 300px)', gap: '1.5rem', width: '100%', alignItems: 'start', overflow: 'hidden', minWidth: 0 }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflow: 'hidden' }}>
        
        {/* Barra de herramientas clínicas */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem', 
          background: '#f8fafc',
          padding: '1rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            
            <button
              onClick={() => setActiveTool('caries')}
              className="btn"
              style={{
                background: activeTool === 'caries' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
                borderColor: activeTool === 'caries' ? 'var(--color-rose)' : 'var(--border-color)',
                color: activeTool === 'caries' ? 'var(--color-rose)' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-rose)', display: 'inline-block' }}></span>
              Caries
            </button>

            <button
              onClick={() => setActiveTool('restauracion')}
              className="btn"
              style={{
                background: activeTool === 'restauracion' ? 'rgba(41, 98, 255, 0.06)' : 'var(--bg-surface)',
                borderColor: activeTool === 'restauracion' ? '#2962ff' : 'var(--border-color)',
                color: activeTool === 'restauracion' ? '#2962ff' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2962ff', display: 'inline-block' }}></span>
              Restaurar
            </button>

            <button
              onClick={() => setActiveTool('conducto')}
              className="btn"
              style={{
                background: activeTool === 'conducto' ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-surface)',
                borderColor: activeTool === 'conducto' ? 'var(--color-amber)' : 'var(--border-color)',
                color: activeTool === 'conducto' ? 'var(--color-amber)' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-amber)', display: 'inline-block' }}></span>
              Conducto
            </button>

            <button
              onClick={() => setActiveTool('corona')}
              className="btn"
              style={{
                background: activeTool === 'corona' ? 'rgba(234, 179, 8, 0.08)' : 'var(--bg-surface)',
                borderColor: activeTool === 'corona' ? '#eab308' : 'var(--border-color)',
                color: activeTool === 'corona' ? '#eab308' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308', display: 'inline-block' }}></span>
              Corona
            </button>

            <button
              onClick={() => setActiveTool('implante')}
              className="btn"
              style={{
                background: activeTool === 'implante' ? 'rgba(100, 116, 139, 0.08)' : 'var(--bg-surface)',
                borderColor: activeTool === 'implante' ? '#64748b' : 'var(--border-color)',
                color: activeTool === 'implante' ? '#64748b' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }}></span>
              Implante
            </button>

            <button
              onClick={() => setActiveTool('sellador')}
              className="btn"
              style={{
                background: activeTool === 'sellador' ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-surface)',
                borderColor: activeTool === 'sellador' ? 'var(--color-emerald)' : 'var(--border-color)',
                color: activeTool === 'sellador' ? 'var(--color-emerald)' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-emerald)', display: 'inline-block' }}></span>
              Sellador
            </button>

            <button
              onClick={() => setActiveTool('ausente')}
              className="btn"
              style={{
                background: activeTool === 'ausente' ? 'rgba(100, 116, 139, 0.08)' : 'var(--bg-surface)',
                borderColor: activeTool === 'ausente' ? 'var(--color-muted)' : 'var(--border-color)',
                color: activeTool === 'ausente' ? 'var(--color-muted)' : 'var(--color-text)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <Trash2 style={{ width: '0.9rem', height: '0.9rem', color: 'var(--color-muted)' }} />
              Ausente
            </button>

            <button
              onClick={() => setActiveTool('limpiar')}
              className="btn"
              style={{
                background: activeTool === 'limpiar' ? 'rgba(0,0,0,0.03)' : 'var(--bg-surface)',
                borderColor: activeTool === 'limpiar' ? 'var(--color-text)' : 'var(--border-color)',
                color: 'var(--color-muted)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px'
              }}
            >
              <RotateCcw style={{ width: '0.9rem', height: '0.9rem' }} />
              Limpiar
            </button>

          </div>

          <div className="segmented-control">
            <button
              onClick={() => setViewMode('adult')}
              className={`segmented-button ${viewMode === 'adult' ? 'active' : ''}`}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            >
              Adulto
            </button>
            <button
              onClick={() => setViewMode('child')}
              className={`segmented-button ${viewMode === 'child' ? 'active' : ''}`}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            >
              Infantil
            </button>
            <button
              onClick={() => setViewMode('mixed')}
              className={`segmented-button ${viewMode === 'mixed' ? 'active' : ''}`}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            >
              Mixto
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
            color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)',
            animation: 'fadeIn 0.2s ease'
          }}>
            {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} /> : <ShieldAlert style={{ width: '1.1rem', height: '1.1rem' }} />}
            <span style={{ fontWeight: 500 }}>{message.text}</span>
          </div>
        )}

        {/* Buscadores, Filtros y Constructor de Piezas en Pantalla */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          
          {/* Agregar Diente Sano */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Registrar Pieza:</span>
            <select
              className="search-input"
              value={selectedNewPiece}
              onChange={(e) => setSelectedNewPiece(e.target.value)}
              style={{ width: '80px', fontSize: '0.82rem', height: '34px', padding: '0.25rem 0.5rem' }}
            >
              {allTeethList.map(t => (
                <option key={t} value={t}>Nº {t}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddManualPiece}
              style={{ fontSize: '0.78rem', height: '34px', padding: '0.25rem 0.75rem', gap: '0.25rem' }}
            >
              <Plus style={{ width: '0.85rem', height: '0.85rem' }} />
              Añadir
            </button>
          </div>

          <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }} />

          {/* Filtros rápidos */}
          <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
            <Search style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: '0.85rem', height: '0.85rem', color: 'var(--color-muted)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '2.1rem', fontSize: '0.8rem', height: '34px' }}
              placeholder="Buscar pieza..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="search-input"
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            style={{ width: '150px', fontSize: '0.8rem', height: '34px', padding: '0.25rem 0.5rem' }}
          >
            <option value="all">Ver Afectados</option>
            <option value="caries">Caries</option>
            <option value="restored">Restaurados</option>
            <option value="missing">Ausentes</option>
            <option value="endo">Endodoncias</option>
            <option value="corona">Corona</option>
            <option value="implante">Implante</option>
            <option value="sellador">Sellador</option>
          </select>
        </div>

        {/* ODONTOGRAMA COMPACTO DE GRILLA (OPCIÓN B V2) */}
        <div className="panel" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
          gap: '1rem', 
          maxHeight: '440px',
          overflowY: 'auto', 
          padding: '1.5rem', 
          maxWidth: '100%', 
          boxSizing: 'border-box' 
        }}>
          {filteredTeeth.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
              Sin piezas dentales diagnosticadas ni cargadas. Utiliza "Registrar Pieza" arriba para añadir una pieza sana y comenzar el examen clínico.
            </div>
          ) : (
            filteredTeeth.map((piece) => renderTooth(piece))
          )}
        </div>
        
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <AlertCircle style={{ width: '1rem', height: '1rem', color: '#2962ff', flexShrink: 0 }} />
          <span>Procedimiento: Para tratar una pieza, selecciónala en la barra de "Registrar Pieza" superior. Píntala con las herramientas de caries, conducto, implante, corona o sellador.</span>
        </div>

      </div>

      {/* Contenedor Derecho: Historial Clínico de Tratamientos */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        maxHeight: '620px', 
        overflowY: 'auto',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <h4 style={{ 
          fontSize: '1rem', 
          fontWeight: 700, 
          color: 'var(--color-text)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '0.75rem',
          margin: 0,
          fontFamily: 'var(--font-title)'
        }}>
          <Sparkles style={{ width: '1.1rem', height: '1.1rem', color: '#2962ff' }} />
          Historial del Odontograma
        </h4>

        {clinicalResources.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--color-muted)', 
            fontSize: '0.82rem', 
            padding: '2.5rem 1rem', 
            border: '1px dashed var(--border-color)', 
            borderRadius: '12px',
            background: 'var(--bg-card)',
            marginTop: '0.5rem'
          }}>
            Sin diagnósticos ni tratamientos cargados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {clinicalResources.map((res) => {
              const pieceCode = res.bodySite?.coding?.[0]?.code;
              const faceCode = res.bodySite?.coding?.[1]?.code || 'all';
              const isCondition = res.resourceType === 'Condition';
              
              let actionLabel = res.code?.text || 'Intervención';
              let badgeColor = isCondition ? 'rgba(239, 68, 68, 0.06)' : 'rgba(41, 98, 255, 0.06)';
              let borderAccent = isCondition ? 'var(--color-rose)' : '#2962ff';
              let textColor = isCondition ? 'var(--color-rose)' : '#2962ff';

              return (
                <div key={res.id} style={{
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderLeft: `4px solid ${borderAccent}`,
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '5px',
                      background: badgeColor,
                      color: textColor,
                      letterSpacing: '0.03em'
                    }}>
                      {isCondition ? 'Diagnóstico' : 'Tratamiento'}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
                      Pieza {pieceCode} ({faceCode === 'all' ? 'Completa' : `Cara ${faceCode}`})
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                    {actionLabel}
                  </p>

                  <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)', textAlign: 'right', display: 'block', marginTop: '0.1rem' }}>
                    ID: {res.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
