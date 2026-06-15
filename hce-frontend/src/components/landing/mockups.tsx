import React from 'react';

/**
 * Mockups de UI en SVG (vectoriales) — proporciones exactas, nítidos a cualquier
 * tamaño y con la paleta de marca. Reemplazan a las capturas raster para el visual
 * del producto, el odontograma y el chat de WhatsApp.
 */

const BLUE = 'var(--brand-blue)';
const MINT = 'var(--brand-mint)';
const INK = '#1e293b';
const LINE = '#e8edf3';
const SOFT = '#f1f5f9';

// === Dashboard (hero) · 16:10 ===============================================
export const ProductMockup: React.FC = () => (
  <svg viewBox="0 0 880 550" width="100%" style={{ display: 'block' }} role="img" aria-label="Panel de Denta Cloud: agenda, pacientes y métricas del día">
    <rect width="880" height="550" fill="#ffffff" />
    {/* Sidebar */}
    <rect x="0" y="0" width="180" height="550" fill="#fbfdff" />
    <line x1="180" y1="0" x2="180" y2="550" stroke={LINE} />
    <circle cx="34" cy="40" r="11" fill={MINT} />
    <circle cx="34" cy="40" r="6" fill={BLUE} />
    <rect x="54" y="34" width="84" height="12" rx="6" fill={INK} opacity="0.85" />
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i} transform={`translate(24, ${92 + i * 46})`}>
        {i === 0 && <rect x="-8" y="-10" width="164" height="36" rx="9" fill={BLUE} opacity="0.1" />}
        <rect x="0" y="-2" width="18" height="18" rx="5" fill={i === 0 ? BLUE : '#cbd5e1'} />
        <rect x="30" y="1" width="96" height="11" rx="5" fill={i === 0 ? BLUE : '#cbd5e1'} opacity={i === 0 ? 0.9 : 0.7} />
      </g>
    ))}

    {/* Header */}
    <rect x="180" y="0" width="700" height="64" fill="#ffffff" />
    <line x1="180" y1="64" x2="880" y2="64" stroke={LINE} />
    <rect x="208" y="26" width="150" height="14" rx="7" fill={INK} opacity="0.85" />
    <rect x="700" y="20" width="120" height="26" rx="13" fill={SOFT} />
    <circle cx="844" cy="33" r="14" fill={MINT} opacity="0.25" />
    <circle cx="844" cy="33" r="14" fill="none" stroke={MINT} strokeWidth="1.5" />

    {/* KPI cards */}
    {[
      { x: 208, c: BLUE, h: 38 },
      { x: 432, c: MINT, h: 30 },
      { x: 656, c: '#6366f1', h: 46 },
    ].map((k, i) => (
      <g key={i}>
        <rect x={k.x} y="92" width="200" height="96" rx="14" fill="#ffffff" stroke={LINE} />
        <rect x={k.x + 18} y="112" width="30" height="30" rx="8" fill={k.c} opacity="0.15" />
        <rect x={k.x + 26} y="120" width="14" height="14" rx="4" fill={k.c} />
        <rect x={k.x + 18} y="152" width="90" height="9" rx="4.5" fill="#cbd5e1" />
        <rect x={k.x + 18} y="167" width="54" height="14" rx="7" fill={INK} opacity="0.8" />
      </g>
    ))}

    {/* Chart panel */}
    <rect x="208" y="208" width="424" height="312" rx="14" fill="#ffffff" stroke={LINE} />
    <rect x="230" y="230" width="120" height="12" rx="6" fill={INK} opacity="0.75" />
    {[
      130, 180, 110, 220, 160, 250, 200,
    ].map((h, i) => (
      <g key={i}>
        <rect x={234 + i * 56} y={490 - h} width="30" height={h} rx="7" fill={i % 2 ? MINT : BLUE} opacity={i % 2 ? 0.85 : 1} />
      </g>
    ))}
    <line x1="230" y1="491" x2="610" y2="491" stroke={LINE} />

    {/* Agenda list panel */}
    <rect x="656" y="208" width="200" height="312" rx="14" fill="#ffffff" stroke={LINE} />
    <rect x="676" y="230" width="96" height="12" rx="6" fill={INK} opacity="0.75" />
    {[0, 1, 2, 3].map((i) => (
      <g key={i} transform={`translate(676, ${262 + i * 60})`}>
        <rect x="0" y="0" width="160" height="48" rx="10" fill={SOFT} />
        <rect x="0" y="0" width="4" height="48" rx="2" fill={i === 0 ? MINT : BLUE} />
        <circle cx="26" cy="24" r="12" fill="#ffffff" stroke={LINE} />
        <rect x="48" y="12" width="78" height="9" rx="4.5" fill="#94a3b8" />
        <rect x="48" y="27" width="50" height="8" rx="4" fill="#cbd5e1" />
      </g>
    ))}
  </svg>
);

