import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  FileText, Ban, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import StatCards from '../components/StatCards';
import KardexVacaciones from '../components/KardexVacaciones';
import ModalNuevaSolicitud from '../components/ModalNuevaSolicitud';

export default function ColaboradorPortal({ currentUser }) {
  const [saldoData, setSaldoData] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [subTab, setSubTab] = useState('solicitudes'); // 'solicitudes', 'kardex'

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
      if (solRes.success) setSolicitudes(solRes.data);
    } catch (err) {
      console.error('Error cargando portal colaborador:', err);
    } finally {
      setLoading(false);
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
                      {solicitudes.map((s) => {
                        const badge = estadoBadge[s.estado] || estadoBadge['PENDIENTE_LIDER'];
                        const Icon = badge.icon;
                        const esCancelable = ['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(s.estado);

                        return (
                          <tr key={s.idSolicitud} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                              {s.folio}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="font-bold text-slate-800">{s.fechaInicio}</span>
                              <span className="text-slate-400 mx-1.5">al</span>
                              <span className="font-bold text-slate-800">{s.fechaFin}</span>
                              {s.motivoComentarios && (
                                <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                  {s.motivoComentarios}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg font-black text-blue-700 bg-blue-50 border border-blue-100">
                                {s.totalDiasLaborables} días
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {new Date(s.fechaCreacion).toLocaleDateString('es-MX', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              })}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.classes}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {badge.label}
                              </span>
                              {s.motivoRechazo && (
                                <p className="text-[11px] text-rose-600 font-medium mt-1">
                                  Motivo: {s.motivoRechazo}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              {esCancelable ? (
                                <button
                                  onClick={() => handleCancelar(s.idSolicitud)}
                                  className="text-slate-400 hover:text-rose-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                                >
                                  Cancelar
                                </button>
                              ) : (
                                <span className="text-slate-300 text-[11px] italic">Sin acciones</span>
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
        onSuccess={() => {
          cargarDatos();
        }}
      />
    </div>
  );
}
