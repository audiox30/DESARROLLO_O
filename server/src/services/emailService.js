const nodemailer = require('nodemailer');
const { getPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');

/**
 * Servicio de Envío de Notificaciones por Correo Electrónico (SMTP)
 * Motor exclusivo para el flujo operativo de vacaciones en Grupo JAMA.
 */

// Función creadora de transportador Nodemailer adaptada para Relay local (sin TLS forzado)
const crearTransportadorSmtp = (configBd = null) => {
  // Tomar valores de variables de entorno (.env) o de BD
  const host = process.env.SMTP_HOST || configBd?.host || '192.168.20.16';
  const port = parseInt(process.env.SMTP_PORT || configBd?.port || '25', 10);
  const isSecure = process.env.SMTP_SECURE === 'true' || configBd?.secure === true || configBd?.secure === 'true' || port === 465;

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: isSecure, // Obligatorio false para puerto 25 o relay local
    requireTLS: false, // Evita forzar STARTTLS
    ignoreTLS: !isSecure, // Crucial: desactiva STARTTLS si no es SSL directo para prevenir error 421 TLS is not supported
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // Si no hay usuario y contraseña, omitir auth para permitir relay anónimo por IP
    ...(configBd?.user && configBd?.pass ? {
      auth: {
        user: configBd.user,
        pass: configBd.pass
      }
    } : (process.env.SMTP_USER && process.env.SMTP_PASS ? {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    } : {}))
  });
};

let cachedConfig = null;
let lastCacheTime = 0;

