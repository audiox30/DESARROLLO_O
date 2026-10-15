import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, RefreshCw, Database, Download, Calendar, 
  Users, CheckCircle2, Clock, XCircle, Search, Filter, 
  Plus, Trash2, AlertTriangle, ArrowUpRight, Sparkles, FileSpreadsheet, FileText,
  AlertCircle, X, Eye
} from 'lucide-react';
import { api } from '../api/client';
import ModalAprobacion from '../components/ModalAprobacion';
import KardexVacaciones from '../components/KardexVacaciones';
import RefreshButton from '../components/RefreshButton';
import { formatearNombreColaborador, compararPorApellidos } from '../utils/formatters';

export default function AdminDOPanel({ currentUser }) {
  const [tab, setTab] = useState('solicitudes'); // 'solicitudes', 'sync', 'festivos', 'kardex'
  
  // Solicitudes
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODAS');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [busquedaSolicitudes, setBusquedaSolicitudes] = useState('');
  const [ordenSolicitudes, setOrdenSolicitudes] = useState('recientes'); // 'recientes' | 'alfabetico'
  const [loadingSol, setLoadingSol] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalResolucion, setModalResolucion] = useState(false);

  // Sync NOMIPAQ
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncPreview, setSyncPreview] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [modalPreview, setModalPreview] = useState(false);

  // Días Inhábiles
  const [diasInhabiles, setDiasInhabiles] = useState([]);
  const [nuevoDiaFecha, setNuevoDiaFecha] = useState('');
  const [nuevoDiaDesc, setNuevoDiaDesc] = useState('');
  const [nuevoDiaOficial, setNuevoDiaOficial] = useState(true);

  // Kárdex
  const [kardexList, setKardexList] = useState([]);
  const [busquedaKardex, setBusquedaKardex] = useState('');
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [modalKardexColab, setModalKardexColab] = useState(null);
  const [kardexData, setKardexData] = useState(null);
  const [loadingKardexDetalle, setLoadingKardexDetalle] = useState(false);

  // Mensaje Toast
  const [toast, setToast] = useState('');

  useEffect(() => {
    cargarSolicitudes();
    cargarSyncInfo();
    cargarDiasInhabiles();
    cargarKardex();
  }, []);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  }

  // 1. Solicitudes
  async function cargarSolicitudes() {
    try {
      setLoadingSol(true);
      const params = new URLSearchParams();
      if (filtroEmpresa) params.append('empresa', filtroEmpresa);
      const res = await api.getBandejaDO(params.toString());
      if (res.success) {
        setSolicitudes(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSol(false);
    }
  }

  // Lógica de filtrado reactivo en frontend por Estado, Búsqueda y Ordenamiento
  const solicitudesFiltradas = useMemo(() => {
    if (!solicitudes) return [];
    let list = solicitudes;

    // 1. Filtro por Estado
    if (filtroEstado !== 'TODAS') {
      list = list.filter((item) => {
        const estadoItem = (item.Estado || item.estado || '').toUpperCase();
        switch (filtroEstado) {
          case 'VoBo DO Pendiente':
            return estadoItem === 'PENDIENTE_DO' || estadoItem === 'VOBO DO PENDIENTE';
          case 'Pendiente Líder':
            return estadoItem === 'PENDIENTE_LIDER' || estadoItem === 'PENDIENTE LÍDER' || estadoItem === 'PENDIENTE LIDER';
          case 'Pendiente Gerente':
            return estadoItem === 'PENDIENTE_GERENTE' || estadoItem === 'PENDIENTE GERENTE';
          case 'APROBADA':
            return estadoItem === 'APROBADA' || estadoItem === 'AUTORIZADA';
          case 'RECHAZADA':
            return estadoItem === 'RECHAZADA';
          default:
            return true;
        }
      });
    }

    // 2. Filtro por Búsqueda (Folio, Colaborador, Nómina, Puesto, Empresa)
    if (busquedaSolicitudes.trim()) {
      const q = busquedaSolicitudes.toLowerCase().trim();
      list = list.filter((item) => {
        const folio = (item.folio || item.Folio || '').toLowerCase();
        const nombre = (item.colaboradorNombre || item.NombreCompleto || '').toLowerCase();
        const nomina = (item.codigoEmpleado || item.CodigoEmpleado || '').toLowerCase();
        const puesto = (item.colaboradorPuesto || item.Puesto || '').toLowerCase();
        const empresa = (item.colaboradorEmpresa || item.Empresa || '').toLowerCase();
        return folio.includes(q) || nombre.includes(q) || nomina.includes(q) || puesto.includes(q) || empresa.includes(q);
      });
    }

    // 3. Ordenamiento
    const sorted = [...list];
    if (ordenSolicitudes === 'alfabetico') {
      sorted.sort((a, b) => compararPorApellidos(a.colaboradorNombre, b.colaboradorNombre, 'asc'));
    } else {
      // Recientes primero por IdSolicitud / FechaCreacion descendente
      sorted.sort((a, b) => {
        const idA = Number(a.idSolicitud || a.IdSolicitud || 0);
        const idB = Number(b.idSolicitud || b.IdSolicitud || 0);
        return idB - idA;
      });
    }

    return sorted;
  }, [solicitudes, filtroEstado, busquedaSolicitudes, ordenSolicitudes]);

  // 2. Sync NOMIPAQ
  async function cargarSyncInfo() {
    try {
      const [stRes, logsRes] = await Promise.all([
        api.getSyncStatus(),
        api.getSyncLogs()
      ]);
      if (stRes.success) setSyncStatus(stRes);
      if (logsRes.success) setSyncLogs(logsRes.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleVerPreview() {
    try {
      setSyncLoading(true);
      const res = await api.getSyncPreview();
      if (res.success) {
        setSyncPreview(res);
        setModalPreview(true);
      }
    } catch (err) {
      alert('Error cargando preview: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  }

  const [syncTask, setSyncTask] = useState(null);

  async function handleEjecutarSync() {
    if (!window.confirm('¿Confirmas la sincronización de las 8 bases de datos de CONTPAQi Nóminas hacia DESARROLLO_O?')) return;
    try {
      setSyncLoading(true);
      const res = await api.sincronizarEmpleados();
      if (res.success) {
        mostrarToast('Tarea de sincronización iniciada en segundo plano...');
        iniciarSondeoTarea(res.taskId);
      }
    } catch (err) {
      alert('Error iniciando sincronización: ' + err.message);
      setSyncLoading(false);
    }
  }

  function iniciarSondeoTarea(taskId) {
    const intervalo = setInterval(async () => {
      try {
        const res = await api.getSyncTaskStatus(taskId);
        if (res.success && res.task) {
          setSyncTask(res.task);
          if (res.task.estado === 'COMPLETED') {
            clearInterval(intervalo);
            setSyncLoading(false);
            mostrarToast('¡Sincronización multi-empresa completada con éxito!');
            cargarSyncInfo();
            cargarKardex();
          } else if (res.task.estado === 'ERROR') {
            clearInterval(intervalo);
            setSyncLoading(false);
            alert('Error en tarea de sincronización: ' + res.task.error);
          }
        }
      } catch (err) {
        console.error('Error sondeando tarea:', err);
      }
    }, 1500);
  }

  // 3. Días Inhábiles
  async function cargarDiasInhabiles() {
    try {
      const res = await api.getDiasInhabiles();
      if (res.success) setDiasInhabiles(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAgregarDia(e) {
    e.preventDefault();
    if (!nuevoDiaFecha || !nuevoDiaDesc) return;
    try {
      const res = await api.agregarDiaInhabil({
        fecha: nuevoDiaFecha,
        descripcion: nuevoDiaDesc,
        esFeriadoOficial: nuevoDiaOficial
      });
      if (res.success) {
        mostrarToast('Día inhábil registrado con éxito.');
        setNuevoDiaFecha('');
        setNuevoDiaDesc('');
        cargarDiasInhabiles();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleEliminarDia(fecha) {
    if (!window.confirm(`¿Eliminar el día festivo/inhábil ${fecha}?`)) return;
    try {
      const res = await api.eliminarDiaInhabil(fecha);
      if (res.success) {
        mostrarToast('Día eliminado.');
        cargarDiasInhabiles();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // 4. Kárdex
  async function cargarKardex() {
    try {
      setLoadingKardex(true);
      const res = await api.getKardexGlobal();
      if (res.success) {
        const sorted = (res.data || []).sort((a, b) => compararPorApellidos(a.nombreCompleto, b.nombreCompleto, 'asc'));
        setKardexList(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKardex(false);
    }
  }

  async function abrirModalKardex(colab) {
    setModalKardexColab(colab);
    setLoadingKardexDetalle(true);
    setKardexData(null);
    try {
      const id = colab.idColaborador || colab.id;
      const res = await api.getKardexColaborador(id);
      if (res.success) {
        setKardexData(res);
      } else {
        alert('Error cargando kárdex: ' + (res.error || 'No se pudo obtener el desglose'));
      }
    } catch (err) {
      console.error('Error cargando kárdex:', err);
      alert('Error al consultar desglose de saldo del colaborador: ' + (err.message || 'Error de red'));
    } finally {
      setLoadingKardexDetalle(false);
    }
  }

  const kardexFiltrado = kardexList.filter(c => {
    if (!busquedaKardex) return true;
    const b = busquedaKardex.toLowerCase();
    return (
      (c.nombreCompleto && c.nombreCompleto.toLowerCase().includes(b)) ||
      (c.codigoEmpleado && c.codigoEmpleado.toLowerCase().includes(b)) ||
      (c.puesto && c.puesto.toLowerCase().includes(b)) ||
      (c.departamento && c.departamento.toLowerCase().includes(b)) ||
      (c.empresa && c.empresa.toLowerCase().includes(b))
    );
  }).sort((a, b) => compararPorApellidos(a.nombreCompleto, b.nombreCompleto, 'asc'));

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast('')} className="text-slate-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      {/* Header Panel DO */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Panel de Desarrollo Organizacional (Admin DO)
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Administración Central
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gobernanza corporativa, visto bueno de nómina, días festivos LFT y sincronización con CONTPAQi Nóminas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <RefreshButton
            onClick={async () => {
              try {
                setLoadingSol(true);
                await Promise.all([cargarSolicitudes(), cargarSyncInfo(), cargarDiasInhabiles(), cargarKardex()]);
              } finally {
                setLoadingSol(false);
              }
            }}
            isLoading={loadingSol}
            label="Actualizar Solicitudes Globales"
            loadingLabel="Actualizando..."
          />
        </div>
      </div>

      {/* Pestañas de Navegación del Panel DO */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-2 border-b border-slate-100 bg-slate-50/70">
          <button
            onClick={() => setTab('solicitudes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              tab === 'solicitudes'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            Bandeja Global & VoBo DO ({filtroEstado === 'TODAS' ? solicitudes.length : `${solicitudesFiltradas.length} de ${solicitudes.length}`})
          </button>

          <button
            onClick={() => setTab('sync')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              tab === 'sync'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            Sincronización NOMIPAQ
          </button>

          <button
            onClick={() => setTab('festivos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              tab === 'festivos'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Días Inhábiles y Festivos LFT ({diasInhabiles.length})
          </button>

          <button
            onClick={() => setTab('kardex')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              tab === 'kardex'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Kárdex General & Exportación ({kardexList.length})
          </button>
        </div>

        {/* 1. TAB: BANDEJA GLOBAL & VOBO DO */}
        {tab === 'solicitudes' && (
          <div className="p-6 space-y-4">
            {/* Barra de Filtros Rápidos por Estado, Búsqueda y Ordenamiento */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Estado:
                </span>
                {['TODAS', 'VoBo DO Pendiente', 'Pendiente Líder', 'Pendiente Gerente', 'APROBADA', 'RECHAZADA'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFiltroEstado(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filtroEstado === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {/* Buscador de Folio / Colaborador */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busquedaSolicitudes}
                    onChange={(e) => setBusquedaSolicitudes(e.target.value)}
                    placeholder="Buscar folio (ej. 00011), colaborador..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {busquedaSolicitudes && (
                    <button
                      type="button"
                      onClick={() => setBusquedaSolicitudes('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Alternador de Ordenamiento */}
                <button
                  type="button"
                  onClick={() => setOrdenSolicitudes(prev => prev === 'recientes' ? 'alfabetico' : 'recientes')}
                  title={ordenSolicitudes === 'recientes' ? 'Orden actual: Más recientes primero' : 'Orden actual: Alfabético A - Z'}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>{ordenSolicitudes === 'recientes' ? 'Más recientes' : 'A - Z'}</span>
                </button>
              </div>
            </div>

            {/* Tabla de Solicitudes */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Folio</th>
                    <th className="py-3 px-3">Colaborador</th>
                    <th className="py-3 px-3">Empresa / Depto</th>
                    <th className="py-3 px-3">Período</th>
                    <th className="py-3 px-3 text-center">Días Hábiles</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Resolución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {solicitudesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Filter className="w-8 h-8 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-600">
                            No se encontraron solicitudes con el estado "{filtroEstado}".
                          </p>
                          {filtroEstado !== 'TODAS' && (
                            <button
                              type="button"
                              onClick={() => setFiltroEstado('TODAS')}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                            >
                              Ver todas ({solicitudes.length})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    solicitudesFiltradas.map((s) => (
                      <tr key={s.idSolicitud || s.IdSolicitud} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900">{s.folio}</td>
                        <td className="py-3.5 px-3 font-bold text-slate-800">
                          {formatearNombreColaborador(s.colaboradorNombre)}
                          <span className="block text-[10px] font-normal text-slate-400">{s.colaboradorPuesto}</span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          <span className="font-semibold block text-slate-900">
                            {s.colaboradorEmpresa || s.Empresa || s.empresa || 'Grupo JAMA'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {(s.colaboradorSucursal || s.Sucursal || s.sucursal) ? `${s.colaboradorSucursal || s.Sucursal || s.sucursal} • ` : ''}
                            {s.colaboradorDepartamento || s.Departamento || s.departamento || ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          {(() => {
                            const item = s;
                            const fInicio = item.FechaInicio || item.fechaInicio || item.fecha_inicio;
                            const fFin = item.FechaFin || item.fechaFin || item.fecha_fin;

                            if (!fInicio || !fFin) {
                              return <span className="text-slate-400 italic text-xs">Sin fechas</span>;
                            }

                            const formatearFechaSimple = (val) => {
                              try {
                                const str = String(val).split('T')[0];
                                const [y, m, d] = str.split('-');
                                if (y && m && d) return `${d}/${m}/${y}`;
                                return str;
                              } catch {
                                return String(val);
                              }
                            };

                            return (
                              <span className="font-medium text-slate-800 text-xs">
                                {formatearFechaSimple(fInicio)} al {formatearFechaSimple(fFin)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {s.totalDiasLaborables} d
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            s.estado === 'PENDIENTE_DO' ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse' :
                            s.estado === 'PENDIENTE_GERENTE' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                            s.estado === 'PENDIENTE_LIDER' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            s.estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {s.estado === 'PENDIENTE_DO' ? 'VoBo DO Pendiente' : 
                             s.estado === 'PENDIENTE_GERENTE' ? 'Pendiente Gerente' :
                             s.estado === 'PENDIENTE_LIDER' ? 'Pendiente Líder' : s.estado}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => api.descargarPdfFdo84(s.idSolicitud || s.IdSolicitud || s.id, s.folio || s.Folio)}
                              title="Ver y Descargar Formato Oficial FDO-84 (PDF)"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>FDO-84</span>
                            </button>
                            {['PENDIENTE_DO', 'PENDIENTE_LIDER', 'PENDIENTE_GERENTE'].includes(s.estado) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSolicitudSeleccionada(s);
                                  setModalResolucion(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                              >
                                Resolver VoBo
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Concluida</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. TAB: SINCRONIZACIÓN NOMIPAQ */}
        {tab === 'sync' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase">Instancia Remota NOMIPAQ</span>
                <p className="text-base font-extrabold text-slate-900 mt-1">8 Bases de Datos Desacopladas</p>
                <span className="text-[11px] text-slate-500 font-mono block mt-1">Conexión directa TCP/IP (Sin MSDTC)</span>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase">Base Local Operativa</span>
                <p className="text-base font-extrabold text-blue-700 mt-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-600" />
                  DESARROLLO_O
                </p>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Integridad: RolApp e IdJefeDirecto protegidos
                </span>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Sincronización en 2do Plano</span>
                  <p className="text-xs text-slate-600 mt-1">Lectura no transaccional (NOLOCK) + Staging Atómico Local</p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleEjecutarSync}
                    disabled={syncLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                    {syncLoading ? 'Sincronizando 8 Empresas...' : 'Sincronizar 8 Empresas (Background Task)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Barra de Progreso en Segundo Plano */}
            {syncTask && (
              <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Tarea: {syncTask.taskId} ({syncTask.estado})
                  </span>
                  <span className="font-mono text-blue-700 font-bold">
                    {syncTask.basesCompletadas} de {syncTask.totalBases} bases completadas
                  </span>
                </div>
                <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${(syncTask.basesCompletadas / syncTask.totalBases) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-blue-800">
                  <span className="truncate max-w-md">Procesando: <strong>{syncTask.empresaActual}</strong></span>
                  <span>Insertados: <strong>+{syncTask.totales.insertados}</strong> | Actualizados: <strong>~{syncTask.totales.actualizados}</strong></span>
                </div>
              </div>
            )}

            {/* Bitácora de Sincronización */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Bitácora de Sincronizaciones (Auditoría de Ingesta)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-4">Fecha y Hora</th>
                      <th className="py-2.5 px-4">Tipo</th>
                      <th className="py-2.5 px-4 text-center">Nuevos</th>
                      <th className="py-2.5 px-4 text-center">Actualizados</th>
                      <th className="py-2.5 px-4">Detalle del Proceso</th>
                      <th className="py-2.5 px-4 text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncLogs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-400">
                          No se encontraron registros en la bitácora de sincronización.
                        </td>
                      </tr>
                    ) : (
                      syncLogs.map((l, idx) => {
                        const fechaRaw = l.fechaEjecucion || l.FechaEjecucion;
                        let fechaFormateada = 'Sin fecha';
                        if (fechaRaw) {
                          try {
                            const d = new Date(fechaRaw);
                            fechaFormateada = isNaN(d.getTime()) ? String(fechaRaw) : d.toLocaleString('es-MX', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            });
                          } catch {
                            fechaFormateada = String(fechaRaw);
                          }
                        }

                        const tipo = l.tipoEjecucion || l.TipoEjecucion || 'MANUAL';
                        const insertados = l.registrosInsertados ?? l.RegistrosInsertados ?? 0;
                        const actualizados = l.registrosActualizados ?? l.RegistrosActualizados ?? 0;
                        const detalle = l.detalleLog || l.DetalleLog || l.NombreBaseDatos || 'Sincronización completada';
                        const esExitoso = l.exitoso !== false && l.Exitoso !== false;

                        return (
                          <tr key={l.idSync || l.IdSync || idx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono text-slate-700">{fechaFormateada}</td>
                            <td className="py-3 px-4 font-semibold text-slate-700">{tipo}</td>
                            <td className="py-3 px-4 text-center font-bold text-emerald-700">+{insertados}</td>
                            <td className="py-3 px-4 text-center font-bold text-blue-700">~{actualizados}</td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={detalle}>{detalle}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                esExitoso ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {esExitoso ? 'Exitoso' : 'Error'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. TAB: DÍAS FESTIVOS E INHÁBILES */}
        {tab === 'festivos' && (
          <div className="p-6 space-y-6">
            {/* Formulario Agregar Día */}
            <form onSubmit={handleAgregarDia} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                + Agregar Nuevo Día Inhábil / Asueto Institucional
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={nuevoDiaFecha}
                    onChange={(e) => setNuevoDiaFecha(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Descripción / Motivo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Aniversario Fundacional Grupo JAMA..."
                    value={nuevoDiaDesc}
                    onChange={(e) => setNuevoDiaDesc(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pb-2">
                    <input
                      type="checkbox"
                      checked={nuevoDiaOficial}
                      onChange={(e) => setNuevoDiaOficial(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    Feriado Oficial LFT
                  </label>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs"
                  >
                    Guardar Día
                  </button>
                </div>
              </div>
            </form>

            {/* Listado de Días */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-4">Descripción del Feriado</th>
                    <th className="py-2.5 px-4 text-center">Tipo</th>
                    <th className="py-2.5 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diasInhabiles.map((d) => (
                    <tr key={d.fecha} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{d.fecha}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{d.descripcion}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.esFeriadoOficial ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {d.esFeriadoOficial ? 'Oficial LFT Art. 74' : 'Asueto Empresa'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleEliminarDia(d.fecha)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                          title="Eliminar día"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. TAB: KÁRDEX GENERAL Y EXPORTACIÓN */}
        {tab === 'kardex' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador, código, puesto..."
                  value={busquedaKardex}
                  onChange={(e) => setBusquedaKardex(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <button
                onClick={() => api.descargarKardexCSV()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs"
              >
                <Download className="w-4 h-4" />
                Exportar Kárdex a Excel / CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px] z-10">
                  <tr>
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Colaborador</th>
                    <th className="py-3 px-3">Empresa</th>
                    <th className="py-3 px-3">Puesto</th>
                    <th className="py-3 px-3 text-center">Alta</th>
                    <th className="py-3 px-3 text-center">Antigüedad</th>
                    <th className="py-3 px-3 text-center">Días LFT</th>
                    <th className="py-3 px-3 text-center">Gozados</th>
                    <th className="py-3 px-3 text-center" title="Haga clic en los días de cualquier colaborador para ver su desglose por período">
                      Disponibles
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kardexFiltrado.map((c) => (
                    <tr key={c.idColaborador} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{c.codigoEmpleado}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{formatearNombreColaborador(c.nombreCompleto)}</td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[140px]">{c.empresa || 'Grupo JAMA'}</td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">{c.puesto}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">{c.fechaAlta}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{c.antiguedadAnios} años</td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-700">{c.diasCorrespondientes}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{c.diasGozados}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => abrirModalKardex(c)}
                          title={`Ver cómo se compone el saldo de ${formatearNombreColaborador(c.nombreCompleto)} (Días LFT, Gozados y Disponibles por período)`}
                          className="font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 hover:border-emerald-400 px-2.5 py-1 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 group"
                        >
                          <span>{c.diasDisponibles} d</span>
                          <Eye className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Preview NOMIPAQ */}
      {modalPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Previsualización de Cambios desde NOMIPAQ
            </h3>
            <p className="text-xs text-slate-500">
              El motor comparó las tablas nativas de nómina (nom10001, nom10002, nom10003) con la base local de vacaciones:
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 font-bold block">Nuevas Altas</span>
                <span className="text-2xl font-black text-emerald-800">{syncPreview?.summary?.insertar || 0}</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-blue-700 font-bold block">Actualizaciones</span>
                <span className="text-2xl font-black text-blue-800">{syncPreview?.summary?.actualizar || 0}</span>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-slate-600 font-bold block">Bajas</span>
                <span className="text-2xl font-black text-slate-700">{syncPreview?.summary?.bajas || 0}</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalPreview(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
              <button
                onClick={handleEjecutarSync}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
              >
                Aplicar Cambios (MERGE)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resolución VoBo */}
      <ModalAprobacion
        solicitud={solicitudSeleccionada}
        isOpen={modalResolucion}
        onClose={() => setModalResolucion(false)}
        onSuccess={(msg) => {
          mostrarToast(msg);
          cargarSolicitudes();
        }}
        esAdminDO={true}
        currentUser={currentUser}
      />

      {/* Modal Desglose y Composición de Saldo (Kárdex por Período) */}
      {modalKardexColab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Composición y Desglose de Saldo de Vacaciones
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {formatearNombreColaborador(modalKardexColab.nombreCompleto)} • Nómina: <span className="font-mono font-bold text-slate-700">{modalKardexColab.codigoEmpleado}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
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
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Empresa</span>
                  <span className="font-bold text-slate-800 truncate block" title={modalKardexColab.empresa}>
                    {modalKardexColab.empresa || 'Grupo JAMA'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Puesto</span>
                  <span className="font-bold text-slate-800 truncate block" title={modalKardexColab.puesto}>
                    {modalKardexColab.puesto || '—'}
                  </span>
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
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Saldo Total Disponible</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {kardexData?.saldoTotalDisponible ?? modalKardexColab.diasDisponibles ?? 0} días
                  </span>
                </div>
              </div>

              {/* Tabla de Períodos Kárdex */}
              {loadingKardexDetalle ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs font-semibold">Consultando composición de saldo por período LFT...</p>
                </div>
              ) : !kardexData?.periodos || kardexData.periodos.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No se encontraron períodos acumulados para este colaborador.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Los períodos de vacaciones se generan conforme a los aniversarios cumplidos según LFT.</p>
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
                Cálculos bajo la Reforma de Vacaciones Dignas (Art. 76, 81 y 516 LFT) • Vigencia de 18 meses
              </span>
              <button
                type="button"
                onClick={() => setModalKardexColab(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
