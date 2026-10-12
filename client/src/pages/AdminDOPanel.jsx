import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, RefreshCw, Database, Download, Calendar, 
  Users, CheckCircle2, Clock, XCircle, Search, Filter, 
  Plus, Trash2, AlertTriangle, ArrowUpRight, Sparkles, FileSpreadsheet
} from 'lucide-react';
import { api } from '../api/client';
import ModalAprobacion from '../components/ModalAprobacion';

export default function AdminDOPanel({ currentUser }) {
  const [tab, setTab] = useState('solicitudes'); // 'solicitudes', 'sync', 'festivos', 'kardex'
  
  // Solicitudes
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODAS');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
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
      if (filtroEstado && filtroEstado !== 'TODAS') params.append('estado', filtroEstado);
      if (filtroEmpresa) params.append('empresa', filtroEmpresa);
      const res = await api.getBandejaDO(params.toString());
      if (res.success) setSolicitudes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSol(false);
    }
  }

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

  async function handleEjecutarSync() {
    if (!window.confirm('¿Confirmas la ejecución de la sincronización incremental MERGE desde CONTPAQi Nóminas?')) return;
    try {
      setSyncLoading(true);
      const res = await api.ejecutarSync();
      if (res.success) {
        mostrarToast('¡Sincronización completada con éxito! Catálogos y saldos actualizados.');
        setModalPreview(false);
        cargarSyncInfo();
        cargarKardex();
      }
    } catch (err) {
      alert('Error en sincronización: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
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
      if (res.success) setKardexList(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKardex(false);
    }
  }

  const kardexFiltrado = kardexList.filter(c => {
    if (!busquedaKardex) return true;
    const b = busquedaKardex.toLowerCase();
    return (
      c.nombreCompleto.toLowerCase().includes(b) ||
      c.codigoEmpleado.toLowerCase().includes(b) ||
      c.puesto.toLowerCase().includes(b) ||
      c.departamento.toLowerCase().includes(b) ||
      (c.empresa && c.empresa.toLowerCase().includes(b))
    );
  });

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
          <button
            onClick={() => { cargarSolicitudes(); cargarSyncInfo(); cargarDiasInhabiles(); cargarKardex(); }}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
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
            Bandeja Global & VoBo DO ({solicitudes.length})
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
            {/* Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Estado:
                </span>
                {['TODAS', 'PENDIENTE_DO', 'PENDIENTE_LIDER', 'APROBADA', 'RECHAZADA'].map((st) => (
                  <button
                    key={st}
                    onClick={() => { setFiltroEstado(st); setTimeout(cargarSolicitudes, 50); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filtroEstado === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'PENDIENTE_DO' ? 'VoBo DO Pendiente' : st.replace('_', ' ')}
                  </button>
                ))}
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
                  {solicitudes.map((s) => (
                    <tr key={s.idSolicitud} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900">{s.folio}</td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {s.colaboradorNombre}
                        <span className="block text-[10px] font-normal text-slate-400">{s.colaboradorPuesto}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        <span className="font-semibold block">{s.colaboradorEmpresa || 'Grupo JAMA'}</span>
                        <span className="text-[10px] text-slate-400">{s.colaboradorDepartamento}</span>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800">
                        {s.fechaInicio} al {s.fechaFin}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {s.totalDiasLaborables} d
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          s.estado === 'PENDIENTE_DO' ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse' :
                          s.estado === 'PENDIENTE_LIDER' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          s.estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {s.estado === 'PENDIENTE_DO' ? 'VoBo DO Pendiente' : s.estado}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {['PENDIENTE_DO', 'PENDIENTE_LIDER'].includes(s.estado) ? (
                          <button
                            onClick={() => {
                              setSolicitudSeleccionada(s);
                              setModalResolucion(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all"
                          >
                            Resolver VoBo
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Concluida</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
                <span className="text-xs font-bold text-slate-400 uppercase">Origen de Datos</span>
                <p className="text-base font-extrabold text-slate-900 mt-1">{syncStatus?.source || 'CONTPAQi Nóminas'}</p>
                <span className="text-[11px] text-slate-500 font-mono block mt-1">BD: {syncStatus?.database}</span>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase">Estado de Enlace SQL</span>
                <p className="text-base font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {syncStatus?.estadoConexion || 'ONLINE'}
                </p>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Plantilla vinculada: {syncStatus?.totalColaboradoresSincronizados || 601} registros
                </span>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Sincronización Manual</span>
                  <p className="text-xs text-slate-600 mt-1">Dispara el Stored Procedure `sp_SincronizarDesdeNomipaq`</p>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={handleVerPreview}
                    disabled={syncLoading}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all"
                  >
                    Ver Cambios
                  </button>
                  <button
                    onClick={handleEjecutarSync}
                    disabled={syncLoading}
                    className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs"
                  >
                    {syncLoading ? 'Ejecutando...' : 'Sincronizar MERGE'}
                  </button>
                </div>
              </div>
            </div>

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
                    {syncLogs.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono">{new Date(l.fechaEjecucion).toLocaleString('es-MX')}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{l.tipoEjecucion}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">+{l.registrosInsertados}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-700">~{l.registrosActualizados}</td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{l.detalleLog}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Exitoso
                          </span>
                        </td>
                      </tr>
                    ))}
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
                    <th className="py-3 px-3 text-center">Disponibles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kardexFiltrado.map((c) => (
                    <tr key={c.idColaborador} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{c.codigoEmpleado}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{c.nombreCompleto}</td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[140px]">{c.empresa || 'Grupo JAMA'}</td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">{c.puesto}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">{c.fechaAlta}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{c.antiguedadAnios} años</td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-700">{c.diasCorrespondientes}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{c.diasGozados}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {c.diasDisponibles} d
                        </span>
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
      />
    </div>
  );
}
