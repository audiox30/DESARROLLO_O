import React from 'react';
import { Calendar, Clock, CheckCircle2, Award, Info } from 'lucide-react';

export default function StatCards({ resumen, colaborador }) {
  if (!resumen) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Días por Ley LFT */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Días por Ley LFT</span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {resumen.diasCorrespondientes}
          </span>
          <span className="text-xs text-slate-500 font-medium">días</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          Antigüedad: <strong className="text-slate-700">{colaborador?.antiguedadAnios || 0} años</strong> cumplidos
        </p>
        <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 2. Días Gozados */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Días Disfrutados</span>
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-slate-700 tracking-tight">
            {resumen.diasGozados}
          </span>
          <span className="text-xs text-slate-500 font-medium">días</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          Aplicados y registrados en nómina
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
            {resumen.diasEnTramite}
          </span>
          <span className="text-xs text-amber-700/80 font-medium">días</span>
        </div>
        <p className="mt-1 text-[11px] text-amber-700/80 truncate">
          Pendientes de visto bueno de Líder/DO
        </p>
      </div>

      {/* 4. Días Disponibles */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Saldo Disponible</span>
          <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center backdrop-blur-xs">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-3xl font-black tracking-tight">
            {resumen.diasDisponibles}
          </span>
          <span className="text-xs text-emerald-100 font-medium">días hábiles</span>
        </div>
        <p className="mt-1 text-[11px] text-emerald-100/90 truncate">
          Listos para programar en este ciclo
        </p>
      </div>
    </div>
  );
}