// === Odontograma · 4:3 ======================================================
const Tooth: React.FC<{ x: number; y: number; state?: 'ok' | 'existing' | 'planned' }> = ({ x, y, state = 'ok' }) => {
  const stroke = state === 'planned' ? BLUE : state === 'existing' ? '#ef4444' : '#cbd5e1';
  const fill = state === 'planned' ? 'color-mix(in srgb, var(--brand-blue) 14%, #fff)' : state === 'existing' ? '#fde8e8' : '#ffffff';
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M6,2 C14,-1 24,-1 32,2 C40,5 40,16 36,26 C33,33 33,40 30,40 C27,40 27,33 25,30 C23,28 21,28 19,30 C17,33 17,40 14,40 C11,40 11,33 8,26 C4,16 -2,5 6,2 Z"
        fill={fill} stroke={stroke} strokeWidth="2" />
    </g>
  );
};
export const OdontogramMockup: React.FC = () => {
  const states: Array<'ok' | 'existing' | 'planned'> = ['ok', 'ok', 'planned', 'ok', 'existing', 'ok', 'ok', 'planned'];
  return (
    <svg viewBox="0 0 600 450" width="100%" style={{ display: 'block' }} role="img" aria-label="Odontograma interactivo de doble capa">
      <rect width="600" height="450" rx="16" fill="#ffffff" stroke={LINE} />
      <rect x="24" y="22" width="160" height="14" rx="7" fill={INK} opacity="0.8" />
      <rect x="24" y="46" width="240" height="10" rx="5" fill="#cbd5e1" />
      {/* Arcada superior */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Tooth key={`t-${i}`} x={56 + i * 60} y={110} state={states[i]} />
      ))}
      {/* Arcada inferior */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Tooth key={`b-${i}`} x={56 + i * 60} y={230} state={states[(i + 3) % 8]} />
      ))}
      {/* Leyenda */}
      <g transform="translate(56, 340)">
        <rect x="0" y="0" width="14" height="14" rx="4" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="22" y="2" width="70" height="10" rx="5" fill="#94a3b8" />
        <rect x="150" y="0" width="14" height="14" rx="4" fill="color-mix(in srgb, var(--brand-blue) 14%, #fff)" stroke={BLUE} strokeWidth="2" />
        <rect x="172" y="2" width="92" height="10" rx="5" fill={BLUE} opacity="0.8" />
        <rect x="320" y="0" width="14" height="14" rx="4" fill="#fde8e8" stroke="#ef4444" strokeWidth="2" />
        <rect x="342" y="2" width="90" height="10" rx="5" fill="#ef4444" opacity="0.7" />
      </g>
      <rect x="56" y="380" width="488" height="44" rx="10" fill={SOFT} />
      <rect x="74" y="396" width="120" height="12" rx="6" fill={BLUE} opacity="0.85" />
      <rect x="420" y="392" width="106" height="20" rx="10" fill={BLUE} />
    </svg>
  );
};

// === WhatsApp · 4:3 =========================================================
export const WhatsappMockup: React.FC = () => (
  <svg viewBox="0 0 600 450" width="100%" style={{ display: 'block' }} role="img" aria-label="Reserva de turno por WhatsApp con asistente de IA">
    <defs>
      <clipPath id="phoneClip"><rect x="206" y="40" width="188" height="380" rx="28" /></clipPath>
    </defs>
    <rect width="600" height="450" rx="16" fill="color-mix(in srgb, var(--brand-mint) 6%, #fff)" />
    {/* Teléfono */}
    <rect x="200" y="34" width="200" height="392" rx="34" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
    <g clipPath="url(#phoneClip)">
      <rect x="206" y="40" width="188" height="380" fill="#e9f3ee" />
      {/* Barra superior chat */}
      <rect x="206" y="40" width="188" height="46" fill={MINT} />
      <circle cx="230" cy="63" r="13" fill="#ffffff" opacity="0.9" />
      <rect x="252" y="55" width="80" height="9" rx="4.5" fill="#ffffff" />
      <rect x="252" y="69" width="50" height="7" rx="3.5" fill="#ffffff" opacity="0.8" />
      {/* Burbujas */}
      <g>
        <rect x="222" y="104" width="120" height="40" rx="12" fill="#ffffff" />
        <rect x="234" y="116" width="92" height="7" rx="3.5" fill="#94a3b8" />
        <rect x="234" y="129" width="64" height="7" rx="3.5" fill="#cbd5e1" />
      </g>
      <g>
        <rect x="258" y="156" width="118" height="34" rx="12" fill="#d6f5c8" />
        <rect x="270" y="168" width="84" height="7" rx="3.5" fill="#6b9e57" />
      </g>
      {/* Tarjeta de turno ofrecida por IA */}
      <g>
        <rect x="222" y="204" width="150" height="76" rx="12" fill="#ffffff" stroke={LINE} />
        <rect x="234" y="216" width="14" height="14" rx="4" fill={BLUE} opacity="0.2" />
        <rect x="256" y="218" width="90" height="8" rx="4" fill={INK} opacity="0.7" />
        <rect x="234" y="240" width="124" height="7" rx="3.5" fill="#cbd5e1" />
        <rect x="234" y="256" width="80" height="14" rx="7" fill={MINT} />
      </g>
      <g>
        <rect x="262" y="292" width="114" height="30" rx="12" fill="#d6f5c8" />
        <rect x="274" y="303" width="64" height="7" rx="3.5" fill="#6b9e57" />
      </g>
    </g>
    {/* Agenda sincronizada (callout) */}
    <g transform="translate(40, 150)">
      <rect x="0" y="0" width="150" height="150" rx="16" fill="#ffffff" stroke={LINE} />
      <rect x="18" y="18" width="16" height="16" rx="5" fill={BLUE} />
      <rect x="42" y="20" width="80" height="10" rx="5" fill={INK} opacity="0.7" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(18, ${52 + i * 32})`}>
          <rect x="0" y="0" width="114" height="22" rx="7" fill={SOFT} />
          <rect x="0" y="0" width="4" height="22" rx="2" fill={i === 1 ? MINT : BLUE} />
          <rect x="14" y="7" width="60" height="8" rx="4" fill="#94a3b8" />
        </g>
      ))}
    </g>
    {/* Flecha de sincronización */}
    <path d="M196 225 C 210 225, 210 225, 200 225" stroke={MINT} strokeWidth="3" fill="none" />
    <path d="M190 218 L 202 225 L 190 232 Z" fill={MINT} />
  </svg>
);
