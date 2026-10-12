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
    'ADMIN_DO': 'Desarrollo Organizacional (Admin DO)',
    'LIDER': 'Líder / Jefe Directo',
    'COLABORADOR': 'Colaborador Solicitante'
  }[simulatedRole] || simulatedRole;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-slate-950 font-medium text-xs py-2 px-4 shadow-sm flex items-center justify-between border-b border-amber-600">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0 animate-bounce" />
          <span>
            <strong className="font-extrabold uppercase tracking-wide">Modo Simulación Activo:</strong> Estás visualizando la plataforma con el alcance de{' '}
            <strong className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded font-black border border-amber-300">
              {roleLabel}
            </strong>
            {simulatedColabName && (
              <span className="ml-1.5 text-slate-900 font-semibold">
                (Colaborador simulado: {simulatedColabName})
              </span>
            )}
          </span>
        </div>

        <button
          onClick={onResetSimulation}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold rounded-lg text-xs shadow-xs transition shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Volver a Vista Admin (Sistemas)</span>
        </button>
      </div>
    </div>
  );
}
