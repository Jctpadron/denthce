import { useState } from 'react';
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
import { LogOut, User, Shield, Menu, X, Home, CalendarDays, PlusCircle, Users, Palette, ChevronDown } from 'lucide-react';
import { LandingDentaCloud } from './components/landing/LandingDentaCloud';

type AppView = 'home' | 'patients' | 'odonto-hc' | 'agenda' | 'form' | 'settings' | 'users';

/** Ícono de diente (lucide no lo trae) para HC Odontológica. Hereda el color del botón. */
const ToothIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 112" fill="none" aria-hidden="true">
    <path d="M60,30 C66,30 73,28 77.5,33 C82,37.5 83,45 83,52 C83,63 76,74 71,85 C69.5,89 70.5,94 68,96.5 C64.5,98.5 61,93 60,88.5 C59,93 55.5,98.5 52,96.5 C49.5,94 50.5,89 49,85 C44,74 37,63 37,52 C37,45 38,37.5 42.5,33 C47,28 54,30 60,30 Z"
      stroke="currentColor" strokeWidth="7" strokeLinejoin="round" />
  </svg>
);

function AppContent() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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

  // Nav clínico (lo del día a día). Íconos lucide; HC usa el diente de marca.
  const NAV_ITEMS = [
    { key: 'home' as AppView, label: 'Inicio', Icon: Home },
    { key: 'odonto-hc' as AppView, label: 'HC Odontológica', Icon: ToothIcon },
    { key: 'agenda' as AppView, label: 'Agenda', Icon: CalendarDays },
    { key: 'form' as AppView, label: 'Admisión', Icon: PlusCircle },
  ];
  // Ítems de administración: van al menú del usuario (avatar), no al nav principal.
  const ADMIN_ITEMS = canConfigure ? [
    { key: 'users' as AppView, label: 'Personal', Icon: Users },
    { key: 'settings' as AppView, label: 'Personalización', Icon: Palette },
  ] : [];

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
              background: 'linear-gradient(135deg, var(--color-primary, #1e6fd9), color-mix(in srgb, var(--color-primary, #1e6fd9) 55%, #ffffff))',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#ffffff',
              fontSize: '1.1rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {(config.clinicName || 'D').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
              {config.clinicName || 'Denta Cloud'}
            </h1>
            <p style={{ fontSize: '0.68rem', color: 'var(--color-primary, var(--color-cyan))', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: 0 }}>
              {config.specialty || 'Odontología Digital'}
            </p>
          </div>
        </div>

        {/* Navegación central (cinta con degradé + scroll; oculta al colapsar) */}
        <nav className="app-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`app-nav-btn${activeView === item.key ? ' is-active' : ''}`}
            >
              <item.Icon size={18} />
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
          <div className="app-user-desktop">
          <div style={{ position: 'relative', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <button
              type="button"
              onClick={() => { if (ADMIN_ITEMS.length) setUserMenuOpen(o => !o); }}
              aria-haspopup={ADMIN_ITEMS.length ? 'menu' : undefined}
              aria-expanded={ADMIN_ITEMS.length ? userMenuOpen : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem',
                background: userMenuOpen ? 'var(--bg-card)' : 'transparent', border: 'none',
                borderRadius: '10px', padding: '0.3rem 0.4rem',
                cursor: ADMIN_ITEMS.length ? 'pointer' : 'default', transition: 'var(--transition-smooth)',
              }}
            >
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', flexShrink: 0 }}>
                <User style={{ width: '1rem', height: '1rem' }} />
              </div>
              <div className="user-info-text" style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>{fullName}</span>
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem' }}>
                  {clinicalRoles.map(role => (
                    <span key={role} style={{
                      fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                      background: role === 'administrador' ? 'rgba(99,102,241,0.06)' : role === 'medico' ? 'rgba(41,98,255,0.06)' : 'rgba(16,185,129,0.06)',
                      color: role === 'administrador' ? 'var(--color-violet)' : role === 'medico' ? '#2962ff' : 'var(--color-emerald)',
                      border: `1px solid ${role === 'administrador' ? 'rgba(99,102,241,0.15)' : role === 'medico' ? 'rgba(41,98,255,0.15)' : 'rgba(16,185,129,0.15)'}`,
                      padding: '0.05rem 0.35rem', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
                    }}>
                      <Shield style={{ width: '0.55rem', height: '0.55rem' }} />
                      {getRoleDisplayName(role)}
                    </span>
                  ))}
                </div>
              </div>
              {ADMIN_ITEMS.length > 0 && <ChevronDown style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', flexShrink: 0 }} />}
            </button>

            {userMenuOpen && ADMIN_ITEMS.length > 0 && (
              <>
                <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                <div role="menu" style={{
                  position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0, zIndex: 200,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px',
                  boxShadow: 'var(--shadow-card)', padding: '0.4rem', minWidth: '210px',
                  display: 'flex', flexDirection: 'column', gap: '0.15rem',
                }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', padding: '0.4rem 0.6rem 0.2rem' }}>
                    Administración
                  </div>
                  {ADMIN_ITEMS.map(item => (
                    <button
                      key={item.key}
                      role="menuitem"
                      onClick={() => { setActiveView(item.key); setUserMenuOpen(false); }}
                      className={`app-nav-btn${activeView === item.key ? ' is-active' : ''}`}
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      <item.Icon size={18} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
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
        </div>

        {/* Drawer: menú colapsado en pantallas chicas (clínico + administración + salir) */}
        {navOpen && (
          <div className="app-drawer">
            {[...NAV_ITEMS, ...ADMIN_ITEMS].map(item => (
              <button
                key={item.key}
                className={`app-nav-btn${activeView === item.key ? ' is-active' : ''}`}
                onClick={() => { setActiveView(item.key); setNavOpen(false); }}
              >
                <item.Icon size={18} />
                {item.label}
              </button>
            ))}
            <div className="app-drawer__sep" />
            <button className="app-drawer__logout" onClick={() => keycloak.logout()}>
              <LogOut size={18} /> Salir
            </button>
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
