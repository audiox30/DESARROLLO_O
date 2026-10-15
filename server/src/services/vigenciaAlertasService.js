const { getLocalPool, isUsingMock } = require('../config/database');
const { crearTransportadorSmtp } = require('./emailService');

/**
 * Servicio de Alertas Automatizadas del Ciclo de Vida y Vigencia de Vacaciones
 * Grupo JAMA - Cumplimiento Art. 76, 81 y 516 Ley Federal del Trabajo
 */

async function obtenerParametrosAvisos() {
  const defaults = {
    AVISOS_VIGENCIA_ENABLED: 'true',
    AVISOS_VIGENCIA_HORA: '08:00',
    AVISOS_VIGENCIA_ANIVERSARIO: 'true',
    AVISOS_VIGENCIA_12_MESES: 'true',
    AVISOS_VIGENCIA_15_MESES: 'true',
    AVISOS_VIGENCIA_18_MESES: 'true',
    AVISOS_VIGENCIA_COPIA_LIDER: 'true',
    AVISOS_VIGENCIA_COPIA_DO: 'true',
    AVISOS_VIGENCIA_EMAIL_DO: 'admin.rh@grupojama.com'
  };

  try {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) return defaults;

    const res = await pool.request().query("SELECT Clave, Valor FROM dbo.ConfiguracionSistema WHERE Categoria = 'AVISOS_VIGENCIA'");
    const config = { ...defaults };
    (res.recordset || []).forEach(r => {
      config[r.Clave] = r.Valor;
    });
    return config;
  } catch (err) {
    console.warn('[vigenciaAlertasService] Usando parámetros por defecto:', err.message);
    return defaults;
  }
}

