const nodemailer = require('nodemailer');
const { getPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');
const { generarPdfFdo84 } = require('./pdfFdo84Service');

/**
 * Servicio de Envío de Notificaciones por Correo Electrónico (SMTP)
 * Matriz de Enrutamiento Corporativo de Correos para Grupo JAMA
 * Control de Vacaciones - Desarrollo Organizacional y TI
 */

// Administradora Principal de Desarrollo Organizacional (Destinatario formal en Etapa 2)
const ADMIN_DO_DEFECTO = {
  nombre: 'María Vera',
  email: 'admin.rh@grupojama.com'
};

// Función creadora de transportador Nodemailer adaptada para Relay local (sin TLS forzado)
const crearTransportadorSmtp = (configBd = null) => {
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
          user: process.env.SMTP_USER !== undefined && process.env.SMTP_USER !== '' ? process.env.SMTP_USER : (map['SMTP_USER'] || 'comprobante.fiscal@grupojamacfdi.com'),
          pass: process.env.SMTP_PASS !== undefined && process.env.SMTP_PASS !== '' ? process.env.SMTP_PASS : (map['SMTP_PASS'] || ''),
          secure: process.env.SMTP_SECURE === 'true' || map['SMTP_SECURE'] === 'true',
          fromName: map['SMTP_FROM_NAME'] || 'Control de Vacaciones Grupo JAMA',
          from: process.env.SMTP_FROM || `${map['SMTP_FROM_NAME'] || 'Control de Vacaciones Grupo JAMA'} <${map['SMTP_USER'] || 'comprobante.fiscal@grupojamacfdi.com'}>`,
          adminDoEmail: process.env.ADMIN_DO_EMAIL || map['ADMIN_DO_EMAIL'] || ADMIN_DO_DEFECTO.email,
          adminDoNombre: process.env.ADMIN_DO_NOMBRE || map['ADMIN_DO_NOMBRE'] || ADMIN_DO_DEFECTO.nombre,
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
    user: process.env.SMTP_USER || 'comprobante.fiscal@grupojamacfdi.com',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
    fromName: process.env.SMTP_FROM_NAME || 'Control de Vacaciones Grupo JAMA',
    from: process.env.SMTP_FROM || 'Control de Vacaciones Grupo JAMA <comprobante.fiscal@grupojamacfdi.com>',
    adminDoEmail: process.env.ADMIN_DO_EMAIL || ADMIN_DO_DEFECTO.email,
    adminDoNombre: process.env.ADMIN_DO_NOMBRE || ADMIN_DO_DEFECTO.nombre,
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
        <!-- Contenedor Principal (Max 600px, bordes redondeados sutiles 8px, borde institucional #002D62) -->
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
                      Control de Vacaciones • Desarrollo Organizacional
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
                Este es un mensaje institucional generado por el Sistema de Control de Vacaciones de Grupo JAMA.<br>
                Emisor oficial del sistema: <code>comprobante.fiscal@grupojamacfdi.com</code>
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
        destinatarioOriginal: (destinatarioOriginal || 'NO_REGISTRADO').substring(0, 150),
        destinatarioEfectivo: (destinatarioEfectivo || 'NO_ENVIADO').substring(0, 150),
        asunto: (asunto || 'Sin Asunto').substring(0, 255),
        tipoEvento: (tipoEvento || 'GENERAL').substring(0, 50),
        folioSolicitud: folioSolicitud ? String(folioSolicitud).substring(0, 50) : null,
        estatusEnvio: estatusEnvio || 'ERROR',
        mensajeError: mensajeError || null,
        messageId: messageId ? String(messageId).substring(0, 150) : null,
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

  // Si el modo auditoría / sandbox está activo, redirigir todos los destinos finales a soporte@grupojama.com
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
  // Remitente oficial estricto: comprobante.fiscal@grupojamacfdi.com
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

      // Matriz de correos del Colaborador: Corporativo con fallback a Nómina / Personal
      const colabCorp = (colab?.emailCorporativo || '').trim();
      const colabPers = (colab?.email || colab?.emailPersonal || '').trim();
      const emailColaboradorDestino = colabCorp || colabPers || (modoAuditoria ? 'colaborador.previsto@grupojama.com' : '');

      // Matriz de correos del Jefe Directo: Corporativo con fallback a Personal
      const jefeCorp = (jefe?.emailCorporativo || '').trim();
      const jefePers = (jefe?.email || jefe?.emailPersonal || '').trim();
      const emailJefeDestino = jefeCorp || jefePers || '';

      // Matriz de correos del Segundo Aprobador: Corporativo con fallback a Personal
      const segundoCorp = (segundoAprobador?.emailCorporativo || '').trim();
      const segundoPers = (segundoAprobador?.email || segundoAprobador?.emailPersonal || '').trim();
      const emailSegundoDestino = segundoCorp || segundoPers || '';

      // Historial de aprobaciones en memoria
      const historial = (mockStore.historialAprobaciones || [])
        .filter(h => h.idSolicitud === Number(idSolicitud))
        .map(h => ({
          idAprobacion: h.idAprobacion,
          nivelAprobacion: h.nivelAprobacion,
          accion: h.accion,
          comentarios: h.comentarios,
          fechaAccion: h.fechaAccion,
          aprobadorNombre: h.aprobadorNombre
        }));

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
          emailPersonal: colabPers,
          emailCorporativo: colabCorp,
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
          email: emailJefeDestino,
          emailPersonal: jefePers,
          emailCorporativo: jefeCorp
        } : null,
        segundoAprobador: segundoAprobador ? {
          id: segundoAprobador.idColaborador || segundoAprobador.id,
          nombre: segundoAprobador.nombreCompleto || 'Gerencia General',
          email: emailSegundoDestino,
          emailPersonal: segundoPers,
          emailCorporativo: segundoCorp
        } : null,
        saldoDisponible: Number(saldoDisponible),
        historial
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
          s.IdAprobadorLider,
          CONVERT(VARCHAR(19), s.FechaAprobacionLider, 120) AS FechaAprobacionLider,
          s.IdAprobadorFinal,
          CONVERT(VARCHAR(19), s.FechaResolucion, 120) AS FechaResolucion,
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
          j2.EmailCorporativo AS SegundoAprobadorEmailCorporativo,
          -- DO Aprobador Final
          do_user.NombreCompleto AS AprobadorDONombre,
          do_user.EmailCorporativo AS AprobadorDOEmailCorporativo,
          do_user.Email AS AprobadorDOEmail
        FROM dbo.SolicitudesVacaciones s
        JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
        LEFT JOIN dbo.Colaboradores j2 ON j2.IdColaborador = ISNULL(s.IdAprobadorSegundo, c.IdAprobadorSegundo)
        LEFT JOIN dbo.Colaboradores do_user ON do_user.IdColaborador = s.IdAprobadorFinal
        WHERE s.IdSolicitud = @IdSolicitud
      `);

    const row = res.recordset[0];
    if (!row) return null;

    // Regla de resolución de correo Colaborador: Corporativo con fallback a Nómina / Personal
    const colabCorp = (row.ColaboradorEmailCorporativo || '').trim();
    const colabPers = (row.ColaboradorEmail || '').trim();
    const emailColaboradorDestino = colabCorp || colabPers || (modoAuditoria ? 'colaborador.previsto@grupojama.com' : '');

    // Regla de resolución de correo Jefe Directo: Corporativo con fallback a Personal
    const jefeCorp = (row.JefeEmailCorporativo || '').trim();
    const jefePers = (row.JefeEmail || '').trim();
    const emailJefeDestino = jefeCorp || jefePers || '';

    // Regla de resolución de correo Segundo Aprobador: Corporativo con fallback a Personal
    const segundoCorp = (row.SegundoAprobadorEmailCorporativo || '').trim();
    const segundoPers = (row.SegundoAprobadorEmail || '').trim();
    const emailSegundoDestino = segundoCorp || segundoPers || '';

    // Consulta complementaria de historial de aprobaciones
    let historial = [];
    try {
      const histRes = await pool.request()
        .input('IdSolicitud', idSolicitud)
        .query(`
          SELECT 
            h.IdAprobacion,
            h.NivelAprobacion,
            h.Accion,
            h.Comentarios,
            CONVERT(VARCHAR(19), h.FechaAccion, 120) AS FechaAccion,
            c.NombreCompleto AS AprobadorNombre
          FROM dbo.HistorialAprobaciones h
          LEFT JOIN dbo.Colaboradores c ON c.IdColaborador = h.IdAprobador
          WHERE h.IdSolicitud = @IdSolicitud
          ORDER BY h.FechaAccion ASC, h.IdAprobacion ASC
        `);
      historial = histRes.recordset || [];
    } catch (histErr) {
      console.warn('[NOTIFICACIONES EMAIL] No se pudo leer historial de aprobaciones:', histErr.message);
    }

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
        emailPersonal: colabPers,
        emailCorporativo: colabCorp,
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
        email: emailJefeDestino,
        emailPersonal: jefePers,
        emailCorporativo: jefeCorp
      } : null,
      segundoAprobador: (row.IdAprobadorSegundo && row.IdSegundoEncontrado) ? {
        id: row.IdSegundoEncontrado,
        nombre: row.SegundoAprobadorNombre || 'Gerencia General',
        email: emailSegundoDestino,
        emailPersonal: segundoPers,
        emailCorporativo: segundoCorp
      } : null,
      aprobadorDO: row.AprobadorDONombre ? {
        nombre: row.AprobadorDONombre,
        email: (row.AprobadorDOEmailCorporativo || row.AprobadorDOEmail || '').trim()
      } : null,
      saldoDisponible: Number(row.SaldoDisponible),
      historial
    };
  } catch (err) {
    console.error(`[NOTIFICACIONES EMAIL] Error consultando solicitud ${idSolicitud}:`, err.message);
    return null;
  }
}

/**
 * Helper para generar el buffer PDF oficial FDO-84 en memoria
 */
async function obtenerAdjuntoPdfFdo84(idSolicitud, folio) {
  try {
    const pdfBuffer = await generarPdfFdo84(idSolicitud);
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
      const folioLimpio = String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      return [{
        filename: `FDO-84_Solicitud_${folioLimpio}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }
  } catch (pdfErr) {
    console.error(`[NOTIFICACIONES EMAIL] Error no bloqueante al generar PDF FDO-84 para solicitud ${idSolicitud}:`, pdfErr.message);
  }
  return [];
}

