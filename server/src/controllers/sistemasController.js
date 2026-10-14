const bcrypt = require('bcryptjs');
const { getLocalPool, getNomipaqPool, isUsingMock } = require('../config/database');

const sistemasController = {
  /**
   * GET /api/sistemas/usuarios
   * Lista todos los usuarios de dbo.UsuariosApp con datos de colaboradores
   */
  getUsuarios: async (req, res) => {
    try {
      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        const usuarios = (mockStore.colaboradores || []).map(c => ({
          IdUsuario: c.id,
          Username: c.username || c.codigoEmpleado,
          RolApp: c.rolApp || c.rol || 'COLABORADOR',
          DebeCambiarPassword: false,
          Activo: c.activo !== false,
          UltimoAcceso: new Date().toISOString(),
          FechaCreacion: '2026-01-01',
          IdColaborador: c.id,
          CodigoEmpleado: c.codigoEmpleado,
          Subfijo: c.subfijo || '',
          NombreCompleto: c.nombreCompleto,
          Email: c.email,
          Departamento: c.departamento,
          Puesto: c.puesto,
          Empresa: c.empresa,
          IdEmpresa: c.idEmpresa || 1
        }));
        return res.json({
          success: true,
          total: usuarios.length,
          usuarios
        });
      }

      const result = await pool.request().query(`
        SELECT 
          u.IdUsuario, u.Username, u.RolApp, u.DebeCambiarPassword, u.Activo,
          u.UltimoAcceso, u.FechaCreacion,
          c.IdColaborador, c.CodigoEmpleado, c.Subfijo,
          CASE 
            WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
                   CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
            ELSE c.NombreCompleto
          END AS NombreCompleto,
          c.Email,
          d.Nombre AS Departamento, p.Nombre AS Puesto,
          e.AliasEmpresa AS Empresa, e.IdEmpresa
        FROM dbo.UsuariosApp u
        LEFT JOIN dbo.Colaboradores c ON c.IdColaborador = u.IdColaborador
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        ORDER BY u.RolApp DESC, c.ApellidoPaterno ASC, c.ApellidoMaterno ASC, c.Nombre ASC
      `);

      return res.json({
        success: true,
        total: result.recordset.length,
        usuarios: result.recordset
      });
    } catch (err) {
      console.error('[sistemas.getUsuarios]', err);
      res.status(500).json({ error: 'Error al consultar catálogo de usuarios.' });
    }
  },

  /**
   * POST /api/sistemas/usuarios/:id/toggle-activo
   * Alterna el estado activo/inactivo de una cuenta
   */
  toggleActivo: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getLocalPool();

      // No permitir desactivar la cuenta principal de superadmin
      const check = await pool.request()
        .input('Id', id)
        .query('SELECT Username, Activo FROM dbo.UsuariosApp WHERE IdUsuario = @Id');

      if (!check.recordset[0]) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      if (check.recordset[0].Username === 'sistemas') {
        return res.status(400).json({ error: 'No es posible desactivar la cuenta maestra de SuperAdmin.' });
      }

      const nuevoEstado = check.recordset[0].Activo ? 0 : 1;
      await pool.request()
        .input('Id', id)
        .input('Activo', nuevoEstado)
        .query('UPDATE dbo.UsuariosApp SET Activo = @Activo WHERE IdUsuario = @Id');

      return res.json({
        success: true,
        activo: Boolean(nuevoEstado),
        message: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente.`
      });
    } catch (err) {
      console.error('[sistemas.toggleActivo]', err);
      res.status(500).json({ error: 'Error al actualizar estado del usuario.' });
    }
  },

  /**
   * POST /api/sistemas/usuarios/:id/reset-password
   * Resetea contraseña a la contraseña institucional estándar con bandera DebeCambiarPassword
   */
  resetPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const DEFAULT_PWD = process.env.DEFAULT_USER_PASSWORD || 'Grupojama2026!';
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(DEFAULT_PWD, salt);

      const pool = await getLocalPool();
      await pool.request()
        .input('Id', id)
        .input('Hash', hash)
        .query(`
          UPDATE dbo.UsuariosApp 
          SET PasswordHash = @Hash, DebeCambiarPassword = 1 
          WHERE IdUsuario = @Id
        `);

      return res.json({
        success: true,
        message: 'Contraseña reseteada exitosamente a la clave inicial estándar (deberá cambiarla al ingresar).'
      });
    } catch (err) {
      console.error('[sistemas.resetPassword]', err);
      res.status(500).json({ error: 'Error al resetear contraseña.' });
    }
  },

  /**
   * GET /api/sistemas/auditoria
   * Bitácora de accesos, aprobaciones y trazabilidad
   */
  getAuditoria: async (req, res) => {
    try {
      const pool = await getLocalPool();
      const hist = await pool.request().query(`
        SELECT TOP 100
          h.IdHistorial, h.IdSolicitud, h.FechaAccion, h.Accion, h.Comentarios,
          h.MetodoAutorizacion, h.DireccionIP,
          c.NombreCompleto AS AprobadorNombre,
          s.Folio AS FolioSolicitud,
          solic.NombreCompleto AS SolicitanteNombre
        FROM dbo.HistorialAprobaciones h
        LEFT JOIN dbo.Colaboradores c ON c.IdColaborador = h.IdAprobador
        LEFT JOIN dbo.SolicitudesVacaciones s ON s.IdSolicitud = h.IdSolicitud
        LEFT JOIN dbo.Colaboradores solic ON solic.IdColaborador = s.IdColaborador
        ORDER BY h.FechaAccion DESC
      `);

      return res.json({
        success: true,
        total: hist.recordset.length,
        registros: hist.recordset
      });
    } catch (err) {
      console.error('[sistemas.getAuditoria]', err);
      res.status(500).json({ error: 'Error al obtener bitácora de auditoría.' });
    }
  },

  /**
   * GET /api/sistemas/diagnostico
   * Diagnóstico general del sistema y servicios
   */
  getDiagnostico: async (req, res) => {
    try {
      const localPool = await getLocalPool();
      const localCheck = await localPool.request().query(`
        SELECT 
          (SELECT COUNT(*) FROM dbo.Colaboradores) AS TotalColaboradores,
          (SELECT COUNT(*) FROM dbo.Colaboradores WHERE Activo = 1) AS ColaboradoresActivos,
          (SELECT COUNT(*) FROM dbo.UsuariosApp) AS TotalUsuarios,
          (SELECT COUNT(*) FROM dbo.SolicitudesVacaciones) AS TotalSolicitudes,
          (SELECT COUNT(*) FROM dbo.EmpresasNomipaq) AS TotalEmpresas,
          @@SERVERNAME AS ServidorSQL,
          DB_NAME() AS BaseDatosActiva
      `);

      return res.json({
        success: true,
        servidor: {
          nodeVersion: process.version,
          uptimeSegundos: Math.round(process.uptime()),
          memoriaMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
          fechaServidor: new Date().toISOString()
        },
        baseDatos: localCheck.recordset[0]
      });
    } catch (err) {
      console.error('[sistemas.getDiagnostico]', err);
      res.status(500).json({ error: 'Error al ejecutar diagnóstico del sistema.' });
    }
  }
};

module.exports = sistemasController;
