import React from 'react';
import { Eye, AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';

export default function SimulateBanner({ 
  isSimulating, 
  simulatedRole, 
  simulatedColabName, 
  onResetSimulation 
}) {
  if (!isSimulating) return null;

  const roleLabel = {
    'ADMIN_DO': 'ADMIN_DO [Desarrollo Organizacional]',
    'LIDER': 'LÍDER / JEFE [Aprobaciones y Mi Equipo]',
    'COLABORADOR': 'COLABORADOR [Portal Colaborador]'
  }[simulatedRole] || simulatedRole;

  return (
    <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 font-bold text-xs py-2 px-4 shadow-md flex items-center justify-between border-b border-amber-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base select-none">⚠️</span>
          <span>
            <span>Modo Simulación: Navegando como </span>
            <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded font-black border border-amber-400">
              {roleLabel}
            </span>
            {simulatedColabName && (
              <span className="ml-2 font-semibold text-slate-900">
                (Muestra: {simulatedColabName})
              </span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={onResetSimulation}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold rounded-lg text-xs shadow-xs transition shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Volver a modo Sistemas</span>
        </button>
      </div>
    </div>
  );
}
