const net = require('net');
const sql = require('mssql');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

function testSocket(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeout);
    s.on('connect', () => {
      s.destroy();
      resolve({ open: true, msg: 'Conexión TCP exitosa' });
    });
    s.on('timeout', () => {
      s.destroy();
      resolve({ open: false, msg: `Timeout de conexión (${timeout}ms)` });
    });
    s.on('error', (err) => {
      s.destroy();
      resolve({ open: false, msg: err.message });
    });
    s.connect(port, host);
  });
}

async function main() {
  console.log('================================================================');
  console.log('   PRUEBA DE CONEXIÓN A BASES DE DATOS SQL (GRUPO JAMA)');
  console.log('================================================================\n');

  // 1. DESARROLLO_O
  const localHost = process.env.LOCAL_DB_SERVER || '192.168.20.15';
  const localPort = parseInt(process.env.LOCAL_DB_PORT || '1433', 10);
  const localDb = process.env.LOCAL_DB_NAME || 'DESARROLLO_O';
  const localUser = process.env.LOCAL_DB_USER || 'sa';
  const localPass = process.env.LOCAL_DB_PASSWORD || '';

  console.log(`📌 1. SERVIDOR DESARROLLO_O (${localHost}:${localPort} / DB: ${localDb})`);
  console.log(`   Probando socket TCP...`);
  const localSock = await testSocket(localHost, localPort);
  console.log(`   Resultado TCP: ${localSock.open ? '✅ PUERTO ABIERTO' : '❌ PUERTO CERRADO O INALCANZABLE'} (${localSock.msg})`);

  if (localSock.open) {
    const localConfig = {
      user: localUser,
      password: localPass,
      server: localHost,
      database: localDb,
      port: localPort,
      connectionTimeout: 5000,
      requestTimeout: 10000,
      options: {
        encrypt: process.env.LOCAL_DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.LOCAL_DB_TRUST_SERVER_CERTIFICATE !== 'false',
        enableArithAbort: true
      }
    };
    try {
      console.log(`   Autenticando con usuario '${localUser}' y conectando a base de datos...`);
      const pool = await new sql.ConnectionPool(localConfig).connect();
      const res = await pool.request().query('SELECT @@VERSION AS version, DB_NAME() AS current_db, GETDATE() AS server_time');
      console.log(`   ✅ CONEXIÓN SQL EXITOSA:`);
      console.log(`      - Base de datos actual: ${res.recordset[0].current_db}`);
      console.log(`      - Fecha del servidor: ${res.recordset[0].server_time}`);
      console.log(`      - Versión SQL: ${res.recordset[0].version.split('\n')[0]}`);
      await pool.close();
    } catch (err) {
      console.log(`   ❌ ERROR DE AUTENTICACIÓN / SQL: ${err.message}`);
    }
  }

  console.log('\n----------------------------------------------------------------\n');

  // 2. CONTPAQi Nóminas (COMPAC)
  const remHost = process.env.NOMIPAQ_REMOTE_SERVER || '192.168.20.29';
  const remPort = parseInt(process.env.NOMIPAQ_REMOTE_PORT || '51700', 10);
  const remUser = process.env.NOMIPAQ_REMOTE_USER || 'SA';
  const remPass = process.env.NOMIPAQ_REMOTE_PASSWORD || '';
  const remInstance = process.env.NOMIPAQ_REMOTE_INSTANCE || 'COMPAC';
  const sampleDb = (process.env.NOMIPAQ_DATABASES || 'ctCEMENTOS_MOCTEZ').split(',')[0].trim();

  console.log(`📌 2. SERVIDOR CONTPAQi NÓMINAS / COMPAC (${remHost}:${remPort} o Instancia: ${remInstance})`);
  console.log(`   Probando socket TCP al puerto ${remPort}...`);
  let remSock = await testSocket(remHost, remPort);
  console.log(`   Resultado TCP (puerto ${remPort}): ${remSock.open ? '✅ PUERTO ABIERTO' : '❌ PUERTO CERRADO O INALCANZABLE'} (${remSock.msg})`);

  // También probar 1433 por si acaso
  if (!remSock.open) {
    console.log(`   Probando puerto alterno estándar 1433 en ${remHost}...`);
    const altSock = await testSocket(remHost, 1433);
    console.log(`   Resultado TCP (puerto 1433): ${altSock.open ? '✅ PUERTO ABIERTO' : '❌ PUERTO CERRADO O INALCANZABLE'} (${altSock.msg})`);
  }

  // Intentar conexión SQL
  const targetPort = remSock.open ? remPort : 1433;
  const remConfig = {
    user: remUser,
    password: remPass,
    server: remHost,
    port: targetPort,
    database: sampleDb,
    connectionTimeout: 5000,
    requestTimeout: 10000,
    options: {
      encrypt: process.env.NOMIPAQ_REMOTE_ENCRYPT === 'true',
      trustServerCertificate: process.env.NOMIPAQ_REMOTE_TRUST_SERVER_CERTIFICATE !== 'false',
      enableArithAbort: true
    }
  };

  try {
    console.log(`   Conectando a base de datos '${sampleDb}' con usuario '${remUser}'...`);
    const pool = await new sql.ConnectionPool(remConfig).connect();
    const res = await pool.request().query('SELECT @@VERSION AS version, DB_NAME() AS current_db, COUNT(*) as total_empleados FROM nom10001');
    console.log(`   ✅ CONEXIÓN SQL EXITOSA A CONTPAQi NÓMINAS:`);
    console.log(`      - Base de datos actual: ${res.recordset[0].current_db}`);
    console.log(`      - Total colaboradores en nom10001 (${sampleDb}): ${res.recordset[0].total_empleados}`);
    console.log(`      - Versión SQL: ${res.recordset[0].version.split('\n')[0]}`);
    await pool.close();
  } catch (err) {
    console.log(`   ❌ ERROR DE CONEXIÓN / SQL: ${err.message}`);

    // Si falló por puerto o nombre de instancia, probar con instanceName
    if (remInstance) {
      console.log(`   Reintentando mediante instanceName: '${remInstance}'...`);
      const remConfigInst = {
        ...remConfig,
        port: undefined,
        options: {
          ...remConfig.options,
          instanceName: remInstance
        }
      };
      try {
        const pool2 = await new sql.ConnectionPool(remConfigInst).connect();
        const res2 = await pool2.request().query('SELECT @@VERSION AS version, DB_NAME() AS current_db FROM master.dbo.sysdatabases');
        console.log(`   ✅ CONEXIÓN CON INSTANCIA '${remInstance}' EXITOSA`);
        await pool2.close();
      } catch (err2) {
        console.log(`   ❌ ERROR CON INSTANCIA '${remInstance}': ${err2.message}`);
      }
    }
  }

  console.log('\n================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
});
