import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, FileText, Plus, MessageSquare, Wrench, Download, Upload, Clock, User, Eye, CheckCircle } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { StlViewer3D } from '../protesis/StlViewer3D';

interface ProtesisTabProps {
  patientId: string;
}

interface Order {
  id: string;
  tenantId: string;
  status: string;
  dentalWork: {
    workType: string;
    material: string;
    color: string;
    teeth: number[];
    notes?: string;
  };
  requestedDelivery: string | null;
  createdAt: string;
  performerTenantId: string;
  patientId: string;
  isManual?: boolean;
  patientName?: string | null;
  doctorName?: string | null;
  doctorMatricula?: string | null;
  trazabilidad?: {
    technicianName?: string;
    materialLot?: string;
    materialBrand?: string;
    aditamentos?: {
      type: string;
      brand: string;
      lot: string;
    }[];
  } | null;
  conformidad?: {
    signedAt: string;
    signedBy: string;
    declaracionDoc: string;
    hash: string;
    isSigned: boolean;
  } | null;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  textContent: string;
  attachmentMeta?: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  } | null;
  createdAt: string;
}

// Laboratorios mockeados para la maquetación
const MOCK_LABORATORIOS = [
  { id: 'lab_valle', name: 'Laboratorio Dental Valle' },
  { id: 'lab_art', name: 'Dental Art Lab' },
  { id: 'lab_crowns', name: 'Pro-Crowns Laboratories' }
];

const MOCK_CLINICAS: Record<string, string> = {
  'clinica_santa_lucia': 'Clínica Odontológica Santa Lucía',
  'clinica_central': 'Centro Dental Central',
  'clinica_jujuy': 'Círculo Odontológico de Jujuy',
  'mi_consultorio_dent_hce': 'Centro Odontológico DentHCE'
};

