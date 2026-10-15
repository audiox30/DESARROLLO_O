import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, Users, Clock, CheckCircle2, XCircle, AlertCircle, 
  MessageSquare, RefreshCw, Calendar, ArrowRight, ShieldAlert, Sparkles, 
  Mail, FileText, History, Search, Filter, Ban
} from 'lucide-react';
import { api } from '../api/client';
import ModalAprobacion from '../components/ModalAprobacion';
import RefreshButton from '../components/RefreshButton';
import { formatearNombreColaborador, compararPorApellidos } from '../utils/formatters';

export default function LiderPortal({ currentUser }) {
  const [pendientes, setPendientes] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [filtroHistorial, setFiltroHistorial] = useState('TODAS');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [descargandoId, setDescargandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mensajeToast, setMensajeToast] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [currentUser]);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [penRes, eqRes, histRes] = await Promise.all([
        api.getBandejaLider(),
        api.getEquipoLider(),
        api.getHistorialLider()
      ]);

      if (penRes.success) {
        const norm = (penRes.data || []).map(s => ({
          ...s,
          idSolicitud: s.idSolicitud || s.IdSolicitud,
          folio: s.folio || s.Folio,
          estado: s.estado || s.Estado,
          fechaInicio: s.fechaInicio ? String(s.fechaInicio).substring(0, 10) : (s.FechaInicio ? String(s.FechaInicio).substring(0, 10) : ''),
          fechaFin: s.fechaFin ? String(s.fechaFin).substring(0, 10) : (s.FechaFin ? String(s.FechaFin).substring(0, 10) : ''),
          totalDiasLaborables: s.totalDiasLaborables !== undefined ? s.totalDiasLaborables : (s.TotalDiasLaborables || 0),
          colaboradorNombre: s.colaboradorNombre || s.NombreCompleto || 'Colaborador',
          colaboradorCodigo: s.colaboradorCodigo || s.CodigoEmpleado || '',
          colaboradorPuesto: s.colaboradorPuesto || s.Puesto || '—',
          colaboradorEmpresa: s.colaboradorEmpresa || s.Empresa || 'Grupo JAMA',
          colaboradorSucursal: s.colaboradorSucursal || s.Sucursal || 'Matriz',
          motivoComentarios: s.motivoComentarios || s.MotivoComentarios || '',
          nivelAprobacionRequerido: s.nivelAprobacionRequerido || s.NivelAprobacionRequerido || ((s.estado || s.Estado) === 'PENDIENTE_GERENTE' ? 2 : 1)
        })).sort((a, b) => compararPorApellidos(a.colaboradorNombre, b.colaboradorNombre, 'asc'));
        setPendientes(norm);
      }

      if (eqRes.success) {
        const sortedEquipo = [...(eqRes.data || [])].sort((a, b) => compararPorApellidos(a, b, 'asc'));
        setEquipo(sortedEquipo);
      }

      if (histRes && histRes.success) {
        const normHist = (histRes.data || []).map(s => ({
          ...s,
          idSolicitud: s.idSolicitud || s.IdSolicitud,
          folio: s.folio || s.Folio,
          estado: s.estado || s.Estado,
          fechaInicio: s.fechaInicio ? String(s.fechaInicio).substring(0, 10) : (s.FechaInicio ? String(s.FechaInicio).substring(0, 10) : ''),
          fechaFin: s.fechaFin ? String(s.fechaFin).substring(0, 10) : (s.FechaFin ? String(s.FechaFin).substring(0, 10) : ''),
          fechaCreacion: s.fechaCreacion || s.FechaCreacion,
          fechaResolucion: s.fechaResolucion || s.FechaResolucion,
          totalDiasLaborables: s.totalDiasLaborables !== undefined ? s.totalDiasLaborables : (s.TotalDiasLaborables || 0),
          colaboradorNombre: s.colaboradorNombre || s.NombreCompleto || 'Colaborador',
          colaboradorCodigo: s.colaboradorCodigo || s.CodigoEmpleado || '',
          colaboradorPuesto: s.colaboradorPuesto || s.Puesto || '—',
          colaboradorEmpresa: s.colaboradorEmpresa || s.Empresa || 'Grupo JAMA',
          colaboradorSucursal: s.colaboradorSucursal || s.Sucursal || '',
          motivoComentarios: s.motivoComentarios || s.MotivoComentarios || '',
          motivoRechazo: s.motivoRechazo || s.MotivoRechazo || ''
        }));
        setHistorial(normHist);
      }
    } catch (err) {
      console.error('Error cargando bandeja de líder:', err);
    } finally {
      setLoading(false);
    }
  }

  function abrirModalResolucion(solicitud) {
    setSolicitudSeleccionada(solicitud);
    setModalAbierto(true);
  }

  function handleSuccess(msg) {
    setMensajeToast(msg || 'Operación completada.');
    setTimeout(() => setMensajeToast(''), 4000);
    cargarDatos();
  }

  async function handleDescargarPdf(idSol, folio) {
    try {
      setDescargandoId(idSol);
      await api.descargarPdfFdo84(idSol, folio);
    } catch (err) {
      alert('Error descargando formato FDO-84: ' + (err.message || 'Error desconocido'));
    } finally {
      setDescargandoId(null);
    }
  }

  const estadoBadge = {
    'PENDIENTE_LIDER': {
      label: 'Pendiente de Líder',
      classes: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: Clock
    },
    'PENDIENTE_GERENTE': {
      label: 'Pendiente de Gerente',
      classes: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      icon: Clock
    },
    'PENDIENTE_DO': {
      label: 'Pendiente VoBo DO',
      classes: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Clock
    },
    'APROBADA': {
      label: 'Aprobada',
      classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: CheckCircle2
    },
    'AUTORIZADA': {
      label: 'Autorizada',
      classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: CheckCircle2
    },
    'RECHAZADA': {
      label: 'Rechazada',
      classes: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: XCircle
    },
    'CANCELADA': {
      label: 'Cancelada',
      classes: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: Ban
    }
  };

  const formatearFechaSimple = (val) => {
    if (!val) return '—';
    try {
      const str = String(val).split('T')[0];
      const [y, m, d] = str.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return str;
    } catch {
      return String(val);
    }
  };

  // Filtrado reactivo del Historial
  const historialFiltrado = useMemo(() => {
    return historial.filter(s => {
      const est = (s.estado || '').toUpperCase();
      if (filtroHistorial === 'APROBADAS' && !(est === 'APROBADA' || est === 'AUTORIZADA')) return false;
      if (filtroHistorial === 'RECHAZADAS' && est !== 'RECHAZADA') return false;
      if (filtroHistorial === 'PENDIENTES' && !est.startsWith('PENDIENTE')) return false;

      if (busquedaHistorial.trim()) {
        const q = busquedaHistorial.toLowerCase().trim();
        const nom = (s.colaboradorNombre || '').toLowerCase();
        const cod = (s.colaboradorCodigo || s.codigoEmpleado || '').toLowerCase();
        const fol = (s.folio || '').toLowerCase();
        const pue = (s.colaboradorPuesto || '').toLowerCase();
        if (!nom.includes(q) && !cod.includes(q) && !fol.includes(q) && !pue.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [historial, filtroHistorial, busquedaHistorial]);

  const totalAprobadas = useMemo(() => {
    return historial.filter(s => s.estado === 'APROBADA' || s.estado === 'AUTORIZADA').length;
  }, [historial]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {mensajeToast && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{mensajeToast}</span>
          </div>
          <button onClick={() => setMensajeToast('')} className="text-white/80 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      {/* Header Líder */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Bandeja de Autorizaciones del Líder
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Liderazgo & Jefatura
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestiona y autoriza las solicitudes de vacaciones de tu equipo a cargo directo ({currentUser?.nombreCompleto})
          </p>
        </div>

        <RefreshButton
          onClick={cargarDatos}
          isLoading={loading}
          label="Actualizar Bandeja de Equipo"
          loadingLabel="Actualizando..."
        />
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Solicitudes por Resolver</span>
            <p className="text-3xl font-black text-amber-600 mt-1">{pendientes.length}</p>
            <span className="text-[11px] text-slate-500 font-medium">Requieren tu visto bueno</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Colaboradores a Cargo</span>
            <p className="text-3xl font-black text-slate-800 mt-1">{equipo.length}</p>
            <span className="text-[11px] text-slate-500 font-medium">Plantilla directa según organigrama</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Historial del Equipo</span>
            <p className="text-3xl font-black text-emerald-600 mt-1">{historial.length}</p>
            <span className="text-[11px] text-slate-500 font-medium">{totalAprobadas} aprobadas registradas</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Notificaciones Vía Correo</span>
            <p className="text-base font-extrabold text-blue-700 mt-1 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              Notificaciones Activas
            </p>
            <span className="text-[11px] text-slate-500 font-medium">Avisos automáticos a líder y equipo</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 1. Lista de Solicitudes Pendientes */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Solicitudes Pendientes de Aprobación ({pendientes.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {pendientes.length === 0 ? 'Sin trámites pendientes' : 'Atención prioritaria requerida'}
          </span>
        </div>

        <div className="p-6">
          {pendientes.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">¡Bandeja al día!</h3>
              <p className="text-xs text-slate-500 mt-1">
                No tienes solicitudes de vacaciones pendientes de autorización por el momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendientes.map((s) => (
                <div
                  key={s.idSolicitud}
                  className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{formatearNombreColaborador(s.colaboradorNombre)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.colaboradorPuesto} • {s.colaboradorEmpresa || 'Grupo JAMA'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                          {s.folio}
                        </span>
                        {(s.estado === 'PENDIENTE_GERENTE' || s.nivelAprobacionRequerido === 2) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                            Nivel 2: Autorización Gerencial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Nivel 1: Visto Bueno Operativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          {(() => {
                            const fInicio = s.FechaInicio || s.fechaInicio || s.fecha_inicio;
                            const fFin = s.FechaFin || s.fechaFin || s.fecha_fin;
                            if (!fInicio || !fFin) return 'Sin fechas';
                            return `${formatearFechaSimple(fInicio)} al ${formatearFechaSimple(fFin)}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Días Hábiles Solicitados:</span>
                        <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {s.totalDiasLaborables} días
                        </span>
                      </div>
                      {s.motivoComentarios && (
                        <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
                          "{s.motivoComentarios}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-2 flex items-center justify-end gap-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => handleDescargarPdf(s.idSolicitud || s.IdSolicitud || s.id, s.folio || s.Folio)}
                      disabled={descargandoId === (s.idSolicitud || s.IdSolicitud || s.id)}
                      title="Ver y Descargar Formato Oficial FDO-84 (PDF)"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {descargandoId === (s.idSolicitud || s.IdSolicitud || s.id) ? (
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-600" />
                      )}
                      <span>FDO-84</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalResolucion(s)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      Revisar y Resolver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Historial de Solicitudes del Equipo */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Historial de Solicitudes del Equipo ({historial.length})
            </h3>
          </div>

          {/* Filtros de Estado y Buscador */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                placeholder="Buscar por colaborador, código o folio..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              {[
                { id: 'TODAS', label: 'Todas', count: historial.length },
                { id: 'APROBADAS', label: 'Aprobadas', count: historial.filter(s => s.estado === 'APROBADA' || s.estado === 'AUTORIZADA').length },
                { id: 'RECHAZADAS', label: 'Rechazadas', count: historial.filter(s => s.estado === 'RECHAZADA').length },
                { id: 'PENDIENTES', label: 'En Trámite', count: historial.filter(s => String(s.estado || '').startsWith('PENDIENTE')).length }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroHistorial(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    filtroHistorial === f.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Folio</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Período Solicitado</th>
                <th className="py-3 px-4 text-center">Días Hábiles</th>
                <th className="py-3 px-4">Fecha Solicitud</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historialFiltrado.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <History className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">
                        No se encontraron solicitudes con los filtros seleccionados.
                      </p>
                      {(filtroHistorial !== 'TODAS' || busquedaHistorial) && (
                        <button
                          type="button"
                          onClick={() => { setFiltroHistorial('TODAS'); setBusquedaHistorial(''); }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                historialFiltrado.map((s, idx) => {
                  const idSol = s.idSolicitud || s.IdSolicitud || s.id;
                  const folio = s.folio || s.Folio || (idSol ? `VAC-${idSol}` : '—');
                  const fInicio = s.fechaInicio || s.FechaInicio;
                  const fFin = s.fechaFin || s.FechaFin;
                  const totalDias = s.totalDiasLaborables ?? s.TotalDiasLaborables ?? 0;
                  const fCreacion = s.fechaCreacion || s.FechaCreacion;
                  const estado = s.estado || s.Estado || 'PENDIENTE_LIDER';
                  const badge = estadoBadge[estado] || estadoBadge['PENDIENTE_LIDER'];
                  const Icon = badge.icon;
                  const motivoRechazo = s.motivoRechazo || s.MotivoRechazo;
                  const motivo = s.motivoComentarios || s.MotivoComentarios;

                  return (
                    <tr key={idSol || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {folio}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {formatearNombreColaborador(s.colaboradorNombre || s)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {s.colaboradorCodigo ? `${s.colaboradorCodigo} • ` : ''}
                          {s.colaboradorPuesto || 'Puesto no asignado'}
                        </div>
                        {motivo && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                            "{motivo}"
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{formatearFechaSimple(fInicio)}</span>
                        <span className="text-slate-400 mx-1.5">al</span>
                        <span className="font-semibold text-slate-800">{formatearFechaSimple(fFin)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg font-black text-blue-700 bg-blue-50 border border-blue-100">
                          {totalDias} días
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {formatearFechaSimple(fCreacion)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.classes}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {badge.label}
                        </span>
                        {motivoRechazo && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1">
                            Motivo: {motivoRechazo}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDescargarPdf(idSol, folio)}
                          disabled={descargandoId === idSol}
                          title="Descargar Formato Oficial FDO-84 (PDF)"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {descargandoId === idSol ? (
                            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{descargandoId === idSol ? 'Abriendo...' : 'FDO-84'}</span>
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



      {/* Modal de Resolución */}
      <ModalAprobacion
        solicitud={solicitudSeleccionada}
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSuccess={handleSuccess}
        esAdminDO={false}
      />
    </div>
  );
}
