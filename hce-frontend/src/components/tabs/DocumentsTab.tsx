import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import keycloak from '../../utils/keycloak-config';

interface DocumentsTabProps {
  patientId: string;
}

interface DocResource {
  id?: string;
  resourceType: 'DocumentReference' | 'Media';
  description?: string;
  content?: { attachment?: { url?: string; contentType?: string; title?: string; size?: number } }[];
  content_?: { url?: string; contentType?: string; title?: string; size?: number };
  date?: string;
  _originalName?: string;
  _fileName?: string;
  _uploadedAt?: string;
}

const formatSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getFileIcon = (mime?: string): string => {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📋';
  if (mime.includes('word')) return '📝';
  return '📄';
};

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ patientId }) => {
  const [documents, setDocuments] = useState<DocResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      const docs: DocResource[] = res.data.filter(
        (r: any) => r.resourceType === 'DocumentReference' || r.resourceType === 'Media'
      );
      setDocuments(docs.reverse());
    } catch (e) {
      console.error('Error cargando documentos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [patientId]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description || file.name);

    try {
      await axios.post(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error al subir el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const getDocUrl = (doc: DocResource): string | null => {
    if (doc.resourceType === 'Media') {
      return (doc as any).content?.url || null;
    }
    return doc.content?.[0]?.attachment?.url || null;
  };

  const getDocMime = (doc: DocResource): string | undefined => {
    if (doc.resourceType === 'Media') {
      return (doc as any).content?.contentType;
    }
    return doc.content?.[0]?.attachment?.contentType;
  };

  const getDocTitle = (doc: DocResource): string => {
    if (doc.resourceType === 'Media') {
      return (doc as any).note?.[0]?.text || (doc as any)._originalName || 'Imagen clínica';
    }
    return doc.description || doc.content?.[0]?.attachment?.title || doc._originalName || 'Documento';
  };

  const getDocDate = (doc: DocResource): string => {
    const dt = doc.date || doc._uploadedAt;
    if (!dt) return '';
    return new Date(dt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Documentos y Radiografías
        </h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          {documents.length} archivos — imágenes, PDFs, documentos clínicos
        </p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--color-cyan)' : 'var(--border-color)'}`,
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center',
          background: dragOver ? 'rgba(2,132,199,0.06)' : 'rgba(0,0,0,0.02)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>☁️</div>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--color-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
          Arrastrá un archivo aquí o hacé clic para seleccionar
        </p>
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.78rem' }}>
          JPG, PNG, WebP, PDF, DOC — Máximo 20 MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>

      {/* Description input */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <input
          className="search-input"
          style={{ flex: 1, paddingLeft: '0.75rem' }}
          placeholder="Descripción del documento (opcional, antes de subir)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        {uploading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-cyan)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            Subiendo...
          </div>
        )}
      </div>

      {/* Modal de previsualización */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={previewUrl}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: '12px', boxShadow: '0 0 40px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewUrl(null)}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: '50%',
              width: '2.5rem',
              height: '2.5rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Lista de documentos */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '1.5rem' }}>
          Cargando documentos...
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: 'var(--color-muted)',
          padding: '2rem',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          fontSize: '0.9rem',
        }}>
          Sin documentos cargados todavía
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {documents.map((doc, idx) => {
            const url = getDocUrl(doc);
            const mime = getDocMime(doc);
            const isImage = mime?.startsWith('image/');
            const title = getDocTitle(doc);
            const date = getDocDate(doc);
            const icon = getFileIcon(mime);

            return (
              <div key={doc.id || idx} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                cursor: 'pointer',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                {/* Preview area */}
                <div
                  onClick={() => isImage && url ? setPreviewUrl(url) : url && window.open(url, '_blank')}
                  style={{
                    height: '120px',
                    background: isImage ? 'transparent' : 'rgba(2,132,199,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {isImage && url ? (
                    <img
                      src={url}
                      alt={title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '3rem' }}>{icon}</span>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '0.75rem' }}>
                  <p style={{
                    margin: '0 0 0.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {title}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                    {date}
                  </p>
                </div>

                {/* Acciones */}
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '0.5rem',
                }}>
                  {url && (
                    <a
                      href={url}
                      download
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-cyan)',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      ⬇ Descargar
                    </a>
                  )}
                  {isImage && url && (
                    <button
                      onClick={() => setPreviewUrl(url)}
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-muted)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      🔍 Ver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
