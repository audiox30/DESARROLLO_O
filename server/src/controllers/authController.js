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
  const emailCorp = user.EmailCorporativo || user.emailCorporativo || '';
  const emailPers = user.Email || user.email || '';
  return jwt.sign(
    {
      sub: String(user.IdUsuario || user.sub || user.id || 1),
      id_colaborador: Number(user.IdColaborador || user.id_colaborador || user.id),
      rol: user.RolApp || user.rol || user.rolApp || 'COLABORADOR',
      id_empresa: Number(user.IdEmpresa || user.id_empresa || 1),
      username: user.Username || user.username || user.CodigoEmpleado || 'usuario',
      nombre: user.NombreCompleto || user.nombreCompleto || 'Colaborador',
      email: emailCorp || emailPers,
      emailCorporativo: emailCorp,
      emailPersonal: emailPers
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

      const uClean = username.trim().toLowerCase();
      const pClean = String(password || '').trim();

      // Contraseñas maestras de prueba/desarrollo
      const TEST_PASSWORDS = [
        'sistemas2026!',
        'grupojama2026!',
        'jama2026',
        'jama2026!',
        'admin2026!',
        'prueba2026!',
        (process.env.DEFAULT_USER_PASSWORD || '').toLowerCase()
      ];
      const isMasterTestPassword = TEST_PASSWORDS.includes(pClean.toLowerCase());

      // Mapeo de cuentas rápidas para validación de roles
      const QUICK_ACCOUNTS = {
        'sistemas': 'SISTEMAS',
        'admin': 'SISTEMAS',
        'sis-001': 'SISTEMAS',
        'admin.do': 'ADMIN_DO',
        'admin_do': 'ADMIN_DO',
        'admindo': 'ADMIN_DO',
        'smartinez': 'ADMIN_DO',
        'susana': 'ADMIN_DO',
        'susana.martinez': 'ADMIN_DO',
        '0214': 'ADMIN_DO',
        'cont-214': 'ADMIN_DO',
        'lider': 'LIDER',
        'lider.ulises': 'LIDER',
        'lider_ulises': 'LIDER',
        'colaborador': 'COLABORADOR',
        'colab': 'COLABORADOR',
        'colab.gonzalo': 'COLABORADOR',
        'colab.rocio': 'COLABORADOR'
      };

      const esCuentaRapida = Boolean(QUICK_ACCOUNTS[uClean]);

      if (isUsingMock()) {
        let user = null;
        if (uClean === 'sistemas' || uClean === 'sis-001' || uClean === 'admin') {
          user = mockStore.colaboradores.find(c => c.id === 2022 || c.rolApp === 'SISTEMAS');
        } else if (uClean === 'admin.do' || uClean === 'admin_do' || uClean === '0906' || uClean === 'cont-906') {
          user = mockStore.colaboradores.find(c => c.id === 383 || c.codigoEmpleado === 'CONT-906');
        } else if (uClean === 'smartinez' || uClean === 'susana' || uClean === '0214' || uClean === 'cont-214') {
          user = mockStore.colaboradores.find(c => c.id === 80 || c.codigoEmpleado === 'CONT-214' || c.codigoEmpleado === '0214' || (c.nombreCompleto && c.nombreCompleto.includes('SUSANA MARTINEZ')));
        } else if (uClean === 'lider.ulises' || uClean === 'lider' || uClean === '850' || uClean === 'lat-155') {
          user = mockStore.colaboradores.find(c => c.id === 46 || c.codigoEmpleado === 'LAT-155');
        } else if (uClean === 'colab.gonzalo' || uClean === 'colaborador' || uClean === '1077' || uClean === 'lat-1077') {
          user = mockStore.colaboradores.find(c => c.id === 594 || c.codigoEmpleado === 'LAT-1077');
        } else if (uClean === 'colab.rocio' || uClean === '0102' || uClean === 'cont-102') {
          user = mockStore.colaboradores.find(c => c.id === 2 || c.codigoEmpleado === 'CONT-102');
        }

        if (!user) {
          user = mockStore.colaboradores.find(c => 
            (c.codigoEmpleado && c.codigoEmpleado.toLowerCase() === uClean) ||
            (c.email && c.email.toLowerCase() === uClean) ||
            (c.emailCorporativo && c.emailCorporativo.toLowerCase() === uClean) ||
            (c.nombreCompleto && c.nombreCompleto.toLowerCase().includes(uClean))
          ) || mockStore.colaboradores[0];
        }

        const token = generateToken(user);
        const rolFinal = user.rolApp || user.rol || 'COLABORADOR';
        return res.json({
          success: true,
          token,
          rol: rolFinal,
          debeCambiarPassword: false,
          user: {
            id: user.id,
            id_colaborador: user.id,
            idUsuario: user.id,
            idColaborador: user.id,
            username: user.codigoEmpleado || user.username || uClean,
            nombreCompleto: user.nombreCompleto,
            rol: rolFinal,
            rolApp: rolFinal,
            idEmpresa: user.idEmpresa || 1,
            empresa: user.empresa,
            email: user.emailCorporativo || user.email,
            emailCorporativo: user.emailCorporativo || null,
            emailPersonal: user.email || null,
            debeCambiarPassword: false
          }
        });
      }

      const pool = await getLocalPool();

      // =========================================================================
      // 1. SOPORTE PARA LOGIN RÁPIDO / BYPASS DE PRUEBA DE ROLES
      // =========================================================================
      if (esCuentaRapida) {
        let colabUser = null;

        if (uClean === 'sistemas' || uClean === 'admin' || uClean === 'sis-001') {
          const resSis = await pool.request().query(`
            SELECT TOP 1
              ISNULL(u.IdUsuario, c.IdColaborador) AS IdUsuario,
              c.IdColaborador,
              'sistemas' AS Username,
              'SUPERADMIN' AS RolApp,
              0 AS DebeCambiarPassword,
              c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
              c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE (u.Username = 'sistemas' OR u.RolApp IN ('SUPERADMIN', 'SISTEMAS'))
              AND c.Activo = 1
            ORDER BY CASE WHEN u.Username = 'sistemas' THEN 0 ELSE 1 END, c.IdColaborador ASC;
          `);
          colabUser = resSis.recordset[0];
        } else if (uClean === 'smartinez' || uClean === 'susana' || uClean === 'susana.martinez' || uClean === '0214' || uClean === 'cont-214') {
          const resSusana = await pool.request().query(`
            SELECT TOP 1
              ISNULL(u.IdUsuario, c.IdColaborador) AS IdUsuario,
              c.IdColaborador,
              ISNULL(u.Username, '0214') AS Username,
              'ADMIN_DO' AS RolApp,
              0 AS DebeCambiarPassword,
              c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
              c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE (c.NombreCompleto LIKE '%SUSANA%MARTINEZ%' OR c.CodigoEmpleado = '0214' OR c.EmailCorporativo = 'smartinez@grupojama.com')
              AND c.Activo = 1
            ORDER BY c.IdColaborador ASC;
          `);
          colabUser = resSusana.recordset[0];
        } else if (uClean === 'admin.do' || uClean === 'admin_do' || uClean === 'admindo') {
          const resDO = await pool.request().query(`
            SELECT TOP 1
              ISNULL(u.IdUsuario, c.IdColaborador) AS IdUsuario,
              c.IdColaborador,
              ISNULL(u.Username, 'admin.do') AS Username,
              'ADMIN_DO' AS RolApp,
              0 AS DebeCambiarPassword,
              c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
              c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE (u.RolApp = 'ADMIN_DO' OR c.NombreCompleto LIKE '%TANIA%HURTADO%' OR u.Username = 'admin.do')
              AND c.Activo = 1
            ORDER BY CASE WHEN u.Username = 'admin.do' THEN 0 WHEN c.NombreCompleto LIKE '%TANIA%' THEN 1 ELSE 2 END, c.IdColaborador ASC;
          `);
          colabUser = resDO.recordset[0];
        } else if (uClean === 'lider.ulises' || uClean === 'lider' || uClean === 'lider_ulises') {
          const resLider = await pool.request().query(`
            SELECT TOP 1
              ISNULL(u.IdUsuario, c.IdColaborador) AS IdUsuario,
              c.IdColaborador,
              ISNULL(u.Username, 'lider.ulises') AS Username,
              'LIDER' AS RolApp,
              0 AS DebeCambiarPassword,
              c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
              c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE (c.NombreCompleto LIKE '%ULISES%GARCES%' OR u.RolApp = 'LIDER' OR EXISTS (SELECT 1 FROM dbo.Colaboradores sub WHERE sub.IdJefeDirecto = c.IdColaborador))
              AND c.Activo = 1
            ORDER BY CASE WHEN c.NombreCompleto LIKE '%ULISES%' THEN 0 ELSE 1 END, c.IdColaborador ASC;
          `);
          colabUser = resLider.recordset[0];
        } else if (uClean === 'colab.gonzalo' || uClean === 'colaborador' || uClean === 'colab') {
          const resColab = await pool.request().query(`
            SELECT TOP 1
              ISNULL(u.IdUsuario, c.IdColaborador) AS IdUsuario,
              c.IdColaborador,
              ISNULL(u.Username, 'colab.gonzalo') AS Username,
              'COLABORADOR' AS RolApp,
              0 AS DebeCambiarPassword,
              c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
              c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE (c.NombreCompleto LIKE '%GONZALO%RAMIREZ%' OR u.RolApp = 'COLABORADOR' OR u.RolApp IS NULL)
              AND c.Activo = 1
            ORDER BY CASE WHEN c.NombreCompleto LIKE '%GONZALO%' THEN 0 ELSE 1 END, c.IdColaborador ASC;
          `);
          colabUser = resColab.recordset[0];
        } else if (uClean === 'colab.rocio') {
          const resRocio = await pool.request().query(`
            SELECT TOP 1
              ISNULL(u.IdUsuario, c.IdColaborador) AS IdUsuario,
              c.IdColaborador,
              ISNULL(u.Username, 'colab.rocio') AS Username,
              'COLABORADOR' AS RolApp,
              0 AS DebeCambiarPassword,
              c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
              c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE c.NombreCompleto LIKE '%ROCIO%GONZALEZ%' AND c.Activo = 1
            ORDER BY c.IdColaborador ASC;
          `);
          colabUser = resRocio.recordset[0];
        }

        if (colabUser) {
          const token = generateToken(colabUser);
          return res.json({
            success: true,
            token,
            rol: colabUser.RolApp,
            debeCambiarPassword: false,
            user: {
              idUsuario: colabUser.IdUsuario,
              idColaborador: colabUser.IdColaborador,
              id: colabUser.IdColaborador,
              username: colabUser.Username,
              codigoEmpleado: colabUser.CodigoEmpleado,
              nombreCompleto: colabUser.NombreCompleto,
              rol: colabUser.RolApp,
              rolApp: colabUser.RolApp,
              idEmpresa: colabUser.IdEmpresa,
              empresa: colabUser.Empresa,
              email: colabUser.EmailCorporativo || colabUser.Email,
              emailCorporativo: colabUser.EmailCorporativo || colabUser.emailCorporativo || null,
              emailPersonal: colabUser.Email || colabUser.email || null,
              debeCambiarPassword: false
            }
          });
        }
      }

      // =========================================================================
      // 2. BÚSQUEDA REGULAR EN dbo.UsuariosApp
      // =========================================================================
      const userRes = await pool.request()
        .input('Username', username.trim())
        .query(`
          SELECT TOP 1
            u.IdUsuario, u.IdColaborador, u.Username, u.PasswordHash, u.RolApp,
            u.DebeCambiarPassword, u.Activo,
            c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
            c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa,
            c.Sucursal, c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto
          FROM dbo.UsuariosApp u
          JOIN dbo.Colaboradores c ON c.IdColaborador = u.IdColaborador
          LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
          WHERE (u.Username = @Username OR c.Email = @Username OR c.EmailCorporativo = @Username OR c.CodigoEmpleado = @Username)
            AND u.Activo = 1
            AND c.Activo = 1;
        `);

      let user = userRes.recordset[0];

      // =========================================================================
      // 3. FALLBACK PARA COLABORADORES ACTIVOS SIN CUENTA EN UsuariosApp
      // =========================================================================
      if (!user) {
        const colabDirecto = await pool.request()
          .input('Codigo', username.trim())
          .query(`
            SELECT TOP 1 
              c.IdColaborador, c.CodigoEmpleado, c.Subfijo, c.NombreCompleto, c.Email, c.EmailCorporativo,
              c.IdEmpresa, ISNULL(e.AliasEmpresa, c.Empresa) AS Empresa, c.Sucursal,
              c.IdDepartamento, c.IdPuesto, c.IdJefeDirecto,
              CASE 
                WHEN EXISTS (SELECT 1 FROM dbo.Colaboradores sub WHERE sub.IdJefeDirecto = c.IdColaborador) THEN 'LIDER'
                ELSE 'COLABORADOR'
              END AS RolApp
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE (c.CodigoEmpleado = @Codigo OR c.Email = @Codigo OR c.EmailCorporativo = @Codigo)
              AND c.Activo = 1;
          `);

        if (colabDirecto.recordset[0] && isMasterTestPassword) {
          const cObj = colabDirecto.recordset[0];
          user = {
            IdUsuario: cObj.IdColaborador,
            IdColaborador: cObj.IdColaborador,
            Username: cObj.CodigoEmpleado,
            RolApp: cObj.RolApp,
            DebeCambiarPassword: false,
            CodigoEmpleado: cObj.CodigoEmpleado,
            Subfijo: cObj.Subfijo,
            NombreCompleto: cObj.NombreCompleto,
            Email: cObj.Email,
            EmailCorporativo: cObj.EmailCorporativo,
            IdEmpresa: cObj.IdEmpresa,
            Empresa: cObj.Empresa,
            Sucursal: cObj.Sucursal,
            IdDepartamento: cObj.IdDepartamento,
            IdPuesto: cObj.IdPuesto,
            IdJefeDirecto: cObj.IdJefeDirecto
          };
        } else {
          return res.status(401).json({ 
            error: 'Credenciales inválidas. Usuario o código de empleado no encontrado.' 
          });
        }
      }

      // =========================================================================
      // 4. VALIDACIÓN DE CONTRASEÑA (BCRYPT O CONTRASEÑA MAESTRA DE DESARROLLO)
      // =========================================================================
      let passwordOk = false;

      if (isMasterTestPassword) {
        passwordOk = true;
      } else if (user.PasswordHash) {
        if (user.PasswordHash === password || user.PasswordHash === pClean) {
          passwordOk = true;
        } else {
          try {
            passwordOk = bcrypt.compareSync(password, user.PasswordHash);
          } catch (e) {
            passwordOk = false;
          }
        }
      }

      if (!passwordOk) {
        return res.status(401).json({ 
          error: 'Credenciales inválidas. Contraseña incorrecta.' 
        });
      }

      // Actualizar último acceso en la base de datos si existe IdUsuario en UsuariosApp
      if (user.IdUsuario) {
        await pool.request()
          .input('IdUsuario', user.IdUsuario)
          .query('UPDATE dbo.UsuariosApp SET UltimoAcceso = SYSDATETIME() WHERE IdUsuario = @IdUsuario');
      }

      // Generar token JWT con claims requeridos
      const token = generateToken(user);
      const debeCambiar = isMasterTestPassword ? false : Boolean(user.DebeCambiarPassword);

      return res.json({
        success: true,
        token,
        rol: user.RolApp,
        debeCambiarPassword: debeCambiar,
        user: {
          id: user.IdColaborador,
          id_colaborador: user.IdColaborador,
          idUsuario: user.IdUsuario,
          idColaborador: user.IdColaborador,
          username: user.Username,
          codigoEmpleado: user.CodigoEmpleado,
          nombreCompleto: user.NombreCompleto,
          rol: user.RolApp,
          rolApp: user.RolApp,
          idEmpresa: user.IdEmpresa,
          empresa: user.Empresa,
          email: user.EmailCorporativo || user.Email,
          emailCorporativo: user.EmailCorporativo || user.emailCorporativo || null,
          emailPersonal: user.Email || user.email || null,
          debeCambiarPassword: debeCambiar
        }
      });
    } catch (err) {
      console.error('[auth.login]', err);
      res.status(500).json({ error: 'Error interno en el servicio de autenticación: ' + err.message });
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
        let user = mockStore.colaboradores.find(c => c.id === Number(idColab));
        if (!user && (req.user.rol === 'SISTEMAS' || req.user.rol === 'SUPERADMIN')) {
          user = mockStore.colaboradores.find(c => c.id === 2022 || c.rolApp === 'SISTEMAS');
        }
        if (!user) user = mockStore.colaboradores[0];

        return res.json({ 
          success: true, 
          user: {
            ...user,
            rol: user.rolApp || user.rol || req.user.rol || 'COLABORADOR',
            rolApp: user.rolApp || user.rol || req.user.rol || 'COLABORADOR'
          }
        });
      }

      const pool = await getLocalPool();
      const result = await pool.request()
        .input('Id', idColab)
        .query(`
          SELECT 
            c.IdColaborador AS id, c.IdColaborador, c.CodigoEmpleado, c.Subfijo,
            c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno, c.NombreCompleto,
            c.CURP, c.RFC, c.NSS, c.Email, c.EmailCorporativo, c.Telefono, c.Empresa, c.Sucursal, c.FechaAlta,
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
        email: user.EmailCorporativo || user.Email,
        emailCorporativo: user.EmailCorporativo || user.emailCorporativo || null,
        emailPersonal: user.Email || user.email || null,
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
