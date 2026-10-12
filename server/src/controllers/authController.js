const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getLocalPool, getPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');

const JWT_SECRET = process.env.JWT_SECRET || 'jama_secret_vacaciones_desarrollo_o_2026_jwt_token';

// Personas demo representativas de la estructura organizativa de Grupo JAMA
const PERSONAS_DEMO = [
  {
    username: 'sistemas',
    codigoEmpleado: 'SIS-001',
    idColaborador: 2022,
    rol: 'SUPERADMIN',
    titulo: 'Sistemas / TI (SuperAdmin Global)',
    descripcion: 'Administrador de Sistemas - Acceso Total a Sincronización, Catálogos, Logs y Todas las Empresas'
  },
  {
    username: 'admin.do',
    codigoEmpleado: '0906',
    idColaborador: 29,
    rol: 'ADMIN_DO',
    titulo: 'Desarrollo Organizacional (Admin Global)',
    descripcion: 'Tania del Carmen Hurtado Avalos - Especialista DO (Control Global, Nóminas y VoBo)'
  },
  {
    username: 'lider.ulises',
    codigoEmpleado: '850',
    idColaborador: 850,
    rol: 'LIDER',
    titulo: 'Líder / Gerente Directo (Aprobador)',
    descripcion: 'Ulises Antonio Garcés Rodríguez - Equipo operativo a cargo directo (Latino Concretos)'
  },
  {
    username: 'colab.gonzalo',
    codigoEmpleado: '1077',
    idColaborador: 1039,
    rol: 'COLABORADOR',
    titulo: 'Colaborador Solicitante (Equipo Ulises)',
    descripcion: 'Gonzalo Ramírez Gallardo - Operador Revolvedora (Latino Concretos)'
  },
  {
    username: 'colab.rocio',
    codigoEmpleado: '0102',
    idColaborador: 25,
    rol: 'COLABORADOR',
    titulo: 'Colaborador Solicitante (Construjama)',
    descripcion: 'Rocío Imelda González Salas - Auxiliar Administrativo (Construjama)'
  }
];