async function obtenerConfiguracionEmail() {
  const now = Date.now();
  if (cachedConfig && (now - lastCacheTime < 30000)) {
    return cachedConfig;
  }
  try {
    const pool = await getPool();
    if (pool && !isUsingMock()) {
      const res = await pool.request().query("SELECT Clave, Valor FROM dbo.ConfiguracionSistema WHERE Categoria = 'EMAIL'");
      if (res.recordset && res.recordset.length > 0) {
        const map = {};
        res.recordset.forEach(r => { map[r.Clave] = r.Valor; });
        cachedConfig = {
          host: process.env.SMTP_HOST || map['SMTP_HOST'] || '192.168.20.16',
          port: parseInt(process.env.SMTP_PORT || map['SMTP_PORT'] || '25', 10),
          user: process.env.SMTP_USER !== undefined && process.env.SMTP_USER !== '' ? process.env.SMTP_USER : (map['SMTP_USER'] || ''),
          pass: process.env.SMTP_PASS !== undefined && process.env.SMTP_PASS !== '' ? process.env.SMTP_PASS : (map['SMTP_PASS'] || ''),
          secure: process.env.SMTP_SECURE === 'true' || map['SMTP_SECURE'] === 'true',
          fromName: map['SMTP_FROM_NAME'] || 'Control de Vacaciones Grupo JAMA',
          from: process.env.SMTP_FROM || `${map['SMTP_FROM_NAME'] || 'Control de Vacaciones Grupo JAMA'} <${map['SMTP_USER'] || 'comprobante.fiscal@grupojama.com'}>`,
          enabled: map['SMTP_NOTIF_ENABLED'] !== 'false'
        };
        lastCacheTime = now;
        return cachedConfig;
      }
    }
  } catch (err) {
    console.warn('[NOTIFICACIONES EMAIL] No se pudo leer dbo.ConfiguracionSistema, usando fallback:', err.message);
  }

  cachedConfig = {
    host: process.env.SMTP_HOST || '192.168.20.16',
    port: parseInt(process.env.SMTP_PORT || '25', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
    fromName: process.env.SMTP_FROM_NAME || 'Control de Vacaciones Grupo JAMA',
    from: process.env.SMTP_FROM || 'Control de Vacaciones Grupo JAMA <comprobante.fiscal@grupojama.com>',
    enabled: true
  };
  lastCacheTime = now;
  return cachedConfig;
}

// Instancia o generador de transporte Nodemailer
async function getTransporter() {
  const config = await obtenerConfiguracionEmail();
  if (!config || !config.enabled) {
    return null;
  }
  return crearTransportadorSmtp(config);
}

/**
 * Formateo estándar de fechas a DD/MM/AAAA
 */
function formatFecha(fechaStr) {
  if (!fechaStr) return '—';
  try {
    const s = String(fechaStr).substring(0, 10);
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const dObj = new Date(fechaStr);
    return isNaN(dObj.getTime()) ? String(fechaStr) : dObj.toLocaleDateString('es-MX');
  } catch (e) {
    return String(fechaStr);
  }
}

/**
 * Plantilla Base HTML con identidad corporativa de Grupo JAMA
 */
function generarPlantillaHtml({ titulo, badgeTexto, badgeColor, badgeBg, badgeBorder, cuerpoHtml, ctaTexto, ctaUrl }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  const finalCtaUrl = ctaUrl.startsWith('http') ? ctaUrl : `${appUrl}${ctaUrl}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9; padding:24px 0;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal de la Tarjeta -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Encabezado Corporativo Grupo JAMA -->
          <tr>
            <td style="background-color:#0f2744; padding:26px 32px; border-bottom:4px solid #d97706; text-align:left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="color:#ffffff; font-size:20px; font-weight:900; letter-spacing:1px; display:block; text-transform:uppercase;">
                      GRUPO JAMA
                    </span>
                    <span style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-top:2px;">
                      Desarrollo Organizacional • Control de Vacaciones
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <!-- Badge de Estado -->
              <div style="margin-bottom:16px;">
                <span style="display:inline-block; padding:4px 12px; font-size:11px; font-weight:800; border-radius:9999px; text-transform:uppercase; letter-spacing:0.5px; color:${badgeColor}; background-color:${badgeBg}; border:1px solid ${badgeBorder};">
                  ${badgeTexto}
                </span>
              </div>

              <!-- Título del Mensaje -->
              <h1 style="color:#0f172a; font-size:20px; font-weight:800; margin:0 0 16px 0; line-height:1.3;">
                ${titulo}
              </h1>

              <!-- Contenido Dinámico -->
              <div style="color:#334155; font-size:14px; line-height:1.6;">
                ${cuerpoHtml}
              </div>

              <!-- Botón de Llamado a la Acción (CTA) -->
              ${ctaTexto && finalCtaUrl ? `
                <div style="margin:28px 0 12px 0; text-align:center;">
                  <a href="${finalCtaUrl}" target="_blank" style="display:inline-block; background-color:#1d4ed8; color:#ffffff; font-weight:bold; font-size:13px; text-decoration:none; padding:12px 28px; border-radius:10px; box-shadow:0 2px 4px rgba(29, 78, 216, 0.2); letter-spacing:0.3px;">
                    ${ctaTexto} &rarr;
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Pie de Página Institucional -->
          <tr>
            <td style="background-color:#f8fafc; padding:20px 32px; border-top:1px solid #e2e8f0; text-align:center;">
              <p style="margin:0 0 6px 0; font-size:11px; color:#64748b; line-height:1.4;">
                Este es un mensaje institucional automatizado generado por el <strong>Sistema de Control de Vacaciones</strong> de Grupo JAMA.
              </p>
              <p style="margin:0; font-size:11px; color:#94a3b8;">
                Por favor, no respondas a este correo. Para dudas o aclaraciones, contacta al departamento de Desarrollo Organizacional.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Función genérica de despacho de correo con salvaguardas y logs desacoplados
 * Incluye soporte nativo para Modo de Auditoría / Sandboxing (Redirección a soporte@grupojama.com)
 */
async function enviarEmail({ to, subject, html }) {
  const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
  const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();

  let destinatarioOriginal = (to && typeof to === 'string') ? to.trim() : '';
  if (!destinatarioOriginal && modoAuditoria) {
    destinatarioOriginal = 'colaborador.previsto@grupojama.com';
  }

  if (!destinatarioOriginal || !destinatarioOriginal.includes('@')) {
    console.warn(`[NOTIFICACIONES EMAIL] Omitido: Destinatario con correo inválido o no registrado ('${to}').`);
    return { skipped: true, reason: 'EMAIL_NO_VALIDO' };
  }

  const destinatarioFinal = modoAuditoria ? correoAuditoria : destinatarioOriginal;

  const config = await obtenerConfiguracionEmail();
  if (!config || !config.enabled) {
    console.log(`[NOTIFICACIONES EMAIL] Notificaciones deshabilitadas en configuración del sistema.`);
    return { skipped: true, reason: 'NOTIFICACIONES_DESHABILITADAS' };
  }

  const transporter = await getTransporter();
  const rawFrom = config.from || process.env.SMTP_FROM || 'Control de Vacaciones Grupo JAMA <comprobante.fiscal@grupojama.com>';
  const from = rawFrom.replace(/^["']|["']$/g, '');

  if (!transporter) {
    console.warn(`[NOTIFICACIONES EMAIL] SMTP no configurado (SMTP_HOST vacío). Simulación de envío:`);
    console.warn(` -> Para: ${destinatarioFinal} ${modoAuditoria ? `(Destinatario original previsto: ${destinatarioOriginal})` : ''}`);
    console.warn(` -> Asunto: ${subject}`);
    return { simulated: true, to: destinatarioFinal, destinatarioOriginal, subject };
  }

  // Inyección del Banner Superior de Auditoría si el modo sandbox está activo
  let htmlFinal = html || '';
  if (modoAuditoria) {
    const bannerHtml = `
              <!-- BANNER MODO AUDITORIA / SANDBOXING -->
              <div style="background-color:#fffbeb; border:1px solid #fde68a; border-left:4px solid #d97706; padding:12px 16px; margin:0 0 20px 0; border-radius:10px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; color:#92400e; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                <div style="font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#b45309; margin-bottom:4px;">
                  ⚠️ Modo Auditoría / Sandbox de Pruebas
                </div>
                <div>
                  [Modo Auditoría - Destinatario original previsto: <code style="background-color:#fef3c7; padding:2px 6px; border-radius:4px; font-weight:bold; color:#78350f; font-size:12px; font-family:monospace;">${destinatarioOriginal}</code>]
                </div>
              </div>
    `;

    if (htmlFinal.includes('<!-- Badge de Estado -->')) {
      htmlFinal = htmlFinal.replace('<!-- Badge de Estado -->', `${bannerHtml}\n              <!-- Badge de Estado -->`);
    } else if (htmlFinal.includes('<body')) {
      htmlFinal = htmlFinal.replace(/(<body[^>]*>)/i, `$1\n<div style="max-width:600px; margin:10px auto; padding:0 16px;">${bannerHtml}</div>`);
    } else {
      htmlFinal = `${bannerHtml}\n${htmlFinal}`;
    }

    console.log(`[NOTIFICACIONES EMAIL] [Modo Auditoría ACTIVO] Redirigiendo correo previsto para '${destinatarioOriginal}' -> '${destinatarioFinal}'`);
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: destinatarioFinal,
      subject,
      html: htmlFinal
    });
    console.log(`[NOTIFICACIONES EMAIL] Enviado con éxito a: ${destinatarioFinal} ${modoAuditoria ? `(Original: ${destinatarioOriginal})` : ''} (ID: ${info.messageId}) - Asunto: ${subject}`);
    return { success: true, messageId: info.messageId, destinatarioFinal, destinatarioOriginal, modoAuditoria };
  } catch (err) {
    console.error(`[NOTIFICACIONES EMAIL] Error al enviar correo a ${destinatarioFinal}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Consulta de metadatos completos de una solicitud para notificaciones
 */
async function obtenerDatosSolicitud(idSolicitud) {
  const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);

  try {
    const pool = await getPool();

    if (!pool || isUsingMock()) {
      const s = mockStore.solicitudes.find(x => x.idSolicitud === Number(idSolicitud));
      if (!s) return null;
      const colab = mockStore.colaboradores.find(c => c.idColaborador === s.idColaborador || c.id === s.idColaborador);
      const idJefe = colab ? (colab.idJefeDirecto || colab.idJefe) : null;
      const jefe = idJefe 
        ? mockStore.colaboradores.find(c => c.idColaborador === idJefe || c.id === idJefe) 
        : null;

      const idSegundo = colab ? (colab.idAprobadorSegundo || colab.IdAprobadorSegundo) : null;
      const segundoAprobador = idSegundo
        ? mockStore.colaboradores.find(c => c.idColaborador === idSegundo || c.id === idSegundo)
        : null;

      const saldoDisponible = colab 
        ? (colab.diasDisponibles !== undefined 
            ? colab.diasDisponibles 
            : (colab.saldos || []).reduce((acc, curr) => acc + (curr.diasPendientes || 0), 0))
        : 0;

      const colabEmail = colab ? (colab.emailCorporativo || colab.email) : '';
      const emailColaboradorDestino = (colabEmail && colabEmail.trim()) ? colabEmail.trim() : (modoAuditoria ? 'colaborador.previsto@grupojama.com' : '');

      const jefeEmail = jefe ? (jefe.emailCorporativo || jefe.email) : '';
      const emailJefeDestino = (jefeEmail && jefeEmail.trim()) ? jefeEmail.trim() : (modoAuditoria ? 'lider.previsto@grupojama.com' : '');

      const segundoEmail = segundoAprobador ? (segundoAprobador.emailCorporativo || segundoAprobador.email) : '';
      const emailSegundoDestino = (segundoEmail && segundoEmail.trim()) ? segundoEmail.trim() : (modoAuditoria ? 'gerente.previsto@grupojama.com' : '');

      return {
        idSolicitud: s.idSolicitud,
        folio: s.folio,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        totalDiasLaborables: Number(s.totalDiasLaborables || 0),
        motivoComentarios: s.motivoComentarios || '',
        estado: s.estado,
        motivoRechazo: s.motivoRechazo || '',
        colaborador: {
          id: colab ? colab.idColaborador : s.idColaborador,
          nombre: colab ? colab.nombreCompleto : (s.colaboradorNombre || 'Colaborador Solicitante'),
          codigo: colab ? colab.codigoEmpleado : '',
          email: emailColaboradorDestino,
          emailPersonal: colab ? colab.email : '',
          emailCorporativo: colab ? colab.emailCorporativo : '',
          puesto: colab ? colab.puesto : (s.colaboradorPuesto || '—'),
          empresa: colab ? colab.empresa : (s.colaboradorEmpresa || 'Grupo JAMA'),
          sucursal: colab ? colab.sucursal : 'Matriz'
        },
        jefe: (jefe || modoAuditoria) ? {
          id: jefe ? jefe.idColaborador : 999999,
          nombre: jefe ? jefe.nombreCompleto : 'Líder Operativo Previsto',
          email: emailJefeDestino
        } : null,
        segundoAprobador: (segundoAprobador || (modoAuditoria && s.estado === 'PENDIENTE_GERENTE')) ? {
          id: segundoAprobador ? (segundoAprobador.idColaborador || segundoAprobador.id) : 999998,
          nombre: segundoAprobador ? segundoAprobador.nombreCompleto : 'Gerencia General Prevista',
          email: emailSegundoDestino
        } : null,
        saldoDisponible: Number(saldoDisponible)
      };
    }

    const res = await pool.request()
      .input('IdSolicitud', idSolicitud)
      .query(`
        SELECT 
          s.IdSolicitud,
          s.Folio,
          CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
          CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
          s.TotalDiasLaborables,
          s.MotivoComentarios,
          s.Estado,
          s.MotivoRechazo,
          -- Colaborador
          c.IdColaborador,
          c.CodigoEmpleado,
          c.NombreCompleto AS ColaboradorNombre,
          c.Email AS ColaboradorEmail,
          c.EmailCorporativo AS ColaboradorEmailCorporativo,
          c.Empresa AS ColaboradorEmpresa,
          c.Sucursal AS ColaboradorSucursal,
          p.Nombre AS ColaboradorPuesto,
          d.Nombre AS ColaboradorDepartamento,
          -- Saldo disponible actual
          ISNULL((
              SELECT SUM(DiasPendientes) 
              FROM dbo.SaldosVacaciones 
              WHERE IdColaborador = c.IdColaborador AND EsCerrado = 0
          ), 0.0) AS SaldoDisponible,
          -- Jefe Directo
          j.IdColaborador AS IdJefeDirecto,
          j.NombreCompleto AS JefeNombre,
          j.Email AS JefeEmail,
          j.EmailCorporativo AS JefeEmailCorporativo,
          -- Segundo Aprobador (Gerente)
          j2.IdColaborador AS IdAprobadorSegundo,
          j2.NombreCompleto AS SegundoAprobadorNombre,
          j2.Email AS SegundoAprobadorEmail,
          j2.EmailCorporativo AS SegundoAprobadorEmailCorporativo
        FROM dbo.SolicitudesVacaciones s
        JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
        LEFT JOIN dbo.Colaboradores j2 ON j2.IdColaborador = ISNULL(s.IdAprobadorSegundo, c.IdAprobadorSegundo)
        WHERE s.IdSolicitud = @IdSolicitud
      `);

    const row = res.recordset[0];
    if (!row) return null;

    // Destinatarios con preferencia a EmailCorporativo y fallback a Email nómina o dirección simulada de auditoría
    const emailColaboradorDestino = (row.ColaboradorEmailCorporativo && row.ColaboradorEmailCorporativo.trim())
      ? row.ColaboradorEmailCorporativo.trim()
      : (row.ColaboradorEmail && row.ColaboradorEmail.trim() ? row.ColaboradorEmail.trim() : (modoAuditoria ? 'colaborador.previsto@grupojama.com' : ''));

    const emailJefeDestino = (row.JefeEmailCorporativo && row.JefeEmailCorporativo.trim())
      ? row.JefeEmailCorporativo.trim()
      : (row.JefeEmail && row.JefeEmail.trim() ? row.JefeEmail.trim() : (modoAuditoria ? 'lider.previsto@grupojama.com' : ''));

    const emailSegundoDestino = (row.SegundoAprobadorEmailCorporativo && row.SegundoAprobadorEmailCorporativo.trim())
      ? row.SegundoAprobadorEmailCorporativo.trim()
      : (row.SegundoAprobadorEmail && row.SegundoAprobadorEmail.trim() ? row.SegundoAprobadorEmail.trim() : (modoAuditoria ? 'gerente.previsto@grupojama.com' : ''));

    return {
      idSolicitud: row.IdSolicitud,
      folio: row.Folio,
      fechaInicio: row.FechaInicio,
      fechaFin: row.FechaFin,
      totalDiasLaborables: Number(row.TotalDiasLaborables),
      motivoComentarios: row.MotivoComentarios || '',
      estado: row.Estado,
      motivoRechazo: row.MotivoRechazo || '',
      colaborador: {
        id: row.IdColaborador,
        nombre: row.ColaboradorNombre,
        codigo: row.CodigoEmpleado,
        email: emailColaboradorDestino,
        emailPersonal: row.ColaboradorEmail,
        emailCorporativo: row.ColaboradorEmailCorporativo,
        puesto: row.ColaboradorPuesto || '—',
        empresa: row.ColaboradorEmpresa || 'Grupo JAMA',
        sucursal: row.ColaboradorSucursal || 'Matriz',
        departamento: row.ColaboradorDepartamento || 'General'
      },
      jefe: (row.IdJefeDirecto || modoAuditoria) ? {
        id: row.IdJefeDirecto || 999999,
        nombre: row.JefeNombre || 'Líder Operativo Previsto',
        email: emailJefeDestino
      } : null,
      segundoAprobador: (row.IdAprobadorSegundo || (modoAuditoria && row.Estado === 'PENDIENTE_GERENTE')) ? {
        id: row.IdAprobadorSegundo || 999998,
        nombre: row.SegundoAprobadorNombre || 'Gerencia General Prevista',
        email: emailSegundoDestino
      } : null,
      saldoDisponible: Number(row.SaldoDisponible)
    };
  } catch (err) {
    console.error(`[NOTIFICACIONES EMAIL] Error consultando solicitud ${idSolicitud}:`, err.message);
    return null;
  }
}

const emailService = {
  /**
   * Evento A: Nueva Solicitud Creada por Colaborador
   * Destinatario: Jefe Directo (Líder asignado)
   */
  notificarNuevaSolicitud: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, folio, fechaInicio, fechaFin, totalDiasLaborables, saldoDisponible, motivoComentarios } = data;
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const emailJefe = (jefe && jefe.email) ? jefe.email : (modoAuditoria ? 'lider.previsto@grupojama.com' : null);

      if (!emailJefe) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento A omitido: El colaborador '${colaborador.nombre}' no tiene jefe directo asignado o el jefe carece de correo.`);
        return;
      }

      const nombreJefe = (jefe && jefe.nombre) ? jefe.nombre : 'Líder Operativo';
      const saldoRestanteEstimado = Math.max(0, saldoDisponible - totalDiasLaborables);
      const asunto = `[Vacaciones Grupo JAMA] Nueva solicitud pendiente de aprobación - ${colaborador.nombre}`;

      const cuerpoHtml = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${nombreJefe}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          Se ha recibido una nueva solicitud de vacaciones en tu equipo que requiere tu revisión y autorización:
        </p>

        <!-- Tabla de Datos del Colaborador y Período -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Colaborador:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">${colaborador.nombre}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">No. Nómina:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-mono font-bold;">${colaborador.codigo}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Puesto / Depto:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.puesto}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Empresa / Sucursal:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.empresa} (${colaborador.sucursal})</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Folio Solicitud:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#1d4ed8; font-size:13px; font-weight:bold;">${folio}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Fechas Solicitadas:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
              Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Hábiles a Descontar:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
              ${totalDiasLaborables} días <span style="font-size:11px; font-weight:normal; color:#64748b;">(Jornada Lunes a Sábado)</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Saldo Restante Estimado:</td>
            <td style="padding:10px 14px; color:#059669; font-size:13px; font-weight:bold;">
              ${saldoRestanteEstimado.toFixed(1)} días disponibles
            </td>
          </tr>
        </table>

        ${motivoComentarios ? `
          <div style="background-color:#f1f5f9; border-left:4px solid #3b82f6; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
            <strong>Comentarios del solicitante:</strong> "${motivoComentarios}"
          </div>
        ` : ''}

        <p style="margin:16px 0 0 0;">
          Por favor ingresa a la plataforma para autorizar o declinar esta solicitud según las necesidades operativas del área.
        </p>
      `;

      const html = generarPlantillaHtml({
        titulo: 'Nueva Solicitud Pendiente de Aprobación',
        badgeTexto: 'Pendiente de Aprobación',
        badgeColor: '#1e40af',
        badgeBg: '#eff6ff',
        badgeBorder: '#bfdbfe',
        cuerpoHtml,
        ctaTexto: 'Revisar en Bandeja del Líder',
        ctaUrl: '/lider/aprobaciones'
      });

      await enviarEmail({ to: emailJefe, subject: asunto, html });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarNuevaSolicitud:', err.message);
    }
  },

  /**
   * Evento: VoBo Nivel 1 Otorgado - Pendiente de Autorización Gerencial (Nivel 2)
   * Destinatario: Segundo Aprobador (Gerente de Sucursal / Planta)
   */
  notificarSolicitudPendienteGerente: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, segundoAprobador, folio, fechaInicio, fechaFin, totalDiasLaborables, saldoDisponible, motivoComentarios } = data;
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const emailSegundo = (segundoAprobador && segundoAprobador.email) ? segundoAprobador.email : (modoAuditoria ? 'gerente.previsto@grupojama.com' : null);

      if (!emailSegundo) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento Pendiente Gerente omitido: El colaborador '${colaborador.nombre}' no tiene segundo aprobador asignado o carece de correo.`);
        return;
      }

      const nombreSegundo = (segundoAprobador && segundoAprobador.nombre) ? segundoAprobador.nombre : 'Gerencia General';
      const saldoRestanteEstimado = Math.max(0, saldoDisponible - totalDiasLaborables);
      const asunto = `[Vacaciones Grupo JAMA] Solicitud pendiente de autorización gerencial (Nivel 2) - ${colaborador.nombre}`;

      const cuerpoHtml = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${nombreSegundo}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          Te informamos que la solicitud de vacaciones con folio <strong style="color:#1d4ed8;">${folio}</strong> correspondiente al colaborador <strong>${colaborador.nombre}</strong> ha recibido el <strong>Visto Bueno de Nivel 1</strong> por su jefe directo (${jefe ? jefe.nombre : 'Líder Operativo'}) y ahora requiere tu <strong>autorización gerencial definitiva (Nivel 2)</strong>:
        </p>

        <!-- Tabla de Datos del Colaborador y Período -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Colaborador:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">${colaborador.nombre}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">No. Nómina:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-mono font-bold;">${colaborador.codigo}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Puesto / Depto:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.puesto} (${colaborador.departamento})</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Empresa / Sucursal:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.empresa} (${colaborador.sucursal})</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Visto Bueno Nivel 1:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#059669; font-size:12px; font-weight:bold;">Otorgado por ${jefe ? jefe.nombre : 'Líder Operativo'}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Fechas Solicitadas:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
              Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Hábiles a Descontar:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
              ${totalDiasLaborables} días <span style="font-size:11px; font-weight:normal; color:#64748b;">(Jornada Lunes a Sábado)</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Saldo Restante Estimado:</td>
            <td style="padding:10px 14px; color:#059669; font-size:13px; font-weight:bold;">
              ${saldoRestanteEstimado.toFixed(1)} días disponibles
            </td>
          </tr>
        </table>

        ${motivoComentarios ? `
          <div style="background-color:#f1f5f9; border-left:4px solid #3b82f6; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
            <strong>Comentarios del solicitante:</strong> "${motivoComentarios}"
          </div>
        ` : ''}

        <p style="margin:16px 0 0 0;">
          Por favor ingresa a tu bandeja de autorizaciones para emitir la resolución final de esta solicitud.
        </p>
      `;

      const html = generarPlantillaHtml({
        titulo: 'Solicitud Pendiente de Autorización Gerencial (Nivel 2)',
        badgeTexto: 'Nivel 2: Autorización Gerencial',
        badgeColor: '#4338ca',
        badgeBg: '#eef2ff',
        badgeBorder: '#c7d2fe',
        cuerpoHtml,
        ctaTexto: 'Revisar en Bandeja de Aprobaciones',
        ctaUrl: '/lider/aprobaciones'
      });

      await enviarEmail({ to: emailSegundo, subject: asunto, html });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudPendienteGerente:', err.message);
    }
  },

  /**
   * Evento B: Solicitud Aprobada por el Líder
   * Destinatario: Colaborador solicitante
   */
  notificarSolicitudAprobada: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, folio, fechaInicio, fechaFin, totalDiasLaborables, saldoDisponible } = data;
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const emailColab = (colaborador && colaborador.email) ? colaborador.email : (modoAuditoria ? 'colaborador.previsto@grupojama.com' : null);

      if (!emailColab) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento B omitido: El colaborador '${colaborador.nombre}' no tiene correo registrado.`);
        return;
      }

      const asunto = `[Vacaciones Grupo JAMA] ¡Tu solicitud de vacaciones ha sido aprobada!`;

      const cuerpoHtml = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${colaborador.nombre}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          ¡Buenas noticias! Tu solicitud de vacaciones con folio <strong style="color:#1d4ed8;">${folio}</strong> ha sido <strong>autorizada con éxito</strong> por tu jefe directo (${jefe ? jefe.nombre : 'tu líder'}).
        </p>

        <!-- Resumen del Período Autorizado -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; margin:16px 0; overflow:hidden;">
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600; width:35%;">Período Autorizado:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">
              Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600;">Días Disfrutados:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">
              ${totalDiasLaborables} días hábiles
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; color:#065f46; font-size:12px; font-weight:600;">Saldo Disponible Actualizado:</td>
            <td style="padding:10px 14px; color:#047857; font-size:14px; font-weight:900;">
              ${saldoDisponible.toFixed(1)} días
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0 0;">
          El período ha quedado reservado formalmente en el calendario oficial de Grupo JAMA. Puedes consultar el comprobante en tu portal.
        </p>
      `;

      const html = generarPlantillaHtml({
        titulo: '¡Tu Solicitud de Vacaciones fue Aprobada!',
        badgeTexto: 'Aprobada / Autorizada',
        badgeColor: '#065f46',
        badgeBg: '#ecfdf5',
        badgeBorder: '#a7f3d0',
        cuerpoHtml,
        ctaTexto: 'Ver Mi Portal de Vacaciones',
        ctaUrl: '/portal'
      });

      await enviarEmail({ to: emailColab, subject: asunto, html });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudAprobada:', err.message);
    }
  },

  /**
   * Evento C: Solicitud Rechazada por el Líder
   * Destinatario: Colaborador solicitante
   */
  notificarSolicitudRechazada: async (idSolicitud, motivoCapturado = '') => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, folio, fechaInicio, fechaFin, totalDiasLaborables, motivoRechazo } = data;
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const emailColab = (colaborador && colaborador.email) ? colaborador.email : (modoAuditoria ? 'colaborador.previsto@grupojama.com' : null);

      if (!emailColab) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento C omitido: El colaborador '${colaborador.nombre}' no tiene correo registrado.`);
        return;
      }

      const motivoFinal = motivoCapturado || motivoRechazo || 'Rechazada según criterios operativos de la jefatura directa.';
      const asunto = `[Vacaciones Grupo JAMA] Solicitud de vacaciones no autorizada`;

      const cuerpoHtml = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${colaborador.nombre}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          Te informamos que tu solicitud de vacaciones con folio <strong style="color:#0f172a;">${folio}</strong> para el período del <strong>${formatFecha(fechaInicio)}</strong> al <strong>${formatFecha(fechaFin)}</strong> (${totalDiasLaborables} días) <strong>no ha sido autorizada</strong> por tu jefe directo (${jefe ? jefe.nombre : 'tu líder'}).
        </p>

        <!-- Motivo de Rechazo -->
        <div style="background-color:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; padding:14px; border-radius:8px; margin:20px 0;">
          <span style="display:block; font-size:11px; font-weight:bold; color:#991b1b; text-transform:uppercase; margin-bottom:4px;">
            Motivo de la resolución:
          </span>
          <span style="font-size:13px; color:#7f1d1d; font-weight:600;">
            "${motivoFinal}"
          </span>
        </div>

        <p style="margin:16px 0 0 0;">
          Los días correspondientes han sido liberados y continúan disponibles en tu saldo. Puedes ingresar a tu portal para acordar una nueva fecha con tu líder y registrar una nueva solicitud.
        </p>
      `;

      const html = generarPlantillaHtml({
        titulo: 'Solicitud de Vacaciones No Autorizada',
        badgeTexto: 'No Autorizada',
        badgeColor: '#991b1b',
        badgeBg: '#fef2f2',
        badgeBorder: '#fecaca',
        cuerpoHtml,
        ctaTexto: 'Acceder a Mi Portal',
        ctaUrl: '/portal'
      });

      await enviarEmail({ to: emailColab, subject: asunto, html });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudRechazada:', err.message);
    }
  },

  /**
   * Evento D: Cancelación por parte del Colaborador
   * Destinatario: Líder asignado
   */
  notificarSolicitudCancelada: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, folio, fechaInicio, fechaFin, totalDiasLaborables } = data;
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const emailJefe = (jefe && jefe.email) ? jefe.email : (modoAuditoria ? 'lider.previsto@grupojama.com' : null);

      if (!emailJefe) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento D omitido: El colaborador '${colaborador.nombre}' no tiene jefe directo con correo registrado.`);
        return;
      }

      const nombreJefe = (jefe && jefe.nombre) ? jefe.nombre : 'Líder Asignado';
      const asunto = `[Vacaciones Grupo JAMA] Solicitud cancelada por el colaborador - ${colaborador.nombre}`;

      const cuerpoHtml = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${nombreJefe}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          Te notificamos que el colaborador <strong>${colaborador.nombre}</strong> (Nómina: ${colaborador.codigo}) ha <strong>cancelado</strong> su solicitud de vacaciones previamente registrada:
        </p>

        <!-- Detalle de la Solicitud Cancelada -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Folio Cancelado:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">${folio}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período Descartado:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
              Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Días Liberados:</td>
            <td style="padding:10px 14px; color:#0f172a; font-size:13px; font-weight:bold;">
              ${totalDiasLaborables} días
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0 0;">
          Esta solicitud ya no se encuentra pendiente en tu bandeja de aprobación y los días en trámite han sido reintegrados al saldo disponible del colaborador.
        </p>
      `;

      const html = generarPlantillaHtml({
        titulo: 'Solicitud Cancelada por el Colaborador',
        badgeTexto: 'Cancelada',
        badgeColor: '#475569',
        badgeBg: '#f1f5f9',
        badgeBorder: '#cbd5e1',
        cuerpoHtml,
        ctaTexto: 'Revisar Bandeja del Líder',
        ctaUrl: '/lider/aprobaciones'
      });

      await enviarEmail({ to: emailJefe, subject: asunto, html });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudCancelada:', err.message);
    }
  },

  /**
   * Evento E: Conclusión y Validación por Desarrollo Organizacional (DO)
   * Destinatario: Colaborador solicitante
   */
  notificarConclusionDO: async (idSolicitud, accion = 'APROBAR', motivoFinal = '') => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, folio, fechaInicio, fechaFin, totalDiasLaborables, saldoDisponible } = data;
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const emailColab = (colaborador && colaborador.email) ? colaborador.email : (modoAuditoria ? 'colaborador.previsto@grupojama.com' : null);

      if (!emailColab) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento Conclusión DO omitido: El colaborador '${colaborador.nombre}' no tiene correo registrado.`);
        return;
      }

      const esAprobada = (accion || '').toUpperCase().trim() === 'APROBAR' || (accion || '').toUpperCase().trim() === 'APROBADA';
      const asunto = esAprobada
        ? `[Vacaciones Grupo JAMA] Solicitud concluida y registrada por DO - ${colaborador.nombre}`
        : `[Vacaciones Grupo JAMA] Solicitud no validada por Desarrollo Organizacional`;

      let cuerpoHtml = '';
      if (esAprobada) {
        cuerpoHtml = `
          <p style="margin:0 0 16px 0;">
            Estimado(a) <strong>${colaborador.nombre}</strong>,
          </p>
          <p style="margin:0 0 16px 0;">
            Te confirmamos que tu solicitud de vacaciones con folio <strong style="color:#1d4ed8;">${folio}</strong> ha sido <strong>revisada y concluida exitosamente por Desarrollo Organizacional</strong>. El período ha quedado formalmente registrado en el sistema de nómina y en el calendario institucional de ausencias.
          </p>

          <!-- Resumen del Período Autorizado por DO -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; margin:16px 0; overflow:hidden;">
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600; width:35%;">Folio Oficial:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">${folio}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600;">Período Autorizado:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">
                Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600;">Días Disfrutados:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">
                ${totalDiasLaborables} días hábiles
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px; color:#065f46; font-size:12px; font-weight:600;">Saldo Disponible Actualizado:</td>
              <td style="padding:10px 14px; color:#047857; font-size:14px; font-weight:900;">
                ${saldoDisponible.toFixed(1)} días
              </td>
            </tr>
          </table>

          ${motivoFinal ? `
            <div style="background-color:#f8fafc; border-left:4px solid #10b981; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
              <strong>Observaciones de Desarrollo Organizacional:</strong> "${motivoFinal}"
            </div>
          ` : ''}

          <p style="margin:16px 0 0 0;">
            Puedes consultar los detalles y descargar tu formato oficial FDO-84 firmado digitalmente desde tu Portal de Colaborador.
          </p>
        `;
      } else {
        cuerpoHtml = `
          <p style="margin:0 0 16px 0;">
            Estimado(a) <strong>${colaborador.nombre}</strong>,
          </p>
          <p style="margin:0 0 16px 0;">
            Te notificamos que la solicitud de vacaciones con folio <strong style="color:#0f172a;">${folio}</strong> para el período del <strong>${formatFecha(fechaInicio)}</strong> al <strong>${formatFecha(fechaFin)}</strong> (${totalDiasLaborables} días) <strong>no ha sido validada por el área de Desarrollo Organizacional</strong>.
          </p>

          <div style="background-color:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; padding:14px; border-radius:8px; margin:20px 0;">
            <span style="display:block; font-size:11px; font-weight:bold; color:#991b1b; text-transform:uppercase; margin-bottom:4px;">
              Motivo de la resolución de DO:
            </span>
            <span style="font-size:13px; color:#7f1d1d; font-weight:600;">
              "${motivoFinal || 'No cumple con las políticas y lineamientos institucionales de Grupo JAMA.'}"
            </span>
          </div>

          <p style="margin:16px 0 0 0;">
            Los días correspondientes han sido reintegrados a tu saldo disponible. Para cualquier aclaración, por favor contacta a Desarrollo Organizacional.
          </p>
        `;
      }

      const html = generarPlantillaHtml({
        titulo: esAprobada ? 'Validación y Conclusión Definitiva por DO' : 'Solicitud No Validada por DO',
        badgeTexto: esAprobada ? 'Concluida / Validada por DO' : 'No Validada por DO',
        badgeColor: esAprobada ? '#065f46' : '#991b1b',
        badgeBg: esAprobada ? '#ecfdf5' : '#fef2f2',
        badgeBorder: esAprobada ? '#a7f3d0' : '#fecaca',
        cuerpoHtml,
        ctaTexto: 'Ver en Mi Portal',
        ctaUrl: '/portal'
      });

      await enviarEmail({ to: emailColab, subject: asunto, html });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarConclusionDO:', err.message);
    }
  }
};

emailService.crearTransportadorSmtp = crearTransportadorSmtp;
emailService.obtenerConfiguracionEmail = obtenerConfiguracionEmail;

module.exports = emailService;
