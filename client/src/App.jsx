import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ColaboradorPortal from './pages/ColaboradorPortal';
import LiderPortal from './pages/LiderPortal';
import AdminDOPanel from './pages/AdminDOPanel';
import { api, setAuthToken } from './api/client';
import { Shield, Database, Award } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('colaborador'); // 'colaborador', 'lider', 'admin'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inicializarUsuario();
  }, []);

  async function inicializarUsuario() {
    try {
      setLoading(true);
      // Iniciar con Benito Salazar por defecto (CONS-100) para mostrar el autoservicio
      const res = await api.switchUser({ codigoEmpleado: 'CONS-100' });
      if (res.success) {
        setAuthToken(res.token, res.user.id);
        setCurrentUser(res.user);
      }
    } catch (err) {
      console.error('Error inicializando:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleUserChange(nuevoUsuario) {
    setCurrentUser(nuevoUsuario);
    // Cambiar de pestaña inteligentemente según el nuevo rol
    if (nuevoUsuario.rolApp === 'COLABORADOR') {
      setActiveTab('colaborador');
    } else if (nuevoUsuario.rolApp === 'LIDER') {
      setActiveTab('lider');
    } else if (nuevoUsuario.rolApp === 'ADMIN_DO') {
      setActiveTab('admin');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-500 animate-pulse flex items-center justify-center font-black text-xl mb-4">
          JA
        </div>
        <p className="text-sm font-bold tracking-wider text-slate-300">INICIALIZANDO SISTEMA DE VACACIONES</p>
        <p className="text-xs text-slate-500 mt-1">Cargando catálogos de Grupo JAMA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navegación Superior */}
      <Navbar
        currentUser={currentUser}
        onUserChange={handleUserChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'colaborador' && (
          <ColaboradorPortal currentUser={currentUser} />
        )}

        {activeTab === 'lider' && (
          <LiderPortal currentUser={currentUser} />
        )}

        {activeTab === 'admin' && (
          <AdminDOPanel currentUser={currentUser} />
        )}
      </main>

      {/* Footer Corporativo */}
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
            <span>Microsoft SQL Server</span>
            <span>•</span>
            <span>CONTPAQi Nóminas Sync</span>
            <span>•</span>
            <span>Red Local On-Premise (LAN)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
