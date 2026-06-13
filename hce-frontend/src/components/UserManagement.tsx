import React, { useState, useEffect } from 'react';
import axios from 'axios';
import keycloak from '../utils/keycloak-config';
import { UserPlus, UserCheck, Shield, Mail, Key, Search, ShieldCheck } from 'lucide-react';

interface StaffUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  role: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'recepcionista' | 'enfermero'>('recepcionista');
  
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(import.meta.env.VITE_API_URL + '/api/tenant/users', {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post(
        import.meta.env.VITE_API_URL + '/api/tenant/users',
        { username, email, firstName, lastName, role },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      
      setSuccessMsg(`¡Usuario ${res.data.username} creado con éxito! Contraseña por defecto: ${res.data.defaultPassword}`);
      
      // Reset form
      setUsername('');
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('recepcionista');
      
      // Refresh list
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al crear el usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const search = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.firstName.toLowerCase().includes(search) ||
      u.lastName.toLowerCase().includes(search)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease' }}>
      
      {/* Header */}
      <div className="module-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
            👥 Gestión de Personal del Consultorio
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            Registrá y administrá secretarias o enfermeros para que colaboren en tu consultorio clínico.
          </p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setSuccessMsg('');
            setErrorMsg('');
          }}
          className="module-header-btn"
          style={{
            background: 'var(--color-cyan)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.6rem 1.2rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <UserPlus style={{ width: '1rem', height: '1rem' }} />
          Agregar Personal
        </button>
      </div>

      {/* Controles de búsqueda */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <Search style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-muted)' }} />
        <input
          type="text"
          placeholder="Buscar personal por nombre, usuario o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: '0.9rem',
            color: 'var(--color-text)',
            width: '100%',
          }}
        />
      </div>

      {/* Tabla de Usuarios */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            Cargando personal...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            No se encontró personal registrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-muted)' }}>Usuario</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-muted)' }}>Nombre Completo</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-muted)' }}>Email</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-muted)' }}>Rol</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-muted)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{u.username}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>{u.lastName}, {u.firstName}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--color-muted)' }}>{u.email}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: u.role === 'recepcionista' ? 'rgba(2,132,199,0.08)' : 'rgba(16,185,129,0.08)',
                        color: u.role === 'recepcionista' ? 'var(--color-cyan)' : '#10b981',
                        border: `1px solid ${u.role === 'recepcionista' ? 'rgba(2,132,199,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}>
                        <Shield style={{ width: '0.7rem', height: '0.7rem' }} />
                        {u.role === 'recepcionista' ? 'Secretaria' : u.role === 'enfermero' ? 'Enfermero/a' : u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: u.enabled ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                        color: u.enabled ? '#10b981' : '#f43f5e',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}>
                        <UserCheck style={{ width: '0.7rem', height: '0.7rem' }} />
                        {u.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Agregar Personal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: 'clamp(1rem, 5vw, 2rem)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            animation: 'scaleIn 0.15s ease-out',
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Agregar Personal de Ayuda</h3>
            
            {successMsg ? (
              <div style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                color: '#10b981',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                  <ShieldCheck style={{ width: '1.1rem', height: '1.1rem' }} />
                  Usuario Registrado
                </div>
                <p style={{ margin: 0 }}>{successMsg}</p>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSuccessMsg('');
                  }}
                  style={{
                    background: 'var(--color-cyan)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                    alignSelf: 'flex-start',
                  }}
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {errorMsg && (
                  <div style={{
                    background: 'rgba(244,63,94,0.08)',
                    border: '1px solid rgba(244,63,94,0.2)',
                    color: '#f43f5e',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                  }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Nombre</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Ana"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Apellido</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Pérez"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      style={{
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Nombre de Usuario (Login)</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: ana_recepcion"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    style={{
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Email</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail style={{ position: 'absolute', left: '0.65rem', width: '0.9rem', height: '0.9rem', color: 'var(--color-muted)' }} />
                    <input
                      required
                      type="email"
                      placeholder="ana@consultorio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        padding: '0.55rem 0.75rem 0.55rem 2rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Rol Asignado</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    style={{
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      background: '#fff',
                    }}
                  >
                    <option value="recepcionista">Secretaria / Recepcionista</option>
                    <option value="enfermero">Enfermero/a</option>
                  </select>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: 'var(--color-muted)',
                }}>
                  <Key style={{ width: '1rem', height: '1rem', color: 'var(--color-cyan)', marginTop: '0.1rem', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>Contraseña inicial generada:</span>
                    La clave inicial será <code>{username ? `${username}_pass_2026` : '[usuario]_pass_2026'}</code>. El usuario podrá cambiarla al iniciar.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.5rem 1.2rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--color-muted)',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: 'var(--color-cyan)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: submitting ? 'wait' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
