import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { buildDemoHref } from './content';

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal "Solicitar demo": formulario corto que arma un mensaje de WhatsApp
 * (wa.me) con los datos pre-cargados. Accesible (role=dialog, Esc, foco, overlay).
 */
export const DemoModal: React.FC<DemoModalProps> = ({ open, onClose }) => {
  const [nombre, setNombre] = useState('');
  const [clinica, setClinica] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      (lastFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mensaje =
      `Hola 👋 Quiero solicitar una demo de Denta Cloud.\n` +
      `• Nombre: ${nombre}\n` +
      `• Clínica: ${clinica}\n` +
      `• WhatsApp: ${whatsapp}\n` +
      `• Especialidad: ${especialidad}`;
    window.open(buildDemoHref(mensaje), '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div
      className="demo-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="demo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-title"
        ref={dialogRef}
      >
        <div className="demo-modal__header">
          <div>
            <h3 id="demo-title">Solicitá tu demo</h3>
            <p className="demo-sub">Te contactamos por WhatsApp y te mostramos Denta Cloud con un caso de tu especialidad. Sin compromiso.</p>
          </div>
          <button type="button" className="demo-close" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="demo-field">
            <label htmlFor="demo-nombre">Nombre y apellido</label>
            <input id="demo-nombre" ref={firstFieldRef} className="search-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="demo-field">
            <label htmlFor="demo-clinica">Clínica / consultorio</label>
            <input id="demo-clinica" className="search-input" value={clinica} onChange={(e) => setClinica(e.target.value)} />
          </div>
          <div className="demo-field">
            <label htmlFor="demo-wa">WhatsApp</label>
            <input id="demo-wa" className="search-input" type="tel" inputMode="tel" placeholder="Ej: 388 4 123456" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
          </div>
          <div className="demo-field">
            <label htmlFor="demo-esp">Especialidad</label>
            <input id="demo-esp" className="search-input" placeholder="Ej: odontología general, ortodoncia…" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} />
          </div>
          <button type="submit" className="landing-btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            Enviar por WhatsApp
          </button>
        </form>
      </div>
    </div>
  );
};
