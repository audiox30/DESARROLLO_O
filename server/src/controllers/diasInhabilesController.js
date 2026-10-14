const mockStore = require('../data/mockStore');
const { getPool, isUsingMock } = require('../config/database');
const { calcularDetalleDias } = require('../services/diasHabilesService');

const diasInhabilesController = {
  getAll: async (req, res) => {
    try {
      const pool = await getPool();
      if (!pool || isUsingMock()) {
        const sorted = [...mockStore.diasInhabiles].sort((a, b) => (a.fecha || a.Fecha || '').localeCompare(b.fecha || b.Fecha || ''));
        return res.json({ success: true, total: sorted.length, data: sorted });
      }

      const result = await pool.request().query(`
        SELECT CONVERT(VARCHAR(10), Fecha, 120) AS Fecha, Descripcion, EsFeriadoOficial, CAST(1 AS BIT) AS Activo
        FROM dbo.DiasInhabiles
        ORDER BY Fecha ASC
      `);

      if (!result.recordset || result.recordset.length === 0) {
        const sorted = [...mockStore.diasInhabiles].sort((a, b) => (a.fecha || a.Fecha || '').localeCompare(b.fecha || b.Fecha || ''));
        return res.json({ success: true, total: sorted.length, data: sorted });
      }

      return res.json({ success: true, total: result.recordset.length, data: result.recordset });
    } catch (err) {
      console.warn('[diasInhabiles.getAll] Error, usando festivos oficiales LFT:', err.message);
      const sorted = [...mockStore.diasInhabiles].sort((a, b) => (a.fecha || a.Fecha || '').localeCompare(b.fecha || b.Fecha || ''));
      return res.json({ success: true, total: sorted.length, data: sorted });
    }
  },

  create: async (req, res) => {
    try {
      const { fecha, descripcion, esFeriadoOficial = true } = req.body;
      if (!fecha || !descripcion) {
        return res.status(400).json({ error: 'La fecha y la descripción son requeridas.' });
      }

      if (isUsingMock()) {
        const existing = mockStore.diasInhabiles.find(d => d.fecha === fecha);
        if (existing) {
          existing.descripcion = descripcion;
          existing.esFeriadoOficial = Boolean(esFeriadoOficial);
          existing.activo = true;
          return res.json({ success: true, message: 'Día inhábil actualizado con éxito.', data: existing });
        }

        const nuevo = {
          fecha,
          descripcion,
          esFeriadoOficial: Boolean(esFeriadoOficial),
          activo: true
        };
        mockStore.diasInhabiles.push(nuevo);
        return res.status(201).json({ success: true, message: 'Día inhábil agregado correctamente.', data: nuevo });
      } else {
        const pool = await getPool();
        await pool.request()
          .input('Fecha', fecha)
          .input('Descripcion', descripcion)
          .input('EsFeriado', esFeriadoOficial ? 1 : 0)
          .query(`
            MERGE dbo.DiasInhabiles AS Target
            USING (SELECT @Fecha AS Fecha, @Descripcion AS Descripcion, @EsFeriado AS EsFeriadoOficial) AS Source
            ON Target.Fecha = Source.Fecha
            WHEN MATCHED THEN UPDATE SET Descripcion = Source.Descripcion, EsFeriadoOficial = Source.EsFeriadoOficial
            WHEN NOT MATCHED THEN INSERT (Fecha, Descripcion, EsFeriadoOficial) VALUES (Source.Fecha, Source.Descripcion, Source.EsFeriadoOficial);
          `);
        return res.status(201).json({ success: true, message: 'Día inhábil guardado en base de datos.' });
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const { fecha } = req.params;
      if (isUsingMock()) {
        mockStore.diasInhabiles = mockStore.diasInhabiles.filter(d => d.fecha !== fecha);
        return res.json({ success: true, message: 'Día inhábil eliminado correctamente.' });
      } else {
        const pool = await getPool();
        await pool.request().input('Fecha', fecha).query(`DELETE FROM dbo.DiasInhabiles WHERE Fecha = @Fecha`);
        return res.json({ success: true, message: 'Día inhábil eliminado de SQL Server.' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  calcular: async (req, res) => {
    try {
      const { fechaInicio, fechaFin, jornadaLaboralDias = 6, diasDescanso } = req.body;
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Se requiere fechaInicio y fechaFin (formato YYYY-MM-DD)' });
      }

      let map = {};
      let descanso = diasDescanso;
      if (isUsingMock()) {
        map = mockStore.getDiasInhabilesMap();
        if (!descanso && req.user && req.user.id) {
          const colab = mockStore.colaboradores.find(c => c.id === Number(req.user.id));
          descanso = colab?.diasDescanso;
        }
      } else {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT CONVERT(VARCHAR(10), Fecha, 120) AS Fecha, Descripcion, EsFeriadoOficial
          FROM dbo.DiasInhabiles
        `);
        for (const row of result.recordset) {
          map[row.Fecha] = {
            descripcion: row.Descripcion,
            esFeriadoOficial: Boolean(row.EsFeriadoOficial)
          };
        }

        if (!descanso && req.user && req.user.id) {
          const colabRes = await pool.request()
            .input('Id', req.user.id)
            .query('SELECT DiasDescanso FROM dbo.Colaboradores WHERE IdColaborador = @Id');
          descanso = colabRes.recordset[0]?.DiasDescanso;
        }
      }

      const resultado = calcularDetalleDias(fechaInicio, fechaFin, map, Number(jornadaLaboralDias), descanso);

      return res.json({
        success: true,
        diasDescansoAplicado: descanso || 'DOMINGO',
        ...resultado
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = diasInhabilesController;
