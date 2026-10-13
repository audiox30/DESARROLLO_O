const { getLocalPool, isUsingMock } = require('../config/database');
const mockStore = require('../data/mockStore');

class ColaboradorModel {
  /**
   * Obtiene la ficha completa de un colaborador incluyendo sus tablas relacionadas.
   * Aplica aislamiento de confidencialidad: los datos financieros solo se exponen
   * si el usuario solicitante tiene rol 'ADMIN_DO' o es el propio colaborador.
   */
  static async obtenerDetalleCompleto(idColaborador, rolSolicitante = 'COLABORADOR', idUsuarioSolicitante = null) {
    const esAutorizadoFinanciero = (rolSolicitante === 'ADMIN_DO' || idColaborador === idUsuarioSolicitante);
    const pool = await getLocalPool();

    if (!pool || isUsingMock()) {
      const colab = (mockStore.colaboradores || []).find(c => (c.id === Number(idColaborador) || c.IdColaborador === Number(idColaborador)));
      if (!colab) return null;

      const hijos = (mockStore.colaboradorHijos || []).filter(h => h.idColaborador === Number(idColaborador));
      const baja = (mockStore.colaboradorBajas || []).find(b => b.idColaborador === Number(idColaborador)) || null;
      let financieros = null;

      if (esAutorizadoFinanciero) {
        financieros = (mockStore.colaboradorDatosFinancieros || []).find(f => f.idColaborador === Number(idColaborador)) || null;
      }

      return {
        ...colab,
        hijos,
        baja,
        datosFinancieros: financieros
      };
    }

    // Consulta en Microsoft SQL Server DESARROLLO_O
    const request = pool.request();
    request.input('IdColaborador', idColaborador);

    // 1. Datos Maestros del Colaborador
    const colabQuery = `
      SELECT 
        c.IdColaborador,
        c.IdEmpresa,
        e.AliasEmpresa AS Empresa,
        e.NombreBaseDatos AS BaseDatosNomipaq,
        c.CodigoEmpleado,
        c.Subfijo,
        c.Nombre,
        c.ApellidoPaterno,
        c.ApellidoMaterno,
        c.NombreCompleto,
        c.CURP,
        c.RFC,
        c.NSS,
        c.Sexo,
        c.FechaNacimiento,
        c.EstadoCivil,
        c.Nacionalidad,
        c.Escolaridad,
        c.Email,
        c.EmailCorporativo,
        c.Telefono,
        c.Domicilio,
        c.Municipio,
        c.EstadoProvincia,
        c.CodigoPostal,
        c.FechaAlta,
        c.FechaReingreso,
        c.EstatusNomina,
        c.DiasDescanso,
        c.CentroCostos,
        c.TipoNomina,
        c.TipoContrato,
        c.PeriodicidadPago,
        c.FechaAltaImss,
        c.FechaEvaluacion,
        c.DomicilioLaboral,
        c.AvisarEmergencia,
        c.ParentescoEmergencia,
        c.TelefonoEmergencia,
        c.TipoSangre,
        c.AlergiasPadecimientos,
        c.Beneficiario,
        c.ParentescoBeneficiario,
        c.RfcBeneficiario,
        c.TieneInfonavit,
        c.TieneFonacot,
        c.FuenteReclutamiento,
        c.IdDepartamento,
        d.Nombre AS Departamento,
        c.IdPuesto,
        p.Nombre AS Puesto,
        c.IdJefeDirecto,
        j.NombreCompleto AS JefeDirectoNombre,
        c.IdAprobadorSegundo,
        j2.NombreCompleto AS SegundoAprobadorNombre,
        c.RolApp,
        c.JornadaLaboralDias,
        c.Activo,
        c.FechaUltimaSincronizacion
      FROM dbo.Colaboradores c
      LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
      LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
      LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
      LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
      LEFT JOIN dbo.Colaboradores j2 ON j2.IdColaborador = c.IdAprobadorSegundo
      WHERE c.IdColaborador = @IdColaborador;
    `;

    const colabRes = await request.query(colabQuery);
    if (!colabRes.recordset[0]) return null;

    const colaborador = colabRes.recordset[0];
    colaborador.emailCorporativo = colaborador.EmailCorporativo;
    colaborador.email_corporativo = colaborador.EmailCorporativo;

    // 2. Hijos
    const hijosRes = await pool.request()
      .input('IdColaborador', idColaborador)
      .query(`
        SELECT 
          IdHijo, NumeroHijo, Nombre, 
          CONVERT(VARCHAR(10), FechaNacimiento, 120) AS FechaNacimiento, 
          Sexo, FechaRegistro
        FROM dbo.ColaboradorHijos
        WHERE IdColaborador = @IdColaborador
        ORDER BY NumeroHijo ASC;
      `);
    colaborador.hijos = hijosRes.recordset;

    // 3. Bajas (si aplica)
    const bajaRes = await pool.request()
      .input('IdColaborador', idColaborador)
      .query(`
        SELECT TOP 1 
          IdBaja, FechaBaja, TipoBaja, Comentarios,
          RenunciaVoluntaria, ConvenioFiniquito, ConvenioConfidencialidad, FechaRegistro
        FROM dbo.ColaboradorBajas
        WHERE IdColaborador = @IdColaborador
        ORDER BY FechaBaja DESC;
      `);
    colaborador.baja = bajaRes.recordset[0] || null;

    // 4. Datos Financieros (Aislamiento confidencial)
    if (esAutorizadoFinanciero) {
      const finRes = await pool.request()
        .input('IdColaborador', idColaborador)
        .query(`
          SELECT 
            SalarioMensualNeto, SalarioDiarioReal, SalarioDiarioImss, SalarioDiarioIntegrado,
            InstitucionBancaria, NumeroCuenta, ClabeInterbancaria, FechaUltimaModificacion
          FROM dbo.ColaboradorDatosFinancieros
          WHERE IdColaborador = @IdColaborador;
        `);
      colaborador.datosFinancieros = finRes.recordset[0] || null;
    } else {
      colaborador.datosFinancieros = null; // Aislamiento garantizado
    }

    return colaborador;
  }

