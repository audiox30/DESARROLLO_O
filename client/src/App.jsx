import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import ColaboradorPortal from './pages/ColaboradorPortal';
import LiderPortal from './pages/LiderPortal';
import LiderMiEquipoPage from './pages/LiderMiEquipoPage';
import AdminDOPanel from './pages/AdminDOPanel';
import SistemasAuditPanel from './pages/SistemasAuditPanel';
import AdminColaboradoresPage from './pages/AdminColaboradoresPage';
import AdminDORolesPage from './pages/AdminDORolesPage';
import ReportesAnaliticaPage from './pages/ReportesAnaliticaPage';
import ModalCambiarPassword from './components/ModalCambiarPassword';
import SimulateBanner from './components/SimulateBanner';
import { api, setAuthToken, clearAuth, setSimulationHeaders, setActiveSimulation } from './api/client';
import logoJama from './assets/logo-jama.png';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados para simulación de roles (Exclusivo SuperAdmin / SISTEMAS)
  const [activeRoleView, setActiveRoleView] = useState('COLABORADOR');
  const [simulatedColaborador, setSimulatedColaborador] = useState(null);

  // Pestaña activa ('colaborador', 'lider', 'admin', 'sistemas')
  const [activeTab, setActiveTab] = useState('colaborador');

  // Modal de cambio de contraseña estándar
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    verificarSesion();
  }, []);

  async function verificarSesion() {
    try {
      setLoading(true);
      const token = localStorage.getItem('jama_vacaciones_token');
      const savedUserStr = localStorage.getItem('jama_vacaciones_user');

      if (!token) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }

      // Validar token con el backend
      try {
        const res = await api.getMe();
        if (res.success && res.user) {
          const userObj = res.user;
          setCurrentUser(userObj);
          setIsAuthenticated(true);
          const rol = userObj.rolApp || userObj.rol || 'COLABORADOR';
          setActiveRoleView(rol);
          inicializarTabSegunRol(rol);
          return;
        }
      } catch (err) {
        console.warn('Token guardado no válido o expirado:', err);
      }

      // Si falla la verificación del token, limpiar y requerir login
      clearAuth();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (err) {
      console.error('Error verificando sesión:', err);
      clearAuth();
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  function inicializarTabSegunRol(rol) {
    if (rol === 'SUPERADMIN' || rol === 'SISTEMAS') {
      setActiveTab('sistemas');
    } else if (rol === 'ADMIN_DO') {
      setActiveTab('admin');
    } else if (rol === 'LIDER') {
      setActiveTab('lider');
    } else {
      setActiveTab('colaborador');
    }
  }

  function handleLoginSuccess(userObj) {
    setCurrentUser(userObj);
    setIsAuthenticated(true);
    const rol = userObj.rolApp || userObj.rol || 'COLABORADOR';
    setActiveRoleView(rol);
    setSimulatedColaborador(null);
    setSimulationHeaders({});
    inicializarTabSegunRol(rol);
  }

  function handleLogout() {
    clearAuth();
    setActiveSimulation(null, null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveRoleView('COLABORADOR');
    setSimulatedColaborador(null);
    setSimulationHeaders({});
  }

  // Manejo de cambio de rol simulado (Role Impersonator de SuperAdmin)
  function handleRoleViewChange(newRole, sampleColab = null) {
    setActiveRoleView(newRole);

    // Mapeo estricto de pestañas permitidas por cada rol
    const validTabsByRole = {
      'COLABORADOR': ['colaborador'],
      'LIDER': ['colaborador', 'lider', 'mi-equipo'],
      'ADMIN_DO': ['colaborador', 'admin', 'colaboradores', 'reportes'],
      'SISTEMAS': ['colaborador', 'lider', 'mi-equipo', 'admin', 'colaboradores', 'admin-do', 'reportes', 'sistemas'],
      'SUPERADMIN': ['colaborador', 'lider', 'mi-equipo', 'admin', 'colaboradores', 'admin-do', 'reportes', 'sistemas']
    };

    const allowed = validTabsByRole[newRole] || ['colaborador'];
    if (!allowed.includes(activeTab)) {
      if (newRole === 'COLABORADOR') setActiveTab('colaborador');
      else if (newRole === 'LIDER') setActiveTab('lider');
      else if (newRole === 'ADMIN_DO') setActiveTab('admin');
      else setActiveTab('sistemas');
    }

    if (newRole === 'SISTEMAS' || newRole === 'SUPERADMIN') {
      setSimulatedColaborador(null);
      setActiveSimulation('SISTEMAS', null);
      setSimulationHeaders({});
    } else if (newRole === 'ADMIN_DO') {
      const adminColab = sampleColab || {
        idColaborador: 383,
        id: 383,
        codigoEmpleado: 'CONT-906',
        nombreCompleto: 'TANIA DEL CARMEN HURTADO AVALOS',
        empresa: 'CONTROLADORA JAMA, S.C.',
        rolApp: 'ADMIN_DO',
        rol: 'ADMIN_DO'
      };
      setSimulatedColaborador(adminColab);
      setActiveSimulation('ADMIN_DO', adminColab.idColaborador);
    } else if (newRole === 'LIDER') {
      const leader = sampleColab || {
        idColaborador: 46,
        id: 46,
        codigoEmpleado: 'LAT-155',
        nombreCompleto: 'ULISES ANTONIO GARCES RODRIGUEZ',
        empresa: 'LATINO CONCRETOS, S.A. DE C.V.',
        rolApp: 'LIDER',
        rol: 'LIDER'
      };
      setSimulatedColaborador(leader);
      setActiveSimulation('LIDER', leader.idColaborador);
    } else if (newRole === 'COLABORADOR') {
      const colab = sampleColab || {
        idColaborador: 594,
        id: 594,
        codigoEmpleado: 'LAT-1077',
        nombreCompleto: 'GONZALO RAMIREZ GALLARDO',
        empresa: 'LATINO CONCRETOS, S.A. DE C.V.',
        rolApp: 'COLABORADOR',
        rol: 'COLABORADOR'
      };
      setSimulatedColaborador(colab);
      setActiveSimulation('COLABORADOR', colab.idColaborador);
    }
  }

  function handleResetSimulation() {
    handleRoleViewChange('SISTEMAS');
  }

  // Pantalla de Carga Inicial
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl mb-5 flex items-center justify-center animate-pulse">
          <img
            src={logoJama}
            alt="Grupo JAMA"
            className="h-9 w-auto object-contain select-none"
            style={{ aspectRatio: '192 / 48' }}
          />
        </div>
        <p className="text-sm font-bold tracking-wider text-slate-200">INICIALIZANDO SISTEMA DE VACACIONES</p>
        <p className="text-xs text-slate-400 mt-1">Cargando catálogos de Grupo JAMA...</p>
      </div>
    );
  }

  // Si no está autenticado, renderizar obligatoriamente la pantalla de Login
  if (!isAuthenticated || !currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Usuario efectivo para las vistas hijas (si simula, hereda datos del rol o colaborador simulado)
  const isSimulating = Boolean(
    (currentUser?.rolApp === 'SUPERADMIN' || currentUser?.rolApp === 'SISTEMAS' || currentUser?.rol === 'SUPERADMIN' || currentUser?.rol === 'SISTEMAS' || currentUser?.username === 'sistemas') &&
    activeRoleView !== 'SUPERADMIN' &&
    activeRoleView !== 'SISTEMAS'
  );

  const effectiveUser = isSimulating
    ? {
        ...currentUser,
        rolApp: activeRoleView,
        rol: activeRoleView,
        ...(simulatedColaborador || {})
      }
    : currentUser;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Banner de Modo Simulación Activo */}
      <SimulateBanner
        isSimulating={isSimulating}
        simulatedRole={activeRoleView}
        simulatedColabName={simulatedColaborador?.nombreCompleto}
        onResetSimulation={handleResetSimulation}
      />

      {/* Navegación Superior */}
      <Navbar
        currentUser={effectiveUser}
        realUser={currentUser}
        activeRoleView={activeRoleView}
        onRoleViewChange={handleRoleViewChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onChangePassword={() => setIsPasswordModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Contenido Principal Condicionado por Rol y Pestaña */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'colaborador' && (
          <ColaboradorPortal currentUser={effectiveUser} />
        )}

        {activeTab === 'lider' && (
          <LiderPortal currentUser={effectiveUser} />
        )}

        {activeTab === 'mi-equipo' && (
          <LiderMiEquipoPage currentUser={effectiveUser} />
        )}

        {activeTab === 'admin' && (
          <AdminDOPanel currentUser={effectiveUser} />
        )}

        {activeTab === 'colaboradores' && (
          <AdminColaboradoresPage />
        )}

        {activeTab === 'admin-do' && (
          <AdminDORolesPage currentUser={effectiveUser} />
        )}

        {activeTab === 'reportes' && (
          <ReportesAnaliticaPage currentUser={effectiveUser} />
        )}

        {activeTab === 'sistemas' && (
          <SistemasAuditPanel currentUser={currentUser} />
        )}

      </main>

      {/* Footer Corporativo Oficial */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">GRUPO JAMA</span>
            <span>•</span>
            <span>Desarrollo Organizacional</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              LFT Vacaciones Dignas 2023+
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Microsoft SQL Server (DESARROLLO_O)</span>
            <span>•</span>
            <span>CONTPAQi Nóminas Sync</span>
            <span>•</span>
            <span>Red Local On-Premise</span>
          </div>
        </div>
      </footer>

      {/* Modal de Cambio de Contraseña */}
      <ModalCambiarPassword
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

    </div>
  );
}
