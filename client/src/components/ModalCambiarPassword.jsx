import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { api } from '../api/client';

export default function ModalCambiarPassword({ isOpen, onClose }) {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!passwordActual || !passwordNuevo || !confirmacion) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    if (passwordNuevo.length < 8) {
      setError('La nueva contraseña debe contener al menos 8 caracteres.');
      return;
    }

    if (passwordNuevo !== confirmacion) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.cambiarPassword({ passwordActual, passwordNuevo });
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'No se pudo actualizar la contraseña.');
      }
    } catch (err) {
      setError(err.message || 'Error al comunicarse con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-blue-700">
            <div className="p-2 bg-blue-50 rounded-xl">
              <KeyRound className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Cambiar Contraseña</h3>
              <p className="text-xs text-slate-500">Actualiza tu clave de acceso institucional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Éxito */}
        {success && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">¡Contraseña actualizada con éxito! Cerrando ventana...</span>
          </div>
        )}

        {/* Mensaje de Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contraseña Actual
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                placeholder="Ingresa tu clave actual"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nueva Contraseña (mínimo 8 caracteres)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={passwordNuevo}
                onChange={(e) => setPasswordNuevo(e.target.value)}
                placeholder="Nueva clave personal"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="Confirma la nueva clave"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
