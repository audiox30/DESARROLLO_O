const nomipaqSyncService = require('../services/nomipaqSyncService');
const mockStore = require('../data/mockStore');
const { getLocalPool, isUsingMock } = require('../config/database');

const syncController = {
  /**
   * Endpoint requerido: POST /api/admin/sincronizar-empleados
   * Ejecuta la rutina multi-empresa desacoplada como tarea en segundo plano (BackgroundTasks)
   */
  sincronizarEmpleados: async (req, res) => {
    try {
      const idUsuario = req.user ? req.user.id : null;

      // Iniciar tarea en segundo plano
      const task = nomipaqSyncService.iniciarSincronizacionSegundoPlano(idUsuario);

      // Responder de inmediato (HTTP 202 Accepted)
      return res.status(202).json({
        success: true,
        message: 'Sincronización multi-empresa iniciada en segundo plano.',
        taskId: task.taskId,
        estado: task.estado,
        totalBases: task.totalBases,
        basesProgramadas: [
          'ctCEMENTOS_MOCTEZ',
          'ctCONSTRUJAMA_DE_',
          'ctCONTROLADORA_JA',
          'ctDISTRIBUIDOR_DE',
          'ctDISTRIBUIDORA_J',
          'ctIMPULSORA_DE_NE',
          'ctLATINO_CONCRETO',
          'ctTRAMO_DEL_CENTR'
        ],
        statusEndpoint: `/api/admin/sincronizar-empleados/status/${task.taskId}`
      });
    } catch (err) {
      console.error('[syncController.sincronizarEmpleados]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Consulta del estado de la tarea en segundo plano
   */
  getTaskStatus: async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = nomipaqSyncService.obtenerEstadoTarea(taskId);

      if (!task) {
        return res.status(404).json({ error: 'Tarea no encontrada o ya finalizada y archivada.' });
      }

      return res.json({
        success: true,
        task
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Estado general del enlace multi-empresa
   */
  getStatus: async (req, res) => {
    try {
      const poolLocal = await getLocalPool();
      let empresas = [];

      if (poolLocal && !isUsingMock()) {
        const empRes = await poolLocal.request().query(`
          SELECT IdEmpresa, NombreBaseDatos, AliasEmpresa, Activa
          FROM dbo.EmpresasNomipaq ORDER BY IdEmpresa
        `);
        empresas = empRes.recordset;
      } else {
        empresas = mockStore.empresasNomipaq;
      }

      const lastSync = mockStore.bitacoraSync[0] || {
        fechaEjecucion: new Date().toISOString(),
        exitoso: true,
        registrosInsertados: 601,
        registrosActualizados: 0
      };

      res.json({
        success: true,
        baseDatosLocal: 'DESARROLLO_O',
        totalEmpresas: empresas.length,
        empresas,
        isMockMode: isUsingMock(),
        ultimaSincronizacion: lastSync.fechaEjecucion,
        estadoEnlace: 'CONFIGURADO - MULTI-EMPRESA'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Bitácora de auditoría de sincronizaciones
   */
  getLogs: async (req, res) => {
    try {
      const poolLocal = await getLocalPool();

      if (poolLocal && !isUsingMock()) {
        const result = await poolLocal.request().query(`
          SELECT TOP 50 
            IdSync, FechaEjecucion, TipoEjecucion, IdEmpresa, NombreBaseDatos,
            IdUsuarioEjecuto, RegistrosInsertados, RegistrosActualizados,
            RegistrosDesactivados, DetalleLog, Exitoso
          FROM dbo.BitacoraSincronizacionNomipaq 
          ORDER BY FechaEjecucion DESC
        `);
        const rows = (result.recordset || []).map(r => ({
          ...r,
          idSync: r.IdSync,
          fechaEjecucion: r.FechaEjecucion,
          tipoEjecucion: r.TipoEjecucion,
          idEmpresa: r.IdEmpresa,
          nombreBaseDatos: r.NombreBaseDatos,
          idUsuarioEjecuto: r.IdUsuarioEjecuto,
          registrosInsertados: r.RegistrosInsertados ?? 0,
          registrosActualizados: r.RegistrosActualizados ?? 0,
          registrosDesactivados: r.RegistrosDesactivados ?? 0,
          detalleLog: r.DetalleLog || '',
          exitoso: r.Exitoso
        }));
        return res.json({ success: true, total: rows.length, data: rows });
      } else {
        return res.json({
          success: true,
          total: mockStore.bitacoraSync.length,
          data: mockStore.bitacoraSync
        });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = syncController;
