const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const nomipaqSyncService = require('./src/services/nomipaqSyncService');
const { getLocalPool } = require('./src/config/database');

const BASES_DATOS_JAMA = [
  { id: 1, db: 'ctCEMENTOS_MOCTEZ', alias: 'Cementos Moctezuma' },
  { id: 2, db: 'ctCONSTRUJAMA_DE_', alias: 'Construjama de México S.A. de C.V.' },
  { id: 3, db: 'ctCONTROLADORA_JA', alias: 'Controladora JAMA, S.C.' },
  { id: 4, db: 'ctDISTRIBUIDOR_DE', alias: 'Distribuidor de Cemento del Occidente' },
  { id: 5, db: 'ctDISTRIBUIDORA_J', alias: 'Distribuidora JAMA' },
  { id: 6, db: 'ctIMPULSORA_DE_NE', alias: 'Impulsora de Negocios' },
  { id: 7, db: 'ctLATINO_CONCRETO', alias: 'Latino Concretos' },
  { id: 8, db: 'ctTRAMO_DEL_CENTR', alias: 'Tramo del Centro' }
];

async function sincronizarTodo() {
  console.log('=============================================================================');
  console.log('     INICIANDO SINCRONIZACIÓN TOTAL: CONTPAQi NÓMINAS -> DESARROLLO_O');
  console.log('=============================================================================');
  console.log(`Fecha/Hora: ${new Date().toLocaleString('es-MX')}`);
  console.log(`Servidor Remoto: ${process.env.NOMIPAQ_REMOTE_SERVER}:${process.env.NOMIPAQ_REMOTE_PORT} (${process.env.NOMIPAQ_REMOTE_INSTANCE})`);
  console.log(`Servidor Local:  ${process.env.LOCAL_DB_SERVER}:${process.env.LOCAL_DB_PORT} (${process.env.LOCAL_DB_NAME})`);
  console.log('-----------------------------------------------------------------------------\n');

  const inicio = Date.now();
  const resultados = [];
  let totalInsertadosGlobal = 0;
  let totalActualizadosGlobal = 0;

  for (let i = 0; i < BASES_DATOS_JAMA.length; i++) {
    const item = BASES_DATOS_JAMA[i];
    console.log(`[${i + 1}/${BASES_DATOS_JAMA.length}] Procesando empresa: ${item.alias} [${item.db}]...`);
    const t0 = Date.now();

    try {
      // 1. Extracción remota con NOLOCK
      console.log(`   -> Extrayendo datos remotos de ${item.db}...`);
      const datos = await nomipaqSyncService.extraerDatosRemotos(item.db);
      
      console.log(`   -> Extraídos: ${datos.empleados.length} empleados, ${datos.departamentos.length} departamentos, ${datos.puestos.length} puestos.`);

      // 2. Aplicar Staging y MERGE en DESARROLLO_O
      console.log(`   -> Aplicando transacción MERGE en DESARROLLO_O (IdEmpresa = ${item.id})...`);
      const resLocal = await nomipaqSyncService.aplicarStagingLocal(item.id, item.db, datos, 1);
      
      const insertados = resLocal.RegistrosInsertados || resLocal.registrosInsertados || 0;
      const actualizados = resLocal.RegistrosActualizados || resLocal.registrosActualizados || 0;
      const duracion = ((Date.now() - t0) / 1000).toFixed(2);

      totalInsertadosGlobal += insertados;
      totalActualizadosGlobal += actualizados;

      console.log(`   ✅ Completado en ${duracion}s: ${insertados} insertados, ${actualizados} actualizados.`);
      resultados.push({
        id: item.id,
        empresa: item.alias,
        db: item.db,
        empleadosNomina: datos.empleados.length,
        insertados,
        actualizados,
        duracion: `${duracion}s`,
        estado: 'EXITOSO'
      });
    } catch (err) {
      console.error(`   ❌ ERROR en ${item.db}:`, err.message);
      resultados.push({
        id: item.id,
        empresa: item.alias,
        db: item.db,
        error: err.message,
        estado: 'FALLIDO'
      });
    }
    console.log('');
  }

  // 3. Verificación y Auditoría final en DESARROLLO_O
  console.log('-----------------------------------------------------------------------------');
  console.log('AUDITORÍA DE TOTALES EN LA BASE LOCAL (DESARROLLO_O):');
  console.log('-----------------------------------------------------------------------------');
  
  const pool = await getLocalPool();
  const censo = await pool.request().query(`
    SELECT 
      e.IdEmpresa,
      e.AliasEmpresa,
      COUNT(c.IdColaborador) AS TotalColaboradores,
      SUM(CASE WHEN c.Activo = 1 THEN 1 ELSE 0 END) AS ColaboradoresActivos,
      SUM(CASE WHEN c.Activo = 0 THEN 1 ELSE 0 END) AS ColaboradoresBaja
    FROM dbo.EmpresasNomipaq e
    LEFT JOIN dbo.Colaboradores c ON c.IdEmpresa = e.IdEmpresa
    GROUP BY e.IdEmpresa, e.AliasEmpresa
    ORDER BY e.IdEmpresa;
  `);

  console.table(censo.recordset);

  const totalesGlobales = await pool.request().query(`
    SELECT 
      (SELECT COUNT(*) FROM dbo.Colaboradores) AS TotalColaboradores,
      (SELECT COUNT(*) FROM dbo.Colaboradores WHERE Activo = 1) AS ColaboradoresActivos,
      (SELECT COUNT(*) FROM dbo.Departamentos) AS TotalDepartamentos,
      (SELECT COUNT(*) FROM dbo.Puestos) AS TotalPuestos,
      (SELECT COUNT(*) FROM dbo.SaldosVacaciones) AS TotalRegistrosSaldosLFT,
      (SELECT COUNT(DISTINCT IdColaborador) FROM dbo.SaldosVacaciones) AS ColaboradoresConSaldoLFT;
  `);

  console.log('RESUMEN GLOBAL EN DESARROLLO_O:');
  console.table(totalesGlobales.recordset);

  const duracionTotal = ((Date.now() - inicio) / 1000).toFixed(2);
  console.log(`=============================================================================`);
  console.log(`  SINCRONIZACIÓN CONCLUIDA CON ÉXITO EN ${duracionTotal} SEGUNDOS`);
  console.log(`=============================================================================`);
  process.exit(0);
}

sincronizarTodo().catch(err => {
  console.error('Error fatal durante la sincronización total:', err);
  process.exit(1);
});
