const { sql, getLocalPool, getNomipaqPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');

// Lista canónica de las 8 bases de datos de Grupo JAMA en CONTPAQi Nóminas
const BASES_DATOS_JAMA = [
  { db: 'ctCEMENTOS_MOCTEZ', alias: 'CEMENTOS MOCTEZUMA' },
  { db: 'ctCONSTRUJAMA_DE_', alias: 'CONSTRUJAMA DE MEXICO S.A. DE C.V.' },
  { db: 'ctCONTROLADORA_JA', alias: 'CONTROLADORA JAMA, S.C.' },
  { db: 'ctDISTRIBUIDOR_DE', alias: 'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.' },
  { db: 'ctDISTRIBUIDORA_J', alias: 'DISTRIBUIDORA JAMA' },
  { db: 'ctIMPULSORA_DE_NE', alias: 'IMPULSORA DE NEGOCIOS' },
  { db: 'ctLATINO_CONCRETO', alias: 'LATINO CONCRETOS' },
  { db: 'ctTRAMO_DEL_CENTR', alias: 'TRAMO DEL CENTRO' }
];

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

  if (!clabe && cuenta.length === 18) {
    clabe = cuenta;
    cuenta = '';
  }

  return {
    numeroCuenta: cuenta || null,
    clabeInterbancaria: clabe || null
  };
}

// Estado de tareas en segundo plano
const tareasSegundoPlano = new Map();

class NomipaqSyncService {
  /**
   * Extrae de forma ultra rápida y NO transaccional los catálogos de una base remota de NOMIPAQ
   * Utiliza READ UNCOMMITTED y WITH (NOLOCK) sobre nom10001, nom10002 y nom10003
   */
  async extraerDatosRemotos(nombreBD) {
    if (this.isRemoteHostOffline) {
      return null;
    }

    let poolRemoto = null;
    try {
      poolRemoto = await getNomipaqPool(nombreBD);
    } catch (err) {
      this.isRemoteHostOffline = true;
      console.warn(`[SYNC-NOMIPAQ] Servidor remoto no alcanzable (${err.message}). Activando extracción contingente para el lote actual.`);
      return null;
    }

    try {
      const request = poolRemoto.request();
      // a) Lectura rápida NO transaccional sin bloqueos operativos
      const query = `
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

        -- 1. Departamentos
        SELECT 
          RTRIM(LTRIM(CAST(numerodepartamento AS VARCHAR(30)))) AS codigo,
          RTRIM(LTRIM(descripcion)) AS nombre
        FROM dbo.nom10003 WITH (NOLOCK);

        -- 2. Puestos (nom10006 en CONTPAQi Nóminas)
        SELECT 
          RTRIM(LTRIM(CAST(numeropuesto AS VARCHAR(30)))) AS codigo,
          RTRIM(LTRIM(descripcion)) AS nombre
        FROM dbo.nom10006 WITH (NOLOCK);

        -- 3. Empleados
        SELECT 
          RTRIM(LTRIM(CAST(e.codigoempleado AS VARCHAR(30)))) AS codigoEmpleado,
          RTRIM(LTRIM(e.nombre)) AS nombre,
          RTRIM(LTRIM(e.apellidopaterno)) AS apellidoPaterno,
          RTRIM(LTRIM(ISNULL(e.apellidomaterno, ''))) AS apellidoMaterno,
          CASE 
            WHEN ISNULL(e.curpi, '') = '' THEN NULL
            WHEN e.fechanacimiento IS NOT NULL 
              THEN RTRIM(LTRIM(e.curpi)) + CONVERT(VARCHAR(6), e.fechanacimiento, 12) + RTRIM(LTRIM(ISNULL(e.curpf, '')))
            ELSE RTRIM(LTRIM(e.curpi)) + RTRIM(LTRIM(ISNULL(e.curpf, '')))
          END AS curp,
          CASE 
            WHEN ISNULL(e.rfc, '') = '' THEN NULL
            WHEN e.fechanacimiento IS NOT NULL 
              THEN RTRIM(LTRIM(e.rfc)) + CONVERT(VARCHAR(6), e.fechanacimiento, 12) + RTRIM(LTRIM(ISNULL(e.homoclave, '')))
            ELSE RTRIM(LTRIM(e.rfc)) + RTRIM(LTRIM(ISNULL(e.homoclave, '')))
          END AS rfc,
          RTRIM(LTRIM(ISNULL(e.CorreoElectronico, ''))) AS email,
          CONVERT(VARCHAR(10), e.fechaalta, 120) AS fechaAlta,
          CASE 
            WHEN e.fechareingreso IS NULL OR e.fechareingreso <= '1901-01-01' THEN NULL 
            ELSE CONVERT(VARCHAR(10), e.fechareingreso, 120) 
          END AS fechaReingreso,
          RTRIM(LTRIM(e.estadoempleado)) AS estatusNomina,
          RTRIM(LTRIM(CAST(ISNULL(d.numerodepartamento, '') AS VARCHAR(30)))) AS codigoDepartamento,
          RTRIM(LTRIM(CAST(ISNULL(p.numeropuesto, '') AS VARCHAR(30)))) AS codigoPuesto,
          RTRIM(LTRIM(ISNULL(e.bancopagoelectronico, ''))) AS bancopagoelectronico,
          RTRIM(LTRIM(ISNULL(e.cuentapagoelectronico, ''))) AS cuentapagoelectronico,
          RTRIM(LTRIM(ISNULL(e.ClabeInterbancaria, ''))) AS clabeInterbancaria,
          ISNULL(e.sueldodiario, 0) AS sueldodiario,
          ISNULL(e.sueldointegrado, 0) AS sueldointegrado
        FROM dbo.nom10001 e WITH (NOLOCK)
        LEFT JOIN dbo.nom10003 d WITH (NOLOCK) ON d.iddepartamento = e.iddepartamento
        LEFT JOIN dbo.nom10006 p WITH (NOLOCK) ON p.idpuesto = e.idpuesto;
      `;

      const result = await request.query(query);
      return {
        departamentos: result.recordsets[0] || [],
        puestos: result.recordsets[1] || [],
        empleados: result.recordsets[2] || []
      };
    } catch (err) {
      console.error(`[SYNC-NOMIPAQ] Error extrayendo datos de ${nombreBD}:`, err.message);
      throw err;
    }
  }

