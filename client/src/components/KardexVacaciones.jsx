import React from 'react';
import { Calendar, CheckCircle2, Clock, AlertTriangle, FileText, XCircle } from 'lucide-react';

function formatFechaUI(fecha) {
  if (!fecha) return '—';
  try {
    const s = String(fecha).substring(0, 10);
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [y, m, d] = parts;
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mesNombre = meses[parseInt(m, 10) - 1] || m;
      return `${parseInt(d, 10)} ${mesNombre} ${y}`;
    }
    const date = new Date(fecha);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
}

export default function KardexVacaciones({ periodos = [], colaborador }) {
  if (!periodos || periodos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-semibold">No se encontraron períodos acumulados para este colaborador.</p>
        <p className="text-[11px] text-slate-400 mt-1">Los períodos de vacaciones se generan conforme a los aniversarios cumplidos según LFT.</p>
      </div>
    );
  }

  const hoyStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Kárdex de Vacaciones por Período Laboral (Vigencia 18 Meses LFT)
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Alta: <strong>{formatFechaUI(colaborador?.fechaAlta)}</strong> • {colaborador?.antiguedadTexto || `${colaborador?.antiguedadAnios || 0} años de servicio`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200/70 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-3">Período / Ciclo</th>
              <th className="py-3 px-3">Fecha Aniversario</th>
              <th className="py-3 px-3">Fin de Vigencia (18m)</th>
              <th className="py-3 px-3 text-center">Días LFT</th>
              <th className="py-3 px-3 text-center">Disfrutados</th>
              <th className="py-3 px-3 text-center">En Trámite</th>
              <th className="py-3 px-3 text-center">Saldo Disp.</th>
              <th className="py-3 px-3 text-right">Estatus de Vigencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periodos.map((p) => {
              const finVig = p.fechaFinVigencia || p.fechaExpiracionPeriodo;
              const iniVig = p.fechaInicioVigencia;
              const diffDias = p.diasRestantesVigencia ?? (finVig 
                ? Math.ceil((new Date(finVig + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24))
                : 0);

              let estado = p.estadoVigencia;
              if (!estado) {
                if (finVig && hoyStr > finVig) estado = 'CADUCADO';
                else if (iniVig && hoyStr < iniVig) estado = 'EN_CURSO';
                else if (p.diasPendientes <= 0) estado = 'AGOTADO';
                else estado = 'VIGENTE';
              }

              const esVigente = estado === 'VIGENTE';
              const esCaducado = estado === 'CADUCADO';
              const esAgotado = estado === 'AGOTADO';
              const esProximoAVencer = esVigente && diffDias <= 60;
              const diasDisp = p.diasDisponiblesPeriodo ?? (esVigente ? Math.max(0, p.diasPendientes - (p.diasEnTramite || 0)) : 0);

              return (
                <tr key={p.idSaldo || p.periodo || p.anioPeriodo} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{p.cicloTexto || `Año ${p.antiguedadCumplida} • Ciclo ${p.periodo || p.anioPeriodo}`}</span>
                      {p.esAjusteManual && (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 cursor-help shrink-0"
                          title={`Ajuste Inicial DO: ${p.motivoAjuste || 'Carga inicial / ajuste manual'} ${p.fechaAjuste ? '• ' + formatFechaUI(p.fechaAjuste) : ''}`}
                        >
                          ⚙️ Ajuste Inicial DO
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700">
                    {formatFechaUI(iniVig)}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-slate-700 block">
                      {formatFechaUI(finVig)}
                    </span>
                    {esVigente && (
                      <span className={`text-[10px] font-semibold ${esProximoAVencer ? 'text-amber-600' : 'text-slate-400'}`}>
                        {diffDias > 0 ? `Quedan ${diffDias} días` : 'Vence hoy'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {p.diasCorrespondientes}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-600 font-medium">
                    {p.diasGozados}
                  </td>
                  <td className="py-3 px-3 text-center text-amber-600 font-medium">
                    {p.diasEnTramite > 0 ? `-${p.diasEnTramite}` : '0'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-black ${
                      diasDisp > 0 ? 'text-emerald-700 text-sm' : 'text-slate-400'
                    }`}>
                      {diasDisp}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {esVigente ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        esProximoAVencer 
                          ? 'bg-amber-100 text-amber-900 border-amber-300' 
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {esProximoAVencer ? 'Vigente (Por vencer)' : 'Vigente'}
                      </span>
                    ) : esCaducado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title="Excedió los 18 meses de vigencia conforme a LFT">
                        <XCircle className="w-3 h-3" />
                        Prescrito (&gt;18m)
                      </span>
                    ) : esAgotado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Gozado 100%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        En curso
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span>* Regla LFT Art. 81 y 516: Los saldos tienen 18 meses de vigencia. Los períodos caducados ya no suman al Saldo Disponible.</span>
        <span className="font-semibold text-slate-700">Descuento automático por PEPS</span>
      </div>
    </div>
  );
}
