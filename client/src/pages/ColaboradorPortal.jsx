import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  FileText, Ban, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import StatCards from '../components/StatCards';
import KardexVacaciones from '../components/KardexVacaciones';
import ModalNuevaSolicitud from '../components/ModalNuevaSolicitud';

function formatFechaUI(fecha) {
  if (!fecha) return '—';
  try {
    const s = String(fecha).substring(0, 10);
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [y, m, d] = parts;
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mesNombre = meses[parseInt(m, 10) - 1] || m;
      return `${d} ${mesNombre} ${y}`;
    }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
}

export default function ColaboradorPortal({ currentUser }) {
  const [saldoData, setSaldoData] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [subTab, setSubTab] = useState('solicitudes'); // 'solicitudes', 'kardex'
  const [descargandoId, setDescargandoId] = useState(null);
  const [toastError, setToastError] = useState('');
  const [toastSuccess, setToastSuccess] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [currentUser]);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [saldoRes, solRes] = await Promise.all([
        api.getMiSaldo(),
        api.getMisSolicitudes()
      ]);

      if (saldoRes.success) setSaldoData(saldoRes);
      if (solRes.success) setSolicitudes(solRes.data || []);
    } catch (err) {
      console.error('Error cargando portal colaborador:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDescargarPdf(idSolicitud, folio) {
    const id = idSolicitud || folio;
    if (!id) {
      setToastError('No se pudo identificar la solicitud para generar el Formato FDO-84.');
      setTimeout(() => setToastError(''), 5000);
      return;
    }

    try {
      setDescargandoId(idSolicitud);
      setToastError('');
      await api.descargarPdfFdo84(idSolicitud, folio);
    } catch (err) {
      console.error('[Error generando PDF FDO-84]', err);
      setToastError(err.message || 'No se pudo generar o descargar el Formato Oficial FDO-84.');
      setTimeout(() => setToastError(''), 6000);
    } finally {
      setDescargandoId(null);
    }
  }

  async function handleCancelar(id) {
    if (!window.confirm('¿Seguro que deseas cancelar esta solicitud de vacaciones?')) return;
    try {
      const res = await api.cancelarSolicitud(id);
      if (res.success) {
        cargarDatos();
      }
    } catch (err) {
      alert('Error cancelando: ' + err.message);
    }
  }

  const estadoBadge = {
    'PENDIENTE_LIDER': {
      label: 'Pendiente de Líder',
      classes: 'bg-amber-100 text-amber-800 border-amber-200',
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

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida y Acciones */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Bienvenido, {currentUser?.nombreCompleto || 'Colaborador'}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Activo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser?.puesto} • {currentUser?.departamento} • {currentUser?.empresa}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={cargarDatos}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setModalAbierto(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nueva Solicitud de Vacaciones
          </button>
        </div>
      </div>

      {/* Métricas Principales de Saldos LFT */}
      <StatCards 
        resumen={saldoData?.resumen} 
        colaborador={saldoData?.colaborador} 
      />

      {/* Subnavegación: Solicitudes vs Kárdex */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex items-center gap-4 px-6 pt-4 border-b border-slate-100">
          <button
            onClick={() => setSubTab('solicitudes')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              subTab === 'solicitudes'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Mis Solicitudes Registradas ({solicitudes.length})
          </button>

          <button
            onClick={() => setSubTab('kardex')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              subTab === 'kardex'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Kárdex de Períodos LFT
          </button>
        </div>

        <div className="p-6">
          {/* Toast / Alerta de Error en PDF u Operación */}
          {toastError && (
            <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{toastError}</div>
              <button 
                type="button" 
                onClick={() => setToastError('')}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2 text-sm leading-none"
              >
                ×
              </button>
            </div>
          )}

          {subTab === 'solicitudes' ? (
            <div>
              {solicitudes.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">No tienes solicitudes registradas aún</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Programa tu período de descanso seleccionando las fechas en nuestro simulador en tiempo real.
                  </p>
                  <button
                    onClick={() => setModalAbierto(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    Crear primera solicitud
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="pb-3 px-3">Folio</th>
                        <th className="pb-3 px-3">Período Solicitado</th>
                        <th className="pb-3 px-3 text-center">Días Hábiles</th>
                        <th className="pb-3 px-3">Fecha de Creación</th>
                        <th className="pb-3 px-3">Estado</th>
                        <th className="pb-3 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {solicitudes.map((s, idx) => {
                        const idSol = s.idSolicitud || s.IdSolicitud || s.id;
                        const folio = s.folio || s.Folio || (idSol ? `VAC-${idSol}` : '—');
                        const fechaInicio = s.fechaInicio || s.FechaInicio || '—';
                        const fechaFin = s.fechaFin || s.FechaFin || '—';
                        const totalDias = s.totalDiasLaborables ?? s.TotalDiasLaborables ?? s.diasHabiles ?? s.total_dias ?? 0;
                        const fechaCreacion = s.fechaCreacion || s.FechaCreacion;
                        const estado = s.estado || s.Estado || 'PENDIENTE_LIDER';
                        const badge = estadoBadge[estado] || estadoBadge['PENDIENTE_LIDER'];
                        const Icon = badge.icon;
                        const esCancelable = ['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(estado);
                        const motivoRechazo = s.motivoRechazo || s.MotivoRechazo;
                        const motivoComentarios = s.motivoComentarios || s.MotivoComentarios;

                        return (
                          <tr key={idSol || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                              {folio}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="font-bold text-slate-800">{fechaInicio}</span>
                              <span className="text-slate-400 mx-1.5">al</span>
                              <span className="font-bold text-slate-800">{fechaFin}</span>
                              {motivoComentarios && (
                                <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                  {motivoComentarios}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg font-black text-blue-700 bg-blue-50 border border-blue-100">
                                {totalDias} días
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {formatFechaUI(fechaCreacion)}
                            </td>
                            <td className="py-3.5 px-3">
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
                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDescargarPdf(idSol, folio)}
                                  disabled={descargandoId === idSol}
                                  title="Ver y Descargar Formato Oficial FDO-84 (PDF)"
                                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  {descargandoId === idSol ? (
                                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                  <span>{descargandoId === idSol ? 'Abriendo...' : 'Formato FDO-84'}</span>
                                </button>
                                {esCancelable && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelar(idSol)}
                                    className="text-slate-400 hover:text-rose-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                )}
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
          ) : (
            <KardexVacaciones 
              periodos={saldoData?.periodos} 
              colaborador={saldoData?.colaborador} 
            />
          )}
        </div>
      </div>

      {/* Modal Nueva Solicitud */}
      <ModalNuevaSolicitud
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        saldoDisponible={saldoData?.resumen?.diasDisponibles || 0}
        diasDescanso={saldoData?.colaborador?.diasDescanso || 'DOMINGO'}
        onSuccess={() => {
          cargarDatos();
        }}
      />
    </div>
  );
}
