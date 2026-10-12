const net = require('net');
const sql = require('mssql');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const remoteHost = process.env.NOMIPAQ_REMOTE_SERVER || '192.168.20.29';
const remotePort = parseInt(process.env.NOMIPAQ_REMOTE_PORT || '1433', 10);
const remoteUser = process.env.NOMIPAQ_REMOTE_USER || 'SA';
const remotePassword = process.env.NOMIPAQ_REMOTE_PASSWORD || '';
const remoteDatabases = (process.env.NOMIPAQ_DATABASES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

console.log('=======================================================================');
console.log('      PRUEBA DE CONEXIÓN A CONTPAQi NÓMINAS (COMPAQ)');
console.log('=======================================================================');
console.log(`Servidor Remoto: ${remoteHost}:${remotePort}`);
console.log(`Usuario SQL:     ${remoteUser}`);
console.log(`Bases a validar: ${remoteDatabases.length} bases de datos`);
console.log('-----------------------------------------------------------------------\n');

function testTcpPort(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      status = true;
      socket.destroy();
      resolve({ success: true, message: `Puerto ${port} ABIERTO y respondiendo en ${host}` });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, message: `TIMEOUT alcanzado (${timeoutMs}ms) al intentar conectar con ${host}:${port}` });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, message: `Error de red: ${err.message}` });
    });

    socket.connect(port, host);
  });
}

async function probarConexionCompaq() {
  // PASO 1: Prueba de Conectividad TCP
  console.log('[PASO 1] Comprobando enlace de red TCP...');
  const tcpResult = await testTcpPort(remoteHost, remotePort);
  if (!tcpResult.success) {
    console.error(`❌ FALLA DE RED: ${tcpResult.message}`);
    console.log('\n[DIAGNÓSTICO RED]:');
    console.log('  1. Verifica que la IP 192.168.20.29 esté encendida y en el mismo segmento/VLAN.');
    console.log('  2. Comprueba que el Firewall de Windows en 192.168.20.29 permita el puerto 1433 TCP entrante.');
    console.log('  3. Asegúrate de que el protocolo TCP/IP esté habilitado en "SQL Server Configuration Manager" del servidor remoto.');
    return;
  }
  console.log(`✅ ${tcpResult.message}`);

  // PASO 2: Autenticación en SQL Server (Master)
  console.log('\n[PASO 2] Intentando autenticación en SQL Server...');
  const masterConfig = {
    user: remoteUser,
    password: remotePassword,
    server: remoteHost,
    port: remotePort,
    database: 'master',
    connectionTimeout: 10000,
    requestTimeout: 15000,
    options: {
      encrypt: process.env.NOMIPAQ_REMOTE_ENCRYPT === 'true',
      trustServerCertificate: process.env.NOMIPAQ_REMOTE_TRUST_SERVER_CERTIFICATE !== 'false',
      enableArithAbort: true
    }
  };

  let masterPool = null;
  try {
    masterPool = await new sql.ConnectionPool(masterConfig).connect();
    console.log(`✅ ¡Autenticación exitosa como usuario '${remoteUser}'!`);

    // Consultar versión y bases existentes
    const verRes = await masterPool.request().query('SELECT @@VERSION AS Version, SERVERPROPERTY(\'ServerName\') AS Instancia');
    console.log(`   Instancia: ${verRes.recordset[0].Instancia}`);
    console.log(`   Motor:     ${verRes.recordset[0].Version.split('\n')[0]}`);

    const dbQuery = `
      SELECT name, state_desc 
      FROM sys.databases 
      WHERE name IN (${remoteDatabases.map(d => `'${d}'`).join(',')})
    `;
    const dbRes = await masterPool.request().query(dbQuery);
    const basesExistentes = new Set(dbRes.recordset.map(r => r.name.toLowerCase()));

    console.log(`\n[PASO 3] Verificando existencia de las ${remoteDatabases.length} bases de datos en el servidor:`);
    for (const dbName of remoteDatabases) {
      if (basesExistentes.has(dbName.toLowerCase())) {
        console.log(`   ✅ Base [${dbName}]: EXISTE y está en línea`);
      } else {
        console.log(`   ⚠️ Base [${dbName}]: NO encontrada en sys.databases`);
      }
    }
  } catch (err) {
    console.error(`❌ ERROR DE AUTENTICACIÓN SQL: ${err.message}`);
    return;
  } finally {
    if (masterPool) await masterPool.close();
  }

  // PASO 4: Prueba de lectura con WITH (NOLOCK) en cada base
  console.log('\n[PASO 4] Probando extracción segura NO bloqueante (nom10001, nom10002, nom10003)...');
  for (const dbName of remoteDatabases) {
    const dbConfig = { ...masterConfig, database: dbName };
    let dbPool = null;
    try {
      dbPool = await new sql.ConnectionPool(dbConfig).connect();
      const testQuery = `
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

        SELECT 
          (SELECT COUNT(*) FROM dbo.nom10001 WITH (NOLOCK)) AS TotalEmpleados,
          (SELECT COUNT(*) FROM dbo.nom10001 WITH (NOLOCK) WHERE estadoempleado = 'A') AS EmpleadosActivos,
          (SELECT COUNT(*) FROM dbo.nom10006 WITH (NOLOCK)) AS TotalPuestos,
          (SELECT COUNT(*) FROM dbo.nom10003 WITH (NOLOCK)) AS TotalDeptos;
      `;
      const res = await dbPool.request().query(testQuery);
      const row = res.recordset[0];
      console.log(`   🎯 [${dbName}]: Conectado OK`);
      console.log(`      • Empleados en nómina: ${row.TotalEmpleados} (Activos: ${row.EmpleadosActivos})`);
      console.log(`      • Puestos: ${row.TotalPuestos} | Deptos: ${row.TotalDeptos}`);
    } catch (err) {
      console.log(`   ❌ [${dbName}]: Error al consultar tablas (${err.message})`);
    } finally {
      if (dbPool) await dbPool.close();
    }
  }

  console.log('\n=======================================================================');
  console.log('               PRUEBA DE CONEXIÓN CONTPAQi FINALIZADA');
  console.log('=======================================================================');
  process.exit(0);
}

probarConexionCompaq().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
});
