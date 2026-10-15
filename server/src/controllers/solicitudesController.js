const mockStore = require('../data/mockStore');
const { getPool, isUsingMock, sql } = require('../config/database');
const { calcularDetalleDias } = require('../services/diasHabilesService');
const emailService = require('../services/emailService');
const { generarPdfFdo84 } = require('../services/pdfFdo84Service');

function safeDateISO(val, len) {
  if (!val) return '';
  if (Array.isArray(val)) {
    for (const item of val) {
      if (typeof item === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item)) {
        return len ? item.substring(0, len) : item;
      }
    }
    val = val[0];
  }
  if (typeof val === 'string') return len ? val.substring(0, len) : val;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const iso = d.toISOString();
    return len ? iso.substring(0, len) : iso;
  } catch (e) {
    return '';
  }
}

function formatearSolicitud(s) {
  if (!s) return s;
  const id = Number(s.IdSolicitud ?? s.idSolicitud ?? s.id);
  const folio = s.Folio ?? s.folio ?? (id ? `VAC-${id}` : '');
  
  const fechaInicioStr = safeDateISO(s.FechaInicio || s.fechaInicio || s.fecha_inicio, 10);
  const fechaFinStr = safeDateISO(s.FechaFin || s.fechaFin || s.fecha_fin, 10);
  const fechaCreacionStr = safeDateISO(s.FechaCreacion || s.fechaCreacion || s.fecha_creacion, 10) || new Date().toISOString().substring(0, 10);

  const totalDias = Number(s.TotalDiasLaborables ?? s.totalDiasLaborables ?? s.diasHabiles ?? s.total_dias ?? 0);
  const estado = s.Estado ?? s.estado ?? 'PENDIENTE_LIDER';
  const motivoComentarios = s.MotivoComentarios ?? s.motivoComentarios ?? '';
  const motivoRechazo = s.MotivoRechazo ?? s.motivoRechazo ?? null;
  const fechaResolucion = s.FechaResolucion ?? s.fechaResolucion ?? null;

  const colabNombre = s.Colaborador || s.ColaboradorNombre || s.NombreCompleto || s.colaboradorNombre || '';
  const codEmpleado = s.CodigoEmpleado || s.codigoEmpleado || '';
  const empresaVal = s.Empresa || s.empresa || s.colaboradorEmpresa || '';
  const sucursalVal = s.Sucursal || s.sucursal || s.colaboradorSucursal || '';
  const puestoVal = s.Puesto || s.puesto || s.colaboradorPuesto || '';
  const deptoVal = s.Departamento || s.departamento || s.colaboradorDepartamento || '';

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
    colaboradorNombre: colabNombre,
    codigoEmpleado: codEmpleado,
    colaboradorEmpresa: empresaVal,
    colaboradorSucursal: sucursalVal,
    colaboradorPuesto: puestoVal,
    colaboradorDepartamento: deptoVal,
    empresa: empresaVal,
    sucursal: sucursalVal,
    puesto: puestoVal,
    departamento: deptoVal,
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
    FechaResolucion: fechaResolucion,
    Colaborador: colabNombre,
    ColaboradorNombre: colabNombre,
    NombreCompleto: colabNombre,
    CodigoEmpleado: codEmpleado,
    Empresa: empresaVal,
    Sucursal: sucursalVal,
    Puesto: puestoVal,
    Departamento: deptoVal
  };
}

