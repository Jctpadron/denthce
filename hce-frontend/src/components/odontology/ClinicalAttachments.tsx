import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Paperclip, Upload, Download, Trash2, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

/**
 * Adjuntos clínicos (RX/PDF) de un owner (presupuesto o prestación). Sube por multipart,
 * lista, descarga (endpoint autenticado) y borra (soft-delete). 100% responsivo.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const authHeaders = () => ({ Authorization: `Bearer ${keycloak.token}` });
const ACCEPT = 'image/jpeg,image/png,application/pdf';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number | null;
  kind: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  downloadUrl: string;
}

interface Props {
  ownerType: 'presupuesto' | 'procedure';
  ownerId: string;
  label?: string;
  compact?: boolean;
}

export const ClinicalAttachments: React.FC<Props> = ({ ownerType, ownerId, label, compact }) => {
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API_URL}/odontology/attachments`, {
        headers: authHeaders(), params: { ownerType, ownerId },
      });
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch { /* sin adjuntos */ }
  }, [ownerType, ownerId]);

  // Carga inicial (IIFE async: el setState ocurre tras el await, no en el cuerpo del efecto).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await axios.get(`${API_URL}/odontology/attachments`, { headers: authHeaders(), params: { ownerType, ownerId } });
        if (alive) setItems(Array.isArray(r.data) ? r.data : []);
      } catch { /* sin adjuntos */ }
    })();
    return () => { alive = false; };
  }, [ownerType, ownerId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { e.target.value = ''; await upload(file); }
  };

  const upload = async (file: File) => {
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('ownerType', ownerType);
      fd.append('ownerId', ownerId);
      await axios.post(`${API_URL}/odontology/attachment`, fd, { headers: authHeaders() });
      await load();
    } catch (err) {
      let msg = 'No se pudo subir el archivo.';
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) msg = 'Demasiadas solicitudes: esperá unos minutos y reintentá.';
        else if (err.response?.data?.message) msg = String(err.response.data.message);
        else if (!err.response) msg = 'No se pudo contactar el servidor (conexión o límite de solicitudes). Reintentá en unos minutos.';
      }
      setError(msg);
    } finally { setUploading(false); }
  };

  const descargar = async (a: Attachment) => {
    try {
      const r = await axios.get(`${API_URL}${a.downloadUrl}`, { headers: authHeaders(), responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank');
    } catch { /* noop */ }
  };

  const borrar = async (a: Attachment) => {
    try {
      await axios.delete(`${API_URL}/odontology/attachment/${a.id}`, { headers: authHeaders() });
      await load();
    } catch { /* noop */ }
  };

  const IconFor = ({ mime }: { mime: string }) =>
    mime === 'application/pdf' ? <FileText size={14} /> : <ImageIcon size={14} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 0 }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: compact ? '0.7rem' : '0.78rem', fontWeight: 700, color: 'var(--color-muted)' }}>
          <Paperclip size={compact ? 13 : 15} /> {label}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
        {items.map((a) => (
          <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', borderRadius: '999px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.72rem', color: 'var(--color-text)', maxWidth: 220 }}>
            <IconFor mime={a.mimeType} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.filename}>{a.filename}</span>
            <button type="button" onClick={() => descargar(a)} title="Descargar / ver" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'inline-flex', padding: 0 }}><Download size={13} /></button>
            <button type="button" onClick={() => borrar(a)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-rose)', display: 'inline-flex', padding: 0 }}><Trash2 size={13} /></button>
          </span>
        ))}

        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} style={{ display: 'none' }} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px dashed var(--color-primary)', background: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', fontSize: '0.72rem' }}
        >
          {uploading ? <><Loader2 size={13} className="spin" /> Subiendo…</> : <><Upload size={13} /> {compact ? 'Adjuntar' : 'Adjuntar RX / archivo'}</>}
        </button>
      </div>

      {!compact && items.length === 0 && !error && (
        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Sin adjuntos. Se aceptan imágenes (JPG/PNG) y PDF.</span>
      )}
      {error && <span style={{ fontSize: '0.72rem', color: 'var(--color-rose)' }}>{error}</span>}
    </div>
  );
};
