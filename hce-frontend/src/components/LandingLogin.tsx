import React, { useState, useEffect } from 'react';
import keycloak from '../utils/keycloak-config';
import { Cpu, ShieldCheck, Cloud, Monitor, MapPin, Globe } from 'lucide-react';

export const LandingLogin: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 968);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = () => {
    keycloak.login();
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: "'Inter', sans-serif",
      color: '#030f26',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
    }}>
      {/* Hero Section de alto completo con imagen de fondo y cabecera flotante */}
      <section style={{
        flex: 1,
        position: 'relative',
        backgroundImage: "url('/img/landing_dental_clinical.png')",
        backgroundSize: 'cover',
        backgroundPosition: isMobile ? '70% center' : 'right center',
        backgroundRepeat: 'no-repeat',
        minHeight: isMobile ? 'auto' : '680px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Capa de Degradado Blanco para legibilidad del texto en la izquierda */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isMobile 
            ? 'linear-gradient(to right, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)' 
            : 'linear-gradient(to right, rgba(255, 255, 255, 1) 45%, rgba(255, 255, 255, 0.85) 60%, rgba(255, 255, 255, 0) 90%)',
          zIndex: 1,
        }} />

        {/* 1. Cabecera Flotante (Dentro de la sección, sobre la imagen de fondo) */}
        <header style={{
          padding: isMobile ? '1rem 1rem' : '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
          position: 'relative',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1200px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {/* Logo Denta Cloud */}
            <div 
              onClick={handleLogin}
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
            >
              {/* SVG Vectorial Impecable sin pixelación */}
              <svg viewBox="0 0 120 120" style={{ width: '2.8rem', height: '2.8rem' }}>
                <path 
                  d="M85,65 C95,65 103,57 103,47 C103,37 95,29 85,29 C84.5,29 84,29 83.5,29.1 C80,18 70,10 58,10 C46.5,10 36.8,17.5 33,28 C32,27.9 31,27.9 30,27.9 C18,27.9 8,37.9 8,49.9 C8,61.9 18,71.9 30,71.9 L85,71.9 C85,71.9 85,65 85,65 Z" 
                  fill="#d2e8df" 
                  opacity="0.95"
                />
                <path 
                  d="M60,25 C67,25 76,22 81.5,28 C87,33.5 88,43 88,51 C88,64 79,77 74,90 C72,95 73,101 70,104 C66,106 62,100 60,95 C58,100 54,106 50,104 C47,101 48,95 46,90 C41,77 32,64 32,51 C32,43 33,33.5 38.5,28 C44,22 53,25 60,25 Z" 
                  fill="#1e6fd9" 
                  stroke="#ffffff" 
                  strokeWidth="3.5" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M50,33 C55,33 56,31 60,31 C64,31 65,33 70,33" 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                />
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{
                  fontSize: '1.45rem',
                  fontWeight: 900,
                  color: '#030f26',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                }}>
                  Denta Cloud
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#030f26',
                  opacity: 0.8,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Odontología Digital
                </span>
              </div>
            </div>

            {/* Botón Iniciar Sesión */}
            <div>
              <button
                onClick={handleLogin}
                style={{
                  backgroundColor: '#030f26',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.65rem 1.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  letterSpacing: '0.03em',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0b1936'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#030f26'}
              >
                INICIAR SESIÓN
              </button>
            </div>
          </div>
        </header>

        {/* Contenido del Hero (Abajo de la cabecera flotante) */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '2rem 1rem 4rem 1rem' : '1rem 2rem 4rem 2rem',
          zIndex: 2,
          position: 'relative',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1200px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
            alignItems: 'center',
          }}>
          {/* Contenido de Texto e Interacción */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
            textAlign: 'left',
            maxWidth: '540px',
          }}
          className="animate-fade-in-up"
          >
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '2.1rem' : '2.9rem',
              fontWeight: 900,
              color: '#030f26',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
            }}>
              DIGITALIZÁ TU CLÍNICA ODONTOLÓGICA <span style={{ fontWeight: 400, display: 'block', fontSize: isMobile ? '1.8rem' : '2.4rem', marginTop: '0.25rem' }}>con tecnología avanzada y la máxima seguridad.</span>
            </h1>

            <p style={{
              margin: '0.5rem 0 0 0',
              fontSize: '1.05rem',
              color: '#334155',
              lineHeight: 1.45,
              fontWeight: 500,
            }}>
              *La plataforma líder para optimizar diagnósticos, gestión de pacientes y la productividad de tu consultorio con IA.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              marginTop: '1.5rem',
            }}>
              <button
                onClick={handleLogin}
                style={{
                  backgroundColor: '#1e6fd9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.85rem 1.8rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 111, 217, 0.2)',
                  transition: 'background-color 0.2s, transform 0.1s',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#155bb5'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1e6fd9'}
              >
                SOLICITAR DEMO GRATUITA
              </button>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleLogin(); }}
                style={{
                  color: '#030f26',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Más información
              </a>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 3. Sección Inferior - Fila de 6 Iconos DentaliQ */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '2.5rem 1rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1200px',
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
          gap: isMobile ? '2rem 1rem' : '2.5rem',
          alignItems: 'start',
        }}>
          {/* Icono 1: AI */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <Cpu style={{ width: '2.2rem', height: '2.2rem', color: '#030f26', strokeWidth: 1.5 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#030f26' }}>AI</span>
          </div>

          {/* Icono 2: Seguridad */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <ShieldCheck style={{ width: '2.2rem', height: '2.2rem', color: '#030f26', strokeWidth: 1.5 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#030f26' }}>Seguridad</span>
          </div>

          {/* Icono 3: Cloud */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <Cloud style={{ width: '2.2rem', height: '2.2rem', color: '#030f26', strokeWidth: 1.5 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#030f26' }}>Cloud</span>
          </div>

          {/* Icono 4: Inter */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <Monitor style={{ width: '2.2rem', height: '2.2rem', color: '#030f26', strokeWidth: 1.5 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#030f26' }}>Inter</span>
          </div>

          {/* Icono 5: Funciones */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <MapPin style={{ width: '2.2rem', height: '2.2rem', color: '#030f26', strokeWidth: 1.5 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#030f26' }}>Funciones</span>
          </div>

          {/* Icono 6: Soporte */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <Globe style={{ width: '2.2rem', height: '2.2rem', color: '#030f26', strokeWidth: 1.5 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#030f26' }}>Soporte</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
