/**
 * Servicio de Cálculo de Días Hábiles
 * Omite descansos semanales configurados para el colaborador (por defecto Domingo)
 * y festivos oficiales / asuetos de DiasInhabiles
 */

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseDiasDescanso(diasDescanso, jornadaLaboralDias = 6) {
  const indices = new Set();

  if (diasDescanso) {
    let tokens = [];
    if (Array.isArray(diasDescanso)) {
      tokens = diasDescanso;
    } else if (typeof diasDescanso === 'string') {
      if (diasDescanso.trim().startsWith('[') && diasDescanso.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(diasDescanso);
          if (Array.isArray(parsed)) tokens = parsed;
        } catch (e) {}
      }
      if (tokens.length === 0) {
        tokens = diasDescanso.split(/[,;\/yY]+/);
      }
    }

    for (let raw of tokens) {
      const norm = String(raw).trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.includes('DOM')) indices.add(0);
      else if (norm.includes('LUN')) indices.add(1);
      else if (norm.includes('MAR')) indices.add(2);
      else if (norm.includes('MIE')) indices.add(3);
      else if (norm.includes('JUE')) indices.add(4);
      else if (norm.includes('VIE')) indices.add(5);
      else if (norm.includes('SAB')) indices.add(6);
    }
  }

  // Fallback si no se especificó o lista vacía
  if (indices.size === 0) {
    indices.add(0); // Domingo por defecto (Estándar Grupo JAMA)
    if (jornadaLaboralDias === 5) {
      indices.add(6); // Sábado si jornada es 5
    }
  }

  return indices;
}

function calcularDetalleDias(fechaInicioStr, fechaFinStr, diasInhabilesMap = {}, jornadaLaboralDias = 6, diasDescanso = null) {
  const [y1, m1, d1] = fechaInicioStr.split('-').map(Number);
  const [y2, m2, d2] = fechaFinStr.split('-').map(Number);

  const inicio = new Date(Date.UTC(y1, m1 - 1, d1, 12, 0, 0));
  const fin = new Date(Date.UTC(y2, m2 - 1, d2, 12, 0, 0));

  if (inicio > fin) {
    return {
      totalDiasNaturales: 0,
      totalDiasLaborables: 0,
      totalFinesDeSemana: 0,
      totalFestivos: 0,
      dias: []
    };
  }

  const restIndices = parseDiasDescanso(diasDescanso, jornadaLaboralDias);

  const detalleDias = [];
  let current = new Date(inicio);
  let totalLaborables = 0;
  let totalFinesDeSemana = 0;
  let totalFestivos = 0;

  while (current <= fin) {
    const fechaISO = current.toISOString().split('T')[0];
    const diaSemanaIndex = current.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const nombreDia = DIAS_SEMANA[diaSemanaIndex];

    const esDescansoSemanal = restIndices.has(diaSemanaIndex);
    const festivo = diasInhabilesMap[fechaISO];
    const esDiaInhabil = !!festivo;
    const esLaborable = !esDescansoSemanal && !esDiaInhabil;

    let descripcion = 'Día Laborable Regular';
    if (esDiaInhabil) {
      descripcion = festivo.descripcion || 'Día Festivo / Asueto';
    } else if (esDescansoSemanal) {
      descripcion = `Descanso Semanal (${nombreDia})`;
    }

    if (esDescansoSemanal) totalFinesDeSemana++;
    if (esDiaInhabil) totalFestivos++;
    if (esLaborable) totalLaborables++;

    detalleDias.push({
      fecha: fechaISO,
      nombreDia,
      diaSemanaIndex,
      esFinDeSemana: esDescansoSemanal,
      esDiaInhabil,
      descripcion,
      esFeriadoOficial: festivo ? festivo.esFeriadoOficial : false,
      esLaborable
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    totalDiasNaturales: detalleDias.length,
    totalDiasLaborables: totalLaborables,
    totalFinesDeSemana,
    totalFestivos,
    dias: detalleDias
  };
}

module.exports = {
  calcularDetalleDias,
  parseDiasDescanso
};
