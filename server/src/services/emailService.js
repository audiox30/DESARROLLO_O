const nodemailer = require('nodemailer');
const { getPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');
const { generarPdfFdo84 } = require('./pdfFdo84Service');

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
          from: process.env.SMTP_FROM || `${map['SMTP_FROM_NAME'] || 'Control de Vacaciones Grupo JAMA'} <${map['SMTP_USER'] || 'comprobante.fiscal@grupojamacfdi.com'}>`,
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
    from: process.env.SMTP_FROM || 'Control de Vacaciones Grupo JAMA <comprobante.fiscal@grupojamacfdi.com>',
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
  const appUrl = process.env.APP_URL || 'http://localhost:5001';
  const finalCtaUrl = ctaUrl ? (ctaUrl.startsWith('http') ? ctaUrl : `${appUrl}${ctaUrl}`) : null;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin:0; padding:0; background-color:#F4F7F9; font-family:Arial, 'Segoe UI', Tahoma, sans-serif; -webkit-font-smoothing:antialiased; color:#333333;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F7F9; padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal (Max 600px, bordes redondeados sutiles 8px, borde delgado #002D62) -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #002D62; box-shadow:0 4px 12px rgba(0, 45, 98, 0.08);">
          
          <!-- Cabecera Institucional Azul Marino #002D62 con Logotipo Oficial Grupo JAMA -->
          <tr>
            <td style="background-color:#002D62; padding:28px 24px; text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="https://www.grupojama.com" target="_blank" style="text-decoration:none; display:inline-block;">
                      <img src="https://www.grupojama.com/img/logo.png" alt="Grupo JAMA" width="160" style="max-width: 160px; height: auto; display: block; margin: 0 auto;" border="0" />
                    </a>
                    <p style="margin:12px 0 0 0; color:#E2E8F0; font-size:12px; font-weight:600; letter-spacing:0.8px; text-transform:uppercase; font-family:Arial, 'Segoe UI', sans-serif;">
                      Control de Vacaciones • Sistema Corporativo
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal: Tarjeta Blanca Interior con padding de 24px -->
          <tr>
            <td style="background-color:#ffffff; padding:24px;">
              <!-- Badge de Estado -->
              ${badgeTexto ? `
                <div style="margin-bottom:16px;">
                  <span style="display:inline-block; padding:4px 12px; font-size:11px; font-weight:bold; border-radius:9999px; text-transform:uppercase; letter-spacing:0.5px; color:${badgeColor || '#002D62'}; background-color:${badgeBg || '#EEF2F6'}; border:1px solid ${badgeBorder || '#CBD5E1'}; font-family:Arial, 'Segoe UI', sans-serif;">
                    ${badgeTexto}
                  </span>
                </div>
              ` : ''}

              <!-- Título del Mensaje -->
              <h1 style="color:#002D62; font-size:19px; font-weight:bold; margin:0 0 16px 0; line-height:1.35; font-family:Arial, 'Segoe UI', sans-serif;">
                ${titulo}
              </h1>

              <!-- Contenido Dinámico (Detalles de la Solicitud) -->
              <div style="color:#333333; font-size:14px; line-height:1.6; font-family:Arial, 'Segoe UI', sans-serif;">
                ${cuerpoHtml}
              </div>

              <!-- Botón de Llamado a la Acción (CTA) -->
              ${ctaTexto && finalCtaUrl ? `
                <div style="margin:28px 0 12px 0; text-align:center;">
                  <a href="${finalCtaUrl}" target="_blank" style="display:inline-block; background-color:#002D62; color:#ffffff; font-weight:bold; font-size:13px; text-decoration:none; padding:12px 28px; border-radius:6px; box-shadow:0 2px 4px rgba(0, 45, 98, 0.25); letter-spacing:0.3px; font-family:Arial, 'Segoe UI', sans-serif;">
                    ${ctaTexto} &rarr;
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Mensaje Ecológico al Pie del Correo -->
          <tr>
            <td style="background-color:#ffffff; padding:0 24px 24px 24px; text-align:center;">
              <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px 16px; margin:0 auto; display:inline-block; max-width:92%;">
                <p style="margin:0; font-size:12px; font-weight:bold; color:#15803d; line-height:1.45; font-family:Arial, 'Segoe UI', sans-serif;">
                  🌿 “Antes de imprimir, piensa en el medio ambiente. Cada hoja cuenta, cada árbol importa.” ♻️
                </p>
              </div>
            </td>
          </tr>

          <!-- Pie de Página (Footer) -->
          <tr>
            <td style="background-color:#F4F7F9; padding:20px 24px; border-top:1px solid #E2E8F0; text-align:center;">
              <p style="margin:0; font-size:11px; color:#555555; line-height:1.5; font-family:Arial, 'Segoe UI', sans-serif;">
                Este es un mensaje automático generado por el Sistema de Control de Vacaciones de Grupo JAMA. Por favor no responda directamente a este correo.
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
 * Registra la trazabilidad histórica de cada intento de notificación en dbo.LogCorreosEnviados
 */
async function registrarLogEnvio({
  destinatarioOriginal,
  destinatarioEfectivo,
  asunto,
  tipoEvento = 'GENERAL',
  folioSolicitud = null,
  estatusEnvio, // 'EXITO' o 'ERROR'
  mensajeError = null,
  messageId = null
}) {
  try {
    const pool = await getPool();
    if (!pool || isUsingMock()) {
      if (!mockStore.logCorreosEnviados) {
        mockStore.logCorreosEnviados = [];
      }
      mockStore.logCorreosEnviados.unshift({
        idLog: mockStore.logCorreosEnviados.length + 1,
        destinatarioOriginal: destinatarioOriginal || 'NO_REGISTRADO',
        destinatarioEfectivo: destinatarioEfectivo || 'NO_ENVIADO',
        asunto: asunto || 'Sin Asunto',
        tipoEvento: tipoEvento || 'GENERAL',
        folioSolicitud: folioSolicitud || null,
        estatusEnvio: estatusEnvio || 'ERROR',
        mensajeError: mensajeError || null,
        messageId: messageId || null,
        fechaEnvio: new Date().toISOString().replace('T', ' ').substring(0, 19)
      });
      return;
    }

    await pool.request()
      .input('DestinatarioOriginal', (destinatarioOriginal || 'no-especificado').substring(0, 150))
      .input('DestinatarioEfectivo', (destinatarioEfectivo || 'no-especificado').substring(0, 150))
      .input('Asunto', (asunto || 'Sin Asunto').substring(0, 255))
      .input('TipoEvento', (tipoEvento || 'GENERAL').substring(0, 50))
      .input('FolioSolicitud', folioSolicitud ? String(folioSolicitud).substring(0, 50) : null)
      .input('EstatusEnvio', estatusEnvio) // 'EXITO' o 'ERROR'
      .input('MensajeError', mensajeError ? String(mensajeError) : null)
      .input('MessageId', messageId ? String(messageId).substring(0, 150) : null)
      .query(`
        INSERT INTO dbo.LogCorreosEnviados (
          DestinatarioOriginal, DestinatarioEfectivo, Asunto, TipoEvento,
          FolioSolicitud, EstatusEnvio, MensajeError, MessageId, FechaEnvio
        ) VALUES (
          @DestinatarioOriginal, @DestinatarioEfectivo, @Asunto, @TipoEvento,
          @FolioSolicitud, @EstatusEnvio, @MensajeError, @MessageId, SYSDATETIME()
        )
      `);
  } catch (err) {
    console.error('[LOG CORREOS] Error al insertar en dbo.LogCorreosEnviados:', err.message);
  }
}

/**
 * Función genérica de despacho de correo con salvaguardas y logs desacoplados
 * Incluye soporte nativo para Modo de Auditoría / Sandboxing (Redirección a soporte@grupojama.com)
 * y persistencia automática en dbo.LogCorreosEnviados.
 */
/**
 * Función genérica de despacho de correo con salvaguardas y logs desacoplados
 * Incluye soporte nativo para Modo de Auditoría / Sandboxing (Redirección a soporte@grupojama.com),
 * copias jerárquicas (CC), adjuntos PDF en memoria y persistencia automática en dbo.LogCorreosEnviados.
 */
async function enviarEmail({ 
  to, 
  cc = null, 
  subject, 
  html, 
  attachments = [], 
  tipoEvento = 'GENERAL', 
  folioSolicitud = null 
}) {
  const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
  const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();

  let destinatarioOriginal = (to && typeof to === 'string') ? to.trim() : (Array.isArray(to) ? to.join(', ') : '');
  let ccOriginal = (cc && typeof cc === 'string') ? cc.trim() : (Array.isArray(cc) ? cc.join(', ') : '');

  if (!destinatarioOriginal && modoAuditoria) {
    destinatarioOriginal = 'colaborador.previsto@grupojama.com';
  }

  if (!destinatarioOriginal || !destinatarioOriginal.includes('@')) {
    console.warn(`[NOTIFICACIONES EMAIL] Omitido: Destinatario con correo inválido o no registrado ('${to}').`);
    await registrarLogEnvio({
      destinatarioOriginal: to || 'NO_REGISTRADO',
      destinatarioEfectivo: 'NO_ENVIADO',
      asunto: subject,
      tipoEvento,
      folioSolicitud,
      estatusEnvio: 'ERROR',
      mensajeError: 'Destinatario con correo inválido o no registrado'
    });
    return { skipped: true, reason: 'EMAIL_NO_VALIDO' };
  }

  // Si el modo auditoría / sandbox está activo, redirigir todos los destinatarios (To y CC) a soporte
  const destinatarioFinal = modoAuditoria ? correoAuditoria : destinatarioOriginal;
  const ccFinal = modoAuditoria ? null : (ccOriginal || null);

  const logDestinatarioOriginal = `${destinatarioOriginal}${ccOriginal ? ` [CC: ${ccOriginal}]` : ''}`;
  const logDestinatarioEfectivo = `${destinatarioFinal}${ccFinal ? ` [CC: ${ccFinal}]` : ''}`;

  const config = await obtenerConfiguracionEmail();
  if (!config || !config.enabled) {
    console.log(`[NOTIFICACIONES EMAIL] Notificaciones deshabilitadas en configuración del sistema.`);
    await registrarLogEnvio({
      destinatarioOriginal: logDestinatarioOriginal,
      destinatarioEfectivo: logDestinatarioEfectivo,
      asunto: subject,
      tipoEvento,
      folioSolicitud,
      estatusEnvio: 'ERROR',
      mensajeError: 'Notificaciones deshabilitadas en configuración (SMTP_NOTIF_ENABLED=false)'
    });
    return { skipped: true, reason: 'NOTIFICACIONES_DESHABILITADAS' };
  }

  const transporter = await getTransporter();
  const rawFrom = config.from || process.env.SMTP_FROM || 'Control de Vacaciones Grupo JAMA <comprobante.fiscal@grupojamacfdi.com>';
  const from = rawFrom.replace(/^["']|["']$/g, '');

  if (!transporter) {
    console.warn(`[NOTIFICACIONES EMAIL] SMTP no configurado (SMTP_HOST vacío). Simulación de envío:`);
    console.warn(` -> Para: ${destinatarioFinal} ${modoAuditoria ? `(Destinatario original previsto: ${logDestinatarioOriginal})` : ''}`);
    console.warn(` -> Asunto: ${subject}`);
    if (attachments && attachments.length > 0) {
      console.warn(` -> Adjuntos (${attachments.length}): ${attachments.map(a => a.filename).join(', ')}`);
    }
    const simMessageId = `<SIMULADO_${Date.now()}@grupojama.com>`;
    await registrarLogEnvio({
      destinatarioOriginal: logDestinatarioOriginal,
      destinatarioEfectivo: logDestinatarioEfectivo,
      asunto: subject,
      tipoEvento,
      folioSolicitud,
      estatusEnvio: 'EXITO',
      messageId: simMessageId
    });
    return { simulated: true, to: destinatarioFinal, destinatarioOriginal: logDestinatarioOriginal, subject, messageId: simMessageId };
  }

  // Inyección del Banner Superior de Auditoría si el modo sandbox está activo
  let htmlFinal = html || '';
  if (modoAuditoria) {
    const bannerHtml = `
              <!-- BANNER MODO AUDITORIA / SANDBOXING -->
              <div style="background-color:#fffbeb; border:1px solid #fde68a; border-left:4px solid #002D62; padding:12px 16px; margin:0 0 20px 0; border-radius:6px; font-family:Arial, 'Segoe UI', sans-serif; font-size:12px; color:#92400e; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                <div style="font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#002D62; margin-bottom:4px;">
                  ⚠️ Modo Auditoría / Sandbox de Pruebas Activo
                </div>
                <div>
                  [AUDITORÍA: Destinatario original previsto: <code style="background-color:#fef3c7; padding:2px 6px; border-radius:4px; font-weight:bold; color:#78350f; font-size:12px; font-family:monospace;">${destinatarioOriginal}</code>${ccOriginal ? ` (Copia CC a: <code style="background-color:#fef3c7; padding:2px 6px; border-radius:4px; font-weight:bold; color:#78350f; font-size:12px; font-family:monospace;">${ccOriginal}</code>)` : ''}]
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

    console.log(`[NOTIFICACIONES EMAIL] [Modo Auditoría ACTIVO] Redirigiendo correo previsto para '${logDestinatarioOriginal}' -> '${destinatarioFinal}'`);
  }

  try {
    const mailOptions = {
      from,
      to: destinatarioFinal,
      ...(ccFinal ? { cc: ccFinal } : {}),
      subject,
      html: htmlFinal,
      ...(attachments && attachments.length > 0 ? { attachments } : {})
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[NOTIFICACIONES EMAIL] Enviado con éxito a: ${destinatarioFinal} ${modoAuditoria ? `(Original: ${logDestinatarioOriginal})` : ''} (ID: ${info.messageId}) - Asunto: ${subject}`);
    await registrarLogEnvio({
      destinatarioOriginal: logDestinatarioOriginal,
      destinatarioEfectivo: logDestinatarioEfectivo,
      asunto: subject,
      tipoEvento,
      folioSolicitud,
      estatusEnvio: 'EXITO',
      messageId: info.messageId
    });
    return { success: true, messageId: info.messageId, destinatarioFinal, destinatarioOriginal: logDestinatarioOriginal, modoAuditoria };
  } catch (err) {
    console.error(`[NOTIFICACIONES EMAIL] Error al enviar correo a ${destinatarioFinal}:`, err.message);
    await registrarLogEnvio({
      destinatarioOriginal: logDestinatarioOriginal,
      destinatarioEfectivo: logDestinatarioEfectivo,
      asunto: subject,
      tipoEvento,
      folioSolicitud,
      estatusEnvio: 'ERROR',
      mensajeError: err.message
    });
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
      const emailJefeDestino = (jefeEmail && jefeEmail.trim()) ? jefeEmail.trim() : '';

      const segundoEmail = segundoAprobador ? (segundoAprobador.emailCorporativo || segundoAprobador.email) : '';
      const emailSegundoDestino = (segundoEmail && segundoEmail.trim()) ? segundoEmail.trim() : '';

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
          sucursal: colab ? colab.sucursal : 'Matriz',
          departamento: colab ? colab.departamento : 'General'
        },
        idJefeDirecto: idJefe || null,
        idAprobadorSegundo: idSegundo || null,
        jefe: jefe ? {
          id: jefe.idColaborador || jefe.id,
          nombre: jefe.nombreCompleto || 'Líder Operativo',
          email: emailJefeDestino
        } : null,
        segundoAprobador: segundoAprobador ? {
          id: segundoAprobador.idColaborador || segundoAprobador.id,
          nombre: segundoAprobador.nombreCompleto || 'Gerencia General',
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
          c.IdJefeDirecto,
          j.IdColaborador AS IdJefeEncontrado,
          j.NombreCompleto AS JefeNombre,
          j.Email AS JefeEmail,
          j.EmailCorporativo AS JefeEmailCorporativo,
          -- Segundo Aprobador (Gerente)
          ISNULL(s.IdAprobadorSegundo, c.IdAprobadorSegundo) AS IdAprobadorSegundo,
          j2.IdColaborador AS IdSegundoEncontrado,
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

    const emailJefeReal = (row.JefeEmailCorporativo && row.JefeEmailCorporativo.trim())
      ? row.JefeEmailCorporativo.trim()
      : (row.JefeEmail && row.JefeEmail.trim() ? row.JefeEmail.trim() : '');

    const emailSegundoReal = (row.SegundoAprobadorEmailCorporativo && row.SegundoAprobadorEmailCorporativo.trim())
      ? row.SegundoAprobadorEmailCorporativo.trim()
      : (row.SegundoAprobadorEmail && row.SegundoAprobadorEmail.trim() ? row.SegundoAprobadorEmail.trim() : '');

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
      idJefeDirecto: row.IdJefeDirecto || null,
      idAprobadorSegundo: row.IdAprobadorSegundo || null,
      jefe: (row.IdJefeDirecto && row.IdJefeEncontrado) ? {
        id: row.IdJefeEncontrado,
        nombre: row.JefeNombre || 'Líder Operativo',
        email: emailJefeReal
      } : null,
      segundoAprobador: (row.IdAprobadorSegundo && row.IdSegundoEncontrado) ? {
        id: row.IdSegundoEncontrado,
        nombre: row.SegundoAprobadorNombre || 'Gerencia General',
        email: emailSegundoReal
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
   * Generación de PDF oficial FDO-84 en memoria y despacho jerárquico:
   *  - Para (to): Jefe Directo (Nivel 1)
   *  - Copia (cc): Segundo Aprobador (Gerente / Nivel 2) si está configurado
   *  - Fallback / Resguardo: Si no tiene jefe/aprobador o correo no es válido,
   *    canalizar a CORREO_AUDITORIA (soporte@grupojama.com) con aviso explicativo.
   */
  notificarNuevaSolicitud: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { 
        colaborador, 
        jefe, 
        segundoAprobador, 
        folio, 
        fechaInicio, 
        fechaFin, 
        totalDiasLaborables, 
        saldoDisponible, 
        motivoComentarios,
        idJefeDirecto
      } = data;

      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();

      // Validación de correo del Jefe Directo y Segundo Aprobador
      const emailJefeValido = Boolean(jefe && jefe.email && jefe.email.includes('@'));
      const emailSegundoValido = Boolean(segundoAprobador && segundoAprobador.email && segundoAprobador.email.includes('@'));

      // Regla de Resguardo / Fallback Institucional
      const esResguardo = !idJefeDirecto || !jefe || !emailJefeValido;

      let emailDestinatarioPrincipal = null;
      let emailDestinatarioCopia = null;
      let motivoResguardo = null;

      if (!esResguardo) {
        // Flujo Jerárquico Normal
        emailDestinatarioPrincipal = jefe.email.trim();
        emailDestinatarioCopia = emailSegundoValido ? segundoAprobador.email.trim() : null;
      } else {
        // Fallback de Seguridad Institucional: canalizar a CORREO_AUDITORIA
        emailDestinatarioPrincipal = correoAuditoria;
        emailDestinatarioCopia = emailSegundoValido ? segundoAprobador.email.trim() : null;

        if (!idJefeDirecto) {
          motivoResguardo = 'El colaborador no cuenta con Jefe Directo configurado en el catálogo institucional (IdJefeDirecto es nulo).';
        } else if (!jefe) {
          motivoResguardo = `El colaborador tiene configurado IdJefeDirecto (${idJefeDirecto}), pero el registro del jefe no existe en el sistema.`;
        } else {
          motivoResguardo = `El Jefe Directo configurado (${jefe.nombre}) no cuenta con una dirección de correo válida (registrado: "${jefe.email || 'vacío'}").`;
        }
        console.warn(`[NOTIFICACIONES EMAIL] [REGLA RESGUARDO] Solicitud ${folio} (${colaborador.nombre}) canalizada a ${correoAuditoria}. Motivo: ${motivoResguardo}`);
      }

      // 1. GENERACIÓN DEL PDF ADJUNTO (FDO-84) EN MEMORIA
      let attachments = [];
      try {
        console.log(`[NOTIFICACIONES EMAIL] Generando PDF oficial FDO-84 en memoria para solicitud ${folio} (ID: ${idSolicitud})...`);
        const pdfBuffer = await generarPdfFdo84(idSolicitud);
        if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
          const folioLimpio = String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
          attachments.push({
            filename: `FDO-84_Solicitud_${folioLimpio}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          });
          console.log(`[NOTIFICACIONES EMAIL] PDF FDO-84 adjuntado con éxito (${pdfBuffer.length} bytes): FDO-84_Solicitud_${folioLimpio}.pdf`);
        } else {
          console.warn(`[NOTIFICACIONES EMAIL] Buffer de PDF FDO-84 vacío o no válido para solicitud ${idSolicitud}.`);
        }
      } catch (pdfErr) {
        console.error(`[NOTIFICACIONES EMAIL] Error no bloqueante al generar PDF FDO-84 para solicitud ${idSolicitud}:`, pdfErr.message);
      }

      // Preparación de contenidos del Correo
      const nombreDestinatario = esResguardo 
        ? 'Equipo de Desarrollo Organizacional / Soporte' 
        : (jefe.nombre || 'Líder Operativo');

      const saldoRestanteEstimado = Math.max(0, saldoDisponible - totalDiasLaborables);
      const asunto = esResguardo
        ? `[Vacaciones Grupo JAMA] [AVISO DE RESGUARDO] Nueva solicitud pendiente - ${colaborador.nombre}`
        : `[Vacaciones Grupo JAMA] Nueva solicitud pendiente de aprobación - ${colaborador.nombre}`;

      const cuerpoHtml = `
        ${esResguardo ? `
          <!-- ALERTA DE RESGUARDO INSTITUCIONAL -->
          <div style="background-color:#fff1f2; border:1px solid #fecdd3; border-left:4px solid #e11d48; padding:14px 18px; margin:0 0 20px 0; border-radius:8px; color:#9f1239; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="font-weight:bold; font-size:12px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">
              🚨 AVISO DE RESGUARDO INSTITUCIONAL (SIN JEFATURA ASIGNADA)
            </div>
            <div style="font-size:13px; line-height:1.5;">
              El colaborador <strong>${colaborador.nombre}</strong> (Nómina: ${colaborador.codigo || '—'}) ha generado una solicitud de vacaciones, pero el sistema detectó que <strong>no cuenta con una jefatura directa válida</strong>.
              <br><br>
              <strong>Detalle de validación:</strong> ${motivoResguardo}
              <br><br>
              Por política institucional de resguardo y seguridad, esta notificación y su formato oficial FDO-84 adjunto se canalizan automáticamente a <code>${correoAuditoria}</code> para su revisión manual, asignación de aprobador o gestión por Desarrollo Organizacional.
            </div>
          </div>
        ` : ''}

        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${nombreDestinatario}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          ${esResguardo 
            ? `Se ha recibido una nueva solicitud de vacaciones en la plataforma que requiere atención institucional:` 
            : `Se ha recibido una nueva solicitud de vacaciones en tu equipo que requiere tu revisión y autorización:`}
        </p>

        <!-- Tabla de Datos del Colaborador y Período -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Colaborador:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">${colaborador.nombre}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">No. Nómina:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-mono font-bold;">${colaborador.codigo || '—'}</td>
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
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Saldo Restante Estimado:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#059669; font-size:13px; font-weight:bold;">
              ${saldoRestanteEstimado.toFixed(1)} días disponibles
            </td>
          </tr>
          ${emailDestinatarioCopia ? `
            <tr>
              <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Copia (CC Nivel 2):</td>
              <td style="padding:10px 14px; color:#475569; font-size:12px;">${segundoAprobador ? segundoAprobador.nombre : 'Gerencia'} (${emailDestinatarioCopia})</td>
            </tr>
          ` : ''}
        </table>

        ${motivoComentarios ? `
          <div style="background-color:#f1f5f9; border-left:4px solid #3b82f6; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
            <strong>Comentarios del solicitante:</strong> "${motivoComentarios}"
          </div>
        ` : ''}

        <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f8fafc; border:1px dashed #cbd5e1; padding:10px 14px; border-radius:8px;">
          📎 <strong>Formato Oficial Adjunto:</strong> Se incluye el archivo PDF oficial <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> con sellos digitales en estatus <em>PENDIENTE DE AUTORIZACIÓN</em>.
        </p>

        <p style="margin:16px 0 0 0;">
          ${esResguardo 
            ? 'Por favor ingresa a la plataforma para dar seguimiento administrativo o regularizar la jefatura de este colaborador.' 
            : 'Por favor ingresa a la plataforma para autorizar o declinar esta solicitud según las necesidades operativas del área.'}
        </p>
      `;

      const html = generarPlantillaHtml({
        titulo: esResguardo ? 'Aviso de Resguardo: Solicitud Sin Jefatura Asignada' : 'Nueva Solicitud Pendiente de Aprobación',
        badgeTexto: esResguardo ? 'Resguardo Institucional' : 'Pendiente de Aprobación',
        badgeColor: esResguardo ? '#991b1b' : '#1e40af',
        badgeBg: esResguardo ? '#fff1f2' : '#eff6ff',
        badgeBorder: esResguardo ? '#fecdd3' : '#bfdbfe',
        cuerpoHtml,
        ctaTexto: esResguardo ? 'Revisar Solicitud en la Plataforma' : 'Revisar en Bandeja del Líder',
        ctaUrl: esResguardo ? '/portal' : '/lider/aprobaciones'
      });

      await enviarEmail({
        to: emailDestinatarioPrincipal,
        cc: emailDestinatarioCopia,
        subject: asunto,
        html,
        attachments,
        tipoEvento: 'NUEVA_SOLICITUD',
        folioSolicitud: folio
      });
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

      await enviarEmail({ to: emailSegundo, subject: asunto, html, tipoEvento: 'PENDIENTE_GERENTE', folioSolicitud: folio });
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

      await enviarEmail({ to: emailColab, subject: asunto, html, tipoEvento: 'APROBADA_LIDER', folioSolicitud: folio });
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

      await enviarEmail({ to: emailColab, subject: asunto, html, tipoEvento: 'RECHAZADA_LIDER', folioSolicitud: folio });
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

      await enviarEmail({ to: emailJefe, subject: asunto, html, tipoEvento: 'CANCELADA_COLABORADOR', folioSolicitud: folio });
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

      await enviarEmail({ to: emailColab, subject: asunto, html, tipoEvento: esAprobada ? 'CONCLUIDA_DO' : 'RECHAZADA_DO', folioSolicitud: folio });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarConclusionDO:', err.message);
    }
  }
};

emailService.crearTransportadorSmtp = crearTransportadorSmtp;
emailService.obtenerConfiguracionEmail = obtenerConfiguracionEmail;
emailService.registrarLogEnvio = registrarLogEnvio;
emailService.enviarEmail = enviarEmail;

module.exports = emailService;
