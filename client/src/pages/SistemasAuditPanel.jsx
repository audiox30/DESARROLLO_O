import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Activity, Key, Lock, RefreshCw, 
  Search, CheckCircle, XCircle, AlertTriangle, Database, 
  Server, Cpu, Eye, Clock, Terminal, Filter
} from 'lucide-react';
import { api } from '../api/client';

export default function SistemasAuditPanel({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('usuarios'); // 'usuarios', 'auditoria', 'diagnostico'
  
  // Estado de Usuarios
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Estado de Auditoría
  const [auditoria, setAuditoria] = useState([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  // Estado de Diagnóstico
  const [diagnostico, setDiagnostico] = useState(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'auditoria') {
      cargarAuditoria();
    } else if (activeSubTab === 'diagnostico') {
      cargarDiagnostico();
    }
  }, [activeSubTab]);

  async function cargarUsuarios() {
    try {
      setLoadingUsuarios(true);
      const res = await api.getSistemasUsuarios();
      if (res.success) {
        setUsuarios(res.usuarios || []);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoadingUsuarios(false);
    }
  }

  async function cargarAuditoria() {
    try {
      setLoadingAuditoria(true);
      const res = await api.getSistemasAuditoria();
      if (res.success) {
        setAuditoria(res.registros || []);
      }
    } catch (err) {
      console.error('Error cargando auditoría:', err);
    } finally {
      setLoadingAuditoria(false);
    }
  }

  async function cargarDiagnostico() {
    try {
      setLoadingDiag(true);
      const res = await api.getSistemasDiagnostico();
      if (res.success) {
        setDiagnostico(res);
      }
    } catch (err) {
      console.error('Error cargando diagnóstico:', err);
    } finally {
      setLoadingDiag(false);
    }
  }

  async function handleToggleActivo(usuario) {
    if (usuario.Username === 'sistemas') {
      alert('No es posible desactivar la cuenta principal de SuperAdmin.');
      return;
    }
    const accion = usuario.Activo ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Estás seguro de ${accion} al usuario ${usuario.Username}?`)) return;

    try {
      const res = await api.toggleUsuarioActivo(usuario.IdUsuario);
      if (res.success) {
        setActionMessage(res.message);
        setUsuarios(prev => prev.map(u => 
          u.IdUsuario === usuario.IdUsuario ? { ...u, Activo: res.activo } : u
        ));
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleResetPassword(usuario) {
    if (!window.confirm(`¿Resetear la contraseña de ${usuario.Username} (${usuario.NombreCompleto}) a la clave institucional por defecto (Grupojama2026!)?`)) return;

    try {
      const res = await api.resetUsuarioPassword(usuario.IdUsuario);
      if (res.success) {
        setActionMessage(`Contraseña de ${usuario.Username} restablecida. Se requerirá cambio en su próximo login.`);
        setUsuarios(prev => prev.map(u => 
          u.IdUsuario === usuario.IdUsuario ? { ...u, DebeCambiarPassword: true } : u
        ));
        setTimeout(() => setActionMessage(''), 5000);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // Filtrado de usuarios en frontend
  const usuariosFiltrados = usuarios.filter(u => {
    const matchText = !filtroTexto || 
      (u.Username && u.Username.toLowerCase().includes(filtroTexto.toLowerCase())) ||
      (u.NombreCompleto && u.NombreCompleto.toLowerCase().includes(filtroTexto.toLowerCase())) ||
      (u.CodigoEmpleado && u.CodigoEmpleado.toLowerCase().includes(filtroTexto.toLowerCase())) ||
      (u.Email && u.Email.toLowerCase().includes(filtroTexto.toLowerCase()));

    const matchRol = !filtroRol || u.RolApp === filtroRol;
    const matchEmpresa = !filtroEmpresa || u.Empresa === filtroEmpresa;

    return matchText && matchRol && matchEmpresa;
  });

  const empresasUnicas = [...new Set(usuarios.map(u => u.Empresa).filter(Boolean))];

  return (
    <div className="space-y-6">
      
      {/* Encabezado del Módulo de Sistemas */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Rol SISTEMAS / SuperAdmin
            </span>
            <span className="text-xs text-slate-400">• Acceso Maestro a Infraestructura</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
            Consola de Administración y Auditoría de Sistemas
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de usuarios en <code className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded">dbo.UsuariosApp</code>, trazabilidad de aprobaciones y estado de la base de datos <code className="bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded">DESARROLLO_O</code>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveSubTab('usuarios')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'usuarios'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Cuentas de Usuarios ({usuarios.length})
          </button>
          <button
            onClick={() => setActiveSubTab('auditoria')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'auditoria'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            Bitácora de Auditoría
          </button>
          <button
            onClick={() => setActiveSubTab('diagnostico')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'diagnostico'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            Diagnóstico DB
          </button>
        </div>
      </div>

      {/* Notificación de Acción */}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* PESTAÑA 1: ADMINISTRACIÓN DE USUARIOS */}
      {activeSubTab === 'usuarios' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Barra de Filtros */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  placeholder="Buscar por usuario, nómina, nombre o correo..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                />
              </div>

              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-purple-600 outline-none"
              >
                <option value="">Todos los Roles</option>
                <option value="SUPERADMIN">SUPERADMIN / SISTEMAS</option>
                <option value="ADMIN_DO">ADMIN_DO</option>
                <option value="LIDER">LIDER</option>
                <option value="COLABORADOR">COLABORADOR</option>
              </select>

              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-purple-600 outline-none max-w-[200px]"
              >
                <option value="">Todas las Empresas</option>
                {empresasUnicas.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <button
              onClick={cargarUsuarios}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsuarios ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {/* Tabla de Usuarios */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Usuario / Nómina</th>
                  <th className="py-3 px-4">Nombre Completo</th>
                  <th className="py-3 px-4">Empresa / Depto</th>
                  <th className="py-3 px-4">Rol App</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Último Acceso</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingUsuarios ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Cargando catálogo de usuarios desde DESARROLLO_O...</span>
                      </div>
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No se encontraron usuarios coincidentes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map(u => (
                    <tr key={u.IdUsuario} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.Username}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Nómina: {u.CodigoEmpleado || 'S/N'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{u.NombreCompleto || 'Sin Asignar'}</div>
                        <div className="text-[11px] text-slate-400">{u.Email || u.Puesto || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{u.Empresa || 'Grupo JAMA'}</div>
                        <div className="text-[11px] text-slate-400">{u.Departamento || 'General'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          u.RolApp === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                          u.RolApp === 'ADMIN_DO' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          u.RolApp === 'LIDER' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {u.RolApp}
                        </span>
                        {u.DebeCambiarPassword && (
                          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Clave Temp</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                          u.Activo ? 'text-emerald-700' : 'text-slate-400'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${u.Activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          {u.Activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.UltimoAcceso ? new Date(u.UltimoAcceso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleResetPassword(u)}
                            title="Restablecer contraseña a institucional"
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActivo(u)}
                            disabled={u.Username === 'sistemas'}
                            title={u.Activo ? 'Desactivar acceso' : 'Activar acceso'}
                            className={`p-1.5 rounded-lg transition ${
                              u.Activo 
                                ? 'text-slate-600 hover:text-rose-700 hover:bg-rose-50' 
                                : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                            } disabled:opacity-30`}
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Mostrando {usuariosFiltrados.length} de {usuarios.length} cuentas registradas en DESARROLLO_O</span>
            <span className="text-[11px]">Cifrado Bcrypt • Sincronización Nomipaq</span>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: AUDITORÍA Y TRAZABILIDAD */}
      {activeSubTab === 'auditoria' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Bitácora de Historial y Aprobaciones</h3>
              <p className="text-xs text-slate-500">Últimas 100 operaciones registradas en dbo.HistorialAprobaciones</p>
            </div>
            <button
              onClick={cargarAuditoria}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditoria ? 'animate-spin' : ''}`} />
              Actualizar Bitácora
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Folio Solicitud</th>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Aprobador / Actor</th>
                  <th className="py-3 px-4">Acción Realizada</th>
                  <th className="py-3 px-4">Método / IP</th>
                  <th className="py-3 px-4">Comentarios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingAuditoria ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      Cargando bitácora de auditoría...
                    </td>
                  </tr>
                ) : auditoria.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No hay registros de auditoría en el historial aún.
                    </td>
                  </tr>
                ) : (
                  auditoria.map(h => (
                    <tr key={h.IdHistorial} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(h.FechaAccion).toLocaleString('es-MX')}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {h.FolioSolicitud || 'S/F'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {h.SolicitanteNombre || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {h.AprobadorNombre || 'Sistema Automático'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          h.Accion.includes('APROB') ? 'bg-emerald-100 text-emerald-800' :
                          h.Accion.includes('RECHAZ') ? 'bg-rose-100 text-rose-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {h.Accion}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                        {h.MetodoAutorizacion || 'WEB'} • {h.DireccionIP || 'LAN'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {h.Comentarios || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: DIAGNÓSTICO DEL SERVIDOR Y BD */}
      {activeSubTab === 'diagnostico' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 text-blue-600 mb-2">
                <Database className="w-5 h-5" />
                <h4 className="font-extrabold text-slate-900 text-sm">Base de Datos Local</h4>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {diagnostico?.baseDatos?.BaseDatosActiva || 'DESARROLLO_O'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Servidor: <strong className="text-slate-800">{diagnostico?.baseDatos?.ServidorSQL || 'SQL-2025'}</strong>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Colaboradores totales:</span>
                  <strong>{diagnostico?.baseDatos?.TotalColaboradores || 692}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Colaboradores activos:</span>
                  <strong className="text-emerald-600">{diagnostico?.baseDatos?.ColaboradoresActivos || 692}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Empresas dadas de alta:</span>
                  <strong>{diagnostico?.baseDatos?.TotalEmpresas || 8}</strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 text-purple-600 mb-2">
                <Cpu className="w-5 h-5" />
                <h4 className="font-extrabold text-slate-900 text-sm">Servicio Backend (Node.js)</h4>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {diagnostico?.servidor?.nodeVersion || 'v20.x'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Tiempo activo: <strong className="text-slate-800">{Math.round((diagnostico?.servidor?.uptimeSegundos || 0) / 60)} min</strong>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Uso de Memoria RSS:</span>
                  <strong>{diagnostico?.servidor?.memoriaMB || 65} MB</strong>
                </div>
                <div className="flex justify-between">
                  <span>Puerto Express:</span>
                  <strong>5000 (LAN)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Modo de Operación:</span>
                  <strong className="text-blue-600">On-Premise LAN</strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 text-emerald-600 mb-2">
                <ShieldCheck className="w-5 h-5" />
                <h4 className="font-extrabold text-slate-900 text-sm">Seguridad y RBAC</h4>
              </div>
              <div className="text-2xl font-black text-emerald-700">
                JWT + Bcrypt
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Cuentas en UsuariosApp: <strong className="text-slate-800">{diagnostico?.baseDatos?.TotalUsuarios || 694}</strong>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Políticas de Clave:</span>
                  <strong>Min 8 carácteres</strong>
                </div>
                <div className="flex justify-between">
                  <span>Módulo Simulación TI:</span>
                  <strong className="text-purple-600">Activo (Headers X-Simulate)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Auditoría de Acciones:</span>
                  <strong className="text-emerald-600">Habilitada</strong>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
