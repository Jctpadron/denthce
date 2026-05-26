import { useState } from 'react';
import { PatientForm } from './components/PatientForm';
import { PatientSearch } from './components/PatientSearch';
import { HomeScreen } from './components/HomeScreen';
import { BrandingSettings } from './components/BrandingSettings';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import keycloak from './utils/keycloak-config';
import { LogOut, User, Shield, Home } from 'lucide-react';

type AppView = 'home' | 'patients' | 'form' | 'settings';

function AppContent() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const { config, loading, isAdmin } = useTheme();

  const username = keycloak.tokenParsed?.preferred_username || 'Profesional Clínico';
  const fullName = `${keycloak.tokenParsed?.given_name || ''} ${keycloak.tokenParsed?.family_name || ''}`.trim() || username;

  const roles: string[] = keycloak.tokenParsed?.realm_access?.roles || [];
  const clinicalRoles = roles.filter(role =>
    ['medico', 'enfermero', 'recepcionista', 'administrador', 'paciente'].includes(role)
  );

  const getRoleDisplayName = (role: string) => {
    switch (role.toLowerCase()) {
      case 'medico': return 'Médico';
      case 'enfermero': return 'Enfermero/a';
      case 'recepcionista': return 'Recepcionista';
      case 'administrador': return 'Administrador';
      case 'paciente': return 'Paciente';
      default: return role;
    }
  };

  const NAV_ITEMS = [
    { key: 'home' as AppView, label: 'Inicio', icon: '🏠' },
    { key: 'patients' as AppView, label: 'Historia Clínica', icon: '🏥' },
    { key: 'form' as AppView, label: 'Admisión', icon: '➕' },
    ...(isAdmin ? [{ key: 'settings' as AppView, label: 'Personalización', icon: '🎨' }] : []),
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🦷</div>
          <p>Cargando configuración del consultorio...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-base)',
      color: 'var(--color-text)',
      fontFamily: 'var(--font-title), system-ui, -apple-system, sans-serif',
      padding: '0 0 3rem 0',
      transition: 'var(--transition-smooth)',
    }}>

      {/* Cabecera Principal */}
      <header style={{
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}>
        {/* Logo + Nombre del Consultorio (dinámico) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo"
              style={{ height: '2.2rem', width: '2.2rem', objectFit: 'contain', borderRadius: '6px' }}
            />
          ) : (
            <div style={{
              width: '2.2rem',
              height: '2.2rem',
              background: `linear-gradient(135deg, ${config.primaryColor || 'var(--color-cyan)'}, #10b981)`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#ffffff',
              fontSize: '1.1rem',
              boxShadow: `0 2px 10px ${config.primaryColor || 'var(--color-cyan)'}33`,
            }}>
              {(config.clinicName || 'D').charAt(0)}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
              {config.clinicName || 'DentHCE Portal Clínico'}
            </h1>
            <p style={{ fontSize: '0.68rem', color: config.primaryColor || 'var(--color-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>
              {config.specialty || 'Sistema Clínico FHIR R4'}
            </p>
          </div>
        </div>

        {/* Navegación central */}
        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              style={{
                background: activeView === item.key ? `${config.primaryColor || '#0284c7'}12` : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: activeView === item.key ? (config.primaryColor || 'var(--color-cyan)') : 'var(--color-muted)',
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: activeView === item.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Panel del Profesional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>
              <User style={{ width: '1rem', height: '1rem' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{fullName}</span>
              <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.1rem' }}>
                {clinicalRoles.map(role => (
                  <span key={role} style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: role === 'administrador' ? 'rgba(124,58,237,0.08)' : role === 'medico' ? `${config.primaryColor || '#0284c7'}12` : 'rgba(16,185,129,0.08)',
                    color: role === 'administrador' ? '#7c3aed' : role === 'medico' ? (config.primaryColor || 'var(--color-cyan)') : '#10b981',
                    border: `1px solid ${role === 'administrador' ? 'rgba(124,58,237,0.2)' : role === 'medico' ? `${config.primaryColor || '#0284c7'}25` : 'rgba(16,185,129,0.2)'}`,
                    padding: '0.05rem 0.3rem',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.15rem',
                  }}>
                    <Shield style={{ width: '0.55rem', height: '0.55rem' }} />
                    {getRoleDisplayName(role)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => keycloak.logout()}
            style={{
              background: 'transparent',
              border: '1px solid rgba(225,29,72,0.2)',
              color: 'var(--color-rose)',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(225,29,72,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut style={{ width: '0.9rem', height: '0.9rem' }} />
            Salir
          </button>
        </div>
      </header>

      {/* Contenedor Principal */}
      <div style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {activeView === 'home' && (
          <HomeScreen onNavigate={(to) => setActiveView(to === 'dashboard' ? 'home' : to)} />
        )}
        {activeView === 'patients' && <PatientSearch />}
        {activeView === 'form' && <PatientForm onSuccess={() => setActiveView('patients')} />}
        {activeView === 'settings' && isAdmin && <BrandingSettings onClose={() => setActiveView('home')} />}
        {activeView === 'settings' && !isAdmin && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
            🔒 Solo el Administrador puede acceder a la Personalización.
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
