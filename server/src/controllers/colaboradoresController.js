const mockStore = require('../data/mockStore');
const { getPool, isUsingMock } = require('../config/database');
const { generarPeriodosVacaciones } = require('../services/lftVacacionesService');

const colaboradoresController = {
  getAll: async (req, res) => {
    try {
      const { search, departamento, empresa, rolApp, limit = 50, page = 1 } = req.query;

      if (isUsingMock()) {
        let list = [...mockStore.colaboradores];

        if (search) {
          const s = search.toLowerCase();
          list = list.filter(c => 
            c.nombreCompleto.toLowerCase().includes(s) || 
            c.codigoEmpleado.toLowerCase().includes(s) ||
            (c.curp && c.curp.toLowerCase().includes(s))
          );
        }

        if (departamento) {
          list = list.filter(c => c.departamento === departamento);
        }

        if (empresa) {
          list = list.filter(c => c.empresa === empresa);
        }

        if (rolApp) {
          list = list.filter(c => c.rolApp === rolApp);
        }

        const total = list.length;
        const startIndex = (page - 1) * limit;
        const paginated = list.slice(startIndex, startIndex + Number(limit));

        return res.json({
          success: true,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / limit),
          data: paginated
        });
      } else {
        const pool = await getPool();
        const request = pool.request();
        let whereClauses = ['Activo = 1'];

        if (search) {
          request.input('Search', `%${search}%`);
          whereClauses.push('(NombreCompleto LIKE @Search OR CodigoEmpleado LIKE @Search OR CURP LIKE @Search)');
        }

        const query = `
          SELECT 
            IdColaborador AS id, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
            NombreCompleto, CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
            EstatusNomina, RolApp, JornadaLaboralDias, Activo
          FROM dbo.Colaboradores
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY ApellidoPaterno, Nombre
        `;
        const result = await request.query(query);
        return res.json({
          success: true,
          total: result.recordset.length,
          data: result.recordset
        });
      }
    } catch (err) {
      console.error('[colaboradores.getAll]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      if (isUsingMock()) {
        const colab = mockStore.colaboradores.find(c => c.id === Number(id));
        if (!colab) return res.status(404).json({ error: 'Colaborador no encontrado' });
        return res.json({ success: true, data: colab });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('Id', id)
          .query(`
            SELECT c.*, d.Nombre AS DepartamentoNombre, p.Nombre AS PuestoNombre,
                   j.NombreCompleto AS JefeDirectoNombre
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
            WHERE c.IdColaborador = @Id
          `);
        if (!result.recordset[0]) return res.status(404).json({ error: 'Colaborador no encontrado' });
        return res.json({ success: true, data: result.recordset[0] });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getMiSaldo: async (req, res) => {
    try {
      const idColaborador = req.user.id;

      if (isUsingMock()) {
        const colab = mockStore.colaboradores.find(c => c.id === Number(idColaborador)) || mockStore.colaboradores[0];
        
        // Calcular solicitudes en trámite
        const enTramite = mockStore.solicitudes
          .filter(s => s.idColaborador === colab.id && ['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(s.estado))
          .reduce((sum, s) => sum + s.totalDiasLaborables, 0);

        const periodos = colab.saldos || generarPeriodosVacaciones(colab.fechaAlta, colab.diasGozados);

        return res.json({
          success: true,
          colaborador: {
            id: colab.id,
            nombreCompleto: colab.nombreCompleto,
            codigoEmpleado: colab.codigoEmpleado,
            puesto: colab.puesto,
            departamento: colab.departamento,
            empresa: colab.empresa,
            fechaAlta: colab.fechaAlta,
            antiguedadAnios: colab.antiguedadAnios
          },
          resumen: {
            diasCorrespondientes: colab.diasCorrespondientes,
            diasGozados: colab.diasGozados,
            diasEnTramite: enTramite,
            diasDisponibles: Math.max(0, colab.diasDisponibles - enTramite)
          },
          periodos
        });
      } else {
        const pool = await getPool();
        const colabRes = await pool.request()
          .input('Id', idColaborador)
          .query(`
            SELECT IdColaborador AS id, CodigoEmpleado, NombreCompleto, FechaAlta,
                   DATEDIFF(YEAR, FechaAlta, GETDATE()) AS AntiguedadAnios
            FROM dbo.Colaboradores WHERE IdColaborador = @Id
          `);
        
        const saldosRes = await pool.request()
          .input('Id', idColaborador)
          .query(`
            SELECT * FROM dbo.SaldosVacaciones 
            WHERE IdColaborador = @Id 
            ORDER BY AnioPeriodo DESC
          `);

        return res.json({
          success: true,
          colaborador: colabRes.recordset[0],
          periodos: saldosRes.recordset
        });
      }
    } catch (err) {
      console.error('[colaboradores.getMiSaldo]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getEquipoLider: async (req, res) => {
    try {
      const idLider = req.user.id;

      if (isUsingMock()) {
        let equipo = mockStore.colaboradores.filter(c => c.idJefeDirecto === Number(idLider));
        
        // Si el usuario actual es líder pero la asignación estricta devolvió vacío,
        // mostrar un subconjunto de colaboradores de su empresa/departamento para propósitos de prueba
        if (equipo.length === 0 && (req.user.rolApp === 'LIDER' || req.user.rolApp === 'ADMIN_DO')) {
          equipo = mockStore.colaboradores.slice(0, 8);
        }

        return res.json({
          success: true,
          total: equipo.length,
          data: equipo
        });
      } else {
        const pool = await getPool();
        const result = await pool.request()
          .input('IdLider', idLider)
          .query(`
            SELECT 
              c.IdColaborador AS id, c.CodigoEmpleado, c.NombreCompleto,
              p.Nombre AS Puesto, d.Nombre AS Departamento, c.FechaAlta, c.Email
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            WHERE c.IdJefeDirecto = @IdLider AND c.Activo = 1
          `);
        return res.json({ success: true, total: result.recordset.length, data: result.recordset });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = colaboradoresController;
