const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const sql = require('mssql');
const { getLocalPool, getNomipaqPool } = require('./src/config/database');

// Mapeo canónico oficial de códigos bancarios SAT a nombres comerciales
const CATALOGO_BANCOS_SAT = {
  '002': 'BANAMEX',
  '012': 'BBVA',
  '014': 'SANTANDER',
  '021': 'HSBC',
  '030': 'BANBAJIO',
  '036': 'INBURSA',
  '042': 'MIFEL',
  '044': 'SCOTIABANK',
  '058': 'BANREGIO',
  '059': 'INVEX',
  '060': 'BANSI',
  '062': 'AFIRME',
  '072': 'BANORTE',
  '127': 'BANCO AZTECA',
  '130': 'COMPARTAMOS BANCO',
  '136': 'INTERCAM BANCO',
  '137': 'BANCOPPEL',
  '138': 'ABC CAPITAL',
  '140': 'CONSUBANCO',
  '143': 'CIBANCO',
  '145': 'BANCO MULTIVA',
  '166': 'BANCO DEL BIENESTAR',
  '646': 'STP'
};

function resolverBanco(codigoBancoRaw, clabeRaw) {
  const cod = String(codigoBancoRaw || '').trim();
  const clabe = String(clabeRaw || '').trim();

  if (CATALOGO_BANCOS_SAT[cod]) {
    return CATALOGO_BANCOS_SAT[cod];
  }

  // Si no viene código de banco pero la CLABE tiene 18 dígitos, deducir por prefijo de 3 dígitos
  if (clabe.length === 18) {
    const prefijo = clabe.substring(0, 3);
    if (CATALOGO_BANCOS_SAT[prefijo]) {
      return CATALOGO_BANCOS_SAT[prefijo];
    }
  }

  return cod || null;
}

function parseCuentaYClabe(cuentaRaw, clabeRaw) {
  let cuenta = String(cuentaRaw || '').trim();
  let clabe = String(clabeRaw || '').trim();

  // Si la cuenta tiene 18 dígitos y no hay CLABE, es en realidad una CLABE
  if (!clabe && cuenta.length === 18) {
    clabe = cuenta;
    cuenta = '';
  }

  return {
    numeroCuenta: cuenta || null,
    clabeInterbancaria: clabe || null
  };
}

