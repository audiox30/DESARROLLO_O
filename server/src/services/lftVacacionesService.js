/**
 * Servicio de Cálculo de Vacaciones según Ley Federal del Trabajo (LFT - México)
 * Incorpora la Reforma de Vacaciones Dignas (Vigente desde el 1 de enero de 2023)
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

function calcularAntiguedad(fechaAltaStr, fechaReferencia = new Date()) {
  const fechaAlta = new Date(fechaAltaStr);
  const ref = new Date(fechaReferencia);
  
  let anios = ref.getFullYear() - fechaAlta.getFullYear();
  const mesDiff = ref.getMonth() - fechaAlta.getMonth();
  const diaDiff = ref.getDate() - fechaAlta.getDate();
  
  if (mesDiff < 0 || (mesDiff === 0 && diaDiff < 0)) {
    anios--;
  }
  return Math.max(0, anios);
}

function generarPeriodosVacaciones(fechaAltaStr, diasTomadosHist = 0) {
  const fechaAlta = new Date(fechaAltaStr);
  const hoy = new Date();
  const antiguedad = calcularAntiguedad(fechaAltaStr, hoy);
  const periodos = [];
  let diasTomadosRestantes = diasTomadosHist;

  for (let anio = 1; anio <= Math.max(1, antiguedad); anio++) {
    const inicio = new Date(fechaAlta);
    inicio.setFullYear(fechaAlta.getFullYear() + anio - 1);
    
    const fin = new Date(fechaAlta);
    fin.setFullYear(fechaAlta.getFullYear() + anio);
    fin.setDate(fin.getDate() - 1);

    // 18 meses después del aniversario conforme a LFT Art. 81
    const expiracion = new Date(fin);
    expiracion.setMonth(expiracion.getMonth() + 18);

    const diasCorrespondientes = calcularDiasLFT(anio);
    let gozados = 0;
    
    if (diasTomadosRestantes >= diasCorrespondientes) {
      gozados = diasCorrespondientes;
      diasTomadosRestantes -= diasCorrespondientes;
    } else {
      gozados = diasTomadosRestantes;
      diasTomadosRestantes = 0;
    }

    const pendientes = Math.max(0, diasCorrespondientes - gozados);

    periodos.push({
      idSaldo: anio,
      anioPeriodo: inicio.getFullYear(),
      antiguedadCumplida: anio,
      diasCorrespondientes,
      diasGozados: gozados,
      diasPendientes: pendientes,
      fechaInicioPeriodo: inicio.toISOString().split('T')[0],
      fechaFinPeriodo: fin.toISOString().split('T')[0],
      fechaExpiracionPeriodo: expiracion.toISOString().split('T')[0],
      esCerrado: pendientes === 0 || hoy > expiracion
    });
  }

  return periodos;
}

module.exports = {
  calcularDiasLFT,
  calcularAntiguedad,
  generarPeriodosVacaciones
};
