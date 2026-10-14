import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Componente Institucional de Botón de Actualización / Sincronización
 * Grupo JAMA - Vacaciones LFT
 */
export default function RefreshButton({
  onClick,
  label = 'Actualizar',
  loadingLabel = 'Actualizando...',
  isLoading = false,
  disabled = false,
  className = '',
  title
}) {
  const isDisabled = isLoading || disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={title || (isLoading ? loadingLabel : label)}
      className={`bg-white border border-slate-200/80 rounded-xl shadow-xs hover:shadow-sm text-xs font-semibold text-slate-700 px-3.5 py-2 inline-flex items-center gap-2 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 disabled:active:scale-100 shrink-0 select-none ${className}`}
    >
      <RefreshCw
        className={`w-3.5 h-3.5 shrink-0 ${
          isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'
        }`}
      />
      <span>{isLoading ? loadingLabel : label}</span>
    </button>
  );
}
