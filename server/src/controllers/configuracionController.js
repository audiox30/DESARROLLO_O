const nodemailer = require('nodemailer');
const { getLocalPool, isUsingMock } = require('../config/database');
const { crearTransportadorSmtp, registrarLogEnvio } = require('../services/emailService');
const vigenciaAlertasService = require('../services/vigenciaAlertasService');

const configuracionController = {
  /**
   * GET /api/admin/configuracion
   * Retorna todos los parámetros de configuración del sistema
   */
  getConfiguracion: async (req, res) => {
    try {
      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        const mockConfig = [
          { Clave: 'CONTPAQI_SERVER', Valor: '192.168.20.15', Descripcion: 'Dirección IP o Host del servidor SQL de CONTPAQi Nóminas', Categoria: 'CONTPAQI' },
          { Clave: 'CONTPAQI_PORT', Valor: '1433', Descripcion: 'Puerto de conexión TCP de SQL Server Nóminas', Categoria: 'CONTPAQI' },
          { Clave: 'CONTPAQI_DB_MATRIZ', Valor: 'Nomipaq', Descripcion: 'Nombre de la base de datos matriz o catálogo de empresas', Categoria: 'CONTPAQI' },
          { Clave: 'CONTPAQI_SYNC_AUTO', Valor: 'true', Descripcion: 'Sincronización automática periódica activada', Categoria: 'CONTPAQI' },
          { Clave: 'CONTPAQI_SYNC_HORA', Valor: '02:00', Descripcion: 'Hora programada para sincronización nocturna (HH:mm)', Categoria: 'CONTPAQI' },
          { Clave: 'SMTP_HOST', Valor: '192.168.20.29', Descripcion: 'Servidor de Relay SMTP (IP o FQDN)', Categoria: 'EMAIL' },
          { Clave: 'SMTP_PORT', Valor: '25', Descripcion: 'Puerto del servicio SMTP (587 TLS / 465 SSL / 25 Relay)', Categoria: 'EMAIL' },
          { Clave: 'SMTP_USER', Valor: 'notificaciones@grupojama.com.mx', Descripcion: 'Usuario o cuenta de correo remitente autenticado', Categoria: 'EMAIL' },
          { Clave: 'SMTP_PASS', Valor: '', Descripcion: 'Contraseña de la cuenta de correo', Categoria: 'EMAIL' },
          { Clave: 'SMTP_SECURE', Valor: 'false', Descripcion: 'Conexión SSL/TLS directa', Categoria: 'EMAIL' },
          { Clave: 'SMTP_FROM_NAME', Valor: 'Control de Vacaciones Grupo JAMA', Descripcion: 'Nombre del remitente institucional en los correos', Categoria: 'EMAIL' },
          { Clave: 'SMTP_NOTIF_ENABLED', Valor: 'true', Descripcion: 'Envío activo de notificaciones automáticas por correo', Categoria: 'EMAIL' },
          { Clave: 'VAC_DIAS_AVISO_MINIMO', Valor: '15', Descripcion: 'Días mínimos de anticipación para solicitar vacaciones', Categoria: 'VACACIONES' },
          { Clave: 'VAC_MESES_CADUCIDAD_LFT', Valor: '18', Descripcion: 'Meses legales de vigencia tras cumplir el aniversario (LFT)', Categoria: 'VACACIONES' },
          { Clave: 'VAC_BLOQUEO_SALDO_NEGATIVO', Valor: 'true', Descripcion: 'Bloquear solicitudes que excedan el saldo disponible', Categoria: 'VACACIONES' },
          { Clave: 'VAC_PERMITIR_MEDIOS_DIAS', Valor: 'false', Descripcion: 'Permitir solicitudes por medios días laborales', Categoria: 'VACACIONES' },
          { Clave: 'VAC_HORA_CORTE_SOLICITUD', Valor: '17:00', Descripcion: 'Hora límite de registro de solicitudes para el mismo día', Categoria: 'VACACIONES' },
          { Clave: 'SYS_AUDITORIA_DIAS_RETENCION', Valor: '90', Descripcion: 'Días de retención para bitácora de accesos y aprobaciones', Categoria: 'MANTENIMIENTO' },
          { Clave: 'SYS_NAS_BACKUP_PATH', Valor: '\\\\192.168.20.20\\Backups\\Vacaciones', Descripcion: 'Ruta de almacenamiento de respaldos en Synology NAS', Categoria: 'MANTENIMIENTO' },
          { Clave: 'SYS_NAS_BACKUP_AUTO', Valor: 'true', Descripcion: 'Respaldo automático nocturno programado', Categoria: 'MANTENIMIENTO' },
          { Clave: 'SYS_LIMPIEZA_TOKENS_DIAS', Valor: '7', Descripcion: 'Días para purgar tokens de sesión expirados', Categoria: 'MANTENIMIENTO' }
        ];
        const valores = {};
        mockConfig.forEach(c => { valores[c.Clave] = c.Valor; });
        return res.json({ success: true, configuraciones: mockConfig, valores });
      }

      const result = await pool.request().query(`
        SELECT 
          Clave, Valor, Descripcion, Categoria,
          CONVERT(VARCHAR(19), FechaActualizacion, 120) AS FechaActualizacion,
          ActualizadoPor
        FROM dbo.ConfiguracionSistema
        ORDER BY Categoria, Clave;
      `);

      const configuraciones = result.recordset || [];
      const valores = {};
      configuraciones.forEach(c => {
        valores[c.Clave] = c.Valor;
      });

      return res.json({
        success: true,
        total: configuraciones.length,
        configuraciones,
        valores
      });
    } catch (err) {
      console.error('[configuracion.getConfiguracion]', err);
      res.status(500).json({ error: 'Error al consultar parámetros de configuración del sistema.' });
    }
  },

  /**
   * PUT /api/admin/configuracion
   * Actualiza parámetros en dbo.ConfiguracionSistema
   */
  updateConfiguracion: async (req, res) => {
    try {
      const pool = await getLocalPool();
      const usuario = req.user?.username || req.user?.CodigoEmpleado || 'SISTEMAS';
      const { valores, configuraciones } = req.body;

      const itemsToUpdate = [];

      if (valores && typeof valores === 'object') {
        Object.entries(valores).forEach(([clave, valor]) => {
          itemsToUpdate.push({ Clave: clave, Valor: valor !== null && valor !== undefined ? String(valor) : '' });
        });
      } else if (Array.isArray(configuraciones)) {
        configuraciones.forEach(item => {
          if (item && item.Clave) {
            itemsToUpdate.push({ Clave: item.Clave, Valor: item.Valor !== null && item.Valor !== undefined ? String(item.Valor) : '' });
          }
        });
      }

      if (itemsToUpdate.length === 0) {
        return res.status(400).json({ error: 'No se enviaron parámetros válidos para actualizar.' });
      }

      if (pool && !isUsingMock()) {
        const transaction = pool.transaction();
        await transaction.begin();

        try {
          for (const item of itemsToUpdate) {
            await transaction.request()
              .input('Clave', item.Clave)
              .input('Valor', item.Valor)
              .input('Usuario', usuario)
              .query(`
                UPDATE dbo.ConfiguracionSistema
                SET Valor = @Valor,
                    FechaActualizacion = SYSUTCDATETIME(),
                    ActualizadoPor = @Usuario
                WHERE Clave = @Clave;
              `);
          }

          await transaction.commit();
        } catch (trxErr) {
          await transaction.rollback();
          throw trxErr;
        }
      }

      return res.json({
        success: true,
        message: `Se actualizaron ${itemsToUpdate.length} parámetros de configuración del sistema exitosamente.`,
        actualizados: itemsToUpdate.length
      });
    } catch (err) {
      console.error('[configuracion.updateConfiguracion]', err);
      res.status(500).json({ error: 'Error al guardar configuración del sistema: ' + err.message });
    }
  },

  /**
   * POST /api/admin/configuracion/probar-correo
   * Ejecuta prueba de conectividad y envío con Nodemailer
   */
  probarCorreo: async (req, res) => {
    try {
      const pool = await getLocalPool();
      let {
        host,
        port,
        user,
        pass,
        secure,
        fromName,
        destinatario
      } = req.body;

      // Si no vienen en el body, cargar desde la base de datos
      if (!host && pool && !isUsingMock()) {
        const configDb = await pool.request().query(`
          SELECT Clave, Valor FROM dbo.ConfiguracionSistema WHERE Categoria = 'EMAIL';
        `);
        const map = {};
        (configDb.recordset || []).forEach(r => { map[r.Clave] = r.Valor; });
        host = host || map['SMTP_HOST'];
        port = port || map['SMTP_PORT'];
        user = user || map['SMTP_USER'];
        pass = pass || map['SMTP_PASS'];
        secure = secure !== undefined ? secure : map['SMTP_SECURE'];
        fromName = fromName || map['SMTP_FROM_NAME'];
      }

      // Parámetros por defecto
      host = host || process.env.SMTP_HOST || '192.168.20.16';
      port = parseInt(port || process.env.SMTP_PORT || '25', 10);
      user = user !== undefined ? user : (process.env.SMTP_USER || '');
      pass = pass !== undefined ? pass : (process.env.SMTP_PASS || '');
      const isSecure = secure === true || secure === 'true' || port === 465;
      const rawFrom = process.env.SMTP_FROM || `${fromName || 'Control de Vacaciones Grupo JAMA'} <${user || 'comprobante.fiscal@grupojamacfdi.com'}>`;
      const remitente = rawFrom.replace(/^["']|["']$/g, '');
      const targetEmail = destinatario || req.user?.email || req.user?.Email || 'soporte@grupojama.com';

      if (!host) {
        return res.status(400).json({
          success: false,
          error: 'No se ha configurado el Servidor SMTP (Host vacío). Ingrese una dirección IP o FQDN válido.'
        });
      }

      const transporter = crearTransportadorSmtp({
        host,
        port,
        user,
        pass,
        secure: isSecure
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Prueba de Conectividad SMTP - Grupo JAMA</title>
        </head>
        <body style="margin:0; padding:0; background-color:#F4F7F9; font-family:Arial, 'Segoe UI', Tahoma, sans-serif; -webkit-font-smoothing:antialiased; color:#333333;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F7F9; padding:24px 12px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #002D62; box-shadow:0 4px 12px rgba(0, 45, 98, 0.08);">
                  
                  <!-- Cabecera Institucional Azul Marino #002D62 -->
                  <tr>
                    <td style="background-color:#002D62; padding:28px 24px; text-align:center;">
                      <a href="https://www.grupojama.com" target="_blank" style="text-decoration:none; display:inline-block;">
                        <img src="https://www.grupojama.com/img/logo.png" alt="Grupo JAMA" width="160" style="max-width:160px; height:auto; display:block; margin:0 auto;" border="0" />
                      </a>
                      <p style="margin:12px 0 0 0; color:#E2E8F0; font-size:12px; font-weight:600; letter-spacing:0.8px; text-transform:uppercase; font-family:Arial, 'Segoe UI', sans-serif;">
                        Control de Vacaciones • Sistema Corporativo
                      </p>
                    </td>
                  </tr>

                  <!-- Tarjeta Blanca Interior -->
                  <tr>
                    <td style="background-color:#ffffff; padding:24px;">
                      <div style="margin-bottom:16px;">
                        <span style="display:inline-block; padding:4px 12px; font-size:11px; font-weight:bold; border-radius:9999px; text-transform:uppercase; letter-spacing:0.5px; color:#065f46; background-color:#ecfdf5; border:1px solid #a7f3d0; font-family:Arial, 'Segoe UI', sans-serif;">
                          ✓ PRUEBA DE CONECTIVIDAD SMTP EXITOSA
                        </span>
                      </div>

                      <h1 style="color:#002D62; font-size:19px; font-weight:bold; margin:0 0 16px 0; line-height:1.35; font-family:Arial, 'Segoe UI', sans-serif;">
                        Confirmación de Notificaciones por Correo
                      </h1>

                      <p style="color:#475569; font-size:13px; line-height:1.6; margin:0 0 20px 0; font-family:Arial, 'Segoe UI', sans-serif;">
                        Este es un correo de comprobación emitido desde el <strong>Panel de Configuración Global de Sistemas</strong> para verificar la comunicación con el servidor de correo institucional.
                      </p>

                      <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:16px; margin-bottom:20px;">
                        <table style="width:100%; font-size:12px; color:#334155; border-collapse:collapse; font-family:Arial, 'Segoe UI', sans-serif;">
                          <tr><td style="padding:4px 0; font-weight:600; width:140px; color:#64748b;">Servidor SMTP:</td><td><strong>${host}:${port}</strong></td></tr>
                          <tr><td style="padding:4px 0; font-weight:600; color:#64748b;">Seguridad SSL/TLS:</td><td>${isSecure ? 'SSL Directo (Puerto 465)' : 'STARTTLS / Relay Local (Puerto 25)'}</td></tr>
                          <tr><td style="padding:4px 0; font-weight:600; color:#64748b;">Cuenta Remitente:</td><td>${user || 'Sin autenticación (Relay Anónimo)'}</td></tr>
                          <tr><td style="padding:4px 0; font-weight:600; color:#64748b;">Destinatario Previsto:</td><td>${targetEmail}</td></tr>
                          <tr><td style="padding:4px 0; font-weight:600; color:#64748b;">Fecha / Hora:</td><td>${new Date().toLocaleString('es-MX')}</td></tr>
                        </table>
                      </div>

                      <p style="color:#64748b; font-size:12px; margin:0; line-height:1.5; font-family:Arial, 'Segoe UI', sans-serif;">
                        Las alertas de solicitudes, autorizaciones de líderes y Vo.Bo. de Desarrollo Organizacional operarán bajo esta plantilla institucional.
                      </p>
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
      `;

      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();
      const destinatarioEfectivo = modoAuditoria ? correoAuditoria : targetEmail;

      const info = await transporter.sendMail({
        from: remitente,
        to: destinatarioEfectivo,
        subject: `[PRUEBA TI] Notificación del Sistema de Vacaciones - Grupo JAMA`,
        html: htmlContent
      });

      if (registrarLogEnvio) {
        await registrarLogEnvio({
          destinatarioOriginal: targetEmail,
          destinatarioEfectivo,
          asunto: '[PRUEBA TI] Notificación del Sistema de Vacaciones - Grupo JAMA',
          tipoEvento: 'PRUEBA_TI',
          folioSolicitud: null,
          estatusEnvio: 'EXITO',
          messageId: info.messageId
        });
      }

      return res.json({
        success: true,
        message: `Prueba de correo enviada exitosamente a ${destinatarioEfectivo} ${modoAuditoria ? `(Previsto: ${targetEmail})` : ''}.`,
        messageId: info.messageId,
        detalles: {
          servidor: `${host}:${port}`,
          seguro: isSecure,
          remitente,
          destinatarioOriginal: targetEmail,
          destinatarioEfectivo,
          modoAuditoria
        }
      });
    } catch (err) {
      console.error('[configuracion.probarCorreo]', err);
      const modoAuditoria = process.env.MODO_PRUEBAS_CORREO === 'true' || Boolean(process.env.CORREO_AUDITORIA);
      const correoAuditoria = (process.env.CORREO_AUDITORIA || 'soporte@grupojama.com').trim();
      const targetEmail = req.body?.destinatario || req.user?.email || 'sistemas@grupojama.com.mx';

      if (registrarLogEnvio) {
        await registrarLogEnvio({
          destinatarioOriginal: targetEmail,
          destinatarioEfectivo: modoAuditoria ? correoAuditoria : targetEmail,
          asunto: '[PRUEBA TI] Notificación del Sistema de Vacaciones - Grupo JAMA',
          tipoEvento: 'PRUEBA_TI',
          folioSolicitud: null,
          estatusEnvio: 'ERROR',
          mensajeError: err.message
        });
      }

      return res.status(500).json({
        success: false,
        error: `Fallo en prueba de envío SMTP: ${err.message}`,
        detalles: {
          code: err.code,
          command: err.command,
          response: err.response
        }
      });
    }
  },

  /**
   * GET /api/admin/configuracion/log-correos
   * Consulta el registro histórico de auditoría de correos enviados en dbo.LogCorreosEnviados
   */
  getLogCorreos: async (req, res) => {
    try {
      const { limite = 100, estatus, busqueda } = req.query;
      const pool = await getLocalPool();

      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        let logs = mockStore.logCorreosEnviados || [];
        if (estatus && estatus !== 'TODOS') {
          logs = logs.filter(l => l.estatusEnvio === estatus);
        }
        if (busqueda && busqueda.trim()) {
          const q = busqueda.toLowerCase().trim();
          logs = logs.filter(l => 
            (l.destinatarioOriginal && l.destinatarioOriginal.toLowerCase().includes(q)) ||
            (l.destinatarioEfectivo && l.destinatarioEfectivo.toLowerCase().includes(q)) ||
            (l.asunto && l.asunto.toLowerCase().includes(q)) ||
            (l.folioSolicitud && l.folioSolicitud.toLowerCase().includes(q))
          );
        }
        return res.json({
          success: true,
          total: logs.length,
          data: logs.slice(0, parseInt(limite, 10))
        });
      }

      let query = `
        SELECT TOP (@Limite)
          IdLog AS idLog,
          DestinatarioOriginal AS destinatarioOriginal,
          DestinatarioEfectivo AS destinatarioEfectivo,
          Asunto AS asunto,
          TipoEvento AS tipoEvento,
          FolioSolicitud AS folioSolicitud,
          EstatusEnvio AS estatusEnvio,
          MensajeError AS mensajeError,
          MessageId AS messageId,
          CONVERT(VARCHAR(19), FechaEnvio, 120) AS fechaEnvio
        FROM dbo.LogCorreosEnviados
        WHERE 1 = 1
      `;

      const request = pool.request();
      request.input('Limite', parseInt(limite, 10) || 100);

      if (estatus && estatus !== 'TODOS') {
        query += ` AND EstatusEnvio = @Estatus`;
        request.input('Estatus', estatus);
      }

      if (busqueda && busqueda.trim()) {
        query += ` AND (
          DestinatarioOriginal LIKE @Busqueda
          OR DestinatarioEfectivo LIKE @Busqueda
          OR Asunto LIKE @Busqueda
          OR FolioSolicitud LIKE @Busqueda
        )`;
        request.input('Busqueda', `%${busqueda.trim()}%`);
      }

      query += ` ORDER BY FechaEnvio DESC`;

      const result = await request.query(query);

      return res.json({
        success: true,
        total: result.recordset.length,
        data: result.recordset
      });
    } catch (err) {
      console.error('[configuracion.getLogCorreos]', err);
      res.status(500).json({ error: 'Error al consultar log de auditoría de correos.' });
    }
  },

  /**
   * POST /api/admin/configuracion/avisos-vigencia/ejecutar
   * Dispara el barrido manual o simulación de avisos de vigencia
   */
  ejecutarAvisosVigencia: async (req, res) => {
    try {
      const { simular = false, forzarEnvio = false } = req.body || {};
      const resultado = await vigenciaAlertasService.evaluarYEnviarAvisos({ simular, forzarEnvio });
      return res.json(resultado);
    } catch (err) {
      console.error('[configuracion.ejecutarAvisosVigencia]', err);
      res.status(500).json({ error: err.message || 'Error al ejecutar barrido de avisos de vigencia.' });
    }
  },

  /**
   * GET /api/admin/configuracion/avisos-vigencia/logs
   * Consulta la bitácora de dbo.LogAvisosVigenciaEnviados
   */
  getLogsAvisosVigencia: async (req, res) => {
    try {
      const resultado = await vigenciaAlertasService.getBitacoraAvisos(req.query);
      return res.json(resultado);
    } catch (err) {
      console.error('[configuracion.getLogsAvisosVigencia]', err);
      res.status(500).json({ error: 'Error al consultar bitácora de avisos de vigencia.' });
    }
  }
};

module.exports = configuracionController;