const emailService = {

  // =========================================================================
  // ETAPA 1: AL CREAR UNA SOLICITUD DE VACACIONES
  // =========================================================================
  /**
   * Cuando un colaborador (o el sistema en su nombre) crea una solicitud nueva:
   * 1. Destinatario Colaborador:
   *    - Enviar al Correo Corporativo (con fallback al Correo Personal / Nómina).
   * 2. Destinatarios Autorizadores (Jefes):
   *    - Enviar copia / correo independiente al Jefe Directo (Nivel 1).
   *    - Si tiene Segundo Aprobador / Gerente (Nivel 2), incluirlo en el envío (CC o To).
   *    - Regla de resguardo institucional si no cuenta con jefatura asignada.
   * 3. Adjunto obligatorio:
   *    - Formato PDF oficial FDO-84 con estatus "PENDIENTE DE AUTORIZACIÓN" adjunto en todos los correos.
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

      const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();

      // Generación del formato PDF oficial FDO-84 en memoria
      const attachments = await obtenerAdjuntoPdfFdo84(idSolicitud, folio);
      const saldoRestanteEstimado = Math.max(0, saldoDisponible - totalDiasLaborables);

      // ---------------------------------------------------------------------
      // 1. ENVÍO AL COLABORADOR (Confirmación de Solicitud Registrada)
      // ---------------------------------------------------------------------
      try {
        const emailColab = colaborador.email; // Resuelto: Corporativo -> Fallback Personal -> Sandbox
        if (emailColab && emailColab.includes('@')) {
          const asuntoColab = `[Vacaciones Grupo JAMA] Solicitud registrada con éxito - Folio ${folio}`;

          const cuerpoColab = `
            <p style="margin:0 0 16px 0;">
              Estimado(a) <strong>${colaborador.nombre}</strong>,
            </p>
            <p style="margin:0 0 16px 0;">
              Te confirmamos que tu solicitud de vacaciones ha sido <strong>registrada exitosamente en el sistema</strong> con el folio oficial <strong style="color:#002D62;">${folio}</strong> y ha entrado al flujo institucional de autorizaciones.
            </p>

            <!-- Tabla de Datos de la Solicitud -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Folio Oficial:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período Solicitado:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Hábiles Solicitados:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  ${totalDiasLaborables} días <span style="font-size:11px; font-weight:normal; color:#64748b;">(Jornada Lunes a Sábado)</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Saldo Disponible Actual:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#059669; font-size:13px; font-weight:bold;">
                  ${saldoDisponible.toFixed(1)} días
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Saldo Restante Estimado:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#047857; font-size:13px; font-weight:bold;">
                  ${saldoRestanteEstimado.toFixed(1)} días
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Jefe Directo (Nivel 1):</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px;">
                  ${jefe ? jefe.nombre : '<em style="color:#b91c1c;">Por asignar por DO</em>'}
                </td>
              </tr>
              ${segundoAprobador ? `
                <tr>
                  <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Segundo Aprobador (Nivel 2):</td>
                  <td style="padding:10px 14px; color:#475569; font-size:12px;">${segundoAprobador.nombre} (Gerencia)</td>
                </tr>
              ` : ''}
            </table>

            ${motivoComentarios ? `
              <div style="background-color:#f1f5f9; border-left:4px solid #3b82f6; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
                <strong>Tus comentarios:</strong> "${motivoComentarios}"
              </div>
            ` : ''}

            <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f8fafc; border:1px dashed #cbd5e1; padding:10px 14px; border-radius:8px;">
              📎 <strong>Formato Oficial Adjunto:</strong> Se adjunta tu formato oficial <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> en estatus <em>PENDIENTE DE AUTORIZACIÓN</em>.
            </p>

            <p style="margin:16px 0 0 0;">
              Te notificaremos por este mismo medio en cuanto tu jefe directo y las áreas correspondientes emitan su resolución.
            </p>
          `;

          const htmlColab = generarPlantillaHtml({
            titulo: 'Solicitud de Vacaciones Registrada con Éxito',
            badgeTexto: 'Solicitud Registrada',
            badgeColor: '#065f46',
            badgeBg: '#ecfdf5',
            badgeBorder: '#a7f3d0',
            cuerpoHtml: cuerpoColab,
            ctaTexto: 'Ver Mi Portal de Vacaciones',
            ctaUrl: '/portal'
          });

          await enviarEmail({
            to: emailColab,
            subject: asuntoColab,
            html: htmlColab,
            attachments,
            tipoEvento: 'NUEVA_SOLICITUD_COLABORADOR',
            folioSolicitud: folio
          });
        }
      } catch (errColab) {
        console.error(`[NOTIFICACIONES EMAIL] Error enviando confirmación a colaborador (${folio}):`, errColab.message);
      }

      // ---------------------------------------------------------------------
      // 2. ENVÍO A AUTORIZADORES (Jefe Directo Nivel 1 y Segundo Aprobador Nivel 2)
      // ---------------------------------------------------------------------
      try {
        const emailJefeValido = Boolean(jefe && jefe.email && jefe.email.includes('@'));
        const emailSegundoValido = Boolean(segundoAprobador && segundoAprobador.email && segundoAprobador.email.includes('@'));
        const esResguardo = !idJefeDirecto || !jefe || !emailJefeValido;

        let emailDestinatarioPrincipal = null;
        let emailDestinatarioCopia = null;
        let motivoResguardo = null;

        if (!esResguardo) {
          emailDestinatarioPrincipal = jefe.email.trim();
          emailDestinatarioCopia = emailSegundoValido ? segundoAprobador.email.trim() : null;
        } else {
          emailDestinatarioPrincipal = correoAuditoria;
          emailDestinatarioCopia = emailSegundoValido ? segundoAprobador.email.trim() : null;

          if (!idJefeDirecto) {
            motivoResguardo = 'El colaborador no cuenta con Jefe Directo configurado en su ficha institucional (IdJefeDirecto nulo).';
          } else if (!jefe) {
            motivoResguardo = `El colaborador tiene configurado IdJefeDirecto (${idJefeDirecto}), pero el registro del líder no existe en el catálogo.`;
          } else {
            motivoResguardo = `El Jefe Directo configurado (${jefe.nombre}) no cuenta con correo corporativo ni personal válido.`;
          }
          console.warn(`[NOTIFICACIONES EMAIL] [REGLA RESGUARDO] Solicitud ${folio} (${colaborador.nombre}) canalizada a ${correoAuditoria}. Motivo: ${motivoResguardo}`);
        }

        const nombreDestinatario = esResguardo 
          ? 'Equipo de Desarrollo Organizacional / Soporte' 
          : (jefe.nombre || 'Líder Operativo');

        const asuntoJefe = esResguardo
          ? `[Vacaciones Grupo JAMA] [AVISO DE RESGUARDO] Nueva solicitud pendiente - ${colaborador.nombre}`
          : `[Vacaciones Grupo JAMA] Nueva solicitud pendiente de aprobación - ${colaborador.nombre}`;

        const cuerpoJefe = `
          ${esResguardo ? `
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
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
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
                <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Segundo Aprobador (CC Nivel 2):</td>
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
              : 'Por favor ingresa a tu bandeja de autorizaciones para aprobar o rechazar esta solicitud según los planes operativos.'}
          </p>
        `;

        const htmlJefe = generarPlantillaHtml({
          titulo: esResguardo ? 'Aviso de Resguardo: Solicitud Sin Jefatura Asignada' : 'Nueva Solicitud Pendiente de Aprobación',
          badgeTexto: esResguardo ? 'Resguardo Institucional' : 'Pendiente de Aprobación',
          badgeColor: esResguardo ? '#991b1b' : '#1e40af',
          badgeBg: esResguardo ? '#fff1f2' : '#eff6ff',
          badgeBorder: esResguardo ? '#fecdd3' : '#bfdbfe',
          cuerpoHtml: cuerpoJefe,
          ctaTexto: esResguardo ? 'Revisar Solicitud en la Plataforma' : 'Revisar en Bandeja del Líder',
          ctaUrl: esResguardo ? '/portal' : '/lider/aprobaciones'
        });

        await enviarEmail({
          to: emailDestinatarioPrincipal,
          cc: emailDestinatarioCopia,
          subject: asuntoJefe,
          html: htmlJefe,
          attachments,
          tipoEvento: 'NUEVA_SOLICITUD_AUTORIZADORES',
          folioSolicitud: folio
        });
      } catch (errJefe) {
        console.error(`[NOTIFICACIONES EMAIL] Error enviando notificación a autorizadores (${folio}):`, errJefe.message);
      }

    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error general en notificarNuevaSolicitud:', err.message);
    }
  },

  // =========================================================================
  // ETAPA 2: APROBACIONES Y RECHAZOS ESCALONADOS DE AUTORIZADORES
  // =========================================================================

  /**
   * Evento 2.1: Vo.Bo. Nivel 1 Aprobado - Pasa a Autorización Gerencial (Nivel 2)
   * 1. Aviso al Colaborador:
   *    - Informarle que su Jefe Directo aprobó (Vo.Bo. Nivel 1) y que ahora pasa al Gerente.
   * 2. Aviso al Segundo Aprobador (Gerente de Sucursal / Nivel 2):
   *    - Notificarle que la solicitud cuenta con el visto bueno del líder directo y requiere su autorización definitiva.
   * 3. Adjunto: PDF oficial FDO-84 con sello de Nivel 1.
   */
  notificarSolicitudPendienteGerente: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, segundoAprobador, folio, fechaInicio, fechaFin, totalDiasLaborables, saldoDisponible, motivoComentarios } = data;
      const attachments = await obtenerAdjuntoPdfFdo84(idSolicitud, folio);
      const saldoRestanteEstimado = Math.max(0, saldoDisponible - totalDiasLaborables);

      // 1. Notificación al Colaborador sobre el avance a Nivel 2
      try {
        const emailColab = colaborador.email;
        if (emailColab && emailColab.includes('@')) {
          const asuntoColab = `[Vacaciones Grupo JAMA] Avance de Solicitud: Vo.Bo. Nivel 1 Aprobado - Folio ${folio}`;

          const cuerpoColab = `
            <p style="margin:0 0 16px 0;">
              Estimado(a) <strong>${colaborador.nombre}</strong>,
            </p>
            <p style="margin:0 0 16px 0;">
              Te informamos que tu solicitud de vacaciones con folio <strong style="color:#002D62;">${folio}</strong> ha recibido satisfactoriamente el <strong>Visto Bueno de Nivel 1</strong> por parte de tu jefe directo (<strong>${jefe ? jefe.nombre : 'Líder Operativo'}</strong>).
            </p>
            <p style="margin:0 0 16px 0;">
              El trámite ha avanzado a la siguiente etapa y ha sido turnado a tu <strong>Segundo Aprobador / Gerencia</strong> (<strong>${segundoAprobador ? segundoAprobador.nombre : 'Gerencia de Sucursal'}</strong>) para la emisión de la autorización gerencial (Nivel 2).
            </p>

            <!-- Resumen de fechas -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Período Solicitado:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Hábiles:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  ${totalDiasLaborables} días
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Estatus del Flujo:</td>
                <td style="padding:10px 14px; color:#4338ca; font-size:12px; font-weight:bold;">
                  Vo.Bo. Nivel 1 Aprobado &rarr; En Revisión Gerencial (Nivel 2)
                </td>
              </tr>
            </table>

            <p style="margin:16px 0 0 0;">
              Puedes consultar el avance en tiempo real ingresando a tu Portal de Colaborador.
            </p>
          `;

          const htmlColab = generarPlantillaHtml({
            titulo: 'Avance de Solicitud: Vo.Bo. Nivel 1 Aprobado',
            badgeTexto: 'Avance: Vo.Bo. Nivel 1 Aprobado',
            badgeColor: '#4338ca',
            badgeBg: '#eef2ff',
            badgeBorder: '#c7d2fe',
            cuerpoHtml: cuerpoColab,
            ctaTexto: 'Ver Mi Portal de Vacaciones',
            ctaUrl: '/portal'
          });

          await enviarEmail({
            to: emailColab,
            subject: asuntoColab,
            html: htmlColab,
            attachments,
            tipoEvento: 'AVANCE_NIVEL1_COLABORADOR',
            folioSolicitud: folio
          });
        }
      } catch (errColab) {
        console.error(`[NOTIFICACIONES EMAIL] Error notificando avance a colaborador (${folio}):`, errColab.message);
      }

      // 2. Notificación al Gerente de Sucursal (Segundo Aprobador)
      try {
        const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
        const emailSegundo = (segundoAprobador && segundoAprobador.email) ? segundoAprobador.email : (modoAuditoria ? 'gerente.previsto@grupojama.com' : null);

        if (emailSegundo && emailSegundo.includes('@')) {
          const nombreSegundo = (segundoAprobador && segundoAprobador.nombre) ? segundoAprobador.nombre : 'Gerencia General';
          const asuntoGerente = `[Vacaciones Grupo JAMA] Solicitud pendiente de autorización gerencial (Nivel 2) - ${colaborador.nombre}`;

          const cuerpoGerente = `
            <p style="margin:0 0 16px 0;">
              Estimado(a) <strong>${nombreSegundo}</strong>,
            </p>
            <p style="margin:0 0 16px 0;">
              Te informamos que la solicitud de vacaciones con folio <strong style="color:#002D62;">${folio}</strong> correspondiente al colaborador <strong>${colaborador.nombre}</strong> ha recibido el <strong>Visto Bueno de Nivel 1</strong> por su jefe directo (${jefe ? jefe.nombre : 'Líder Operativo'}) y ahora requiere tu <strong>autorización gerencial definitiva (Nivel 2)</strong>:
            </p>

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

            <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f8fafc; border:1px dashed #cbd5e1; padding:10px 14px; border-radius:8px;">
              📎 <strong>Formato Oficial Adjunto:</strong> Se anexa el formato PDF <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> con el sello digital de Vo.Bo. de Nivel 1.
            </p>

            <p style="margin:16px 0 0 0;">
              Por favor ingresa a tu bandeja de autorizaciones para emitir la resolución gerencial de esta solicitud.
            </p>
          `;

          const htmlGerente = generarPlantillaHtml({
            titulo: 'Solicitud Pendiente de Autorización Gerencial (Nivel 2)',
            badgeTexto: 'Nivel 2: Autorización Gerencial',
            badgeColor: '#4338ca',
            badgeBg: '#eef2ff',
            badgeBorder: '#c7d2fe',
            cuerpoHtml: cuerpoGerente,
            ctaTexto: 'Revisar en Bandeja de Aprobaciones',
            ctaUrl: '/lider/aprobaciones'
          });

          await enviarEmail({
            to: emailSegundo,
            subject: asuntoGerente,
            html: htmlGerente,
            attachments,
            tipoEvento: 'PENDIENTE_GERENTE',
            folioSolicitud: folio
          });
        }
      } catch (errGerente) {
        console.error(`[NOTIFICACIONES EMAIL] Error notificando a gerente (${folio}):`, errGerente.message);
      }

    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudPendienteGerente:', err.message);
    }
  },

  /**
   * Evento 2.2: Aprobadores completan las firmas requeridas (Línea jerárquica completada)
   * 1. Aviso al Colaborador:
   *    - Notificarle que su solicitud fue autorizada por su línea jerárquica y ha pasado a validación final de DO.
   * 2. Aviso formal a Admin_DO (Desarrollo Organizacional):
   *    - Enviar aviso formal a María Vera (admin.rh@grupojama.com) informando que la solicitud ya cuenta con el
   *      visto bueno de la línea jerárquica y está lista para su validación final.
   * 3. Adjunto: PDF oficial FDO-84 con las firmas de la línea jerárquica.
   */
  notificarSolicitudAprobada: async (idSolicitud) => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, segundoAprobador, folio, fechaInicio, fechaFin, totalDiasLaborables, saldoDisponible, motivoComentarios } = data;
      const attachments = await obtenerAdjuntoPdfFdo84(idSolicitud, folio);
      const config = await obtenerConfiguracionEmail();

      // Construcción del resumen de autorizadores que firmaron
      const aprobadoresNombres = [
        jefe ? `${jefe.nombre} (Jefe Directo)` : null,
        segundoAprobador ? `${segundoAprobador.nombre} (Gerente de Sucursal)` : null
      ].filter(Boolean).join(' y ') || 'su jefatura directa';

      // ---------------------------------------------------------------------
      // 1. AVISO AL COLABORADOR (Autorización de Jefatura Completa)
      // ---------------------------------------------------------------------
      try {
        const emailColab = colaborador.email;
        if (emailColab && emailColab.includes('@')) {
          const asuntoColab = `[Vacaciones Grupo JAMA] Solicitud autorizada por jefatura - En proceso de validación final por DO (Folio ${folio})`;

          const cuerpoColab = `
            <p style="margin:0 0 16px 0;">
              Estimado(a) <strong>${colaborador.nombre}</strong>,
            </p>
            <p style="margin:0 0 16px 0;">
              ¡Buenas noticias! Tu solicitud de vacaciones con folio <strong style="color:#002D62;">${folio}</strong> ha sido <strong>autorizada con éxito por tu línea jerárquica</strong> (${aprobadoresNombres}).
            </p>
            <p style="margin:0 0 16px 0;">
              Tu solicitud ha pasado al área de <strong>Desarrollo Organizacional</strong> para su validación final, registro formal en nómina y conclusión del trámite.
            </p>

            <!-- Resumen del Período -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; margin:16px 0; overflow:hidden;">
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600; width:35%;">Período Solicitado:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">
                  Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:12px; font-weight:600;">Días Hábiles:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #d1fae5; color:#065f46; font-size:13px; font-weight:bold;">
                  ${totalDiasLaborables} días
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; color:#065f46; font-size:12px; font-weight:600;">Estatus del Trámite:</td>
                <td style="padding:10px 14px; color:#047857; font-size:13px; font-weight:bold;">
                  Autorizado por Línea Jerárquica &rarr; En Revisión Final por DO
                </td>
              </tr>
            </table>

            <p style="margin:16px 0 0 0;">
              En cuanto Desarrollo Organizacional emita el visto bueno final, recibirás tu confirmación definitiva junto con tu formato oficial FDO-84 totalmente firmado.
            </p>
          `;

          const htmlColab = generarPlantillaHtml({
            titulo: 'Solicitud Autorizada por Jefatura',
            badgeTexto: 'Autorizada por Jefatura',
            badgeColor: '#065f46',
            badgeBg: '#ecfdf5',
            badgeBorder: '#a7f3d0',
            cuerpoHtml: cuerpoColab,
            ctaTexto: 'Ver Mi Portal de Vacaciones',
            ctaUrl: '/portal'
          });

          await enviarEmail({
            to: emailColab,
            subject: asuntoColab,
            html: htmlColab,
            attachments,
            tipoEvento: 'AUTORIZADA_LIDERES_COLABORADOR',
            folioSolicitud: folio
          });
        }
      } catch (errColab) {
        console.error(`[NOTIFICACIONES EMAIL] Error notificando autorización al colaborador (${folio}):`, errColab.message);
      }

      // ---------------------------------------------------------------------
      // 2. AVISO FORMAL A ADMIN_DO (María Vera - admin.rh@grupojama.com)
      // ---------------------------------------------------------------------
      try {
        const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
        const emailAdminDO = config.adminDoEmail || ADMIN_DO_DEFECTO.email;
        const nombreAdminDO = config.adminDoNombre || ADMIN_DO_DEFECTO.nombre;

        const asuntoDO = `[Vacaciones Grupo JAMA] Solicitud lista para validación final de DO - ${colaborador.nombre} (Folio ${folio})`;

        const cuerpoDO = `
          <p style="margin:0 0 16px 0;">
            Estimada <strong>${nombreAdminDO}</strong> (Desarrollo Organizacional),
          </p>
          <p style="margin:0 0 16px 0;">
            Te notificamos que la solicitud de vacaciones con folio <strong style="color:#002D62;">${folio}</strong> correspondiente al colaborador <strong>${colaborador.nombre}</strong> (Nómina: ${colaborador.codigo || '—'}, Puesto: ${colaborador.puesto}, Empresa: ${colaborador.empresa}) <strong>ya cuenta con el visto bueno completo de la línea jerárquica</strong> (${aprobadoresNombres}) y se encuentra <strong>lista para su validación final</strong>.
          </p>

          <!-- Tabla de Datos para Validación de DO -->
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
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Empresa / Sucursal:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.empresa} (${colaborador.sucursal})</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Puesto / Depto:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.puesto} (${colaborador.departamento})</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Folio Solicitud:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período a Disfrutar:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Hábiles:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                ${totalDiasLaborables} días
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Autorizaciones Previas:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#059669; font-size:12px; font-weight:bold;">
                ${aprobadoresNombres}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Saldo Disponible Registrado:</td>
              <td style="padding:10px 14px; color:#059669; font-size:13px; font-weight:bold;">
                ${saldoDisponible.toFixed(1)} días
              </td>
            </tr>
          </table>

          ${motivoComentarios ? `
            <div style="background-color:#f1f5f9; border-left:4px solid #3b82f6; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
              <strong>Comentarios del solicitante:</strong> "${motivoComentarios}"
            </div>
          ` : ''}

          <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f8fafc; border:1px dashed #cbd5e1; padding:10px 14px; border-radius:8px;">
            📎 <strong>Formato Oficial Adjunto:</strong> Se anexa el formato institucional <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> con los sellos y firmas digitales de los líderes autorizadores.
          </p>

          <p style="margin:16px 0 0 0;">
            Por favor ingresa a la bandeja de Desarrollo Organizacional para emitir la validación final y concluir el trámite en nómina.
          </p>
        `;

        const htmlDO = generarPlantillaHtml({
          titulo: 'Solicitud Lista para Validación Final de DO',
          badgeTexto: 'Lista para Vo.Bo. de DO',
          badgeColor: '#5b21b6',
          badgeBg: '#f5f3ff',
          badgeBorder: '#ddd6fe',
          cuerpoHtml: cuerpoDO,
          ctaTexto: 'Revisar en Bandeja de DO',
          ctaUrl: '/admin/solicitudes'
        });

        await enviarEmail({
          to: emailAdminDO,
          subject: asuntoDO,
          html: htmlDO,
          attachments,
          tipoEvento: 'AVISO_ADMIN_DO',
          folioSolicitud: folio
        });
      } catch (errDO) {
        console.error(`[NOTIFICACIONES EMAIL] Error enviando aviso a Admin_DO (${folio}):`, errDO.message);
      }

    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error general en notificarSolicitudAprobada:', err.message);
    }
  },

  /**
   * Evento 2.3: Solicitud Rechazada por el Líder o Gerente
   * Destinatario: Colaborador solicitante (Corporativo con fallback a Personal)
   */
  notificarSolicitudRechazada: async (idSolicitud, motivoCapturado = '') => {
    try {
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, segundoAprobador, folio, fechaInicio, fechaFin, totalDiasLaborables, motivoRechazo } = data;
      const emailColab = colaborador.email;

      if (!emailColab || !emailColab.includes('@')) {
        console.warn(`[NOTIFICACIONES EMAIL] Evento Rechazo omitido: El colaborador '${colaborador.nombre}' no tiene correo registrado.`);
        return;
      }

      const motivoFinal = motivoCapturado || motivoRechazo || 'Rechazada según criterios operativos de la jefatura directa.';
      const asunto = `[Vacaciones Grupo JAMA] Solicitud de vacaciones no autorizada - Folio ${folio}`;

      const cuerpoHtml = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${colaborador.nombre}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          Te informamos que tu solicitud de vacaciones con folio <strong style="color:#0f172a;">${folio}</strong> para el período del <strong>${formatFecha(fechaInicio)}</strong> al <strong>${formatFecha(fechaFin)}</strong> (${totalDiasLaborables} días) <strong>no ha sido autorizada</strong> por tu línea jerárquica (${jefe ? jefe.nombre : 'tu líder'}).
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
        badgeTexto: 'No Autorizada por Jefatura',
        badgeColor: '#991b1b',
        badgeBg: '#fef2f2',
        badgeBorder: '#fecaca',
        cuerpoHtml,
        ctaTexto: 'Acceder a Mi Portal',
        ctaUrl: '/portal'
      });

      await enviarEmail({
        to: emailColab,
        subject: asunto,
        html,
        tipoEvento: 'RECHAZADA_LIDER',
        folioSolicitud: folio
      });
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudRechazada:', err.message);
    }
  },

  /**
   * Cancelación de la solicitud por parte del colaborador
   * Notifica a los autorizadores, y si ya estaba aprobada, también notifica formalmente a Admin_DO
   * @param {number|string} idSolicitud
   * @param {Object} opciones { estadoAnterior: 'APROBADA'|'PENDIENTE_LIDER', motivoCancelacion: string }
   */
  notificarSolicitudCancelada: async (idSolicitud, opciones = {}) => {
    try {
      const { estadoAnterior = 'PENDIENTE_LIDER', motivoCancelacion = null } = opciones;
      const data = await obtenerDatosSolicitud(idSolicitud);
      if (!data) return;

      const { colaborador, jefe, segundoAprobador, folio, fechaInicio, fechaFin, totalDiasLaborables } = data;
      const config = await obtenerConfiguracionEmail();
      const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();
      const emailJefe = (jefe && jefe.email) ? jefe.email : correoAuditoria;
      const ccSegundo = (segundoAprobador && segundoAprobador.email) ? segundoAprobador.email : null;
      const nombreJefe = (jefe && jefe.nombre) ? jefe.nombre : 'Líder Asignado';

      const yaEstabaAprobada = estadoAnterior === 'APROBADA';

      // 1. Notificación a Autorizadores (Jefe Directo y Segundo Aprobador en CC)
      const asuntoAutorizadores = yaEstabaAprobada
        ? `[Vacaciones Grupo JAMA] Cancelación de Solicitud Previamente Aprobada - ${colaborador.nombre} (Folio ${folio})`
        : `[Vacaciones Grupo JAMA] Solicitud cancelada por el colaborador - ${colaborador.nombre} (Folio ${folio})`;

      const badgeTexto = yaEstabaAprobada ? 'Solicitud Aprobada Cancelada' : 'Cancelada por Colaborador';
      const badgeColor = yaEstabaAprobada ? '#991b1b' : '#475569';
      const badgeBg = yaEstabaAprobada ? '#fee2e2' : '#f1f5f9';
      const badgeBorder = yaEstabaAprobada ? '#fca5a5' : '#cbd5e1';

      const cuerpoAutorizadores = `
        <p style="margin:0 0 16px 0;">
          Estimado(a) <strong>${nombreJefe}</strong>,
        </p>
        <p style="margin:0 0 16px 0;">
          Te notificamos que el colaborador <strong>${colaborador.nombre}</strong> (Nómina: ${colaborador.codigo || '—'}, Puesto: ${colaborador.puesto}) ha <strong>cancelado</strong> su solicitud de vacaciones <strong>${yaEstabaAprobada ? 'que se encontraba previamente aprobada' : 'previamente registrada en trámite'}</strong>:
        </p>

        <!-- Detalle de la Solicitud Cancelada -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Folio Cancelado:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Estado Previo:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:${yaEstabaAprobada ? '#059669' : '#b45309'}; font-size:12px; font-weight:bold;">
              ${yaEstabaAprobada ? '✓ Aprobada Formalmente' : '⏳ Pendiente de Aprobación'}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período Descartado:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
              Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Reintegrados al Saldo:</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#059669; font-size:14px; font-weight:bold;">
              +${totalDiasLaborables} días
            </td>
          </tr>
          ${motivoCancelacion ? `
            <tr>
              <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Motivo de Cancelación:</td>
              <td style="padding:10px 14px; color:#334155; font-size:12px; font-style:italic;">
                "${motivoCancelacion}"
              </td>
            </tr>
          ` : ''}
        </table>

        <p style="margin:16px 0 0 0; font-size:13px; color:#475569;">
          ${yaEstabaAprobada 
            ? 'Los días gozados asociados a este trámite han sido revertidos en el sistema y reintegrados a los períodos correspondientes del saldo disponible del colaborador.' 
            : 'Esta solicitud ha sido descartada de tu bandeja de autorizaciones pendientes y los días en trámite han sido liberados.'}
        </p>
      `;

      const htmlAutorizadores = generarPlantillaHtml({
        titulo: yaEstabaAprobada ? 'Cancelación de Solicitud Previamente Aprobada' : 'Solicitud Cancelada por el Colaborador',
        badgeTexto,
        badgeColor,
        badgeBg,
        badgeBorder,
        cuerpoHtml: cuerpoAutorizadores,
        ctaTexto: 'Revisar Bandeja de Solicitudes',
        ctaUrl: '/lider/aprobaciones'
      });

      await enviarEmail({
        to: emailJefe,
        cc: ccSegundo,
        subject: asuntoAutorizadores,
        html: htmlAutorizadores,
        tipoEvento: yaEstabaAprobada ? 'CANCELACION_APROBADA_LIDER' : 'CANCELADA_COLABORADOR',
        folioSolicitud: folio
      });

      // 2. Si la solicitud ya estaba APROBADA, enviar aviso especial a Admin_DO
      if (yaEstabaAprobada) {
        const emailAdminDO = config.adminDoEmail || ADMIN_DO_DEFECTO.email;
        const nombreAdminDO = config.adminDoNombre || ADMIN_DO_DEFECTO.nombre;

        const asuntoDO = `[Vacaciones Grupo JAMA] AVISO DO: Solicitud Aprobada Cancelada - ${colaborador.nombre} (Folio ${folio})`;

        const cuerpoDO = `
          <p style="margin:0 0 16px 0;">
            Estimada <strong>${nombreAdminDO}</strong> (Desarrollo Organizacional),
          </p>
          <p style="margin:0 0 16px 0;">
            Te notificamos que el colaborador <strong>${colaborador.nombre}</strong> (Nómina: ${colaborador.codigo || '—'}, Puesto: ${colaborador.puesto}, Empresa: ${colaborador.empresa}) ha <strong>cancelado una solicitud que ya se encontraba validada y aprobada formalmente</strong>:
          </p>

          <!-- Tabla de Datos para DO -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin:16px 0; overflow:hidden;">
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600; width:35%;">Folio Cancelado:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Colaborador:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">${colaborador.nombre}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Empresa / Sucursal:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.empresa} (${colaborador.sucursal})</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período Cancelado:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Revertidos:</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#15803d; font-size:13px; font-weight:bold;">
                +${totalDiasLaborables} días reintegrados a saldo
              </td>
            </tr>
            ${motivoCancelacion ? `
              <tr>
                <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Motivo Declarado:</td>
                <td style="padding:10px 14px; color:#334155; font-size:12px; font-style:italic;">
                  "${motivoCancelacion}"
                </td>
              </tr>
            ` : ''}
          </table>

          <div style="background-color:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:12px; color:#1e40af;">
            <strong>Ajuste Automático Realizado:</strong> El sistema ha ejecutado el ajuste automático restando los días de <code>DiasGozados</code> y restaurando el saldo disponible en los períodos correspondientes del kárdex del colaborador. Por favor verifica si se requiere ajustar alguna incidencia en el sistema de nómina CONTPAQi®.
          </div>
        `;

        const htmlDO = generarPlantillaHtml({
          titulo: 'Cancelación de Solicitud Aprobada • Ajuste de Saldo',
          badgeTexto: 'Aviso DO • Saldo Reintegrado',
          badgeColor: '#1e40af',
          badgeBg: '#eff6ff',
          badgeBorder: '#bfdbfe',
          cuerpoHtml: cuerpoDO,
          ctaTexto: 'Abrir Panel de Desarrollo Organizacional',
          ctaUrl: '/admin/solicitudes'
        });

        await enviarEmail({
          to: emailAdminDO,
          subject: asuntoDO,
          html: htmlDO,
          tipoEvento: 'CANCELACION_APROBADA_DO',
          folioSolicitud: folio
        });
      }
    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error en notificarSolicitudCancelada:', err.message);
    }
  },

  // =========================================================================
  // ETAPA 3: APROBACIÓN FINAL / Vo.Bo. POR PARTE DE DESARROLLO ORGANIZACIONAL
  // =========================================================================
  /**
   * Cuando Desarrollo Organizacional otorga el visto bueno final y concluye el trámite:
   * 1. Aviso al Colaborador:
   *    - Notificar al colaborador que su solicitud ha sido 100% aprobada y concluida.
   * 2. Aviso a los Autorizadores:
   *    - Enviar un correo de confirmación al Jefe Directo y al Gerente de Sucursal (si aplica),
   *      anexando el historial de que el proceso ha finalizado con éxito.
   * 3. Adjunto final obligatorio:
   *    - Incluir el PDF actualizado del formato FDO-84 con todas las firmas digitales y sellos de autorización completos.
   */
  notificarConclusionDO: async (idSolicitud, accion = 'APROBAR', motivoFinal = '') => {
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
        historial 
      } = data;

      const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();
      const esAprobada = (accion || '').toUpperCase().trim() === 'APROBAR' || (accion || '').toUpperCase().trim() === 'APROBADA';

      // Generación del PDF oficial FDO-84 final actualizado con sellos y firmas digitales completas
      const attachments = await obtenerAdjuntoPdfFdo84(idSolicitud, folio);

      // Tabla de resumen de firmas e historial para los correos
      let tablaHistorialHtml = '';
      if (historial && historial.length > 0) {
        tablaHistorialHtml = `
          <div style="margin:20px 0 16px 0;">
            <p style="margin:0 0 8px 0; font-size:12px; font-weight:bold; color:#002D62; text-transform:uppercase; letter-spacing:0.5px;">
              Historial Completo de Aprobaciones Institucionales:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; font-size:12px;">
              <tr style="background-color:#f1f5f9; color:#475569; font-weight:bold;">
                <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Nivel / Autorizador</td>
                <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Acción</td>
                <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Fecha / Hora</td>
              </tr>
              ${historial.map(h => {
                const nombre = h.AprobadorNombre || h.aprobadorNombre || h.NivelAprobacion || h.nivelAprobacion || 'Sistema';
                const nivel = h.NivelAprobacion || h.nivelAprobacion || 'Vo.Bo.';
                const accionItem = h.Accion || h.accion || 'APROBADA';
                const fechaItem = h.FechaAccion || h.fechaAccion;
                return `
                <tr>
                  <td style="padding:8px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a;">
                    <strong>${nombre}</strong>
                    <span style="display:block; font-size:10px; color:#64748b;">${nivel}</span>
                  </td>
                  <td style="padding:8px 12px; border-bottom:1px solid #f1f5f9; color:${accionItem === 'APROBADA' || accionItem === 'ENVIADA' ? '#059669' : '#dc2626'}; font-weight:bold;">
                    ${accionItem}
                  </td>
                  <td style="padding:8px 12px; border-bottom:1px solid #f1f5f9; color:#64748b;">
                    ${formatFecha(fechaItem)} ${fechaItem ? String(fechaItem).substring(11, 16) : ''}
                  </td>
                </tr>
              `;
              }).join('')}
            </table>
          </div>
        `;
      }

      // =====================================================================
      // CASO A: SOLICITUD 100% APROBADA Y CONCLUIDA POR DO
      // =====================================================================
      if (esAprobada) {

        // 1. AVISO AL COLABORADOR (100% Aprobada y Concluida)
        try {
          const emailColab = colaborador.email;
          if (emailColab && emailColab.includes('@')) {
            const asuntoColab = `[Vacaciones Grupo JAMA] ¡Tu solicitud de vacaciones está 100% aprobada y concluida! - Folio ${folio}`;

            const cuerpoColab = `
              <p style="margin:0 0 16px 0;">
                Estimado(a) <strong>${colaborador.nombre}</strong>,
              </p>
              <p style="margin:0 0 16px 0;">
                ¡Felicidades! Te confirmamos que tu solicitud de vacaciones con folio <strong style="color:#002D62;">${folio}</strong> ha sido <strong>100% aprobada y concluida satisfactoriamente por Desarrollo Organizacional</strong>.
              </p>
              <p style="margin:0 0 16px 0;">
                El período vacacional solicitado ha quedado <strong>formalmente registrado en el sistema de nómina</strong> y reservado en el calendario oficial de ausencias de Grupo JAMA.
              </p>

              <!-- Resumen del Período Concluido -->
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
                    ${saldoDisponible.toFixed(1)} días disponibles
                  </td>
                </tr>
              </table>

              ${motivoFinal && motivoFinal !== 'Validada y aprobada por Desarrollo Organizacional.' ? `
                <div style="background-color:#f8fafc; border-left:4px solid #10b981; padding:12px 14px; border-radius:6px; margin:16px 0; font-size:13px; color:#334155;">
                  <strong>Observaciones de Desarrollo Organizacional:</strong> "${motivoFinal}"
                </div>
              ` : ''}

              <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f0fdf4; border:1px solid #bbf7d0; padding:12px 16px; border-radius:8px;">
                📎 <strong>Formato Oficial FDO-84 Adjunto:</strong> Se anexa tu formato institucional <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> con <strong>todas las firmas digitales y sellos criptográficos completos</strong> (Líder Directo, Gerencia y Desarrollo Organizacional).
              </p>

              <p style="margin:16px 0 0 0;">
                ¡Deseamos que disfrutes de tu período de descanso! Puedes consultar tus comprobantes históricos en tu portal.
              </p>
            `;

            const htmlColab = generarPlantillaHtml({
              titulo: '¡Tu Solicitud de Vacaciones está 100% Aprobada y Concluida!',
              badgeTexto: '100% Aprobada y Concluida por DO',
              badgeColor: '#047857',
              badgeBg: '#ecfdf5',
              badgeBorder: '#a7f3d0',
              cuerpoHtml: cuerpoColab,
              ctaTexto: 'Ver Mi Portal de Vacaciones',
              ctaUrl: '/portal'
            });

            await enviarEmail({
              to: emailColab,
              subject: asuntoColab,
              html: htmlColab,
              attachments,
              tipoEvento: 'CONCLUSION_DO_COLABORADOR',
              folioSolicitud: folio
            });
          }
        } catch (errColab) {
          console.error(`[NOTIFICACIONES EMAIL] Error notificando conclusión a colaborador (${folio}):`, errColab.message);
        }

        // 2. AVISO A LOS AUTORIZADORES (Jefe Directo y Gerente de Sucursal)
        try {
          const emailJefeValido = Boolean(jefe && jefe.email && jefe.email.includes('@'));
          const emailSegundoValido = Boolean(segundoAprobador && segundoAprobador.email && segundoAprobador.email.includes('@'));

          const emailDestinatarioPrincipal = emailJefeValido ? jefe.email.trim() : correoAuditoria;
          const emailDestinatarioCopia = emailSegundoValido ? segundoAprobador.email.trim() : null;

          const nombreLider = emailJefeValido ? jefe.nombre : 'Líder / Gerencia de Área';
          const asuntoLider = `[Vacaciones Grupo JAMA] Confirmación de Trámite Concluido - ${colaborador.nombre} (Folio ${folio})`;

          const cuerpoLider = `
            <p style="margin:0 0 16px 0;">
              Estimado(a) <strong>${nombreLider}</strong>,
            </p>
            <p style="margin:0 0 16px 0;">
              Te confirmamos que el trámite de solicitud de vacaciones correspondiente al colaborador <strong>${colaborador.nombre}</strong> (Folio: <strong style="color:#002D62;">${folio}</strong>) ha sido <strong>revisado, validado y concluido satisfactoriamente por Desarrollo Organizacional</strong>.
            </p>
            <p style="margin:0 0 16px 0;">
              El período solicitado ha quedado formalmente formalizado en el sistema de nómina y en el calendario oficial de ausencias del área.
            </p>

            <!-- Resumen del Período Autorizado -->
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
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Folio Solicitud:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período Autorizado:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Disfrutados:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  ${totalDiasLaborables} días hábiles
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Saldo Restante del Colaborador:</td>
                <td style="padding:10px 14px; color:#059669; font-size:13px; font-weight:bold;">
                  ${saldoDisponible.toFixed(1)} días
                </td>
              </tr>
            </table>

            <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f8fafc; border:1px dashed #cbd5e1; padding:10px 14px; border-radius:8px;">
              📎 <strong>Archivo Adjunto:</strong> Se anexa el formato oficial <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> con todas las firmas y sellos institucionales completos para tu control y archivo del departamento.
            </p>

            <p style="margin:16px 0 0 0;">
              Puedes consultar el historial de este colaborador en la plataforma cuando lo requieras.
            </p>
          `;

          const htmlLider = generarPlantillaHtml({
            titulo: 'Confirmación de Trámite Concluido por DO',
            badgeTexto: 'Trámite Concluido por DO',
            badgeColor: '#002D62',
            badgeBg: '#eff6ff',
            badgeBorder: '#bfdbfe',
            cuerpoHtml: cuerpoLider,
            ctaTexto: 'Consultar en la Plataforma',
            ctaUrl: '/lider/aprobaciones'
          });

          await enviarEmail({
            to: emailDestinatarioPrincipal,
            cc: emailDestinatarioCopia,
            subject: asuntoLider,
            html: htmlLider,
            attachments,
            tipoEvento: 'CONCLUSION_DO_AUTORIZADORES',
            folioSolicitud: folio
          });
        } catch (errLider) {
          console.error(`[NOTIFICACIONES EMAIL] Error notificando conclusión a autorizadores (${folio}):`, errLider.message);
        }

        // 3. COPIA / CONFIRMACIÓN FORMAL A ADMIN_DO (María Vera - admin.rh@grupojama.com)
        try {
          const config = await obtenerConfiguracionEmail();
          const emailAdminDO = config.adminDoEmail || ADMIN_DO_DEFECTO.email;
          const nombreAdminDO = config.adminDoNombre || ADMIN_DO_DEFECTO.nombre;

          const asuntoAdminDO = `[Vacaciones Grupo JAMA] Trámite Concluido y Formalizado - ${colaborador.nombre} (Folio ${folio})`;

          const cuerpoAdminDO = `
            <p style="margin:0 0 16px 0;">
              Estimada <strong>${nombreAdminDO}</strong> (Desarrollo Organizacional),
            </p>
            <p style="margin:0 0 16px 0;">
              Te confirmamos que el trámite de solicitud de vacaciones correspondiente al colaborador <strong>${colaborador.nombre}</strong> (Folio: <strong style="color:#002D62;">${folio}</strong>) ha sido <strong>concluido y formalizado exitosamente por Desarrollo Organizacional</strong>.
            </p>
            <p style="margin:0 0 16px 0;">
              Los saldos de vacaciones han sido aplicados y el período ha quedado formalmente registrado en el sistema.
            </p>

            <!-- Resumen Institucional del Trámite Concluido -->
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
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Empresa / Sucursal:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:12px;">${colaborador.empresa} (${colaborador.sucursal})</td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Folio Solicitud:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#002D62; font-size:13px; font-weight:bold;">${folio}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Período Autorizado:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  Desde ${formatFecha(fechaInicio)} hasta ${formatFecha(fechaFin)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:12px; font-weight:600;">Días Disfrutados:</td>
                <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-size:13px; font-weight:bold;">
                  ${totalDiasLaborables} días hábiles
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px; color:#64748b; font-size:12px; font-weight:600;">Saldo Disponible Restante:</td>
                <td style="padding:10px 14px; color:#059669; font-size:13px; font-weight:bold;">
                  ${saldoDisponible.toFixed(1)} días
                </td>
              </tr>
            </table>

            <p style="margin:16px 0; font-size:12px; color:#475569; background-color:#f0fdf4; border:1px solid #bbf7d0; padding:12px 16px; border-radius:8px;">
              📎 <strong>Archivo Adjunto:</strong> Se anexa el formato institucional <code>FDO-84_Solicitud_${String(folio || idSolicitud).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</code> con todas las firmas y sellos digitales completos para el archivo y kardex del área.
            </p>
          `;

          const htmlAdminDO = generarPlantillaHtml({
            titulo: 'Confirmación de Trámite Formalizado por DO',
            badgeTexto: 'Trámite Concluido y Formalizado',
            badgeColor: '#002D62',
            badgeBg: '#eff6ff',
            badgeBorder: '#bfdbfe',
            cuerpoHtml: cuerpoAdminDO,
            ctaTexto: 'Ver Gestión de Vacaciones',
            ctaUrl: '/admin/gestion-vacaciones'
          });

          await enviarEmail({
            to: emailAdminDO,
            subject: asuntoAdminDO,
            html: htmlAdminDO,
            attachments,
            tipoEvento: 'CONCLUSION_DO_ADMIN',
            folioSolicitud: folio
          });
        } catch (errAdminDO) {
          console.error(`[NOTIFICACIONES EMAIL] Error notificando conclusión a Admin_DO (${folio}):`, errAdminDO.message);
        }

      } else {
        // =====================================================================
        // CASO B: SOLICITUD RECHAZADA / NO VALIDADA POR DO
        // =====================================================================

        // 1. AVISO AL COLABORADOR
        try {
          const emailColab = colaborador.email;
          if (emailColab && emailColab.includes('@')) {
            const asuntoColab = `[Vacaciones Grupo JAMA] Solicitud no validada por Desarrollo Organizacional - Folio ${folio}`;

            const cuerpoColab = `
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
                  "${motivoFinal || 'No cumple con las políticas o lineamientos de Desarrollo Organizacional.'}"
                </span>
              </div>

              <p style="margin:16px 0 0 0;">
                Los días correspondientes han sido reintegrados a tu saldo disponible. Para cualquier aclaración o seguimiento, por favor comunícate con el área de Desarrollo Organizacional.
              </p>
            `;

            const htmlColab = generarPlantillaHtml({
              titulo: 'Solicitud No Validada por DO',
              badgeTexto: 'No Validada por DO',
              badgeColor: '#991b1b',
              badgeBg: '#fef2f2',
              badgeBorder: '#fecaca',
              cuerpoHtml: cuerpoColab,
              ctaTexto: 'Ver Mi Portal',
              ctaUrl: '/portal'
            });

            await enviarEmail({
              to: emailColab,
              subject: asuntoColab,
              html: htmlColab,
              tipoEvento: 'RECHAZADA_DO_COLABORADOR',
              folioSolicitud: folio
            });
          }
        } catch (errColab) {
          console.error(`[NOTIFICACIONES EMAIL] Error notificando rechazo DO a colaborador (${folio}):`, errColab.message);
        }

        // 2. AVISO A LOS AUTORIZADORES
        try {
          const emailJefeValido = Boolean(jefe && jefe.email && jefe.email.includes('@'));
          const emailSegundoValido = Boolean(segundoAprobador && segundoAprobador.email && segundoAprobador.email.includes('@'));

          const emailDestinatarioPrincipal = emailJefeValido ? jefe.email.trim() : correoAuditoria;
          const emailDestinatarioCopia = emailSegundoValido ? segundoAprobador.email.trim() : null;

          const asuntoLider = `[Vacaciones Grupo JAMA] Notificación: Solicitud no validada por DO - ${colaborador.nombre} (Folio ${folio})`;

          const cuerpoLider = `
            <p style="margin:0 0 16px 0;">
              Estimado(a) <strong>${emailJefeValido ? jefe.nombre : 'Líder / Gerencia de Área'}</strong>,
            </p>
            <p style="margin:0 0 16px 0;">
              Te notificamos que la solicitud de vacaciones con folio <strong style="color:#0f172a;">${folio}</strong> correspondiente a <strong>${colaborador.nombre}</strong> (Período: ${formatFecha(fechaInicio)} al ${formatFecha(fechaFin)}) <strong>no fue validada por Desarrollo Organizacional</strong>.
            </p>

            <div style="background-color:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; padding:14px; border-radius:8px; margin:20px 0;">
              <span style="display:block; font-size:11px; font-weight:bold; color:#991b1b; text-transform:uppercase; margin-bottom:4px;">
                Motivo de la resolución de DO:
              </span>
              <span style="font-size:13px; color:#7f1d1d; font-weight:600;">
                "${motivoFinal || 'No cumple con las políticas o lineamientos de Desarrollo Organizacional.'}"
              </span>
            </div>

            <p style="margin:16px 0 0 0;">
              Los días solicitados han sido reincorporados al saldo del colaborador. Esta notificación es de carácter informativo para tu control operativo.
            </p>
          `;

          const htmlLider = generarPlantillaHtml({
            titulo: 'Solicitud No Validada por DO',
            badgeTexto: 'No Validada por DO',
            badgeColor: '#991b1b',
            badgeBg: '#fef2f2',
            badgeBorder: '#fecaca',
            cuerpoHtml: cuerpoLider,
            ctaTexto: 'Consultar en la Plataforma',
            ctaUrl: '/lider/aprobaciones'
          });

          await enviarEmail({
            to: emailDestinatarioPrincipal,
            cc: emailDestinatarioCopia,
            subject: asuntoLider,
            html: htmlLider,
            tipoEvento: 'RECHAZADA_DO_AUTORIZADORES',
            folioSolicitud: folio
          });
        } catch (errLider) {
          console.error(`[NOTIFICACIONES EMAIL] Error notificando rechazo DO a autorizadores (${folio}):`, errLider.message);
        }
      }

    } catch (err) {
      console.error('[NOTIFICACIONES EMAIL] Error general en notificarConclusionDO:', err.message);
    }
  }
};

emailService.crearTransportadorSmtp = crearTransportadorSmtp;
emailService.obtenerConfiguracionEmail = obtenerConfiguracionEmail;
emailService.registrarLogEnvio = registrarLogEnvio;
emailService.enviarEmail = enviarEmail;
emailService.obtenerDatosSolicitud = obtenerDatosSolicitud;
emailService.obtenerAdjuntoPdfFdo84 = obtenerAdjuntoPdfFdo84;

module.exports = emailService;
