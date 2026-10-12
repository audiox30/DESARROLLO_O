const mockStore = require('../data/mockStore');
const { getPool, isUsingMock, sql } = require('../config/database');
const { calcularDetalleDias } = require('../services/diasHabilesService');

const solicitudesController = {
  create: async (req, res) => {
    try {
      const { fechaInicio, fechaFin, motivoComentarios } = req.body;
      const idColaborador = req.user.id;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Las fechas de inicio y fin son obligatorias.' });
      }

      if (isUsingMock()) {
        const solicitud = mockStore.crearSolicitud(idColaborador, fechaInicio, fechaFin, motivoComentarios);
        return res.status(201).json({
          success: true,
          message: `Solicitud registrada con éxito. Folio generado: ${solicitud.folio}`,
          solicitud
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
        return res.status(201).json({
          success: true,
          message: `Solicitud creada con éxito. Folio: ${result.output.FolioGenerado}`,
          folio: result.output.FolioGenerado,
          idSolicitud: result.output.IdSolicitudCreada
        });
      }
    } catch (err) {
      console.error('[solicitudes.create]', err);
      res.status(400).json({ error: err.message });
    }
  },

  getMisSolicitudes: async (req, res) => {
    try {
      const idColaborador = req.user.id;

      if (isUsingMock()) {
        const mis = mockStore.solicitudes.filter(s => s.idColaborador === Number(idColaborador));
        return res.json({ success: true, total: mis.length, data: mis });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('IdColaborador', idColaborador)
          .query(`
            SELECT s.*, c.NombreCompleto AS ColaboradorNombre, c.CodigoEmpleado
            FROM dbo.SolicitudesVacaciones s
            JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
            WHERE s.IdColaborador = @IdColaborador
            ORDER BY s.FechaCreacion DESC
          `);
        return res.json({ success: true, total: result.recordset.length, data: result.recordset });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getBandejaLider: async (req, res) => {
    try {
      const idLider = req.user.id;

      if (isUsingMock()) {
        // En mock mode: si es líder, mostrar pendientes de su equipo o todas las pendientes para demostración
        let pendientes = mockStore.solicitudes.filter(s => 
          s.estado === 'PENDIENTE_LIDER' && (s.idJefeDirecto === Number(idLider) || req.user.rolApp === 'LIDER' || req.user.rolApp === 'ADMIN_DO')
        );

        return res.json({ success: true, total: pendientes.length, data: pendientes });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('IdLider', idLider)
          .query(`
            SELECT s.*, c.NombreCompleto, c.CodigoEmpleado, p.Nombre AS Puesto, d.Nombre AS Departamento
            FROM dbo.SolicitudesVacaciones s
            JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            WHERE s.Estado = 'PENDIENTE_LIDER'
              AND (c.IdJefeDirecto = @IdLider OR @IdLider IN (SELECT IdColaborador FROM dbo.Colaboradores WHERE RolApp = 'ADMIN_DO'))
            ORDER BY s.FechaCreacion ASC
          `);
        return res.json({ success: true, total: result.recordset.length, data: result.recordset });
      }
    } catch (err) {
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

        return res.json({ success: true, total: todas.length, data: todas });
      } else {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT s.*, c.NombreCompleto, c.CodigoEmpleado, c.Empresa, c.Sucursal,
                 p.Nombre AS Puesto, d.Nombre AS Departamento
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          ORDER BY s.FechaCreacion DESC
        `);
        return res.json({ success: true, total: result.recordset.length, data: result.recordset });
      }
    } catch (err) {
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
          solicitud,
          historial,
          detalleDias
        });
      } else {
        const pool = await getPool();
        const solRes = await pool.request()
          .input('Id', id)
          .query(`
            SELECT s.*, c.NombreCompleto, c.CodigoEmpleado, c.Empresa, c.Sucursal,
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
          solicitud: solRes.recordset[0],
          historial: histRes.recordset
        });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  cancelar: async (req, res) => {
    try {
      const { id } = req.params;
      const idColaborador = req.user.id;

      if (isUsingMock()) {
        const cancelada = mockStore.cancelarSolicitud(id, idColaborador);
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
        return res.json({ success: true, message: 'Solicitud cancelada correctamente' });
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = solicitudesController;
