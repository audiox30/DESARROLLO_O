const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');

/**
 * Servicio Generador del Formato Oficial FDO-84 (Rev. A - 26/01/2024)
 * Formato Oficial Institucional de Solicitud de Vacaciones - Grupo JAMA
 */

// Formateo de fecha legible
function formatFechaStr(fechaStr) {
  if (!fechaStr || fechaStr === 'null' || fechaStr === 'undefined' || fechaStr === 'Invalid Date') return '—';
  try {
    const s = String(fechaStr).substring(0, 10);
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(fechaStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX');
  } catch (e) {
    return '—';
  }
}

// Desglosar fecha en componentes [DÍA, MES, AÑO]
function desglosarFecha(fechaStr) {
  if (!fechaStr || fechaStr === 'null' || fechaStr === 'undefined' || fechaStr === 'Invalid Date') {
    return { dia: '—', mes: '—', anio: '—' };
  }
  try {
    const s = String(fechaStr).substring(0, 10);
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return { dia: parts[2] || '—', mes: parts[1] || '—', anio: parts[0] || '—' };
    }
    const d = new Date(fechaStr);
    if (!isNaN(d.getTime())) {
      return {
        dia: String(d.getDate()).padStart(2, '0'),
        mes: String(d.getMonth() + 1).padStart(2, '0'),
        anio: String(d.getFullYear())
      };
    }
  } catch (e) {}
  return { dia: '—', mes: '—', anio: '—' };
}

// Cálculo automático de la fecha de reincorporación a labores
function calcularFechaReincorporacion(fechaFinStr, diasDescansoStr = 'DOMINGO', diasInhabilesSet = new Set()) {
  if (!fechaFinStr || fechaFinStr === 'null' || fechaFinStr === 'undefined') return '—';
  try {
    const parts = String(fechaFinStr).substring(0, 10).split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '—';

    let cur = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    if (isNaN(cur.getTime())) return '—';
    const descansosNorm = (diasDescansoStr || 'DOMINGO').toUpperCase();
    const DIAS_SEMANA_MAP = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

    // Buscar el siguiente día laborable efectivo
    let iter = 0;
    while (iter < 30) {
      iter++;
      cur.setUTCDate(cur.getUTCDate() + 1);
      const dayOfWeek = cur.getUTCDay();
      const dayName = DIAS_SEMANA_MAP[dayOfWeek];
      const yStr = cur.getUTCFullYear();
      const mStr = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(cur.getUTCDate()).padStart(2, '0');
      const isoDate = `${yStr}-${mStr}-${dStr}`;

      const esDescanso = descansosNorm.includes(dayName) ||
        (dayName === 'SABADO' && descansosNorm.includes('SÁBADO')) ||
        (dayName === 'MIERCOLES' && descansosNorm.includes('MIÉRCOLES'));

      const esFestivo = diasInhabilesSet && diasInhabilesSet.has(isoDate);

      if (!esDescanso && !esFestivo) {
        return `${dStr}/${mStr}/${yStr}`;
      }
    }
    return '—';
  } catch (err) {
    return '—';
  }
}

