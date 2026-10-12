import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, UserCheck, ShieldCheck, CalendarCheck, 
  ChevronDown, RefreshCw, Sparkles, AlertCircle
} from 'lucide-react';
import { api, setAuthToken } from '../api/client';

export default function Navbar({ currentUser, onUserChange, activeTab, onTabChange }) {
  const [personas, setPersonas] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    cargarPersonas();
  }, []);

  async function cargarPersonas() {
    try {
      const res = await api.getPersonasDemo();
      if (res.success) {
        setPersonas(res.personas);
      }
    } catch (err) {
      console.error('Error cargando personas demo:', err);
    }
  }

  async function handleSwitch(persona) {
    try {
      setSwitching(true);
      const res = await api.switchUser({ codigoEmpleado: persona.codigoEmpleado });
      if (res.success) {
        setAuthToken(res.token, res.user.id);
        onUserChange(res.user);
        setShowDropdown(false);
      }
    } catch (err) {
      alert('Error cambiando usuario: ' + err.message);
    } finally {
      setSwitching(false);
    }
  }

  const roleBadgeColor = {
    'COLABORADOR': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'LIDER': 'bg-amber-100 text-amber-800 border-amber-300',
    'ADMIN_DO': 'bg-blue-100 text-blue-800 border-blue-300'
  }[currentUser?.rolApp || 'COLABORADOR'];

  const roleLabel = {
    'COLABORADOR': 'Colaborador',
    'LIDER': 'Líder / Gerencia',
    'ADMIN_DO': 'Desarrollo Organizacional'
  }[currentUser?.rolApp || 'COLABORADOR'];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Marca Institucional Grupo JAMA */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black tracking-wider shadow-sm">
              <span className="text-xl text-amber-400">J</span>
              <span className="text-lg">A</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-lg">GRUPO JAMA</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600 border border-slate-200">
                  On-Premise
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Control de Vacaciones • Desarrollo Organizacional</p>
            </div>
          </div>

          {/* Navegación por Pestañas según Rol */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onTabChange('colaborador')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'colaborador'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              Portal Colaborador
            </button>

            {(currentUser?.rolApp === 'LIDER' || currentUser?.rolApp === 'ADMIN_DO') && (
              <button
                onClick={() => onTabChange('lider')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'lider'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4 text-amber-600" />
                Bandeja del Líder
              </button>
            )}

            {currentUser?.rolApp === 'ADMIN_DO' && (
              <button
                onClick={() => onTabChange('admin')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Panel DO (Admin)
              </button>
            )}
          </nav>

          {/* Persona Switcher & Selector de Prueba Rápida */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {currentUser?.nombreCompleto ? currentUser.nombreCompleto.substring(0, 2) : 'EM'}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                    {currentUser?.nombreCompleto || 'Colaborador'}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${roleBadgeColor}`}>
                    {roleLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                  {currentUser?.codigoEmpleado} • {currentUser?.empresa || 'Grupo JAMA'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {/* Dropdown de cambio rápido de perfil */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Simular Rol de Usuario
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cambia instantáneamente de perfil para validar los 3 portales:
                  </p>
                </div>

                <div className="py-1">
                  {personas.map(p => (
                    <button
                      key={p.codigoEmpleado}
                      onClick={() => handleSwitch(p)}
                      disabled={switching}
                      className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                        currentUser?.codigoEmpleado === p.codigoEmpleado ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <div className="mt-0.5">
                        {p.rol === 'COLABORADOR' && <CalendarCheck className="w-4 h-4 text-emerald-600" />}
                        {p.rol === 'LIDER' && <UserCheck className="w-4 h-4 text-amber-600" />}
                        {p.rol === 'ADMIN_DO' && <ShieldCheck className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{p.titulo}</span>
                          <span className="text-[10px] font-mono text-slate-400">{p.codigoEmpleado}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {p.descripcion}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Plantilla: 601 colaboradores</span>
                  <span className="font-semibold text-emerald-600">LFT 2023+ Activa</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
