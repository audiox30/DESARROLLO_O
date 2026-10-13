/**
 * Servicio de Cálculo de Días Hábiles
 * Omite sábados y domingos (según jornada) y festivos oficiales / asuetos de DiasInhabiles
 */

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function calcularDetalleDias(fechaInicioStr, fechaFinStr, diasInhabilesMap = {}, jornadaLaboralDias = 6) {
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

  const detalleDias = [];
  let current = new Date(inicio);
  let totalLaborables = 0;
  let totalFinesDeSemana = 0;
  let totalFestivos = 0;

  while (current <= fin) {
    const fechaISO = current.toISOString().split('T')[0];
    const diaSemanaIndex = current.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const nombreDia = DIAS_SEMANA[diaSemanaIndex];

    const esDomingo = (diaSemanaIndex === 0);
    const esSabado = (diaSemanaIndex === 6);
    const esFinDeSemana = (jornadaLaboralDias === 5) ? (esDomingo || esSabado) : esDomingo;

    const festivo = diasInhabilesMap[fechaISO];
    const esDiaInhabil = !!festivo;
    const esLaborable = !esFinDeSemana && !esDiaInhabil;

    let descripcion = 'Día Laborable Regular';
    if (esDiaInhabil) {
      descripcion = festivo.descripcion || 'Día Festivo / Asueto';
    } else if (esDomingo) {
      descripcion = 'Descanso Semanal (Domingo)';
    } else if (esSabado && jornadaLaboralDias === 5) {
      descripcion = 'Descanso Semanal (Sábado)';
    } else if (esSabado && jornadaLaboralDias >= 6) {
      descripcion = 'Día Laborable Regular (Sábado)';
    }

    if (esFinDeSemana) totalFinesDeSemana++;
    if (esDiaInhabil) totalFestivos++;
    if (esLaborable) totalLaborables++;

    detalleDias.push({
      fecha: fechaISO,
      nombreDia,
      diaSemanaIndex,
      esFinDeSemana,
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
  calcularDetalleDias
};
