import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Eraser, Check, Loader2 } from 'lucide-react';

/**
 * Captura de firma manuscrita del paciente en canvas táctil (dedo/lápiz o mouse).
 * Exporta un PNG (toBlob) que el modal sube al backend. No persiste nada por sí solo.
 */
interface Props {
  title?: string;
  subtitle?: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: (png: Blob) => void;
}

export const SignaturePadModal: React.FC<Props> = ({ title, subtitle, saving, onCancel, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  // Ajusta el canvas al ancho disponible (mobile-safe) manteniendo alta resolución.
  // (ux M5) preserva el trazo al redimensionar (rotación de tablet en pleno acto de firma).
  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prev = canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL() : null;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Tinta oscura sobre blanco A PROPÓSITO (evidencia legal: el PNG debe ser legible
      // independiente del tema/white-label del tenant). No migrar a tokens.
      ctx.strokeStyle = '#0f172a';
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    }
  }, []);

  useEffect(() => {
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, [setup]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStroke) setHasStroke(true);
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const save = () => {
    if (!hasStroke) return;
    canvasRef.current!.toBlob((blob) => { if (blob) onSave(blob); }, 'image/png');
  };

  return (
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Capturar firma de conformidad"
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-text) 50%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '1rem' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', borderRadius: '16px', width: 'min(520px, 96vw)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{title || 'Firma de conformidad del paciente'}</h3>
            {subtitle && <p style={{ margin: '0.15rem 0 0', fontSize: '0.76rem', color: 'var(--color-muted)' }}>{subtitle}</p>}
          </div>
          <button onClick={onCancel} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '1rem 1.2rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>El paciente firma con el dedo o el lápiz dentro del recuadro.</p>
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            style={{ width: '100%', height: '200px', border: '1px dashed var(--color-primary)', borderRadius: '10px', background: '#fff', touchAction: 'none', display: 'block', cursor: 'crosshair' }}
          />
        </div>

        <div style={{ padding: '0.8rem 1.2rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={clear} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '9px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600 }}>
            <Eraser size={16} /> Borrar
          </button>
          <button type="button" onClick={save} disabled={saving || !hasStroke} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', borderRadius: '9px', border: 'none', background: hasStroke ? 'var(--color-primary)' : 'var(--color-muted)', color: '#fff', cursor: saving ? 'wait' : (hasStroke ? 'pointer' : 'not-allowed'), fontWeight: 800 }}>
            {saving ? <><Loader2 size={16} className="spin" /> Guardando…</> : <><Check size={16} /> Confirmar firma</>}
          </button>
        </div>
      </div>
    </div>
  );
};
