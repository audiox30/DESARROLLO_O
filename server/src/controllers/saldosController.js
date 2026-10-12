const mockStore = require('../data/mockStore');
const { getLocalPool, isUsingMock } = require('../config/database');
const { generarPeriodosVacaciones } = require('../services/lftVacacionesService');

const saldosController = {
  /**
   * GET /api/saldos/kardex-global
   * Kárdex global de saldos LFT de todos los colaboradores (exclusivo ADMIN_DO)
   */
  getKardexGlobal: async (req, res) => {
    try {
      const { empresa, empresa_id, empresaId, departamento, format } = req.query;

      if (isUsingMock()) {
        let list = mockStore.colaboradores.map(c => ({
          idColaborador: c.id,
          codigoEmpleado: c.codigoEmpleado,
          nombreCompleto: c.nombreCompleto,
          empresa: c.empresa,
          idEmpresa: c.idEmpresa,
          sucursal: c.sucursal,
          departamento: c.departamento,
          puesto: c.puesto,
          fechaAlta: c.fechaAlta,
          antiguedadAnios: c.antiguedadAnios,
          diasCorrespondientes: c.diasCorrespondientes,
          diasGozados: c.diasGozados,
          diasDisponibles: c.diasDisponibles
        }));

        if (empresa_id || empresa) {
          const target = String(empresa_id || empresa).toLowerCase();
          list = list.filter(item => String(item.idEmpresa) === target || (item.empresa && item.empresa.toLowerCase().includes(target)));
        }
        if (departamento) list = list.filter(item => item.departamento === departamento);

        if (format === 'csv') {
          const headers = 'Código,Nombre,Empresa,Sucursal,Departamento,Puesto,Fecha Alta,Antigüedad (Años),Días LFT,Días Gozados,Días Disponibles\n';
          const rows = list.map(c => 
            `"${c.codigoEmpleado}","${c.nombreCompleto}","${c.empresa}","${c.sucursal}","${c.departamento}","${c.puesto}","${c.fechaAlta}",${c.antiguedadAnios},${c.diasCorrespondientes},${c.diasGozados},${c.diasDisponibles}`
          ).join('\n');

          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="KARDEX_VACACIONES_GRUPO_JAMA.csv"');
          return res.send('\uFEFF' + headers + rows);
        }

        return res.json({ success: true, total: list.length, data: list });
      }

      const pool = await getLocalPool();
      const request = pool.request();
      let whereClauses = ['c.Activo = 1'];

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

      if (departamento) {
        request.input('Depto', `%${departamento}%`);
        whereClauses.push('d.Nombre LIKE @Depto');
      }

      const queryStr = `
        SELECT 
          c.IdColaborador AS idColaborador,
          c.CodigoEmpleado AS codigoEmpleado,
          c.Subfijo AS subfijo,
          c.NombreCompleto AS nombreCompleto,
          c.Empresa AS empresa,
          c.Sucursal AS sucursal,
          e.AliasEmpresa AS empresaAlias,
          d.Nombre AS departamento,
          p.Nombre AS puesto,
          CONVERT(VARCHAR(10), c.FechaAlta, 120) AS fechaAlta,
          ISNULL(DATEDIFF(YEAR, c.FechaAlta, GETDATE()), 0) AS antiguedadAnios,
          ISNULL(sal.TotalCorrespondientes, 0) AS diasCorrespondientes,
          ISNULL(sal.TotalGozados, 0) AS diasGozados,
          ISNULL(sal.TotalPendientes, 0) AS diasDisponibles
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        OUTER APPLY (
          SELECT 
            SUM(DiasCorrespondientes) AS TotalCorrespondientes,
            SUM(DiasGozados) AS TotalGozados,
            SUM(DiasPendientes) AS TotalPendientes
          FROM dbo.SaldosVacaciones sv
          WHERE sv.IdColaborador = c.IdColaborador AND sv.EsCerrado = 0
        ) sal
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY c.Empresa, c.NombreCompleto;
      `;

      const result = await request.query(queryStr);
      const list = result.recordset;

      if (format === 'csv') {
        const headers = 'Código,Nombre,Empresa,Sucursal,Departamento,Puesto,Fecha Alta,Antigüedad (Años),Días LFT,Días Gozados,Días Disponibles\n';
        const rows = list.map(c => 
          `"${c.codigoEmpleado}","${c.nombreCompleto}","${c.empresa}","${c.sucursal || ''}","${c.departamento || ''}","${c.puesto || ''}","${c.fechaAlta}",${c.antiguedadAnios},${c.diasCorrespondientes},${c.diasGozados},${c.diasDisponibles}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="KARDEX_VACACIONES_GRUPO_JAMA.csv"');
        return res.send('\uFEFF' + headers + rows);
      }

      return res.json({
        success: true,
        total: list.length,
        data: list
      });
    } catch (err) {
      console.error('[saldos.getKardexGlobal]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/saldos/colaborador/:id
   * Kárdex individual con desglose por período LFT
   */
  getKardexColaborador: async (req, res) => {
    try {
      const { id } = req.params;

      if (isUsingMock()) {
        const colab = mockStore.colaboradores.find(c => c.id === Number(id));
        if (!colab) return res.status(404).json({ error: 'Colaborador no encontrado' });

        const periodos = colab.saldos || generarPeriodosVacaciones(colab.fechaAlta, colab.diasGozados);
        return res.json({
          success: true,
          colaborador: colab,
          periodos
        });
      }

      const pool = await getLocalPool();

      // 1. Obtener datos del colaborador
      const colabRes = await pool.request()
        .input('Id', Number(id))
        .query(`
          SELECT 
            c.IdColaborador AS id, c.IdColaborador, c.CodigoEmpleado, c.Subfijo,
            c.NombreCompleto, c.Empresa, c.Sucursal, c.FechaAlta, c.FechaAltaImss,
            c.EstatusNomina, c.RolApp, c.Activo,
            p.Nombre AS Puesto, d.Nombre AS Departamento,
            j.NombreCompleto AS JefeDirectoNombre
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
          WHERE c.IdColaborador = @Id
        `);

      const colab = colabRes.recordset[0];
      if (!colab) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      // 2. Obtener períodos de saldo de vacaciones
      const saldosRes = await pool.request()
        .input('Id', Number(id))
        .query(`
          SELECT 
            IdSaldo, AnioPeriodo, AntiguedadCumplida,
            DiasCorrespondientes, DiasGozados, DiasPendientes,
            CONVERT(VARCHAR(10), FechaExpiracionPeriodo, 120) AS FechaExpiracionPeriodo,
            EsCerrado
          FROM dbo.SaldosVacaciones
          WHERE IdColaborador = @Id
          ORDER BY AnioPeriodo ASC
        `);

      return res.json({
        success: true,
        colaborador: {
          ...colab,
          id: colab.IdColaborador,
          idColaborador: colab.IdColaborador,
          codigoEmpleado: colab.CodigoEmpleado,
          nombreCompleto: colab.NombreCompleto,
          empresa: colab.Empresa,
          sucursal: colab.Sucursal,
          fechaAlta: colab.FechaAlta ? new Date(colab.FechaAlta).toISOString().split('T')[0] : '—',
          puesto: colab.Puesto,
          departamento: colab.Departamento
        },
        periodos: saldosRes.recordset.map(s => ({
          ...s,
          idSaldo: s.IdSaldo,
          anioPeriodo: s.AnioPeriodo,
          antiguedadCumplida: s.AntiguedadCumplida,
          diasCorrespondientes: s.DiasCorrespondientes,
          diasGozados: s.DiasGozados,
          diasPendientes: s.DiasPendientes,
          fechaExpiracionPeriodo: s.FechaExpiracionPeriodo,
          esCerrado: Boolean(s.EsCerrado)
        }))
      });
    } catch (err) {
      console.error('[saldos.getKardexColaborador]', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = saldosController;
