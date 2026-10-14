import React from 'react';
import { Calendar, Clock, CheckCircle2, Award } from 'lucide-react';

export default function StatCards({ resumen, colaborador, onAbrirDesglose }) {
  if (!resumen) return null;

  // 1. Días por Ley LFT (Correspondientes al ciclo o períodos vigentes dentro de 18 meses)
  const diasLey = resumen.diasLeyVigentes ?? (resumen.diasCorrespondientes !== undefined ? resumen.diasCorrespondientes : 0);
  // 2. Días Disfrutados
  const diasDisfrutados = resumen.diasDisfrutados ?? resumen.diasGozados ?? 0;
  // 3. En Trámite
  const diasEnTramite = resumen.diasEnTramite ?? 0;
  // 4. Saldo Disponible
  const saldoDisponible = resumen.saldoDisponible ?? resumen.diasDisponibles ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Días por Ley LFT (Vigentes) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Días por Ley LFT</span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {diasLey}
          </span>
          <span className="text-xs text-slate-500 font-medium">días</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          Antigüedad: <strong className="text-slate-700">{colaborador?.antiguedadAnios || 0} años</strong> cumplidos
        </p>
        <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 2. Días Disfrutados */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Días Disfrutados</span>
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-slate-700 tracking-tight">
            {diasDisfrutados}
          </span>
          <span className="text-xs text-slate-500 font-medium">días</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          Aplicados en períodos vigentes
        </p>
      </div>

      {/* 3. Días en Trámite */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">En Trámite</span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-amber-600 tracking-tight">
            {diasEnTramite}
          </span>
          <span className="text-xs text-amber-700/80 font-medium">días</span>
        </div>
        <p className="mt-1 text-[11px] text-amber-700/80 truncate">
          Pendientes de visto bueno de Líder/DO
        </p>
      </div>

      {/* 4. Días Disponibles (Interactivo con motor de vigencia 18 meses) */}
      <div 
        onClick={onAbrirDesglose}
        role={onAbrirDesglose ? "button" : undefined}
        tabIndex={onAbrirDesglose ? 0 : undefined}
        onKeyDown={(e) => { if (onAbrirDesglose && (e.key === 'Enter' || e.key === ' ')) onAbrirDesglose(); }}
        className={`bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-xs relative overflow-hidden group ${
          onAbrirDesglose 
            ? 'cursor-pointer hover:scale-[1.01] hover:shadow-lg transition-all select-none ring-2 ring-emerald-400/30 hover:ring-emerald-300' 
            : ''
        }`}
        title="Clic para ver desglose e integración de vigencias (18 meses LFT)"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Saldo Disponible</span>
          <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center backdrop-blur-xs group-hover:bg-white/30 transition">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-black tracking-tight">
            {saldoDisponible}
          </span>
          <span className="text-xs text-emerald-100 font-medium">días hábiles</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-emerald-100">
          <span className="font-semibold flex items-center gap-1 group-hover:text-white transition">
            🔍 Clic para ver integración y vigencias (18 meses)
          </span>
        </div>
      </div>
    </div>
  );
}
