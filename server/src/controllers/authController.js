const mockStore = require('../data/mockStore');
const { getPool, isUsingMock } = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jama_secret_vacaciones_do_2026';

// Personas demo representativas de la estructura organizativa de Grupo JAMA
const PERSONAS_DEMO = [
  {
    codigoEmpleado: 'CONS-100',
    rol: 'COLABORADOR',
    titulo: 'Colaborador (Solicitante)',
    descripcion: 'Benito Salazar - Montacarguista 6 (Sucursal San Luis, Construjama)'
  },
  {
    codigoEmpleado: 'CONS-103',
    rol: 'LIDER',
    titulo: 'Líder / Gerente (Aprobador)',
    descripcion: 'Mary Araiza - Gerente de Sucursal Guadalajara (Equipo a cargo directo)'
  },
  {
    codigoEmpleado: 'DO-010',
    rol: 'ADMIN_DO',
    titulo: 'Desarrollo Organizacional (Admin)',
    descripcion: 'Tania Ramírez - Especialista DO (Control Global, Sincronización y VoBo)'
  }
];

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user.IdColaborador,
      codigoEmpleado: user.codigoEmpleado || user.CodigoEmpleado,
      nombreCompleto: user.nombreCompleto || user.NombreCompleto,
      rolApp: user.rolApp || user.RolApp,
      email: user.email || user.Email
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

const authController = {
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

  switchUser: async (req, res) => {
    try {
      const { codigoEmpleado, id } = req.body;
      let user = null;

      if (isUsingMock()) {
        if (id) {
          user = mockStore.colaboradores.find(c => c.id === Number(id));
        } else if (codigoEmpleado) {
          user = mockStore.colaboradores.find(c => c.codigoEmpleado === codigoEmpleado);
        }
        
        // Si no existe, crear o devolver default
        if (!user && codigoEmpleado === 'DO-010') {
          user = {
            id: 9999,
            codigoEmpleado: 'DO-010',
            nombre: 'TANIA',
            apellidoPaterno: 'RAMIREZ',
            apellidoMaterno: 'MEDINA',
            nombreCompleto: 'TANIA RAMIREZ MEDINA',
            puesto: 'ESPECIALISTA DE DESARROLLO ORGANIZACIONAL',
            departamento: 'DESARROLLO ORGANIZACIONAL',
            empresa: 'CONTROLADORA JAMA, S.C.',
            sucursal: 'CONTROLADORA',
            email: 'tania.do@grupojama.com',
            rolApp: 'ADMIN_DO',
            diasDisponibles: 18,
            diasCorrespondientes: 22,
            diasGozados: 4,
            antiguedadAnios: 9,
            jornadaLaboralDias: 5,
            activo: true
          };
        }
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('Codigo', codigoEmpleado || '')
          .input('Id', id || 0)
          .query(`
            SELECT TOP 1 
              IdColaborador AS id, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
              NombreCompleto, CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
              IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, JornadaLaboralDias, Activo
            FROM dbo.Colaboradores
            WHERE (CodigoEmpleado = @Codigo OR IdColaborador = @Id) AND Activo = 1
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
  },

  getCurrentUser: async (req, res) => {
    try {
      const user = req.user;
      res.json({ success: true, user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = authController;
