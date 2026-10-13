const mockStore = require('../data/mockStore');
const { getPool, isUsingMock, sql } = require('../config/database');
const { calcularDetalleDias } = require('../services/diasHabilesService');
const emailService = require('../services/emailService');
const { generarPdfFdo84 } = require('../services/pdfFdo84Service');

function formatearSolicitud(s) {
  if (!s) return s;
  const id = Number(s.IdSolicitud ?? s.idSolicitud ?? s.id);
  const folio = s.Folio ?? s.folio ?? (id ? `VAC-${id}` : '');
  
  const fechaInicioStr = s.FechaInicio 
    ? (typeof s.FechaInicio === 'string' ? s.FechaInicio.substring(0, 10) : new Date(s.FechaInicio).toISOString().substring(0, 10))
    : (s.fechaInicio || '');
  const fechaFinStr = s.FechaFin 
    ? (typeof s.FechaFin === 'string' ? s.FechaFin.substring(0, 10) : new Date(s.FechaFin).toISOString().substring(0, 10))
    : (s.fechaFin || '');
  const fechaCreacionStr = s.FechaCreacion 
    ? (typeof s.FechaCreacion === 'string' ? s.FechaCreacion : new Date(s.FechaCreacion).toISOString())
    : (s.fechaCreacion || new Date().toISOString());

  const totalDias = Number(s.TotalDiasLaborables ?? s.totalDiasLaborables ?? s.diasHabiles ?? s.total_dias ?? 0);
  const estado = s.Estado ?? s.estado ?? 'PENDIENTE_LIDER';
  const motivoComentarios = s.MotivoComentarios ?? s.motivoComentarios ?? '';
  const motivoRechazo = s.MotivoRechazo ?? s.motivoRechazo ?? null;
  const fechaResolucion = s.FechaResolucion ?? s.fechaResolucion ?? null;

  return {
    ...s,
    // CamelCase normalizado
    idSolicitud: id,
    id: id,
    folio,
    fechaInicio: fechaInicioStr,
    fechaFin: fechaFinStr,
    totalDiasLaborables: totalDias,
    diasHabiles: totalDias,
    total_dias: totalDias,
    fechaCreacion: fechaCreacionStr,
    estado,
    estatus: estado,
    motivoComentarios,
    motivoRechazo,
    fechaResolucion,
    colaboradorNombre: s.ColaboradorNombre || s.NombreCompleto || s.colaboradorNombre || '',
    codigoEmpleado: s.CodigoEmpleado || s.codigoEmpleado || '',
    // PascalCase para compatibilidad
    IdSolicitud: id,
    Folio: folio,
    FechaInicio: fechaInicioStr,
    FechaFin: fechaFinStr,
    TotalDiasLaborables: totalDias,
    FechaCreacion: fechaCreacionStr,
    Estado: estado,
    MotivoComentarios: motivoComentarios,
    MotivoRechazo: motivoRechazo,
    FechaResolucion: fechaResolucion
  };
}