// Generador de sello hash criptográfico digital
function generarSelloDigital(semilla) {
  const hash = crypto.createHash('sha256').update(String(semilla)).digest('hex').substring(0, 16).toUpperCase();
  return `JAMA-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
}

/**
 * Consulta y ensambla todos los datos requeridos para FDO-84
 */
async function recopilarDatosFdo84(idSolicitud) {
  const pool = await getPool();
  if (isUsingMock() || !pool) {
    const s = mockStore.solicitudes.find(x => x.idSolicitud === Number(idSolicitud));
    if (!s) throw new Error(`Solicitud ${idSolicitud} no encontrada en el sistema.`);

    const c = mockStore.colaboradores.find(col => col.idColaborador === s.idColaborador || col.id === s.idColaborador) || {};
    const idJefe = c.idJefeDirecto || c.idJefe;
    const j = idJefe ? mockStore.colaboradores.find(col => col.idColaborador === idJefe || col.id === idJefe) : null;
    const idSegundo = c.idAprobadorSegundo || c.IdAprobadorSegundo;
    const j2 = idSegundo ? mockStore.colaboradores.find(col => col.idColaborador === idSegundo || col.id === idSegundo) : null;
    const historial = mockStore.historialAprobaciones.filter(h => h.idSolicitud === s.idSolicitud);
    const festivosSet = new Set((mockStore.diasInhabiles || []).map(f => f.fecha));

    // Saldo y ejercicio
    const saldos = c.saldos || [];
    const saldoVigente = saldos.find(sv => !sv.esCerrado) || saldos[saldos.length - 1] || {};
    const diasPendientes = saldoVigente.diasPendientes !== undefined ? saldoVigente.diasPendientes : (c.diasDisponibles || 12);
    const diasCorrespondientes = saldoVigente.diasCorrespondientes || c.diasCorrespondientes || 12;
    const anioPeriodo = saldoVigente.anioPeriodo || new Date().getFullYear();

    return {
      solicitud: {
        idSolicitud: s.idSolicitud,
        folio: s.folio || `VAC-${s.idSolicitud}`,
        fechaCreacion: s.fechaCreacion || new Date().toISOString(),
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        totalDiasLaborables: Number(s.totalDiasLaborables || 0),
        motivoComentarios: s.motivoComentarios || '',
        estado: s.estado || 'PENDIENTE_LIDER',
        fechaResolucion: s.fechaResolucion || null,
        motivoRechazo: s.motivoRechazo || null
      },
      colaborador: {
        idColaborador: c.idColaborador || c.id || 0,
        codigoEmpleado: c.codigoEmpleado || '',
        nombreCompleto: c.nombreCompleto || s.colaboradorNombre || 'Colaborador',
        fechaAlta: c.fechaAlta || '2020-01-01',
        empresa: c.empresa || s.colaboradorEmpresa || 'Grupo JAMA',
        sucursal: c.sucursal || 'Matriz',
        puesto: c.puesto || s.colaboradorPuesto || 'General',
        departamento: c.departamento || s.colaboradorDepartamento || 'General',
        diasDescanso: c.diasDescanso || 'DOMINGO'
      },
      jefe: j ? {
        nombreCompleto: j.nombreCompleto,
        codigoEmpleado: j.codigoEmpleado,
        puesto: j.puesto || 'Jefe Directo'
      } : {
        nombreCompleto: 'LÍDER DE ÁREA / JEFE DIRECTO',
        codigoEmpleado: '—',
        puesto: 'Jefatura Directa'
      },
      segundoAprobador: j2 ? {
        nombreCompleto: j2.nombreCompleto,
        codigoEmpleado: j2.codigoEmpleado,
        puesto: j2.puesto || 'Gerente de Sucursal'
      } : null,
      ejercicio: {
        anioPeriodo: `${anioPeriodo} - ${anioPeriodo + 1}`,
        diasCorrespondientes: Number(diasCorrespondientes),
        diasPendientesAntes: Number(diasPendientes),
        diasSolicitados: Number(s.totalDiasLaborables || 0),
        nuevoSaldo: Math.max(0, Number(diasPendientes) - Number(s.totalDiasLaborables || 0))
      },
      historial,
      festivosSet
    };
  }

  // Consulta en SQL Server (DESARROLLO_O)
  // 1. Solicitud y Colaborador
  const solRes = await pool.request()
    .input('IdSolicitud', idSolicitud)
    .query(`
      SELECT 
        s.IdSolicitud,
        s.Folio,
        s.FechaCreacion,
        CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
        CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
        s.TotalDiasLaborables,
        s.MotivoComentarios,
        s.Estado,
        s.FechaResolucion,
        s.MotivoRechazo,
        s.IdAprobadorLider,
        s.FechaAprobacionLider,
        s.IdAprobadorSegundo,
        s.FechaAprobacionSegundo,
        -- Colaborador
        c.IdColaborador,
        c.CodigoEmpleado,
        c.NombreCompleto AS ColaboradorNombre,
        CONVERT(VARCHAR(10), c.FechaAlta, 23) AS FechaAlta,
        c.Empresa,
        c.Sucursal,
        ISNULL(c.DiasDescanso, 'DOMINGO') AS DiasDescanso,
        p.Nombre AS PuestoNombre,
        d.Nombre AS DeptoNombre,
        -- Jefe Directo
        j.NombreCompleto AS JefeNombre,
        j.CodigoEmpleado AS JefeCodigo,
        jp.Nombre AS JefePuesto,
        -- Segundo Aprobador (Gerente de Sucursal)
        j2.IdColaborador AS IdSegundo,
        j2.NombreCompleto AS SegundoNombre,
        j2.CodigoEmpleado AS SegundoCodigo,
        jp2.Nombre AS SegundoPuesto,
        -- DO Aprobador Final
        do_user.NombreCompleto AS AprobadorDONombre
      FROM dbo.SolicitudesVacaciones s
      JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
      LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
      LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
      LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = ISNULL(s.IdAprobadorLider, c.IdJefeDirecto)
      LEFT JOIN dbo.Puestos jp ON jp.IdPuesto = j.IdPuesto
      LEFT JOIN dbo.Colaboradores j2 ON j2.IdColaborador = ISNULL(s.IdAprobadorSegundo, c.IdAprobadorSegundo)
      LEFT JOIN dbo.Puestos jp2 ON jp2.IdPuesto = j2.IdPuesto
      LEFT JOIN dbo.Colaboradores do_user ON do_user.IdColaborador = s.IdAprobadorFinal
      WHERE s.IdSolicitud = @IdSolicitud
    `);

  const row = solRes.recordset[0];
  if (!row) throw new Error(`Solicitud con ID ${idSolicitud} no encontrada.`);

  // 2. Saldos y Ejercicio
  const saldosRes = await pool.request()
    .input('IdColaborador', row.IdColaborador)
    .query(`
      SELECT TOP 1 
        AnioPeriodo, DiasCorrespondientes, DiasGozados, DiasPendientes
      FROM dbo.SaldosVacaciones
      WHERE IdColaborador = @IdColaborador AND EsCerrado = 0
      ORDER BY AnioPeriodo ASC
    `);

  const saldoRow = saldosRes.recordset[0] || {
    AnioPeriodo: new Date().getFullYear(),
    DiasCorrespondientes: 12.0,
    DiasGozados: 0.0,
    DiasPendientes: 12.0
  };

  // 3. Historial
  const histRes = await pool.request()
    .input('IdSolicitud', idSolicitud)
    .query(`
      SELECT h.*, c.NombreCompleto AS AprobadorNombre
      FROM dbo.HistorialAprobaciones h
      JOIN dbo.Colaboradores c ON c.IdColaborador = h.IdAprobador
      WHERE h.IdSolicitud = @IdSolicitud
      ORDER BY h.FechaAccion ASC
    `);

  // 4. Festivos
  const festRes = await pool.request().query(`
    SELECT CONVERT(VARCHAR(10), Fecha, 23) AS Fecha 
    FROM dbo.DiasInhabiles
  `);
  const festivosSet = new Set(festRes.recordset.map(f => f.Fecha));

  const anio = Number(saldoRow.AnioPeriodo) || new Date().getFullYear();
  const diasPendientes = Number(saldoRow.DiasPendientes || 0);
  const diasCorrespondientes = Number(saldoRow.DiasCorrespondientes || 12);
  const totalDias = Number(row.TotalDiasLaborables || 0);

  return {
    solicitud: {
      idSolicitud: row.IdSolicitud,
      folio: row.Folio || (row.IdSolicitud ? `VAC-${row.IdSolicitud}` : '—'),
      fechaCreacion: row.FechaCreacion || new Date().toISOString(),
      fechaInicio: row.FechaInicio || '',
      fechaFin: row.FechaFin || '',
      totalDiasLaborables: totalDias,
      motivoComentarios: row.MotivoComentarios || '',
      estado: row.Estado || 'PENDIENTE_LIDER',
      fechaResolucion: row.FechaResolucion,
      motivoRechazo: row.MotivoRechazo,
      fechaAprobacionLider: row.FechaAprobacionLider,
      fechaAprobacionSegundo: row.FechaAprobacionSegundo
    },
    colaborador: {
      idColaborador: row.IdColaborador,
      codigoEmpleado: row.CodigoEmpleado,
      nombreCompleto: row.ColaboradorNombre,
      fechaAlta: row.FechaAlta,
      empresa: row.Empresa || 'Grupo JAMA',
      sucursal: row.Sucursal || 'Matriz',
      puesto: row.PuestoNombre || 'General',
      departamento: row.DeptoNombre || 'General',
      diasDescanso: row.DiasDescanso || 'DOMINGO'
    },
    jefe: {
      nombreCompleto: row.JefeNombre || 'LÍDER DE ÁREA',
      codigoEmpleado: row.JefeCodigo || '—',
      puesto: row.JefePuesto || 'Jefe Directo',
      fechaAprobacion: row.FechaAprobacionLider
    },
    segundoAprobador: row.IdSegundo ? {
      nombreCompleto: row.SegundoNombre,
      codigoEmpleado: row.SegundoCodigo || '—',
      puesto: row.SegundoPuesto || 'Gerente de Sucursal',
      fechaAprobacion: row.FechaAprobacionSegundo
    } : null,
    aprobadorDO: row.AprobadorDONombre || 'Lic. Desarrollo Organizacional',
    ejercicio: {
      anioPeriodo: `${anio} - ${anio + 1}`,
      diasCorrespondientes: Number(saldoRow.DiasCorrespondientes),
      diasPendientesAntes: diasPendientes,
      diasSolicitados: totalDias,
      nuevoSaldo: Math.max(0, diasPendientes - (row.Estado === 'APROBADA' ? 0 : totalDias))
    },
    historial: histRes.recordset,
    festivosSet
  };
}

/**
 * Motor Principal: Genera el PDF Oficial FDO-84 como Stream o Buffer
 */
async function generarPdfFdo84(idSolicitud, streamDestino) {
  const datos = await recopilarDatosFdo84(idSolicitud);
  const { solicitud, colaborador, jefe, segundoAprobador, aprobadorDO, ejercicio, historial, festivosSet } = datos;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 32, bottom: 15, left: 36, right: 36 },
        autoFirstPage: true,
        info: {
          Title: `Formato FDO-84 - ${solicitud.folio} - Grupo JAMA`,
          Author: 'Desarrollo Organizacional - Grupo JAMA',
          Subject: 'Solicitud Oficial de Vacaciones FDO-84 (Rev. A)'
        }
      });

      const buffers = [];
      if (streamDestino) {
        doc.pipe(streamDestino);
      } else {
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      }
      doc.on('error', err => reject(err));

      const PAGE_WIDTH = 612;
      const PAGE_HEIGHT = 792;
      const LEFT = 36;
      const CONTENT_WIDTH = 540;

      // Colores Corporativos Grupo JAMA
      const COLOR_NAVY = '#002D62';       // Azul Marino Institucional
      const COLOR_STEEL = '#5B8296';      // Azul Acero FDO
      const COLOR_LIGHT_BG = '#F8FAFC';   // Gris Tenue
      const COLOR_BORDER = '#002D62';     // Bordes nítidos
      const COLOR_MUTED_BORDER = '#CBD5E1';
      const COLOR_TEXT = '#0F172A';
      const COLOR_MUTED_TEXT = '#475569';

      // -------------------------------------------------------------
      // MARCA DE AGUA (WATERMARK) SI NO ESTÁ APROBADA
      // -------------------------------------------------------------
      if (solicitud.estado !== 'APROBADA') {
        doc.save();
        doc.rotate(-45, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2] });
        doc.fontSize(38);
        doc.fillColor('#94a3b8');
        doc.opacity(0.12);

        let watermarkText = 'EN TRÁMITE - PENDIENTE DE AUTORIZACIÓN';
        if (solicitud.estado === 'RECHAZADA') watermarkText = 'SOLICITUD RECHAZADA';
        if (solicitud.estado === 'CANCELADA') watermarkText = 'SOLICITUD CANCELADA';

        doc.text(watermarkText, -100, (PAGE_HEIGHT / 2) - 10, {
          align: 'center',
          width: 800
        });
        doc.restore();
      }

      doc.opacity(1.0);

      // -------------------------------------------------------------
      // A) ENCABEZADO OFICIAL (FDO-84)
      // -------------------------------------------------------------
      let currentY = 32;
      const HEADER_HEIGHT = 60;

      // Marco contenedor exterior del encabezado
      doc.rect(LEFT, currentY, CONTENT_WIDTH, HEADER_HEIGHT)
         .lineWidth(1.5)
         .strokeColor(COLOR_NAVY)
         .stroke();

      // Sub-caja 1: Logotipo Izquierda (125 pt)
      const LOGO_BOX_WIDTH = 125;
      doc.rect(LEFT, currentY, LOGO_BOX_WIDTH, HEADER_HEIGHT)
         .lineWidth(0.8)
         .strokeColor(COLOR_MUTED_BORDER)
         .stroke();

      // Buscar imagen de logotipo
      const posiblesRutasLogo = [
        path.resolve(__dirname, '../../../client/public/logo-jama.png'),
        path.resolve(__dirname, '../../../client/dist/logo-jama.png'),
        path.resolve(__dirname, '../../../client/src/assets/logo-jama.png')
      ];
      let logoPath = posiblesRutasLogo.find(p => fs.existsSync(p));

      if (logoPath) {
        try {
          doc.image(logoPath, LEFT + 8, currentY + 8, {
            fit: [LOGO_BOX_WIDTH - 16, HEADER_HEIGHT - 16],
            align: 'center',
            valign: 'center'
          });
        } catch (imgErr) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor(COLOR_NAVY)
             .text('GRUPO JAMA', LEFT + 10, currentY + 22, { width: LOGO_BOX_WIDTH - 20, align: 'center' });
        }
      } else {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(COLOR_NAVY)
           .text('GRUPO JAMA', LEFT + 10, currentY + 22, { width: LOGO_BOX_WIDTH - 20, align: 'center' });
      }

      // Sub-caja 2: Título Central (280 pt)
      const TITLE_BOX_WIDTH = 280;
      const TITLE_LEFT = LEFT + LOGO_BOX_WIDTH;
      doc.rect(TITLE_LEFT, currentY, TITLE_BOX_WIDTH, HEADER_HEIGHT)
         .lineWidth(0.8)
         .strokeColor(COLOR_MUTED_BORDER)
         .stroke();

      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_STEEL)
         .text('FORMATO OFICIAL', TITLE_LEFT, currentY + 12, { width: TITLE_BOX_WIDTH, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(14).fillColor(COLOR_NAVY)
         .text('Solicitud de Vacaciones', TITLE_LEFT, currentY + 26, { width: TITLE_BOX_WIDTH, align: 'center' });

      doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUTED_TEXT)
         .text('Sistema Integral de Desarrollo Organizacional', TITLE_LEFT, currentY + 43, { width: TITLE_BOX_WIDTH, align: 'center' });

      // Sub-caja 3: Control Documental Derecha (135 pt)
      const CONTROL_BOX_WIDTH = 135;
      const CONTROL_LEFT = TITLE_LEFT + TITLE_BOX_WIDTH;
      doc.rect(CONTROL_LEFT, currentY, CONTROL_BOX_WIDTH, HEADER_HEIGHT)
         .lineWidth(0.8)
         .strokeColor(COLOR_MUTED_BORDER)
         .stroke();

      const CONTROL_ROW_H = HEADER_HEIGHT / 4;
      const filasControl = [
        { label: 'CLAVE:', val: 'FDO-84' },
        { label: 'FECHA REV:', val: '26/01/2024' },
        { label: 'NO. REVISIÓN:', val: 'A' },
        { label: 'FOLIO:', val: solicitud.folio }
      ];

      filasControl.forEach((f, idx) => {
        const fy = currentY + (idx * CONTROL_ROW_H);
        if (idx > 0) {
          doc.moveTo(CONTROL_LEFT, fy).lineTo(CONTROL_LEFT + CONTROL_BOX_WIDTH, fy)
             .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();
        }
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_NAVY)
           .text(f.label, CONTROL_LEFT + 6, fy + 3.5, { width: 55 });
        doc.font(idx === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
           .fillColor(idx === 3 ? '#1D4ED8' : COLOR_TEXT)
           .text(f.val, CONTROL_LEFT + 62, fy + 3.5, { width: 68, align: 'right' });
      });

      currentY += HEADER_HEIGHT + 10;

      // -------------------------------------------------------------
      // B) SECCIÓN 1: DATOS DEL TRABAJADOR
      // -------------------------------------------------------------
      const fechaElab = desglosarFecha(solicitud.fechaCreacion);

      // Barra de Título
      doc.rect(LEFT, currentY, CONTENT_WIDTH, 17)
         .fillColor(COLOR_NAVY).fill();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
         .text('1. DATOS DEL TRABAJADOR', LEFT + 8, currentY + 4);

      currentY += 17;

      // Caja de contenido: Altura Dinámica para Fila 2 (Puesto/Departamento/Empresa/Fecha)
      const R1_HEIGHT = 32;
      const R2_MIN_HEIGHT = 35; // Altura mínima de respiro (30pt - 35pt)
      const puestoDeptoTexto = `${colaborador.puesto || 'General'}  •  ${colaborador.departamento || 'General'}`;

      // Medición dinámica con tipografía ajustada (8pt, lineGap 1.2)
      doc.font('Helvetica').fontSize(8);
      const puestoTextoHeight = doc.heightOfString(puestoDeptoTexto, { width: 230, lineGap: 1.2 });

      // Altura calculada para Fila 2: Etiqueta (y: +4) + paddingTop (2pt) + texto + paddingBottom (4pt)
      const R2_CALCULATED = Math.ceil(15 + puestoTextoHeight + 4);
      const R2_HEIGHT = Math.max(R2_MIN_HEIGHT, R2_CALCULATED);

      // Altura total dinámica de la caja de contenido
      const TRABAJADOR_HEIGHT = R1_HEIGHT + R2_HEIGHT;
      doc.rect(LEFT, currentY, CONTENT_WIDTH, TRABAJADOR_HEIGHT)
         .lineWidth(1).strokeColor(COLOR_NAVY).stroke();

      // Fila 1: Nombre y Nómina
      const R1_Y = currentY;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_MUTED_TEXT)
         .text('NOMBRE COMPLETO DEL TRABAJADOR:', LEFT + 8, R1_Y + 5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_TEXT)
         .text(colaborador.nombreCompleto, LEFT + 8, R1_Y + 16, { width: 340, ellipsis: true });

      doc.moveTo(LEFT + 360, R1_Y).lineTo(LEFT + 360, R1_Y + R1_HEIGHT)
         .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_MUTED_TEXT)
         .text('NO. DE NÓMINA / CÓDIGO:', LEFT + 368, R1_Y + 5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_NAVY)
         .text(colaborador.codigoEmpleado, LEFT + 368, R1_Y + 16);

      // Línea divisoria horizontal entre Fila 1 y Fila 2
      doc.moveTo(LEFT, R1_Y + R1_HEIGHT).lineTo(LEFT + CONTENT_WIDTH, R1_Y + R1_HEIGHT)
         .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();

      // Fila 2: Empresa/Sucursal, Puesto/Depto y Fecha Elaboración (Altura dinámica R2_HEIGHT)
      const R2_Y = R1_Y + R1_HEIGHT;

      // Celda 1: PUESTO / DEPARTAMENTO (Con tipografía optimizada y padding de respiro)
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_MUTED_TEXT)
         .text('PUESTO / DEPARTAMENTO:', LEFT + 8, R2_Y + 4);
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT)
         .text(puestoDeptoTexto, LEFT + 8, R2_Y + 15, {
           width: 230,
           lineGap: 1.2
         });

      // Borde vertical 1 (estirado uniformemente a R2_HEIGHT para alinear celdas)
      doc.moveTo(LEFT + 245, R2_Y).lineTo(LEFT + 245, R2_Y + R2_HEIGHT)
         .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();

      // Celda 2: SUCURSAL / EMPRESA / PLANTA (alineada y estirada con la fila)
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_MUTED_TEXT)
         .text('SUCURSAL / EMPRESA / PLANTA:', LEFT + 252, R2_Y + 4);
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT)
         .text(`${colaborador.empresa || 'Grupo JAMA'} (${colaborador.sucursal || 'Matriz'})`, LEFT + 252, R2_Y + 15, { width: 160, ellipsis: true });

      // Borde vertical 2 (estirado uniformemente a R2_HEIGHT para alinear celdas)
      doc.moveTo(LEFT + 420, R2_Y).lineTo(LEFT + 420, R2_Y + R2_HEIGHT)
         .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();

      // Celda 3: FECHA ELABORACIÓN (alineada y estirada con la fila)
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_MUTED_TEXT)
         .text('FECHA ELABORACIÓN:', LEFT + 426, R2_Y + 4);

      const BOX_W = 34;
      const BOX_H = 14;
      const BOX_Y = R2_Y + 14;

      ['DÍA', 'MES', 'AÑO'].forEach((etiqueta, idx) => {
        const bx = LEFT + 426 + (idx * 37);
        doc.rect(bx, BOX_Y, BOX_W, BOX_H).lineWidth(0.6).strokeColor(COLOR_NAVY).stroke();
        const val = idx === 0 ? fechaElab.dia : idx === 1 ? fechaElab.mes : fechaElab.anio;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_TEXT)
           .text(val, bx, BOX_Y + 3, { width: BOX_W, align: 'center' });
      });

      currentY += TRABAJADOR_HEIGHT + 10;

      // -------------------------------------------------------------
      // C) SECCIÓN 2: TABLA DE EJERCICIO Y SALDOS (CÁLCULO LFT)
      // -------------------------------------------------------------
      doc.rect(LEFT, currentY, CONTENT_WIDTH, 17)
         .fillColor(COLOR_NAVY).fill();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
         .text('2. EJERCICIO Y CONTROL DE SALDOS DE VACACIONES (CONFORME A LFT)', LEFT + 8, currentY + 4);

      currentY += 17;

      // Columnas de la tabla (Total: 540 pt)
      const COLS = [
        { label: 'Fecha de\nAntigüedad', w: 85 },
        { label: 'Ejercicio\nVigente', w: 90 },
        { label: 'Días Derecho\n(LFT Art. 76)', w: 90 },
        { label: 'Días Pendientes\n(Disponibles)', w: 90 },
        { label: 'Días a Disfrutar\n(Solicitados)', w: 90 },
        { label: 'Nuevo Saldo\nPendiente', w: 95 }
      ];

      // Cabecera de la tabla
      const TH_HEIGHT = 26;
      doc.rect(LEFT, currentY, CONTENT_WIDTH, TH_HEIGHT)
         .fillColor('#E2E8F0').fill();
      doc.rect(LEFT, currentY, CONTENT_WIDTH, TH_HEIGHT)
         .lineWidth(1).strokeColor(COLOR_NAVY).stroke();

      let cx = LEFT;
      COLS.forEach((col, idx) => {
        if (idx > 0) {
          doc.moveTo(cx, currentY).lineTo(cx, currentY + TH_HEIGHT)
             .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();
        }
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_NAVY)
           .text(col.label, cx + 2, currentY + 4, { width: col.w - 4, align: 'center' });
        cx += col.w;
      });

      currentY += TH_HEIGHT;

      // Fila de Datos
      const TD_HEIGHT = 22;
      doc.rect(LEFT, currentY, CONTENT_WIDTH, TD_HEIGHT)
         .fillColor(COLOR_LIGHT_BG).fill();
      doc.rect(LEFT, currentY, CONTENT_WIDTH, TD_HEIGHT)
         .lineWidth(1).strokeColor(COLOR_NAVY).stroke();

      const datosFila = [
        formatFechaStr(colaborador.fechaAlta),
        ejercicio.anioPeriodo,
        `${ejercicio.diasCorrespondientes.toFixed(1)} días`,
        `${ejercicio.diasPendientesAntes.toFixed(1)} días`,
        `${ejercicio.diasSolicitados.toFixed(1)} días`,
        `${ejercicio.nuevoSaldo.toFixed(1)} días`
      ];

      cx = LEFT;
      COLS.forEach((col, idx) => {
        if (idx > 0) {
          doc.moveTo(cx, currentY).lineTo(cx, currentY + TD_HEIGHT)
             .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();
        }
        const esResaltado = idx === 4 || idx === 5;
        doc.font(esResaltado ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
           .fillColor(idx === 4 ? '#1D4ED8' : idx === 5 ? '#047857' : COLOR_TEXT)
           .text(datosFila[idx], cx + 2, currentY + 6, { width: col.w - 4, align: 'center' });
        cx += col.w;
      });

      currentY += TD_HEIGHT + 10;

      // -------------------------------------------------------------
      // D) SECCIÓN 3: PERÍODO EN EL CUAL DISFRUTARÁ DE LAS VACACIONES
      // -------------------------------------------------------------
      doc.rect(LEFT, currentY, CONTENT_WIDTH, 17)
         .fillColor(COLOR_NAVY).fill();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
         .text('3. PERÍODO PROGRAMADO EN EL CUAL DISFRUTARÁ DE LAS VACACIONES', LEFT + 8, currentY + 4);

      currentY += 17;

      const PERIODO_HEIGHT = 80;
      doc.rect(LEFT, currentY, CONTENT_WIDTH, PERIODO_HEIGHT)
         .lineWidth(1).strokeColor(COLOR_NAVY).stroke();

      const fInicio = desglosarFecha(solicitud.fechaInicio);
      const fFin = desglosarFecha(solicitud.fechaFin);
      const fechaReinc = calcularFechaReincorporacion(solicitud.fechaFin, colaborador.diasDescanso, festivosSet);

      // Fila 1: DESDE y HASTA con casillas cuadradas
      const P1_Y = currentY + 8;

      // DESDE
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_NAVY)
         .text('DESDE:', LEFT + 12, P1_Y + 3);

      ['DÍA', 'MES', 'AÑO'].forEach((etq, i) => {
        const bx = LEFT + 56 + (i * 38);
        doc.rect(bx, P1_Y, 34, 16).lineWidth(0.8).strokeColor(COLOR_NAVY).stroke();
        const v = i === 0 ? fInicio.dia : i === 1 ? fInicio.mes : fInicio.anio;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXT)
           .text(v, bx, P1_Y + 3, { width: 34, align: 'center' });
      });

      // HASTA
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_NAVY)
         .text('HASTA:', LEFT + 190, P1_Y + 3);

      ['DÍA', 'MES', 'AÑO'].forEach((etq, i) => {
        const bx = LEFT + 236 + (i * 38);
        doc.rect(bx, P1_Y, 34, 16).lineWidth(0.8).strokeColor(COLOR_NAVY).stroke();
        const v = i === 0 ? fFin.dia : i === 1 ? fFin.mes : fFin.anio;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXT)
           .text(v, bx, P1_Y + 3, { width: 34, align: 'center' });
      });

      // Días Totales Badge
      doc.rect(LEFT + 370, P1_Y - 2, 158, 20).fillColor('#EFF6FF').fill();
      doc.rect(LEFT + 370, P1_Y - 2, 158, 20).lineWidth(0.8).strokeColor('#93C5FD').stroke();
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1E40AF')
         .text(`TOTAL: ${solicitud.totalDiasLaborables} DÍAS HÁBILES (LUN-SÁB)`, LEFT + 370, P1_Y + 4, { width: 158, align: 'center' });

      // Línea divisoria
      doc.moveTo(LEFT, currentY + 30).lineTo(LEFT + CONTENT_WIDTH, currentY + 30)
         .lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();

      // Fila 2: Fecha de Reincorporación a Labores (Destacada)
      const P2_Y = currentY + 34;
      doc.rect(LEFT + 8, P2_Y, CONTENT_WIDTH - 16, 22)
         .fillColor('#FEF3C7').fill();
      doc.rect(LEFT + 8, P2_Y, CONTENT_WIDTH - 16, 22)
         .lineWidth(0.8).strokeColor('#F59E0B').stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#92400E')
         .text('FECHA DE REINCORPORACIÓN DE LABORES:', LEFT + 16, P2_Y + 6);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#78350F')
         .text(fechaReinc, LEFT + 225, P2_Y + 5);

      doc.font('Helvetica').fontSize(7.5).fillColor('#B45309')
         .text('(Primer día laborable posterior a descansos e inhábiles)', LEFT + 305, P2_Y + 7);

      // Fila 3: Observaciones
      const P3_Y = currentY + 60;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_MUTED_TEXT)
         .text('OBSERVACIONES / JUSTIFICACIÓN:', LEFT + 12, P3_Y);
      doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT)
         .text(solicitud.motivoComentarios || 'Ninguna registrada.', LEFT + 165, P3_Y, { width: 360, ellipsis: true });

      currentY += PERIODO_HEIGHT + 10;

      // -------------------------------------------------------------
      // E) SECCIÓN 4: DECISIONES DE AUTORIZACIÓN Y FIRMAS DIGITALES
      // -------------------------------------------------------------
      doc.rect(LEFT, currentY, CONTENT_WIDTH, 17)
         .fillColor(COLOR_NAVY).fill();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
         .text('4. DECISIONES DE AUTORIZACIÓN Y SELLADO DIGITAL INSTITUCIONAL', LEFT + 8, currentY + 4);

      currentY += 21;

      const FIRMAS_HEIGHT = 106;
      const esRechazada = solicitud.estado === 'RECHAZADA';
      const tieneSegundoAprobador = Boolean(segundoAprobador && segundoAprobador.nombreCompleto && segundoAprobador.nombreCompleto.trim().length > 0);
      const hashColab = generarSelloDigital(`${solicitud.folio}-${colaborador.codigoEmpleado}-${solicitud.fechaCreacion}`);
      const hashDO = generarSelloDigital(`${solicitud.folio}-DO-JAMA-2026`);

      // Helper para renderizar cada caja de firma individualmente con diseño uniforme y nítido
      function renderFirmaBox(box) {
        const { x, y, w, h, titulo, badgeText, badgeColor, hash, fechaSello, extra, nombre, leyenda, fechaHora } = box;

        // 1. Marco exterior
        doc.rect(x, y, w, h).lineWidth(1).strokeColor(COLOR_NAVY).stroke();

        // 2. Encabezado superior con fondo institucional (#002D62)
        doc.rect(x, y, w, 16).fillColor(COLOR_NAVY).fill();
        doc.font('Helvetica-Bold').fontSize(w < 150 ? 7 : 7.5).fillColor('#FFFFFF')
           .text(titulo, x, y + 4.5, { width: w, align: 'center' });

        // 3. Área central libre para sello digital o firma física (altura 43pt)
        const INNER_X = x + 5;
        const INNER_Y = y + 19;
        const INNER_W = w - 10;
        const INNER_H = 43;

        doc.rect(INNER_X, INNER_Y, INNER_W, INNER_H).fillColor('#F8FAFC').fill();
        doc.rect(INNER_X, INNER_Y, INNER_W, INNER_H).lineWidth(0.5).strokeColor(COLOR_MUTED_BORDER).stroke();

        // Badge de Estatus
        doc.font('Helvetica-Bold').fontSize(w < 150 ? 5.5 : 6.5).fillColor(badgeColor || '#059669')
           .text(badgeText || '', INNER_X + 2, INNER_Y + 4, { width: INNER_W - 4, align: 'center' });

        // Sello Hash Digital
        doc.font('Courier').fontSize(w < 150 ? 4.8 : 5.5).fillColor(COLOR_MUTED_TEXT)
           .text(hash ? `SELLO: ${hash}` : '—', INNER_X + 2, INNER_Y + 14, { width: INNER_W - 4, align: 'center' });

        // Fecha del sello
        doc.font('Helvetica').fontSize(w < 150 ? 5 : 5.5).fillColor(COLOR_MUTED_TEXT)
           .text(fechaSello ? `FECHA: ${fechaSello}` : '—', INNER_X + 2, INNER_Y + 23, { width: INNER_W - 4, align: 'center' });

        // Extra / Leyenda del método
        if (extra) {
          doc.font('Helvetica').fontSize(w < 150 ? 4.8 : 5.5).fillColor('#64748B')
             .text(extra, INNER_X + 2, INNER_Y + 32, { width: INNER_W - 4, align: 'center' });
        }

        // 4. Parte inferior: Línea de separación (borderTop: 0.5pt solid #555)
        const LINE_Y = y + 66;
        doc.moveTo(x + 6, LINE_Y).lineTo(x + w - 6, LINE_Y).lineWidth(0.5).strokeColor('#555555').stroke();

        // Nombre del autorizador / colaborador
        doc.font('Helvetica-Bold').fontSize(w < 150 ? 6.5 : 7.5).fillColor(COLOR_TEXT)
           .text(nombre || '—', x + 4, LINE_Y + 4, { width: w - 8, align: 'center', height: 16, ellipsis: true });

        // Leyenda
        doc.font('Helvetica').fontSize(w < 150 ? 5.5 : 6.5).fillColor(COLOR_MUTED_TEXT)
           .text(leyenda || 'Nombre y Firma', x + 4, LINE_Y + 20, { width: w - 8, align: 'center' });

        // Fecha / Hora
        doc.font('Helvetica').fontSize(w < 150 ? 5 : 6).fillColor('#64748B')
           .text(fechaHora ? `Fecha: ${fechaHora}` : '—', x + 4, LINE_Y + 29, { width: w - 8, align: 'center' });
      }

      if (!tieneSegundoAprobador) {
        // =========================================================================
        // CASO A: 3 COLUMNAS PROPORCIONADAS (Width: 33.3% cada una - Flujo Estándar)
        // =========================================================================
        const BOX_W = 174;
        const GAP = 9;

        // 1. SOLICITADO POR (Colaborador)
        renderFirmaBox({
          x: LEFT,
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'SOLICITADO POR',
          badgeText: '✔ SOLICITUD SELLADA',
          badgeColor: '#059669',
          hash: hashColab,
          fechaSello: formatFechaStr(solicitud.fechaCreacion),
          extra: 'Sesión Web Oficial',
          nombre: colaborador.nombreCompleto,
          leyenda: 'Nombre y Firma del Trabajador',
          fechaHora: formatFechaStr(solicitud.fechaCreacion)
        });

        // 2. AUTORIZADO POR (Jefe Inmediato)
        const hashLider = generarSelloDigital(`${solicitud.folio}-LIDER-${jefe.codigoEmpleado || '00'}`);
        const esAprobadaLider = solicitud.estado === 'APROBADA' || solicitud.estado === 'PENDIENTE_DO';

        renderFirmaBox({
          x: LEFT + BOX_W + GAP,
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'AUTORIZADO POR',
          badgeText: esAprobadaLider ? '✔ AUTORIZADO POR JEFATURA' : esRechazada ? '✖ NO AUTORIZADO' : '⏳ PENDIENTE DE REVISIÓN',
          badgeColor: esAprobadaLider ? '#059669' : esRechazada ? '#DC2626' : '#D97706',
          hash: esAprobadaLider ? hashLider : esRechazada ? 'TRAMITE DENEGADO' : 'EN ESPERA DE FIRMA',
          fechaSello: esAprobadaLider ? formatFechaStr(solicitud.fechaAprobacionLider || solicitud.fechaResolucion || solicitud.fechaCreacion) : esRechazada ? formatFechaStr(solicitud.fechaResolucion) : 'En Proceso',
          extra: esAprobadaLider ? 'Portal Web Oficial' : esRechazada ? (solicitud.motivoRechazo ? `Motivo: ${solicitud.motivoRechazo.substring(0, 24)}` : 'Rechazado') : 'Bandeja de Aprobaciones',
          nombre: jefe.nombreCompleto,
          leyenda: jefe.puesto ? `${jefe.puesto} • Nombre y Firma` : 'Jefe Inmediato • Nombre y Firma',
          fechaHora: formatFechaStr(solicitud.fechaAprobacionLider || solicitud.fechaResolucion)
        });

        // 3. DESARROLLO ORGANIZACIONAL
        renderFirmaBox({
          x: LEFT + 2 * (BOX_W + GAP),
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'DESARROLLO ORGANIZACIONAL',
          badgeText: solicitud.estado === 'APROBADA' ? '✔ VALIDADO EN NÓMINA' : esRechazada ? '✖ TRAMITE CANCELADO' : '⏳ EN ESPERA DE RESOLUCIÓN',
          badgeColor: solicitud.estado === 'APROBADA' ? '#002D62' : esRechazada ? '#DC2626' : '#D97706',
          hash: solicitud.estado === 'APROBADA' ? hashDO : esRechazada ? 'SIN AFECTACIÓN' : 'PENDIENTE DE CIERRE',
          fechaSello: solicitud.estado === 'APROBADA' ? formatFechaStr(solicitud.fechaResolucion || solicitud.fechaCreacion) : esRechazada ? formatFechaStr(solicitud.fechaResolucion) : 'Pendiente Nómina',
          extra: solicitud.estado === 'APROBADA' ? 'CONTPAQi Nóminas' : esRechazada ? 'Sin afectación en nómina' : 'Control Interno DO',
          nombre: aprobadorDO || 'Desarrollo Organizacional',
          leyenda: 'Vo. Bo. Desarrollo Organizacional',
          fechaHora: formatFechaStr(solicitud.fechaResolucion)
        });
      } else {
        // =========================================================================
        // CASO B: 4 COLUMNAS INDEPENDIENTES (Width: 25% cada una - Flujo Escalonado)
        // =========================================================================
        const BOX_W = 129;
        const GAP = 8;

        const histLider = (historial || []).find(h => h.NivelAprobacion === 'LIDER_DIRECTO' && h.Accion === 'APROBADA');
        const histGerente = (historial || []).find(h => h.NivelAprobacion === 'GERENTE_SUCURSAL' && h.Accion === 'APROBADA');
        const esVoBoLider = Boolean(histLider || solicitud.fechaAprobacionLider || solicitud.estado === 'PENDIENTE_GERENTE' || solicitud.estado === 'APROBADA');
        const esAutGerente = Boolean(histGerente || solicitud.fechaAprobacionSegundo || solicitud.estado === 'APROBADA');
        const hashLider = generarSelloDigital(`${solicitud.folio}-LIDER-${jefe.codigoEmpleado || '00'}`);
        const hashGerente = generarSelloDigital(`${solicitud.folio}-GER-${segundoAprobador.codigoEmpleado || '00'}`);

        // 1. SOLICITADO POR (Colaborador)
        renderFirmaBox({
          x: LEFT,
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'SOLICITADO POR',
          badgeText: '✔ SOLICITADO',
          badgeColor: '#059669',
          hash: hashColab,
          fechaSello: formatFechaStr(solicitud.fechaCreacion),
          extra: 'Sesión Web Oficial',
          nombre: colaborador.nombreCompleto,
          leyenda: 'Firma del Trabajador',
          fechaHora: formatFechaStr(solicitud.fechaCreacion)
        });

        // 2. VISTO BUENO (Jefe Directo)
        renderFirmaBox({
          x: LEFT + BOX_W + GAP,
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'VISTO BUENO',
          badgeText: esVoBoLider ? '✔ Vo.Bo. Aprobado' : esRechazada ? '✖ No Autorizado' : '⏳ Pendiente Vo.Bo.',
          badgeColor: esVoBoLider ? '#059669' : esRechazada ? '#DC2626' : '#D97706',
          hash: esVoBoLider ? hashLider : esRechazada ? 'RECHAZADO' : 'EN ESPERA N1',
          fechaSello: esVoBoLider ? formatFechaStr(solicitud.fechaAprobacionLider || histLider?.FechaAccion || solicitud.fechaCreacion) : esRechazada ? formatFechaStr(solicitud.fechaResolucion) : 'Pendiente',
          extra: esVoBoLider ? 'Nivel 1: Visto Bueno' : esRechazada ? 'Denegado Nivel 1' : 'Revisión Operativa',
          nombre: jefe.nombreCompleto,
          leyenda: 'Jefe Directo (Nivel 1)',
          fechaHora: formatFechaStr(solicitud.fechaAprobacionLider || histLider?.FechaAccion)
        });

        // 3. AUTORIZADO POR (Gerente de Sucursal)
        renderFirmaBox({
          x: LEFT + 2 * (BOX_W + GAP),
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'AUTORIZADO POR',
          badgeText: esAutGerente ? '✔ Autorizado' : esRechazada ? '✖ No Autorizado' : solicitud.estado === 'PENDIENTE_GERENTE' ? '⏳ Pendiente Gerencia' : '⏳ Esperando N1',
          badgeColor: esAutGerente ? '#059669' : esRechazada ? '#DC2626' : solicitud.estado === 'PENDIENTE_GERENTE' ? '#4338CA' : '#D97706',
          hash: esAutGerente ? hashGerente : esRechazada ? 'RECHAZADO' : 'EN ESPERA N2',
          fechaSello: esAutGerente ? formatFechaStr(solicitud.fechaAprobacionSegundo || histGerente?.FechaAccion || solicitud.fechaResolucion) : esRechazada ? formatFechaStr(solicitud.fechaResolucion) : 'Pendiente',
          extra: esAutGerente ? 'Nivel 2: Gerencial' : esRechazada ? 'Denegado Nivel 2' : 'Gerencia de Sucursal',
          nombre: segundoAprobador.nombreCompleto,
          leyenda: 'Gerente Sucursal (Nivel 2)',
          fechaHora: formatFechaStr(solicitud.fechaAprobacionSegundo || histGerente?.FechaAccion)
        });

        // 4. REGISTRO D.O. (Desarrollo Organizacional)
        renderFirmaBox({
          x: LEFT + 3 * (BOX_W + GAP),
          y: currentY,
          w: BOX_W,
          h: FIRMAS_HEIGHT,
          titulo: 'REGISTRO D.O.',
          badgeText: solicitud.estado === 'APROBADA' ? '✔ VALIDADO NÓMINA' : esRechazada ? '✖ CANCELADO' : '⏳ EN ESPERA',
          badgeColor: solicitud.estado === 'APROBADA' ? '#002D62' : esRechazada ? '#DC2626' : '#D97706',
          hash: solicitud.estado === 'APROBADA' ? hashDO : esRechazada ? 'SIN AFECTACIÓN' : 'PENDIENTE',
          fechaSello: solicitud.estado === 'APROBADA' ? formatFechaStr(solicitud.fechaResolucion || solicitud.fechaCreacion) : esRechazada ? formatFechaStr(solicitud.fechaResolucion) : 'En Espera',
          extra: solicitud.estado === 'APROBADA' ? 'CONTPAQi Nóminas' : esRechazada ? 'Sin afectación' : 'Control Interno DO',
          nombre: aprobadorDO || 'Desarrollo Organizacional',
          leyenda: 'Registro D.O. / Nóminas',
          fechaHora: formatFechaStr(solicitud.fechaResolucion)
        });
      }

      // -------------------------------------------------------------
      // NOTA AL PIE OBLIGATORIA (100% DEL ANCHO)
      // -------------------------------------------------------------
      const NOTA_Y = currentY + FIRMAS_HEIGHT + 6;
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748B')
         .text('*Importante: Para niveles gerenciales se requiere autorización del Director General', LEFT, NOTA_Y, {
           width: CONTENT_WIDTH,
           align: 'center',
           lineBreak: false
         });

      // -------------------------------------------------------------
      // PIE DE PÁGINA INSTITUCIONAL
      // -------------------------------------------------------------
      doc.page.margins.bottom = 0;
      const FOOTER_Y = PAGE_HEIGHT - 22;
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B')
         .text('Formato FDO-84 (Rev. A - 26/01/2024) • Grupo JAMA • Sistema Oficial de Control de Vacaciones • Página 1 de 1', LEFT, FOOTER_Y, {
           width: CONTENT_WIDTH,
           align: 'center',
           lineBreak: false
         });

      doc.end();
      if (streamDestino) {
        resolve(doc);
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generarPdfFdo84,
  recopilarDatosFdo84
};
