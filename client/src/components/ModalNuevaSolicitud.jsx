import React, { useState } from 'react';
import { X, Send, AlertTriangle, CheckCircle, Calendar, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import CalendarioVacaciones from './CalendarioVacaciones';

export default function ModalNuevaSolicitud({ isOpen, onClose, onSuccess, saldoDisponible = 0 }) {
  const [rangoSeleccionado, setRangoSeleccionado] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [folioCreado, setFolioCreado] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rangoSeleccionado || !rangoSeleccionado.fechaInicio || !rangoSeleccionado.fechaFin) {
      setError('Por favor selecciona un rango de fechas válido.');
      return;
    }

    if (rangoSeleccionado.totalDiasLaborables <= 0) {
      setError('El rango seleccionado no contiene ningún día hábil.');
      return;
    }

    if (rangoSeleccionado.totalDiasLaborables > saldoDisponible) {
      setError(`No cuentas con saldo suficiente (${rangoSeleccionado.totalDiasLaborables} días solicitados vs ${saldoDisponible} disponibles).`);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.crearSolicitud({
        fechaInicio: rangoSeleccionado.fechaInicio,
        fechaFin: rangoSeleccionado.fechaFin,
        motivoComentarios: motivo || 'Vacaciones programadas'
      });

      if (res.success) {
        setFolioCreado(res.solicitud?.folio || res.folio);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFolioCreado('');
    setError('');
    setMotivo('');
    setRangoSeleccionado(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Nueva Solicitud de Vacaciones</h2>
              <p className="text-xs text-slate-500">Saldo disponible actual: <strong className="text-emerald-600">{saldoDisponible} días hábiles</strong></p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {folioCreado ? (
            <div className="text-center py-8 px-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">¡Solicitud Registrada Exitosamente!</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Tu solicitud ha sido enrutada automáticamente a tu líder directo para su aprobación.
                </p>
              </div>
              <div className="inline-block bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs">
                <span className="text-slate-500 font-medium">Folio de Seguimiento:</span>
                <span className="font-mono font-bold text-blue-700 text-sm ml-2">{folioCreado}</span>
              </div>
              <div className="pt-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                >
                  Entendido y Volver a Mis Solicitudes
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Calendario y simulador de días */}
              <CalendarioVacaciones
                saldoDisponible={saldoDisponible}
                onDateSelect={(datos) => setRangoSeleccionado(datos)}
              />

              {/* Motivo o Comentarios */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo o Notas Opcionales
                </label>
                <textarea
                  rows="2"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Vacaciones familiares de verano, asuntos personales programados..."
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Footer con Botones de Acción */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  {rangoSeleccionado?.totalDiasLaborables > 0 ? (
                    <span>
                      Total a solicitar: <strong className="text-blue-700 font-bold">{rangoSeleccionado.totalDiasLaborables} días hábiles (Lun-Sáb)</strong>
                    </span>
                  ) : (
                    <span>Selecciona el rango de fechas para continuar</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !rangoSeleccionado || rangoSeleccionado.totalDiasLaborables <= 0 || rangoSeleccionado.totalDiasLaborables > saldoDisponible}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {loading ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
