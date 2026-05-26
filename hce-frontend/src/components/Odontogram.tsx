import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import keycloak from '../utils/keycloak-config';

interface OdontogramProps {
  patientId: string;
}

type ClinicalTool = 'caries' | 'restauracion' | 'conducto' | 'ausente' | 'limpiar';

interface ToothState {
  piece: string;
  face: string; // 'V' (Vestibular), 'L' (Lingual/Palatina), 'M' (Mesial), 'D' (Distal), 'O' (Oclusal/Central), 'all' (Toda la pieza)
  resourceType: 'Condition' | 'Procedure';
  code: string; // 'caries', 'restoration', 'endodontics', 'missing'
  color: string;
  label: string;
}

export const Odontogram: React.FC<OdontogramProps> = ({ patientId }) => {
  const [activeTool, setActiveTool] = useState<ClinicalTool>('caries');
  const [viewMode, setViewMode] = useState<'adult' | 'child' | 'mixed'>('mixed');
  const [clinicalResources, setClinicalResources] = useState<any[]>([]);
  const [toothMap, setToothMap] = useState<Record<string, ToothState>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Cargar recursos clínicos del odontograma
  const loadResources = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
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

  // Convertir los recursos FHIR (Condition, Procedure) en un mapa de estados de dientes
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
          color = '#e11d48'; // Rose-600 (Rojo clínico)
          label = 'Caries dental';
        } else if (condCode === '272673000') {
          code = 'missing';
          color = '#64748b'; // Slate-500 (Gris)
          label = 'Pieza ausente/extraída';
        } else {
          code = 'fracture';
          color = '#d97706'; // Amber-600 (Naranja)
          label = 'Fractura';
        }
      } else if (res.resourceType === 'Procedure') {
        const procCode = res.code?.coding?.[0]?.code;
        if (procCode === '23450005') {
          code = 'restoration';
          color = '#0284c7'; // Sky-600 (Azul/Cian clínico)
          label = 'Restauración dental';
        } else if (procCode === '42425007') {
          code = 'endodontics';
          color = '#d97706'; // Amber-600
          label = 'Tratamiento de conducto';
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

  // Manejar clic en una cara dental
  const handleFaceClick = async (piece: string, face: string) => {
    setMessage(null);

    // Si la pieza está ausente y la herramienta no es limpiar, ignorar clics de caras individuales
    if (toothMap[`${piece}_all`]?.code === 'missing' && activeTool !== 'limpiar') {
      return;
    }

    try {
      if (activeTool === 'limpiar') {
        // Eliminar registro clínico en esta cara/pieza
        const existingResource = clinicalResources.find((res) => {
          const rPiece = res.bodySite?.coding?.[0]?.code;
          const rFace = res.bodySite?.coding?.[1]?.code || 'all';
          return rPiece === piece && rFace === face;
        });

        if (existingResource && existingResource.id) {
          await axios.delete(
            `http://localhost:3000/fhir/r4/Patient/clinical-resource/${existingResource.id}`,
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

      // Mapeo semántico de herramientas a recursos FHIR R4
      let resourceType: 'Condition' | 'Procedure' = 'Condition';
      let payload: any = {};

      const faceLabel = face === 'all' ? 'Toda la pieza' : `Cara ${face}`;

      if (activeTool === 'caries') {
        resourceType = 'Condition';
        payload = {
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
          },
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '80967001', display: 'Caries dental' }],
            text: 'Caries dental activa',
          },
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
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '23450005', display: 'Restauración dental' }],
            text: 'Restauración con resina compuesta',
          },
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
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '42425007', display: 'Tratamiento de conducto (Endodoncia)' }],
            text: 'Obturación de conducto radicular',
          },
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
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
          },
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '272673000', display: 'Ausencia dental (Pieza extraída)' }],
            text: 'Ausencia de pieza dental',
          },
          bodySite: {
            coding: [
              { system: 'http://snomed.info/sct', code: piece, display: `Pieza dental ${piece}` },
              { system: 'http://snomed.info/sct', code: 'all', display: 'Toda la pieza' },
            ],
          },
        };
      }

      await axios.post(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
        { resourceType, payload },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setMessage({ type: 'success', text: `Estado dental guardado con éxito como recurso FHIR ${resourceType}.` });
      loadResources();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Error al persistir el recurso clínico.' });
    }
  };

  // Renderizar una pieza dental (SVG interactivo de 5 caras)
  const renderTooth = (piece: string) => {
    const isMissing = toothMap[`${piece}_all`]?.code === 'missing';
    const isEndo = toothMap[`${piece}_all`]?.code === 'endodontics';

    // Obtener los colores de relleno de cada cara
    const fillV = toothMap[`${piece}_V`]?.color || 'transparent';
    const fillD = toothMap[`${piece}_D`]?.color || 'transparent';
    const fillL = toothMap[`${piece}_L`]?.color || 'transparent';
    const fillM = toothMap[`${piece}_M`]?.color || 'transparent';
    const fillO = toothMap[`${piece}_O`]?.color || 'transparent';

    return (
      <div key={piece} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', position: 'relative' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>{piece}</span>
        
        <div style={{ position: 'relative', width: '40px', height: '40px' }}>
          {/* Gráfico de la pieza dental */}
          <svg width="40" height="40" viewBox="0 0 40 40" style={{ cursor: isMissing ? 'not-allowed' : 'pointer', overflow: 'visible' }}>
            {isMissing ? (
              // Diente Ausente: Cruz gris sobre el diente
              <g>
                <line x1="0" y1="0" x2="40" y2="40" stroke="#94a3b8" strokeWidth="3" />
                <line x1="40" y1="0" x2="0" y2="40" stroke="#94a3b8" strokeWidth="3" />
                <rect x="0" y="0" width="40" height="40" fill="rgba(148, 163, 184, 0.1)" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3" />
              </g>
            ) : (
              <g>
                {/* Cara Vestibular (Superior) */}
                <polygon
                  points="0,0 40,0 30,10 10,10"
                  fill={fillV}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'V')}
                  style={{ transition: 'fill 0.2s', ':hover': { fill: 'rgba(2, 132, 199, 0.2)' } } as any}
                />
                {/* Cara Distal (Derecha) */}
                <polygon
                  points="40,0 40,40 30,30 30,10"
                  fill={fillD}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'D')}
                  style={{ transition: 'fill 0.2s' }}
                />
                {/* Cara Lingual / Palatina (Inferior) */}
                <polygon
                  points="40,40 0,40 10,30 30,30"
                  fill={fillL}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'L')}
                  style={{ transition: 'fill 0.2s' }}
                />
                {/* Cara Mesial (Izquierda) */}
                <polygon
                  points="0,40 0,0 10,10 10,30"
                  fill={fillM}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'M')}
                  style={{ transition: 'fill 0.2s' }}
                />
                {/* Cara Oclusal / Central */}
                <polygon
                  points="10,10 30,10 30,30 10,30"
                  fill={fillO}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  onClick={() => handleFaceClick(piece, 'O')}
                  style={{ transition: 'fill 0.2s' }}
                />
              </g>
            )}
          </svg>

          {/* Indicador de Conducto Radicular */}
          {isEndo && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '4px',
              height: '35px',
              backgroundColor: '#d97706',
              borderRadius: '2px',
              boxShadow: '0 0 8px #d97706',
              pointerEvents: 'none'
            }} />
          )}
        </div>

        {/* Botones rápidos específicos por pieza para tratamientos completos */}
        <div style={{ display: 'flex', gap: '0.15rem', marginTop: '0.15rem' }}>
          <button
            onClick={() => handleFaceClick(piece, 'all')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '3px',
              fontSize: '0.6rem',
              color: 'var(--color-muted)',
              padding: '0.1rem 0.25rem',
              cursor: 'pointer'
            }}
            title="Seleccionar toda la pieza"
          >
            Pieza
          </button>
        </div>
      </div>
    );
  };

  // Piezas de dentición permanentes (Adulto)
  const adultUpper = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
  const adultLower = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

  // Piezas de dentición temporales (Infantil)
  const childUpper = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'];
  const childLower = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', width: '100%' }}>
      
      {/* Contenedor Izquierdo: Odontograma y Herramientas */}
      <div className="panel" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Barra de herramientas clínicas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            
            <button
              onClick={() => setActiveTool('caries')}
              className="btn"
              style={{
                background: activeTool === 'caries' ? 'rgba(225, 29, 72, 0.15)' : 'transparent',
                borderColor: activeTool === 'caries' ? '#e11d48' : 'var(--border-color)',
                color: activeTool === 'caries' ? '#e11d48' : 'var(--color-text)',
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#e11d48', display: 'inline-block' }}></span>
              Caries (Diagnóstico)
            </button>

            <button
              onClick={() => setActiveTool('restauracion')}
              className="btn"
              style={{
                background: activeTool === 'restauracion' ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                borderColor: activeTool === 'restauracion' ? '#0284c7' : 'var(--border-color)',
                color: activeTool === 'restauracion' ? '#0284c7' : 'var(--color-text)',
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }}></span>
              Restaurar (Tratamiento)
            </button>

            <button
              onClick={() => setActiveTool('conducto')}
              className="btn"
              style={{
                background: activeTool === 'conducto' ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                borderColor: activeTool === 'conducto' ? '#d97706' : 'var(--border-color)',
                color: activeTool === 'conducto' ? '#d97706' : 'var(--color-text)',
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block' }}></span>
              Conducto / Endodoncia
            </button>

            <button
              onClick={() => setActiveTool('ausente')}
              className="btn"
              style={{
                background: activeTool === 'ausente' ? 'rgba(100, 116, 139, 0.15)' : 'transparent',
                borderColor: activeTool === 'ausente' ? '#64748b' : 'var(--border-color)',
                color: activeTool === 'ausente' ? '#64748b' : 'var(--color-text)',
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem'
              }}
            >
              <Trash2 style={{ width: '0.9rem', height: '0.9rem', color: '#64748b' }} />
              Ausente / Extracción
            </button>

            <button
              onClick={() => setActiveTool('limpiar')}
              className="btn"
              style={{
                background: activeTool === 'limpiar' ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderColor: activeTool === 'limpiar' ? 'var(--color-muted)' : 'var(--border-color)',
                color: 'var(--color-muted)',
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem'
              }}
            >
              <RotateCcw style={{ width: '0.9rem', height: '0.9rem' }} />
              Limpiar
            </button>

          </div>

          {/* Selector de tipo de dentición */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('adult')}
              style={{
                background: viewMode === 'adult' ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: 'var(--color-text)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Adulto
            </button>
            <button
              onClick={() => setViewMode('child')}
              style={{
                background: viewMode === 'child' ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: 'var(--color-text)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Infantil
            </button>
            <button
              onClick={() => setViewMode('mixed')}
              style={{
                background: viewMode === 'mixed' ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: 'var(--color-text)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Mixto
            </button>
          </div>
        </div>

        {/* Mensaje de respuesta */}
        {message && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
            color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'
          }}>
            {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} /> : <ShieldAlert style={{ width: '1.1rem', height: '1.1rem' }} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* ODONTOGRAMA VISUAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', overflowX: 'auto', padding: '1rem 0' }}>
          
          {/* Dentición Adulto - Arcada Superior */}
          {(viewMode === 'adult' || viewMode === 'mixed') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', fontWeight: 600 }}>Arcada Superior (Adulto)</span>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                {adultUpper.map((piece) => renderTooth(piece))}
              </div>
            </div>
          )}

          {/* Dentición Infantil - Arcada Superior */}
          {(viewMode === 'child' || viewMode === 'mixed') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '3px solid rgba(6, 182, 212, 0.2)', paddingLeft: '1rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', fontWeight: 600 }}>Dentición Temporal Superior (Infantil)</span>
              <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center' }}>
                {childUpper.map((piece) => renderTooth(piece))}
              </div>
            </div>
          )}

          {/* Dentición Infantil - Arcada Inferior */}
          {(viewMode === 'child' || viewMode === 'mixed') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '3px solid rgba(6, 182, 212, 0.2)', paddingLeft: '1rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', fontWeight: 600 }}>Dentición Temporal Inferior (Infantil)</span>
              <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center' }}>
                {childLower.map((piece) => renderTooth(piece))}
              </div>
            </div>
          )}

          {/* Dentición Adulto - Arcada Inferior */}
          {(viewMode === 'adult' || viewMode === 'mixed') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', fontWeight: 600 }}>Arcada Inferior (Adulto)</span>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                {adultLower.map((piece) => renderTooth(piece))}
              </div>
            </div>
          )}

        </div>
        
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <AlertCircle style={{ width: '0.9rem', height: '0.9rem', color: 'var(--color-cyan)' }} />
          <span>Haz clic en la herramienta deseada del panel superior y luego haz clic sobre la cara de la pieza dental para aplicarla.</span>
        </div>

      </div>

      {/* Contenedor Derecho: Historial Clínico de Tratamientos */}
      <div className="panel" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Historial del Tratamiento (FHIR)
        </h4>

        {clinicalResources.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem', padding: '2rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            No hay diagnósticos ni tratamientos registrados en el odontograma.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {clinicalResources.map((res) => {
              const pieceCode = res.bodySite?.coding?.[0]?.code;
              const faceCode = res.bodySite?.coding?.[1]?.code || 'all';

              const isCondition = res.resourceType === 'Condition';
              
              let actionLabel = res.code?.text || 'Intervención';
              let badgeColor = isCondition ? 'rgba(225, 29, 72, 0.1)' : 'rgba(2, 132, 199, 0.1)';
              let textColor = isCondition ? '#e11d48' : '#0284c7';

              return (
                <div key={res.id} style={{
                  padding: '0.75rem',
                  background: 'rgba(0,0,0,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: badgeColor,
                      color: textColor
                    }}>
                      {isCondition ? 'Diagnóstico' : 'Tratamiento'}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      Pieza {pieceCode} ({faceCode === 'all' ? 'Completa' : `Cara ${faceCode}`})
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text)', margin: 0 }}>
                    {actionLabel}
                  </p>

                  <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', textAlign: 'right' }}>
                    FHIR ID: {res.id.slice(0, 8)}...
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
