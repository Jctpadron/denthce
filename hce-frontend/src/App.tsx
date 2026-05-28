import { useState } from 'react';
import { PatientForm } from './components/PatientForm';
import { PatientSearch } from './components/PatientSearch';
import { HomeScreen } from './components/HomeScreen';
import { BrandingSettings } from './components/BrandingSettings';
import { UserManagement } from './components/UserManagement';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import keycloak from './utils/keycloak-config';
import { LogOut, User, Shield } from 'lucide-react';
import { LandingLogin } from './components/LandingLogin';

type AppView = 'home' | 'patients' | 'form' | 'settings' | 'users';

function AppContent() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const { config, loading, canConfigure } = useTheme();

  if (!keycloak.authenticated) {
    return <LandingLogin />;
  }

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
    ...(canConfigure ? [
      { key: 'users' as AppView, label: 'Personal', icon: '👥' },
      { key: 'settings' as AppView, label: 'Personalización', icon: '🎨' }
    ] : []),
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
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.02)',
      }}>
        {/* Logo + Nombre del Consultorio (dinámico) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo"
              style={{ height: '2.2rem', width: '2.2rem', objectFit: 'contain', borderRadius: '8px' }}
            />
          ) : (
            <div style={{
              width: '2.2rem',
              height: '2.2rem',
              background: 'linear-gradient(135deg, #2962ff, #00d2ff)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#ffffff',
              fontSize: '1.1rem',
              boxShadow: '0 2px 10px rgba(41, 98, 255, 0.2)',
            }}>
              {(config.clinicName || 'D').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
              {config.clinicName || 'DentHCE Portal Clínico'}
            </h1>
            <p style={{ fontSize: '0.68rem', color: '#2962ff', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: 0 }}>
              {config.specialty || 'Sistema Clínico FHIR R4'}
            </p>
          </div>
        </div>

        {/* Navegación central */}
        <nav style={{ display: 'flex', gap: '0.35rem' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              style={{
                background: activeView === item.key ? 'rgba(41, 98, 255, 0.06)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                color: activeView === item.key ? '#2962ff' : 'var(--color-muted)',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: activeView === item.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span style={{ filter: activeView === item.key ? 'none' : 'grayscale(1)' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Panel del Profesional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>
              <User style={{ width: '1rem', height: '1rem' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{fullName}</span>
              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem' }}>
                {clinicalRoles.map(role => (
                  <span key={role} style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: role === 'administrador' ? 'rgba(99,102,241,0.06)' : role === 'medico' ? 'rgba(41,98,255,0.06)' : 'rgba(16,185,129,0.06)',
                    color: role === 'administrador' ? 'var(--color-violet)' : role === 'medico' ? '#2962ff' : 'var(--color-emerald)',
                    border: `1px solid ${role === 'administrador' ? 'rgba(99,102,241,0.15)' : role === 'medico' ? 'rgba(41,98,255,0.15)' : 'rgba(16,185,129,0.15)'}`,
                    padding: '0.05rem 0.35rem',
                    borderRadius: '5px',
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
              border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--color-rose)',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'var(--transition-smooth)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.05)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
            }}
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
        {activeView === 'users' && canConfigure && <UserManagement />}
        {activeView === 'users' && !canConfigure && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
            🔒 Solo el Administrador o los Médicos pueden acceder a la Gestión de Personal.
          </div>
        )}
        {activeView === 'settings' && canConfigure && <BrandingSettings onClose={() => setActiveView('home')} />}
        {activeView === 'settings' && !canConfigure && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
            🔒 Solo el Administrador o los Médicos pueden acceder a la Personalización.
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