const solicitudesController = {
  create: async (req, res) => {
    try {
      const { fechaInicio, fechaFin, motivoComentarios } = req.body;
      const idColaborador = req.user.id_colaborador || req.user.id;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Las fechas de inicio y fin son obligatorias.' });
      }

      if (isUsingMock()) {
        const solicitud = mockStore.crearSolicitud(idColaborador, fechaInicio, fechaFin, motivoComentarios);
        setImmediate(() => {
          emailService.notificarNuevaSolicitud(solicitud.idSolicitud).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.status(201).json({
          success: true,
          message: `Solicitud registrada con éxito. Folio generado: ${solicitud.folio}`,
          solicitud: formatearSolicitud(solicitud)
        });
      } else {
        const pool = await getPool();
        const request = pool.request();
        request.input('IdColaborador', idColaborador);
        request.input('FechaInicio', fechaInicio);
        request.input('FechaFin', fechaFin);
        request.input('MotivoComentarios', motivoComentarios || '');
        request.output('IdSolicitudCreada', sql.Int);
        request.output('FolioGenerado', sql.VarChar(30));

        const result = await request.execute('dbo.sp_RegistrarSolicitudVacaciones');
        const idSolicitudCreada = result.output.IdSolicitudCreada;

        // Disparo desacoplado / asíncrono de notificación por correo (Evento A)
        setImmediate(() => {
          emailService.notificarNuevaSolicitud(idSolicitudCreada).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.status(201).json({
          success: true,
          message: `Solicitud creada con éxito. Folio: ${result.output.FolioGenerado}`,
          folio: result.output.FolioGenerado,
          idSolicitud: idSolicitudCreada
        });
      }
    } catch (err) {
      console.error('[solicitudes.create]', err);
      res.status(400).json({ error: err.message });
    }
  },

  getMisSolicitudes: async (req, res) => {
    try {
      const idColaborador = req.user.id_colaborador || req.user.id;

      if (isUsingMock()) {
        const mis = mockStore.solicitudes.filter(s => s.idColaborador === Number(idColaborador));
        return res.json({ success: true, total: mis.length, data: mis.map(formatearSolicitud) });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('IdColaborador', idColaborador)
          .query(`
            SELECT 
              s.IdSolicitud,
              s.Folio,
              s.IdColaborador,
              CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
              CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
              ISNULL(s.TotalDiasLaborables, 0) AS TotalDiasLaborables,
              s.MotivoComentarios,
              s.Estado,
              s.MotivoRechazo,
              CONVERT(VARCHAR(19), s.FechaResolucion, 120) AS FechaResolucion,
              CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
              s.IdAprobadorLider,
              CONVERT(VARCHAR(19), s.FechaAprobacionLider, 120) AS FechaAprobacionLider,
              s.IdAprobadorSegundo,
              CONVERT(VARCHAR(19), s.FechaAprobacionSegundo, 120) AS FechaAprobacionSegundo,
              c.NombreCompleto AS ColaboradorNombre, 
              c.CodigoEmpleado
            FROM dbo.SolicitudesVacaciones s
            JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
            WHERE s.IdColaborador = @IdColaborador
            ORDER BY s.FechaCreacion DESC
          `);
        const data = result.recordset.map(formatearSolicitud);
        return res.json({ success: true, total: data.length, data });
      }
    } catch (err) {
      console.error('[solicitudes.getMisSolicitudes]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getByColaborador: async (req, res) => {
    try {
      const { id } = req.params;
      const targetId = Number(id);

      if (isUsingMock()) {
        const mis = mockStore.solicitudes.filter(s => s.idColaborador === targetId);
        return res.json({ success: true, total: mis.length, data: mis.map(formatearSolicitud) });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('TargetId', targetId)
          .query(`
            SELECT 
              s.IdSolicitud,
              s.Folio,
              s.IdColaborador,
              CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
              CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
              ISNULL(s.TotalDiasLaborables, 0) AS TotalDiasLaborables,
              s.MotivoComentarios,
              s.Estado,
              s.MotivoRechazo,
              CONVERT(VARCHAR(19), s.FechaResolucion, 120) AS FechaResolucion,
              CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
              c.NombreCompleto AS ColaboradorNombre, 
              c.CodigoEmpleado
            FROM dbo.SolicitudesVacaciones s
            JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
            WHERE s.IdColaborador = @TargetId
            ORDER BY s.FechaCreacion DESC
          `);
        const data = result.recordset.map(formatearSolicitud);
        return res.json({ success: true, total: data.length, data });
      }
    } catch (err) {
      console.error('[solicitudes.getByColaborador]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getBandejaLider: async (req, res) => {
    try {
      const idLider = req.user.id_colaborador || req.user.id;

      if (isUsingMock()) {
        // En mock mode: si es líder, mostrar pendientes de su equipo o todas las pendientes para demostración
        let pendientes = mockStore.solicitudes.filter(s => 
          s.estado === 'PENDIENTE_LIDER' && (s.idJefeDirecto === Number(idLider) || req.user.rolApp === 'LIDER' || req.user.rolApp === 'ADMIN_DO')
        );

        return res.json({ success: true, total: pendientes.length, data: pendientes.map(formatearSolicitud) });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('IdLider', idLider)
          .query(`
            SELECT s.*, 
                   CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
                   CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
                   CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
                   c.NombreCompleto, c.CodigoEmpleado, p.Nombre AS Puesto, d.Nombre AS Departamento,
                   CASE WHEN s.Estado = 'PENDIENTE_GERENTE' THEN 2 ELSE 1 END AS NivelAprobacionRequerido
            FROM dbo.SolicitudesVacaciones s
            JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            WHERE 
              (@IdLider IN (SELECT IdColaborador FROM dbo.Colaboradores WHERE RolApp IN ('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS')) AND s.Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE'))
              OR (s.Estado = 'PENDIENTE_LIDER' AND c.IdJefeDirecto = @IdLider)
              OR (s.Estado = 'PENDIENTE_GERENTE' AND c.IdAprobadorSegundo = @IdLider)
            ORDER BY s.FechaCreacion ASC
          `);
        const data = result.recordset.map(formatearSolicitud);
        return res.json({ success: true, total: data.length, data });
      }
    } catch (err) {
      console.error('[solicitudes.getBandejaLider]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getBandejaDO: async (req, res) => {
    try {
      const { estado, departamento, empresa } = req.query;

      if (isUsingMock()) {
        let todas = [...mockStore.solicitudes];

        if (estado && estado !== 'TODAS') {
          todas = todas.filter(s => s.estado === estado);
        }
        if (departamento) {
          todas = todas.filter(s => s.colaboradorDepartamento === departamento);
        }
        if (empresa) {
          todas = todas.filter(s => s.colaboradorEmpresa === empresa);
        }

        return res.json({ success: true, total: todas.length, data: todas.map(formatearSolicitud) });
      } else {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT s.*, 
                 CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
                 CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
                 CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
                 c.NombreCompleto, c.CodigoEmpleado, c.Empresa, c.Sucursal,
                 p.Nombre AS Puesto, d.Nombre AS Departamento
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          ORDER BY s.FechaCreacion DESC
        `);
        const data = result.recordset.map(formatearSolicitud);
        return res.json({ success: true, total: data.length, data });
      }
    } catch (err) {
      console.error('[solicitudes.getBandejaDO]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;

      if (isUsingMock()) {
        const solicitud = mockStore.solicitudes.find(s => s.idSolicitud === Number(id));
        if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

        const historial = mockStore.historialAprobaciones.filter(h => h.idSolicitud === solicitud.idSolicitud);
        const map = mockStore.getDiasInhabilesMap();
        const detalleDias = calcularDetalleDias(solicitud.fechaInicio, solicitud.fechaFin, map);

        return res.json({
          success: true,
          solicitud: formatearSolicitud(solicitud),
          historial,
          detalleDias
        });
      } else {
        const pool = await getPool();
        const solRes = await pool.request()
          .input('Id', id)
          .query(`
            SELECT s.*, 
                   CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
                   CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
                   CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
                   c.NombreCompleto, c.CodigoEmpleado, c.Empresa, c.Sucursal,
                   p.Nombre AS Puesto, d.Nombre AS Departamento
            FROM dbo.SolicitudesVacaciones s
            JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            WHERE s.IdSolicitud = @Id
          `);
        
        if (!solRes.recordset[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });

        const histRes = await pool.request()
          .input('Id', id)
          .query(`
            SELECT h.*, c.NombreCompleto AS AprobadorNombre
            FROM dbo.HistorialAprobaciones h
            JOIN dbo.Colaboradores c ON c.IdColaborador = h.IdAprobador
            WHERE h.IdSolicitud = @Id
            ORDER BY h.FechaAccion ASC
          `);

        return res.json({
          success: true,
          solicitud: formatearSolicitud(solRes.recordset[0]),
          historial: histRes.recordset
        });
      }
    } catch (err) {
      console.error('[solicitudes.getById]', err);
      res.status(500).json({ error: err.message });
    }
  },

  cancelar: async (req, res) => {
    try {
      const { id } = req.params;
      const idColaborador = req.user.id;

      if (isUsingMock()) {
        const cancelada = mockStore.cancelarSolicitud(id, idColaborador);

        // Notificación por correo al líder (Evento D)
        setImmediate(() => {
          emailService.notificarSolicitudCancelada(id).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.json({ success: true, message: 'Solicitud cancelada con éxito', solicitud: cancelada });
      } else {
        const pool = await getPool();
        await pool.request()
          .input('Id', id)
          .input('IdColaborador', idColaborador)
          .query(`
            UPDATE dbo.SolicitudesVacaciones
            SET Estado = 'CANCELADA', FechaResolucion = SYSDATETIME()
            WHERE IdSolicitud = @Id AND IdColaborador = @IdColaborador AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO')
          `);

        // Notificación por correo al líder (Evento D)
        setImmediate(() => {
          emailService.notificarSolicitudCancelada(id).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.json({ success: true, message: 'Solicitud cancelada correctamente' });
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  /**
   * Endpoint Oficial Formato FDO-84 (Rev. A - 26/01/2024)
   * GET /api/solicitudes/:id/pdf
   */
  descargarPdfFdo84: async (req, res) => {
    try {
      const { id } = req.params;
      const pdfBuffer = await generarPdfFdo84(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="FDO-84_Solicitud_${id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (err) {
      console.error('[solicitudes.descargarPdfFdo84]', err);
      if (!res.headersSent) {
        return res.status(404).json({ error: err.message || 'No se pudo generar el formato FDO-84.' });
      }
    }
  }
};

module.exports = solicitudesController;
