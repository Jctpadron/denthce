import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Send, User, Clock, FileText, Download, Wrench, CheckCircle, AlertCircle, Eye, Upload, Plus, Boxes, ShieldAlert } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { StlViewer3D } from './StlViewer3D';

interface Order {
  id: string;
  tenantId: string;
  performerTenantId: string;
  patientId: string;
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

interface Insumo {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  additionalMeta?: {
    height?: number;
    color?: string;
    lotNumber?: string;
    brand?: string;
  } | null;
}

const MOCK_CLINICAS: Record<string, string> = {
  'clinica_santa_lucia': 'Clínica Odontológica Santa Lucía',
  'clinica_central': 'Centro Dental Central',
  'clinica_jujuy': 'Círculo Odontológico de Jujuy',
  'mi_consultorio_dent_hce': 'Centro Odontológico DentHCE'
};

export const DentaLabPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory'>('dashboard');
  
  // Estados de Órdenes y Chat
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingStl, setViewingStl] = useState<{ url?: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de la Trazabilidad y la Conformidad Sanitaria (Fase 2)
  const [caseSubTab, setCaseSubTab] = useState<'chat' | 'trazabilidad'>('chat');
  const [techName, setTechName] = useState('');
  const [matLot, setMatLot] = useState('');
  const [matBrand, setMatBrand] = useState('');
  const [aditamentosList, setAditamentosList] = useState<{ type: string; brand: string; lot: string }[]>([]);
  const [firmanteNombre, setFirmanteNombre] = useState('');
  const [firmanteMatricula, setFirmanteMatricula] = useState('');
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  
  const lastSelectedOrderIdRef = useRef<string | null>(null);

  // Estados de Carga Manual de Órdenes (Fase 3)
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [newOrderPatientName, setNewOrderPatientName] = useState('');
  const [newOrderPatientDni, setNewOrderPatientDni] = useState('');
  const [newOrderDoctorName, setNewOrderDoctorName] = useState('');
  const [newOrderDoctorMatricula, setNewOrderDoctorMatricula] = useState('');
  const [newOrderClincaName, setNewOrderClincaName] = useState('');
  const [newOrderWorkType, setNewOrderWorkType] = useState('corona');
  const [newOrderMaterial, setNewOrderMaterial] = useState('zirconio');
  const [newOrderColor, setNewOrderColor] = useState('A2');
  const [newOrderTeeth, setNewOrderTeeth] = useState('');
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [newOrderDelivery, setNewOrderDelivery] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Estados de Inventario de Insumos
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(false);
  const [showAddInsumoModal, setShowAddInsumoModal] = useState(false);
  const [adjustingInsumo, setAdjustingInsumo] = useState<Insumo | null>(null);
  const [adjustStockVal, setAdjustStockVal] = useState(0);

  // Estados Formulario de Nuevo Insumo
  const [newInsumoName, setNewInsumoName] = useState('');
  const [newInsumoCategory, setNewInsumoCategory] = useState('zirconio');
  const [newInsumoStock, setNewInsumoStock] = useState(1);
  const [newInsumoMinStock, setNewInsumoMinStock] = useState(1);
  const [newInsumoUnit, setNewInsumoUnit] = useState('Unidad');
  const [newInsumoHeight, setNewInsumoHeight] = useState('18');
  const [newInsumoColor, setNewInsumoColor] = useState('A2');
  const [newInsumoBrand, setNewInsumoBrand] = useState('VITA Zahnfabrik');

  // Estados de Estadísticas del Dashboard
  const [stats, setStats] = useState<any>({
    activeOrdersCount: 0,
    statusCounts: {
      received: 0,
      designing: 0,
      processing: 0,
      ceramic: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    },
    criticalOrdersCount: 0,
    lowStockCount: 0,
  });

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
      console.error('Error al subir archivo en portal de prótesis:', err);
      alert('Error al adjuntar archivo en el chat');
    }
  };

  // Fetch de órdenes de prótesis
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/protesis`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setOrders(response.data);
    } catch (err) {
      console.error('Error fetching lab orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch de chat y detalles de orden
  const fetchChat = async (orderId: string) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/protesis/${orderId}`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setSelectedOrder(response.data);
      setChatMessages(response.data.messages || []);

      // Inicializar estados de trazabilidad y conformidad al cambiar de orden
      if (lastSelectedOrderIdRef.current !== orderId) {
        lastSelectedOrderIdRef.current = orderId;
        setCaseSubTab('chat'); // Resetear a chat al cambiar de caso
        
        const traz = response.data.trazabilidad;
        setTechName(traz?.technicianName || '');
        setMatLot(traz?.materialLot || '');
        setMatBrand(traz?.materialBrand || '');
        setAditamentosList(traz?.aditamentos || []);

        const conf = response.data.conformidad;
        setFirmanteNombre(conf?.signedBy?.split(' - Mat: ')?.[0] || '');
        setFirmanteMatricula(conf?.signedBy?.split(' - Mat: ')?.[1] || '');
        setAcceptLegal(conf?.isSigned || false);
      }
    } catch (err) {
      console.error('Error fetching chat:', err);
    }
  };

  // Fetch de insumos de almacén
  const fetchInsumos = async () => {
    setLoadingInsumos(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/protesis/insumos`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setInsumos(response.data);
    } catch (err) {
      console.error('Error fetching insumos:', err);
    } finally {
      setLoadingInsumos(false);
    }
  };

  // Fetch de estadísticas del dashboard
  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/protesis/dashboard/stats`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  // Carga inicial y listeners de pestaña activa
  useEffect(() => {
    fetchOrders();
    fetchInsumos();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
      fetchOrders();
    } else if (activeTab === 'inventory') {
      fetchInsumos();
    }
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedOrder && activeTab === 'orders') {
        fetchChat(selectedOrder.id);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedOrder?.id, activeTab]);

  // Cambiar el estado de la orden
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedOrder) return;
    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/protesis/${selectedOrder.id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setSelectedOrder(response.data);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: newStatus } : o)));
      fetchDashboardStats();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Enviar mensaje de chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedOrder) return;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/protesis/${selectedOrder.id}/chat`,
        { textContent: newMessage.trim() },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setChatMessages((prev) => [...prev, response.data]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending chat message:', err);
    }
  };

  // Crear orden de trabajo manual (Fase 3)
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderPatientName.trim() || !newOrderDoctorName.trim()) {
      alert('Por favor complete los campos obligatorios del paciente y del odontólogo.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const teethArray = newOrderTeeth
        .split(',')
        .map((t) => parseInt(t.trim(), 10))
        .filter((t) => !isNaN(t));

      const payload = {
        isManual: true,
        patientName: newOrderPatientName.trim(),
        patientId: newOrderPatientDni.trim() || 'external',
        doctorName: newOrderDoctorName.trim(),
        doctorMatricula: newOrderDoctorMatricula.trim(),
        tenantId: newOrderClincaName.trim() || 'external',
        dentalWork: {
          workType: newOrderWorkType,
          material: newOrderMaterial,
          color: newOrderColor,
          teeth: teethArray,
          notes: newOrderNotes.trim() || undefined,
        },
        requestedDelivery: newOrderDelivery ? new Date(newOrderDelivery).toISOString() : undefined,
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/protesis`,
        payload,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );

      // Limpiar y cerrar
      setNewOrderPatientName('');
      setNewOrderPatientDni('');
      setNewOrderDoctorName('');
      setNewOrderDoctorMatricula('');
      setNewOrderClincaName('');
      setNewOrderTeeth('');
      setNewOrderNotes('');
      setNewOrderDelivery('');
      setShowAddOrderModal(false);

      // Recargar bandeja y seleccionar la nueva orden
      await fetchOrders();
      setSelectedOrder(response.data);
      fetchChat(response.data.id);
      fetchDashboardStats();
      
      alert('Trabajo manual registrado con éxito');
    } catch (err) {
      console.error('Error al registrar orden manual:', err);
      alert('Ocurrió un error al registrar la orden de trabajo');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Crear nuevo insumo en inventario
  const handleCreateInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsumoName.trim()) return;

    const dto = {
      name: newInsumoName.trim(),
      category: newInsumoCategory,
      stock: newInsumoStock,
      minStock: newInsumoMinStock,
      unit: newInsumoUnit,
      additionalMeta: {
        height: newInsumoCategory === 'zirconio' ? parseFloat(newInsumoHeight) : undefined,
        color: newInsumoColor,
        brand: newInsumoBrand,
        lotNumber: `L-${Math.floor(100000 + Math.random() * 900000)}`
      }
    };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/protesis/insumos`,
        dto,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setInsumos((prev) => [response.data, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
      setShowAddInsumoModal(false);
      // Limpiar Formulario
      setNewInsumoName('');
      setNewInsumoStock(1);
      setNewInsumoMinStock(1);
      fetchDashboardStats();
    } catch (err) {
      console.error('Error al registrar insumo:', err);
      alert('Error al guardar el insumo en el almacén');
    }
  };

  // Ajustar cantidad de stock
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingInsumo) return;

    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/protesis/insumos/${adjustingInsumo.id}/stock`,
        { stock: adjustStockVal },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setInsumos((prev) => prev.map((ins) => (ins.id === adjustingInsumo.id ? response.data : ins)));
      setAdjustingInsumo(null);
      fetchDashboardStats();
    } catch (err) {
      console.error('Error al modificar stock:', err);
      alert('Error al ajustar stock');
    }
  };

  // Guardar datos de trazabilidad
  const handleSaveTrazabilidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/protesis/${selectedOrder.id}/trazabilidad`,
        {
          technicianName: techName,
          materialLot: matLot,
          materialBrand: matBrand,
          aditamentos: aditamentosList,
        },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setSelectedOrder(response.data);
      alert('Trazabilidad sanitaria guardada con éxito.');
    } catch (err) {
      console.error('Error guardando trazabilidad:', err);
      alert('Error al guardar los datos de trazabilidad.');
    }
  };

  // Firmar y declarar conformidad sanitaria
  const handleSignConformidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !firmanteNombre.trim() || !firmanteMatricula.trim() || !acceptLegal) return;

    if (!window.confirm('¿Está seguro de firmar la Declaración de Conformidad? Una vez firmada, los datos de trazabilidad del caso quedarán sellados e inmutables por regulaciones sanitarias.')) {
      return;
    }

    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/protesis/${selectedOrder.id}/conformidad`,
        {
          signedBy: `${firmanteNombre.trim()} - Mat: ${firmanteMatricula.trim()}`,
          declaracionDoc: 'Por la presente, declaro que el dispositivo médico a medida detallado en esta orden ha sido fabricado siguiendo las prescripciones del odontólogo emisor y cumple con los requisitos esenciales de seguridad y funcionamiento establecidos por las normativas de salud pública vigentes.',
        },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setSelectedOrder(response.data);
      // Actualizar también la lista de órdenes local para reflejar el cambio a 'ready'
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: 'ready' } : o)));
      alert('Declaración de Conformidad firmada con éxito. El estado del trabajo se ha actualizado a Listo para Enviar.');
      fetchDashboardStats();
    } catch (err) {
      console.error('Error al firmar conformidad:', err);
      alert('Error al emitir la firma de conformidad.');
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'received':
        return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', label: 'Recibido' };
      case 'designing':
        return { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Diseño CAD' };
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

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const clinicaName = (MOCK_CLINICAS[order.tenantId] || order.tenantId).toLowerCase();
    const matchesSearch = clinicaName.includes(searchTerm.toLowerCase()) || 
                          order.dentalWork.workType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Trabajos con fecha de vencimiento menor a 3 días y que no estén completados
  const urgentOrdersList = orders.filter((order) => {
    if (order.status === 'delivered' || order.status === 'cancelled') return false;
    if (!order.requestedDelivery) return false;
    const today = new Date();
    const delivery = new Date(order.requestedDelivery);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= -1 && diffDays <= 3;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 'calc(100vh - 120px)', paddingBottom: '2rem' }}>
      
      {/* Header del Portal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Wrench style={{ width: '1.6rem', height: '1.6rem', color: 'var(--color-accent)' }} />
            DentaLab — Portal de Prótesis Dentales
          </h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            Panel de control para laboratorios dentales y protesistas autónomos
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', padding: '0.45rem 1rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <CheckCircle style={{ width: '1rem', height: '1rem', color: 'var(--color-emerald)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-emerald)' }}>Conexión Activa y Cifrada</span>
        </div>
      </div>

      {/* Navegación por Pestañas del Portal */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.1rem', marginBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'dashboard' ? '3px solid var(--color-accent)' : '3px solid transparent',
            color: activeTab === 'dashboard' ? 'var(--color-accent)' : 'var(--color-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.88rem',
            transition: 'all 0.15s ease'
          }}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'orders' ? '3px solid var(--color-accent)' : '3px solid transparent',
            color: activeTab === 'orders' ? 'var(--color-accent)' : 'var(--color-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.88rem',
            transition: 'all 0.15s ease'
          }}
        >
          📋 Órdenes de Trabajo
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '3px solid var(--color-accent)' : '3px solid transparent',
            color: activeTab === 'inventory' ? 'var(--color-accent)' : 'var(--color-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.88rem',
            transition: 'all 0.15s ease'
          }}
        >
          📦 Inventario de Insumos
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* 1. PESTAÑA DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Tarjetas KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(41, 98, 255, 0.1)', color: 'var(--color-accent)' }}>
                <Boxes style={{ width: '1.5rem', height: '1.5rem' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>TRABAJOS ACTIVOS</div>
                <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{stats.activeOrdersCount}</h3>
              </div>
            </div>

            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', border: stats.criticalOrdersCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)' }}>
              <div style={{ padding: '0.75rem', borderRadius: '12px', background: stats.criticalOrdersCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(75, 85, 99, 0.1)', color: stats.criticalOrdersCount > 0 ? 'var(--color-rose)' : 'var(--color-muted)' }}>
                <Clock style={{ width: '1.5rem', height: '1.5rem' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>ENTREGAS URGENTES</div>
                <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: stats.criticalOrdersCount > 0 ? 'var(--color-rose)' : 'inherit' }}>{stats.criticalOrdersCount}</h3>
              </div>
            </div>

            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', border: stats.lowStockCount > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)' }}>
              <div style={{ padding: '0.75rem', borderRadius: '12px', background: stats.lowStockCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(75, 85, 99, 0.1)', color: stats.lowStockCount > 0 ? 'var(--color-orange)' : 'var(--color-muted)' }}>
                <ShieldAlert style={{ width: '1.5rem', height: '1.5rem' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>ALERTAS STOCK BAJO</div>
                <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: stats.lowStockCount > 0 ? 'var(--color-orange)' : 'inherit' }}>{stats.lowStockCount}</h3>
              </div>
            </div>
          </div>

          {/* Gráficos y Listas de Producción */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem', flexWrap: 'wrap' }}>
            
            {/* Columna Izquierda: Cargas de Taller */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>🏗️ Balance de Carga de Taller</h4>
              
              {/* Carga por Estados de Producción */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.6rem' }}>Estados de Trabajo Activos</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {(['received', 'designing', 'processing', 'ceramic', 'ready'] as const).map((status) => {
                    const count = stats.statusCounts[status] || 0;
                    const pct = stats.activeOrdersCount > 0 ? Math.round((count / stats.activeOrdersCount) * 100) : 0;
                    const style = getStatusBadgeStyle(status);
                    return (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ width: '110px', fontSize: '0.8rem', fontWeight: 600 }}>{style.label}</span>
                        <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: style.text, borderRadius: '4px' }} />
                        </div>
                        <span style={{ width: '40px', fontSize: '0.8rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-muted)' }}>{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

              {/* Simulación Carga de Trabajo de Técnicos */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.6rem' }}>Distribución de Técnicos</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[
                    { name: 'Juan Pérez (Diseño CAD)', pct: 40, color: 'var(--color-accent)' },
                    { name: 'María Gómez (Cerámica/Estética)', pct: 80, color: '#ec4899' },
                    { name: 'Carlos Ruiz (Mecánica de Yesos)', pct: 20, color: '#f59e0b' }
                  ].map((tec) => (
                    <div key={tec.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ width: '180px', fontSize: '0.8rem', fontWeight: 600 }}>{tec.name}</span>
                      <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${tec.pct}%`, height: '100%', background: tec.color, borderRadius: '4px' }} />
                      </div>
                      <span style={{ width: '40px', fontSize: '0.8rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-muted)' }}>{tec.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Columna Derecha: Trabajos Críticos */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '380px', overflowY: 'auto' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-rose)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock style={{ width: '1.1rem', height: '1.1rem' }} />
                Trabajos Críticos de la Semana
              </h4>

              {urgentOrdersList.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--color-muted)', fontSize: '0.82rem', padding: '2rem' }}>
                  ¡Al día! No hay órdenes con entregas críticas esta semana.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {urgentOrdersList.map((order) => {
                    const clinica = MOCK_CLINICAS[order.tenantId] || order.tenantId;
                    return (
                      <div
                        key={order.id}
                        style={{
                          padding: '0.75rem',
                          background: 'rgba(239, 68, 68, 0.03)',
                          border: '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--color-text)' }}>
                            {order.dentalWork.workType.toUpperCase()} (Pzs: {order.dentalWork.teeth.join(', ')})
                          </strong>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                            {clinica}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-rose)' }}>
                          {order.requestedDelivery ? new Date(order.requestedDelivery).toLocaleDateString('es-AR') : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PESTAÑA ÓRDENES DE TRABAJO */}
      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1.2fr 1.8fr' : '1fr', gap: '1.5rem', flex: 1 }}>
          
          {/* Bandeja de Órdenes */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '680px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                📥 Bandeja de Órdenes Recibidas
              </h4>
              <button
                type="button"
                onClick={() => setShowAddOrderModal(true)}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: 'var(--color-emerald)',
                  borderColor: 'var(--color-emerald)',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
                }}
              >
                <Plus style={{ width: '0.85rem', height: '0.85rem' }} />
                Orden Manual
              </button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ width: '0.9rem', height: '0.9rem', color: 'var(--color-muted)', position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar por clínica u odontólogo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.55rem 0.55rem 2rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
              >
                <option value="all">Todos los Estados</option>
                <option value="received">Recibido (Pendiente)</option>
                <option value="designing">Diseño CAD</option>
                <option value="processing">Procesando</option>
                <option value="ceramic">Cerámica</option>
                <option value="ready">Listo para Enviar</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            {loading && orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
                Cargando bandeja de entrada...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: '16px', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                No hay órdenes que coincidan con los filtros.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredOrders.map((order) => {
                  const statusStyle = getStatusBadgeStyle(order.status);
                  const isSelected = selectedOrder?.id === order.id;
                  const clinicaName = order.isManual
                    ? `Dr. ${order.doctorName || 'Externo'} (Manual)`
                    : (MOCK_CLINICAS[order.tenantId] || order.tenantId);

                  return (
                    <div
                      key={order.id}
                      onClick={() => fetchChat(order.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '16px',
                        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--border-color)'}`,
                        background: '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 20px rgba(41, 98, 255, 0.05)' : 'var(--shadow-premium)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>
                          {order.dentalWork.workType}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text
                        }}>
                          {statusStyle.label}
                        </span>
                      </div>

                      <h5 style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Piezas: {order.dentalWork.teeth.join(', ')}
                      </h5>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                        <div>Clínica: <strong style={{ color: 'var(--color-text)' }}>{clinicaName}</strong></div>
                        {order.isManual && (
                          <div>Paciente: <strong style={{ color: 'var(--color-text)' }}>{order.patientName || 'Externo'}</strong></div>
                        )}
                        <div>Material: <strong>{order.dentalWork.material}</strong> | Color: <strong>{order.dentalWork.color}</strong></div>
                        {order.requestedDelivery && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-rose)', fontWeight: 600, marginTop: '0.15rem' }}>
                            <Clock style={{ width: '0.7rem', height: '0.7rem' }} />
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

          {/* Detalle y Chat de la Orden (Derecha) */}
          {selectedOrder ? (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '1.25rem', height: '680px' }}>
              {/* Panel de Detalles */}
              <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Ficha de Pedido Médico
                    </span>
                    <h3 style={{ margin: '0.1rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {selectedOrder.dentalWork.workType.toUpperCase()} (Piezas: {selectedOrder.dentalWork.teeth.join(', ')})
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                      Emitido por: {selectedOrder.isManual 
                        ? `Dr. ${selectedOrder.doctorName || 'Externo'} (Manual - Mat: ${selectedOrder.doctorMatricula || 'N/D'})` 
                        : (MOCK_CLINICAS[selectedOrder.tenantId] || selectedOrder.tenantId)}
                    </span>
                    {selectedOrder.isManual && (
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--color-text)' }}>
                        Paciente: <strong>{selectedOrder.patientName || 'Externo'} (DNI: {selectedOrder.patientId === 'external' ? 'No provisto' : selectedOrder.patientId})</strong>
                      </div>
                    )}
                  </div>

                  {/* Selector de Estados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                      Actualizar Estado
                    </label>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      style={{
                        padding: '0.4rem 0.6rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: getStatusBadgeStyle(selectedOrder.status).bg,
                        color: getStatusBadgeStyle(selectedOrder.status).text,
                        outline: 'none',
                      }}
                    >
                      <option value="received">Recibido</option>
                      <option value="designing">Diseño CAD</option>
                      <option value="processing">Procesando</option>
                      <option value="ceramic">Cerámica</option>
                      <option value="ready">Listo para Enviar</option>
                      <option value="delivered">Entregado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '0.85rem 1.1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 600 }}>MATERIAL</div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{selectedOrder.dentalWork.material}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 600 }}>COLOR</div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{selectedOrder.dentalWork.color}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 600 }}>FECHA DE ENTREGA</div>
                    <strong style={{ fontSize: '0.9rem', color: selectedOrder.requestedDelivery ? 'var(--color-rose)' : 'var(--color-text)' }}>
                      {selectedOrder.requestedDelivery ? new Date(selectedOrder.requestedDelivery).toLocaleDateString('es-AR') : 'Sin fecha'}
                    </strong>
                  </div>
                </div>

                {selectedOrder.dentalWork.notes && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      Notas del Odontólogo
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)', lineHeight: 1.4, background: '#f1f5f9', padding: '0.65rem 0.95rem', borderRadius: '10px' }}>
                      {selectedOrder.dentalWork.notes}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', fontSize: '0.78rem' }}
                    onClick={() => setViewingStl({ name: `${selectedOrder.dentalWork.workType.toUpperCase()}_Escaneo.stl` })}
                  >
                    <Eye style={{ width: '0.9rem', height: '0.9rem' }} />
                    Visualizar Escaneo 3D
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', fontSize: '0.78rem' }}
                    onClick={() => alert('Simulación: Descargando escaneo .STL')}
                  >
                    <Download style={{ width: '0.9rem', height: '0.9rem', color: 'var(--color-accent)' }} />
                    Descargar .STL
                  </button>
                </div>
              </div>

              {/* Contenedor del Chat o Trazabilidad y Conformidad con Pestañas Internas */}
              <div className="panel" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                
                {/* Cabecera de Sub-pestañas del Caso */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#ffffff' }}>
                  <button
                    onClick={() => setCaseSubTab('chat')}
                    style={{
                      flex: 1,
                      padding: '0.8rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: caseSubTab === 'chat' ? '3px solid var(--color-accent)' : '3px solid transparent',
                      color: caseSubTab === 'chat' ? 'var(--color-accent)' : 'var(--color-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    💬 Chat y Archivos
                  </button>
                  <button
                    onClick={() => setCaseSubTab('trazabilidad')}
                    style={{
                      flex: 1,
                      padding: '0.8rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: caseSubTab === 'trazabilidad' ? '3px solid var(--color-accent)' : '3px solid transparent',
                      color: caseSubTab === 'trazabilidad' ? 'var(--color-accent)' : 'var(--color-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    🛡️ Trazabilidad y Conformidad
                  </button>
                </div>

                {/* CONTENIDO SUB-PESTAÑA 1: CHAT */}
                {caseSubTab === 'chat' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#f8fafc' }}>
                      {chatMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                          No hay mensajes. Escribe un mensaje al odontólogo para coordinar detalles.
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
                              <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)', marginBottom: '0.15rem' }}>
                                {msg.senderName}
                              </span>
                              <div style={{
                                padding: '0.7rem 0.9rem',
                                borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                background: isMe ? 'linear-gradient(135deg, #2962ff, #1565c0)' : '#ffffff',
                                color: isMe ? '#ffffff' : 'var(--color-text)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                fontSize: '0.85rem',
                                lineHeight: '1.4',
                                border: isMe ? 'none' : '1px solid var(--border-color)'
                              }}>
                                {msg.textContent}

                                {msg.attachmentMeta && (
                                  <div style={{
                                    marginTop: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '10px',
                                    background: isMe ? 'rgba(255, 255, 255, 0.15)' : '#f1f5f9',
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
                                          title="Ver 3D interactivo"
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
                                            alert('Simulación: Descargando ' + msg.attachmentMeta?.fileName);
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
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      <Upload style={{ width: '0.85rem', height: '0.85rem', color: 'var(--color-accent)' }} />
                      <span>Subir archivo escaneo o avance de prótesis STL</span>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".stl"
                        style={{ display: 'none' }}
                      />
                    </div>

                    <form onSubmit={handleSendMessage} style={{
                      padding: '0.8rem 1rem',
                      background: '#ffffff',
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: '0.6rem',
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        placeholder="Responder al odontólogo..."
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

                {/* CONTENIDO SUB-PESTAÑA 2: TRAZABILIDAD Y CONFORMIDAD SANITARIA */}
                {caseSubTab === 'trazabilidad' && (
                  <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#f8fafc' }}>
                    
                    {/* Trazabilidad Form */}
                    <form onSubmit={handleSaveTrazabilidad} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#ffffff', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                      <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileText style={{ width: '1rem', height: '1rem', color: 'var(--color-accent)' }} />
                        Trazabilidad de Materiales Utilizados
                      </h5>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Técnico Dental Asignado</label>
                        <input
                          type="text"
                          placeholder="Nombre del técnico responsable de la confección"
                          value={techName}
                          onChange={(e) => setTechName(e.target.value)}
                          disabled={selectedOrder.conformidad?.isSigned}
                          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Marca / Fabricante del Bloque</label>
                          <input
                            type="text"
                            placeholder="Ej: Ivoclar, Aidite, Vita"
                            value={matBrand}
                            onChange={(e) => setMatBrand(e.target.value)}
                            disabled={selectedOrder.conformidad?.isSigned}
                            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Lote del Material (Bloque/Disco)</label>
                          <input
                            type="text"
                            placeholder="Número de lote sanitario"
                            value={matLot}
                            onChange={(e) => setMatLot(e.target.value)}
                            disabled={selectedOrder.conformidad?.isSigned}
                            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                          />
                        </div>
                      </div>

                      {/* Lista Dinámica de Aditamentos */}
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Aditamentos de Implante Utilizados (Ti-Bases, Pilares, Tornillos)</span>
                        
                        {aditamentosList.length === 0 ? (
                          <div style={{ padding: '0.65rem', border: '1px dashed var(--border-color)', borderRadius: '10px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                            No hay aditamentos agregados.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {aditamentosList.map((ad, idx) => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder="Tipo (ej: Ti-Base)"
                                  value={ad.type}
                                  onChange={(e) => {
                                    const copy = [...aditamentosList];
                                    copy[idx].type = e.target.value;
                                    setAditamentosList(copy);
                                  }}
                                  disabled={selectedOrder.conformidad?.isSigned}
                                  style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.78rem' }}
                                />
                                <input
                                  type="text"
                                  placeholder="Marca"
                                  value={ad.brand}
                                  onChange={(e) => {
                                    const copy = [...aditamentosList];
                                    copy[idx].brand = e.target.value;
                                    setAditamentosList(copy);
                                  }}
                                  disabled={selectedOrder.conformidad?.isSigned}
                                  style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.78rem' }}
                                />
                                <input
                                  type="text"
                                  placeholder="Lote"
                                  value={ad.lot}
                                  onChange={(e) => {
                                    const copy = [...aditamentosList];
                                    copy[idx].lot = e.target.value;
                                    setAditamentosList(copy);
                                  }}
                                  disabled={selectedOrder.conformidad?.isSigned}
                                  style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.78rem' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setAditamentosList(aditamentosList.filter((_, i) => i !== idx))}
                                  disabled={selectedOrder.conformidad?.isSigned}
                                  style={{ border: 'none', background: 'transparent', color: 'var(--color-rose)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {!selectedOrder.conformidad?.isSigned && (
                          <button
                            type="button"
                            onClick={() => setAditamentosList([...aditamentosList, { type: '', brand: '', lot: '' }])}
                            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0' }}
                          >
                            ➕ Añadir aditamento
                          </button>
                        )}
                      </div>

                      {!selectedOrder.conformidad?.isSigned && (
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          style={{ marginTop: '0.5rem', alignSelf: 'flex-end', fontSize: '0.78rem', padding: '0.45rem 1rem' }}
                        >
                          Guardar Datos de Trazabilidad
                        </button>
                      )}
                    </form>

                    {/* Conformidad Form o Estado */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#ffffff', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                      <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle style={{ width: '1rem', height: '1rem', color: 'var(--color-emerald)' }} />
                        Declaración de Conformidad Sanitaria
                      </h5>

                      {selectedOrder.conformidad?.isSigned ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem 1rem', borderRadius: '12px' }}>
                            <CheckCircle style={{ width: '1.2rem', height: '1.2rem', color: 'var(--color-emerald)', flexShrink: 0 }} />
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-emerald)' }}>Declaración firmada con éxito</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>El dispositivo a medida cuenta con auditoría de conformidad e integridad digital.</span>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text)', display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.4rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '12px' }}>
                            <div>Firmante:</div>
                            <strong style={{ wordBreak: 'break-all' }}>{selectedOrder.conformidad.signedBy}</strong>
                            <div>Fecha Firma:</div>
                            <strong>{new Date(selectedOrder.conformidad.signedAt).toLocaleString('es-AR')}</strong>
                            <div>Hash SHA-256:</div>
                            <code style={{ fontSize: '0.68rem', wordBreak: 'break-all', color: 'var(--color-muted)' }}>{selectedOrder.conformidad.hash}</code>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowCertModal(true)}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', padding: '0.55rem', fontSize: '0.82rem', marginTop: '0.25rem' }}
                          >
                            <FileText style={{ width: '0.95rem', height: '0.95rem' }} />
                            Ver Certificado de Conformidad
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleSignConformidad} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--color-muted)', lineHeight: 1.4, textAlign: 'justify', fontStyle: 'italic' }}>
                            "Por la presente, declaro que el dispositivo médico a medida detallado en esta orden ha sido fabricado siguiendo las prescripciones del odontólogo emisor y cumple con los requisitos esenciales de seguridad y funcionamiento establecidos por las normativas de salud pública vigentes."
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Nombre Completo del Protesista</label>
                              <input
                                type="text"
                                placeholder="Ej: Protesista Juan"
                                value={firmanteNombre}
                                onChange={(e) => setFirmanteNombre(e.target.value)}
                                style={{ padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                                required
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Matrícula / Registro</label>
                              <input
                                type="text"
                                placeholder="Ej: 8877"
                                value={firmanteMatricula}
                                onChange={(e) => setFirmanteMatricula(e.target.value)}
                                style={{ padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                                required
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <input
                              type="checkbox"
                              id="accept-legal"
                              checked={acceptLegal}
                              onChange={(e) => setAcceptLegal(e.target.checked)}
                              style={{ marginTop: '0.15rem', cursor: 'pointer' }}
                              required
                            />
                            <label htmlFor="accept-legal" style={{ fontSize: '0.75rem', color: 'var(--color-text)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.3 }}>
                              Declaro bajo juramento de conformidad sanitaria e integridad de insumos sobre la fabricación de este dispositivo odontológico a medida.
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!acceptLegal || !firmanteNombre.trim() || !firmanteMatricula.trim()}
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.55rem',
                              fontSize: '0.82rem',
                              background: (acceptLegal && firmanteNombre.trim() && firmanteMatricula.trim()) ? 'var(--color-emerald)' : 'var(--color-muted)',
                              borderColor: (acceptLegal && firmanteNombre.trim() && firmanteMatricula.trim()) ? 'var(--color-emerald)' : 'var(--border-color)',
                            }}
                          >
                            Firmar y Declarar Conformidad
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', gap: '0.75rem' }}>
              <AlertCircle style={{ width: '2rem', height: '2rem', color: 'var(--color-muted)' }} />
              <span>Selecciona una orden de la bandeja de entrada para ver su detalle y chat</span>
            </div>
          )}
        </div>
      )}

      {/* 3. PESTAÑA INVENTARIO DE INSUMOS */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Subheader Inventario */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              📦 Almacén e Inventario de Insumos
            </h4>
            <button
              onClick={() => setShowAddInsumoModal(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
            >
              <Plus style={{ width: '0.95rem', height: '0.95rem' }} />
              Registrar Insumo
            </button>
          </div>

          {/* Tabla de Insumos */}
          <div className="panel" style={{ padding: '0.5rem 1.25rem', overflowX: 'auto' }}>
            {loadingInsumos && insumos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
                Cargando inventario...
              </div>
            ) : insumos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-muted)' }}>
                No hay insumos registrados en el almacén de este laboratorio. Registre un nuevo material arriba.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--color-muted)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>NOMBRE</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>CATEGORÍA</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>ALTURA / DETALLES</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>CANTIDAD</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>MIN. ALERTA</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>ESTADO</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((ins) => {
                    const isLow = ins.stock <= ins.minStock;
                    return (
                      <tr 
                        key={ins.id} 
                        style={{ 
                          borderBottom: '1px solid var(--border-color)', 
                          backgroundColor: isLow ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {ins.name}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-muted)' }}>
                          {ins.category}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', fontSize: '0.78rem' }}>
                          {ins.additionalMeta ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', color: 'var(--color-muted)' }}>
                              {ins.additionalMeta.height && <span>Altura: <strong>{ins.additionalMeta.height} mm</strong></span>}
                              {ins.additionalMeta.color && <span>Color: <strong>{ins.additionalMeta.color}</strong></span>}
                              {ins.additionalMeta.brand && <span>Marca: <strong>{ins.additionalMeta.brand}</strong></span>}
                              {ins.additionalMeta.lotNumber && <span style={{ fontSize: '0.65rem' }}>Lote: <code>{ins.additionalMeta.lotNumber}</code></span>}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 800, color: isLow ? 'var(--color-rose)' : 'var(--color-text)' }}>
                          {ins.stock} {ins.unit}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', color: 'var(--color-muted)' }}>
                          {ins.minStock} {ins.unit}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          {isLow ? (
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-rose)', fontSize: '0.68rem', fontWeight: 700 }}>
                              ⚠️ STOCK CRÍTICO
                            </span>
                          ) : (
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-emerald)', fontSize: '0.68rem', fontWeight: 700 }}>
                              OK
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setAdjustingInsumo(ins);
                              setAdjustStockVal(ins.stock);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem' }}
                          >
                            Ajustar Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODALES FLOTANTES */}

      {/* A. Modal de Registro de Insumo */}
      {showAddInsumoModal && (
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
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '440px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Boxes style={{ width: '1.2rem', height: '1.2rem', color: 'var(--color-accent)' }} />
                Registrar Nuevo Insumo
              </h4>
              <button
                onClick={() => setShowAddInsumoModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateInsumo} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Nombre del Insumo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Disco de Zirconio Multicapa A2"
                  value={newInsumoName}
                  onChange={(e) => setNewInsumoName(e.target.value)}
                  style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Categoría
                  </label>
                  <select
                    value={newInsumoCategory}
                    onChange={(e) => setNewInsumoCategory(e.target.value)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  >
                    <option value="zirconio">Zirconio</option>
                    <option value="resina">Resina 3D</option>
                    <option value="aditamento">Aditamentos</option>
                    <option value="yeso">Yeso</option>
                    <option value="metal">Metal</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Unidad de Medida
                  </label>
                  <select
                    value={newInsumoUnit}
                    onChange={(e) => setNewInsumoUnit(e.target.value)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  >
                    <option value="Unidad">Unidad</option>
                    <option value="Gramos">Gramos</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="Kg">Kilogramos (Kg)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newInsumoStock}
                    onChange={(e) => setNewInsumoStock(parseFloat(e.target.value) || 0)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Mínimo Alerta
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newInsumoMinStock}
                    onChange={(e) => setNewInsumoMinStock(parseFloat(e.target.value) || 0)}
                    style={{ padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    required
                  />
                </div>
              </div>

              {/* Parámetros específicos según la categoría */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)' }}>DETALLES TÉCNICOS ADICIONALES</span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {newInsumoCategory === 'zirconio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>Espesor (mm)</span>
                      <select
                        value={newInsumoHeight}
                        onChange={(e) => setNewInsumoHeight(e.target.value)}
                        style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.78rem' }}
                      >
                        <option value="14">14 mm</option>
                        <option value="18">18 mm</option>
                        <option value="22">22 mm</option>
                        <option value="25">25 mm</option>
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>Color VITA</span>
                    <select
                      value={newInsumoColor}
                      onChange={(e) => setNewInsumoColor(e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.78rem' }}
                    >
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                      <option value="A3">A3</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                      <option value="Sin Color">Sin Color</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>Marca / Proveedor</span>
                    <input
                      type="text"
                      placeholder="Ej: VITA Zahnfabrik, NextDent"
                      value={newInsumoBrand}
                      onChange={(e) => setNewInsumoBrand(e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddInsumoModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Registrar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* B. Modal de Ajuste de Stock */}
      {adjustingInsumo && (
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
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '380px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Ajustar Inventario
              </h4>
              <button
                onClick={() => setAdjustingInsumo(null)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>
              Modifique el stock real en almacén de: <strong style={{ color: 'var(--color-text)' }}>{adjustingInsumo.name}</strong>.
            </p>

            <form onSubmit={handleAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem 0' }}>
                <button
                  type="button"
                  onClick={() => setAdjustStockVal((prev) => Math.max(0, prev - 1))}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    background: '#f8fafc',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustStockVal}
                  onChange={(e) => setAdjustStockVal(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '80px',
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    padding: '0.4rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAdjustStockVal((prev) => prev + 1)}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    background: '#f8fafc',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  +
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setAdjustingInsumo(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Confirmar
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
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>PACIENTE</span>
                  <strong>{selectedOrder.isManual ? (selectedOrder.patientName || 'Externo') : `${selectedOrder.patientId.slice(0, 18)}...`}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>ODONTÓLOGO PRESCRIPTOR</span>
                  <strong>{selectedOrder.isManual ? (selectedOrder.doctorName || 'Externo') : (MOCK_CLINICAS[selectedOrder.tenantId] || selectedOrder.tenantId)}</strong>
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

      {/* C. Modal de Carga de Orden Manual (Fase 3) */}
      {showAddOrderModal && (
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
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '560px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus style={{ width: '1.3rem', height: '1.3rem' }} />
                Registrar Trabajo de Laboratorio (Manual)
              </h4>
              <button
                onClick={() => setShowAddOrderModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              Cargue los datos clínicos y de contacto de pedidos que llegan físicamente o por medios externos al taller.
            </p>

            <form onSubmit={handleCreateManualOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem' }}>1. Datos del Paciente</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Nombre y Apellido *</label>
                  <input
                    type="text"
                    placeholder="Ej: Roberto Gómez"
                    value={newOrderPatientName}
                    onChange={(e) => setNewOrderPatientName(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>DNI / Identificador</label>
                  <input
                    type="text"
                    placeholder="Ej: 777777"
                    value={newOrderPatientDni}
                    onChange={(e) => setNewOrderPatientDni(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem', marginTop: '0.25rem' }}>2. Odontólogo y Clínica de Origen</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Nombre del Odontólogo *</label>
                  <input
                    type="text"
                    placeholder="Ej: Dr. Carlos Pérez"
                    value={newOrderDoctorName}
                    onChange={(e) => setNewOrderDoctorName(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Matrícula Profesional</label>
                  <input
                    type="text"
                    placeholder="Ej: MN-5544"
                    value={newOrderDoctorMatricula}
                    onChange={(e) => setNewOrderDoctorMatricula(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Clínica / Centro Odontológico Origen</label>
                <input
                  type="text"
                  placeholder="Ej: Clínica Dental del Norte"
                  value={newOrderClincaName}
                  onChange={(e) => setNewOrderClincaName(e.target.value)}
                  style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem', marginTop: '0.25rem' }}>3. Detalles Clínicos del Dispositivo</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Tipo Trabajo</label>
                  <select
                    value={newOrderWorkType}
                    onChange={(e) => setNewOrderWorkType(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem' }}
                  >
                    <option value="corona">Corona</option>
                    <option value="puente">Puente</option>
                    <option value="removible">Removible</option>
                    <option value="cromo">Cromo</option>
                    <option value="implante">Perno/Implante</option>
                    <option value="placa">Placa Relajación</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Material</label>
                  <select
                    value={newOrderMaterial}
                    onChange={(e) => setNewOrderMaterial(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem' }}
                  >
                    <option value="zirconio">Zirconio</option>
                    <option value="disilicato">Disilicato</option>
                    <option value="acrílico">Acrílico</option>
                    <option value="cromo-cobalto">Cromo-Cobalto</option>
                    <option value="composite">Composite</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Color dental</label>
                  <select
                    value={newOrderColor}
                    onChange={(e) => setNewOrderColor(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem' }}
                  >
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="A3">A3</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Piezas Dentarias (ej: 14, 15)</label>
                  <input
                    type="text"
                    placeholder="Ej: 14, 24"
                    value={newOrderTeeth}
                    onChange={(e) => setNewOrderTeeth(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Fecha de Entrega</label>
                  <input
                    type="date"
                    value={newOrderDelivery}
                    onChange={(e) => setNewOrderDelivery(e.target.value)}
                    style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>Indicaciones / Notas de Diseño</label>
                <textarea
                  placeholder="Detalles sobre morfología, cara oclusal, etc."
                  value={newOrderNotes}
                  onChange={(e) => setNewOrderNotes(e.target.value)}
                  style={{ padding: '0.55rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', minHeight: '80px', resize: 'vertical', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddOrderModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.65rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.65rem', background: 'var(--color-emerald)', borderColor: 'var(--color-emerald)' }}
                >
                  {submittingOrder ? 'Guardando...' : 'Registrar Pedido'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
