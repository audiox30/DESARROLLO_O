import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, Info, CalendarDays, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';

export default function CalendarioVacaciones({ onDateSelect, saldoDisponible = 0 }) {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [calculo, setCalculo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diasInhabilesList, setDiasInhabilesList] = useState([]);

  // Cargar catálogo de días festivos oficiales
  useEffect(() => {
    async function loadFeriados() {
      try {
        const res = await api.getDiasInhabiles();
        if (res.success && Array.isArray(res.data)) {
          setDiasInhabilesList(res.data);
        }
      } catch (err) {
        console.error('Error al cargar días inhábiles:', err);
      }
    }
    loadFeriados();
  }, []);

  // Sugerir rango inicial estándar Grupo JAMA: Próximo Lunes a Sábado (6 días laborables)
  useEffect(() => {
    const hoy = new Date();
    const proximoLunes = new Date(hoy);
    proximoLunes.setDate(hoy.getDate() + ((1 + 7 - hoy.getDay()) % 7 || 7));
    const proximoSabado = new Date(proximoLunes);
    proximoSabado.setDate(proximoLunes.getDate() + 5);

    const f1 = proximoLunes.toISOString().split('T')[0];
    const f2 = proximoSabado.toISOString().split('T')[0];
    setFechaInicio(f1);
    setFechaFin(f2);
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      if (fechaInicio > fechaFin) {
        setError('La fecha de fin no puede ser anterior a la fecha de inicio.');
        setCalculo(null);
        if (onDateSelect) onDateSelect(null);
        return;
      }

      // Validar que inicio y fin no sean domingo (descanso semanal obligatorio)
      const [y1, m1, d1] = fechaInicio.split('-').map(Number);
      const [y2, m2, d2] = fechaFin.split('-').map(Number);
      const dt1 = new Date(Date.UTC(y1, m1 - 1, d1, 12, 0, 0));
      const dt2 = new Date(Date.UTC(y2, m2 - 1, d2, 12, 0, 0));

      if (dt1.getUTCDay() === 0) {
        setError('La fecha de inicio no puede ser Domingo. En Grupo JAMA los domingos son descanso obligatorio semanal; selecciona de lunes a sábado.');
        setCalculo(null);
        if (onDateSelect) onDateSelect(null);
        return;
      }

      if (dt2.getUTCDay() === 0) {
        setError('La fecha de fin no puede ser Domingo. En Grupo JAMA los domingos son descanso obligatorio semanal; selecciona de lunes a sábado.');
        setCalculo(null);
        if (onDateSelect) onDateSelect(null);
        return;
      }

      // Validar si inicio o fin coinciden con feriados oficiales
      const feriadoInicio = diasInhabilesList.find(d => d.Fecha === fechaInicio || d.fecha === fechaInicio);
      if (feriadoInicio) {
        setError(`La fecha de inicio (${fechaInicio}) es un día festivo oficial (${feriadoInicio.Descripcion || feriadoInicio.descripcion}). Selecciona un día laborable.`);
        setCalculo(null);
        if (onDateSelect) onDateSelect(null);
        return;
      }

      const feriadoFin = diasInhabilesList.find(d => d.Fecha === fechaFin || d.fecha === fechaFin);
      if (feriadoFin) {
        setError(`La fecha de fin (${fechaFin}) es un día festivo oficial (${feriadoFin.Descripcion || feriadoFin.descripcion}). Selecciona un día laborable.`);
        setCalculo(null);
        if (onDateSelect) onDateSelect(null);
        return;
      }

      setError('');
      calcularDias();
    }
  }, [fechaInicio, fechaFin, diasInhabilesList]);

  async function calcularDias() {
    try {
      setLoading(true);
      // Jornada estándar Grupo JAMA: 6 días (Lunes a Sábado)
      const res = await api.calcularDiasHabiles({ fechaInicio, fechaFin, jornadaLaboralDias: 6 });
      if (res.success) {
        setCalculo(res);
        if (onDateSelect) {
          onDateSelect({
            fechaInicio,
            fechaFin,
            totalDiasLaborables: res.totalDiasLaborables,
            totalDiasNaturales: res.totalDiasNaturales,
            detalle: res.dias
          });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const excedeSaldo = calculo && calculo.totalDiasLaborables > saldoDisponible;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Simulador y Selector de Período</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Jornada Lunes a Sábado
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Los sábados son días laborables y consumen vacaciones. Solo se descuentan domingos y festivos oficiales.
            </p>
          </div>
        </div>
      </div>

      {/* Selectores de Fecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Fecha de Inicio (Primer día de ausencia)
          </label>
          <div className="relative">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Fecha de Fin (Último día de ausencia)
          </label>
          <div className="relative">
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tarjeta de Resumen y Desglose en Tiempo Real */}
      {calculo && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Días Hábiles</span>
              <p className="text-2xl font-black text-blue-700 mt-0.5">{calculo.totalDiasLaborables}</p>
              <span className="text-[10px] text-blue-600 font-semibold">Lunes a Sábado</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Descansos</span>
              <p className="text-2xl font-black text-slate-600 mt-0.5">{calculo.totalFinesDeSemana}</p>
              <span className="text-[10px] text-slate-500 font-medium">Solo Domingos</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Festivos LFT</span>
              <p className="text-2xl font-black text-amber-600 mt-0.5">{calculo.totalFestivos}</p>
              <span className="text-[10px] text-slate-500 font-medium">Asuetos oficiales</span>
            </div>
          </div>

          {/* Alerta de saldo insuficiente */}
          {excedeSaldo && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Saldo insuficiente para este período:</span>
                <p className="mt-0.5">
                  Estás seleccionando {calculo.totalDiasLaborables} días hábiles, pero tu saldo disponible actual es de {saldoDisponible} días. Reduce el rango de fechas.
                </p>
              </div>
            </div>
          )}

          {/* Detalle Día por Día */}
          <div className="mt-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Desglose Detallado del Período ({calculo.dias.length} días naturales)
            </span>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {calculo.dias.map((d) => (
                <div
                  key={d.fecha}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition-all ${
                    d.esLaborable
                      ? 'bg-blue-50/40 border-blue-200 text-blue-900 font-semibold'
                      : d.esDiaInhabil
                      ? 'bg-amber-50/60 border-amber-200 text-amber-900 font-medium'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{d.fecha}</span>
                    <span className="font-bold">{d.nombreDia}</span>
                    {d.diaSemanaIndex === 6 && d.esLaborable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/80 text-blue-900 font-bold">
                        Sábado Laborable
                      </span>
                    )}
                    {d.esDiaInhabil && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 font-bold">
                        {d.descripcion}
                      </span>
                    )}
                  </div>
                  <div>
                    {d.esLaborable ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Día Hábil (1.0)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        {d.diaSemanaIndex === 0 ? 'Descanso Semanal (Domingo)' : d.descripcion}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