function generarHtmlCorreoAviso({
  tipoAviso,
  nombreColaborador,
  codigoEmpleado,
  empresa,
  puesto,
  periodo,
  antiguedadCumplida,
  diasCorrespondientes,
  diasPendientes,
  fechaAniversario,
  fechaFinVigencia,
  diasRestantesVigencia
}) {
  let titulo = '';
  let colorHeader = '#1e3a8a';
  let badgeColor = '#dbeafe';
  let badgeText = '#1e40af';
  let badgeLabel = '';
  let mensajePrincipal = '';
  let recomendacion = '';

  switch (tipoAviso) {
    case 'ANIVERSARIO_NUEVO':
      titulo = '🎉 ¡Feliz Aniversario Laboral en Grupo JAMA!';
      colorHeader = '#065f46';
      badgeColor = '#d1fae5';
      badgeText = '#065f46';
      badgeLabel = `Aniversario Año ${antiguedadCumplida}`;
      mensajePrincipal = `Nos complace felicitarte por cumplir <strong>${antiguedadCumplida} ${antiguedadCumplida === 1 ? 'año' : 'años'} de servicio</strong> en <strong>${empresa}</strong>. Conforme a la Reforma de Vacaciones Dignas (Art. 76 LFT), se ha acreditado tu nuevo saldo legal de vacaciones.`;
      recomendacion = 'Te invitamos a dialogar con tu líder de área y coordinar tus períodos de descanso con la debida anticipación institucional.';
      break;

    case 'ALERTA_12_MESES':
      titulo = '⏳ Aviso Preventivo de Vacaciones (12 Meses Cumplidos)';
      colorHeader = '#1e40af';
      badgeColor = '#e0e7ff';
      badgeText = '#3730a3';
      badgeLabel = 'Vigencia: Restan 6 Meses';
      mensajePrincipal = `Te recordamos que han transcurrido <strong>12 meses</strong> desde tu último aniversario laboral correspondiente al ciclo <strong>${periodo}</strong>. Conforme al Art. 81 de la LFT, dispones de una ventana legal de 18 meses para disfrutar tu saldo.`;
      recomendacion = `Actualmente conservas <strong>${diasPendientes} días pendientes</strong> por gozar. Te recomendamos programar tus fechas antes de que inicie la ventana crítica de prescripción.`;
      break;

    case 'ALERTA_15_MESES':
      titulo = '⚠️ Alerta Preventiva Urgente de Vacaciones (15 Meses)';
      colorHeader = '#b45309';
      badgeColor = '#fef3c7';
      badgeText = '#92400e';
      badgeLabel = '¡Atención! Restan 3 Meses';
      mensajePrincipal = `Han transcurrido <strong>15 meses</strong> desde tu aniversario laboral del ciclo <strong>${periodo}</strong>. Restan únicamente <strong>${Math.max(0, diasRestantesVigencia)} días (~3 meses)</strong> antes del término legal de vigencia el <strong>${fechaFinVigencia}</strong>.`;
      recomendacion = `Tienes <strong>${diasPendientes} días pendientes</strong>. Es prioritario que ingreses tu solicitud en el portal de vacaciones para acordar las fechas con tu jefatura antes de su prescripción.`;
      break;

    case 'CADUCIDAD_18_MESES':
      titulo = '🛑 Conclusión de Vigencia Legal de Vacaciones (18 Meses LFT)';
      colorHeader = '#991b1b';
      badgeColor = '#fee2e2';
      badgeText = '#991b1b';
      badgeLabel = 'Período Prescrito (Art. 81 LFT)';
      mensajePrincipal = `Te informamos que ha concluido la vigencia legal de 18 meses del ciclo <strong>${periodo}</strong> con fecha límite <strong>${fechaFinVigencia}</strong>, de conformidad con lo estipulado en los Artículos 81 y 516 de la Ley Federal del Trabajo.`;
      recomendacion = 'Cualquier consulta sobre este período debe ser canalizada con la Jefatura de Desarrollo Organizacional.';
      break;

    default:
      titulo = 'Notificación de Saldo de Vacaciones';
      badgeLabel = 'Aviso Institucional';
      mensajePrincipal = `Notificación sobre tu ciclo de vacaciones <strong>${periodo}</strong>.`;
      recomendacion = 'Consulta tu saldo en el portal de vacaciones de Grupo JAMA.';
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 0; }
        .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: ${colorHeader}; padding: 28px 32px; color: #ffffff; }
        .content { padding: 32px; color: #334155; line-height: 1.6; font-size: 14px; }
        .table-data { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
        .table-data th { background: #f1f5f9; text-align: left; padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
        .table-data td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 11px; background: ${badgeColor}; color: ${badgeText}; text-transform: uppercase; }
        .notice-box { background: #f8fafc; border-left: 4px solid ${colorHeader}; padding: 14px 18px; border-radius: 0 10px 10px 0; margin: 20px 0; font-size: 13px; }
        .footer { background: #f1f5f9; padding: 20px 32px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge" style="margin-bottom: 12px;">${badgeLabel}</span>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${titulo}</h1>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">Grupo JAMA • Desarrollo Organizacional</p>
        </div>
        <div class="content">
          <p>Estimado(a) <strong>${nombreColaborador}</strong> (Nómina: <code>${codigoEmpleado}</code>),</p>
          <p>${mensajePrincipal}</p>

          <table class="table-data">
            <tr>
              <th>Concepto</th>
              <th style="text-align: right;">Detalle Oficial</th>
            </tr>
            <tr>
              <td><strong>Empresa / Razón Social</strong></td>
              <td style="text-align: right;">${empresa}</td>
            </tr>
            <tr>
              <td><strong>Puesto</strong></td>
              <td style="text-align: right;">${puesto || 'General'}</td>
            </tr>
            <tr>
              <td><strong>Ciclo de Aniversario</strong></td>
              <td style="text-align: right;">Año ${antiguedadCumplida} (Ciclo ${periodo})</td>
            </tr>
            <tr>
              <td><strong>Fecha de Aniversario</strong></td>
              <td style="text-align: right; font-family: monospace;">${fechaAniversario || '—'}</td>
            </tr>
            <tr>
              <td><strong>Días Legales LFT Acreditados</strong></td>
              <td style="text-align: right; font-weight: bold; color: #1e3a8a;">${diasCorrespondientes} días</td>
            </tr>
            <tr>
              <td><strong>Días Disponibles Restantes</strong></td>
              <td style="text-align: right; font-weight: 900; color: #059669; font-size: 15px;">${diasPendientes} días</td>
            </tr>
            <tr>
              <td><strong>Fecha Fin de Vigencia Legal (18m)</strong></td>
              <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${tipoAviso === 'CADUCIDAD_18_MESES' ? '#dc2626' : '#334155'};">${fechaFinVigencia || '—'}</td>
            </tr>
          </table>

          <div class="notice-box">
            ${recomendacion}
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
            Para revisar tu kárdex detallado y tramitar tus vacaciones, ingresa al portal institucional en <a href="http://localhost:5001" style="color: #2563eb; font-weight: bold;">Control de Vacaciones Grupo JAMA</a>.
          </p>
        </div>
        <div class="footer">
          Este es un aviso automático generado por el Sistema de Control de Vacaciones de Grupo JAMA conforme a los Artículos 76, 81 y 516 de la Ley Federal del Trabajo. Por favor no respondas directamente a este mensaje.
        </div>
      </div>
    </body>
    </html>
  `;
}

const vigenciaAlertasService = {
  /**
   * Ejecuta la evaluación completa de saldos y despacha los avisos correspondientes
   * @param {Object} opciones { forzarEnvio: false, simular: false }
   */
  evaluarYEnviarAvisos: async (opciones = {}) => {
    const { forzarEnvio = false, simular = false } = opciones;
    const config = await obtenerParametrosAvisos();

    if (config.AVISOS_VIGENCIA_ENABLED !== 'true' && !forzarEnvio) {
      return {
        success: true,
        mensaje: 'El módulo de Avisos de Vigencia está desactivado en la configuración.',
        evaluados: 0,
        enviados: 0,
        omitidos: 0
      };
    }

    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      return {
        success: true,
        mensaje: 'Modo contingencia o desarrollo local mock. Simulación de avisos completada.',
        evaluados: 10,
        enviados: simular ? 0 : 2,
        omitidos: 8
      };
    }

    // 1. Obtener todos los colaboradores activos y sus períodos de saldos no cerrados o recién caducados
    const saldosRes = await pool.request().query(`
      SELECT 
        c.IdColaborador,
        c.CodigoEmpleado,
        c.NombreCompleto,
        c.Email,
        CONVERT(VARCHAR(10), c.FechaAlta, 120) AS FechaAlta,
        c.Empresa,
        c.Sucursal,
        p.Nombre AS Puesto,
        j.Email AS EmailJefe,
        j.NombreCompleto AS NombreJefe,
        sv.IdSaldo,
        sv.Periodo,
        sv.AnioPeriodo,
        sv.AntiguedadCumplida,
        sv.DiasCorrespondientes,
        sv.DiasGozados,
        sv.DiasPendientes,
        sv.DiasEnTramite,
        CONVERT(VARCHAR(10), sv.FechaInicioVigencia, 120) AS FechaInicioVigencia,
        CONVERT(VARCHAR(10), sv.FechaFinVigencia, 120) AS FechaFinVigencia,
        sv.EsCerrado
      FROM dbo.Colaboradores c
      JOIN dbo.SaldosVacaciones sv ON sv.IdColaborador = c.IdColaborador
      LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
      LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
      WHERE c.Activo = 1
      ORDER BY c.IdColaborador, sv.AntiguedadCumplida ASC;
    `);

    // 2. Obtener historial de avisos ya enviados para evitar duplicados
    const logsRes = await pool.request().query(`
      SELECT IdColaborador, Periodo, TipoAviso 
      FROM dbo.LogAvisosVigenciaEnviados 
      WHERE EstatusEnvio IN ('ENVIADO', 'SIMULADO');
    `);

    const enviadosSet = new Set(
      (logsRes.recordset || []).map(r => `${r.IdColaborador}_${r.Periodo}_${r.TipoAviso}`)
    );

    const transportador = simular ? null : crearTransportadorSmtp();
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    let totalEvaluados = 0;
    let totalEnviados = 0;
    let totalOmitidos = 0;
    const detallesEnvios = [];

    const rows = saldosRes.recordset || [];

    for (const row of rows) {
      totalEvaluados++;
      const finVig = row.FechaFinVigencia;
      const iniVig = row.FechaInicioVigencia;
      const pendientes = Number(row.DiasPendientes || 0);

      if (!finVig || !iniVig) continue;

      const fechaFinObj = new Date(finVig + 'T00:00:00');
      const fechaIniObj = new Date(iniVig + 'T00:00:00');

      const diffDiasFin = Math.ceil((fechaFinObj - hoy) / (1000 * 60 * 60 * 24));
      const diffDiasIni = Math.ceil((hoy - fechaIniObj) / (1000 * 60 * 60 * 24));

      // Determinar qué tipos de avisos aplican para esta fila
      const avisosAValidar = [];

      // A) ANIVERSARIO_NUEVO: Se cumplió aniversario recientemente (0 a 14 días) y tiene derecho legal
      if (config.AVISOS_VIGENCIA_ANIVERSARIO === 'true' && diffDiasIni >= 0 && diffDiasIni <= 14 && row.DiasCorrespondientes > 0) {
        avisosAValidar.push({
          tipo: 'ANIVERSARIO_NUEVO',
          diasRestantes: diffDiasFin
        });
      }

      // B) ALERTA_12_MESES: Han pasado 12 meses (restan ~6 meses / entre 95 y 185 días) y conserva saldo
      if (config.AVISOS_VIGENCIA_12_MESES === 'true' && pendientes > 0 && diffDiasFin <= 185 && diffDiasFin > 95) {
        avisosAValidar.push({
          tipo: 'ALERTA_12_MESES',
          diasRestantes: diffDiasFin
        });
      }

      // C) ALERTA_15_MESES: Han pasado 15 meses (restan ~3 meses / entre 1 y 95 días) y conserva saldo
      if (config.AVISOS_VIGENCIA_15_MESES === 'true' && pendientes > 0 && diffDiasFin <= 95 && diffDiasFin > 0) {
        avisosAValidar.push({
          tipo: 'ALERTA_15_MESES',
          diasRestantes: diffDiasFin
        });
      }

      // D) CADUCIDAD_18_MESES: Llegó a la fecha límite (diffDiasFin <= 0) dentro de los últimos 10 días
      if (config.AVISOS_VIGENCIA_18_MESES === 'true' && diffDiasFin <= 0 && diffDiasFin >= -10 && (pendientes > 0 || row.EsCerrado === 1)) {
        avisosAValidar.push({
          tipo: 'CADUCIDAD_18_MESES',
          diasRestantes: 0
        });
      }

      for (const aviso of avisosAValidar) {
        const key = `${row.IdColaborador}_${row.Periodo}_${aviso.tipo}`;
        if (enviadosSet.has(key)) {
          totalOmitidos++;
          continue; // Ya fue enviado en este ciclo, nunca se duplica
        }

        const destinatario = row.Email && row.Email.includes('@') ? row.Email : config.AVISOS_VIGENCIA_EMAIL_DO;
        const copiaList = [];

        if (config.AVISOS_VIGENCIA_COPIA_LIDER === 'true' && row.EmailJefe && row.EmailJefe.includes('@')) {
          copiaList.push(row.EmailJefe);
        }
        if (config.AVISOS_VIGENCIA_COPIA_DO === 'true' && config.AVISOS_VIGENCIA_EMAIL_DO) {
          copiaList.push(config.AVISOS_VIGENCIA_EMAIL_DO);
        }

        const htmlContent = generarHtmlCorreoAviso({
          tipoAviso: aviso.tipo,
          nombreColaborador: row.NombreCompleto,
          codigoEmpleado: row.CodigoEmpleado,
          empresa: row.Empresa,
          puesto: row.Puesto,
          periodo: row.Periodo,
          antiguedadCumplida: row.AntiguedadCumplida,
          diasCorrespondientes: row.DiasCorrespondientes,
          diasPendientes: row.DiasPendientes,
          fechaAniversario: row.FechaInicioVigencia,
          fechaFinVigencia: row.FechaFinVigencia,
          diasRestantesVigencia: aviso.diasRestantes
        });

        let estatusEnvio = simular ? 'SIMULADO' : 'ENVIADO';

        if (!simular && transportador) {
          try {
            await transportador.sendMail({
              from: `Control de Vacaciones Grupo JAMA <${process.env.SMTP_USER || 'notificaciones@grupojama.com.mx'}>`,
              to: destinatario,
              cc: copiaList.length > 0 ? copiaList.join(', ') : undefined,
              subject: `${aviso.tipo === 'ANIVERSARIO_NUEVO' ? '🎉' : aviso.tipo === 'ALERTA_15_MESES' ? '⚠️' : '⏳'} Notificación de Vacaciones: ${row.NombreCompleto} • Ciclo ${row.Periodo}`,
              html: htmlContent
            });
          } catch (mailErr) {
            console.error(`[vigenciaAlertasService] Error enviando correo a ${destinatario}:`, mailErr.message);
            estatusEnvio = 'ERROR';
          }
        }

        // Registrar en dbo.LogAvisosVigenciaEnviados
        try {
          await pool.request()
            .input('IdColaborador', row.IdColaborador)
            .input('Periodo', row.Periodo)
            .input('TipoAviso', aviso.tipo)
            .input('DiasRestantesAlerta', Math.max(0, aviso.diasRestantes))
            .input('Destinatario', destinatario)
            .input('EstatusEnvio', estatusEnvio)
            .query(`
              INSERT INTO dbo.LogAvisosVigenciaEnviados (
                IdColaborador, Periodo, TipoAviso, DiasRestantesAlerta, FechaEnvio, Destinatario, EstatusEnvio
              ) VALUES (
                @IdColaborador, @Periodo, @TipoAviso, @DiasRestantesAlerta, SYSDATETIME(), @Destinatario, @EstatusEnvio
              );
            `);
        } catch (dbErr) {
          console.error('[vigenciaAlertasService] Error registrando log en BD:', dbErr.message);
        }

        enviadosSet.add(key);
        totalEnviados++;
        detallesEnvios.push({
          colaborador: row.NombreCompleto,
          codigo: row.CodigoEmpleado,
          periodo: row.Periodo,
          tipoAviso: aviso.tipo,
          destinatario,
          estatus: estatusEnvio
        });
      }
    }

    return {
      success: true,
      mensaje: simular 
        ? `Simulación finalizada: Se detectarían ${totalEnviados} avisos para enviar.` 
        : `Proceso completado: Se enviaron ${totalEnviados} avisos (${totalOmitidos} omitidos por haber sido enviados previamente).`,
      evaluados: totalEvaluados,
      enviados: totalEnviados,
      omitidos: totalOmitidos,
      detalles: detallesEnvios
    };
  },

  /**
   * Obtiene la bitácora histórica de avisos enviados
   */
  getBitacoraAvisos: async (filtros = {}) => {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) return { success: true, total: 0, data: [] };

    const { tipoAviso, estatus, busqueda } = filtros;
    let whereClauses = ['1=1'];

    const req = pool.request();
    if (tipoAviso && tipoAviso !== 'TODOS') {
      req.input('TipoAviso', tipoAviso);
      whereClauses.push('l.TipoAviso = @TipoAviso');
    }
    if (estatus && estatus !== 'TODOS') {
      req.input('Estatus', estatus);
      whereClauses.push('l.EstatusEnvio = @Estatus');
    }
    if (busqueda) {
      req.input('Busqueda', `%${busqueda}%`);
      whereClauses.push('(c.NombreCompleto LIKE @Busqueda OR c.CodigoEmpleado LIKE @Busqueda OR l.Destinatario LIKE @Busqueda)');
    }

    const res = await req.query(`
      SELECT TOP 150
        l.IdLogAviso,
        l.IdColaborador,
        c.CodigoEmpleado,
        c.NombreCompleto AS ColaboradorNombre,
        c.Empresa,
        l.Periodo,
        l.TipoAviso,
        l.DiasRestantesAlerta,
        CONVERT(VARCHAR(19), l.FechaEnvio, 120) AS FechaEnvio,
        l.Destinatario,
        l.EstatusEnvio
      FROM dbo.LogAvisosVigenciaEnviados l
      JOIN dbo.Colaboradores c ON c.IdColaborador = l.IdColaborador
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY l.FechaEnvio DESC;
    `);

    return {
      success: true,
      total: res.recordset.length,
      data: res.recordset
    };
  },

  /**
   * Envía un correo con cada uno de los 4 tipos de avisos (muestras de prueba)
   */
  enviarMuestrasPrueba: async ({
    destinatario = 'audiox30@hotmail.com',
    copiasCC = 'soporte@grupojama.com',
    idColaborador = 1
  } = {}) => {
    const pool = await getLocalPool();
    const transportador = crearTransportadorSmtp();

    let colaborador = {
      IdColaborador: 1,
      NombreCompleto: 'ROCIO IMELDA GONZALEZ SALAS',
      CodigoEmpleado: '0102',
      Empresa: 'Controladora JAMA',
      Puesto: 'GERENTE DE TESORERIA'
    };

    if (pool && !isUsingMock()) {
      try {
        const colRes = await pool.request()
          .input('IdColaborador', idColaborador)
          .query(`
            SELECT TOP 1 c.IdColaborador, c.CodigoEmpleado, c.NombreCompleto, c.Empresa, ISNULL(p.Nombre, 'General') AS Puesto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            WHERE c.IdColaborador = @IdColaborador
          `);
        if (colRes.recordset && colRes.recordset.length > 0) {
          colaborador = colRes.recordset[0];
        }
      } catch (err) {
        console.warn('[vigenciaAlertasService] Usando colaborador fallback para muestras:', err.message);
      }
    }

    const muestras = [
      {
        tipoAviso: 'ANIVERSARIO_NUEVO',
        periodo: '2025 - 2026',
        antiguedadCumplida: 4,
        diasCorrespondientes: 18,
        diasPendientes: 18,
        fechaAniversario: '15/10/2025',
        fechaFinVigencia: '15/04/2027',
        diasRestantesVigencia: 548,
        asunto: `🎉 [MUESTRA 1/4] ¡Feliz Aniversario Laboral en Grupo JAMA! • ${colaborador.NombreCompleto} (Ciclo 2025 - 2026)`
      },
      {
        tipoAviso: 'ALERTA_12_MESES',
        periodo: '2024 - 2025',
        antiguedadCumplida: 3,
        diasCorrespondientes: 16,
        diasPendientes: 12,
        fechaAniversario: '15/10/2024',
        fechaFinVigencia: '15/04/2026',
        diasRestantesVigencia: 180,
        asunto: `⏳ [MUESTRA 2/4] Aviso Preventivo de Vacaciones (12 Meses Cumplidos) • ${colaborador.NombreCompleto} (Ciclo 2024 - 2025)`
      },
      {
        tipoAviso: 'ALERTA_15_MESES',
        periodo: '2024 - 2025',
        antiguedadCumplida: 3,
        diasCorrespondientes: 16,
        diasPendientes: 8,
        fechaAniversario: '15/10/2024',
        fechaFinVigencia: '15/04/2026',
        diasRestantesVigencia: 90,
        asunto: `⚠️ [MUESTRA 3/4] Alerta Preventiva Urgente de Vacaciones (15 Meses) • ${colaborador.NombreCompleto} (Ciclo 2024 - 2025)`
      },
      {
        tipoAviso: 'CADUCIDAD_18_MESES',
        periodo: '2024 - 2025',
        antiguedadCumplida: 3,
        diasCorrespondientes: 16,
        diasPendientes: 4,
        fechaAniversario: '15/10/2024',
        fechaFinVigencia: '15/04/2026',
        diasRestantesVigencia: 0,
        asunto: `🛑 [MUESTRA 4/4] Conclusión de Vigencia Legal de Vacaciones (18 Meses LFT) • ${colaborador.NombreCompleto} (Ciclo 2024 - 2025)`
      }
    ];

    const resultados = [];

    for (const m of muestras) {
      const htmlContent = generarHtmlCorreoAviso({
        tipoAviso: m.tipoAviso,
        nombreColaborador: colaborador.NombreCompleto,
        codigoEmpleado: colaborador.CodigoEmpleado,
        empresa: colaborador.Empresa,
        puesto: colaborador.Puesto,
        periodo: m.periodo,
        antiguedadCumplida: m.antiguedadCumplida,
        diasCorrespondientes: m.diasCorrespondientes,
        diasPendientes: m.diasPendientes,
        fechaAniversario: m.fechaAniversario,
        fechaFinVigencia: m.fechaFinVigencia,
        diasRestantesVigencia: m.diasRestantesVigencia
      });

      let estatus = 'ENVIADO';
      let errorMsg = null;
      let messageId = null;

      try {
        const info = await transportador.sendMail({
          from: `"Control de Vacaciones Grupo JAMA" <comprobante.fiscal@grupojamacfdi.com>`,
          to: destinatario,
          ...(copiasCC ? { cc: copiasCC } : {}),
          subject: m.asunto,
          html: htmlContent
        });
        messageId = info.messageId;
        console.log(`[vigenciaAlertasService] Muestra ${m.tipoAviso} enviada con éxito a ${destinatario}:`, messageId);
      } catch (sendErr) {
        estatus = 'ERROR';
        errorMsg = sendErr.message;
        console.error(`[vigenciaAlertasService] Error enviando muestra ${m.tipoAviso}:`, sendErr.message);
      }

      // Registrar en dbo.LogAvisosVigenciaEnviados
      if (pool && !isUsingMock()) {
        try {
          await pool.request()
            .input('IdColaborador', colaborador.IdColaborador)
            .input('Periodo', m.periodo)
            .input('TipoAviso', m.tipoAviso)
            .input('DiasRestantesAlerta', Math.max(0, m.diasRestantesVigencia))
            .input('Destinatario', `${destinatario}${copiasCC ? ` [CC: ${copiasCC}]` : ''}`)
            .input('EstatusEnvio', estatus)
            .query(`
              INSERT INTO dbo.LogAvisosVigenciaEnviados (
                IdColaborador, Periodo, TipoAviso, DiasRestantesAlerta, FechaEnvio, Destinatario, EstatusEnvio
              ) VALUES (
                @IdColaborador, @Periodo, @TipoAviso, @DiasRestantesAlerta, SYSDATETIME(), @Destinatario, @EstatusEnvio
              );
            `);
        } catch (dbErr) {
          console.error('[vigenciaAlertasService] Error guardando log en BD:', dbErr.message);
        }
      }

      resultados.push({
        tipoAviso: m.tipoAviso,
        asunto: m.asunto,
        destinatario,
        cc: copiasCC,
        estatus,
        messageId,
        error: errorMsg
      });
    }

    return {
      success: true,
      mensaje: `Se procesaron las 4 muestras de avisos institucionales para ${destinatario}`,
      total: resultados.length,
      enviados: resultados.filter(r => r.estatus === 'ENVIADO').length,
      fallidos: resultados.filter(r => r.estatus === 'ERROR').length,
      resultados
    };
  },

  generarHtmlCorreoAviso
};

module.exports = vigenciaAlertasService;
