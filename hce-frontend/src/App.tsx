import { useState, type CSSProperties } from 'react';
import { PatientForm } from './components/PatientForm';
import { PatientSearch } from './components/PatientSearch';
import { OdontologyHC } from './components/odontology/OdontologyHC';
import { AgendaView } from './components/agenda/AgendaView';
import { SuperAdminPanel } from './components/superadmin/SuperAdminPanel';
import { HomeScreen } from './components/HomeScreen';
import { BrandingSettings } from './components/BrandingSettings';
import { UserManagement } from './components/UserManagement';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useRoles } from './hooks/useRoles';
import { roleDisplayName } from './utils/roles';
import keycloak from './utils/keycloak-config';
import { LogOut, User, Shield, Menu, X } from 'lucide-react';
import { LandingDentaCloud } from './components/landing/LandingDentaCloud';

type AppView = 'home' | 'patients' | 'odonto-hc' | 'agenda' | 'form' | 'settings' | 'users';

function AppContent() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [navOpen, setNavOpen] = useState(false);
  const { config, loading } = useTheme();
  const { roles: clinicalRoles, canConfigure, isSuperAdmin } = useRoles();

  if (!keycloak.authenticated) {
    return <LandingDentaCloud />;
  }

  // El Super Admin opera cross-tenant: tiene su propia experiencia (gestión de clínicas y módulos),
  // separada del shell clínico scoped por tenant.
  if (isSuperAdmin) {
    return <SuperAdminPanel />;
  }

  const username = keycloak.tokenParsed?.preferred_username || 'Profesional Clínico';
  const fullName = `${keycloak.tokenParsed?.given_name || ''} ${keycloak.tokenParsed?.family_name || ''}`.trim() || username;

  const getRoleDisplayName = roleDisplayName;

  const NAV_ITEMS = [
    { key: 'home' as AppView, label: 'Inicio', icon: '🏠' },
    { key: 'odonto-hc' as AppView, label: 'HC Odontológica', icon: '🦷' },
    { key: 'agenda' as AppView, label: 'Agenda', icon: '📅' },
    { key: 'form' as AppView, label: 'Admisión', icon: '➕' },
    ...(canConfigure ? [
      { key: 'users' as AppView, label: 'Personal', icon: '👥' },
      { key: 'settings' as AppView, label: 'Personalización', icon: '🎨' }
    ] : []),
  ];

  const navBtnStyle = (active: boolean): CSSProperties => ({
    background: active ? 'rgba(41, 98, 255, 0.06)' : 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: active ? '#2962ff' : 'var(--color-muted)',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  });

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
      <header className="app-header">
        {/* Logo + Nombre del Consultorio (dinámico) */}
        <div className="app-logo-container">
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

        {/* Navegación central (cinta con degradé + scroll; oculta al colapsar) */}
        <nav className="app-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className="app-nav-btn"
              style={navBtnStyle(activeView === item.key)}
            >
              <span style={{ filter: activeView === item.key ? 'none' : 'grayscale(1)' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Panel del Profesional */}
        <div className="app-user-container">
          <button
            type="button"
            className="app-burger"
            aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(o => !o)}
          >
            {navOpen ? <X style={{ width: '1.2rem', height: '1.2rem' }} /> : <Menu style={{ width: '1.2rem', height: '1.2rem' }} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', flexShrink: 0 }}>
              <User style={{ width: '1rem', height: '1rem' }} />
            </div>
            <div className="user-info-text">
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
            <span className="logout-btn-text">Salir</span>
          </button>
        </div>

        {/* Drawer: menú colapsado en pantallas chicas */}
        {navOpen && (
          <div className="app-drawer">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className="app-nav-btn"
                onClick={() => { setActiveView(item.key); setNavOpen(false); }}
                style={navBtnStyle(activeView === item.key)}
              >
                <span style={{ filter: activeView === item.key ? 'none' : 'grayscale(1)' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Contenedor Principal */}
      <div style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {activeView === 'home' && (
          <HomeScreen onNavigate={(to) => {
            const views: Record<string, AppView> = {
              home: 'home',
              patients: 'patients',
              'odonto-hc': 'odonto-hc',
              agenda: 'agenda',
              form: 'form',
              settings: 'settings',
              users: 'users'
            };
            setActiveView(to === 'dashboard' ? 'home' : (views[to] || 'home'));
          }} />
        )}
        {activeView === 'patients' && <PatientSearch />}
        {activeView === 'odonto-hc' && <OdontologyHC />}
        {activeView === 'agenda' && <AgendaView />}
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
