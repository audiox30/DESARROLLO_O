const { getLocalPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');

const liderController = {
  /**
   * GET /api/lider/solicitudes-pendientes
   * Bandeja de entrada para líderes:
   * Solo muestra solicitudes de colaboradores donde IdJefeDirecto sea el Id del líder autenticado (o si es ADMIN_DO)
   */
  getSolicitudesPendientes: async (req, res) => {
    try {
      const idLider = req.user.id_colaborador || req.user.id;
      const rol = req.user.rol || req.user.rolApp;

      if (isUsingMock()) {
        const pendientes = mockStore.solicitudes.filter(s => 
          s.estado === 'PENDIENTE_LIDER' && 
          (s.idJefeDirecto === Number(idLider) || rol === 'LIDER' || rol === 'ADMIN_DO')
        );
        return res.json({ success: true, total: pendientes.length, data: pendientes });
      }

      const pool = await getLocalPool();
      const result = await pool.request()
        .input('IdLider', idLider)
        .input('Rol', rol)
        .query(`
          SELECT 
            s.IdSolicitud, s.Folio, s.IdColaborador, s.FechaCreacion,
            s.FechaInicio, s.FechaFin, s.TotalDiasLaborables, s.MotivoComentarios,
            s.Estado,
            c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.Empresa, c.Sucursal,
            p.Nombre AS Puesto, d.Nombre AS Departamento,
            ISNULL(sal.DiasPendientes, 0) AS DiasPendientesColaborador,
            ISNULL(sal.DiasCorrespondientes, 0) AS DiasCorrespondientesColaborador
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          OUTER APPLY (
            SELECT 
              SUM(DiasPendientes) AS DiasPendientes,
              SUM(DiasCorrespondientes) AS DiasCorrespondientes
            FROM dbo.SaldosVacaciones sv
            WHERE sv.IdColaborador = c.IdColaborador AND sv.EsCerrado = 0
          ) sal
          WHERE s.Estado = 'PENDIENTE_LIDER'
            AND (c.IdJefeDirecto = @IdLider OR @Rol = 'ADMIN_DO')
          ORDER BY s.FechaCreacion ASC
        `);

      return res.json({
        success: true,
        total: result.recordset.length,
        data: result.recordset
      });
    } catch (err) {
      console.error('[lider.getSolicitudesPendientes]', err);
      res.status(500).json({ error: 'Error al obtener solicitudes pendientes del equipo.' });
    }
  },

  /**
   * POST /api/lider/solicitud/:id/resolver
   * Permite al líder directo aprobar o rechazar con motivo la solicitud de su colaborador
   */
  resolverSolicitud: async (req, res) => {
    try {
      const { id } = req.params;
      const { accion, comentarios, motivoRechazo } = req.body;
      const idLider = req.user.id_colaborador || req.user.id;
      const rol = req.user.rol || req.user.rolApp;

      const accionNorm = (accion || '').toUpperCase().trim();
      if (!['APROBAR', 'RECHAZAR'].includes(accionNorm)) {
        return res.status(400).json({ error: "La acción debe ser 'APROBAR' o 'RECHAZAR'." });
      }

      const razon = motivoRechazo || comentarios;
      if (accionNorm === 'RECHAZAR' && (!razon || !razon.trim())) {
        return res.status(400).json({ error: 'El motivo de rechazo es obligatorio para rechazar la solicitud.' });
      }

      if (isUsingMock()) {
        let sol = null;
        if (accionNorm === 'APROBAR') {
          sol = mockStore.aprobarSolicitud(id, idLider, comentarios || 'Aprobada por Líder Directo.', 'WEB');
        } else {
          sol = mockStore.rechazarSolicitud(id, idLider, razon, 'WEB');
        }
        return res.json({
          success: true,
          message: accionNorm === 'APROBAR'
            ? 'Solicitud autorizada por Líder. Enviada a VoBo de Desarrollo Organizacional.'
            : 'Solicitud rechazada debidamente.',
          solicitud: sol
        });
      }

      const pool = await getLocalPool();

      // Validar existencia de la solicitud y alcance jerárquico
      const solRes = await pool.request()
        .input('Id', id)
        .query(`
          SELECT s.IdSolicitud, s.Estado, s.IdColaborador, s.Folio,
                 c.IdJefeDirecto, c.NombreCompleto
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          WHERE s.IdSolicitud = @Id
        `);

      const solicitud = solRes.recordset[0];
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud de vacaciones no encontrada.' });
      }

      if (solicitud.Estado !== 'PENDIENTE_LIDER') {
        return res.status(400).json({ 
          error: `La solicitud no está pendiente de aprobación por el líder (Estado actual: ${solicitud.Estado}).` 
        });
      }

      if (rol !== 'ADMIN_DO' && solicitud.IdJefeDirecto !== idLider) {
        return res.status(403).json({ 
          error: 'Acceso denegado: El colaborador que solicita vacaciones no reporta bajo tu liderazgo directo.' 
        });
      }

      // Ejecutar SP de resolución en SQL Server
      const spAccion = accionNorm === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';
      const motivoFinal = razon || (accionNorm === 'APROBAR' ? 'Aprobada por Líder Directo. Enviada a VoBo DO.' : 'Rechazada por Líder.');

      const request = pool.request();
      request.input('IdSolicitud', Number(id));
      request.input('IdAprobador', Number(idLider));
      request.input('Accion', spAccion);
      request.input('Comentarios', motivoFinal);
      request.input('MetodoAutorizacion', 'WEB');
      request.input('DireccionIP', req.ip || null);

      await request.execute('dbo.sp_ProcesarAprobacionSolicitud');

      const nuevoEstado = accionNorm === 'APROBAR' ? 'PENDIENTE_DO' : 'RECHAZADA';

      return res.json({
        success: true,
        message: accionNorm === 'APROBAR'
          ? `Solicitud ${solicitud.Folio} de ${solicitud.NombreCompleto} autorizada con éxito. Pasó a VoBo de Desarrollo Organizacional.`
          : `Solicitud ${solicitud.Folio} de ${solicitud.NombreCompleto} rechazada debidamente.`,
        estado: nuevoEstado
      });
    } catch (err) {
      console.error('[lider.resolverSolicitud]', err);
      res.status(400).json({ error: err.message });
    }
  },

  /**
   * GET /api/lider/mi-equipo
   * Consulta el catálogo de colaboradores a cargo del líder autenticado (o líder simulado)
   */
  getMiEquipo: async (req, res) => {
    try {
      const idLider = Number(req.user.id_colaborador || req.user.id);
      const rol = req.user.rol || req.user.rolApp;
      const isSuperOrAdmin = rol === 'ADMIN_DO' || rol === 'SUPERADMIN' || rol === 'SISTEMAS';

      if (isUsingMock()) {
        const equipo = mockStore.colaboradores
          .filter(c => c.activo !== false && (c.idJefeDirecto === Number(idLider) || isSuperOrAdmin))
          .map(c => ({
            idColaborador: c.id,
            codigoEmpleado: c.codigoEmpleado,
            nombreCompleto: c.nombreCompleto,
            puesto: c.puesto || 'Sin Puesto',
            sucursal: c.sucursal || 'Matriz',
            fechaAlta: c.fechaAlta,
            estatusNomina: c.estatusNomina || 'ALTA',
            estatus: c.activo !== false ? 'ACTIVO' : 'INACTIVO',
            activo: c.activo !== false,
            telefono: c.telefono || '—',
            email: c.email || '—',
            diasDisponibles: c.diasDisponibles || 0,
            diasGozados: c.diasGozados || 0,
            diasCorrespondientes: c.diasCorrespondientes || 0
          }));
        return res.json({ success: true, total: equipo.length, data: equipo });
      }

      const pool = await getLocalPool();
      const request = pool.request();
      request.input('CurrentUserId', idLider);

      const query = `
        SELECT 
            c.IdColaborador AS idColaborador,
            c.CodigoEmpleado AS codigoEmpleado,
            c.NombreCompleto AS nombreCompleto,
            ISNULL(p.Nombre, 'Sin Puesto') AS puesto,
            ISNULL(c.Sucursal, 'Matriz') AS sucursal,
            CONVERT(VARCHAR(10), c.FechaAlta, 120) AS fechaAlta,
            c.EstatusNomina AS estatusNomina,
            CASE WHEN c.Activo = 1 THEN 'ACTIVO' ELSE 'INACTIVO' END AS estatus,
            c.Activo AS activo,
            ISNULL(c.Telefono, '—') AS telefono,
            ISNULL(c.Email, '—') AS email,
            -- Saldo de vacaciones actual del período activo
            ISNULL(sv.DiasPendientes, 0) AS diasDisponibles,
            ISNULL(sv.DiasGozados, 0) AS diasGozados,
            ISNULL(sv.DiasCorrespondientes, 0) AS diasCorrespondientes
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.SaldosVacaciones sv 
            ON sv.IdColaborador = c.IdColaborador AND sv.EsCerrado = 0
        WHERE c.IdJefeDirecto = @CurrentUserId
          AND c.Activo = 1
        ORDER BY c.NombreCompleto ASC;
      `;

      const result = await request.query(query);

      return res.json({
        success: true,
        total: result.recordset.length,
        data: result.recordset
      });
    } catch (err) {
      console.error('[lider.getMiEquipo]', err);
      res.status(500).json({ error: 'Error al consultar equipo a cargo.' });
    }
  },

  /**
   * GET /api/lider/colaborador/:id/solicitudes
   * Consulta el historial de solicitudes de vacaciones de un colaborador directo
   */
  getSolicitudesColaborador: async (req, res) => {
    try {
      const { id } = req.params;
      const targetId = Number(id);
      const userRol = req.user.rol || req.user.rolApp;
      const userColabId = Number(req.user.id_colaborador || req.user.id);
      const isSuperOrAdmin = userRol === 'ADMIN_DO' || userRol === 'SUPERADMIN' || userRol === 'SISTEMAS';

      const pool = await getLocalPool();

      // Regla de integridad: Si no es Admin/SuperAdmin, verificar jerarquía directa
      if (!isSuperOrAdmin) {
        const check = await pool.request()
          .input('TargetId', targetId)
          .input('LiderId', userColabId)
          .query('SELECT 1 FROM dbo.Colaboradores WHERE IdColaborador = @TargetId AND IdJefeDirecto = @LiderId');

        if (check.recordset.length === 0 && targetId !== userColabId) {
          return res.status(403).json({
            error: 'Acceso denegado: El colaborador no está bajo tu supervisión directa.'
          });
        }
      }

      const result = await pool.request()
        .input('TargetId', targetId)
        .query(`
          SELECT 
            s.IdSolicitud, s.Folio, 
            CONVERT(VARCHAR(10), s.FechaInicio, 120) AS FechaInicio,
            CONVERT(VARCHAR(10), s.FechaFin, 120) AS FechaFin,
            s.TotalDiasLaborables,
            s.Estado, s.MotivoComentarios,
            CONVERT(VARCHAR(10), s.FechaCreacion, 120) AS FechaCreacion,
            c.NombreCompleto AS ColaboradorNombre, c.CodigoEmpleado
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          WHERE s.IdColaborador = @TargetId
          ORDER BY s.FechaCreacion DESC;
        `);

      return res.json({
        success: true,
        total: result.recordset.length,
        data: result.recordset
      });
    } catch (err) {
      console.error('[lider.getSolicitudesColaborador]', err);
      res.status(500).json({ error: 'Error al consultar solicitudes del colaborador.' });
    }
  }
};

module.exports = liderController;
