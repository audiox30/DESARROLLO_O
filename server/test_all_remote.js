const { getNomipaqPool, getLocalPool } = require('./src/config/database');

const BASES = [
  'ctCEMENTOS_MOCTEZ',
  'ctCONSTRUJAMA_DE_',
  'ctCONTROLADORA_JA',
  'ctDISTRIBUIDOR_DE',
  'ctDISTRIBUIDORA_J',
  'ctIMPULSORA_DE_NE',
  'ctLATINO_CONCRETO',
  'ctTRAMO_DEL_CENTR'
];

async function testExtraction() {
  console.log('--- Probando extracción en las 8 bases ---');
  for (const db of BASES) {
    try {
      const pool = await getNomipaqPool(db);
      const res = await pool.request().query(`
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT 
          (SELECT COUNT(*) FROM dbo.nom10003 WITH (NOLOCK)) AS deptos,
          (SELECT COUNT(*) FROM dbo.nom10006 WITH (NOLOCK)) AS puestos,
          (SELECT COUNT(*) FROM dbo.nom10001 WITH (NOLOCK)) AS empleados,
          (SELECT COUNT(*) FROM dbo.nom10001 WITH (NOLOCK) WHERE estadoempleado = 'A') AS activos;
      `);
      console.log(`✅ ${db}:`, res.recordset[0]);
    } catch (err) {
      console.error(`❌ ${db} Error:`, err.message);
    }
  }
}

testExtraction().catch(console.error);
