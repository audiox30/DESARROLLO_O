import React from 'react';
import { Calendar, CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';

export default function KardexVacaciones({ periodos = [], colaborador }) {
  if (!periodos || periodos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-semibold">No se encontraron períodos acumulados para este colaborador.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Kárdex de Vacaciones por Período Laboral (LFT Vacaciones Dignas)
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Alta: {colaborador?.fechaAlta} • {colaborador?.antiguedadAnios || 0} años de servicio
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200/70 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Período / Ciclo</th>
              <th className="py-3 px-4 text-center">Antigüedad</th>
              <th className="py-3 px-4 text-center">Días por Ley (LFT)</th>
              <th className="py-3 px-4 text-center">Días Gozados</th>
              <th className="py-3 px-4 text-center">Días Pendientes</th>
              <th className="py-3 px-4">Fecha Límite (18 Meses)</th>
              <th className="py-3 px-4 text-right">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periodos.map((p) => {
              const esVigente = !p.esCerrado && p.diasPendientes > 0;
              return (
                <tr key={p.idSaldo || p.anioPeriodo} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    Período {p.anioPeriodo}
                    <span className="block text-[10px] font-normal text-slate-400">
                      {p.fechaInicioPeriodo} al {p.fechaFinPeriodo}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">
                    {p.antiguedadCumplida} {p.antiguedadCumplida === 1 ? 'año' : 'años'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {p.diasCorrespondientes} días
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 font-medium">
                    {p.diasGozados}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-black ${
                      p.diasPendientes > 0 ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      {p.diasPendientes}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {p.fechaExpiracionPeriodo}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {esVigente ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Clock className="w-3 h-3" />
                        Vigente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Cerrado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
