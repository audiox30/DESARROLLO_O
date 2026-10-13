const mockStore = require('../data/mockStore');
const { getPool, isUsingMock } = require('../config/database');
const emailService = require('../services/emailService');

const aprobacionesController = {
  aprobar: async (req, res) => {
    try {
      const { id } = req.params;
      const { comentarios, metodoAutorizacion = 'WEB' } = req.body;
      const idAprobador = req.user.id;

      if (isUsingMock()) {
        const actualizada = mockStore.aprobarSolicitud(id, idAprobador, comentarios, metodoAutorizacion);

        // Notificación por correo al colaborador (Evento B)
        setImmediate(() => {
          emailService.notificarSolicitudAprobada(id).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.json({
          success: true,
          message: actualizada.estado === 'APROBADA' 
            ? '¡Solicitud aprobada exitosamente y saldo de vacaciones descontado!' 
            : 'Solicitud autorizada por Líder. Enviada a VoBo de Desarrollo Organizacional.',
          solicitud: actualizada
        });
      } else {
        const pool = await getPool();
        const request = pool.request();
        request.input('IdSolicitud', id);
        request.input('IdAprobador', idAprobador);
        request.input('Accion', 'APROBADA');
        request.input('Comentarios', comentarios || null);
        request.input('MetodoAutorizacion', metodoAutorizacion);

        await request.execute('dbo.sp_ProcesarAprobacionSolicitud');

        const stateCheck = await pool.request()
          .input('IdSolicitud', id)
          .query('SELECT Estado, Folio FROM dbo.SolicitudesVacaciones WHERE IdSolicitud = @IdSolicitud');
        const estadoFinal = stateCheck.recordset[0]?.Estado || 'APROBADA';

        // Disparo de notificación según el estado resultante (Nivel 2 o Final)
        setImmediate(() => {
          if (estadoFinal === 'PENDIENTE_GERENTE') {
            emailService.notificarSolicitudPendienteGerente(id).catch(err => {
              console.error('[EMAIL NOTIFICACION ERROR]', err);
            });
          } else if (estadoFinal === 'APROBADA') {
            emailService.notificarSolicitudAprobada(id).catch(err => {
              console.error('[EMAIL NOTIFICACION ERROR]', err);
            });
          }
        });

        const msg = estadoFinal === 'PENDIENTE_GERENTE'
          ? 'Visto Bueno Nivel 1 (Jefe Directo) registrado con éxito. Solicitud transferida a Autorización Gerencial (Nivel 2).'
          : '¡Solicitud aprobada exitosamente y saldo de vacaciones descontado!';

        return res.json({
          success: true,
          message: msg,
          estado: estadoFinal
        });
      }
    } catch (err) {
      console.error('[aprobaciones.aprobar]', err);
      res.status(400).json({ error: err.message });
    }
  },

  rechazar: async (req, res) => {
    try {
      const { id } = req.params;
      const { motivoRechazo, comentarios, metodoAutorizacion = 'WEB' } = req.body;
      const idAprobador = req.user.id;

      const razon = motivoRechazo || comentarios;
      if (!razon || !razon.trim()) {
        return res.status(400).json({ error: 'El motivo de rechazo es obligatorio.' });
      }

      if (isUsingMock()) {
        const rechazada = mockStore.rechazarSolicitud(id, idAprobador, razon, metodoAutorizacion);

        // Notificación por correo al colaborador con motivo (Evento C)
        setImmediate(() => {
          emailService.notificarSolicitudRechazada(id, razon.trim()).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.json({
          success: true,
          message: 'Solicitud rechazada. Se ha notificado al colaborador con el motivo correspondiente.',
          solicitud: rechazada
        });
      } else {
        const pool = await getPool();
        const request = pool.request();
        request.input('IdSolicitud', id);
        request.input('IdAprobador', idAprobador);
        request.input('Accion', 'RECHAZADA');
        request.input('Comentarios', razon.trim());
        request.input('MetodoAutorizacion', metodoAutorizacion);

        await request.execute('dbo.sp_ProcesarAprobacionSolicitud');

        // Notificación por correo al colaborador con motivo (Evento C)
        setImmediate(() => {
          emailService.notificarSolicitudRechazada(id, razon.trim()).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.json({
          success: true,
          message: 'Solicitud rechazada debidamente en SQL Server.'
        });
      }
    } catch (err) {
      console.error('[aprobaciones.rechazar]', err);
      res.status(400).json({ error: err.message });
    }
  },

  simularNotificacionTeams: async (req, res) => {
    try {
      const { idSolicitud } = req.body;
      const sol = mockStore.solicitudes.find(s => s.idSolicitud === Number(idSolicitud));
      if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada' });

      // Simula el envío de una Adaptive Card a Microsoft Teams según la especificación del PDF de Grupo JAMA
      const adaptiveCardPayload = {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "TextBlock",
            text: "🔔 Solicitud de Vacaciones - Grupo JAMA",
            weight: "Bolder",
            size: "Medium",
            color: "Accent"
          },
          {
            type: "FactSet",
            facts: [
              { title: "Colaborador:", value: sol.colaboradorNombre },
              { title: "Puesto:", value: sol.colaboradorPuesto },
              { title: "Período:", value: `${sol.fechaInicio} al ${sol.fechaFin}` },
              { title: "Días Hábiles:", value: `${sol.totalDiasLaborables} días` },
              { title: "Folio:", value: sol.folio }
            ]
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "Autorizar en 1 Clic (Portal Web)",
            url: `http://localhost:3000/#aprobaciones?id=${sol.idSolicitud}`
          }
        ]
      };

      return res.json({
        success: true,
        message: 'Tarjeta adaptable (Adaptive Card) de Microsoft Teams generada con éxito.',
        payload: adaptiveCardPayload
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = aprobacionesController;
