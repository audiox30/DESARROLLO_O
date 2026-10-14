/**
 * Servicio de Cálculo de Vacaciones según Ley Federal del Trabajo (LFT - México)
 * Incorpora la Reforma de Vacaciones Dignas (Vigente desde el 1 de enero de 2023)
 * y la Política de Vigencia de 18 Meses (Art. 81 y 516 LFT) de Grupo JAMA.
 */

function calcularDiasLFT(antiguedadAnios) {
  if (antiguedadAnios < 1) return 0;
  if (antiguedadAnios === 1) return 12;
  if (antiguedadAnios === 2) return 14;
  if (antiguedadAnios === 3) return 16;
  if (antiguedadAnios === 4) return 18;
  if (antiguedadAnios === 5) return 20;
  if (antiguedadAnios >= 6 && antiguedadAnios <= 10) return 22;
  if (antiguedadAnios >= 11 && antiguedadAnios <= 15) return 24;
  if (antiguedadAnios >= 16 && antiguedadAnios <= 20) return 26;
  if (antiguedadAnios >= 21 && antiguedadAnios <= 25) return 28;
  if (antiguedadAnios >= 26 && antiguedadAnios <= 30) return 30;
  if (antiguedadAnios >= 31 && antiguedadAnios <= 35) return 32;
  
  // A partir de 36 años, 2 días más por cada 5 años
  const bloquesExtra = Math.floor((antiguedadAnios - 31) / 5) + 1;
  return 32 + (bloquesExtra * 2);
}

function parseFecha(fecha) {
  if (!fecha) return null;
  let s = '';
  if (fecha instanceof Date) {
    s = fecha.toISOString().substring(0, 10);
  } else {
    s = String(fecha).substring(0, 10);
  }
  const parts = s.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(fecha);
}

