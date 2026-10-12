import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, RefreshCw, KeyRound, Edit3, 
  ShieldCheck, AlertCircle, CheckCircle2, X, Phone, Heart, 
  Clock, Shield, ArrowUpDown, Copy, Check
} from 'lucide-react';
import { api } from '../api/client';

export default function AdminColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState([]);
  const [todosLosJefes, setTodosLosJefes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [estatus, setEstatus] = useState('ACTIVO');

  // Modales
  const [colabEditar, setColabEditar] = useState(null);
  const [formEditar, setFormEditar] = useState({});
  const [guardandoEditar, setGuardandoEditar] = useState(false);
  const [errorEditar, setErrorEditar] = useState('');

  const [colabReset, setColabReset] = useState(null);
  const [passwordManual, setPasswordManual] = useState('');
  const [resetResult, setResetResult] = useState(null);
  const [guardandoReset, setGuardandoReset] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toast
  const [toast, setToast] = useState('');

  const FALLBACK_EMPRESAS = [
    { idEmpresa: 1, aliasEmpresa: 'Cementos Moctezuma' },
    { idEmpresa: 2, aliasEmpresa: 'Construjama' },
    { idEmpresa: 3, aliasEmpresa: 'Controladora JAMA' },
    { idEmpresa: 4, aliasEmpresa: 'Distribuidor del Centro' },
    { idEmpresa: 5, aliasEmpresa: 'Distribuidora JAMA' },
    { idEmpresa: 6, aliasEmpresa: 'Impulsora de Negocios' },
    { idEmpresa: 7, aliasEmpresa: 'Latino Concretos' },
    { idEmpresa: 8, aliasEmpresa: 'Tramo del Centro' }
  ];

  const [empresasCatalog, setEmpresasCatalog] = useState(FALLBACK_EMPRESAS);

  useEffect(() => {
    async function fetchEmpresas() {
      try {
        const res = await api.getEmpresas();
        if (res.success && res.data && res.data.length > 0) {
          setEmpresasCatalog(res.data);
        }
      } catch (err) {
        console.warn('Usando catálogo estático de empresas en Admin:', err);
      }
    }
    fetchEmpresas();
  }, []);

  useEffect(() => {
    cargarColaboradores();
  }, [page, empresa, departamento, sucursal, estatus]);

  useEffect(() => {
    cargarCatalogoJefes();
  }, []);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  }

  async function cargarCatalogoJefes() {
    try {
      const res = await api.getColaboradoresAdmin('estatus=ACTIVO&limit=1000');
      if (res.success) {
        setTodosLosJefes(res.data);
      }
    } catch (err) {
      console.error('Error cargando catálogo de jefes:', err);
    }
  }

  async function cargarColaboradores() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '25');
      if (search.trim()) params.append('search', search.trim());
      if (empresa) {
        params.append('empresa_id', empresa);
        params.append('empresa', empresa);
      }
      if (departamento) params.append('departamento', departamento);
      if (sucursal) params.append('sucursal', sucursal);
      if (estatus) params.append('estatus', estatus);

      const res = await api.getColaboradoresAdmin(params.toString());
      if (res.success) {
        setColaboradores(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Error cargando colaboradores:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    cargarColaboradores();
  }

  function abrirModalEditar(c) {
    setColabEditar(c);
    setFormEditar({
      idJefeDirecto: c.IdJefeDirecto || '',
      diasDescanso: c.DiasDescanso || 'Domingos',
      rolApp: c.RolApp || 'COLABORADOR',
      telefono: c.Telefono || '',
      avisarEmergencia: c.AvisarEmergencia || '',
      parentescoEmergencia: c.ParentescoEmergencia || '',
      telefonoEmergencia: c.TelefonoEmergencia || '',
      tipoSangre: c.TipoSangre || '',
      alergiasPadecimientos: c.AlergiasPadecimientos || ''
    });
    setErrorEditar('');
  }

  async function handleGuardarEditar(e) {
    e.preventDefault();
    setErrorEditar('');
    try {
      setGuardandoEditar(true);
      const res = await api.updateColaboradorComplementarios(colabEditar.IdColaborador, formEditar);
      if (res.success) {
        mostrarToast(res.message);
        setColabEditar(null);
        cargarColaboradores();
      }
    } catch (err) {
      setErrorEditar(err.message || 'Error guardando información complementaria.');
    } finally {
      setGuardandoEditar(false);
    }
  }

  function abrirModalReset(c) {
    setColabReset(c);
    setPasswordManual(`JAMA-${Math.floor(1000 + Math.random() * 9000)}!`);
    setResetResult(null);
    setCopied(false);
  }

  async function handleEjecutarReset(e) {
    e.preventDefault();
    try {
      setGuardandoReset(true);
      const res = await api.resetColaboradorPasswordAdmin(colabReset.IdColaborador, {
        passwordTemporal: passwordManual
      });
      if (res.success) {
        setResetResult(res);
        cargarColaboradores();
      }
    } catch (err) {
      alert('Error restableciendo contraseña: ' + err.message);
    } finally {
      setGuardandoReset(false);
    }
  }

  function copiarPassword() {
    if (resetResult?.passwordTemporal) {
      navigator.clipboard.writeText(resetResult.passwordTemporal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
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
              Desarrollo Organizacional & TI
            </span>
            <span className="text-xs text-slate-400">• Catálogo Central</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Catálogo Administrativo de Colaboradores
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de jerarquía de aprobación, rol aplicativo, datos médicos, contactos de emergencia y credenciales de acceso.
          </p>
        </div>

        <button
          onClick={cargarColaboradores}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Catálogo
        </button>
      </div>

      {/* Barra de Filtros en Cascada */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          
          {/* Buscador de texto */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Nombre, Nómina, CURP o RFC..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
            />
          </div>

          {/* Filtro Empresa */}
          <select
            value={empresa}
            onChange={(e) => { setEmpresa(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-blue-600 outline-none max-w-[210px]"
          >
            <option value="">Todas las Empresas ({empresasCatalog.length})</option>
            {empresasCatalog.map(emp => (
              <option key={emp.idEmpresa || emp.id} value={emp.idEmpresa || emp.id}>
                {emp.aliasEmpresa || emp.alias}
              </option>
            ))}
          </select>

          {/* Filtro Estatus */}
          <select
            value={estatus}
            onChange={(e) => { setEstatus(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-blue-600 outline-none"
          >
            <option value="ACTIVO">Solo Activos</option>
            <option value="BAJA">Solo Bajas</option>
            <option value="TODOS">Todos los Registros</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Tabla de Colaboradores */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nómina / Código</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Empresa / Sucursal</th>
                <th className="py-3 px-4">Departamento / Puesto</th>
                <th className="py-3 px-4">Jefe Directo (Aprobador)</th>
                <th className="py-3 px-4">Rol App</th>
                <th className="py-3 px-4">Estatus</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Consultando catálogo de colaboradores...</span>
                    </div>
                  </td>
                </tr>
              ) : colaboradores.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No se encontraron colaboradores con los filtros especificados.
                  </td>
                </tr>
              ) : (
                colaboradores.map((c) => (
                  <tr key={c.IdColaborador} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {c.CodigoEmpleado}
                      {c.Subfijo && <span className="block text-[10px] text-slate-400">{c.Subfijo}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{c.NombreCompleto}</span>
                      <span className="text-[11px] text-slate-400">{c.Email || 'Sin correo registrado'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block truncate max-w-[170px]">{c.Empresa}</span>
                      <span className="text-[11px] text-slate-400">{c.Sucursal || 'Matriz'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-800 font-medium block truncate max-w-[170px]">{c.Departamento || 'General'}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[170px] block">{c.Puesto || '—'}</span>
                    </td>
                    <td className="py-3 px-4">
                      {c.JefeDirectoNombre ? (
                        <span className="font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                          {c.JefeDirectoNombre}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Sin Jefe Directo</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                        c.RolApp === 'ADMIN_DO' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        c.RolApp === 'LIDER' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {c.RolApp}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                        c.Activo ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${c.Activo ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {c.Activo ? 'Alta' : 'Baja'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => abrirModalEditar(c)}
                          title="Editar Información Complementaria (Jefe, Descanso, Emergencia)"
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => abrirModalReset(c)}
                          title="Restablecer Contraseña Institucional"
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Clave</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando página {page} de {totalPages} ({total} colaboradores totales)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: EDICIÓN DE CAMPOS COMPLEMENTARIOS (PROTEGIDOS DE NOMIPAQ) */}
      {colabEditar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200 uppercase">
                  Datos Complementarios Protegidos
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Editar Colaborador: {colabEditar.NombreCompleto}
                </h3>
                <p className="text-xs text-slate-500 font-mono">Nómina: {colabEditar.CodigoEmpleado} • {colabEditar.Empresa}</p>
              </div>
              <button onClick={() => setColabEditar(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorEditar && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorEditar}</span>
              </div>
            )}

            <form onSubmit={handleGuardarEditar} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Jefe Directo */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jefe Directo (Aprobador de Vacaciones en App)
                  </label>
                  <select
                    value={formEditar.idJefeDirecto}
                    onChange={(e) => setFormEditar({ ...formEditar, idJefeDirecto: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="">-- Sin Jefe Directo Asignado --</option>
                    {todosLosJefes
                      .filter(j => j.IdColaborador !== colabEditar.IdColaborador)
                      .map(j => (
                        <option key={j.IdColaborador} value={j.IdColaborador}>
                          {j.NombreCompleto} ({j.CodigoEmpleado} - {j.Empresa})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Rol App */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rol en la Aplicación
                  </label>
                  <select
                    value={formEditar.rolApp}
                    onChange={(e) => setFormEditar({ ...formEditar, rolApp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="COLABORADOR">COLABORADOR (Solicitante estándar)</option>
                    <option value="LIDER">LÍDER (Jefe con bandeja de autorización)</option>
                    <option value="ADMIN_DO">ADMIN_DO (Desarrollo Organizacional)</option>
                  </select>
                </div>

                {/* Días de Descanso */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Días de Descanso
                  </label>
                  <input
                    type="text"
                    value={formEditar.diasDescanso}
                    onChange={(e) => setFormEditar({ ...formEditar, diasDescanso: e.target.value })}
                    placeholder="Ej. Domingos / Sábado y Domingo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                {/* Teléfono Particular */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono / Celular Particular
                  </label>
                  <input
                    type="text"
                    value={formEditar.telefono}
                    onChange={(e) => setFormEditar({ ...formEditar, telefono: e.target.value })}
                    placeholder="Ej. 4441234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                {/* Tipo de Sangre */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Sangre
                  </label>
                  <input
                    type="text"
                    value={formEditar.tipoSangre}
                    onChange={(e) => setFormEditar({ ...formEditar, tipoSangre: e.target.value })}
                    placeholder="Ej. O+, A+, B+, etc."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                {/* Contacto de Emergencia: Nombre */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Avisar en Caso de Emergencia (Nombre)
                  </label>
                  <input
                    type="text"
                    value={formEditar.avisarEmergencia}
                    onChange={(e) => setFormEditar({ ...formEditar, avisarEmergencia: e.target.value })}
                    placeholder="Nombre del familiar o contacto"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                {/* Parentesco y Teléfono de Emergencia */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Parentesco
                    </label>
                    <input
                      type="text"
                      value={formEditar.parentescoEmergencia}
                      onChange={(e) => setFormEditar({ ...formEditar, parentescoEmergencia: e.target.value })}
                      placeholder="Esposa, Padre..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Teléfono Emerg.
                    </label>
                    <input
                      type="text"
                      value={formEditar.telefonoEmergencia}
                      onChange={(e) => setFormEditar({ ...formEditar, telefonoEmergencia: e.target.value })}
                      placeholder="Teléfono"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>

                {/* Alergias / Padecimientos */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alergias / Padecimientos Médicos
                  </label>
                  <input
                    type="text"
                    value={formEditar.alergiasPadecimientos}
                    onChange={(e) => setFormEditar({ ...formEditar, alergiasPadecimientos: e.target.value })}
                    placeholder="Alergias a medicamentos, padecimientos crónicos, etc."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  🔒 Campos blindados: NUNCA son sobreescritos al sincronizar con CONTPAQi.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColabEditar(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoEditar}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {guardandoEditar ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESTABLECIMIENTO DE CONTRASEÑA */}
      {colabReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <KeyRound className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Restablecer Contraseña</h3>
                  <p className="text-xs text-slate-500">{colabReset.NombreCompleto}</p>
                </div>
              </div>
              <button onClick={() => setColabReset(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetResult ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Contraseña Restablecida!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    La clave temporal ha sido actualizada en la base de datos con la bandera <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono font-bold">debe_cambiar_password = 1</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Contraseña Temporal Asignada:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={resetResult.passwordTemporal}
                      className="flex-1 px-3.5 py-2.5 bg-slate-100 font-mono font-black text-slate-900 text-sm rounded-xl border border-slate-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={copiarPassword}
                      className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setColabReset(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEjecutarReset} className="mt-4 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Define una contraseña temporal para este usuario o utiliza la clave segura generada automáticamente. Al ingresar, el sistema le exigirá definir una nueva clave personal.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contraseña Temporal (mínimo 8 caracteres):
                  </label>
                  <input
                    type="text"
                    required
                    value={passwordManual}
                    onChange={(e) => setPasswordManual(e.target.value)}
                    placeholder="Ej. JAMA-2026!"
                    className="w-full px-3.5 py-2.5 bg-slate-50 font-mono font-bold text-slate-900 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setColabReset(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoReset}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {guardandoReset ? 'Restableciendo...' : 'Restablecer Clave'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
