import React, { useState, useEffect } from 'react';
import { 
  Users, Search, RefreshCw, FileText, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, Phone, Mail, Building2, 
  MapPin, Eye, ChevronRight, X, Sparkles, Shield, UserCheck, 
  FileSpreadsheet, ArrowUpRight, Baby, Heart, Briefcase, User, ArrowUpDown
} from 'lucide-react';
import { api } from '../api/client';
import KardexVacaciones from '../components/KardexVacaciones';
import RefreshButton from '../components/RefreshButton';
import { 
  formatearNombreColaborador, 
  compararPorApellidos, 
  obtenerInicialesColaborador 
} from '../utils/formatters';

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 'No especificada';
  try {
    const nacimiento = new Date(fechaNacimiento);
    if (isNaN(nacimiento.getTime())) return 'No especificada';
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    if (edad <= 0) {
      const meses = Math.max(0, (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + hoy.getMonth() - nacimiento.getMonth());
      return meses === 1 ? '1 mes' : `${meses} meses`;
    }
    return `${edad} ${edad === 1 ? 'año' : 'años'}`;
  } catch (e) {
    return 'No especificada';
  }
}

export default function LiderMiEquipoPage({ currentUser }) {
  const [equipo, setEquipo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sortDirection, setSortDirection] = useState('asc'); // defaultSort A - Z por Apellidos

  // Modales
  const [modalKardexColab, setModalKardexColab] = useState(null);
  const [kardexData, setKardexData] = useState(null);
  const [loadingKardex, setLoadingKardex] = useState(false);

  const [modalSolicitudesColab, setModalSolicitudesColab] = useState(null);
  const [solicitudesData, setSolicitudesData] = useState([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);

  // Modal Ficha / Dependientes
  const [modalFichaColab, setModalFichaColab] = useState(null);
  const [fichaData, setFichaData] = useState(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  useEffect(() => {
    cargarEquipo();
  }, [currentUser]);

  async function cargarEquipo() {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.getMiEquipoLider();
      if (res.success) {
        setEquipo(res.data || []);
      } else {
        setErrorMsg(res.error || 'No fue posible cargar el equipo a cargo.');
      }
    } catch (err) {
      console.error('Error cargando equipo del líder:', err);
      setErrorMsg(err.message || 'Error de conexión al consultar equipo.');
    } finally {
      setLoading(false);
    }
  }

  async function abrirModalKardex(colab) {
    setModalKardexColab(colab);
    setLoadingKardex(true);
    setKardexData(null);
    try {
      const res = await api.getKardexColaborador(colab.idColaborador);
      if (res.success) {
        setKardexData(res);
      }
    } catch (err) {
      console.error('Error cargando kárdex del colaborador:', err);
      alert('Error cargando kárdex: ' + (err.message || 'Acceso denegado o no disponible'));
    } finally {
      setLoadingKardex(false);
    }
  }

  async function abrirModalSolicitudes(colab) {
    setModalSolicitudesColab(colab);
    setLoadingSolicitudes(true);
    setSolicitudesData([]);
    try {
      const res = await api.getSolicitudesColaborador(colab.idColaborador);
      if (res.success) {
        setSolicitudesData(res.data || []);
      }
    } catch (err) {
      console.error('Error cargando solicitudes del colaborador:', err);
      alert('Error cargando solicitudes: ' + (err.message || 'Acceso denegado'));
    } finally {
      setLoadingSolicitudes(false);
    }
  }

  async function abrirModalFicha(colab) {
    setModalFichaColab(colab);
    setLoadingFicha(true);
    setFichaData(null);
    try {
      const colabId = colab.idColaborador || colab.IdColaborador || colab.id;
      const res = await api.getColaborador(colabId);
      if (res.success) {
        setFichaData(res.data);
      }
    } catch (err) {
      console.error('Error cargando ficha del colaborador:', err);
      alert('Error cargando expediente: ' + (err.message || 'No disponible'));
    } finally {
      setLoadingFicha(false);
    }
  }

  // Filtrado reactivo en memoria por Nombre, Código o Puesto con Ordenamiento Alfabético Obligatorio A - Z por Apellidos
  const colaboradoresFiltrados = equipo
    .filter(c => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const nombre = formatearNombreColaborador(c).toLowerCase();
      const codigo = (c.codigoEmpleado || '').toLowerCase();
      const puesto = (c.puesto || '').toLowerCase();
      const sucursal = (c.sucursal || '').toLowerCase();
      return nombre.includes(term) || codigo.includes(term) || puesto.includes(term) || sucursal.includes(term);
    })
    .sort((a, b) => compararPorApellidos(a, b, sortDirection));

  // Métricas del equipo
  const totalIntegrantes = equipo.length;
  const totalDiasDisponibles = equipo.reduce((acc, c) => acc + (c.diasDisponibles || 0), 0);
  const totalDiasGozados = equipo.reduce((acc, c) => acc + (c.diasGozados || 0), 0);
  const promedioDias = totalIntegrantes > 0 ? (totalDiasDisponibles / totalIntegrantes).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
              Liderazgo & Jefatura Directa
            </span>
            <span className="text-xs text-slate-400">• Plantilla a Cargo</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Mi Equipo de Trabajo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervisión directa, saldos de vacaciones LFT y trazabilidad de ausencias para tu equipo reportante ({currentUser?.nombreCompleto || 'Líder'}).
          </p>
        </div>

        <RefreshButton
          onClick={cargarEquipo}
          isLoading={loading}
          label="Actualizar Plantilla de Equipo"
          loadingLabel="Actualizando..."
        />
      </div>

      {/* KPI Cards de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Colaboradores a Cargo</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalIntegrantes}</p>
            <span className="text-[11px] text-slate-500">Reportan a tu jerarquía directa</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Días Disponibles Equipo</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalDiasDisponibles} <span className="text-xs font-bold text-emerald-700">días</span></p>
            <span className="text-[11px] text-slate-500">Saldo acumulado vigente LFT</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Días Gozados / Disfrutados</span>
            <p className="text-2xl font-black text-purple-600 mt-1">{totalDiasGozados} <span className="text-xs font-bold text-purple-700">días</span></p>
            <span className="text-[11px] text-slate-500">Vacaciones tomadas históricas</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Promedio Saldo / Empleado</span>
            <p className="text-2xl font-black text-amber-600 mt-1">{promedioDias} <span className="text-xs font-bold text-amber-700">días</span></p>
            <span className="text-[11px] text-slate-500">Disponibilidad media por persona</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nombre, Código de Nómina, Puesto o Sucursal..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-xs font-semibold text-slate-500 shrink-0">
          Mostrando <span className="font-black text-slate-800">{colaboradoresFiltrados.length}</span> de {equipo.length} colaboradores
        </div>
      </div>

      {/* Mensaje de Error si ocurre */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabla de Mi Equipo */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-600" />
            <p className="text-xs font-semibold">Cargando personal a tu cargo...</p>
          </div>
        ) : colaboradoresFiltrados.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No se encontraron colaboradores</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm 
                ? 'Ningún integrante de tu equipo coincide con el criterio de búsqueda.'
                : 'Actualmente no tienes colaboradores asignados con reporte directo.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4 min-w-[170px]">
                    <button
                      type="button"
                      onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                      className="flex items-center gap-1.5 font-bold text-slate-600 hover:text-amber-800 cursor-pointer uppercase text-[10px] tracking-wider transition"
                      title="Ordenamiento Alfabético Obligatorio A - Z por Apellidos"
                    >
                      <span>Colaborador</span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-black border border-amber-300">
                        <ArrowUpDown className="w-2.5 h-2.5" />
                        {sortDirection === 'asc' ? 'A - Z' : 'Z - A'}
                      </span>
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Puesto</th>
                  <th className="py-3.5 px-4">Sucursal</th>
                  <th className="py-3.5 px-4">Fecha Ingreso</th>
                  <th className="py-3.5 px-4 text-center">Saldo Disponible (LFT)</th>
                  <th className="py-3.5 px-4 text-center">Estatus</th>
                  <th className="py-3.5 px-4">Contacto</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colaboradoresFiltrados.map((c) => {
                  const initials = obtenerInicialesColaborador(c);

                  return (
                    <tr key={c.idColaborador} className="hover:bg-amber-50/30 transition-colors">
                      {/* Código de Nómina */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {c.codigoEmpleado || '—'}
                      </td>

                      {/* Nombre Completo con Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px] shrink-0 border border-amber-200">
                            {initials}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block leading-tight">
                              {formatearNombreColaborador(c)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: #{c.idColaborador}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Puesto */}
                      <td className="py-3 px-4 text-slate-700 font-medium max-w-[200px] truncate" title={c.puesto}>
                        {c.puesto || 'Sin Puesto'}
                      </td>

                      {/* Sucursal */}
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.sucursal || 'Matriz'}</span>
                        </div>
                      </td>

                      {/* Fecha de Ingreso */}
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.fechaAlta || '—'}</span>
                        </div>
                      </td>

                      {/* Saldo de Vacaciones Disponible */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                            c.diasDisponibles > 0 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}>
                            {c.diasDisponibles} días
                          </span>
                          {c.diasGozados > 0 && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {c.diasGozados} gozados
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estatus */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                          c.activo !== false 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {c.estatus || 'ACTIVO'}
                        </span>
                      </td>

                      {/* Teléfono y Correo */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          {c.telefono && c.telefono !== '—' && (
                            <div className="flex items-center gap-1.5 text-slate-600 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{c.telefono}</span>
                            </div>
                          )}
                          {c.email && c.email !== '—' && (
                            <div className="flex items-center gap-1.5 text-slate-500 truncate max-w-[170px]" title={c.email}>
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {(!c.telefono || c.telefono === '—') && (!c.email || c.email === '—') && (
                            <span className="text-slate-400 italic text-[10px]">Sin contacto</span>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Ver Ficha / Expediente */}
                          <button
                            onClick={() => abrirModalFicha(c)}
                            title="Ver Ficha Técnica, Contacto y Dependientes Familiares"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ficha</span>
                          </button>

                          {/* Botón Ver Kárdex */}
                          <button
                            onClick={() => abrirModalKardex(c)}
                            title="Ver resumen y kárdex individual LFT"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Kárdex</span>
                          </button>

                          {/* Botón Ver Solicitudes */}
                          <button
                            onClick={() => abrirModalSolicitudes(c)}
                            title="Ver historial de solicitudes de vacaciones"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Solicitudes</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: KÁRDEX INDIVIDUAL DE VACACIONES LFT                              */}
      {/* ========================================================================= */}
      {modalKardexColab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Kárdex Oficial de Vacaciones LFT
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {formatearNombreColaborador(modalKardexColab)} • Nómina: {modalKardexColab.codigoEmpleado}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalKardexColab(null)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Ficha Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Puesto</span>
                  <span className="font-bold text-slate-800">{modalKardexColab.puesto || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sucursal</span>
                  <span className="font-bold text-slate-800">{modalKardexColab.sucursal || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Fecha Ingreso</span>
                  <span className="font-bold text-slate-800 font-mono">{modalKardexColab.fechaAlta || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Antigüedad</span>
                  <span className="font-bold text-slate-800">
                    {modalKardexColab.antiguedadAnios !== undefined && modalKardexColab.antiguedadAnios !== null
                      ? `${modalKardexColab.antiguedadAnios} ${Number(modalKardexColab.antiguedadAnios) === 1 ? 'año' : 'años'}`
                      : (modalKardexColab.fechaAlta 
                          ? `${Math.max(0, Math.floor((new Date() - new Date(modalKardexColab.fechaAlta)) / (365.25 * 24 * 3600 * 1000)))} años`
                          : '—')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Saldo Disponible (Vigente)</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {kardexData?.saldoTotalDisponible ?? modalKardexColab.diasDisponibles ?? 0} días
                  </span>
                </div>
              </div>

              {/* Tabla de Períodos Kárdex */}
              {loadingKardex ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-semibold">Consultando períodos del kárdex...</p>
                </div>
              ) : !kardexData?.periodos || kardexData.periodos.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No se encontraron períodos acumulados para este colaborador.</p>
                </div>
              ) : (
                <KardexVacaciones 
                  periodos={kardexData.periodos} 
                  colaborador={kardexData.colaborador || modalKardexColab} 
                  resumen={kardexData.resumen}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                Cálculos bajo la Reforma de Vacaciones Dignas 2023 (Art. 76 y 81 LFT)
              </span>
              <button
                onClick={() => setModalKardexColab(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: HISTORIAL DE SOLICITUDES DEL COLABORADOR                         */}
      {/* ========================================================================= */}
      {modalSolicitudesColab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Historial de Solicitudes de Vacaciones
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {formatearNombreColaborador(modalSolicitudesColab)} • Nómina: {modalSolicitudesColab.codigoEmpleado}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalSolicitudesColab(null)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {loadingSolicitudes ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                  <p className="text-xs font-semibold">Cargando solicitudes...</p>
                </div>
              ) : solicitudesData.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Sin Solicitudes Registradas</p>
                  <p className="text-xs text-slate-400 mt-1">Este colaborador no tiene solicitudes de vacaciones creadas en el sistema.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                        <th className="py-2.5 px-3">Folio</th>
                        <th className="py-2.5 px-3">Período de Ausencia</th>
                        <th className="py-2.5 px-3 text-center">Días Hábiles</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Motivo / Comentarios</th>
                        <th className="py-2.5 px-3 text-right">Fecha Solicitud</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {solicitudesData.map(s => {
                        const badgeColor = {
                          'APROBADA': 'bg-emerald-100 text-emerald-800 border-emerald-300',
                          'PENDIENTE_LIDER': 'bg-amber-100 text-amber-800 border-amber-300',
                          'PENDIENTE_DO': 'bg-blue-100 text-blue-800 border-blue-300',
                          'RECHAZADA': 'bg-rose-100 text-rose-800 border-rose-300',
                          'CANCELADA': 'bg-slate-100 text-slate-600 border-slate-300'
                        }[s.Estado] || 'bg-slate-100 text-slate-600 border-slate-300';

                        return (
                          <tr key={s.IdSolicitud} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {s.Folio}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {(() => {
                                const fInicio = s.FechaInicio || s.fechaInicio || s.fecha_inicio;
                                const fFin = s.FechaFin || s.fechaFin || s.fecha_fin;
                                if (!fInicio || !fFin) return <span className="text-slate-400 italic text-xs">Sin fechas</span>;
                                const fmt = (v) => {
                                  try {
                                    const [y, m, d] = String(v).split('T')[0].split('-');
                                    return (y && m && d) ? `${d}/${m}/${y}` : String(v);
                                  } catch { return String(v); }
                                };
                                return `${fmt(fInicio)} al ${fmt(fFin)}`;
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-blue-700">
                              {s.TotalDiasLaborables} días
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${badgeColor}`}>
                                {s.Estado}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={s.MotivoComentarios}>
                              {s.MotivoComentarios || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-[11px]">
                              {s.FechaCreacion || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                Total de solicitudes: {solicitudesData.length}
              </span>
              <button
                onClick={() => setModalSolicitudesColab(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: FICHA DEL COLABORADOR / EQUIPO (CONTACTO Y DEPENDIENTES) */}
      {modalFichaColab && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                  {obtenerInicialesColaborador(modalFichaColab)}
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200 uppercase">
                    Ficha de Integrante de Equipo
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-1">
                    {formatearNombreColaborador(modalFichaColab)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nómina: <span className="font-mono font-bold text-slate-700">{modalFichaColab.codigoEmpleado}</span> • {modalFichaColab.puesto}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalFichaColab(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingFicha ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                <p className="text-xs font-semibold">Cargando expediente y dependientes...</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Datos de Contacto y Emergencia */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-600" />
                    <span>Contacto Directo & Emergencia</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Teléfono / Celular</span>
                      <span className="font-mono font-bold text-slate-800">{fichaData?.Telefono || modalFichaColab.telefono || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Correo Institucional</span>
                      <span className="text-slate-700 truncate block">{fichaData?.Email || modalFichaColab.email || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Contacto de Emergencia</span>
                      <span className="font-semibold text-slate-800">{fichaData?.AvisarEmergencia || 'Sin registrar'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Teléfono Emergencia</span>
                      <span className="font-mono font-bold text-rose-700">{fichaData?.TelefonoEmergencia || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Tipo de Sangre</span>
                      <span className="font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">{fichaData?.TipoSangre || 'No registrado'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Alergias</span>
                      <span className="text-slate-700">{fichaData?.AlergiasPadecimientos || 'Ninguna'}</span>
                    </div>
                  </div>
                </div>

                {/* Hijos / Dependientes */}
                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Baby className="w-4 h-4 text-pink-600" />
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Hijos & Dependientes Familiares
                      </h4>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-pink-50 text-pink-700 rounded-full border border-pink-200">
                      {(fichaData?.hijos || []).length} {((fichaData?.hijos || []).length === 1) ? 'hijo registrado' : 'hijos registrados'}
                    </span>
                  </div>

                  {(!fichaData?.hijos || fichaData.hijos.length === 0) ? (
                    <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      <Baby className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                      Este colaborador no cuenta con hijos o dependientes registrados en su expediente.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {fichaData.hijos.map((h, i) => {
                        const fn = h.FechaNacimiento || h.fechaNacimiento;
                        const sx = (h.Sexo || h.sexo || '').toUpperCase();
                        const num = h.NumeroHijo || h.numeroHijo || (i + 1);
                        const nom = (h.Nombre || h.nombre || '').trim();
                        return (
                          <div key={h.IdHijo || h.idHijo || i} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-800">
                                  Hijo #{num}{nom ? ` • ${nom}` : ''}
                                </span>
                                {sx === 'M' ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">Niño</span>
                                ) : sx === 'F' ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-pink-100 text-pink-800 rounded">Niña</span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">Indef.</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Nacimiento: <span className="font-mono text-slate-700">{fn ? new Date(fn).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'No especificada'}</span>
                              </p>
                              <p className="text-[11px] font-bold text-slate-700">
                                Edad: <span className="text-indigo-600">{calcularEdad(fn)}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={() => setModalFichaColab(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