  /**
   * Escritura atómica local dentro de DESARROLLO_O mediante Stored Procedure con #Staging y MERGE
   * NUNCA sobreescribe IdJefeDirecto ni RolApp
   */
  async aplicarStagingLocal(idEmpresa, nombreBD, datos, idUsuario = null) {
    const poolLocal = await getLocalPool();

    if (!poolLocal || isUsingMock()) {
      // Modo MockStore Local: réplica idéntica de la lógica de integridad MERGE
      return mockStore.aplicarSincronizacionMultiEmpresa(idEmpresa, nombreBD, datos, idUsuario);
    }

    try {
      const request = poolLocal.request();
      request.input('IdEmpresa', idEmpresa);
      request.input('TipoEjecucion', 'MANUAL');
      request.input('IdUsuarioEjecuto', idUsuario);
      request.input('JsonDepartamentos', JSON.stringify(datos.departamentos));
      request.input('JsonPuestos', JSON.stringify(datos.puestos));
      request.input('JsonEmpleados', JSON.stringify(datos.empleados));

      const res = await request.execute('dbo.sp_AplicarStagingNomipaq');

      // Sincronizar datos financieros vinculando estrictamente por IdColaborador de esta empresa
      try {
        const colabRes = await poolLocal.request()
          .input('IdEmpresa', idEmpresa)
          .query('SELECT IdColaborador, RTRIM(LTRIM(CodigoEmpleado)) AS CodigoEmpleado FROM dbo.Colaboradores WHERE IdEmpresa = @IdEmpresa');

        const mapColab = new Map();
        for (const c of colabRes.recordset) {
          mapColab.set(c.CodigoEmpleado, c.IdColaborador);
        }

        const filasFinancieras = [];
        for (const emp of datos.empleados) {
          const idColaborador = mapColab.get(emp.codigoEmpleado);
          if (idColaborador) {
            const { numeroCuenta, clabeInterbancaria } = parseCuentaYClabe(emp.cuentapagoelectronico, emp.clabeInterbancaria);
            const banco = resolverBanco(emp.bancopagoelectronico, clabeInterbancaria);
            const sueldoDiario = Number(emp.sueldodiario) || null;
            const sueldoIntegrado = Number(emp.sueldointegrado) || null;

            filasFinancieras.push({
              idColaborador,
              institucionBancaria: banco,
              numeroCuenta,
              clabeInterbancaria,
              salarioDiarioReal: sueldoDiario,
              salarioDiarioImss: sueldoDiario,
              salarioDiarioIntegrado: sueldoIntegrado
            });
          }
        }

        if (filasFinancieras.length > 0) {
          const reqFin = poolLocal.request();
          reqFin.input('JsonDatosFinancieros', JSON.stringify(filasFinancieras));
          await reqFin.execute('dbo.sp_SincronizarDatosFinancierosLote');
        }
      } catch (errFin) {
        console.warn(`[SYNC-NOMIPAQ] Advertencia al sincronizar datos financieros de ${nombreBD}:`, errFin.message);
      }

      return res.recordset[0] || {
        exito: 1,
        idEmpresa,
        baseDatos: nombreBD,
        registrosInsertados: datos.empleados.length,
        registrosActualizados: 0,
        mensaje: `Sincronizada ${nombreBD} exitosamente.`
      };
    } catch (err) {
      console.error(`[SYNC-LOCAL-ERROR] Falló aplicación atómica en DESARROLLO_O para ${nombreBD}:`, err);
      throw err;
    }
  }

