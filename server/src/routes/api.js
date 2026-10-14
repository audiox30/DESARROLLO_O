const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const colaboradoresController = require('../controllers/colaboradoresController');
const liderController = require('../controllers/liderController');
const solicitudesController = require('../controllers/solicitudesController');
const aprobacionesController = require('../controllers/aprobacionesController');
const diasInhabilesController = require('../controllers/diasInhabilesController');
const saldosController = require('../controllers/saldosController');
const syncController = require('../controllers/syncController');
const sistemasController = require('../controllers/sistemasController');
const adminColaboradoresController = require('../controllers/adminColaboradoresController');
const reportesController = require('../controllers/reportesController');

const { 
  authMiddleware, 
  requireRole, 
  checkHierarchyOrSelf, 
  checkSolicitudAccess 
} = require('../middleware/authMiddleware');

// =========================================================================
// 1. MÓDULO DE AUTENTICACIÓN (JWT) & CONTROL DE ACCESO
// =========================================================================
router.post('/auth/login', authController.login);
router.post('/auth/cambiar-password', authMiddleware, authController.cambiarPassword);
router.get('/auth/me', authMiddleware, authController.getCurrentUser);
router.get('/auth/personas', authController.getDemoPersonas);
// =========================================================================
// 1.1 CATÁLOGO DE EMPRESAS NOMIPAQ (GRUPO JAMA)
// =========================================================================
router.get('/empresas', authMiddleware, async (req, res) => {
  try {
    const { getLocalPool, isUsingMock } = require('../config/database');
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      const mockStore = require('../data/mockStore');
      const list = mockStore.empresasNomipaq || mockStore.empresas || [];
      return res.json({
        success: true,
        total: list.length,
        data: list.map(e => ({
          id: e.idEmpresa || e.id,
          idEmpresa: e.idEmpresa || e.id,
          alias: e.aliasEmpresa || e.alias,
          aliasEmpresa: e.aliasEmpresa || e.alias,
          nombreBaseDatos: e.nombreBaseDatos,
          activa: true
        }))
      });
    }

    const result = await pool.request().query(`
      SELECT IdEmpresa, NombreBaseDatos, AliasEmpresa, Activa
      FROM dbo.EmpresasNomipaq
      ORDER BY IdEmpresa ASC;
    `);

    return res.json({
      success: true,
      total: result.recordset.length,
      data: result.recordset.map(e => ({
        id: e.IdEmpresa,
        idEmpresa: e.IdEmpresa,
        alias: e.AliasEmpresa,
        aliasEmpresa: e.AliasEmpresa,
        nombreBaseDatos: e.NombreBaseDatos,
        activa: Boolean(e.Activa)
      }))
    });
  } catch (err) {
    console.error('[empresas.getAll]', err);
    res.status(500).json({ error: 'Error al consultar catálogo de empresas.' });
  }
});

// =========================================================================
// 2. MÓDULO DE COLABORADORES Y PERFILES
// =========================================================================
router.get('/colaboradores', authMiddleware, colaboradoresController.getAll);
router.get('/colaboradores/saldo', authMiddleware, colaboradoresController.getMiSaldo);
router.get('/colaboradores/equipo', authMiddleware, requireRole('LIDER', 'ADMIN_DO'), colaboradoresController.getEquipoLider);
router.get('/colaboradores/:id', authMiddleware, checkHierarchyOrSelf, colaboradoresController.getById);
router.put('/colaboradores/:id', authMiddleware, checkHierarchyOrSelf, colaboradoresController.update);
router.get('/colaboradores/:id/hijos', authMiddleware, checkHierarchyOrSelf, colaboradoresController.getHijos);
router.post('/colaboradores/:id/hijos', authMiddleware, checkHierarchyOrSelf, colaboradoresController.agregarHijo);
router.delete('/colaboradores/:id/hijos/:idHijo', authMiddleware, checkHierarchyOrSelf, colaboradoresController.eliminarHijo);
router.post('/colaboradores/:id/financieros', authMiddleware, requireRole('ADMIN_DO'), colaboradoresController.guardarDatosFinancieros);
router.post('/colaboradores/:id/bajas', authMiddleware, requireRole('ADMIN_DO'), colaboradoresController.registrarBaja);

