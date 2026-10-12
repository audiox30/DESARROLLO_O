const jwt = require('jsonwebtoken');
const mockStore = require('../data/mockStore');

const JWT_SECRET = process.env.JWT_SECRET || 'jama_secret_vacaciones_do_2026';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Si no hay token, usar usuario por defecto para facilitar pruebas si se pasa un header x-user-id
    const customUserId = req.headers['x-user-id'];
    if (customUserId) {
      const user = mockStore.colaboradores.find(c => c.id === Number(customUserId));
      if (user) {
        req.user = user;
        return next();
      }
    }

    // Default: primer colaborador
    req.user = mockStore.colaboradores[0] || {
      id: 1,
      codigoEmpleado: 'CONS-100',
      nombreCompleto: 'BENITO SALAZAR GRIMALDO',
      rolApp: 'COLABORADOR'
    };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = decoded;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rolApp)) {
      return res.status(403).json({ 
        error: `Acceso denegado. Se requiere uno de los siguientes roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole
};