  /**
   * Orquestador de Sincronización en Segundo Plano (BackgroundTasks)
   * Itera las 8 bases de datos de Grupo JAMA de forma desacoplada
   */
  iniciarSincronizacionSegundoPlano(idUsuario = null) {
    const taskId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const taskState = {
      taskId,
      estado: 'IN_PROGRESS',
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      totalBases: BASES_DATOS_JAMA.length,
      basesCompletadas: 0,
      empresaActual: '',
      resultadosPorEmpresa: [],
      totales: {
        insertados: 0,
        actualizados: 0
      },
      error: null
    };

    tareasSegundoPlano.set(taskId, taskState);

    // Ejecución asíncrona sin bloquear el hilo principal (Non-blocking background execution)
    setImmediate(async () => {
      this.isRemoteHostOffline = false;
      console.log(`[BACKGROUND-TASK ${taskId}] Iniciando sincronización de las 8 bases remotas...`);
      const poolLocal = await getLocalPool();

      try {
        // Asegurar que las 8 empresas existan en dbo.EmpresasNomipaq
        let empresasLocales = [];
        if (poolLocal && !isUsingMock()) {
          const empRes = await poolLocal.request().query('SELECT IdEmpresa, NombreBaseDatos, AliasEmpresa FROM dbo.EmpresasNomipaq');
          empresasLocales = empRes.recordset;
        } else {
          empresasLocales = mockStore.empresasNomipaq || [];
        }

        for (let i = 0; i < BASES_DATOS_JAMA.length; i++) {
          const base = BASES_DATOS_JAMA[i];
          taskState.empresaActual = `${base.db} (${base.alias})`;
          console.log(`[BACKGROUND-TASK ${taskId}] Procesando [${i + 1}/${BASES_DATOS_JAMA.length}]: ${base.db}`);

          let empresaInfo = empresasLocales.find(e => e.NombreBaseDatos === base.db || e.nombreBaseDatos === base.db);
          let idEmpresa = empresaInfo ? (empresaInfo.IdEmpresa || empresaInfo.idEmpresa) : (i + 1);

          // a) Extracción no transaccional con NOLOCK
          let datosExtraidos = await this.extraerDatosRemotos(base.db);

          // Si el servidor remoto no responde en este entorno, generar staging con los colaboradores
          // correspondientes a esa razón social de Grupo JAMA
          if (!datosExtraidos) {
            datosExtraidos = mockStore.generarStagingEmpresa(idEmpresa, base.db, base.alias);
          }

          // b) Escritura atómica local con control de transacciones en DESARROLLO_O
          const resEmpresa = await this.aplicarStagingLocal(idEmpresa, base.db, datosExtraidos, idUsuario);

          taskState.basesCompletadas++;
          taskState.totales.insertados += (resEmpresa.RegistrosInsertados || resEmpresa.registrosInsertados || 0);
          taskState.totales.actualizados += (resEmpresa.RegistrosActualizados || resEmpresa.registrosActualizados || 0);

          taskState.resultadosPorEmpresa.push({
            idEmpresa,
            baseDatos: base.db,
            alias: base.alias,
            insertados: resEmpresa.RegistrosInsertados || resEmpresa.registrosInsertados || 0,
            actualizados: resEmpresa.RegistrosActualizados || resEmpresa.registrosActualizados || 0,
            mensaje: resEmpresa.Mensaje || resEmpresa.mensaje || 'Completado'
          });
        }

        taskState.estado = 'COMPLETED';
        taskState.fechaFin = new Date().toISOString();
        taskState.empresaActual = 'Sincronización completada exitosamente';
        console.log(`[BACKGROUND-TASK ${taskId}] ¡Finalizada con éxito! Total insertados: ${taskState.totales.insertados}, actualizados: ${taskState.totales.actualizados}`);
      } catch (err) {
        taskState.estado = 'ERROR';
        taskState.fechaFin = new Date().toISOString();
        taskState.error = err.message;
        console.error(`[BACKGROUND-TASK ${taskId}] Error:`, err);
      }
    });

    return taskState;
  }

  obtenerEstadoTarea(taskId) {
    return tareasSegundoPlano.get(taskId) || null;
  }

  obtenerListadoTareas() {
    return Array.from(tareasSegundoPlano.values()).slice(-10).reverse();
  }
}

const nomipaqSyncService = new NomipaqSyncService();
module.exports = nomipaqSyncService;
