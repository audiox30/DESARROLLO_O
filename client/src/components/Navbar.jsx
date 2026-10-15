import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, Users, UserCheck, ShieldCheck, CalendarCheck, 
  ChevronDown, Sparkles, Eye, LogOut, KeyRound, Check, 
  Terminal, FileSpreadsheet, UserPlus, Menu, X, Settings
} from 'lucide-react';
import logoJama from '../assets/logo-jama.png';
import { formatearNombreColaborador, obtenerInicialesColaborador } from '../utils/formatters';

export default function Navbar({ 
  currentUser, 
  realUser,
  activeRoleView, 
  onRoleViewChange, 
  activeTab, 
  onTabChange,
  onChangePassword,
  onLogout 
}) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showEquipoDropdown, setShowEquipoDropdown] = useState(false);
  const [showGestionDropdown, setShowGestionDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const roleDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const equipoDropdownRef = useRef(null);
  const gestionDropdownRef = useRef(null);

  function cerrarTodosDropdowns() {
    setShowRoleDropdown(false);
    setShowUserDropdown(false);
    setShowEquipoDropdown(false);
    setShowGestionDropdown(false);
  }

  // Cerrar dropdowns si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setShowRoleDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
      if (equipoDropdownRef.current && !equipoDropdownRef.current.contains(e.target)) {
        setShowEquipoDropdown(false);
      }
      if (gestionDropdownRef.current && !gestionDropdownRef.current.contains(e.target)) {
        setShowGestionDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isRealSuperAdmin = Boolean(
    realUser?.rolApp === 'SUPERADMIN' || realUser?.rolApp === 'SISTEMAS' ||
    realUser?.rol === 'SUPERADMIN' || realUser?.rol === 'SISTEMAS' ||
    realUser?.username === 'sistemas' ||
    currentUser?.rolApp === 'SUPERADMIN' || currentUser?.rolApp === 'SISTEMAS' ||
    currentUser?.rol === 'SUPERADMIN' || currentUser?.rol === 'SISTEMAS' ||
    currentUser?.username === 'sistemas'
  );

  const rolEfectivo = activeRoleView || currentUser?.rolApp || 'COLABORADOR';

  const esColaborador = rolEfectivo === 'COLABORADOR';
  const esLider = rolEfectivo === 'LIDER';
  const esAdminDO = rolEfectivo === 'ADMIN_DO';
  const esSistemas = rolEfectivo === 'SISTEMAS' || rolEfectivo === 'SUPERADMIN';

  // Reglas de renderizado condicional por rol:
  // - COLABORADOR: Solo ve [Mi Portal]
  // - LIDER: Solo ve [Mi Portal] y [Equipo ▾]
  // - ADMIN_DO: Ve [Mi Portal], [Gestión DO ▾] y [Reportes]
  // - SISTEMAS: Ve todos los menús de forma compacta (o según el rol simulado en "Vista Actual")
  const mostrarEquipo = esLider || esSistemas;
  const mostrarGestionDO = esAdminDO || esSistemas;
  const mostrarReportes = esAdminDO || esSistemas;

  const roleBadgeColor = {
    'COLABORADOR': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'LIDER': 'bg-amber-100 text-amber-800 border-amber-300',
    'ADMIN_DO': 'bg-blue-100 text-blue-800 border-blue-300',
    'SISTEMAS': 'bg-purple-100 text-purple-800 border-purple-300',
    'SUPERADMIN': 'bg-purple-100 text-purple-800 border-purple-300'
  }[rolEfectivo];

  const roleLabel = {
    'COLABORADOR': 'Colaborador',
    'LIDER': 'Líder / Jefe',
    'ADMIN_DO': 'Desarrollo Org.',
    'SISTEMAS': 'Sistemas (TI)',
    'SUPERADMIN': 'Sistemas (TI)'
  }[rolEfectivo];

  const esEquipoActivo = activeTab === 'lider' || activeTab === 'mi-equipo';
  const esGestionDOActivo = activeTab === 'admin' || activeTab === 'colaboradores' || activeTab === 'admin-do' || activeTab === 'sistemas' || activeTab === 'configuracion';

  const currentRoleConfig = {
    'SISTEMAS': { icon: '🛠️', label: 'Sistemas (TI)' },
    'SUPERADMIN': { icon: '🛠️', label: 'Sistemas (TI)' },
    'ADMIN_DO': { icon: '🏢', label: 'ADMIN_DO' },
    'LIDER': { icon: '👔', label: 'Líder / Jefe' },
    'COLABORADOR': { icon: '👤', label: 'Colaborador' }
  }[activeRoleView || 'SISTEMAS'] || { icon: '🛠️', label: 'Sistemas (TI)' };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* 1. SECCIÓN IZQUIERDA: Logotipo Oficial Grupo JAMA con mr-6 adecuado */}
          <div className="flex items-center mr-6 shrink-0">
            <div className="flex items-center gap-3">
              <img
                src={logoJama}
                alt="Grupo JAMA"
                className="h-8 w-auto object-contain select-none"
                style={{ aspectRatio: '192 / 48' }}
              />
              <div className="hidden lg:block border-l border-slate-200 pl-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-600 border border-slate-200 uppercase">
                  DO • LAN
                </span>
                <p className="text-[11px] text-slate-500 font-medium leading-tight">Control de Vacaciones</p>
              </div>
            </div>
          </div>

          {/* 2. SECCIÓN CENTRAL: Enlaces y Dropdowns de Navegación Compactos (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5 flex-1 justify-start">
            
            {/* [Mi Portal] -> Enlace directo a /portal */}
            <button
              onClick={() => {
                onTabChange('colaborador');
                cerrarTodosDropdowns();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'colaborador'
                  ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs border border-blue-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <CalendarCheck className={`w-4 h-4 ${activeTab === 'colaborador' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>Mi Portal</span>
            </button>

            {/* [Equipo ▾] -> Dropdown para LIDER y SISTEMAS */}
            {mostrarEquipo && (
              <div className="relative" ref={equipoDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEquipoDropdown(!showEquipoDropdown);
                    setShowGestionDropdown(false);
                    setShowRoleDropdown(false);
                    setShowUserDropdown(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    esEquipoActivo
                      ? 'bg-amber-50 text-amber-900 font-bold shadow-2xs border border-amber-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Users className={`w-4 h-4 ${esEquipoActivo ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span>Equipo</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showEquipoDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showEquipoDropdown && (
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Módulo de Liderazgo y Equipo
                    </div>
                    
                    {/* Opción: Bandeja de Aprobaciones (/lider/aprobaciones) */}
                    <button
                      onClick={() => {
                        onTabChange('lider');
                        setShowEquipoDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                        activeTab === 'lider' ? 'bg-amber-50/70 text-amber-950 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Bandeja de Aprobaciones</div>
                          <div className="text-[11px] text-slate-400">Solicitudes pendientes por autorizar</div>
                        </div>
                      </div>
                      {activeTab === 'lider' && <Check className="w-4 h-4 text-amber-600" />}
                    </button>

                    {/* Opción: Catálogo de Mi Equipo (/lider/mi-equipo) */}
                    <button
                      onClick={() => {
                        onTabChange('mi-equipo');
                        setShowEquipoDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                        activeTab === 'mi-equipo' ? 'bg-amber-50/70 text-amber-950 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Catálogo de Mi Equipo</div>
                          <div className="text-[11px] text-slate-400">Colaboradores a cargo y saldos</div>
                        </div>
                      </div>
                      {activeTab === 'mi-equipo' && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* [Gestión DO ▾] -> Dropdown para ADMIN_DO y SISTEMAS */}
            {mostrarGestionDO && (
              <div className="relative" ref={gestionDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowGestionDropdown(!showGestionDropdown);
                    setShowEquipoDropdown(false);
                    setShowRoleDropdown(false);
                    setShowUserDropdown(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    esGestionDOActivo
                      ? 'bg-blue-50 text-blue-800 font-bold shadow-2xs border border-blue-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${esGestionDOActivo ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Gestión DO</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showGestionDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showGestionDropdown && (
                  <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Desarrollo Organizacional y Administración
                    </div>
                    
                    {/* Opción 1: Gestión Global de Vacaciones (/admin/gestion-vacaciones) */}
                    <button
                      onClick={() => {
                        onTabChange('admin');
                        setShowGestionDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                        activeTab === 'admin' ? 'bg-blue-50/70 text-blue-950 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Gestión Global de Vacaciones</div>
                          <div className="text-[11px] text-slate-400">Bandeja general, VoBo DO y períodos</div>
                        </div>
                      </div>
                      {activeTab === 'admin' && <Check className="w-4 h-4 text-blue-600" />}
                    </button>

                    {/* Opción 2: Catálogo General de Colaboradores (/admin/colaboradores) */}
                    <button
                      onClick={() => {
                        onTabChange('colaboradores');
                        setShowGestionDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                        activeTab === 'colaboradores' ? 'bg-indigo-50/70 text-indigo-950 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Catálogo General de Colaboradores</div>
                          <div className="text-[11px] text-slate-400">Fichas, datos CONTPAQi y complementarios</div>
                        </div>
                      </div>
                      {activeTab === 'colaboradores' && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>

                    {/* Opción 3: Administración de Roles DO (/admin/roles-do) */}
                    <button
                      onClick={() => {
                        onTabChange('admin-do');
                        setShowGestionDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                        activeTab === 'admin-do' ? 'bg-cyan-50/70 text-cyan-950 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-cyan-100 text-cyan-700 rounded-lg">
                          <UserPlus className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Administración de Roles DO</div>
                          <div className="text-[11px] text-slate-400">Asignación y permisos de administradores</div>
                        </div>
                      </div>
                      {activeTab === 'admin-do' && <Check className="w-4 h-4 text-cyan-600" />}
                    </button>

                    {/* Opción exclusiva para SISTEMAS: Panel de Auditoría & TI */}
                    {esSistemas && (
                      <>
                        <div className="my-1 border-t border-slate-100"></div>
                        <button
                          onClick={() => {
                            onTabChange('sistemas');
                            setShowGestionDropdown(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                            activeTab === 'sistemas' ? 'bg-purple-50/70 text-purple-950 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                              <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">Panel de Auditoría & TI</div>
                              <div className="text-[11px] text-slate-400">Sincronización Nóminas y base de datos</div>
                            </div>
                          </div>
                          {activeTab === 'sistemas' && <Check className="w-4 h-4 text-purple-600" />}
                        </button>

                        <button
                          onClick={() => {
                            onTabChange('configuracion');
                            setShowGestionDropdown(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                            activeTab === 'configuracion' ? 'bg-purple-50/70 text-purple-950 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                              <Settings className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">Configuración del Sistema</div>
                              <div className="text-[11px] text-slate-400">Infraestructura, SMTP, CONTPAQi y LFT</div>
                            </div>
                          </div>
                          {activeTab === 'configuracion' && <Check className="w-4 h-4 text-purple-600" />}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* [Reportes] -> Enlace directo a /reportes para ADMIN_DO y SISTEMAS */}
            {mostrarReportes && (
              <button
                onClick={() => {
                  onTabChange('reportes');
                  cerrarTodosDropdowns();
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'reportes'
                    ? 'bg-emerald-50 text-emerald-800 font-bold shadow-2xs border border-emerald-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'reportes' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Reportes</span>
              </button>
            )}

          </nav>

          {/* 3. SECCIÓN DERECHA: Badge Vista Actual + Tarjeta de Usuario con Avatar */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            
            {/* CONMUTADOR INTERACTIVO DE ROLES (DROPDOWN ROLE IMPERSONATOR) */}
            {isRealSuperAdmin && (
              <div className="relative" ref={roleDropdownRef}>
                <button
                  id="role-impersonator-dropdown-btn"
                  type="button"
                  onClick={() => {
                    setShowRoleDropdown(!showRoleDropdown);
                    setShowUserDropdown(false);
                    setShowEquipoDropdown(false);
                    setShowGestionDropdown(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer select-none ${
                    activeRoleView === 'SISTEMAS' || activeRoleView === 'SUPERADMIN'
                      ? 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100 hover:border-purple-400'
                      : 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 ring-2 ring-amber-400/50'
                  }`}
                  title="Selector interactivo de roles (Role Impersonator)"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                  <span className="hidden sm:inline text-slate-600 font-medium">Vista Actual:</span>
                  <span className="font-extrabold underline flex items-center gap-1">
                    <span>{currentRoleConfig.icon}</span>
                    <span>{currentRoleConfig.label}</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 ml-0.5 transition-transform duration-200 opacity-80 ${showRoleDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showRoleDropdown && (
                  <div className="absolute right-0 mt-2 w-84 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Selector de Roles (Role Impersonator)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Selecciona un perfil para auditar y navegar la aplicación con los permisos exactos de ese rol:
                      </p>
                    </div>

                    <div className="py-1">
                      {/* Opción 1: SISTEMAS (TI) */}
                      <button
                        type="button"
                        onClick={() => {
                          onRoleViewChange('SISTEMAS', null);
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'SISTEMAS' || activeRoleView === 'SUPERADMIN' ? 'bg-purple-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5 select-none">🛠️</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>SISTEMAS (TI)</span>
                              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">[Vista Real SuperAdmin]</span>
                              {(activeRoleView === 'SISTEMAS' || activeRoleView === 'SUPERADMIN') && (
                                <Check className="w-3.5 h-3.5 text-purple-700" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">Acceso total, auditoría, sincronización y configuración de TI</p>
                          </div>
                        </div>
                      </button>

                      {/* Opción 2: ADMIN_DO */}
                      <button
                        type="button"
                        onClick={() => {
                          onRoleViewChange('ADMIN_DO', {
                            idColaborador: 29,
                            id: 29,
                            codigoEmpleado: '0906',
                            nombreCompleto: 'HURTADO AVALOS, TANIA DEL CARMEN',
                            empresa: 'CONTROLADORA JAMA, S.C.',
                            rolApp: 'ADMIN_DO',
                            rol: 'ADMIN_DO'
                          });
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'ADMIN_DO' ? 'bg-blue-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5 select-none">🏢</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>ADMIN_DO</span>
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">[Desarrollo Organizacional]</span>
                              {activeRoleView === 'ADMIN_DO' && <Check className="w-3.5 h-3.5 text-blue-700" />}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">HURTADO AVALOS, TANIA (0906): Gestión global de 8 empresas, VoBo DO y saldos</p>
                          </div>
                        </div>
                      </button>

                      {/* Opción 3: LÍDER / JEFE */}
                      <button
                        type="button"
                        onClick={() => {
                          onRoleViewChange('LIDER', {
                            idColaborador: 850,
                            id: 850,
                            codigoEmpleado: '0155',
                            nombreCompleto: 'GARCES RODRIGUEZ, ULISES ANTONIO',
                            empresa: 'LATINO CONCRETOS, S.A. DE C.V.',
                            rolApp: 'LIDER',
                            rol: 'LIDER'
                          });
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'LIDER' ? 'bg-amber-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5 select-none">👔</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>LÍDER / JEFE</span>
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">[Aprobaciones y Mi Equipo]</span>
                              {activeRoleView === 'LIDER' && <Check className="w-3.5 h-3.5 text-amber-700" />}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">GARCES RODRIGUEZ, ULISES ANTONIO (0155): Bandeja de aprobación y equipo a cargo</p>
                          </div>
                        </div>
                      </button>

                      {/* Opción 4: COLABORADOR */}
                      <button
                        type="button"
                        onClick={() => {
                          onRoleViewChange('COLABORADOR', {
                            idColaborador: 852,
                            id: 852,
                            codigoEmpleado: '0157',
                            nombreCompleto: 'CAMPOS REGINO, JOSE LUIS',
                            empresa: 'LATINO CONCRETOS, S.A. DE C.V.',
                            rolApp: 'COLABORADOR',
                            rol: 'COLABORADOR'
                          });
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'COLABORADOR' ? 'bg-emerald-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5 select-none">👤</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>COLABORADOR</span>
                              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">[Portal Colaborador]</span>
                              {activeRoleView === 'COLABORADOR' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">CAMPOS REGINO, JOSE LUIS (0157): Saldo LFT individual y solicitudes</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>SuperAdmin TI: Bypass Universal</span>
                      <span className="font-semibold text-purple-700">Headers X-Simulate</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MENÚ DE PERFIL DEL USUARIO AUTENTICADO */}
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowRoleDropdown(false);
                  setShowEquipoDropdown(false);
                  setShowGestionDropdown(false);
                }}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                  {obtenerInicialesColaborador(currentUser)}
                </div>
                <div className="hidden sm:block max-w-[130px] md:max-w-[170px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {formatearNombreColaborador(currentUser?.nombreCompleto || 'Colaborador')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate block">
                    {currentUser?.empresa || currentUser?.aliasEmpresa || 'Grupo JAMA'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
              </button>

              {/* Dropdown del Avatar del Usuario */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {formatearNombreColaborador(currentUser?.nombreCompleto || 'Colaborador')}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Nómina: {currentUser?.codigoEmpleado || '—'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {currentUser?.empresa || 'Grupo JAMA'}
                    </p>
                    <div className="mt-2">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${roleBadgeColor}`}>
                        Rol: {roleLabel}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    {esSistemas && (
                      <>
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onTabChange('configuracion');
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-purple-50 text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                            activeTab === 'configuracion' ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <Settings className="w-4 h-4 text-purple-600" />
                          <span>⚙️ Configuración del Sistema</span>
                        </button>
                        <div className="my-1 border-t border-slate-100"></div>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onChangePassword();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-blue-600" />
                      <span>Cambiar Contraseña</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-rose-50 text-xs font-bold text-rose-700 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Botón Hamburger para Móviles */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>

        </div>

        {/* 4. MENÚ MÓVIL DESPLEGABLE */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              onClick={() => {
                onTabChange('colaborador');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                activeTab === 'colaborador' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
              }`}
            >
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              <span>Mi Portal (Mis Vacaciones)</span>
            </button>

            {mostrarEquipo && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Equipo
                </div>
                <button
                  onClick={() => {
                    onTabChange('lider');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                    activeTab === 'lider' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-slate-700'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>Bandeja de Aprobaciones</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('mi-equipo');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                    activeTab === 'mi-equipo' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Catálogo de Mi Equipo</span>
                </button>
              </>
            )}

            {mostrarGestionDO && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Gestión DO
                </div>
                <button
                  onClick={() => {
                    onTabChange('admin');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                    activeTab === 'admin' ? 'bg-blue-50 text-blue-800 font-bold' : 'text-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Gestión Global de Vacaciones</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('colaboradores');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                    activeTab === 'colaboradores' ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Catálogo General de Colaboradores</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('admin-do');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                    activeTab === 'admin-do' ? 'bg-cyan-50 text-cyan-800 font-bold' : 'text-slate-700'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-cyan-600" />
                  <span>Administración de Roles DO</span>
                </button>
                {esSistemas && (
                  <>
                    <button
                      onClick={() => {
                        onTabChange('sistemas');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                        activeTab === 'sistemas' ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <Terminal className="w-4 h-4 text-purple-600" />
                      <span>Panel Sistemas & TI</span>
                    </button>
                    <button
                      onClick={() => {
                        onTabChange('configuracion');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 pl-6 ${
                        activeTab === 'configuracion' ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <Settings className="w-4 h-4 text-purple-600" />
                      <span>Configuración del Sistema</span>
                    </button>
                  </>
                )}
              </>
            )}

            {mostrarReportes && (
              <button
                onClick={() => {
                  onTabChange('reportes');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  activeTab === 'reportes' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Reportes & Analítica</span>
              </button>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