function generateToken(user) {
  return jwt.sign(
    {
      sub: String(user.IdUsuario || user.sub || user.id || 1),
      id_colaborador: Number(user.IdColaborador || user.id_colaborador || user.id),
      rol: user.RolApp || user.rol || user.rolApp || 'COLABORADOR',
      id_empresa: Number(user.IdEmpresa || user.id_empresa || 1),
      username: user.Username || user.username || user.CodigoEmpleado || 'usuario',
      nombre: user.NombreCompleto || user.nombreCompleto || 'Colaborador',
      email: user.Email || user.email || ''
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

const authController = {
  /**
   * POST /api/auth/login
   * Valida credenciales contra dbo.UsuariosApp (bcrypt)
   * Claims JWT: { sub: IdUsuario, id_colaborador, rol, id_empresa }
   */
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          error: 'Debe ingresar su usuario (o código de nómina) y contraseña.' 
        });
      }

      if (isUsingMock()) {
        const u = username.toLowerCase().trim();
        let user = mockStore.colaboradores.find(c => 
          (c.codigoEmpleado && c.codigoEmpleado.toLowerCase() === u) ||
          (c.email && c.email.toLowerCase() === u) ||
          (c.nombreCompleto && c.nombreCompleto.toLowerCase().includes(u))
        ) || mockStore.colaboradores[0];

        const token = generateToken(user);
        return res.json({
          success: true,
          token,
          debeCambiarPassword: false,
          user: {
            idUsuario: user.id,
            idColaborador: user.id,
            username: user.codigoEmpleado,
            nombreCompleto: user.nombreCompleto,
            rol: user.rolApp,
            idEmpresa: user.idEmpresa || 1,
            empresa: user.empresa,
            email: user.email,
            debeCambiarPassword: false
          }
        });
      }

      const pool = await getLocalPool();
      const uClean = username.trim();

      // Búsqueda por Username exacto, por Email o por CodigoEmpleado
      const userRes = await pool.request()
        .input('Username', uClean)
        .query(`
          SELECT TOP 1
            u.IdUsuario, u.IdColaborador, u.Username, u.PasswordHash, u.RolApp,
            u.DebeCambiarPassword, u.Activo,
            c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, 
            c.IdEmpresa, c.Empresa, c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
          FROM dbo.UsuariosApp u
          JOIN dbo.Colaboradores c ON c.IdColaborador = u.IdColaborador
          WHERE (u.Username = @Username OR c.Email = @Username OR c.CodigoEmpleado = @Username)
            AND u.Activo = 1
            AND c.Activo = 1
        `);

      const user = userRes.recordset[0];
      if (!user) {
        return res.status(401).json({ 
          error: 'Credenciales inválidas. Usuario o código de empleado no encontrado.' 
        });
      }

      // Validar hash bcrypt
      const passwordOk = bcrypt.compareSync(password, user.PasswordHash);
      if (!passwordOk) {
        return res.status(401).json({ 
          error: 'Credenciales inválidas. Contraseña incorrecta.' 
        });
      }

      // Actualizar último acceso
      await pool.request()
        .input('IdUsuario', user.IdUsuario)
        .query('UPDATE dbo.UsuariosApp SET UltimoAcceso = SYSDATETIME() WHERE IdUsuario = @IdUsuario');

      // Generar token JWT con claims requeridos
      const token = generateToken(user);

      return res.json({
        success: true,
        token,
        debeCambiarPassword: Boolean(user.DebeCambiarPassword),
        user: {
          idUsuario: user.IdUsuario,
          idColaborador: user.IdColaborador,
          username: user.Username,
          codigoEmpleado: user.CodigoEmpleado,
          nombreCompleto: user.NombreCompleto,
          rol: user.RolApp,
          rolApp: user.RolApp,
          idEmpresa: user.IdEmpresa,
          empresa: user.Empresa,
          email: user.Email,
          debeCambiarPassword: Boolean(user.DebeCambiarPassword)
        }
      });
    } catch (err) {
      console.error('[auth.login]', err);
      res.status(500).json({ error: 'Error interno en el servicio de autenticación.' });
    }
  },

  /**
   * POST /api/auth/cambiar-password
   * Endpoint para forzar la actualización de contraseña temporal
   */
  cambiarPassword: async (req, res) => {
    try {
      const { passwordActual, passwordNuevo } = req.body;
      const idUsuario = req.user.sub || req.user.idUsuario;

      if (!passwordNuevo || passwordNuevo.length < 8) {
        return res.status(400).json({ 
          error: 'La nueva contraseña debe contener al menos 8 caracteres.' 
        });
      }

      if (isUsingMock()) {
        return res.json({ 
          success: true, 
          message: 'Contraseña actualizada exitosamente (Modo Mock).' 
        });
      }

      const pool = await getLocalPool();
      const userRes = await pool.request()
        .input('IdUsuario', idUsuario)
        .query('SELECT IdUsuario, PasswordHash, DebeCambiarPassword FROM dbo.UsuariosApp WHERE IdUsuario = @IdUsuario AND Activo = 1');

      const user = userRes.recordset[0];
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado o inactivo.' });
      }

      // Validar contraseña actual si se suministra o si no es cambio inicial obligado
      if (passwordActual) {
        const actualOk = bcrypt.compareSync(passwordActual, user.PasswordHash);
        if (!actualOk) {
          return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
        }
      }

      if (passwordActual && passwordActual === passwordNuevo) {
        return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la contraseña actual.' });
      }

      // Hashear nueva contraseña
      const newHash = bcrypt.hashSync(passwordNuevo, 10);

      await pool.request()
        .input('IdUsuario', idUsuario)
        .input('PasswordHash', newHash)
        .query(`
          UPDATE dbo.UsuariosApp 
          SET PasswordHash = @PasswordHash, 
              DebeCambiarPassword = 0, 
              FechaModificacionPassword = SYSDATETIME()
          WHERE IdUsuario = @IdUsuario
        `);

      return res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente. Tu cuenta ahora se encuentra 100% activa.'
      });
    } catch (err) {
      console.error('[auth.cambiarPassword]', err);
      res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    }
  },

  /**
   * GET /api/auth/me
   * Retorna perfil del usuario actualmente autenticado
   */
  getCurrentUser: async (req, res) => {
    try {
      const idColab = req.user.id_colaborador || req.user.id;

      if (isUsingMock()) {
        const user = mockStore.colaboradores.find(c => c.id === Number(idColab)) || mockStore.colaboradores[0];
        return res.json({ success: true, user });
      }

      const pool = await getLocalPool();
      const result = await pool.request()
        .input('Id', idColab)
        .query(`
          SELECT 
            c.IdColaborador AS id, c.IdColaborador, c.CodigoEmpleado, c.Subfijo,
            c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno, c.NombreCompleto,
            c.CURP, c.RFC, c.NSS, c.Email, c.Telefono, c.Empresa, c.Sucursal, c.FechaAlta,
            c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto, c.RolApp, c.JornadaLaboralDias, c.Activo,
            p.Nombre AS Puesto, d.Nombre AS Departamento,
            j.NombreCompleto AS JefeDirectoNombre,
            u.IdUsuario, u.Username, u.DebeCambiarPassword,
            e.AliasEmpresa
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
          LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
          WHERE c.IdColaborador = @Id
        `);

      const user = result.recordset[0];
      if (!user) return res.status(404).json({ error: 'Colaborador no encontrado.' });

      const normalizedUser = {
        ...user,
        id: user.IdColaborador,
        idUsuario: user.IdUsuario,
        idColaborador: user.IdColaborador,
        nombreCompleto: user.NombreCompleto,
        codigoEmpleado: user.CodigoEmpleado,
        rolApp: user.RolApp,
        rol: user.RolApp,
        empresa: user.AliasEmpresa || user.Empresa,
        email: user.Email,
        debeCambiarPassword: Boolean(user.DebeCambiarPassword)
      };

      return res.json({ success: true, user: normalizedUser });
    } catch (err) {
      console.error('[auth.getCurrentUser]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/auth/personas
   * Lista de personas representativas para demo interactivo
   */
  getDemoPersonas: async (req, res) => {
    try {
      res.json({
        success: true,
        personas: PERSONAS_DEMO
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/auth/switch
   * Cambio rápido de usuario para modo demostración
   */
  switchUser: async (req, res) => {
    try {
      const { codigoEmpleado, id, username } = req.body;
      let user = null;

      if (isUsingMock()) {
        if (id) user = mockStore.colaboradores.find(c => c.id === Number(id));
        else if (codigoEmpleado) user = mockStore.colaboradores.find(c => c.codigoEmpleado === codigoEmpleado);
        user = user || mockStore.colaboradores[0];
      } else {
        const pool = await getLocalPool();
        const reqDb = pool.request();
        let queryWhere = '';

        if (id) {
          reqDb.input('Id', Number(id));
          queryWhere = 'c.IdColaborador = @Id';
        } else if (username) {
          reqDb.input('Username', username);
          queryWhere = '(u.Username = @Username OR c.CodigoEmpleado = @Username)';
        } else if (codigoEmpleado) {
          reqDb.input('Codigo', codigoEmpleado);
          queryWhere = '(c.CodigoEmpleado = @Codigo OR u.Username = @Codigo)';
        } else {
          queryWhere = "c.RolApp = 'ADMIN_DO'";
        }

        const result = await reqDb.query(`
          SELECT TOP 1
            u.IdUsuario, u.Username, u.DebeCambiarPassword,
            c.IdColaborador, c.IdColaborador AS id, c.CodigoEmpleado, c.NombreCompleto,
            c.CURP, c.RFC, c.Email, c.Empresa, c.Sucursal, c.FechaAlta,
            c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto, c.RolApp, c.IdEmpresa, c.Activo
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
          WHERE ${queryWhere} AND c.Activo = 1
        `);

        user = result.recordset[0];
      }

      if (!user) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user
      });
    } catch (err) {
      console.error('[auth.switchUser]', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = authController;
