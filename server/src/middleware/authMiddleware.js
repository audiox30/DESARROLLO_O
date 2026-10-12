const jwt = require('jsonwebtoken');
const { getLocalPool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'jama_secret_vacaciones_desarrollo_o_2026_jwt_token';

/**
 * Middleware de Autenticación JWT:
 * Extrae y valida el token Bearer en cabecera Authorization.
 * Inyecta claims normalizados en req.user:
 * { sub: IdUsuario, id_colaborador, rol, id_empresa, username, nombre, email }
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Si no hay token, verificar si hay header x-user-id para desarrollo/pruebas locales
    const customUserId = req.headers['x-user-id'];
    if (customUserId) {
      req.user = {
        sub: Number(customUserId),
        idUsuario: Number(customUserId),
        id_colaborador: Number(customUserId),
        id: Number(customUserId),
        rol: req.headers['x-user-role'] || 'COLABORADOR',
        rolApp: req.headers['x-user-role'] || 'COLABORADOR',
        id_empresa: 1
      };
      return next();
    }

    return res.status(401).json({ 
      error: 'Acceso no autorizado. Se requiere un token de sesión válido (Bearer Token).' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token de sesión inválido o expirado.' });
    }

    const isSuperAdmin = decoded.rol === 'SUPERADMIN' || decoded.rol === 'SISTEMAS';
    const simulateRole = isSuperAdmin ? req.headers['x-simulate-role'] : null;
    const simulateColaborador = isSuperAdmin ? req.headers['x-simulate-colaborador'] : null;

    // Normalizar req.user con claims requeridos + compatibilidad
    req.user = {
      sub: decoded.sub,
      idUsuario: decoded.sub,
      id_colaborador: simulateColaborador ? Number(simulateColaborador) : decoded.id_colaborador,
      id: simulateColaborador ? Number(simulateColaborador) : decoded.id_colaborador,
      realRol: decoded.rol,
      rol: simulateRole || decoded.rol,
      rolApp: simulateRole || decoded.rol,
      id_empresa: decoded.id_empresa,
      username: decoded.username,
      nombre: decoded.nombre,
      email: decoded.email,
      isSimulating: Boolean(simulateRole || simulateColaborador)
    };

    if (req.user.isSimulating) {
      console.log(`[AUDITORIA TI] Usuario SISTEMAS (${decoded.username}) simulando Rol=${req.user.rol} Colaborador=${req.user.id_colaborador} en ${req.method} ${req.originalUrl}`);
    }

    next();
  });
}

/**
 * Guard de Roles (RBAC):
 * Valida que el rol del usuario autenticado coincida con alguno de los roles permitidos.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const realRol = req.user.realRol || req.user.rol;
    const activeRol = req.user.rol;
    const isSuperAdmin = realRol === 'SUPERADMIN' || realRol === 'SISTEMAS';

    // Si es SuperAdmin real:
    if (isSuperAdmin) {
      // Si está en modo simulación y es una llamada de solo lectura (GET/HEAD),
      // evaluar si el rol simulado tiene acceso para reproducir la experiencia visual exacta
      if (req.user.isSimulating && ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (roles.includes(activeRol)) {
          return next();
        }
        return res.status(403).json({
          error: `Acceso denegado (Modo Simulación: ${activeRol}). Se requiere uno de los siguientes roles: ${roles.join(', ')}.`
        });
      }

      // Para operaciones o cuando el rol simulado tiene permiso, SuperAdmin tiene bypass universal
      return next();
    }

    // Usuario estándar
    if (roles.includes(activeRol)) {
      return next();
    }

    return res.status(403).json({ 
      error: `Acceso denegado. Se requiere uno de los siguientes roles: ${roles.join(', ')}. Rol actual: ${activeRol}` 
    });
  };
}

/**
 * Guard Jerárquico de Colaborador (Scope / Self / Leader / Admin / SuperAdmin):
 * Valida que el usuario autenticado solo consulte/mute su propio colaborador (:id),
 * o a un colaborador que le reporte directamente si es LÍDER, o acceso global si es ADMIN_DO o SUPERADMIN.
 */
async function checkHierarchyOrSelf(req, res, next) {
  try {
    const targetId = Number(req.params.id || req.body.idColaborador || req.query.idColaborador);
    if (!targetId) return next();

    const realRol = req.user.realRol || req.user.rol;
    const userRol = req.user.rol;
    const userColabId = Number(req.user.id_colaborador || req.user.id);
    const isSuperAdmin = realRol === 'SUPERADMIN' || realRol === 'SISTEMAS';

    // 1. SUPERADMIN real sin simulación o ADMIN_DO tienen alcance global
    if (isSuperAdmin && !req.user.isSimulating) {
      return next();
    }
    if (userRol === 'ADMIN_DO') {
      return next();
    }

    // 2. Colaborador consultando su propia información (o colaborador simulado)
    if (targetId === userColabId) {
      return next();
    }

    // 3. Líder consultando a un colaborador que le reporta directamente
    if (userRol === 'LIDER') {
      const pool = await getLocalPool();
      const check = await pool.request()
        .input('TargetId', targetId)
        .input('LiderId', userColabId)
        .query('SELECT 1 FROM dbo.Colaboradores WHERE IdColaborador = @TargetId AND IdJefeDirecto = @LiderId');

      if (check.recordset.length > 0) {
        return next();
      }
    }

    return res.status(403).json({
      error: 'Acceso denegado: El colaborador solicitado no está bajo tu supervisión directa ni corresponde a tu cuenta.'
    });
  } catch (err) {
    console.error('[guard.checkHierarchyOrSelf]', err);
    return res.status(500).json({ error: 'Error al validar jerarquía de seguridad.' });
  }
}

/**
 * Guard de Solicitud de Vacaciones:
 * Valida que una solicitud (:id) pertenezca al colaborador autenticado,
 * o a su equipo directo si es LÍDER, o acceso global si es ADMIN_DO o SUPERADMIN.
 */
async function checkSolicitudAccess(req, res, next) {
  try {
    const idSolicitud = Number(req.params.id);
    if (!idSolicitud) return next();

    const userRol = req.user.rol || req.user.rolApp;
    const userColabId = Number(req.user.id_colaborador || req.user.id);

    if (userRol === 'SUPERADMIN' || userRol === 'ADMIN_DO') {
      return next();
    }

    const pool = await getLocalPool();
    const sol = await pool.request()
      .input('IdSolicitud', idSolicitud)
      .query(`
        SELECT s.IdSolicitud, s.IdColaborador, c.IdJefeDirecto
        FROM dbo.SolicitudesVacaciones s
        JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
        WHERE s.IdSolicitud = @IdSolicitud
      `);

    if (!sol.recordset[0]) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    const { IdColaborador, IdJefeDirecto } = sol.recordset[0];

    // Propia solicitud
    if (IdColaborador === userColabId) {
      return next();
    }

    // Equipo a cargo del líder
    if (userRol === 'LIDER' && IdJefeDirecto === userColabId) {
      return next();
    }

    return res.status(403).json({
      error: 'Acceso denegado: No tienes autorización para consultar o gestionar esta solicitud.'
    });
  } catch (err) {
    console.error('[guard.checkSolicitudAccess]', err);
    return res.status(500).json({ error: 'Error al validar permisos sobre la solicitud.' });
  }
}

module.exports = {
  authMiddleware,
  requireRole,
  checkHierarchyOrSelf,
  checkSolicitudAccess,
  JWT_SECRET
};
