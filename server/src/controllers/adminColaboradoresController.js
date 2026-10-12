const bcrypt = require('bcryptjs');
const { getLocalPool, isUsingMock } = require('../config/database');

const adminColaboradoresController = {
  /**
   * GET /api/admin/colaboradores
   * Catálogo administrativo de colaboradores con filtros completos
   */
  getColaboradoresAdmin: async (req, res) => {
    try {
      const { 
        search, 
        empresa, 
        empresa_id,
        empresaId,
        departamento, 
        sucursal, 
        estatus = 'ACTIVO', 
        page = 1, 
        limit = 50 
      } = req.query;

      const pool = await getLocalPool();
      const request = pool.request();
      let whereClauses = [];

      // Filtro de estatus (Activo / Baja / Todos)
      if (estatus === 'ACTIVO') {
        whereClauses.push('c.Activo = 1');
      } else if (estatus === 'BAJA') {
        whereClauses.push('c.Activo = 0');
      }

      // Buscador por Nombre, Nómina, CURP o RFC
      if (search && search.trim()) {
        request.input('Search', `%${search.trim()}%`);
        whereClauses.push('(c.NombreCompleto LIKE @Search OR c.CodigoEmpleado LIKE @Search OR c.CURP LIKE @Search OR c.RFC LIKE @Search)');
      }

      // Filtro de Empresa por ID o comparación flexible
      const targetEmpresaId = empresa_id || empresaId || (!isNaN(empresa) && empresa !== '' && empresa !== null ? Number(empresa) : null);
      if (targetEmpresaId) {
        request.input('IdEmpresa', Number(targetEmpresaId));
        whereClauses.push('(c.IdEmpresa = @IdEmpresa OR e.IdEmpresa = @IdEmpresa)');
      } else if (empresa && empresa.trim()) {
        const empVal = empresa.trim();
        request.input('EmpresaVal', empVal);
        request.input('EmpresaLike', `%${empVal}%`);
        whereClauses.push('(c.Empresa LIKE @EmpresaLike OR @EmpresaVal LIKE \'%\' + c.Empresa + \'%\' OR e.AliasEmpresa LIKE @EmpresaLike OR @EmpresaVal LIKE \'%\' + e.AliasEmpresa + \'%\')');
      }

      // Filtro por Departamento
      if (departamento && departamento.trim()) {
        request.input('Depto', `%${departamento.trim()}%`);
        whereClauses.push('d.Nombre LIKE @Depto');
      }

      // Filtro por Sucursal
      if (sucursal && sucursal.trim()) {
        request.input('Sucursal', `%${sucursal.trim()}%`);
        whereClauses.push('c.Sucursal LIKE @Sucursal');
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT 
          c.IdColaborador AS id, c.IdColaborador, c.IdEmpresa,
          e.AliasEmpresa AS Empresa, e.NombreBaseDatos,
          c.CodigoEmpleado, c.Subfijo, c.NombreCompleto,
          c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno,
          c.CURP, c.RFC, c.NSS, c.Email, c.Telefono,
          c.Sucursal, c.JornadaLaboralDias,
          d.IdDepartamento, d.Nombre AS Departamento,
          p.IdPuesto, p.Nombre AS Puesto,
          c.IdJefeDirecto, j.NombreCompleto AS JefeDirectoNombre,
          c.RolApp, c.Activo, c.EstatusNomina, c.FechaAlta, c.FechaReingreso,
          c.DiasDescanso, c.CentroCostos, c.TipoNomina,
          c.AvisarEmergencia, c.ParentescoEmergencia, c.TelefonoEmergencia,
          c.TipoSangre, c.AlergiasPadecimientos,
          u.IdUsuario, u.Username, u.DebeCambiarPassword,
          u.Activo AS UsuarioActivo, u.UltimoAcceso
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
        LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
        ${whereSQL}
        ORDER BY c.ApellidoPaterno, c.Nombre;
      `;

      const result = await request.query(query);
      const total = result.recordset.length;
      const offset = (Number(page) - 1) * Number(limit);
      const paginated = result.recordset.slice(offset, offset + Number(limit));

      return res.json({
        success: true,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        data: paginated
      });
    } catch (err) {
      console.error('[adminColaboradores.getColaboradoresAdmin]', err);
      res.status(500).json({ error: 'Error al consultar catálogo administrativo de colaboradores.' });
    }
  },

  /**
   * PUT /api/admin/colaboradores/:id
   * Edita campos complementarios protegidos contra sincronización NOMIPAQ
   */
  updateComplementarios: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        idJefeDirecto,
        diasDescanso,
        rolApp,
        telefono,
        avisarEmergencia,
        parentescoEmergencia,
        telefonoEmergencia,
        tipoSangre,
        alergiasPadecimientos
      } = req.body;

      const pool = await getLocalPool();

      // Validar existencia de colaborador
      const checkColab = await pool.request()
        .input('Id', id)
        .query('SELECT IdColaborador, NombreCompleto, RolApp FROM dbo.Colaboradores WHERE IdColaborador = @Id');

      if (!checkColab.recordset[0]) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      // Validar jefe directo (no puede ser él mismo)
      if (idJefeDirecto && Number(idJefeDirecto) === Number(id)) {
        return res.status(400).json({ error: 'Un colaborador no puede ser su propio jefe directo.' });
      }

      const request = pool.request();
      request.input('Id', id);
      request.input('IdJefeDirecto', idJefeDirecto ? Number(idJefeDirecto) : null);
      request.input('DiasDescanso', diasDescanso || null);
      request.input('RolApp', rolApp || 'COLABORADOR');
      request.input('Telefono', telefono || null);
      request.input('AvisarEmergencia', avisarEmergencia || null);
      request.input('ParentescoEmergencia', parentescoEmergencia || null);
      request.input('TelefonoEmergencia', telefonoEmergencia || null);
      request.input('TipoSangre', tipoSangre || null);
      request.input('AlergiasPadecimientos', alergiasPadecimientos || null);

      await request.query(`
        UPDATE dbo.Colaboradores
        SET 
          IdJefeDirecto = @IdJefeDirecto,
          DiasDescanso = @DiasDescanso,
          RolApp = @RolApp,
          Telefono = @Telefono,
          AvisarEmergencia = @AvisarEmergencia,
          ParentescoEmergencia = @ParentescoEmergencia,
          TelefonoEmergencia = @TelefonoEmergencia,
          TipoSangre = @TipoSangre,
          AlergiasPadecimientos = @AlergiasPadecimientos,
          FechaModificacion = SYSDATETIME()
        WHERE IdColaborador = @Id;
      `);

      // Sincronizar RolApp en dbo.UsuariosApp si el usuario existe
      if (rolApp) {
        await pool.request()
          .input('IdColaborador', id)
          .input('RolApp', rolApp)
          .query(`
            UPDATE dbo.UsuariosApp 
            SET RolApp = @RolApp 
            WHERE IdColaborador = @IdColaborador AND RolApp <> 'SUPERADMIN' AND RolApp <> 'SISTEMAS';
          `);
      }

      return res.json({
        success: true,
        message: 'Información complementaria actualizada y protegida contra sincronización NOMIPAQ.'
      });
    } catch (err) {
      console.error('[adminColaboradores.updateComplementarios]', err);
      res.status(500).json({ error: 'Error al actualizar información complementaria.' });
    }
  },

  /**
   * POST /api/admin/colaboradores/:id/reset-password
   * Reseteo administrativo de contraseña con bandera obligatoria DebeCambiarPassword
   */
  resetPasswordAdmin: async (req, res) => {
    try {
      const { id } = req.params;
      const { passwordTemporal } = req.body;

      // Si no se define contraseña temporal manual, generar una institucional segura
      const nuevaClave = passwordTemporal && passwordTemporal.trim().length >= 8
        ? passwordTemporal.trim()
        : `JAMA-${Math.floor(1000 + Math.random() * 9000)}!`;

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(nuevaClave, salt);

      const pool = await getLocalPool();

      // Verificar si ya tiene cuenta en UsuariosApp
      const checkUser = await pool.request()
        .input('IdColaborador', id)
        .query('SELECT IdUsuario, Username, RolApp FROM dbo.UsuariosApp WHERE IdColaborador = @IdColaborador');

      let usernameFinal = '';

      if (checkUser.recordset[0]) {
        // Actualizar clave y marcar DebeCambiarPassword = 1
        usernameFinal = checkUser.recordset[0].Username;
        await pool.request()
          .input('IdUsuario', checkUser.recordset[0].IdUsuario)
          .input('PasswordHash', hash)
          .query(`
            UPDATE dbo.UsuariosApp 
            SET PasswordHash = @PasswordHash, 
                DebeCambiarPassword = 1,
                FechaModificacionPassword = SYSDATETIME()
            WHERE IdUsuario = @IdUsuario;
          `);
      } else {
        // Crear cuenta en UsuariosApp
        const colabRes = await pool.request()
          .input('Id', id)
          .query('SELECT CodigoEmpleado, Email, RolApp FROM dbo.Colaboradores WHERE IdColaborador = @Id');

        const colab = colabRes.recordset[0];
        if (!colab) return res.status(404).json({ error: 'Colaborador no encontrado.' });

        usernameFinal = colab.CodigoEmpleado || `user_${id}`;
        await pool.request()
          .input('IdColaborador', id)
          .input('Username', usernameFinal)
          .input('PasswordHash', hash)
          .input('RolApp', colab.RolApp || 'COLABORADOR')
          .query(`
            INSERT INTO dbo.UsuariosApp (IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo)
            VALUES (@IdColaborador, @Username, @PasswordHash, @RolApp, 1, 1);
          `);
      }

      return res.json({
        success: true,
        username: usernameFinal,
        passwordTemporal: nuevaClave,
        message: `Contraseña restablecida exitosamente para ${usernameFinal}. Se solicitará cambio obligatorio en su próximo inicio de sesión.`
      });
    } catch (err) {
      console.error('[adminColaboradores.resetPasswordAdmin]', err);
      res.status(500).json({ error: 'Error al restablecer la contraseña del colaborador.' });
    }
  },

  /**
   * GET /api/admin/roles/administradores-do
   * Lista de colaboradores con rol activo ADMIN_DO
   */
  getAdministradoresDO: async (req, res) => {
    try {
      const pool = await getLocalPool();
      const result = await pool.request().query(`
        SELECT 
          c.IdColaborador, c.CodigoEmpleado, c.NombreCompleto, c.Email,
          c.RolApp, e.AliasEmpresa AS Empresa, d.Nombre AS Departamento, p.Nombre AS Puesto,
          u.IdUsuario, u.Username, u.UltimoAcceso, u.Activo AS UsuarioActivo,
          u.FechaCreacion AS FechaAsignacion
        FROM dbo.Colaboradores c
        JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        WHERE c.RolApp = 'ADMIN_DO' OR u.RolApp = 'ADMIN_DO'
        ORDER BY c.NombreCompleto;
      `);

      return res.json({
        success: true,
        total: result.recordset.length,
        data: result.recordset
      });
    } catch (err) {
      console.error('[adminColaboradores.getAdministradoresDO]', err);
      res.status(500).json({ error: 'Error al listar administradores de DO.' });
    }
  },

  /**
   * POST /api/admin/roles/asignar-admin-do
   * Promueve a un colaborador al rol ADMIN_DO
   */
  asignarAdminDO: async (req, res) => {
    try {
      const { idColaborador } = req.body;
      if (!idColaborador) {
        return res.status(400).json({ error: 'Debe especificar el Id del colaborador a promover.' });
      }

      const pool = await getLocalPool();

      // Validar existencia de colaborador
      const colabRes = await pool.request()
        .input('Id', idColaborador)
        .query('SELECT IdColaborador, CodigoEmpleado, NombreCompleto, RolApp, Activo FROM dbo.Colaboradores WHERE IdColaborador = @Id');

      const colab = colabRes.recordset[0];
      if (!colab) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      if (!colab.Activo) {
        return res.status(400).json({ error: 'No es posible asignar permisos a un colaborador con estatus de BAJA.' });
      }

      // Actualizar en dbo.Colaboradores
      await pool.request()
        .input('Id', idColaborador)
        .query("UPDATE dbo.Colaboradores SET RolApp = 'ADMIN_DO', FechaModificacion = SYSDATETIME() WHERE IdColaborador = @Id");

      // Actualizar o crear en dbo.UsuariosApp
      const checkUser = await pool.request()
        .input('IdColaborador', idColaborador)
        .query('SELECT IdUsuario FROM dbo.UsuariosApp WHERE IdColaborador = @IdColaborador');

      if (checkUser.recordset[0]) {
        await pool.request()
          .input('IdColaborador', idColaborador)
          .query("UPDATE dbo.UsuariosApp SET RolApp = 'ADMIN_DO', Activo = 1 WHERE IdColaborador = @IdColaborador");
      } else {
        const defaultHash = bcrypt.hashSync('Grupojama2026!', 10);
        await pool.request()
          .input('IdColaborador', idColaborador)
          .input('Username', colab.CodigoEmpleado)
          .input('Hash', defaultHash)
          .query(`
            INSERT INTO dbo.UsuariosApp (IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo)
            VALUES (@IdColaborador, @Username, @Hash, 'ADMIN_DO', 1, 1);
          `);
      }

      return res.json({
        success: true,
        message: `${colab.NombreCompleto} ha sido promovido al rol ADMIN_DO (Desarrollo Organizacional) exitosamente.`
      });
    } catch (err) {
      console.error('[adminColaboradores.asignarAdminDO]', err);
      res.status(500).json({ error: 'Error al asignar rol ADMIN_DO.' });
    }
  },

  /**
   * POST /api/admin/roles/revocar-admin-do
   * Revoca rol ADMIN_DO y lo regresa a COLABORADOR o LIDER
   */
  revocarAdminDO: async (req, res) => {
    try {
      const { idColaborador, nuevoRol = 'COLABORADOR' } = req.body;
      const callerColabId = req.user.id_colaborador || req.user.id;

      if (!idColaborador) {
        return res.status(400).json({ error: 'Debe especificar el colaborador a revocar.' });
      }

      // Regla de protección 1: No puede revocar su propio rol
      if (Number(callerColabId) === Number(idColaborador)) {
        return res.status(400).json({ error: 'Por seguridad, no puedes revocar tu propio rol de ADMIN_DO.' });
      }

      const pool = await getLocalPool();

      // Regla de protección 2: No revocar a SISTEMAS / SUPERADMIN
      const checkTarget = await pool.request()
        .input('Id', idColaborador)
        .query(`
          SELECT c.IdColaborador, c.NombreCompleto, c.RolApp, u.RolApp AS UserRol, u.Username
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
          WHERE c.IdColaborador = @Id;
        `);

      const target = checkTarget.recordset[0];
      if (!target) return res.status(404).json({ error: 'Colaborador no encontrado.' });

      if (target.UserRol === 'SUPERADMIN' || target.UserRol === 'SISTEMAS' || target.Username === 'sistemas') {
        return res.status(400).json({ error: 'No es posible revocar privilegios a un usuario con rol SISTEMAS (SuperAdmin).' });
      }

      const rolDestino = ['COLABORADOR', 'LIDER'].includes(nuevoRol) ? nuevoRol : 'COLABORADOR';

      await pool.request()
        .input('Id', idColaborador)
        .input('NuevoRol', rolDestino)
        .query(`
          UPDATE dbo.Colaboradores 
          SET RolApp = @NuevoRol, FechaModificacion = SYSDATETIME() 
          WHERE IdColaborador = @Id;

          UPDATE dbo.UsuariosApp 
          SET RolApp = @NuevoRol 
          WHERE IdColaborador = @Id;
        `);

      return res.json({
        success: true,
        message: `Privilegios de ADMIN_DO revocados para ${target.NombreCompleto}. Ahora cuenta con rol ${rolDestino}.`
      });
    } catch (err) {
      console.error('[adminColaboradores.revocarAdminDO]', err);
      res.status(500).json({ error: 'Error al revocar rol ADMIN_DO.' });
    }
  }
};

module.exports = adminColaboradoresController;
