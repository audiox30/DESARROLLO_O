import React, { useState, useEffect } from 'react';
import { 
  Users, Search, RefreshCw, FileText, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, Phone, Mail, Building2, 
  MapPin, Eye, ChevronRight, X, Sparkles, Shield, UserCheck, 
  FileSpreadsheet, ArrowUpRight
} from 'lucide-react';
import { api } from '../api/client';

export default function LiderMiEquipoPage({ currentUser }) {
  const [equipo, setEquipo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modales
  const [modalKardexColab, setModalKardexColab] = useState(null);
  const [kardexData, setKardexData] = useState(null);
  const [loadingKardex, setLoadingKardex] = useState(false);

  const [modalSolicitudesColab, setModalSolicitudesColab] = useState(null);
  const [solicitudesData, setSolicitudesData] = useState([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);

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

  // Filtrado reactivo en memoria por Nombre, Código o Puesto
  const colaboradoresFiltrados = equipo.filter(c => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nombre = (c.nombreCompleto || '').toLowerCase();
    const codigo = (c.codigoEmpleado || '').toLowerCase();
    const puesto = (c.puesto || '').toLowerCase();
    const sucursal = (c.sucursal || '').toLowerCase();
    return nombre.includes(term) || codigo.includes(term) || puesto.includes(term) || sucursal.includes(term);
  });

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

        <button
          onClick={cargarEquipo}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Plantilla</span>
        </button>
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
                  <th className="py-3.5 px-4">Colaborador</th>
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
                  const initials = c.nombreCompleto
                    ? c.nombreCompleto.split(' ').slice(0, 2).map(n => n[0]).join('')
                    : 'EM';

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
                              {c.nombreCompleto}
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
                    {modalKardexColab.nombreCompleto} • Nómina: {modalKardexColab.codigoEmpleado}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
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
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Saldo Disponible</span>
                  <span className="font-black text-emerald-700 text-sm">{modalKardexColab.diasDisponibles || 0} días</span>
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
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                        <th className="py-2.5 px-3">Ciclo / Período</th>
                        <th className="py-2.5 px-3 text-center">Antigüedad</th>
                        <th className="py-2.5 px-3 text-center">Días Ley (LFT)</th>
                        <th className="py-2.5 px-3 text-center">Días Gozados</th>
                        <th className="py-2.5 px-3 text-center">Días Pendientes</th>
                        <th className="py-2.5 px-3">Fecha Vencimiento</th>
                        <th className="py-2.5 px-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kardexData.periodos.map(p => {
                        const esVigente = !p.esCerrado && p.diasPendientes > 0;
                        return (
                          <tr key={p.idSaldo || p.anioPeriodo} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              Período {p.anioPeriodo}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                              {p.antiguedadCumplida} {p.antiguedadCumplida === 1 ? 'año' : 'años'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-blue-700">
                              {p.diasCorrespondientes} días
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600">
                              {p.diasGozados}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`font-black ${p.diasPendientes > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {p.diasPendientes}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                              {p.fechaExpiracionPeriodo || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {esVigente ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Clock className="w-3 h-3" /> Vigente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  <CheckCircle2 className="w-3 h-3" /> Cerrado
                                </span>
                              )}
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
                    {modalSolicitudesColab.nombreCompleto} • Nómina: {modalSolicitudesColab.codigoEmpleado}
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
                              {s.FechaInicio} al {s.FechaFin}
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

    </div>
  );
}
