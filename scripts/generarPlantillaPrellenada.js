/**
 * Script de Generación de Excel Poblado para Carga Masiva de Saldos Iniciales
 * Grupo JAMA - Sistema de Control de Vacaciones
 * 
 * Genera: PLANTILLA_SALDOS_INICIALES_PRELLENADA.xlsx en la raíz del proyecto.
 */

const path = require('path');
const ExcelJS = require('../server/node_modules/exceljs');
const { getPool } = require('../server/src/config/database');

// Tabla de Vacaciones Dignas (LFT - Reforma 2023)
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
  const extra = Math.floor((antiguedadAnios - 31) / 5) + 1;
  return 32 + (extra * 2);
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
  if (!date || isNaN(date.getTime())) return '';
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

function calcularAntiguedad(fechaAltaInput, fechaCorte = new Date()) {
  const alta = parseFecha(fechaAltaInput);
  if (!alta || isNaN(alta.getTime())) return 0;
  const hoy = parseFecha(fechaCorte);
  let anios = hoy.getFullYear() - alta.getFullYear();
  const mDiff = hoy.getMonth() - alta.getMonth();
  const dDiff = hoy.getDate() - alta.getDate();
  if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) {
    anios--;
  }
  return Math.max(0, anios);
}

async function generarPlantillaExcel() {
  console.log('================================================================');
  console.log('  GENERACIÓN DE EXCEL POBLADO PARA CARGA MASIVA DE SALDOS');
  console.log('  Sistema de Control de Vacaciones - Grupo JAMA');
  console.log('================================================================');

  const pool = await getPool();
  const fechaCorte = new Date(); // Fecha actual de corte (Octubre 2026)
  const fechaCorteStr = formatearFechaISO(fechaCorte);
  console.log(`[INFO] Fecha de corte: ${fechaCorteStr}`);

  // 1. Consultar colaboradores activos con ordenamiento jerárquico estricto:
  //    1. EMPRESA (Razón Social oficial) ASC
  //    2. SUCURSAL ASC
  //    3. APELLIDOS (Apellido Paterno, Apellido Materno, Nombres) ASC
  console.log('[INFO] Consultando colaboradores activos en DESARROLLO_O...');
  const colabQuery = `
    SELECT 
      c.IdColaborador,
      c.CodigoEmpleado,
      c.ApellidoPaterno,
      c.ApellidoMaterno,
      c.Nombre,
      CASE 
        WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
          THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
               CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                    THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
               ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
        ELSE c.NombreCompleto
      END AS NombreCompletoFormateado,
      c.FechaAlta,
      ISNULL(c.Sucursal, 'MATRIZ') AS SucursalNombre,
      c.IdEmpresa,
      COALESCE(e.AliasEmpresa, c.Empresa, e.NombreBaseDatos, 'SIN EMPRESA') AS EmpresaNombre
    FROM dbo.Colaboradores c
    LEFT JOIN dbo.EmpresasNomipaq e ON c.IdEmpresa = e.IdEmpresa
    WHERE c.Activo = 1
    ORDER BY 
      COALESCE(e.AliasEmpresa, c.Empresa, e.NombreBaseDatos, 'SIN EMPRESA') ASC,
      ISNULL(c.Sucursal, 'MATRIZ') ASC,
      ISNULL(c.ApellidoPaterno, '') ASC,
      ISNULL(c.ApellidoMaterno, '') ASC,
      ISNULL(c.Nombre, '') ASC;
  `;

  const colabsRes = await pool.request().query(colabQuery);
  const colaboradores = colabsRes.recordset;
  console.log(`[INFO] Se encontraron ${colaboradores.length} colaboradores activos.`);

  // 2. Consultar saldos existentes en dbo.SaldosVacaciones para mapear días ya gozados
  console.log('[INFO] Consultando saldos existentes en dbo.SaldosVacaciones...');
  const saldosRes = await pool.request().query(`
    SELECT IdColaborador, Periodo, AnioPeriodo, AntiguedadCumplida, DiasGozados, DiasCorrespondientes, DiasPendientes
    FROM dbo.SaldosVacaciones
  `);
  
  const saldosMap = new Map();
  for (const s of saldosRes.recordset) {
    if (s.Periodo) {
      saldosMap.set(`${s.IdColaborador}_${s.Periodo}`, s);
    }
    if (s.AntiguedadCumplida !== null && s.AntiguedadCumplida !== undefined) {
      saldosMap.set(`${s.IdColaborador}_aniv_${s.AntiguedadCumplida}`, s);
    }
    if (s.AnioPeriodo) {
      saldosMap.set(`${s.IdColaborador}_anio_${s.AnioPeriodo}`, s);
    }
  }

  // 3. Procesar colaboradores y calcular vigencias de 18 meses (Art. 81 y 516 LFT)
  const filasExportacion = [];
  let stats = {
    colaboradoresProcesados: colaboradores.length,
    con1Periodo: 0,
    con2Periodos: 0,
    conMenor1Anio: 0,
    totalFilas: 0
  };

  for (const c of colaboradores) {
    const alta = parseFecha(c.FechaAlta);
    if (!alta || isNaN(alta.getTime())) {
      console.warn(`[WARN] Colaborador ${c.CodigoEmpleado} sin FechaAlta válida. Se omite.`);
      continue;
    }

    const antiguedadCumplida = calcularAntiguedad(alta, fechaCorte);
    const periodosVigentes = [];

    if (antiguedadCumplida >= 1) {
      // Evaluar cada ciclo anual completado
      for (let anio = 1; anio <= antiguedadCumplida; anio++) {
        const fechaAniversario = agregarAnios(alta, anio);
        const fechaLimiteVigencia = agregarMeses(fechaAniversario, 18);
        const anioFin = fechaAniversario.getFullYear();
        const anioInicio = anioFin - 1;
        const periodoCiclo = `${anioInicio}-${anioFin}`;

        // Regla estricta de vigencia conforme a LFT (18 meses):
        // VIGENTE si corte >= fechaAniversario y corte <= fechaLimiteVigencia
        const esVigente = (fechaCorte >= fechaAniversario && fechaCorte <= fechaLimiteVigencia);

        if (esVigente) {
          const diasDerecho = calcularDiasLFT(anio);
          
          // Buscar si existe registro previo de días gozados
          const saldoPrevio = saldosMap.get(`${c.IdColaborador}_${periodoCiclo}`) ||
                              saldosMap.get(`${c.IdColaborador}_aniv_${anio}`) ||
                              saldosMap.get(`${c.IdColaborador}_anio_${anioFin}`);
          
          const diasGozados = saldoPrevio ? Number(saldoPrevio.DiasGozados || 0) : 0;

          periodosVigentes.push({
            antiguedadAnios: anio,
            periodoEjercicio: periodoCiclo,
            fechaAniversario: formatearFechaISO(fechaAniversario),
            fechaLimiteVigencia: formatearFechaISO(fechaLimiteVigencia),
            diasDerechoLFT: diasDerecho,
            diasGozados: diasGozados
          });
        }
      }
    }

    // Si tiene 0 períodos vigentes porque aún no cumple su 1er año de servicio (< 1 año de antigüedad):
    // Se prellena su Ciclo 1 en curso para que el colaborador esté presente en el Excel de DO
    if (periodosVigentes.length === 0) {
      stats.conMenor1Anio++;
      const fechaAniversario1 = agregarAnios(alta, 1);
      const fechaLimiteVigencia1 = agregarMeses(fechaAniversario1, 18);
      const anioFin = fechaAniversario1.getFullYear();
      const anioInicio = anioFin - 1;
      const periodoCiclo = `${anioInicio}-${anioFin}`;
      const diasDerecho = 12; // Derecho legal por cumplir 1er año

      const saldoPrevio = saldosMap.get(`${c.IdColaborador}_${periodoCiclo}`) ||
                          saldosMap.get(`${c.IdColaborador}_aniv_1`) ||
                          saldosMap.get(`${c.IdColaborador}_anio_${anioFin}`);
      const diasGozados = saldoPrevio ? Number(saldoPrevio.DiasGozados || 0) : 0;

      periodosVigentes.push({
        antiguedadAnios: 1, // Ciclo correspondiente al año 1
        periodoEjercicio: periodoCiclo,
        fechaAniversario: formatearFechaISO(fechaAniversario1),
        fechaLimiteVigencia: formatearFechaISO(fechaLimiteVigencia1),
        diasDerechoLFT: diasDerecho,
        diasGozados: diasGozados,
        esMenor1Anio: true
      });
    } else if (periodosVigentes.length === 1) {
      stats.con1Periodo++;
    } else if (periodosVigentes.length >= 2) {
      stats.con2Periodos++;
    }

    // Agregar las filas al archivo de exportación (1 fila por cada período vigente)
    for (const p of periodosVigentes) {
      filasExportacion.push({
        empresa: c.EmpresaNombre,
        sucursal: c.SucursalNombre,
        numNomina: String(c.CodigoEmpleado || '').trim(),
        nombreCompleto: c.NombreCompletoFormateado,
        fechaAlta: formatearFechaISO(alta),
        antiguedadAnios: p.antiguedadAnios,
        periodoEjercicio: p.periodoEjercicio,
        fechaAniversario: p.fechaAniversario,
        fechaLimiteVigencia: p.fechaLimiteVigencia,
        diasDerechoLFT: p.diasDerechoLFT,
        diasGozados: p.diasGozados,
        motivoAjuste: 'Carga inicial de arranque'
      });
    }
  }

  stats.totalFilas = filasExportacion.length;
  console.log('[INFO] Estadísticas de períodos calculados:');
  console.log(`   - Colaboradores activos procesados: ${stats.colaboradoresProcesados}`);
  console.log(`   - Colaboradores con 1 período vigente: ${stats.con1Periodo}`);
  console.log(`   - Colaboradores con 2 períodos vigentes traslapados: ${stats.con2Periodos}`);
  console.log(`   - Colaboradores < 1 año (prellenados con Ciclo 1): ${stats.conMenor1Anio}`);
  console.log(`   - Total de filas generadas para el Excel: ${stats.totalFilas}`);

  // 4. Crear y estilizar el libro Excel con ExcelJS
  console.log('[INFO] Generando y formateando archivo Excel...');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Vacaciones - Grupo JAMA';
  workbook.lastModifiedBy = 'Desarrollo Organizacional';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Saldos Iniciales LFT', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }]
  });

  // Definición oficial de columnas según especificación
  worksheet.columns = [
    { header: 'EMPRESA', key: 'empresa', width: 28 },
    { header: 'SUCURSAL', key: 'sucursal', width: 20 },
    { header: 'NUM_NOMINA', key: 'numNomina', width: 15 },
    { header: 'NOMBRE_COMPLETO', key: 'nombreCompleto', width: 36 },
    { header: 'FECHA_ALTA', key: 'fechaAlta', width: 14 },
    { header: 'ANTIGUEDAD_ANIOS', key: 'antiguedadAnios', width: 18 },
    { header: 'PERIODO_EJERCICIO', key: 'periodoEjercicio', width: 19 },
    { header: 'FECHA_ANIVERSARIO', key: 'fechaAniversario', width: 19 },
    { header: 'FECHA_LIMITE_VIGENCIA', key: 'fechaLimiteVigencia', width: 22 },
    { header: 'DIAS_DERECHO_LFT', key: 'diasDerechoLFT', width: 19 },
    { header: 'DIAS_GOZADOS', key: 'diasGozados', width: 16 },
    { header: 'DIAS_RESTANTES', key: 'diasRestantes', width: 17 },
    { header: 'MOTIVO_AJUSTE', key: 'motivoAjuste', width: 28 }
  ];

  // Paleta de Colores Institucionales
  const COLOR_AZUL_MARINO = 'FF002D62'; // #002D62 - Encabezados Referencia
  const COLOR_AZUL_ACERO  = 'FF5B8296'; // #5B8296 - Encabezados Captura DO
  const COLOR_BLANCO      = 'FFFFFFFF';
  const COLOR_GRIS_TENUE  = 'FFF8FAFC'; // #F8FAFC - Fondo Columnas Solo Lectura
  const COLOR_BORDE_TENUE = 'FFE2E8F0'; // #E2E8F0
  const COLOR_BORDE_ACERO = 'FF5B8296'; // #5B8296

  // Estilizar fila de encabezados (Fila 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;

  headerRow.eachCell((cell, colNumber) => {
    const isCapturaDO = (colNumber === 11 || colNumber === 12); // DIAS_GOZADOS y DIAS_RESTANTES

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isCapturaDO ? COLOR_AZUL_ACERO : COLOR_AZUL_MARINO }
    };

    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: COLOR_BLANCO }
    };

    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };

    cell.border = {
      top: { style: 'thin', color: { argb: isCapturaDO ? COLOR_AZUL_ACERO : COLOR_AZUL_MARINO } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // Agregar filas de datos con formato y fórmula `=J{row}-K{row}`
  filasExportacion.forEach((filaData, index) => {
    const rowNumber = index + 2; // Fila 1 es encabezado
    
    // Formula para DIAS_RESTANTES: Columna J (DIAS_DERECHO_LFT) - Columna K (DIAS_GOZADOS)
    const formulaRestantes = `J${rowNumber}-K${rowNumber}`;

    const newRow = worksheet.addRow({
      empresa: filaData.empresa,
      sucursal: filaData.sucursal,
      numNomina: filaData.numNomina,
      nombreCompleto: filaData.nombreCompleto,
      fechaAlta: filaData.fechaAlta,
      antiguedadAnios: filaData.antiguedadAnios,
      periodoEjercicio: filaData.periodoEjercicio,
      fechaAniversario: filaData.fechaAniversario,
      fechaLimiteVigencia: filaData.fechaLimiteVigencia,
      diasDerechoLFT: filaData.diasDerechoLFT,
      diasGozados: filaData.diasGozados,
      diasRestantes: { formula: formulaRestantes, result: Math.max(0, filaData.diasDerechoLFT - filaData.diasGozados) },
      motivoAjuste: filaData.motivoAjuste
    });

    newRow.height = 21;

    // Aplicar estilos por celda
    newRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const isCapturaDO = (colNumber === 11 || colNumber === 12);

      if (isCapturaDO) {
        // Celdas de captura manual para DO (Fondo blanco, borde distintivo Azul Acero)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_BLANCO }
        };
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: true,
          color: { argb: 'FF0F172A' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        cell.border = {
          top: { style: 'medium', color: { argb: COLOR_BORDE_ACERO } },
          bottom: { style: 'medium', color: { argb: COLOR_BORDE_ACERO } },
          left: { style: 'medium', color: { argb: COLOR_BORDE_ACERO } },
          right: { style: 'medium', color: { argb: COLOR_BORDE_ACERO } }
        };
        cell.numFmt = '0';
      } else if (colNumber === 13) {
        // MOTIVO_AJUSTE
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_BLANCO }
        };
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          color: { argb: 'FF475569' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } },
          bottom: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } },
          left: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } },
          right: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } }
        };
      } else {
        // Columnas 1 a 10: Solo lectura / Referencia (Fondo gris tenue #F8FAFC)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_GRIS_TENUE }
        };
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          bold: (colNumber === 10), // DIAS_DERECHO_LFT en negrita
          color: { argb: 'FF1E293B' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } },
          bottom: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } },
          left: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } },
          right: { style: 'thin', color: { argb: COLOR_BORDE_TENUE } }
        };

        // Alineación según tipo de columna
        if (colNumber === 1 || colNumber === 2 || colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Formatos específicos
        if (colNumber === 3) {
          cell.numFmt = '@'; // NUM_NOMINA como texto para no truncar ceros
        } else if (colNumber === 6 || colNumber === 10) {
          cell.numFmt = '0';
        }
      }
    });
  });

  // Habilitar AutoFiltro en todas las columnas
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 13 }
  };

  // Ajuste automático de anchos de columna con holgura para evitar textos cortados
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, cell => {
      const cellValue = cell.value;
      let text = '';
      if (cellValue !== null && cellValue !== undefined) {
        if (typeof cellValue === 'object' && cellValue.formula) {
          text = String(cellValue.result || '');
        } else {
          text = String(cellValue);
        }
      }
      if (text.length > maxLength) {
        maxLength = text.length;
      }
    });
    // Dar holgura de 4 caracteres
    column.width = Math.max(maxLength + 4, column.width || 12);
  });

  // Guardar archivo en la raíz del proyecto
  const rutaDestino = path.join(__dirname, '..', 'PLANTILLA_SALDOS_INICIALES_PRELLENADA.xlsx');
  await workbook.xlsx.writeFile(rutaDestino);

  console.log('================================================================');
  console.log('  ARCHIVO GENERADO EXITOSAMENTE');
  console.log(`  Ruta física: ${rutaDestino}`);
  console.log(`  Total de filas exportadas: ${stats.totalFilas} (más 1 fila de encabezados)`);
  console.log('================================================================');

  process.exit(0);
}

generarPlantillaExcel().catch(err => {
  console.error('[FATAL] Error generando plantilla Excel:', err);
  process.exit(1);
});
