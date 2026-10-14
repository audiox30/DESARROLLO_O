import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Users, Clock, CheckCircle2, XCircle, AlertCircle, 
  MessageSquare, RefreshCw, Calendar, ArrowRight, ShieldAlert, Sparkles, Mail, FileText
} from 'lucide-react';
import { api } from '../api/client';
import ModalAprobacion from '../components/ModalAprobacion';
import { formatearNombreColaborador, compararPorApellidos } from '../utils/formatters';

export default function LiderPortal({ currentUser }) {
  const [pendientes, setPendientes] = useState([]);
  const [equipo, setEquipo] = useState([]);
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
      const [penRes, eqRes] = await Promise.all([
        api.getBandejaLider(),
        api.getEquipoLider()
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

        <button
          onClick={cargarDatos}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Bandeja</span>
        </button>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Solicitudes por Resolver</span>
            <p className="text-3xl font-black text-amber-600 mt-1">{pendientes.length}</p>
            <span className="text-[11px] text-slate-500 font-medium">Requieren tu aprobación o rechazo</span>
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
            <span className="text-xs font-bold text-slate-400 uppercase">Notificaciones Vía Correo</span>
            <p className="text-base font-extrabold text-blue-700 mt-1 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              Notificaciones Activas
            </p>
            <span className="text-[11px] text-slate-500 font-medium">Avisos automáticos a líder y colaborador</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Lista de Solicitudes Pendientes */}
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
                        <span className="text-slate-500 font-medium">Período de Ausencia:</span>
                        <span className="font-bold text-slate-800">{s.fechaInicio} al {s.fechaFin}</span>
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
                      onClick={() => api.descargarPdfFdo84(s.idSolicitud || s.IdSolicitud || s.id, s.folio || s.Folio)}
                      title="Ver y Descargar Formato Oficial FDO-84 (PDF)"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
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

      {/* Directorio de Colaboradores a Cargo */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Mi Plantilla Directa ({equipo.length} colaboradores)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Sincronizado con NOMIPAQ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Puesto</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4 text-center">Días LFT</th>
                <th className="py-3 px-4 text-center">Días Gozados</th>
                <th className="py-3 px-4 text-center">Disponibles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipo.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-700">{c.codigoEmpleado}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatearNombreColaborador(c)}</td>
                  <td className="py-3 px-4 text-slate-600">{c.puesto}</td>
                  <td className="py-3 px-4 text-slate-500">{c.departamento}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-700">{c.diasCorrespondientes || 14}</td>
                  <td className="py-3 px-4 text-center text-slate-500">{c.diasGozados || 0}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {c.diasDisponibles || 14} días
                    </span>
                  </td>
                </tr>
              ))}
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
