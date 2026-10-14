import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, UserPlus, UserMinus, Search, RefreshCw, 
  AlertCircle, CheckCircle2, X, Users, Shield, ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import RefreshButton from '../components/RefreshButton';
import { 
  formatearNombreColaborador, 
  formatearEtiquetaSelector, 
  compararPorApellidos 
} from '../utils/formatters';

export default function AdminDORolesPage({ currentUser }) {
  const [administradores, setAdministradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // Modal Asignar
  const [modalAsignar, setModalAsignar] = useState(false);
  const [colaboradoresActivos, setColaboradoresActivos] = useState([]);
  const [busquedaColab, setBusquedaColab] = useState('');
  const [colabSeleccionado, setColabSeleccionado] = useState(null);
  const [guardandoAsignar, setGuardandoAsignar] = useState(false);

  // Modal Revocar
  const [colabRevocar, setColabRevocar] = useState(null);
  const [nuevoRolRevocar, setNuevoRolRevocar] = useState('COLABORADOR');
  const [guardandoRevocar, setGuardandoRevocar] = useState(false);

  useEffect(() => {
    cargarAdministradores();
  }, []);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  }

  async function cargarAdministradores() {
    try {
      setLoading(true);
      const res = await api.getAdministradoresDO();
      if (res.success) {
        const sorted = [...(res.data || [])].sort((a, b) => compararPorApellidos(a, b, 'asc'));
        setAdministradores(sorted);
      }
    } catch (err) {
      console.error('Error cargando administradores DO:', err);
    } finally {
      setLoading(false);
    }
  }

  async function abrirModalAsignar() {
    setModalAsignar(true);
    setBusquedaColab('');
    setColabSeleccionado(null);
    try {
      const res = await api.getColaboradoresAdmin('estatus=ACTIVO&limit=1000');
      if (res.success) {
        // Filtrar los que no sean ya ADMIN_DO y ordenar A - Z por apellidos
        const noDO = (res.data || [])
          .filter(c => c.RolApp !== 'ADMIN_DO')
          .sort((a, b) => compararPorApellidos(a, b, 'asc'));
        setColaboradoresActivos(noDO);
      }
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    }
  }

  async function handleConfirmarAsignar(e) {
    e.preventDefault();
    if (!colabSeleccionado) {
      alert('Debes seleccionar un colaborador.');
      return;
    }

    try {
      setGuardandoAsignar(true);
      const idColab = colabSeleccionado.IdColaborador || colabSeleccionado.id;
      const res = await api.asignarAdminDO(idColab);
      if (res.success) {
        mostrarToast(res.message);
        setModalAsignar(false);
        cargarAdministradores();
      }
    } catch (err) {
      alert('Error asignando rol: ' + err.message);
    } finally {
      setGuardandoAsignar(false);
    }
  }

  async function handleConfirmarRevocar(e) {
    e.preventDefault();
    if (!colabRevocar) return;

    try {
      setGuardandoRevocar(true);
      // Sanitización estricta: exclusivamente el código de rol ('COLABORADOR' o 'LIDER')
      const rolDestino = nuevoRolRevocar === 'LIDER' ? 'LIDER' : 'COLABORADOR';
      const idColab = colabRevocar.IdColaborador || colabRevocar.id;
      const res = await api.revocarAdminDO(idColab, rolDestino);
      if (res.success) {
        mostrarToast(res.message);
        setColabRevocar(null);
        cargarAdministradores();
      }
    } catch (err) {
      alert('Error revocando rol: ' + err.message);
    } finally {
      setGuardandoRevocar(false);
    }
  }

  // Filtrado de candidatos a promover (orden alfabético estricto A - Z por apellidos)
  const candidatosFiltrados = colaboradoresActivos.filter(c => {
    if (!busquedaColab.trim()) return true;
    const term = busquedaColab.toLowerCase();
    return (
      (c.NombreCompleto && c.NombreCompleto.toLowerCase().includes(term)) ||
      (c.CodigoEmpleado && c.CodigoEmpleado.toLowerCase().includes(term)) ||
      (c.Empresa && c.Empresa.toLowerCase().includes(term)) ||
      (c.Departamento && c.Departamento.toLowerCase().includes(term))
    );
  }).sort((a, b) => compararPorApellidos(a, b, 'asc')).slice(0, 20);

  const callerColabId = currentUser?.idColaborador || currentUser?.id;

  return (
    <div className="space-y-6">
      
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-700 text-white shadow-2xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
              Gobierno de Seguridad & DO
            </span>
            <span className="text-xs text-slate-400">• Control de Privilegios</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Gestión de Administradores de Desarrollo Organizacional (ADMIN_DO)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Asigna o revoca los permisos de administración global de vacaciones y sincronización multi-empresa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <RefreshButton
            onClick={cargarAdministradores}
            isLoading={loading}
            label="Actualizar Administradores"
            loadingLabel="Actualizando..."
          />

          <button
            onClick={abrirModalAsignar}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Asignar Nuevo ADMIN_DO</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Lista de Administradores DO Actuales */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h3 className="font-bold text-slate-900 text-sm">
              Usuarios con Rol Activo ADMIN_DO ({administradores.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Autorizados para VoBo DO, Sincronización y Configuración
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Usuario / Nómina</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Razón Social</th>
                <th className="py-3 px-4">Departamento / Puesto</th>
                <th className="py-3 px-4">Último Acceso</th>
                <th className="py-3 px-4">Fecha Asignación</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Cargando administradores...
                  </td>
                </tr>
              ) : administradores.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No hay administradores DO registrados.
                  </td>
                </tr>
              ) : (
                administradores.map((a) => {
                  const esElMismo = Number(callerColabId) === Number(a.IdColaborador);
                  return (
                    <tr key={a.IdColaborador} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {a.Username || a.CodigoEmpleado}
                        <span className="block text-[10px] text-slate-400 font-normal">Nómina: {a.CodigoEmpleado}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{formatearNombreColaborador(a)}</span>
                        <span className="text-[11px] text-slate-400">{a.Email || 'Sin email registrado'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{a.Empresa || 'Grupo JAMA'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800 font-medium block">{a.Departamento || 'General'}</span>
                        <span className="text-[11px] text-slate-400 block">{a.Puesto || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {a.UltimoAcceso ? new Date(a.UltimoAcceso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {a.FechaAsignacion ? new Date(a.FechaAsignacion).toLocaleDateString('es-MX') : 'Inicial'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => { setColabRevocar(a); setNuevoRolRevocar('COLABORADOR'); }}
                          disabled={esElMismo}
                          title={esElMismo ? 'No puedes revocar tu propio rol' : 'Revocar privilegios de ADMIN_DO'}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition ${
                            esElMismo 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
                          }`}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Revocar Rol</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ASIGNAR NUEVO ADMIN_DO */}
      {modalAsignar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-blue-700">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <UserPlus className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Promover a ADMIN_DO</h3>
                  <p className="text-xs text-slate-500">Selecciona un colaborador activo del grupo</p>
                </div>
              </div>
              <button onClick={() => setModalAsignar(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmarAsignar} className="mt-4 space-y-4">
              {/* Buscador interactivo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Buscar Colaborador (Nombre, Nómina o Empresa):
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    autoFocus
                    value={busquedaColab}
                    onChange={(e) => setBusquedaColab(e.target.value)}
                    placeholder="Escribe para filtrar candidatos..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              {/* Lista de candidatos coincidentes */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                {candidatosFiltrados.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">
                    No se encontraron colaboradores coincidentes.
                  </p>
                ) : (
                  candidatosFiltrados.map(c => {
                    const isSelected = colabSeleccionado?.IdColaborador === c.IdColaborador;
                    return (
                      <div
                        key={c.IdColaborador}
                        onClick={() => setColabSeleccionado(c)}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected ? 'bg-blue-100/80 font-bold border-l-4 border-blue-700' : 'hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="text-slate-900 font-bold">{formatearEtiquetaSelector(c)}</div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {c.Puesto || 'Puesto General'} • {c.Departamento || 'General'}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                          {c.RolApp}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {colabSeleccionado && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Colaborador Seleccionado:</span> {formatearEtiquetaSelector(colabSeleccionado)}.
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Tendrá acceso global a autorizaciones de DO, Kárdex de las 8 empresas y Sincronización NOMIPAQ.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAsignar(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!colabSeleccionado || guardandoAsignar}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {guardandoAsignar ? 'Promoviendo...' : 'Confirmar Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REVOCAR ROL ADMIN_DO */}
      {colabRevocar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <UserMinus className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Revocar Rol ADMIN_DO</h3>
                  <p className="text-xs text-slate-500">{formatearNombreColaborador(colabRevocar)}</p>
                </div>
              </div>
              <button onClick={() => setColabRevocar(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmarRevocar} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿A qué rol base deseas reasignar a <strong>{formatearNombreColaborador(colabRevocar)}</strong> tras revocar sus privilegios de Recursos Humanos?
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nuevo Rol Operativo:
                </label>
                <select
                  value={nuevoRolRevocar}
                  onChange={(e) => setNuevoRolRevocar(e.target.value === 'LIDER' ? 'LIDER' : 'COLABORADOR')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-600 outline-none"
                >
                  <option value="COLABORADOR">COLABORADOR (Solo consulta su propio saldo)</option>
                  <option value="LIDER">LÍDER (Autoriza solicitudes de su equipo)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setColabRevocar(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRevocar}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {guardandoRevocar ? 'Revocando...' : 'Revocar Privilegios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
