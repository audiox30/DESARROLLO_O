const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const nomipaqSyncService = require('./src/services/nomipaqSyncService');
const { getLocalPool } = require('./src/config/database');

async function testLiveSync() {
  console.log('=== PRUEBA DE SINCRONIZACIÓN EN VIVO CONTPAQi -> DESARROLLO_O ===');
  
  // Probamos la extracción y aplicación de la primera empresa pequeña: ctCONTROLADORA_JA (36 empleados)
  const dbTest = 'ctCONTROLADORA_JA';
  console.log(`1. Extrayendo datos de ${dbTest}...`);
  const datos = await nomipaqSyncService.extraerDatosRemotos(dbTest);
  console.log(`   Extraídos: ${datos.empleados.length} empleados, ${datos.departamentos.length} deptos, ${datos.puestos.length} puestos.`);

  console.log('2. Aplicando Staging y MERGE en base local DESARROLLO_O (IdEmpresa = 3)...');
  const resultado = await nomipaqSyncService.aplicarStagingLocal(3, dbTest, datos, 1);
  console.log('   Resultado local:', resultado);

  // Verificar en base local
  const pool = await getLocalPool();
  const check = await pool.request().query('SELECT COUNT(*) AS total FROM dbo.Colaboradores WHERE IdEmpresa = 3');
  const saldos = await pool.request().query(`
    SELECT COUNT(*) AS totalSaldos, AVG(DiasCorrespondientes) AS avgDias 
    FROM dbo.SaldosVacaciones s
    JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
    WHERE c.IdEmpresa = 3
  `);
  console.log(`3. Validación en DESARROLLO_O:`);
  console.log(`   Colaboradores insertados para IdEmpresa 3: ${check.recordset[0].total}`);
  console.log(`   Saldos de vacaciones calculados LFT: ${saldos.recordset[0].totalSaldos} (Promedio días: ${saldos.recordset[0].avgDias})`);

  console.log('=== PRUEBA EXITOSA ===');
  process.exit(0);
}

testLiveSync().catch(err => {
  console.error('❌ Error en prueba de sincronización:', err);
  process.exit(1);
});
