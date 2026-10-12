const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const colaboradoresController = require('../controllers/colaboradoresController');
const solicitudesController = require('../controllers/solicitudesController');
const aprobacionesController = require('../controllers/aprobacionesController');
const diasInhabilesController = require('../controllers/diasInhabilesController');
const saldosController = require('../controllers/saldosController');
const syncController = require('../controllers/syncController');

const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// 1. Módulo de Autenticación y Demostración Rápida
router.get('/auth/personas', authController.getDemoPersonas);
router.post('/auth/switch', authController.switchUser);
router.get('/auth/me', authMiddleware, authController.getCurrentUser);

// 2. Módulo de Colaboradores y Jerarquía
router.get('/colaboradores', authMiddleware, colaboradoresController.getAll);
router.get('/colaboradores/saldo', authMiddleware, colaboradoresController.getMiSaldo);
router.get('/colaboradores/equipo', authMiddleware, colaboradoresController.getEquipoLider);
router.get('/colaboradores/:id', authMiddleware, colaboradoresController.getById);

// 3. Módulo de Solicitudes de Vacaciones
router.post('/solicitudes', authMiddleware, solicitudesController.create);
router.get('/solicitudes/mis', authMiddleware, solicitudesController.getMisSolicitudes);
router.get('/solicitudes/bandeja-lider', authMiddleware, solicitudesController.getBandejaLider);
router.get('/solicitudes/bandeja-do', authMiddleware, solicitudesController.getBandejaDO);
router.get('/solicitudes/:id', authMiddleware, solicitudesController.getById);
router.post('/solicitudes/:id/cancelar', authMiddleware, solicitudesController.cancelar);

// 4. Módulo de Aprobaciones y Resoluciones
router.post('/aprobaciones/:id/aprobar', authMiddleware, aprobacionesController.aprobar);
router.post('/aprobaciones/:id/rechazar', authMiddleware, aprobacionesController.rechazar);
router.post('/aprobaciones/simular-teams', authMiddleware, aprobacionesController.simularNotificacionTeams);

// 5. Módulo de Días Inhábiles y Calendario LFT
router.get('/dias-inhabiles', authMiddleware, diasInhabilesController.getAll);
router.post('/dias-inhabiles', authMiddleware, diasInhabilesController.create);
router.delete('/dias-inhabiles/:fecha', authMiddleware, diasInhabilesController.delete);
router.post('/dias-inhabiles/calcular', authMiddleware, diasInhabilesController.calcular);

// 6. Módulo de Saldos y Kardex General
router.get('/saldos/kardex-global', authMiddleware, saldosController.getKardexGlobal);
router.get('/saldos/colaborador/:id', authMiddleware, saldosController.getKardexColaborador);

// 7. Módulo de Sincronización CONTPAQi Nóminas (NOMIPAQ)
router.get('/sync-nomipaq/status', authMiddleware, syncController.getStatus);
router.get('/sync-nomipaq/preview', authMiddleware, syncController.preview);
router.post('/sync-nomipaq/execute', authMiddleware, syncController.execute);
router.get('/sync-nomipaq/logs', authMiddleware, syncController.getLogs);

module.exports = router;
