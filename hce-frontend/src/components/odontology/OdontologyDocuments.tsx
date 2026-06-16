import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Trash2, Eye, CheckCircle, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

interface FileItem {
  id: string;
  isImage: boolean;
  url: string;          // relativa (/uploads/...)
  title: string;
  category: string;     // radiografia | foto | documento | imagen
  contentType: string;
  uploadedAt: string;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'radiografia', label: 'Radiografía' },
  { value: 'foto', label: 'Foto clínica' },
  { value: 'documento', label: 'Documento' },
];

const CATEGORY_GROUPS: { value: string; label: string }[] = [
  { value: 'radiografia', label: 'Radiografías' },
  { value: 'foto', label: 'Fotos clínicas' },
  { value: 'documento', label: 'Documentos' },
  { value: 'imagen', label: 'Otras imágenes' },
];

export const OdontologyDocuments: React.FC<Props> = ({ patientId }) => {
  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const fileBase = import.meta.env.VITE_API_URL;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('radiografia');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parse = (r: any): FileItem | null => {
    if (r.resourceType !== 'Media' && r.resourceType !== 'DocumentReference') return null;
    const isImage = r.resourceType === 'Media';
    const url = isImage ? r.content?.url : r.content?.[0]?.attachment?.url;
    if (!url) return null;
    return {
      id: r.id,
      isImage,
      url,
      title: r._originalName || r.content?.title || r.content?.[0]?.attachment?.title || r.description || 'Archivo',
      category: r._category || (isImage ? 'imagen' : 'documento'),
      contentType: r._contentType || '',
      uploadedAt: r._uploadedAt || r.date || '',
    };
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      const list = (res.data as any[]).map(parse).filter(Boolean) as FileItem[];
      list.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
      setItems(list);
    } catch (err) {
      console.error('Error cargando imágenes/documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  const onPick = (f: File | null) => {
    setFile(f);
    if (f && f.type && !f.type.startsWith('image/')) setCategory('documento');
    else if (f) setCategory((c) => (c === 'documento' ? 'radiografia' : c));
  };

  const handleUpload = async () => {
    if (!file) { setMessage({ type: 'error', text: 'Elegí un archivo primero.' }); return; }
    setUploading(true); setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      fd.append('description', description);
      await axios.post(`${apiBase}/patient/${patientId}/upload`, fd, {
        headers: { Authorization: `Bearer ${keycloak.token}`, 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'success', text: 'Archivo subido correctamente.' });
      setFile(null); setDescription('');
      if (inputRef.current) inputRef.current.value = '';
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo subir el archivo.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este archivo? No se puede deshacer.')) return;
    try {
      await axios.delete(`${apiBase}/resource/${id}`, authHeader);
      load();
    } catch (err) {
      console.error('Error eliminando archivo:', err);
      setMessage({ type: 'error', text: 'No se pudo eliminar el archivo.' });
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '10px',
          background: message.type === 'success' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
          color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)', fontSize: '0.85rem',
        }}>
          {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} /> : <ShieldAlert style={{ width: '1.1rem', height: '1.1rem' }} />}
          {message.text}
        </div>
      )}

      {/* Zona de carga */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
          Subir radiografía, foto o documento
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <label style={labelStyle}>Archivo (JPG, PNG, WebP, PDF, DOC — máx. 25MB)</label>
            <input
              ref={inputRef}
              type="file"
              aria-label="Adjuntar archivo (JPG, PNG, WebP, PDF, DOC; máximo 25MB)"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
              className="search-input"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Categoría</label>
            <select className="search-input" aria-label="Categoría del documento" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }} disabled={!!file && !file.type.startsWith('image/')}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <label style={labelStyle}>Descripción (opcional)</label>
            <input className="search-input" aria-label="Descripción del documento" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: panorámica inicial" style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={uploading || !file} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
            <Upload style={{ width: '1rem', height: '1rem' }} />
            {uploading ? 'Subiendo…' : 'Subir archivo'}
          </button>
        </div>
      </div>

      {/* Galería agrupada por categoría */}
      {loading ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando archivos…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-muted)', fontSize: '0.88rem', border: '1px dashed var(--border-color)', borderRadius: '14px', background: 'var(--bg-card)' }}>
          <ImageIcon style={{ width: '2rem', height: '2rem', opacity: 0.4, marginBottom: '0.5rem' }} />
          <p style={{ margin: 0 }}>Todavía no hay radiografías ni documentos para este paciente.</p>
        </div>
      ) : (
        CATEGORY_GROUPS.map((g) => {
          const group = items.filter((it) => it.category === g.value);
          if (group.length === 0) return null;
          return (
            <div key={g.value} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {g.label} ({group.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
                {group.map((it) => {
                  const fullUrl = `${fileBase}${it.url}`;
                  return (
                    <div key={it.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', height: '130px', background: 'var(--bg-card)' }} title="Abrir">
                        {it.isImage ? (
                          <img src={fullUrl} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>
                            <FileText style={{ width: '2.5rem', height: '2.5rem' }} />
                          </div>
                        )}
                      </a>
                      <div style={{ padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.title}>
                          {it.title}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{fmtDate(it.uploadedAt)}</span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <a href={fullUrl} target="_blank" rel="noopener noreferrer" title="Abrir" style={{ color: 'var(--color-muted)', display: 'inline-flex' }}>
                              <Eye style={{ width: '1rem', height: '1rem' }} />
                            </a>
                            <button onClick={() => handleDelete(it.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-rose)', padding: 0, display: 'inline-flex' }}>
                              <Trash2 style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
