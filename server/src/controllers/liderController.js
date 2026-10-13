const { getLocalPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');
const emailService = require('../services/emailService');

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

const liderController = {
  /**
   * GET /api/lider/solicitudes-pendientes
   * Bandeja de entrada para líderes y gerentes:
   * Muestra solicitudes pendientes de Nivel 1 (Jefe Directo) o Nivel 2 (Segundo Aprobador / Gerente)
   */
  getSolicitudesPendientes: async (req, res) => {
    try {
      const idLider = req.user.id_colaborador || req.user.id;
      const rol = req.user.rol || req.user.rolApp;

      if (isUsingMock()) {
        const pendientes = mockStore.solicitudes.filter(s => 
          (s.estado === 'PENDIENTE_LIDER' || s.estado === 'PENDIENTE_GERENTE') && 
          (s.idJefeDirecto === Number(idLider) || s.idAprobadorSegundo === Number(idLider) || rol === 'LIDER' || rol === 'ADMIN_DO')
        );
        return res.json({ success: true, total: pendientes.length, data: pendientes.map(formatearSolicitud) });
      }

      const pool = await getLocalPool();
      const result = await pool.request()
        .input('IdLider', idLider)
        .input('Rol', rol)
        .query(`
          SELECT 
            s.IdSolicitud, s.Folio, s.IdColaborador, 
            CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
            CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio, 
            CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin, 
            ISNULL(s.TotalDiasLaborables, 0) AS TotalDiasLaborables, 
            s.MotivoComentarios,
            s.Estado,
            c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.Empresa, c.Sucursal,
            p.Nombre AS Puesto, d.Nombre AS Departamento,
            ISNULL(sal.DiasPendientes, 0) AS DiasPendientesColaborador,
            ISNULL(sal.DiasCorrespondientes, 0) AS DiasCorrespondientesColaborador,
            CASE 
              WHEN s.Estado = 'PENDIENTE_GERENTE' THEN 2 
              ELSE 1 
            END AS NivelAprobacionRequerido,
            c.IdJefeDirecto,
            c.IdAprobadorSegundo
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
          WHERE 
            (@Rol IN ('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS') AND s.Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE'))
            OR (s.Estado = 'PENDIENTE_LIDER' AND c.IdJefeDirecto = @IdLider)
            OR (s.Estado = 'PENDIENTE_GERENTE' AND c.IdAprobadorSegundo = @IdLider)
          ORDER BY s.FechaCreacion ASC
        `);

      const data = result.recordset.map(formatearSolicitud);
      return res.json({
        success: true,
        total: data.length,
        data
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

      // Validar existencia de la solicitud y alcance jerárquico multinivel
      const solRes = await pool.request()
        .input('Id', id)
        .query(`
          SELECT s.IdSolicitud, s.Estado, s.IdColaborador, s.Folio,
                 c.IdJefeDirecto, c.IdAprobadorSegundo, c.NombreCompleto
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          WHERE s.IdSolicitud = @Id
        `);

      const solicitud = solRes.recordset[0];
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud de vacaciones no encontrada.' });
      }

      if (!['PENDIENTE_LIDER', 'PENDIENTE_GERENTE'].includes(solicitud.Estado)) {
        return res.status(400).json({ 
          error: `La solicitud no se encuentra en un estado pendiente de resolución (Estado actual: ${solicitud.Estado}).` 
        });
      }

      const esNivel1 = (solicitud.Estado === 'PENDIENTE_LIDER' && Number(solicitud.IdJefeDirecto) === Number(idLider));
      const esNivel2 = (solicitud.Estado === 'PENDIENTE_GERENTE' && Number(solicitud.IdAprobadorSegundo) === Number(idLider));
      const esAdmin = ['ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'].includes(rol);

      if (!esAdmin && !esNivel1 && !esNivel2) {
        return res.status(403).json({ 
          error: 'Acceso denegado: No tienes facultades asignadas para resolver esta solicitud en su nivel actual.' 
        });
      }

      // Ejecutar SP de resolución en SQL Server
      const spAccion = accionNorm === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';
      const motivoFinal = razon || (accionNorm === 'APROBAR' 
        ? (esNivel1 ? 'Visto Bueno Nivel 1 (Jefe Directo).' : 'Autorización Nivel 2 (Gerencia).') 
        : 'Rechazada por jefatura.');

      const request = pool.request();
      request.input('IdSolicitud', Number(id));
      request.input('IdAprobador', Number(idLider));
      request.input('Accion', spAccion);
      request.input('Comentarios', motivoFinal);
      request.input('MetodoAutorizacion', 'WEB');
      request.input('DireccionIP', req.ip || null);

      await request.execute('dbo.sp_ProcesarAprobacionSolicitud');

      // Consultar estado resultante
      const checkResult = await pool.request()
        .input('Id', id)
        .query('SELECT Estado FROM dbo.SolicitudesVacaciones WHERE IdSolicitud = @Id');
      const nuevoEstado = checkResult.recordset[0]?.Estado || (accionNorm === 'APROBAR' ? 'APROBADA' : 'RECHAZADA');

      // Notificaciones por correo electrónico (SMTP)
      setImmediate(() => {
        if (nuevoEstado === 'PENDIENTE_GERENTE') {
          emailService.notificarSolicitudPendienteGerente(id).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        } else if (nuevoEstado === 'APROBADA') {
          emailService.notificarSolicitudAprobada(id).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        } else if (nuevoEstado === 'RECHAZADA') {
          emailService.notificarSolicitudRechazada(id, razon).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        }
      });

      let mensaje = '';
      if (nuevoEstado === 'PENDIENTE_GERENTE') {
        mensaje = `Solicitud ${solicitud.Folio} de ${solicitud.NombreCompleto}: Visto Bueno Nivel 1 otorgado. Transferida a autorización gerencial.`;
      } else if (nuevoEstado === 'APROBADA') {
        mensaje = `Solicitud ${solicitud.Folio} de ${solicitud.NombreCompleto} autorizada formalmente y saldos descontados conforme a LFT.`;
      } else {
        mensaje = `Solicitud ${solicitud.Folio} de ${solicitud.NombreCompleto} rechazada debidamente.`;
      }

      return res.json({
        success: true,
        message: mensaje,
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

      if (isUsingMock()) {
        const mis = mockStore.solicitudes.filter(s => s.idColaborador === targetId);
        return res.json({ success: true, total: mis.length, data: mis.map(formatearSolicitud) });
      }

      const result = await pool.request()
        .input('TargetId', targetId)
        .query(`
          SELECT 
            s.IdSolicitud, s.Folio, s.IdColaborador,
            CONVERT(VARCHAR(10), s.FechaInicio, 23) AS FechaInicio,
            CONVERT(VARCHAR(10), s.FechaFin, 23) AS FechaFin,
            ISNULL(s.TotalDiasLaborables, 0) AS TotalDiasLaborables,
            s.Estado, s.MotivoComentarios, s.MotivoRechazo,
            CONVERT(VARCHAR(19), s.FechaResolucion, 120) AS FechaResolucion,
            CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
            c.NombreCompleto AS ColaboradorNombre, c.CodigoEmpleado
          FROM dbo.SolicitudesVacaciones s
          JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          WHERE s.IdColaborador = @TargetId
          ORDER BY s.FechaCreacion DESC;
        `);

      const data = result.recordset.map(formatearSolicitud);
      return res.json({
        success: true,
        total: data.length,
        data
      });
    } catch (err) {
      console.error('[lider.getSolicitudesColaborador]', err);
      res.status(500).json({ error: 'Error al consultar solicitudes del colaborador.' });
    }
  }
};

module.exports = liderController;
