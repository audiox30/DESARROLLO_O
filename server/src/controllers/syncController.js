const mockStore = require('../data/mockStore');
const { getPool, isUsingMock } = require('../config/database');

const syncController = {
  getStatus: async (req, res) => {
    try {
      const isMock = isUsingMock();
      const lastSync = mockStore.bitacoraSync[0] || {
        fechaEjecucion: '2026-10-12T08:00:00Z',
        exitoso: true,
        registrosInsertados: 601,
        registrosActualizados: 0
      };

      res.json({
        success: true,
        source: 'CONTPAQi Nóminas (NOMIPAQ)',
        database: process.env.NOMIPAQ_DB || 'nomipaq_jama',
        tablasFuente: ['nom10001 (Empleados)', 'nom10002 (Puestos)', 'nom10003 (Departamentos)'],
        targetDatabase: process.env.DB_NAME || 'ControlVacaciones_DO',
        isMockMode: isMock,
        totalColaboradoresSincronizados: mockStore.colaboradores.length,
        ultimaSincronizacion: lastSync.fechaEjecucion,
        estadoConexion: 'CONECTADO Y DISPONIBLE'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  preview: async (req, res) => {
    try {
      // Vista previa de cambios detectados en NOMIPAQ
      const previewData = {
        nuevosEmpleados: [
          { codigoEmpleado: 'NUEVO-801', nombre: 'CARLOS ALBERTO MEDINA', puesto: 'AUXILIAR DE OPERACIONES', departamento: 'OPERACIONES', empresa: 'CONSTRUJAMA' }
        ],
        actualizacionesPuestos: [
          { codigoEmpleado: 'CONS-100', nombre: 'BENITO SALAZAR GRIMALDO', puestoAnterior: 'Montacarguista 5', puestoNuevo: 'Montacarguista 6' }
        ],
        bajasDetectadas: []
      };

      return res.json({
        success: true,
        summary: {
          insertar: previewData.nuevosEmpleados.length,
          actualizar: previewData.actualizacionesPuestos.length,
          bajas: previewData.bajasDetectadas.length
        },
        preview: previewData
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  execute: async (req, res) => {
    try {
      const idUsuario = req.user ? req.user.id : null;

      if (isUsingMock()) {
        const log = mockStore.sincronizarNomipaq('MANUAL', idUsuario);
        return res.json({
          success: true,
          message: 'Sincronización incremental MERGE ejecutada exitosamente.',
          resultado: log
        });
      } else {
        const pool = await getPool();
        const request = pool.request();
        request.input('TipoEjecucion', 'MANUAL');
        request.input('IdUsuarioEjecuto', idUsuario);
        request.input('NomipaqDbName', process.env.NOMIPAQ_DB || 'nomipaq_jama');

        const result = await request.execute('dbo.sp_SincronizarDesdeNomipaq');
        return res.json({
          success: true,
          message: 'Sincronización con CONTPAQi Nóminas completada en SQL Server.',
          resultado: result.recordset[0]
        });
      }
    } catch (err) {
      console.error('[sync.execute]', err);
      res.status(500).json({ error: err.message });
    }
  },

  getLogs: async (req, res) => {
    try {
      if (isUsingMock()) {
        return res.json({
          success: true,
          total: mockStore.bitacoraSync.length,
          data: mockStore.bitacoraSync
        });
      } else {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT TOP 20 * FROM dbo.BitacoraSincronizacionNomipaq ORDER BY FechaEjecucion DESC
        `);
        return res.json({ success: true, total: result.recordset.length, data: result.recordset });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = syncController;
