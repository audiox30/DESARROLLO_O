import React, { useState, useEffect } from 'react';
import { 
  Sliders, Calendar, CheckCircle2, AlertCircle, History, 
  Save, RefreshCw, ShieldAlert, ArrowRight, Clock, UserCheck 
} from 'lucide-react';
import { api } from '../api/client';

const MOTIVOS_PREDEFINIDOS = [
  'Carga inicial de arranque',
  'Ajuste por días pendientes de años anteriores',
  'Corrección de kárdex',
  'Acuerdo especial',
  'Otro motivo personalizado'
];

export default function SeccionAjusteSaldo({ colaborador, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [periodos, setPeriodos] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [nuevoSaldo, setNuevoSaldo] = useState('');
  const [motivoSelect, setMotivoSelect] = useState('Carga inicial de arranque');
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState('');

  const idColaborador = colaborador?.IdColaborador || colaborador?.id;

  useEffect(() => {
    if (idColaborador) {
      cargarDatos();
    }
  }, [idColaborador]);

  async function cargarDatos() {
    try {
      setLoading(true);
      setError('');
      
      const [desgloseRes, bitacoraRes] = await Promise.all([
        api.getDesgloseSaldo(idColaborador),
        api.getBitacoraAjustesSaldo(idColaborador).catch(() => ({ data: [] }))
      ]);

      const pers = desgloseRes.periodos || [];
      setPeriodos(pers);
      setBitacora(bitacoraRes?.data || []);

      // Seleccionar por defecto el período vigente o el más reciente
      if (pers.length > 0) {
        const vigente = pers.find(p => p.esVigente) || pers[pers.length - 1];
        setPeriodoSeleccionado(vigente);
        setNuevoSaldo(vigente.diasPendientes ?? vigente.diasDisponiblesPeriodo ?? 0);
      }
    } catch (err) {
      console.error('Error cargando datos de saldos para ajuste:', err);
      setError('No se pudo cargar el desglose de períodos del colaborador.');
    } finally {
      setLoading(false);
    }
  }

  function handleCambiarPeriodo(e) {
    const pKey = e.target.value;
    const p = periodos.find(item => String(item.periodo) === pKey || String(item.anio) === pKey || String(item.idSaldo) === pKey);
    if (p) {
      setPeriodoSeleccionado(p);
      setNuevoSaldo(p.diasPendientes ?? p.diasDisponiblesPeriodo ?? 0);
    }
  }

  async function handleGuardarAjuste(e) {
    e.preventDefault();
    setError('');
    setMensaje(null);

    if (!periodoSeleccionado) {
      setError('Por favor selecciona un período a ajustar.');
      return;
    }

    const saldoNum = Number(nuevoSaldo);
    if (nuevoSaldo === '' || isNaN(saldoNum) || saldoNum < 0) {
      setError('El saldo a asignar debe ser un número entero mayor o igual a 0.');
      return;
    }

    const motivoFinal = motivoSelect === 'Otro motivo personalizado'
      ? motivoPersonalizado.trim()
      : motivoSelect;

    if (!motivoFinal) {
      setError('El motivo del ajuste es obligatorio.');
      return;
    }

    try {
      setGuardando(true);
      const res = await api.ajustarSaldoIndividual({
        idColaborador,
        periodo: periodoSeleccionado.periodo,
        anioPeriodo: periodoSeleccionado.anioPeriodo,
        nuevoSaldo: Math.floor(saldoNum),
        motivo: motivoFinal
      });

      setMensaje({
        tipo: 'exito',
        texto: res.message || `Saldo inicial ajustado exitosamente a ${Math.floor(saldoNum)} días.`
      });

      // Recargar períodos y bitácora
      await cargarDatos();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error guardando ajuste de saldo:', err);
      setError(err.message || 'Error al guardar el ajuste de saldo.');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
        <span className="text-xs font-semibold text-slate-600">Cargando períodos y saldos del colaborador...</span>
      </div>
    );
  }

  const saldoCalculadoActual = periodoSeleccionado
    ? (periodoSeleccionado.diasPendientes ?? periodoSeleccionado.diasDisponiblesPeriodo ?? 0)
    : 0;

  return (
    <div className="space-y-5">
      {/* Banner Exclusivo ADMIN_DO / SISTEMAS */}
      <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/90 rounded-2xl flex items-start gap-3">
        <div className="p-2 bg-purple-100 text-purple-700 rounded-xl shrink-0 mt-0.5">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black text-purple-950 uppercase tracking-wide">
              ⚙️ Módulo de Ajuste de Saldo de Vacaciones / Saldo Inicial
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-200/70 text-purple-800 rounded-full border border-purple-300">
              ADMIN_DO & SISTEMAS
            </span>
          </div>
          <p className="text-[11px] text-purple-900 mt-1 leading-relaxed">
            Permite establecer o corregir el saldo inicial de vacaciones del colaborador para un período determinado. 
            El saldo asignado se protege automáticamente en el kárdex y se audita en la bitácora institucional.
          </p>
        </div>
      </div>

      {mensaje && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{mensaje.texto}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario de Ajuste Individual */}
      <form onSubmit={handleGuardarAjuste} className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Selector de Período */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Período a Ajustar</span>
              <span className="text-[10px] text-slate-400 font-normal">Ciclo de aniversario</span>
            </label>
            <select
              value={periodoSeleccionado ? periodoSeleccionado.periodo : ''}
              onChange={handleCambiarPeriodo}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-600 outline-none font-medium"
            >
              {periodos.map(p => (
                <option key={p.idSaldo || p.periodo} value={p.periodo}>
                  {p.cicloTexto || `Año ${p.antiguedadCumplida} • Ciclo ${p.periodo}`} ({p.estadoVigencia === 'VIGENTE' ? 'VIGENTE' : p.estadoVigencia})
                </option>
              ))}
            </select>
          </div>

          {/* Saldo Calculado Actual (Solo Lectura) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Saldo Actual Registrado</span>
              <span className="text-[10px] text-slate-400 font-normal">Calculado / Base</span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={`${saldoCalculadoActual} días hábiles`}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold outline-none cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 font-semibold absolute right-3 top-1/2 -translate-y-1/2">
                Solo lectura 🔒
              </span>
            </div>
          </div>

          {/* Saldo Inicial / Real a Asignar */}
          <div>
            <label className="block text-xs font-bold text-purple-950 mb-1 flex items-center justify-between">
              <span>Saldo Inicial / Real a Asignar</span>
              <span className="text-[10px] text-purple-700 font-bold">Días enteros</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                required
                value={nuevoSaldo}
                onChange={(e) => setNuevoSaldo(e.target.value)}
                placeholder="Ej. 12"
                className="w-full px-3 py-2 bg-purple-50/40 border border-purple-300 rounded-xl text-xs font-black text-purple-900 focus:ring-2 focus:ring-purple-600 focus:bg-white outline-none"
              />
              <span className="text-[10px] font-bold text-purple-700 absolute right-3 top-1/2 -translate-y-1/2">
                DÍAS
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Establece los días netos que el colaborador tendrá disponibles para este ciclo.
            </p>
          </div>

          {/* Motivo del Ajuste */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Motivo del Ajuste (Obligatorio)</span>
              <span className="text-[10px] text-slate-400 font-normal">Auditable</span>
            </label>
            <select
              value={motivoSelect}
              onChange={(e) => setMotivoSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-600 outline-none font-medium"
            >
              {MOTIVOS_PREDEFINIDOS.map((m, idx) => (
                <option key={idx} value={m}>{m}</option>
              ))}
            </select>

            {motivoSelect === 'Otro motivo personalizado' && (
              <input
                type="text"
                required
                value={motivoPersonalizado}
                onChange={(e) => setMotivoPersonalizado(e.target.value)}
                placeholder="Escribe el motivo detallado del ajuste..."
                className="w-full mt-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-600 outline-none"
              />
            )}
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>El kárdex se actualizará inmediatamente con la etiqueta <code>[Ajuste Inicial DO]</code>.</span>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              guardando
                ? 'bg-purple-200 text-purple-700 cursor-not-allowed'
                : 'bg-purple-700 hover:bg-purple-800 text-white'
            }`}
          >
            {guardando ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando ajuste...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Aplicar y Guardar Ajuste de Saldo</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Historial / Bitácora de Ajustes del Colaborador */}
      <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-purple-700" />
          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Bitácora de Ajustes Realizados a este Colaborador
          </h5>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
            {bitacora.length} {bitacora.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {bitacora.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No se han registrado ajustes manuales previos para este colaborador.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2 px-2.5">Fecha</th>
                  <th className="py-2 px-2.5">Período</th>
                  <th className="py-2 px-2.5 text-center">Saldo Anterior</th>
                  <th className="py-2 px-2.5 text-center">Nuevo Saldo</th>
                  <th className="py-2 px-2.5 text-center">Diferencia</th>
                  <th className="py-2 px-2.5">Motivo</th>
                  <th className="py-2 px-2.5 text-right">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bitacora.map((b, i) => (
                  <tr key={b.IdAjuste || i} className="hover:bg-slate-50/80">
                    <td className="py-2 px-2.5 font-mono text-slate-600">{b.FechaAjuste}</td>
                    <td className="py-2 px-2.5 font-bold text-slate-800">{b.Periodo}</td>
                    <td className="py-2 px-2.5 text-center text-slate-500 font-semibold">{b.SaldoAnterior} d</td>
                    <td className="py-2 px-2.5 text-center font-black text-purple-800 bg-purple-50/60">{b.NuevoSaldo} d</td>
                    <td className="py-2 px-2.5 text-center font-bold">
                      <span className={b.DiferenciaDias >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {b.DiferenciaDias > 0 ? `+${b.DiferenciaDias}` : b.DiferenciaDias} d
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-slate-700 max-w-[220px] truncate" title={b.Motivo}>
                      {b.Motivo}
                    </td>
                    <td className="py-2 px-2.5 text-right font-medium text-slate-600">
                      {b.UsuarioAjusto || 'ADMIN_DO'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
