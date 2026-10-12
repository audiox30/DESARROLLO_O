const sql = require('mssql');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ControlVacaciones_DO',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '15000', 10),
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true
  }
};

let pool = null;
let isConnected = false;
let isMockActive = false;

async function getPool() {
  if (pool && isConnected) {
    return pool;
  }

  try {
    console.log(`[DB] Intentando conectar a Microsoft SQL Server (${sqlConfig.server}:${sqlConfig.port}/${sqlConfig.database})...`);
    pool = await new sql.ConnectionPool(sqlConfig).connect();
    isConnected = true;
    isMockActive = false;
    console.log('[DB] ¡Conexión exitosa a Microsoft SQL Server!');

    pool.on('error', err => {
      console.error('[DB] Error inesperado en el Connection Pool de SQL Server:', err.message);
      isConnected = false;
    });

    return pool;
  } catch (err) {
    isConnected = false;
    if (process.env.USE_MOCK_FALLBACK !== 'false') {
      isMockActive = true;
      console.warn(`[DB WARNING] No se pudo conectar a SQL Server (${err.message}). Activando MODO MOTOR LOCAL (MockStore Grupo JAMA) con 601 empleados reales.`);
      return null;
    } else {
      console.error('[DB ERROR] Error fatal de conexión a SQL Server:', err);
      throw err;
    }
  }
}

function isUsingMock() {
  return isMockActive || !isConnected;
}

module.exports = {
  sql,
  sqlConfig,
  getPool,
  isUsingMock
};