  /**
   * Actualiza los datos generales del colaborador
   */
  static async actualizar(idColaborador, campos) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      return { success: true, idColaborador };
    }

    // Normalizar claves y alias (ej. email_corporativo, emailCorporativo -> EmailCorporativo)
    const normalizados = { ...campos };
    if (normalizados.email_corporativo !== undefined && normalizados.EmailCorporativo === undefined) {
      normalizados.EmailCorporativo = normalizados.email_corporativo;
    }
    if (normalizados.emailCorporativo !== undefined && normalizados.EmailCorporativo === undefined) {
      normalizados.EmailCorporativo = normalizados.emailCorporativo;
    }
    if (normalizados.id_jefe_directo !== undefined && normalizados.IdJefeDirecto === undefined) {
      normalizados.IdJefeDirecto = normalizados.id_jefe_directo;
    }
    if (normalizados.idJefeDirecto !== undefined && normalizados.IdJefeDirecto === undefined) {
      normalizados.IdJefeDirecto = normalizados.idJefeDirecto;
    }
    if (normalizados.id_aprobador_segundo !== undefined && normalizados.IdAprobadorSegundo === undefined) {
      normalizados.IdAprobadorSegundo = normalizados.id_aprobador_segundo;
    }
    if (normalizados.idAprobadorSegundo !== undefined && normalizados.IdAprobadorSegundo === undefined) {
      normalizados.IdAprobadorSegundo = normalizados.idAprobadorSegundo;
    }
    if (normalizados.rol_app !== undefined && normalizados.RolApp === undefined) {
      normalizados.RolApp = normalizados.rol_app;
    }
    if (normalizados.rolApp !== undefined && normalizados.RolApp === undefined) {
      normalizados.RolApp = normalizados.rolApp;
    }

    if (typeof normalizados.EmailCorporativo === 'string') {
      normalizados.EmailCorporativo = normalizados.EmailCorporativo.trim().toLowerCase() || null;
    }

    const request = pool.request();
    request.input('IdColaborador', idColaborador);

    const asignaciones = [];
    const permitidos = [
      'Subfijo', 'NSS', 'Sexo', 'FechaNacimiento', 'EstadoCivil', 'Nacionalidad', 'Escolaridad',
      'Domicilio', 'Municipio', 'EstadoProvincia', 'CodigoPostal', 'Email', 'EmailCorporativo', 'Telefono',
      'DiasDescanso', 'CentroCostos', 'TipoNomina', 'TipoContrato', 'PeriodicidadPago',
      'FechaAltaImss', 'FechaEvaluacion', 'DomicilioLaboral',
      'AvisarEmergencia', 'ParentescoEmergencia', 'TelefonoEmergencia', 'TipoSangre', 'AlergiasPadecimientos',
      'Beneficiario', 'ParentescoBeneficiario', 'RfcBeneficiario', 'TieneInfonavit', 'TieneFonacot', 'FuenteReclutamiento',
      'IdJefeDirecto', 'IdAprobadorSegundo', 'RolApp'
    ];

    for (const key of Object.keys(normalizados)) {
      if (permitidos.includes(key) && normalizados[key] !== undefined) {
        request.input(key, normalizados[key]);
        asignaciones.push(`${key} = @${key}`);
      }
    }

    if (asignaciones.length === 0) return { success: true };

    asignaciones.push('FechaModificacion = SYSDATETIME()');

    const query = `
      UPDATE dbo.Colaboradores
      SET ${asignaciones.join(', ')}
      WHERE IdColaborador = @IdColaborador;
    `;

    await request.query(query);
    return { success: true, idColaborador };
  }

  /**
   * Gestión de Hijos (dbo.ColaboradorHijos)
   */
  static async obtenerHijos(idColaborador) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      return (mockStore.colaboradorHijos || []).filter(h => h.idColaborador === Number(idColaborador));
    }

    const request = pool.request();
    request.input('IdColaborador', Number(idColaborador));
    const result = await request.query(`
      SELECT 
        IdHijo, NumeroHijo, Nombre,
        CONVERT(VARCHAR(10), FechaNacimiento, 120) AS FechaNacimiento, 
        Sexo, FechaRegistro,
        CASE 
          WHEN FechaNacimiento IS NOT NULL THEN DATEDIFF(YEAR, FechaNacimiento, GETDATE()) - 
            CASE 
              WHEN (MONTH(FechaNacimiento) > MONTH(GETDATE())) 
                OR (MONTH(FechaNacimiento) = MONTH(GETDATE()) AND DAY(FechaNacimiento) > DAY(GETDATE())) 
              THEN 1 ELSE 0 
            END
          ELSE NULL 
        END AS EdadCalculada
      FROM dbo.ColaboradorHijos
      WHERE IdColaborador = @IdColaborador
      ORDER BY NumeroHijo ASC;
    `);
    return result.recordset;
  }

  static async agregarHijo(idColaborador, { numeroHijo, nombre, fechaNacimiento, sexo }) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      if (!mockStore.colaboradorHijos) mockStore.colaboradorHijos = [];
      const colabId = Number(idColaborador);
      const existentes = mockStore.colaboradorHijos.filter(h => h.idColaborador === colabId);
      const numFinal = (numeroHijo && Number(numeroHijo) > 0) 
        ? Number(numeroHijo) 
        : (existentes.reduce((max, h) => Math.max(max, h.NumeroHijo || h.numeroHijo || 0), 0) + 1);
      
      const nuevo = {
        IdHijo: Date.now(),
        IdColaborador: colabId,
        idColaborador: colabId,
        NumeroHijo: numFinal,
        numeroHijo: numFinal,
        Nombre: nombre ? String(nombre).trim() : null,
        nombre: nombre ? String(nombre).trim() : null,
        FechaNacimiento: fechaNacimiento || null,
        fechaNacimiento: fechaNacimiento || null,
        Sexo: sexo ? String(sexo).trim().toUpperCase() : 'M',
        sexo: sexo ? String(sexo).trim().toUpperCase() : 'M',
        FechaRegistro: new Date().toISOString()
      };
      mockStore.colaboradorHijos.push(nuevo);
      return { success: true };
    }

    const request = pool.request();
    request.input('IdColaborador', Number(idColaborador));
    request.input('NumeroHijo', (numeroHijo && Number(numeroHijo) > 0) ? Number(numeroHijo) : null);
    request.input('Nombre', nombre ? String(nombre).trim() : null);
    request.input('FechaNacimiento', fechaNacimiento || null);
    request.input('Sexo', sexo ? String(sexo).trim().toUpperCase() : null);

    const query = `
      DECLARE @NumFinal INT = @NumeroHijo;
      IF @NumFinal IS NULL OR @NumFinal <= 0
      BEGIN
        SELECT @NumFinal = ISNULL(MAX(NumeroHijo), 0) + 1 
        FROM dbo.ColaboradorHijos 
        WHERE IdColaborador = @IdColaborador;
      END

      MERGE dbo.ColaboradorHijos AS Target
      USING (SELECT @IdColaborador AS IdColaborador, @NumFinal AS NumeroHijo) AS Source
      ON (Target.IdColaborador = Source.IdColaborador AND Target.NumeroHijo = Source.NumeroHijo)
      WHEN MATCHED THEN
        UPDATE SET 
          Nombre = COALESCE(@Nombre, Target.Nombre),
          FechaNacimiento = @FechaNacimiento, 
          Sexo = @Sexo, 
          FechaRegistro = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (IdColaborador, NumeroHijo, Nombre, FechaNacimiento, Sexo)
        VALUES (@IdColaborador, @NumFinal, @Nombre, @FechaNacimiento, @Sexo);
    `;

    await request.query(query);
    return { success: true };
  }

  static async eliminarHijo(idColaborador, idHijo) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      mockStore.colaboradorHijos = (mockStore.colaboradorHijos || []).filter(h => 
        !(h.idColaborador === Number(idColaborador) && (h.idHijo === Number(idHijo) || h.IdHijo === Number(idHijo)))
      );
      return { success: true };
    }

    const request = pool.request();
    request.input('IdColaborador', Number(idColaborador));
    request.input('IdHijo', Number(idHijo));
    await request.query(`
      DELETE FROM dbo.ColaboradorHijos
      WHERE IdHijo = @IdHijo AND IdColaborador = @IdColaborador;
    `);
    return { success: true };
  }

  /**
   * Gestión de Datos Financieros (dbo.ColaboradorDatosFinancieros)
   */
  static async guardarDatosFinancieros(idColaborador, datos) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) return { success: true };

    const request = pool.request();
    request.input('IdColaborador', idColaborador);
    request.input('SalarioMensualNeto', datos.salarioMensualNeto || null);
    request.input('SalarioDiarioReal', datos.salarioDiarioReal || null);
    request.input('SalarioDiarioImss', datos.salarioDiarioImss || null);
    request.input('SalarioDiarioIntegrado', datos.salarioDiarioIntegrado || null);
    request.input('InstitucionBancaria', datos.institucionBancaria || null);
    request.input('NumeroCuenta', datos.numeroCuenta || null);
    request.input('ClabeInterbancaria', datos.clabeInterbancaria || null);

    const query = `
      MERGE dbo.ColaboradorDatosFinancieros AS Target
      USING (SELECT @IdColaborador AS IdColaborador) AS Source
      ON (Target.IdColaborador = Source.IdColaborador)
      WHEN MATCHED THEN
        UPDATE SET 
          SalarioMensualNeto = @SalarioMensualNeto,
          SalarioDiarioReal = @SalarioDiarioReal,
          SalarioDiarioImss = @SalarioDiarioImss,
          SalarioDiarioIntegrado = @SalarioDiarioIntegrado,
          InstitucionBancaria = @InstitucionBancaria,
          NumeroCuenta = @NumeroCuenta,
          ClabeInterbancaria = @ClabeInterbancaria,
          FechaUltimaModificacion = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          IdColaborador, SalarioMensualNeto, SalarioDiarioReal, SalarioDiarioImss,
          SalarioDiarioIntegrado, InstitucionBancaria, NumeroCuenta, ClabeInterbancaria
        )
        VALUES (
          @IdColaborador, @SalarioMensualNeto, @SalarioDiarioReal, @SalarioDiarioImss,
          @SalarioDiarioIntegrado, @InstitucionBancaria, @NumeroCuenta, @ClabeInterbancaria
        );
    `;

    await request.query(query);
    return { success: true };
  }

  /**
   * Registro de Baja Laboral (dbo.ColaboradorBajas)
   */
  static async registrarBaja(idColaborador, datos) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) return { success: true };

    const request = pool.request();
    request.input('IdColaborador', idColaborador);
    request.input('FechaBaja', datos.fechaBaja);
    request.input('TipoBaja', datos.tipoBaja || null);
    request.input('Comentarios', datos.comentarios || null);
    request.input('RenunciaVoluntaria', datos.renunciaVoluntaria || null);
    request.input('ConvenioFiniquito', datos.convenioFiniquito || null);
    request.input('ConvenioConfidencialidad', datos.convenioConfidencialidad || null);

    const query = `
      BEGIN TRANSACTION;
        INSERT INTO dbo.ColaboradorBajas (
          IdColaborador, FechaBaja, TipoBaja, Comentarios,
          RenunciaVoluntaria, ConvenioFiniquito, ConvenioConfidencialidad
        )
        VALUES (
          @IdColaborador, @FechaBaja, @TipoBaja, @Comentarios,
          @RenunciaVoluntaria, @ConvenioFiniquito, @ConvenioConfidencialidad
        );

        UPDATE dbo.Colaboradores
        SET Activo = 0, EstatusNomina = 'B'
        WHERE IdColaborador = @IdColaborador;
      COMMIT TRANSACTION;
    `;

    await request.query(query);
    return { success: true };
  }
}

module.exports = ColaboradorModel;