const solicitudesController = {
  create: async (req, res) => {
    try {
      const { fechaInicio, fechaFin, motivoComentarios } = req.body;
      const idColaborador = req.body.idColaborador || req.user.id_colaborador || req.user.id;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Las fechas de inicio y fin son obligatorias.' });
      }

      if (isUsingMock()) {
        const colab = mockStore.colaboradores.find(c => c.id === Number(idColaborador));
        if (!colab) {
          return res.status(404).json({ error: 'Colaborador no encontrado en el sistema.' });
        }

        // Validar si el colaborador está activo (soporta bit 1/0, booleanos o strings '1'/'true')
        const estaActivo = colab.Activo === 1 || colab.Activo === true || colab.Activo === '1' || colab.Activo === 'true' ||
          colab.activo === 1 || colab.activo === true || colab.activo === '1' || colab.activo === 'true' ||
          String(colab.EstatusNomina || colab.estatusNomina).toUpperCase() === 'ALTA' ||
          String(colab.EstatusNomina || colab.estatusNomina).toUpperCase() === 'A' ||
          String(colab.EstatusNomina || colab.estatusNomina).toUpperCase() === 'R';

        const rolUsuario = req.user.rol || req.user.realRol || req.user.RolApp || '';
        const esPrivilegiado = req.user.rol === 'SISTEMAS' || req.user.rol === 'ADMIN_DO' ||
                              rolUsuario === 'SISTEMAS' || rolUsuario === 'ADMIN_DO' || rolUsuario === 'SUPERADMIN';

        if (!estaActivo && !esPrivilegiado) {
          return res.status(400).json({ error: 'El colaborador especificado no está activo en el sistema.' });
        }

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

        // 1. Obtener datos del colaborador para validación previa flexible
        const colabRes = await pool.request()
          .input('IdColaborador', idColaborador)
          .query(`
            SELECT TOP 1 IdColaborador, CodigoEmpleado, NombreCompleto, Activo, EstatusNomina
            FROM dbo.Colaboradores
            WHERE IdColaborador = @IdColaborador
          `);

        if (colabRes.recordset.length === 0) {
          return res.status(404).json({ error: 'El colaborador especificado no existe en el sistema.' });
        }

        const colab = colabRes.recordset[0];

        // Validar si el colaborador está activo (soporta bit 1/0, booleanos o strings '1'/'true')
        const estaActivo = colab.Activo === 1 || colab.Activo === true || colab.Activo === '1' || colab.Activo === 'true' ||
          String(colab.EstatusNomina).toUpperCase() === 'ALTA' ||
          String(colab.EstatusNomina).toUpperCase() === 'A' ||
          String(colab.EstatusNomina).toUpperCase() === 'R';

        const rolUsuario = req.user.rol || req.user.realRol || req.user.RolApp || '';
        const esPrivilegiado = req.user.rol === 'SISTEMAS' || req.user.rol === 'ADMIN_DO' ||
                              rolUsuario === 'SISTEMAS' || rolUsuario === 'ADMIN_DO' || rolUsuario === 'SUPERADMIN';

        if (!estaActivo && !esPrivilegiado) {
          return res.status(400).json({ error: 'El colaborador especificado no está activo en el sistema.' });
        }

        // Si es considerado activo o el rol es privilegiado pero en la BD Activo era 0 o NULL, normalizar a Activo = 1
        if ((estaActivo || esPrivilegiado) && (colab.Activo === false || colab.Activo === 0 || colab.Activo === null)) {
          await pool.request()
            .input('IdColaborador', idColaborador)
            .query('UPDATE dbo.Colaboradores SET Activo = 1 WHERE IdColaborador = @IdColaborador');
        }

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
            SELECT 
                   s.IdSolicitud, s.Folio, s.IdColaborador,
                   CONVERT(VARCHAR(10), s.FechaInicio, 120) AS FechaInicio,
                   CONVERT(VARCHAR(10), s.FechaFin, 120) AS FechaFin,
                   CONVERT(VARCHAR(19), s.FechaCreacion, 120) AS FechaCreacion,
                   s.TotalDiasLaborables, s.MotivoComentarios, s.Estado,
                   s.MotivoRechazo, s.FechaResolucion,
                   c.NombreCompleto, c.CodigoEmpleado, c.Empresa, c.Sucursal,
                   p.Nombre AS Puesto, d.Nombre AS Departamento,
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
          SELECT 
              s.IdSolicitud,
              s.Folio,
              CONVERT(VARCHAR(10), s.FechaInicio, 120) AS FechaInicio,
              CONVERT(VARCHAR(10), s.FechaFin, 120) AS FechaFin,
              s.TotalDiasLaborables,
              s.Estado,
              CONVERT(VARCHAR(10), s.FechaCreacion, 120) AS FechaCreacion,
              s.MotivoComentarios,
              s.MotivoRechazo,
              s.FechaResolucion,
              c.IdColaborador,
              c.CodigoEmpleado,
              c.NombreCompleto AS Colaborador,
              c.Empresa,
              c.Sucursal,
              p.Nombre AS Puesto,
              d.Nombre AS Departamento
          FROM dbo.SolicitudesVacaciones s
          INNER JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          ORDER BY s.FechaCreacion DESC;
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
   * Validación y Conclusión Definitiva por Desarrollo Organizacional
   * POST /api/admin/solicitudes/:id/resolver-do
   */
  resolverDO: async (req, res) => {
    try {
      const { id } = req.params;
      const { accion, comentarios, motivoRechazo } = req.body;
      const idAdmin = req.user.id_colaborador || req.user.id;
      const accionNorm = (accion || '').toUpperCase().trim();

      if (!['APROBAR', 'RECHAZAR'].includes(accionNorm)) {
        return res.status(400).json({ error: "La acción debe ser 'APROBAR' o 'RECHAZAR'." });
      }

      const razon = motivoRechazo || comentarios;
      if (accionNorm === 'RECHAZAR' && (!razon || !razon.trim())) {
        return res.status(400).json({ error: 'El motivo de rechazo es obligatorio para rechazar la solicitud.' });
      }

      const motivoFinal = razon || (accionNorm === 'APROBAR'
        ? 'Validada y aprobada por Desarrollo Organizacional.'
        : 'Rechazada por Desarrollo Organizacional.');

      if (isUsingMock()) {
        let sol = null;
        if (accionNorm === 'APROBAR') {
          sol = mockStore.aprobarSolicitud(id, idAdmin, motivoFinal, 'WEB_DO');
        } else {
          sol = mockStore.rechazarSolicitud(id, idAdmin, motivoFinal, 'WEB_DO');
        }

        // Notificación asíncrona por correo (Sandbox / Soporte en auditoría)
        setImmediate(() => {
          emailService.notificarConclusionDO(id, accionNorm, motivoFinal).catch(err => {
            console.error('[EMAIL NOTIFICACION ERROR]', err);
          });
        });

        return res.json({
          success: true,
          message: accionNorm === 'APROBAR'
            ? 'Solicitud validada y concluida exitosamente por Desarrollo Organizacional.'
            : 'Solicitud rechazada debidamente por Desarrollo Organizacional.',
          solicitud: sol
        });
      }

      const pool = await getPool();
      const spAccion = accionNorm === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';

      const request = pool.request();
      request.input('IdSolicitud', Number(id));
      request.input('IdAprobador', Number(idAdmin));
      request.input('Accion', spAccion);
      request.input('Comentarios', motivoFinal);
      request.input('MetodoAutorizacion', 'WEB_DO');
      request.input('DireccionIP', req.ip || null);

      await request.execute('dbo.sp_ProcesarAprobacionSolicitud');

      // Notificación asíncrona por correo electrónico (Sandbox / Soporte en auditoría)
      setImmediate(() => {
        emailService.notificarConclusionDO(id, accionNorm, motivoFinal).catch(err => {
          console.error('[EMAIL NOTIFICACION ERROR]', err);
        });
      });

      return res.json({
        success: true,
        message: accionNorm === 'APROBAR'
          ? 'Solicitud validada y concluida exitosamente por Desarrollo Organizacional.'
          : 'Solicitud rechazada debidamente por Desarrollo Organizacional.'
      });
    } catch (err) {
      console.error('[solicitudes.resolverDO]', err);
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
