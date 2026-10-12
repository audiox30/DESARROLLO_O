const sql = require('mssql');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 1. Configuración del Servidor Local (Base de Datos: DESARROLLO_O)
const localSqlConfig = {
  user: process.env.LOCAL_DB_USER || process.env.DB_USER || 'sa',
  password: process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || '',
  server: process.env.LOCAL_DB_SERVER || process.env.DB_SERVER || 'localhost',
  database: process.env.LOCAL_DB_NAME || 'DESARROLLO_O',
  port: parseInt(process.env.LOCAL_DB_PORT || process.env.DB_PORT || '1433', 10),
  connectionTimeout: parseInt(process.env.LOCAL_DB_CONNECTION_TIMEOUT || '5000', 10),
  requestTimeout: parseInt(process.env.LOCAL_DB_REQUEST_TIMEOUT || '15000', 10),
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.LOCAL_DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.LOCAL_DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true
  }
};

// 2. Configuración del Servidor Remoto (CONTPAQi Nóminas)
const nomipaqRemoteConfig = {
  user: process.env.NOMIPAQ_REMOTE_USER || 'sa_nomipaq',
  password: process.env.NOMIPAQ_REMOTE_PASSWORD || '',
  server: process.env.NOMIPAQ_REMOTE_SERVER || '127.0.0.1',
  port: parseInt(process.env.NOMIPAQ_REMOTE_PORT || '1433', 10),
  connectionTimeout: parseInt(process.env.NOMIPAQ_REMOTE_CONNECTION_TIMEOUT || '5000', 10),
  requestTimeout: parseInt(process.env.NOMIPAQ_REMOTE_REQUEST_TIMEOUT || '20000', 10),
  pool: {
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.NOMIPAQ_REMOTE_ENCRYPT === 'true',
    trustServerCertificate: process.env.NOMIPAQ_REMOTE_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true
  }
};

let localPool = null;
let isLocalConnected = false;
let isMockActive = false;
const remotePools = new Map();

async function getLocalPool() {
  if (localPool && isLocalConnected) {
    return localPool;
  }

  try {
    console.log(`[DB-LOCAL] Conectando a SQL Server Local (${localSqlConfig.server}:${localSqlConfig.port}/${localSqlConfig.database})...`);
    localPool = await new sql.ConnectionPool(localSqlConfig).connect();
    isLocalConnected = true;
    isMockActive = false;
    console.log(`[DB-LOCAL] ¡Conexión exitosa a base de datos ${localSqlConfig.database}!`);

    localPool.on('error', err => {
      console.error('[DB-LOCAL] Error inesperado en pool local:', err.message);
      isLocalConnected = false;
    });

    return localPool;
  } catch (err) {
    isLocalConnected = false;
    if (process.env.USE_MOCK_FALLBACK !== 'false') {
      isMockActive = true;
      console.warn(`[DB-LOCAL] No se pudo conectar a ${localSqlConfig.database} (${err.message}). Activando MODO MOTOR LOCAL.`);
      return null;
    } else {
      console.error('[DB-LOCAL] Error fatal:', err);
      throw err;
    }
  }
}

async function getNomipaqPool(databaseName) {
  if (!databaseName) {
    throw new Error('Debe especificarse el nombre de la base de datos de CONTPAQi Nóminas.');
  }

  if (remotePools.has(databaseName)) {
    const existing = remotePools.get(databaseName);
    if (existing.connected) return existing;
  }

  const dbConfig = {
    ...nomipaqRemoteConfig,
    database: databaseName
  };

  try {
    console.log(`[DB-NOMIPAQ-REMOTO] Conectando a ${databaseName} en ${dbConfig.server}...`);
    const pool = await new sql.ConnectionPool(dbConfig).connect();
    remotePools.set(databaseName, pool);

    pool.on('error', err => {
      console.error(`[DB-NOMIPAQ-REMOTO] Error en pool ${databaseName}:`, err.message);
      remotePools.delete(databaseName);
    });

    return pool;
  } catch (err) {
    console.warn(`[DB-NOMIPAQ-REMOTO] No fue posible conectar a ${databaseName} (${err.message}).`);
    throw err;
  }
}

function isUsingMock() {
  return isMockActive || !isLocalConnected;
}

module.exports = {
  sql,
  localSqlConfig,
  nomipaqRemoteConfig,
  getLocalPool,
  getPool: getLocalPool, // Compatibilidad hacia atrás
  getNomipaqPool,
  isUsingMock
};
