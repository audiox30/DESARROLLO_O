const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiRoutes = require('./routes/api');
const { getPool, isUsingMock } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Health check & System info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'Control de Vacaciones - Desarrollo Organizacional (Grupo JAMA)',
    timestamp: new Date().toISOString(),
    motorActivo: isUsingMock() ? 'MOTOR_LOCAL_MOCK (Grupo JAMA 601 Empleados)' : 'MICROSOFT_SQL_SERVER'
  });
});

// API Routes
app.use('/api', apiRoutes);

// Servir frontend compilado en producción / despliegue local unificado
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  console.log(`[HTTP] Sirviendo cliente estático desde ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error Handler global
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
});

// Programador en segundo plano para Avisos Automáticos de Vigencia LFT
let ultimaFechaEjecucionAvisos = '';
function iniciarProgramadorAvisosVigencia() {
  const vigenciaAlertasService = require('./services/vigenciaAlertasService');
  const { getLocalPool, isUsingMock } = require('./config/database');

  console.log('[CRON-VIGENCIA] Programador de alertas de vigencia y aniversarios iniciado.');

  setInterval(async () => {
    try {
      const ahora = new Date();
      const horaActual = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
      const fechaHoy = ahora.toISOString().split('T')[0];

      if (ultimaFechaEjecucionAvisos === fechaHoy) return;

      const pool = await getLocalPool();
      if (!pool || isUsingMock()) return;

      const res = await pool.request().query("SELECT Clave, Valor FROM dbo.ConfiguracionSistema WHERE Clave IN ('AVISOS_VIGENCIA_ENABLED', 'AVISOS_VIGENCIA_HORA')");
      const config = {};
      (res.recordset || []).forEach(r => { config[r.Clave] = r.Valor; });

      if (config.AVISOS_VIGENCIA_ENABLED === 'true' && config.AVISOS_VIGENCIA_HORA === horaActual) {
        ultimaFechaEjecucionAvisos = fechaHoy;
        console.log(`[CRON-VIGENCIA] ⏰ Hora programada alcanzada (${horaActual}). Ejecutando barrido automático...`);
        const resultado = await vigenciaAlertasService.evaluarYEnviarAvisos();
        console.log(`[CRON-VIGENCIA] ✅ Resultado: ${resultado.mensaje}`);
      }
    } catch (err) {
      console.warn('[CRON-VIGENCIA] Error en ciclo de evaluación:', err.message);
    }
  }, 60000);
}

// Inicialización de servidor y pool de base de datos
async function startServer() {
  try {
    getPool().catch(err => {
      console.log('[DB] Inicializado en modo de contingencia/desarrollo local.');
    });

    app.listen(PORT, () => {
      console.log(`================================================================`);
      console.log(`  🚀 SISTEMA DE CONTROL DE VACACIONES - GRUPO JAMA`);
      console.log(`  🌐 PORTAL WEB UNIFICADO: http://localhost:${PORT}`);
      console.log(`  📊 API REST: http://localhost:${PORT}/api/health`);
      console.log(`================================================================`);
      iniciarProgramadorAvisosVigencia();
    });
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
