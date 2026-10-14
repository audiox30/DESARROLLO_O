import React, { useState } from 'react';
import { 
  X, Calendar, Clock, AlertTriangle, CheckCircle2, 
  Info, ChevronDown, ChevronUp, ShieldAlert, Award, 
  FileText, ArrowRight, Sparkles, Check
} from 'lucide-react';
import { formatearNombreColaborador } from '../utils/formatters';

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

export default function ModalDesgloseSaldo({ isOpen, onClose, saldoData, onNuevaSolicitud }) {
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  if (!isOpen) return null;

  const colab = saldoData?.colaborador || {};
  const resumen = saldoData?.resumen || {};
  
  // Respaldo dinámico en Frontend por si el backend entregó periodos sin filtrar o con desfase
  let periodosVigentes = saldoData?.periodosVigentes || [];
  let historialPeriodos = saldoData?.historialPeriodos || [];
  let saldoTotal = saldoData?.saldoTotalDisponible ?? resumen.diasDisponibles;
  const periodoEnCurso = saldoData?.periodoEnCurso || null;

  if ((!periodosVigentes || periodosVigentes.length === 0) && Array.isArray(saldoData?.periodos) && saldoData.periodos.length > 0) {
    const hoyStr = new Date().toISOString().split('T')[0];
    periodosVigentes = saldoData.periodos.filter(p => {
      const fin = p.fechaFinVigencia || p.fechaVencimiento;
      const esVig = p.esVigente ?? (fin ? hoyStr <= fin : true);
      const disp = p.diasDisponiblesPeriodo ?? p.diasDisponibles ?? Math.max(0, (p.diasPendientes || 0) - (p.diasEnTramite || 0));
      return esVig && disp > 0;
    });
  }

  if (saldoTotal === undefined || saldoTotal === null) {
    saldoTotal = periodosVigentes.reduce((sum, p) => {
      const disp = p.diasDisponiblesPeriodo ?? p.diasDisponibles ?? Math.max(0, (p.diasPendientes || 0) - (p.diasEnTramite || 0));
      return sum + disp;
    }, 0);
  }

  // Próximo Aniversario en cabecera
  let fechaProximoAniv = colab.proximoAniversario;
  let diasParaProximo = colab.diasParaProximoAniversario;

  if (!fechaProximoAniv && colab.fechaAlta) {
    try {
      const parts = String(colab.fechaAlta).substring(0, 10).split('-');
      if (parts.length === 3) {
        const aM = parseInt(parts[1], 10) - 1;
        const aD = parseInt(parts[2], 10);
        const hoy = new Date();
        let prox = new Date(hoy.getFullYear(), aM, aD);
        if (prox <= hoy) {
          prox = new Date(hoy.getFullYear() + 1, aM, aD);
        }
        fechaProximoAniv = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}-${String(prox.getDate()).padStart(2, '0')}`;
        diasParaProximo = Math.max(0, Math.ceil((prox.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-start justify-between relative shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Calendar className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Integración de Saldo Disponible y Vigencias LFT
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Cálculo individual conforme a la Reforma de Vacaciones Dignas y la política de <strong>vigencia de 18 meses</strong> (Art. 81 y 516 LFT).
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ficha Resumen del Colaborador */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Colaborador</span>
              <span className="font-bold text-slate-900 truncate block mt-0.5" title={colab.nombreCompleto}>
                {formatearNombreColaborador(colab.nombreCompleto || 'Colaborador')}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">#{colab.codigoEmpleado || '—'}</span>
            </div>

            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Ingreso Oficial</span>
              <span className="font-bold text-slate-800 font-mono block mt-0.5">
                {formatFechaUI(colab.fechaAlta)}
              </span>
              <span className="text-[11px] text-slate-500">{colab.empresa || 'Grupo JAMA'}</span>
            </div>

            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Antigüedad Cumplida</span>
              <span className="font-extrabold text-blue-700 block mt-0.5">
                {colab.antiguedadTexto || `${colab.antiguedadAnios || 0} años`}
              </span>
              <span className="text-[11px] text-slate-500">Al corte de hoy</span>
            </div>

            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Próximo Aniversario</span>
              <span className="font-bold text-slate-800 font-mono block mt-0.5">
                {formatFechaUI(fechaProximoAniv)}
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                {diasParaProximo ? `En ${diasParaProximo} días` : 'Próximamente'}
              </span>
            </div>
          </div>

          {/* Banner de Saldo Total Disponible */}
          <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700">Saldo Total Disponible (Vigente):</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700 tracking-tight">
                {saldoTotal}
              </span>
              <span className="text-xs font-bold text-emerald-800">días hábiles</span>
            </div>
          </div>
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* SECCIÓN 1: Períodos Activos que Integran el Saldo (Vigencia 18 Meses) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Períodos Activos que Integran tu Saldo Disponible (Vigencia 18 Meses)</span>
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {periodosVigentes.length} {periodosVigentes.length === 1 ? 'período vigente' : 'períodos vigentes'}
              </span>
            </div>

            {periodosVigentes.length === 0 ? (
              <div className="p-6 bg-amber-50/80 border border-amber-200 rounded-2xl text-center">
                <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-amber-900">Sin saldo vigente disponible</h4>
                <p className="text-[11px] text-amber-700 mt-1 max-w-md mx-auto">
                  {colab.antiguedadAnios < 1 
                    ? `Actualmente te encuentras en tu primer ciclo de trabajo. Tu derecho a vacaciones se generará automáticamente al cumplir tu primer año el ${formatFechaUI(fechaProximoAniv)}.`
                    : 'Tus períodos anteriores ya fueron disfrutados en su totalidad o superaron los 18 meses de vigencia legal.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {periodosVigentes.map((p) => {
                  const anioNum = p.anio || p.antiguedadCumplida || 1;
                  const anioFin = p.anioPeriodo || (p.fechaAniversario ? parseInt(String(p.fechaAniversario).substring(0, 4), 10) : new Date().getFullYear());
                  const anioInicio = anioFin - 1;
                  const periodoTexto = p.periodo || `${anioInicio}-${anioFin}`;
                  const fechaAniv = p.fechaAniversario || p.fechaInicioVigencia;
                  const fechaVenc = p.fechaVencimiento || p.fechaFinVigencia;
                  const diasRestantes = p.diasParaVencer ?? p.diasRestantesVigencia ?? (fechaVenc ? Math.ceil((new Date(fechaVenc + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24)) : 0);
                  const esUrgente = diasRestantes <= 60;

                  const diasDerechoLFT = p.diasDerechoLFT ?? p.diasCorrespondientes ?? 0;
                  const diasGozados = p.diasGozados ?? p.diasDisfrutados ?? 0;
                  const diasEnTramite = p.diasEnTramite ?? 0;
                  const diasDisponibles = p.diasDisponiblesPeriodo ?? p.diasDisponibles ?? Math.max(0, diasDerechoLFT - diasGozados - diasEnTramite);

                  return (
                    <div 
                      key={p.idSaldo || p.periodo || anioNum} 
                      className={`rounded-2xl border p-4 transition shadow-xs ${
                        esUrgente 
                          ? 'bg-amber-50/40 border-amber-300' 
                          : 'bg-emerald-50/20 border-emerald-200/90'
                      }`}
                    >
                      {/* Cabecera del Período */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            esUrgente ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}>
                            #{anioNum}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                                Período Año {anioNum} • Ciclo {periodoTexto}
                              </h4>
                              {p.esAjusteManual && (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 cursor-help"
                                  title={`Ajuste Inicial DO: ${p.motivoAjuste || 'Carga inicial / ajuste manual'} ${p.fechaAjuste ? '• ' + formatFechaUI(p.fechaAjuste) : ''}`}
                                >
                                  ⚙️ Ajuste Inicial DO
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Generado al aniversario: <strong className="text-slate-700">{formatFechaUI(fechaAniv)}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Badge de Vigencia */}
                        <div className="text-left sm:text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                            esUrgente 
                              ? 'bg-amber-100 text-amber-900 border-amber-300' 
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}>
                            <span>{esUrgente ? '⏳' : '🟢'}</span>
                            <span>
                              Vigente (Vence el {formatFechaUI(fechaVenc)} • Faltan {diasRestantes} días)
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Desglose numérico de ese período en 4 bloques */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        {/* Bloque 1: Generado el */}
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-center">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Generado el:</span>
                          <span className="text-xs sm:text-sm font-black text-slate-800 font-mono mt-0.5">
                            {formatFechaUI(fechaAniv)}
                          </span>
                          <span className="text-[10px] text-slate-400">Aniversario cumplido</span>
                        </div>

                        {/* Bloque 2: Días por Ley LFT */}
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-center">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Días por Ley LFT:</span>
                          <span className="text-xs sm:text-sm font-black text-blue-700 mt-0.5">
                            {diasDerechoLFT} días
                          </span>
                          <span className="text-[10px] text-slate-400">Vacaciones Dignas</span>
                        </div>

                        {/* Bloque 3: Disfrutados / En Trámite */}
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-center">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Disfrutados / En Trámite:</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
                            <span className="text-slate-800 font-bold">{diasGozados}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className={diasEnTramite > 0 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                              {diasEnTramite}
                            </span> días
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {diasEnTramite > 0 ? `${diasEnTramite} por autorizar` : 'Sin trámites pendientes'}
                          </span>
                        </div>

                        {/* Bloque 4: Disponible de este período */}
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 shadow-xs flex flex-col justify-center">
                          <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Disponible de este período:</span>
                          <span className="text-base sm:text-lg font-black text-emerald-700 mt-0.5 font-bold">
                            {diasDisponibles} días hábiles
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium">Saldo vigente</span>
                        </div>
                      </div>

                      {/* Fórmula explícita */}
                      <div className="mt-2.5 text-center text-[11px] text-slate-500 font-mono">
                        [{diasDerechoLFT} días por ley] - [{diasGozados} gozados] - [{diasEnTramite} en trámite] = <strong className="text-emerald-700 font-bold">{diasDisponibles} días disponibles</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Próximo Aniversario en Curso */}
          {periodoEnCurso && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-indigo-950">
                    Próximo Aniversario en Curso: {periodoEnCurso.cicloTexto}
                  </h4>
                  <p className="text-[11px] text-indigo-700/80">
                    Al cumplir tu aniversario el <strong>{formatFechaUI(periodoEnCurso.fechaInicioVigencia)}</strong> se te otorgarán <strong>+{periodoEnCurso.diasCorrespondientes} días</strong> de descanso conforme a LFT.
                  </p>
                </div>
              </div>
              <span className="font-mono text-indigo-800 font-bold bg-white px-3 py-1 rounded-xl border border-indigo-200 shrink-0">
                Faltan {periodoEnCurso.diasParaCumplir} días
              </span>
            </div>
          )}

          {/* SECCIÓN 2: Regla Aplicada (Nota Informativa de Negocio) */}
          <div className="p-4 bg-blue-50/70 border border-blue-200/90 rounded-2xl flex items-start gap-3 text-xs">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-slate-700 space-y-1">
              <h4 className="font-bold text-blue-900">
                Política de Vigencia Grupo JAMA / Art. 81 y 516 LFT:
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Los días de vacaciones generados en cada aniversario tienen una vigencia máxima de <strong>18 meses</strong> a partir de la fecha en que se cumplen (6 meses para otorgarlos conforme al Art. 81 LFT + 1 año de prescripción conforme al Art. 516 LFT). Al solicitar vacaciones, el sistema descuenta automáticamente primero los días del período más próximo a vencer (<strong>criterio PEPS</strong>: Primeras Entradas, Primeras Salidas).
              </p>
            </div>
          </div>

          {/* SECCIÓN 3: Períodos Anteriores (Colapsable) */}
          {historialPeriodos.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setMostrarHistorial(!mostrarHistorial)}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Historial de Períodos Anteriores ({historialPeriodos.length} ciclos cerrados o caducados)</span>
                </div>
                {mostrarHistorial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {mostrarHistorial && (
                <div className="p-4 overflow-x-auto bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                        <th className="pb-2 px-2">Período / Ciclo</th>
                        <th className="pb-2 px-2 text-center">Días LFT</th>
                        <th className="pb-2 px-2 text-center">Disfrutados</th>
                        <th className="pb-2 px-2">Fin Vigencia (18m)</th>
                        <th className="pb-2 px-2 text-right">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historialPeriodos.map((h) => {
                        const esCaducado = h.estadoVigencia === 'CADUCADO';
                        return (
                          <tr key={h.idSaldo || h.periodo} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-2 font-bold text-slate-800">
                              {h.cicloTexto || `Año ${h.antiguedadCumplida} • Ciclo ${h.periodo}`}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                              {h.diasCorrespondientes}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-600">
                              {h.diasGozados}
                            </td>
                            <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">
                              {formatFechaUI(h.fechaFinVigencia)}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {esCaducado ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  Caducado (&gt;18m)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Gozado al 100%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Sistema de Control de Vacaciones • Grupo JAMA
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cerrar
            </button>
            {onNuevaSolicitud && saldoTotal > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNuevaSolicitud();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Programar Vacaciones</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
