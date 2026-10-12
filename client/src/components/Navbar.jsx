import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, Users, UserCheck, ShieldCheck, CalendarCheck, 
  ChevronDown, RefreshCw, Sparkles, AlertCircle, Eye, 
  LogOut, KeyRound, Check, Shield, User, Terminal, FileSpreadsheet, UserPlus
} from 'lucide-react';
import logoJama from '../assets/logo-jama.png';

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
  
  const roleDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  // Cerrar dropdowns si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setShowRoleDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isRealSuperAdmin = realUser?.rolApp === 'SUPERADMIN' || 
                           realUser?.rolApp === 'SISTEMAS' || 
                           currentUser?.rolApp === 'SUPERADMIN' || 
                           currentUser?.rolApp === 'SISTEMAS' ||
                           realUser?.rol === 'SUPERADMIN' ||
                           realUser?.rol === 'SISTEMAS';

  const roleBadgeColor = {
    'COLABORADOR': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'LIDER': 'bg-amber-100 text-amber-800 border-amber-300',
    'ADMIN_DO': 'bg-blue-100 text-blue-800 border-blue-300',
    'SISTEMAS': 'bg-purple-100 text-purple-800 border-purple-300',
    'SUPERADMIN': 'bg-purple-100 text-purple-800 border-purple-300'
  }[activeRoleView || currentUser?.rolApp || 'COLABORADOR'];

  const roleLabel = {
    'COLABORADOR': 'Colaborador',
    'LIDER': 'Líder / Jefe',
    'ADMIN_DO': 'Desarrollo Org.',
    'SISTEMAS': 'Sistemas (TI)',
    'SUPERADMIN': 'Sistemas (TI)'
  }[activeRoleView || currentUser?.rolApp || 'COLABORADOR'];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Oficial & Marca Institucional Grupo JAMA */}
          <div className="flex items-center gap-3">
            <img
              src={logoJama}
              alt="Grupo JAMA"
              className="h-9 w-auto object-contain select-none"
              style={{ aspectRatio: '192 / 48' }}
            />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-600 border border-slate-200 uppercase">
                  On-Premise LAN
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Control de Vacaciones • DO</p>
            </div>
          </div>

          {/* Navegación por Pestañas según Rol Activo (o Simulado) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            
            {/* Opción Portal Colaborador / Mis Vacaciones */}
            <button
              onClick={() => onTabChange('colaborador')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'colaborador'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              {activeRoleView === 'LIDER' ? 'Mis Vacaciones' : 'Portal Colaborador'}
            </button>

            {/* Opción Bandeja del Líder / Aprobaciones */}
            {(activeRoleView === 'LIDER' || activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('lider')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'lider'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4 text-amber-600" />
                {activeRoleView === 'LIDER' ? 'Aprobaciones de Equipo' : 'Bandeja del Líder'}
              </button>
            )}

            {/* Opción Mi Equipo (LÍDER, SISTEMAS, SUPERADMIN) */}
            {(activeRoleView === 'LIDER' || activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('mi-equipo')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'mi-equipo'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-blue-600" />
                <span>Mi Equipo</span>
              </button>
            )}

            {/* Opción Panel DO (Gestión Global de Vacaciones) */}
            {(activeRoleView === 'ADMIN_DO' || activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="hidden xl:inline">Gestión Global DO</span>
                <span className="xl:hidden">Gestión</span>
              </button>
            )}

            {/* Opción Catálogo Administrativo de Colaboradores */}
            {(activeRoleView === 'ADMIN_DO' || activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('colaboradores')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'colaboradores'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="hidden xl:inline">Catálogo Colaboradores</span>
                <span className="xl:hidden">Colaboradores</span>
              </button>
            )}

            {/* Opción Gestión de Roles ADMIN_DO */}
            {(activeRoleView === 'ADMIN_DO' || activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('admin-do')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'admin-do'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-4 h-4 text-cyan-600" />
                <span className="hidden xl:inline">Roles ADMIN_DO</span>
                <span className="xl:hidden">Roles DO</span>
              </button>
            )}

            {/* Opción Módulo de Reportes y Analítica (ADMIN_DO, SISTEMAS, SUPERADMIN) */}
            {(activeRoleView === 'ADMIN_DO' || activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('reportes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'reportes'
                    ? 'bg-white text-emerald-950 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden xl:inline">Reportes & Analítica</span>
                <span className="xl:hidden">Reportes</span>
              </button>
            )}

            {/* Opción Exclusiva Rol SISTEMAS: Panel Sistemas & Auditoría */}
            {(activeRoleView === 'SUPERADMIN' || activeRoleView === 'SISTEMAS') && (
              <button
                onClick={() => onTabChange('sistemas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'sistemas'
                    ? 'bg-white text-purple-900 shadow-xs font-bold'
                    : 'text-purple-700 hover:text-purple-900'
                }`}
              >
                <Terminal className="w-4 h-4 text-purple-600" />
                <span className="hidden xl:inline">Panel Sistemas / TI</span>
                <span className="xl:hidden">Sistemas</span>
              </button>
            )}
          </nav>

          {/* Área Derecha: Role Switcher (Solo SuperAdmin) y Perfil del Usuario */}
          <div className="flex items-center gap-2.5">
            
            {/* CONMUTADOR DE ROLES EXCLUSIVO PARA ROL SISTEMAS (SuperAdmin) */}
            {isRealSuperAdmin && (
              <div className="relative" ref={roleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
                    activeRoleView === 'SISTEMAS' || activeRoleView === 'SUPERADMIN'
                      ? 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
                      : 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 animate-pulse'
                  }`}
                  title="Conmutador de Vista de Roles (SuperAdmin)"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-700" />
                  <span className="hidden sm:inline">Vista Actual:</span>
                  <span className="font-extrabold underline">{roleLabel}</span>
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                </button>

                {showRoleDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Ver Aplicación Como... (Role Switcher)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Muta la interfaz, permisos y vistas en tiempo real para simular la experiencia de cualquier perfil:
                      </p>
                    </div>

                    <div className="py-1">
                      {/* Modo Real: Sistemas */}
                      <button
                        onClick={() => {
                          onRoleViewChange('SISTEMAS');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'SISTEMAS' || activeRoleView === 'SUPERADMIN' ? 'bg-purple-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <Terminal className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Modo Real: SISTEMAS (SuperAdmin)</span>
                              {(activeRoleView === 'SISTEMAS' || activeRoleView === 'SUPERADMIN') && (
                                <Check className="w-3.5 h-3.5 text-purple-700" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">Acceso total, auditoría, BD, sincronización y los 4 módulos</p>
                          </div>
                        </div>
                      </button>

                      {/* Simular: ADMIN_DO */}
                      <button
                        onClick={() => {
                          onRoleViewChange('ADMIN_DO');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'ADMIN_DO' ? 'bg-blue-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Simular: ADMIN_DO (Desarrollo Org.)</span>
                              {activeRoleView === 'ADMIN_DO' && <Check className="w-3.5 h-3.5 text-blue-700" />}
                            </div>
                            <p className="text-[11px] text-slate-500">Gestión global de las 8 empresas, VoBo DO y festivos</p>
                          </div>
                        </div>
                      </button>

                      {/* Simular: LIDER */}
                      <button
                        onClick={() => {
                          onRoleViewChange('LIDER', {
                            idColaborador: 850,
                            codigoEmpleado: '850',
                            nombreCompleto: 'ULISES ANTONIO GARCES RODRIGUEZ',
                            empresa: 'LATINO CONCRETOS, S.A. DE C.V.'
                          });
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'LIDER' ? 'bg-amber-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <UserCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Simular: LÍDER / JEFE DIRECTO</span>
                              {activeRoleView === 'LIDER' && <Check className="w-3.5 h-3.5 text-amber-700" />}
                            </div>
                            <p className="text-[11px] text-slate-500">Muestra Ulises Garcés (850): bandeja de aprobación y equipo a cargo</p>
                          </div>
                        </div>
                      </button>

                      {/* Simular: COLABORADOR */}
                      <button
                        onClick={() => {
                          onRoleViewChange('COLABORADOR', {
                            idColaborador: 1039,
                            codigoEmpleado: '1077',
                            nombreCompleto: 'GONZALO RAMIREZ GALLARDO',
                            empresa: 'LATINO CONCRETOS, S.A. DE C.V.'
                          });
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between transition cursor-pointer ${
                          activeRoleView === 'COLABORADOR' ? 'bg-emerald-50/80 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Simular: COLABORADOR (Base)</span>
                              {activeRoleView === 'COLABORADOR' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                            </div>
                            <p className="text-[11px] text-slate-500">Muestra Gonzalo Ramírez (1077): saldo LFT individual y nueva solicitud</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>SuperAdmin TI: Bypass Universal</span>
                      <span className="font-semibold text-purple-700">Headers X-Simulate Activos</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MENÚ DE PERFIL DEL USUARIO AUTENTICADO */}
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                  {currentUser?.nombreCompleto ? currentUser.nombreCompleto.substring(0, 2) : 'EM'}
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                      {currentUser?.nombreCompleto || 'Colaborador'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${roleBadgeColor}`}>
                      {roleLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                    {currentUser?.empresa || currentUser?.aliasEmpresa || 'Grupo JAMA'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {/* Dropdown del Avatar del Usuario */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {currentUser?.nombreCompleto || 'Colaborador'}
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

          </div>

        </div>
      </div>
    </header>
  );
}