export const ProtesisTab: React.FC<ProtesisTabProps> = ({ patientId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [viewingStl, setViewingStl] = useState<{ url?: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de Trazabilidad y Conformidad (Fase 2)
  const [caseSubTab, setCaseSubTab] = useState<'chat' | 'trazabilidad'>('chat');
  const [showCertModal, setShowCertModal] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;

    let fileUrl = '';
    if (file.name.toLowerCase().endsWith('.stl')) {
      fileUrl = URL.createObjectURL(file);
    }

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/protesis/${selectedOrder.id}/chat`,
        {
          textContent: `Adjunto archivo: ${file.name}`,
          attachmentMeta: {
            fileName: file.name,
            fileUrl: fileUrl,
            fileType: file.name.toLowerCase().endsWith('.stl') ? 'stl' : 'other',
            fileSize: file.size
          }
        },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setChatMessages((prev) => [...prev, response.data]);
    } catch (err) {
      console.error('Error al subir archivo en chat:', err);
      alert('Error al adjuntar archivo en el chat');
    }
  };

  // Mapeo dinámico de materiales permitidos por trabajo
  const MATERIALES_POR_TRABAJO: Record<string, { value: string; label: string }[]> = {
    corona: [
      { value: 'zirconio', label: 'Zirconio Translúcido' },
      { value: 'disilicato', label: 'Disilicato de Litio' },
      { value: 'composite', label: 'Composite / Resina' }
    ],
    puente: [
      { value: 'zirconio', label: 'Zirconio Translúcido' },
      { value: 'disilicato', label: 'Disilicato de Litio' },
      { value: 'cromo-cobalto', label: 'Cromo-Cobalto + Porcelana' }
    ],
    removible: [
      { value: 'acrilico', label: 'Acrílico Premium' },
      { value: 'composite', label: 'Composite / Resina' }
    ],
    cromo: [
      { value: 'cromo-cobalto', label: 'Cromo-Cobalto' }
    ],
    implante: [
      { value: 'zirconio', label: 'Zirconio Translúcido' },
      { value: 'disilicato', label: 'Disilicato de Litio' },
      { value: 'composite', label: 'Composite / Resina' }
    ],
    placa: [
      { value: 'acrilico', label: 'Acrílico Termopolimerizable (Duro)' },
      { value: 'flexible', label: 'Placa Flexible' }
    ]
  };

  // Formulario de Nueva Orden
  const [selectedLab, setSelectedLab] = useState(MOCK_LABORATORIOS[0].id);
  const [workType, setWorkType] = useState('corona');
  const [material, setMaterial] = useState('zirconio');
  const [color, setColor] = useState('A2');
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Toggles de información adicional
  const [sendAntagonist, setSendAntagonist] = useState(false);
  const [sendBiteRegistration, setSendBiteRegistration] = useState(false);

  // Archivo adjunto directo en formulario
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Helper para calcular la fecha de entrega mínima (3 días hábiles en adelante)
  const getMinDeliveryDate = () => {
    const today = new Date();
    let businessDaysAdded = 0;
    const minDate = new Date(today);
    while (businessDaysAdded < 3) {
      minDate.setDate(minDate.getDate() + 1);
      const dayOfWeek = minDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Excluir sábado y domingo
        businessDaysAdded++;
      }
    }
    return minDate.toISOString().split('T')[0];
  };

  // Efecto para acoplar el material cuando cambia el tipo de trabajo
  useEffect(() => {
    const materialesDisponibles = MATERIALES_POR_TRABAJO[workType] || [];
    if (materialesDisponibles.length > 0) {
      // Si el material actual no es válido para este trabajo, seleccionar el primero
      if (!materialesDisponibles.some((m) => m.value === material)) {
        setMaterial(materialesDisponibles[0].value);
      }
    }
  }, [workType]);

  // Fetch de órdenes de prótesis
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/protesis`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      // Filtrar las órdenes para que solo se muestren las del paciente activo
      const patientOrders = response.data.filter((o: any) => o.patientId === patientId);
      setOrders(patientOrders);
    } catch (err) {
      console.error('Error fetching protesis orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch de chat para la orden seleccionada
  const fetchChat = async (orderId: string) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/protesis/${orderId}`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setSelectedOrder(response.data);
      setChatMessages(response.data.messages || []);
      setCaseSubTab('chat');
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Manejar creación de orden
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTeeth.length === 0) {
      alert('Error: Debe seleccionar al menos una pieza dental en el mini-odontograma.');
      return;
    }

    if (!deliveryDate) {
      alert('Error: Debe seleccionar una fecha requerida de entrega.');
      return;
    }

    // Validar fecha mínima (3 días hábiles en el futuro)
    const minDateStr = getMinDeliveryDate();
    if (deliveryDate < minDateStr) {
      alert('Error: La fecha de entrega debe ser de al menos 3 días hábiles en el futuro.');
      return;
    }

    // Formatear notas con información estructurada
    let finalNotes = notes;
    if (sendAntagonist || sendBiteRegistration) {
      finalNotes = `${notes}\n\n[DATOS LOGÍSTICOS ADICIONALES]:\n- Envía Antagonista: ${sendAntagonist ? 'SÍ' : 'NO'}\n- Registro de Mordida/Oclusión: ${sendBiteRegistration ? 'SÍ' : 'NO'}`;
    }

    const payload = {
      performerTenantId: selectedLab,
      patientId,
      dentalWork: {
        workType,
        material,
        color,
        teeth: selectedTeeth,
        notes: finalNotes,
      },
      requestedDelivery: deliveryDate ? new Date(deliveryDate) : undefined,
    };

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/protesis`, payload, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });

      const newOrder = response.data;
      setOrders((prev) => [newOrder, ...prev]);

      // Si hay un archivo adjunto cargado directamente en el formulario
      if (attachedFile) {
        let fileUrl = '';
        if (attachedFile.name.toLowerCase().endsWith('.stl')) {
          fileUrl = URL.createObjectURL(attachedFile);
        }

        try {
          await axios.post(
            `${import.meta.env.VITE_API_URL}/protesis/${newOrder.id}/chat`,
            {
              textContent: `Archivo adjunto enviado al crear la orden: ${attachedFile.name}`,
              attachmentMeta: {
                fileName: attachedFile.name,
                fileUrl: fileUrl,
                fileType: attachedFile.name.toLowerCase().endsWith('.stl') ? 'stl' : 'other',
                fileSize: attachedFile.size,
              },
            },
            { headers: { Authorization: `Bearer ${keycloak.token}` } }
          );
        } catch (fileErr) {
          console.error('Error al subir el archivo adjunto inicial en el chat:', fileErr);
          alert('La orden fue creada, pero ocurrió un error al subir el archivo adjunto inicial.');
        }
      }

      setShowNewOrderModal(false);
      // Limpiar formulario
      setSelectedTeeth([]);
      setNotes('');
      setDeliveryDate('');
      setSendAntagonist(false);
      setSendBiteRegistration(false);
      setAttachedFile(null);
    } catch (err) {
      console.error('Error creating order:', err);
      alert('Error al crear la orden de prótesis');
    }
  };

  // Manejar envío de mensaje de chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedOrder) return;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/protesis/${selectedOrder.id}/chat`,
        { textContent: newMessage.trim() },
        { headers: { Authorization: `Bearer ${keycloak.token}` } },
      );
      setChatMessages((prev) => [...prev, response.data]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Helper para mostrar color de estado de orden
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'received':
        return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', label: 'Recibido' };
      case 'designing':
        return { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Diseñando CAD' };
      case 'processing':
        return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Procesando' };
      case 'ceramic':
        return { bg: 'rgba(236, 72, 153, 0.1)', text: '#ec4899', label: 'Cerámica' };
      case 'ready':
        return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Listo para Enviar' };
      case 'delivered':
        return { bg: 'rgba(75, 85, 99, 0.1)', text: '#4b5563', label: 'Entregado' };
      case 'cancelled':
        return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', label: 'Cancelado' };
      default:
        return { bg: '#e5e7eb', text: '#374151', label: status };
    }
  };

  return (
    <div className="protesis-tab-container" style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
      
      {/* Columna de Órdenes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)' }}>
            🛠️ Pedidos de Prótesis Dental
          </h4>
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
          >
            <Plus style={{ width: '0.9rem', height: '0.9rem' }} />
            Nueva Orden
          </button>
        </div>

        {loading && orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
            Cargando historial de trabajos...
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: '16px', color: 'var(--color-muted)' }}>
            No hay órdenes de prótesis emitidas para este paciente.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '480px', overflowY: 'auto', paddingRight: '0.2rem' }}>
            {orders.map((order) => {
              const statusStyle = getStatusBadgeStyle(order.status);
              const isSelected = selectedOrder?.id === order.id;
              const labName = MOCK_LABORATORIOS.find(l => l.id === order.performerTenantId)?.name || 'Laboratorio Dental';

              return (
                <div
                  key={order.id}
                  onClick={() => fetchChat(order.id)}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '16px',
                    border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--border-color)'}`,
                    background: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 20px rgba(41, 98, 255, 0.08)' : 'var(--shadow-premium)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {order.dentalWork.workType}
                      </span>
                      <h5 style={{ margin: '0.1rem 0 0 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Pieza(s): {order.dentalWork.teeth.length > 0 ? order.dentalWork.teeth.join(', ') : 'Ninguna'}
                      </h5>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.text
                    }}>
                      {statusStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    <div>Material: <strong style={{ color: 'var(--color-text)' }}>{order.dentalWork.material}</strong> | Color: <strong style={{ color: 'var(--color-text)' }}>{order.dentalWork.color}</strong></div>
                    <div>Lab: <strong>{labName}</strong></div>
                    {order.requestedDelivery && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem', color: 'var(--color-rose)', fontWeight: 600 }}>
                        <Clock style={{ width: '0.75rem', height: '0.75rem' }} />
                        Entrega: {new Date(order.requestedDelivery).toLocaleDateString('es-AR')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Columna de Chat del Caso */}
      {selectedOrder && (
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          height: '520px',
          overflow: 'hidden',
        }}>
          {/* Header del Caso */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                🛠️ {selectedOrder.dentalWork.workType.toUpperCase()} (Pzs: {selectedOrder.dentalWork.teeth.join(', ')})
              </h5>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                Orden ID: #{selectedOrder.id.slice(0, 8)}
              </span>
            </div>
            <span style={{
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: getStatusBadgeStyle(selectedOrder.status).bg,
              color: getStatusBadgeStyle(selectedOrder.status).text
            }}>
              {getStatusBadgeStyle(selectedOrder.status).label}
            </span>
          </div>

          {/* Selector de sub-pestaña */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#ffffff' }}>
            <button
              onClick={() => setCaseSubTab('chat')}
              style={{
                flex: 1,
                padding: '0.65rem',
                background: 'none',
                border: 'none',
                borderBottom: caseSubTab === 'chat' ? '3px solid var(--color-accent)' : '3px solid transparent',
                color: caseSubTab === 'chat' ? 'var(--color-accent)' : 'var(--color-muted)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.82rem'
              }}
            >
              💬 Chat y Archivos
            </button>
            <button
              onClick={() => setCaseSubTab('trazabilidad')}
              style={{
                flex: 1,
                padding: '0.65rem',
                background: 'none',
                border: 'none',
                borderBottom: caseSubTab === 'trazabilidad' ? '3px solid var(--color-accent)' : '3px solid transparent',
                color: caseSubTab === 'trazabilidad' ? 'var(--color-accent)' : 'var(--color-muted)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.82rem'
              }}
            >
              🛡️ Trazabilidad y Conformidad
            </button>
          </div>

          {/* RENDER CONDICIONAL SUB-PESTAÑAS */}
          
          {/* Sub-pestaña 1: Chat */}
          {caseSubTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Mensajes del Chat */}
              <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--color-muted)', fontSize: '0.8rem', maxWidth: '220px' }}>
                    No hay mensajes. Escribe un mensaje para coordinar con el protesista.
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.senderId === keycloak.subject;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)', marginBottom: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <User style={{ width: '0.6rem', height: '0.6rem' }} />
                          {msg.senderName}
                        </span>
                        <div style={{
                          padding: '0.75rem 0.95rem',
                          borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isMe ? 'linear-gradient(135deg, #2962ff, #1565c0)' : '#ffffff',
                          color: isMe ? '#ffffff' : 'var(--color-text)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          fontSize: '0.85rem',
                          lineHeight: '1.4',
                          border: isMe ? 'none' : '1px solid var(--border-color)',
                        }}>
                          {msg.textContent}

                          {msg.attachmentMeta && (
                            <div style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '10px',
                              background: isMe ? 'rgba(255, 255, 255, 0.15)' : '#f8fafc',
                              border: `1px solid ${isMe ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              minWidth: '200px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                                <FileText style={{ width: '0.9rem', height: '0.9rem', flexShrink: 0, color: isMe ? '#ffffff' : 'var(--color-accent)' }} />
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: isMe ? '#ffffff' : 'var(--color-text)',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {msg.attachmentMeta.fileName}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                {msg.attachmentMeta.fileType === 'stl' && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingStl({ url: msg.attachmentMeta?.fileUrl, name: msg.attachmentMeta?.fileName || 'Modelo3D.stl' })}
                                    title="Visualizar en 3D interactivo"
                                    style={{
                                      background: isMe ? '#ffffff' : 'var(--color-accent)',
                                      color: isMe ? 'var(--color-accent)' : '#ffffff',
                                      border: 'none',
                                      padding: '0.2rem 0.45rem',
                                      borderRadius: '6px',
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.15rem'
                                    }}
                                  >
                                    <Eye style={{ width: '0.7rem', height: '0.7rem' }} />
                                    Ver 3D
                                  </button>
                                )}
                                <a
                                  href={msg.attachmentMeta.fileUrl || '#'}
                                  download={msg.attachmentMeta.fileName}
                                  onClick={(e) => {
                                    if (!msg.attachmentMeta?.fileUrl) {
                                      e.preventDefault();
                                      alert('Simulación: Descargando archivo ' + msg.attachmentMeta?.fileName);
                                    }
                                  }}
                                  style={{
                                    background: 'rgba(0,0,0,0.05)',
                                    color: isMe ? '#ffffff' : 'var(--color-text)',
                                    padding: '0.2rem',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Download style={{ width: '0.7rem', height: '0.7rem' }} />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dropzone de archivos en el chat */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f8fafc',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                <Upload style={{ width: '0.85rem', height: '0.85rem', color: 'var(--color-accent)' }} />
                <span>Subir archivo escaneo dental STL o exocad</span>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".stl"
                  style={{ display: 'none' }}
                />
              </div>

              {/* Formulario de Entrada */}
              <form onSubmit={handleSendMessage} style={{
                padding: '0.85rem 1rem',
                background: '#ffffff',
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Escribe un mensaje clínico sobre el caso..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.95rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#ffffff',
                    border: 'none',
                    width: '2.4rem',
                    height: '2.4rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(41, 98, 255, 0.2)',
                  }}
                >
                  <Send style={{ width: '0.9rem', height: '0.9rem' }} />
                </button>
              </form>
            </div>
          )}

          {/* Sub-pestaña 2: Trazabilidad vista del odontólogo */}
          {caseSubTab === 'trazabilidad' && (
            <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#f8fafc' }}>
              
              {/* Trazabilidad Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#ffffff', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FileText style={{ width: '1rem', height: '1rem', color: 'var(--color-accent)' }} />
                  Trazabilidad Sanitaria de Materiales
                </h5>

                {selectedOrder.trazabilidad ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--color-muted)' }}>Técnico Asignado:</span>
                      <strong>{selectedOrder.trazabilidad.technicianName || 'No especificado'}</strong>
                      <span style={{ color: 'var(--color-muted)' }}>Marca Material:</span>
                      <strong>{selectedOrder.trazabilidad.materialBrand || 'No especificada'}</strong>
                      <span style={{ color: 'var(--color-muted)' }}>Lote Material:</span>
                      <strong><code>{selectedOrder.trazabilidad.materialLot || 'No registrado'}</code></strong>
                    </div>

                    {/* Tabla de Aditamentos */}
                    {selectedOrder.trazabilidad.aditamentos && selectedOrder.trazabilidad.aditamentos.length > 0 && (
                      <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Aditamentos e Implantes Incorporados:</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--color-muted)' }}>
                              <th style={{ padding: '0.25rem' }}>Tipo</th>
                              <th style={{ padding: '0.25rem' }}>Marca</th>
                              <th style={{ padding: '0.25rem' }}>Lote</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.trazabilidad.aditamentos.map((ad, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.25rem', fontWeight: 600 }}>{ad.type}</td>
                                <td style={{ padding: '0.25rem' }}>{ad.brand}</td>
                                <td style={{ padding: '0.25rem' }}><code>{ad.lot}</code></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    El laboratorio aún no ha registrado datos de trazabilidad para esta prótesis.
                  </div>
                )}
              </div>

              {/* Declaración de Conformidad Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#ffffff', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle style={{ width: '1rem', height: '1rem', color: 'var(--color-emerald)' }} />
                  Declaración de Conformidad Sanitaria
                </h5>

                {selectedOrder.conformidad?.isSigned ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.05)', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <CheckCircle style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-emerald)', flexShrink: 0 }} />
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontWeight: 600 }}>Declaración firmada e integrada digitalmente</div>
                    </div>
                    
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text)', display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.3rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '10px' }}>
                      <span style={{ color: 'var(--color-muted)' }}>Firmante:</span>
                      <strong>{selectedOrder.conformidad.signedBy}</strong>
                      <span style={{ color: 'var(--color-muted)' }}>Fecha:</span>
                      <strong>{new Date(selectedOrder.conformidad.signedAt).toLocaleString('es-AR')}</strong>
                      <span style={{ color: 'var(--color-muted)' }}>Hash SHA-256:</span>
                      <code style={{ fontSize: '0.62rem', wordBreak: 'break-all', color: 'var(--color-muted)' }}>{selectedOrder.conformidad.hash}</code>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCertModal(true)}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', justifyContent: 'center', padding: '0.5rem', fontSize: '0.8rem' }}
                    >
                      <FileText style={{ width: '0.9rem', height: '0.9rem' }} />
                      Ver Certificado de Conformidad
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    Declaración de conformidad sanitaria pendiente de firma por el laboratorio.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Nueva Orden */}
      {showNewOrderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText style={{ width: '1.2rem', height: '1.2rem', color: 'var(--color-accent)' }} />
                Prescribir Prótesis Dental
              </h4>
              <button
                onClick={() => setShowNewOrderModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Laboratorio Asignado
                </label>
                <select
                  value={selectedLab}
                  onChange={(e) => setSelectedLab(e.target.value)}
                  style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px', outline: 'none' }}
                >
                  {MOCK_LABORATORIOS.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Tipo de Trabajo
                  </label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  >
                    <option value="corona">Corona</option>
                    <option value="puente">Puente Fijo</option>
                    <option value="removible">Removible Acrílico</option>
                    <option value="cromo">Cromo Cobalto</option>
                    <option value="implante">Prótesis s/Implante</option>
                    <option value="placa">Placa Miorelajación</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Material
                  </label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  >
                    {(MATERIALES_POR_TRABAJO[workType] || []).map((mat) => (
                      <option key={mat.value} value={mat.value}>{mat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', justifyContent: 'center' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Color (Guía VITA)
                  </label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  >
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="A3">A3</option>
                    <option value="A3.5">A3.5</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="D2">D2</option>
                  </select>
                </div>
              </div>

              {/* Selector Interactivo de Piezas Dentales (Mini-Odontograma FDI) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Piezas Dentales (Nomenclatura FDI)
                </label>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.6rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  {/* Arcada Superior */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ fontSize: '0.58rem', color: 'var(--color-muted)', textAlign: 'center', fontWeight: 600 }}>Superior</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '2px' }}>
                      {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map((tooth) => {
                        const isSelected = selectedTeeth.includes(tooth);
                        return (
                          <button
                            key={tooth}
                            type="button"
                            onClick={() => setSelectedTeeth((prev) => prev.includes(tooth) ? prev.filter((t) => t !== tooth) : [...prev, tooth].sort((a, b) => a - b))}
                            style={{
                              padding: '0.25rem 0',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textAlign: 'center',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--color-accent)' : '#cbd5e1',
                              background: isSelected ? 'var(--color-accent)' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#334155',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {tooth}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Arcada Inferior */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '2px' }}>
                      {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map((tooth) => {
                        const isSelected = selectedTeeth.includes(tooth);
                        return (
                          <button
                            key={tooth}
                            type="button"
                            onClick={() => setSelectedTeeth((prev) => prev.includes(tooth) ? prev.filter((t) => t !== tooth) : [...prev, tooth].sort((a, b) => a - b))}
                            style={{
                              padding: '0.25rem 0',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textAlign: 'center',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--color-accent)' : '#cbd5e1',
                              background: isSelected ? 'var(--color-accent)' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#334155',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {tooth}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--color-muted)', textAlign: 'center', fontWeight: 600 }}>Inferior</div>
                  </div>
                </div>
              </div>

              {/* Fecha y Logística */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    min={getMinDeliveryDate()}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', justifyContent: 'center' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
                    Logística del Caso
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--color-text)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sendAntagonist}
                        onChange={(e) => setSendAntagonist(e.target.checked)}
                        style={{ width: '0.85rem', height: '0.85rem', accentColor: 'var(--color-accent)' }}
                      />
                      Envía Antagonista
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--color-text)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sendBiteRegistration}
                        onChange={(e) => setSendBiteRegistration(e.target.checked)}
                        style={{ width: '0.85rem', height: '0.85rem', accentColor: 'var(--color-accent)' }}
                      />
                      Envía Reg. Mordida
                    </label>
                  </div>
                </div>
              </div>

              {/* Dropzone de Archivos Integrado */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Escaneo Dental STL / Archivos Clínicos
                </label>
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) setAttachedFile(file);
                  }}
                  onClick={() => modalFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.8rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: attachedFile ? 'rgba(16, 185, 129, 0.04)' : '#f8fafc',
                    borderColor: attachedFile ? '#10b981' : 'var(--border-color)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input 
                    type="file" 
                    ref={modalFileInputRef} 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setAttachedFile(file);
                    }} 
                    accept=".stl,image/*" 
                    style={{ display: 'none' }} 
                  />
                  <Upload style={{ width: '1.2rem', height: '1.2rem', color: attachedFile ? '#10b981' : 'var(--color-muted)', marginBottom: '0.2rem', marginLeft: 'auto', marginRight: 'auto' }} />
                  {attachedFile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>¡Archivo cargado!</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text)', wordBreak: 'break-all' }}>{attachedFile.name} ({Math.round(attachedFile.size / 1024)} KB)</span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>Arrastra el escaneo STL o haz clic para buscar</span>
                      <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.65rem', color: 'var(--color-muted)' }}>Formatos: .STL o imagen (Máx. 20MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Notas e Indicaciones Clínicas
                </label>
                <textarea
                  placeholder="Especifica el diseño, cuello, soporte, oclusión..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px', outline: 'none', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.65rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.65rem' }}
                >
                  Enviar Orden
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      {/* Modal del Visor 3D */}
      {viewingStl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '2rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '960px',
            height: '80vh',
            background: '#18181b',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <StlViewer3D
              fileUrl={viewingStl.url}
              fileName={viewingStl.name}
              onClose={() => setViewingStl(null)}
            />
          </div>
        </div>
      )}

      {/* Modal de Declaración de Conformidad Sanitaria */}
      {showCertModal && selectedOrder?.conformidad && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '680px',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            maxHeight: '90vh'
          }}>
            {/* Header del Certificado */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-accent)', color: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText style={{ width: '1.2rem', height: '1.2rem' }} />
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Certificado de Conformidad Sanitaria</h4>
              </div>
              <button
                onClick={() => setShowCertModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', cursor: 'pointer', color: '#ffffff' }}
              >
                &times;
              </button>
            </div>

            {/* Cuerpo del Certificado (Área Imprimible) */}
            <div id="printable-certificate" style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b' }}>
              
              {/* Encabezado Oficial */}
              <div style={{ textAlign: 'center', borderBottom: '2px double #cbd5e1', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Declaración de Conformidad Sanitaria
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  DIRECTIVA DE PRODUCTOS MÉDICOS HECHOS A MEDIDA · REGULACIÓN ANMAT/DEPARTAMENTO DE SALUD
                </span>
              </div>

              {/* Grid de Datos Generales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>PRODUCTO PRESCRIPTO</span>
                  <strong>{selectedOrder.dentalWork.workType.toUpperCase()}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>PACIENTE ID / REF</span>
                  <strong>{selectedOrder.patientId.slice(0, 18)}...</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>ODONTÓLOGO PRESCRIPTOR</span>
                  <strong>{MOCK_CLINICAS[selectedOrder.tenantId] || selectedOrder.tenantId}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>LABORATORIO FABRICANTE</span>
                  <strong>DentaLab Dental Laboratories (ID: {selectedOrder.performerTenantId})</strong>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

              {/* Trazabilidad de Materiales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                  Trazabilidad de Insumos Clínicos
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>Técnico Dental</span>
                    <strong>{selectedOrder.trazabilidad?.technicianName || 'No especificado'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>Marca y Lote Material</span>
                    <strong>{selectedOrder.trazabilidad?.materialBrand || 'N/D'} (Lote: {selectedOrder.trazabilidad?.materialLot || 'N/D'})</strong>
                  </div>
                </div>

                {/* Tabla de Aditamentos */}
                {selectedOrder.trazabilidad?.aditamentos && selectedOrder.trazabilidad.aditamentos.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Aditamentos e Implantes Incorporados</span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                          <th style={{ padding: '0.4rem 0.25rem' }}>Componente</th>
                          <th style={{ padding: '0.4rem 0.25rem' }}>Marca</th>
                          <th style={{ padding: '0.4rem 0.25rem' }}>Lote de Trazabilidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.trazabilidad.aditamentos.map((ad, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.4rem 0.25rem', fontWeight: 600 }}>{ad.type}</td>
                            <td style={{ padding: '0.4rem 0.25rem' }}>{ad.brand}</td>
                            <td style={{ padding: '0.4rem 0.25rem' }}><code>{ad.lot}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

              {/* Declaración Legal */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px dashed #cbd5e1', fontSize: '0.78rem', lineHeight: 1.4, fontStyle: 'italic', textAlign: 'justify' }}>
                "{selectedOrder.conformidad.declaracionDoc}"
              </div>

              {/* Firma y Hash de Integridad */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem', gap: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Firma Digital de Conformidad</span>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', color: 'var(--color-accent)', padding: '0.5rem 0', borderBottom: '1px solid #cbd5e1', fontStyle: 'italic' }}>
                    {selectedOrder.conformidad.signedBy.split(' - Mat: ')[0]}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Registro Profesional / Matrícula: <strong>{selectedOrder.conformidad.signedBy.split(' - Mat: ')[1] || 'N/D'}</strong>
                  </span>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                    Firmado el: {new Date(selectedOrder.conformidad.signedAt).toLocaleString('es-AR')}
                  </span>
                </div>
                
                {/* Hash e integridad digital */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', maxWidth: '240px' }}>
                  {/* Código QR simulado con SVG */}
                  <svg width="60" height="60" viewBox="0 0 100 100" style={{ background: '#ffffff', padding: '3px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <rect x="10" y="10" width="20" height="20" fill="#1e293b" />
                    <rect x="70" y="10" width="20" height="20" fill="#1e293b" />
                    <rect x="10" y="70" width="20" height="20" fill="#1e293b" />
                    <rect x="35" y="35" width="30" height="30" fill="#1e293b" />
                    <rect x="15" y="15" width="10" height="10" fill="#ffffff" />
                    <rect x="75" y="15" width="10" height="10" fill="#ffffff" />
                    <rect x="15" y="75" width="10" height="10" fill="#ffffff" />
                    <rect x="45" y="45" width="10" height="10" fill="#ffffff" />
                    <rect x="40" y="10" width="10" height="10" fill="#1e293b" />
                    <rect x="55" y="20" width="10" height="10" fill="#1e293b" />
                    <rect x="10" y="45" width="10" height="10" fill="#1e293b" />
                    <rect x="20" y="55" width="10" height="10" fill="#1e293b" />
                    <rect x="80" y="45" width="10" height="10" fill="#1e293b" />
                    <rect x="75" y="55" width="10" height="10" fill="#1e293b" />
                    <rect x="45" y="75" width="10" height="10" fill="#1e293b" />
                    <rect x="55" y="80" width="10" height="10" fill="#1e293b" />
                  </svg>
                  <span style={{ fontSize: '0.55rem', color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    SHA-256: {selectedOrder.conformidad.hash.slice(0, 16)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.2rem' }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const printContents = document.getElementById('printable-certificate')?.innerHTML;
                  if (printContents) {
                    const printWindow = window.open('', '', 'height=600,width=800');
                    printWindow?.document.write('<html><head><title>Certificado de Conformidad</title>');
                    printWindow?.document.write('<style>body{font-family:sans-serif;padding:40px;color:#1e293b;} table{width:100%;border-collapse:collapse;margin-top:10px;} th,td{border-bottom:1px solid #cbd5e1;padding:8px;text-align:left;} code{font-family:monospace;background:#f1f5f9;padding:2px 4px;border-radius:4px;}</style>');
                    printWindow?.document.write('</head><body>');
                    printWindow?.document.write(printContents);
                    printWindow?.document.write('</body></html>');
                    printWindow?.document.close();
                    printWindow?.focus();
                    printWindow?.print();
                    printWindow?.close();
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText style={{ width: '0.9rem', height: '0.9rem' }} />
                Imprimir Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