function formatearFechaISO(date) {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function agregarAnios(fecha, anios) {
  const f = parseFecha(fecha);
  if (!f) return null;
  return new Date(f.getFullYear() + anios, f.getMonth(), f.getDate());
}

function agregarMeses(fecha, meses) {
  const f = parseFecha(fecha);
  if (!f) return null;
  return new Date(f.getFullYear(), f.getMonth() + meses, f.getDate());
}

function calcularAntiguedad(fechaAltaInput, fechaReferencia = new Date()) {
  const alta = parseFecha(fechaAltaInput);
  if (!alta || isNaN(alta.getTime())) return 0;
  const hoy = parseFecha(fechaReferencia);

  let anios = hoy.getFullYear() - alta.getFullYear();
  const mesDiff = hoy.getMonth() - alta.getMonth();
  const diaDiff = hoy.getDate() - alta.getDate();

  if (mesDiff < 0 || (mesDiff === 0 && diaDiff < 0)) {
    anios--;
  }
  return Math.max(0, anios);
}

function calcularDetalleAntiguedad(fechaAltaInput, fechaReferencia = new Date()) {
  const alta = parseFecha(fechaAltaInput);
  if (!alta || isNaN(alta.getTime())) {
    return {
      antiguedadAnios: 0,
      antiguedadMeses: 0,
      antiguedadDias: 0,
      antiguedadTexto: '0 meses',
      proximoAniversario: null,
      diasParaProximoAniversario: 0
    };
  }

  const hoy = parseFecha(fechaReferencia);

  let anios = hoy.getFullYear() - alta.getFullYear();
  let meses = hoy.getMonth() - alta.getMonth();
  let dias = hoy.getDate() - alta.getDate();

  if (dias < 0) {
    meses--;
    const prevMonthLastDay = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
    dias += prevMonthLastDay;
  }
  if (meses < 0) {
    anios--;
    meses += 12;
  }

  anios = Math.max(0, anios);
  meses = Math.max(0, meses);

  // Próximo aniversario
  const proximoAniversario = agregarAnios(alta, anios + 1);
  const diffMs = proximoAniversario.getTime() - hoy.getTime();
  const diasParaProximo = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  let antiguedadTexto = '';
  if (anios > 0) {
    const aniosTxt = `${anios} ${anios === 1 ? 'año' : 'años'}`;
    const mesesTxt = meses > 0 ? `, ${meses} ${meses === 1 ? 'mes' : 'meses'}` : '';
    antiguedadTexto = `${aniosTxt}${mesesTxt}`;
  } else {
    antiguedadTexto = `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }

  return {
    antiguedadAnios: anios,
    antiguedadMeses: meses,
    antiguedadDias: dias,
    antiguedadTexto,
    proximoAniversario: formatearFechaISO(proximoAniversario),
    diasParaProximoAniversario: diasParaProximo
  };
}

/**
 * Generación y cálculo dinámico de períodos por antigüedad con política de 18 meses
 */
function generarPeriodosVacaciones(fechaAltaInput, diasTomadosHist = 0, diasEnTramiteTotal = 0, fechaReferencia = new Date(), saldosMap = new Map()) {
  const alta = parseFecha(fechaAltaInput);
  if (!alta || isNaN(alta.getTime())) return [];

  const hoy = parseFecha(fechaReferencia);
  const antiguedadCumplida = calcularAntiguedad(alta, hoy);
  const periodos = [];
  const idSaldosUsados = new Set();
  let diasTomadosRestantes = Number(diasTomadosHist) || 0;

  for (let anio = 1; anio <= Math.max(1, antiguedadCumplida); anio++) {
    let fechaAniversario = agregarAnios(alta, anio);
    let fechaVencimiento = agregarMeses(fechaAniversario, 18);
    const diasDerechoLFT = calcularDiasLFT(anio);

    const anioFin = fechaAniversario.getFullYear();
    const anioInicio = anioFin - 1;
    const periodoCiclo = `${anioInicio}-${anioFin}`;

    // Obtener días disfrutados y en trámite cruzando con saldos existentes si vienen de BD
    const saldoExistente = saldosMap.get(periodoCiclo) || saldosMap.get(anioFin) || saldosMap.get(anio);
    let diasDisfrutados = 0;
    let diasEnTramitePeriodo = 0;
    let diasCorrespondientes = diasDerechoLFT;
    const esAjusteManual = Boolean(saldoExistente && (saldoExistente.EsAjusteManual || saldoExistente.esAjusteManual));
    const motivoAjuste = saldoExistente ? (saldoExistente.MotivoAjuste || saldoExistente.motivoAjuste || null) : null;
    const fechaAjuste = saldoExistente ? (saldoExistente.FechaAjuste || saldoExistente.fechaAjuste || null) : null;
    const saldoInicialManual = saldoExistente ? (saldoExistente.SaldoInicialManual ?? saldoExistente.saldoInicialManual ?? null) : null;

    if (saldoExistente) {
      if (saldoExistente.IdSaldo || saldoExistente.idSaldo) {
        idSaldosUsados.add(saldoExistente.IdSaldo || saldoExistente.idSaldo);
      }
      if (saldoExistente.fechaInicioVigencia || saldoExistente.FechaInicioVigencia) {
        const fIni = parseFecha(saldoExistente.fechaInicioVigencia || saldoExistente.FechaInicioVigencia);
        if (fIni && !isNaN(fIni.getTime())) fechaAniversario = fIni;
      }
      if (saldoExistente.fechaFinVigencia || saldoExistente.FechaFinVigencia) {
        const fFin = parseFecha(saldoExistente.fechaFinVigencia || saldoExistente.FechaFinVigencia);
        if (fFin && !isNaN(fFin.getTime())) fechaVencimiento = fFin;
      }
      if (esAjusteManual && (saldoExistente.DiasCorrespondientes !== undefined || saldoExistente.diasCorrespondientes !== undefined)) {
        diasCorrespondientes = Number(saldoExistente.DiasCorrespondientes ?? saldoExistente.diasCorrespondientes);
      }
      diasDisfrutados = Number(saldoExistente.DiasGozados ?? saldoExistente.diasGozados ?? 0);
      diasEnTramitePeriodo = Number(saldoExistente.DiasEnTramite ?? saldoExistente.diasEnTramite ?? 0);
    } else {
      // Distribución FIFO / PEPS si viene de un total histórico
      if (diasTomadosRestantes >= diasDerechoLFT) {
        diasDisfrutados = diasDerechoLFT;
        diasTomadosRestantes -= diasDerechoLFT;
      } else {
        diasDisfrutados = diasTomadosRestantes;
        diasTomadosRestantes = 0;
      }
    }

    const diasPendientes = Math.max(0, diasCorrespondientes - diasDisfrutados);
    const diasDisponibles = Math.max(0, diasPendientes - diasEnTramitePeriodo);

    // Evaluación estricta de Vigencia (18 meses a partir de la fecha en que se cumplen)
    const esVigente = (hoy <= fechaVencimiento) && (diasPendientes > 0);
    const diasParaVencer = Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    let estadoVigencia = 'VIGENTE';
    let esCerrado = false;

    if (hoy < fechaAniversario) {
      estadoVigencia = 'EN_CURSO';
      esCerrado = false;
    } else if (hoy > fechaVencimiento) {
      estadoVigencia = 'CADUCADO';
      esCerrado = true;
    } else if (diasPendientes <= 0) {
      estadoVigencia = 'AGOTADO';
      esCerrado = true;
    } else {
      estadoVigencia = 'VIGENTE';
      esCerrado = false;
    }

    periodos.push({
      idSaldo: saldoExistente ? (saldoExistente.IdSaldo || saldoExistente.idSaldo || anio) : anio,
      anio: anio,
      anioPeriodo: anioFin,
      periodo: periodoCiclo,
      cicloTexto: `Período Año ${anio} • Ciclo ${periodoCiclo}`,
      antiguedadCumplida: anio,
      diasDerechoLFT,
      diasCorrespondientes,
      diasDisfrutados,
      diasGozados: diasDisfrutados,
      diasPendientes,
      diasEnTramite: diasEnTramitePeriodo,
      diasDisponibles: esVigente ? diasDisponibles : 0,
      diasDisponiblesPeriodo: esVigente ? diasDisponibles : 0,
      fechaAniversario: formatearFechaISO(fechaAniversario),
      fechaInicioVigencia: formatearFechaISO(fechaAniversario),
      fechaVencimiento: formatearFechaISO(fechaVencimiento),
      fechaFinVigencia: formatearFechaISO(fechaVencimiento),
      fechaExpiracionPeriodo: formatearFechaISO(fechaVencimiento),
      diasParaVencer,
      diasRestantesVigencia: diasParaVencer,
      esVigente,
      estadoVigencia,
      esProximoAVencer: esVigente && diasParaVencer <= 60,
      esCerrado,
      esAjusteManual,
      saldoInicialManual,
      motivoAjuste,
      fechaAjuste
    });
  }

  // Procesar períodos en saldosMap que no fueron cubiertos en el loop por aniversario
  if (saldosMap && saldosMap.values) {
    for (const s of saldosMap.values()) {
      const sId = s.IdSaldo || s.idSaldo;
      if (!sId || idSaldosUsados.has(sId)) continue;
      idSaldosUsados.add(sId);

      const fIni = parseFecha(s.fechaInicioVigencia || s.FechaInicioVigencia) || hoy;
      const fFin = parseFecha(s.fechaFinVigencia || s.FechaFinVigencia || s.fechaExpiracionPeriodo || s.FechaExpiracionPeriodo) || agregarMeses(fIni, 18);
      const diasCorrespondientes = Number(s.diasCorrespondientes ?? s.DiasCorrespondientes ?? 0);
      const diasDisfrutados = Number(s.diasGozados ?? s.DiasGozados ?? 0);
      const diasEnTramitePeriodo = Number(s.diasEnTramite ?? s.DiasEnTramite ?? 0);
      const diasPendientes = Number(s.diasPendientes ?? s.DiasPendientes ?? Math.max(0, diasCorrespondientes - diasDisfrutados));
      const diasDisponibles = Math.max(0, diasPendientes - diasEnTramitePeriodo);

      const esVigente = (hoy <= fFin) && (diasPendientes > 0);
      const diasParaVencer = Math.ceil((fFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

      let estadoVigencia = 'VIGENTE';
      if (hoy > fFin) {
        estadoVigencia = 'CADUCADO';
      } else if (hoy < fIni) {
        estadoVigencia = 'EN_CURSO';
      } else if (diasPendientes <= 0) {
        estadoVigencia = 'AGOTADO';
      } else {
        estadoVigencia = 'VIGENTE';
      }

      periodos.push({
        idSaldo: sId,
        anio: s.antiguedadCumplida || s.AntiguedadCumplida || 1,
        anioPeriodo: s.anioPeriodo || s.AnioPeriodo,
        periodo: s.periodo || s.Periodo,
        cicloTexto: `Período Ciclo ${s.periodo || s.Periodo}`,
        antiguedadCumplida: s.antiguedadCumplida || s.AntiguedadCumplida || 1,
        diasDerechoLFT: diasCorrespondientes,
        diasCorrespondientes,
        diasDisfrutados,
        diasGozados: diasDisfrutados,
        diasPendientes,
        diasEnTramite: diasEnTramitePeriodo,
        diasDisponibles: esVigente ? diasDisponibles : 0,
        diasDisponiblesPeriodo: esVigente ? diasDisponibles : 0,
        fechaAniversario: formatearFechaISO(fIni),
        fechaInicioVigencia: formatearFechaISO(fIni),
        fechaVencimiento: formatearFechaISO(fFin),
        fechaFinVigencia: formatearFechaISO(fFin),
        fechaExpiracionPeriodo: formatearFechaISO(fFin),
        diasParaVencer,
        diasRestantesVigencia: diasParaVencer,
        esVigente,
        estadoVigencia,
        esProximoAVencer: esVigente && diasParaVencer <= 60,
        esCerrado: Boolean(s.esCerrado || s.EsCerrado || estadoVigencia === 'CADUCADO' || estadoVigencia === 'AGOTADO'),
        esAjusteManual: Boolean(s.esAjusteManual || s.EsAjusteManual),
        saldoInicialManual: s.saldoInicialManual ?? s.SaldoInicialManual ?? null,
        motivoAjuste: s.motivoAjuste || s.MotivoAjuste || null,
        fechaAjuste: s.fechaAjuste || s.FechaAjuste || null
      });
    }
  }

  periodos.sort((a, b) => new Date(a.fechaInicioVigencia || 0) - new Date(b.fechaInicioVigencia || 0));

  // Si se pasó un total de días en trámite global y no estaba mapeado en los saldos, distribuir por PEPS
  const totalTramiteMapeado = periodos.reduce((sum, p) => sum + (p.diasEnTramite || 0), 0);
  if (diasEnTramiteTotal > 0 && totalTramiteMapeado === 0) {
    let tramiteRestante = Number(diasEnTramiteTotal);
    const vigentes = periodos.filter(p => p.esVigente && p.diasPendientes > 0);
    vigentes.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

    for (const p of vigentes) {
      if (tramiteRestante <= 0) break;
      const aDescontar = Math.min(p.diasPendientes, tramiteRestante);
      p.diasEnTramite = aDescontar;
      p.diasDisponibles = Math.max(0, p.diasPendientes - aDescontar);
      p.diasDisponiblesPeriodo = p.diasDisponibles;
      tramiteRestante -= aDescontar;
    }
  }

  return periodos;
}

/**
 * Organiza los períodos en las colecciones requeridas por el Modal y Desglose
 */
function estructurarDesgloseSaldo(colaborador, periodos = [], diasEnTramiteTotal = 0, fechaReferencia = new Date()) {
  const hoy = parseFecha(fechaReferencia);
  const detalleAntiguedad = calcularDetalleAntiguedad(colaborador?.fechaAlta || colaborador?.FechaAlta, hoy);

  // 1. Períodos Vigentes: EXCLUSIVAMENTE los que están dentro de sus 18 meses (esVigente === true) y con días disponibles > 0
  const periodosVigentes = periodos.filter(p => p.esVigente === true && (p.diasDisponibles > 0 || p.diasDisponiblesPeriodo > 0));

  // 2. Historial de Períodos: Caducados por >18 meses o Agotados
  const historialPeriodos = periodos.filter(p => !p.esVigente || p.estadoVigencia === 'CADUCADO' || p.estadoVigencia === 'AGOTADO');

  // 3. Saldo Total Disponible: EXCLUSIVAMENTE la suma de diasDisponibles de periodosVigentes
  const saldoTotalDisponible = periodosVigentes.reduce((sum, p) => sum + (p.diasDisponibles ?? p.diasDisponiblesPeriodo ?? 0), 0);

  // 4. Período en curso (próximo aniversario)
  const siguienteAnio = detalleAntiguedad.antiguedadAnios + 1;
  const alta = parseFecha(colaborador?.fechaAlta || colaborador?.FechaAlta);
  let periodoEnCurso = null;

  if (alta) {
    const inicioProx = agregarAnios(alta, siguienteAnio);
    const finProx = agregarMeses(inicioProx, 18);
    const cicloProx = `${inicioProx.getFullYear() - 1}-${inicioProx.getFullYear()}`;

    periodoEnCurso = {
      anio: siguienteAnio,
      antiguedadCumplida: siguienteAnio,
      periodo: cicloProx,
      cicloTexto: `Período Año ${siguienteAnio} • Ciclo ${cicloProx}`,
      diasDerechoLFT: calcularDiasLFT(siguienteAnio),
      diasCorrespondientes: calcularDiasLFT(siguienteAnio),
      fechaAniversario: formatearFechaISO(inicioProx),
      fechaInicioVigencia: formatearFechaISO(inicioProx),
      fechaVencimiento: formatearFechaISO(finProx),
      fechaFinVigencia: formatearFechaISO(finProx),
      diasParaCumplir: detalleAntiguedad.diasParaProximoAniversario,
      estadoVigencia: 'EN_CURSO'
    };
  }

  return {
    colaborador: {
      ...colaborador,
      ...detalleAntiguedad
    },
    saldoTotalDisponible,
    periodosVigentes,
    historialPeriodos,
    periodoEnCurso,
    periodos
  };
}

module.exports = {
  calcularDiasLFT,
  calcularAntiguedad,
  calcularDetalleAntiguedad,
  generarPeriodosVacaciones,
  estructurarDesgloseSaldo,
  agregarAnios,
  agregarMeses,
  parseFecha,
  formatearFechaISO
};
