import React, { useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, MessageSquare, ShieldCheck, Clock, Send, Eye } from 'lucide-react';
import { api } from '../api/client';

export default function ModalAprobacion({ solicitud, isOpen, onClose, onSuccess, esAdminDO = false }) {
  const [modo, setModo] = useState('detalle'); // 'detalle', 'aprobar', 'rechazar'
  const [comentarios, setComentarios] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [teamsPayload, setTeamsPayload] = useState(null);

  if (!isOpen || !solicitud) return null;

  async function handleAprobar() {
    try {
      setLoading(true);
      setError('');
      const res = await api.aprobarSolicitud(solicitud.idSolicitud, comentarios, 'WEB');
      if (res.success) {
        onSuccess(res.message);
        handleClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRechazar() {
    if (!motivoRechazo || !motivoRechazo.trim()) {
      setError('El motivo del rechazo es obligatorio para cumplir con la política de Desarrollo Organizacional.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.rechazarSolicitud(solicitud.idSolicitud, motivoRechazo.trim(), 'WEB');
      if (res.success) {
        onSuccess(res.message);
        handleClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSimularTeams() {
    try {
      const res = await api.simularTeams(solicitud.idSolicitud);
      if (res.success) {
        setTeamsPayload(res.payload);
      }
    } catch (err) {
      alert('Error simulando Teams: ' + err.message);
    }
  }

  function handleClose() {
    setModo('detalle');
    setComentarios('');
    setMotivoRechazo('');
    setError('');
    setTeamsPayload(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
              modo === 'rechazar' ? 'bg-rose-600' : 'bg-slate-900'
            }`}>
              {modo === 'rechazar' ? <XCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {modo === 'rechazar' ? 'Rechazar Solicitud de Vacaciones' : 'Revisión y Resolución de Solicitud'}
              </h2>
              <p className="text-xs text-slate-500 font-mono">Folio: {solicitud.folio}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Ficha Resumen del Colaborador */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">Colaborador Solicitante</span>
                <p className="text-sm font-bold text-slate-900">{solicitud.colaboradorNombre || 'Colaborador'}</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                {solicitud.colaboradorCodigo}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
              <div>
                <span className="text-slate-500">Puesto:</span>
                <p className="font-semibold text-slate-800 truncate">{solicitud.colaboradorPuesto || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Departamento:</span>
                <p className="font-semibold text-slate-800 truncate">{solicitud.colaboradorDepartamento || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Empresa:</span>
                <p className="font-semibold text-slate-800 truncate">{solicitud.colaboradorEmpresa || 'Grupo JAMA'}</p>
              </div>
              <div>
                <span className="text-slate-500">Período Solicitado:</span>
                <p className="font-bold text-blue-700">{solicitud.fechaInicio} al {solicitud.fechaFin}</p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
              <span className="text-xs text-slate-600 font-medium">Impacto en Días Hábiles:</span>
              <span className="text-sm font-black text-blue-700 px-2.5 py-0.5 rounded-lg bg-blue-100/60">
                {solicitud.totalDiasLaborables} días
              </span>
            </div>

            {solicitud.motivoComentarios && (
              <div className="text-xs pt-2 border-t border-slate-200/60">
                <span className="text-slate-500">Comentarios del solicitante:</span>
                <p className="italic text-slate-700 mt-0.5">"{solicitud.motivoComentarios}"</p>
              </div>
            )}
          </div>

          {/* Formulario de Aprobación o Rechazo */}
          {modo === 'detalle' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notas de Aprobación (Opcional)
                </label>
                <textarea
                  rows="2"
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  placeholder={esAdminDO ? "VoBo de DO para impacto directo en el sistema de nómina..." : "Autorizado por jefatura directa..."}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Botón simulación Teams */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-indigo-950">Integración con Microsoft Teams</span>
                  <p className="text-[11px] text-indigo-700">Ver tarjeta adaptable (Adaptive Card) para autorización en 1 clic</p>
                </div>
                <button
                  type="button"
                  onClick={handleSimularTeams}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all"
                >
                  Ver Tarjeta Teams
                </button>
              </div>

              {teamsPayload && (
                <div className="p-3 bg-slate-900 rounded-xl text-slate-200 font-mono text-[11px] overflow-x-auto max-h-40">
                  <pre>{JSON.stringify(teamsPayload, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {modo === 'rechazar' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Campo Obligatorio de Motivo de Rechazo</strong>
                  El colaborador recibirá este motivo exacto por correo/portal para reprogramar sus fechas.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo o Justificación del Rechazo *
                </label>
                <textarea
                  rows="3"
                  required
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Ej: Coincide con cierre contable mensual / cobertura mínima de sucursal requerida..."
                  className="w-full text-xs rounded-xl border border-rose-300 bg-rose-50/30 p-3 text-slate-900 focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-white transition-all"
          >
            Cancelar
          </button>

          {modo === 'detalle' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModo('rechazar')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200"
              >
                <XCircle className="w-4 h-4" />
                Rechazar...
              </button>

              <button
                type="button"
                onClick={handleAprobar}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                {loading ? 'Procesando...' : (esAdminDO ? 'Otorgar VoBo Final' : 'Aprobar Solicitud')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModo('detalle')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-white transition-all"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleRechazar}
                disabled={loading || !motivoRechazo.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                {loading ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