async function sincronizarDatosFinancieros() {
  console.log('=============================================================================');
  console.log('   SINCRONIZACIÓN DE DATOS FINANCIEROS: CONTPAQi NÓMINAS -> DESARROLLO_O');
  console.log('=============================================================================');
  console.log(`Fecha/Hora: ${new Date().toLocaleString('es-MX')}`);

  const localPool = await getLocalPool();
  if (!localPool) {
    throw new Error('No se pudo conectar a la base de datos local DESARROLLO_O.');
  }

  // 1. Obtener empresas registradas en dbo.EmpresasNomipaq
  const empRes = await localPool.request().query(`
    SELECT IdEmpresa, AliasEmpresa, NombreBaseDatos 
    FROM dbo.EmpresasNomipaq 
    WHERE Activa = 1
    ORDER BY IdEmpresa;
  `);
  const empresas = empRes.recordset;

  console.log(`Empresas activas a procesar: ${empresas.length}\n`);

  let totalInsertadosGlobal = 0;
  let totalActualizadosGlobal = 0;
  let totalColaboradoresProcesados = 0;

  for (const emp of empresas) {
    console.log(`-----------------------------------------------------------------------------`);
    console.log(`[Empresa ${emp.IdEmpresa}] ${emp.AliasEmpresa} (BD: ${emp.NombreBaseDatos})`);
    console.log(`-----------------------------------------------------------------------------`);

    let nomipaqPool = null;
    try {
      nomipaqPool = await getNomipaqPool(emp.NombreBaseDatos);
    } catch (err) {
      console.error(`  ❌ Error al conectar a la base de CONTPAQi ${emp.NombreBaseDatos}:`, err.message);
      continue;
    }

    // 2. Extraer datos financieros de nom10001
    const queryNom = `
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SELECT 
        RTRIM(LTRIM(CAST(e.codigoempleado AS VARCHAR(30)))) AS codigoempleado,
        RTRIM(LTRIM(ISNULL(e.bancopagoelectronico, ''))) AS bancopagoelectronico,
        RTRIM(LTRIM(ISNULL(e.cuentapagoelectronico, ''))) AS cuentapagoelectronico,
        RTRIM(LTRIM(ISNULL(e.ClabeInterbancaria, ''))) AS clabeInterbancaria,
        ISNULL(e.sueldodiario, 0) AS sueldodiario,
        ISNULL(e.sueldointegrado, 0) AS sueldointegrado
      FROM dbo.nom10001 e WITH (NOLOCK);
    `;

    const nomRes = await nomipaqPool.request().query(queryNom);
    const empleadosNom = nomRes.recordset;
    console.log(`  -> Empleados leídos en CONTPAQi: ${empleadosNom.length}`);

    // 3. Obtener colaboradores locales de esta empresa
    const colabRes = await localPool.request()
      .input('IdEmpresa', emp.IdEmpresa)
      .query(`
        SELECT IdColaborador, RTRIM(LTRIM(CodigoEmpleado)) AS CodigoEmpleado, Activo
        FROM dbo.Colaboradores
        WHERE IdEmpresa = @IdEmpresa;
      `);

    // Mapear por CodigoEmpleado exacto de esta empresa
    const mapColab = new Map();
    for (const c of colabRes.recordset) {
      mapColab.set(c.CodigoEmpleado, c);
    }

    console.log(`  -> Colaboradores locales vinculados a esta empresa: ${mapColab.size}`);

    // 4. Preparar lotes de datos financieros cruzados
    const filasParaSincronizar = [];
    for (const empNom of empleadosNom) {
      const colabLocal = mapColab.get(empNom.codigoempleado);
      if (!colabLocal) {
        continue;
      }

      const { numeroCuenta, clabeInterbancaria } = parseCuentaYClabe(
        empNom.cuentapagoelectronico,
        empNom.clabeInterbancaria
      );
      const banco = resolverBanco(empNom.bancopagoelectronico, clabeInterbancaria);
      const sueldoDiario = Number(empNom.sueldodiario) || null;
      const sueldoIntegrado = Number(empNom.sueldointegrado) || null;

      filasParaSincronizar.push({
        idColaborador: colabLocal.IdColaborador,
        institucionBancaria: banco,
        numeroCuenta: numeroCuenta,
        clabeInterbancaria: clabeInterbancaria,
        salarioDiarioReal: sueldoDiario,
        salarioDiarioImss: sueldoDiario,
        salarioDiarioIntegrado: sueldoIntegrado
      });
    }

    console.log(`  -> Registros financieros listos para UPSERT: ${filasParaSincronizar.length}`);

    if (filasParaSincronizar.length === 0) {
      console.log(`  [INFO] No hay registros para procesar en ${emp.AliasEmpresa}.\n`);
      continue;
    }

    // 5. Aplicar UPSERT / MERGE en DESARROLLO_O mediante OPENJSON
    const jsonStr = JSON.stringify(filasParaSincronizar);
    const reqLocal = localPool.request();
    reqLocal.input('JsonData', sql.NVarChar(sql.MAX), jsonStr);

    const mergeQuery = `
      SET NOCOUNT ON;
      DECLARE @MergeActions TABLE (Action VARCHAR(10));

      MERGE dbo.ColaboradorDatosFinancieros AS tgt
      USING (
        SELECT 
          idColaborador,
          institucionBancaria,
          numeroCuenta,
          clabeInterbancaria,
          salarioDiarioReal,
          salarioDiarioImss,
          salarioDiarioIntegrado
        FROM OPENJSON(@JsonData)
        WITH (
          idColaborador INT '$.idColaborador',
          institucionBancaria VARCHAR(100) '$.institucionBancaria',
          numeroCuenta VARCHAR(30) '$.numeroCuenta',
          clabeInterbancaria VARCHAR(18) '$.clabeInterbancaria',
          salarioDiarioReal DECIMAL(18,4) '$.salarioDiarioReal',
          salarioDiarioImss DECIMAL(18,4) '$.salarioDiarioImss',
          salarioDiarioIntegrado DECIMAL(18,4) '$.salarioDiarioIntegrado'
        )
      ) AS src
      ON (tgt.IdColaborador = src.idColaborador)
      WHEN MATCHED THEN
        UPDATE SET 
          tgt.InstitucionBancaria     = src.institucionBancaria,
          tgt.NumeroCuenta            = src.numeroCuenta,
          tgt.ClabeInterbancaria      = src.clabeInterbancaria,
          tgt.SalarioDiarioReal       = src.salarioDiarioReal,
          tgt.SalarioDiarioImss       = src.salarioDiarioImss,
          tgt.SalarioDiarioIntegrado  = src.salarioDiarioIntegrado,
          tgt.FechaUltimaModificacion = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          IdColaborador,
          InstitucionBancaria,
          NumeroCuenta,
          ClabeInterbancaria,
          SalarioDiarioReal,
          SalarioDiarioImss,
          SalarioDiarioIntegrado,
          FechaUltimaModificacion
        )
        VALUES (
          src.idColaborador,
          src.institucionBancaria,
          src.numeroCuenta,
          src.clabeInterbancaria,
          src.salarioDiarioReal,
          src.salarioDiarioImss,
          src.salarioDiarioIntegrado,
          SYSUTCDATETIME()
        )
      OUTPUT $action INTO @MergeActions;

      SELECT 
        SUM(CASE WHEN Action = 'INSERT' THEN 1 ELSE 0 END) AS Insertados,
        SUM(CASE WHEN Action = 'UPDATE' THEN 1 ELSE 0 END) AS Actualizados
      FROM @MergeActions;
    `;

    const mergeRes = await reqLocal.query(mergeQuery);
    const insertados = mergeRes.recordset[0]?.Insertados || 0;
    const actualizados = mergeRes.recordset[0]?.Actualizados || 0;

    console.log(`  ✅ Completado ${emp.AliasEmpresa}: ${insertados} insertados, ${actualizados} actualizados.`);
    totalInsertadosGlobal += insertados;
    totalActualizadosGlobal += actualizados;
    totalColaboradoresProcesados += filasParaSincronizar.length;
    console.log('');
  }

  // 6. Auditoría y verificación final
  console.log('=============================================================================');
  console.log('                       RESULTADOS DE LA AUDITORÍA');
  console.log('=============================================================================');
  console.log(`Total registros procesados:    ${totalColaboradoresProcesados}`);
  console.log(`Total registros insertados:    ${totalInsertadosGlobal}`);
  console.log(`Total registros actualizados:  ${totalActualizadosGlobal}`);

  const totalFin = await localPool.request().query(`
    SELECT COUNT(*) AS TotalRegistrosFinancieros,
           COUNT(InstitucionBancaria) AS ConBanco,
           COUNT(NumeroCuenta) AS ConCuenta,
           COUNT(ClabeInterbancaria) AS ConClabe
    FROM dbo.ColaboradorDatosFinancieros;
  `);
  console.log('\nTotales globales en dbo.ColaboradorDatosFinancieros:');
  console.table(totalFin.recordset);

  // Verificación de Colaboradores Activos vs datos financieros
  const censoActivos = await localPool.request().query(`
    SELECT 
      COUNT(*) AS TotalActivos,
      COUNT(fin.IdColaborador) AS ActivosConFinanciero,
      SUM(CASE WHEN fin.IdColaborador IS NULL THEN 1 ELSE 0 END) AS ActivosSinFinanciero
    FROM dbo.Colaboradores c
    LEFT JOIN dbo.ColaboradorDatosFinancieros fin ON fin.IdColaborador = c.IdColaborador
    WHERE c.Activo = 1;
  `);
  console.log('\nCenso de colaboradores ACTIVOS vs datos financieros:');
  console.table(censoActivos.recordset);

  // Verificación específica: Valeria Acosta (Tramo del Centro)
  const valeriaCheck = await localPool.request().query(`
    SELECT 
      c.IdColaborador, c.CodigoEmpleado, c.NombreCompleto, c.Empresa,
      fin.InstitucionBancaria, fin.NumeroCuenta, fin.ClabeInterbancaria,
      fin.SalarioDiarioReal, fin.SalarioDiarioIntegrado
    FROM dbo.Colaboradores c
    LEFT JOIN dbo.ColaboradorDatosFinancieros fin ON fin.IdColaborador = c.IdColaborador
    WHERE c.NombreCompleto LIKE '%Valeria%Acosta%';
  `);
  console.log('\nVerificación de Valeria Acosta:');
  console.table(valeriaCheck.recordset);

  // Verificación de códigos repetidos (0836 en Latino Concretos y Tramo del Centro)
  const repCheck = await localPool.request().query(`
    SELECT 
      c.IdColaborador, c.CodigoEmpleado, c.NombreCompleto, c.Empresa,
      fin.InstitucionBancaria, fin.NumeroCuenta, fin.ClabeInterbancaria,
      fin.SalarioDiarioReal, fin.SalarioDiarioIntegrado
    FROM dbo.Colaboradores c
    LEFT JOIN dbo.ColaboradorDatosFinancieros fin ON fin.IdColaborador = c.IdColaborador
    WHERE c.CodigoEmpleado = '0836';
  `);
  console.log('\nVerificación de código 0836 repetido (Integridad Multi-Empresa):');
  console.table(repCheck.recordset);

  console.log('\n✅ Proceso de sincronización finalizado exitosamente.');
  process.exit(0);
}

sincronizarDatosFinancieros().catch(err => {
  console.error('\n❌ ERROR FATAL en sincronización de datos financieros:', err);
  process.exit(1);
});