// =========================================================================
// 3. MÓDULO DE LÍDER (RBAC: LIDER / ADMIN_DO / SISTEMAS)
// =========================================================================
router.get('/lider/solicitudes-pendientes', authMiddleware, requireRole('LIDER', 'ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), liderController.getSolicitudesPendientes);
router.post('/lider/solicitud/:id/resolver', authMiddleware, requireRole('LIDER', 'ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), liderController.resolverSolicitud);
router.get('/lider/mi-equipo', authMiddleware, requireRole('LIDER', 'ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), liderController.getMiEquipo);
router.get('/lider/colaborador/:id/solicitudes', authMiddleware, requireRole('LIDER', 'ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), liderController.getSolicitudesColaborador);

// =========================================================================
// 4. MÓDULO DE SOLICITUDES DE VACACIONES (COLABORADOR / LÍDER / ADMIN_DO)
// =========================================================================
router.post('/solicitudes', authMiddleware, solicitudesController.create);
router.get('/solicitudes/mis', authMiddleware, solicitudesController.getMisSolicitudes);
router.get('/solicitudes/mis-solicitudes', authMiddleware, solicitudesController.getMisSolicitudes);
router.get('/solicitudes/colaborador/:id', authMiddleware, checkHierarchyOrSelf, solicitudesController.getByColaborador);
router.get('/solicitudes/bandeja-lider', authMiddleware, requireRole('LIDER', 'ADMIN_DO'), liderController.getSolicitudesPendientes);
router.get('/solicitudes/bandeja-do', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), solicitudesController.getBandejaDO);
router.get('/solicitudes/:id', authMiddleware, checkSolicitudAccess, solicitudesController.getById);
router.get('/solicitudes/:id/pdf', authMiddleware, solicitudesController.descargarPdfFdo84);
router.post('/solicitudes/:id/cancelar', authMiddleware, checkSolicitudAccess, solicitudesController.cancelar);

// =========================================================================
// 5. MÓDULO DE APROBACIONES GLOBALES (LÍDER / ADMIN_DO)
// =========================================================================
router.post('/aprobaciones/:id/aprobar', authMiddleware, requireRole('LIDER', 'ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), aprobacionesController.aprobar);
router.post('/aprobaciones/:id/rechazar', authMiddleware, requireRole('LIDER', 'ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), aprobacionesController.rechazar);
router.post('/aprobaciones/simular-teams', authMiddleware, aprobacionesController.simularNotificacionTeams);

// =========================================================================
// 6. MÓDULO DE SALDOS Y KÁRDEX LFT
// =========================================================================
router.get('/saldos/kardex-global', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), saldosController.getKardexGlobal);
router.get('/saldos/colaborador/:id', authMiddleware, checkHierarchyOrSelf, saldosController.getKardexColaborador);

// =========================================================================
// 7. MÓDULO DE DÍAS INHÁBILES Y CALENDARIO OFICIAL
// =========================================================================
router.get('/dias-inhabiles', authMiddleware, diasInhabilesController.getAll);
router.post('/dias-inhabiles', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), diasInhabilesController.create);
router.delete('/dias-inhabiles/:fecha', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), diasInhabilesController.delete);
router.post('/dias-inhabiles/calcular', authMiddleware, diasInhabilesController.calcular);

// =========================================================================
// 8. MÓDULO DE SINCRONIZACIÓN CONTPAQi NÓMINAS (ADMIN_DO)
// =========================================================================
router.post('/admin/sincronizar-empleados', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), syncController.sincronizarEmpleados);
router.get('/admin/sincronizar-empleados/status/:taskId', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), syncController.getTaskStatus);
router.get('/sync-nomipaq/status', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), syncController.getStatus);
router.get('/sync-nomipaq/logs', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), syncController.getLogs);

// =========================================================================
// 9. MÓDULO DE SISTEMAS / TI (SUPERADMIN / SISTEMAS)
// =========================================================================
router.get('/sistemas/usuarios', authMiddleware, requireRole('SUPERADMIN', 'SISTEMAS'), sistemasController.getUsuarios);
router.post('/sistemas/usuarios/:id/toggle-activo', authMiddleware, requireRole('SUPERADMIN', 'SISTEMAS'), sistemasController.toggleActivo);
router.post('/sistemas/usuarios/:id/reset-password', authMiddleware, requireRole('SUPERADMIN', 'SISTEMAS'), sistemasController.resetPassword);
router.get('/sistemas/auditoria', authMiddleware, requireRole('SUPERADMIN', 'SISTEMAS'), sistemasController.getAuditoria);
router.get('/sistemas/diagnostico', authMiddleware, requireRole('SUPERADMIN', 'SISTEMAS'), sistemasController.getDiagnostico);

// =========================================================================
// 10. MÓDULO ADMINISTRATIVO DE COLABORADORES & ROLES (ADMIN_DO, SISTEMAS)
// =========================================================================
router.get('/admin/colaboradores', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), adminColaboradoresController.getColaboradoresAdmin);
router.put('/admin/colaboradores/:id', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), adminColaboradoresController.updateComplementarios);
router.post('/admin/colaboradores/:id/reset-password', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), adminColaboradoresController.resetPasswordAdmin);

router.get('/admin/roles/administradores-do', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), adminColaboradoresController.getAdministradoresDO);
router.post('/admin/roles/asignar-admin-do', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), adminColaboradoresController.asignarAdminDO);
router.post('/admin/roles/revocar-admin-do', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), adminColaboradoresController.revocarAdminDO);

// =========================================================================
// 11. MÓDULO DE REPORTES Y ANALÍTICA (ADMIN_DO, SISTEMAS, LIDER)
// =========================================================================
router.get('/reportes/padron', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), reportesController.getPadron);
router.get('/reportes/saldos', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS'), reportesController.getSaldos);
router.get('/reportes/calendario-ausencias', authMiddleware, requireRole('ADMIN_DO', 'SUPERADMIN', 'SISTEMAS', 'LIDER'), reportesController.getCalendarioAusencias);

module.exports = router;
