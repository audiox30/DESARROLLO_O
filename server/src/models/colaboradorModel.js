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
        c.RolApp,
        c.JornadaLaboralDias,
        c.Activo,
        c.FechaUltimaSincronizacion
      FROM dbo.Colaboradores c
      LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
      LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
      LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
      LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
      WHERE c.IdColaborador = @IdColaborador;
    `;

    const colabRes = await request.query(colabQuery);
    if (!colabRes.recordset[0]) return null;

    const colaborador = colabRes.recordset[0];

    // 2. Hijos
    const hijosRes = await pool.request()
      .input('IdColaborador', idColaborador)
      .query(`
        SELECT IdHijo, NumeroHijo, FechaNacimiento, Sexo, FechaRegistro
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

    const request = pool.request();
    request.input('IdColaborador', idColaborador);

    const asignaciones = [];
    const permitidos = [
      'Subfijo', 'NSS', 'Sexo', 'FechaNacimiento', 'EstadoCivil', 'Nacionalidad', 'Escolaridad',
      'Domicilio', 'Municipio', 'EstadoProvincia', 'CodigoPostal', 'Email', 'Telefono',
      'DiasDescanso', 'CentroCostos', 'TipoNomina', 'TipoContrato', 'PeriodicidadPago',
      'FechaAltaImss', 'FechaEvaluacion', 'DomicilioLaboral',
      'AvisarEmergencia', 'ParentescoEmergencia', 'TelefonoEmergencia', 'TipoSangre', 'AlergiasPadecimientos',
      'Beneficiario', 'ParentescoBeneficiario', 'RfcBeneficiario', 'TieneInfonavit', 'TieneFonacot', 'FuenteReclutamiento',
      'IdJefeDirecto', 'RolApp'
    ];

    for (const key of Object.keys(campos)) {
      if (permitidos.includes(key) && campos[key] !== undefined) {
        request.input(key, campos[key]);
        asignaciones.push(`${key} = @${key}`);
      }
    }

    if (asignaciones.length === 0) return { success: true };

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
  static async agregarHijo(idColaborador, { numeroHijo, fechaNacimiento, sexo }) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) return { success: true };

    const request = pool.request();
    request.input('IdColaborador', idColaborador);
    request.input('NumeroHijo', numeroHijo);
    request.input('FechaNacimiento', fechaNacimiento || null);
    request.input('Sexo', sexo || null);

    const query = `
      MERGE dbo.ColaboradorHijos AS Target
      USING (SELECT @IdColaborador AS IdColaborador, @NumeroHijo AS NumeroHijo) AS Source
      ON (Target.IdColaborador = Source.IdColaborador AND Target.NumeroHijo = Source.NumeroHijo)
      WHEN MATCHED THEN
        UPDATE SET FechaNacimiento = @FechaNacimiento, Sexo = @Sexo, FechaRegistro = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (IdColaborador, NumeroHijo, FechaNacimiento, Sexo)
        VALUES (@IdColaborador, @NumeroHijo, @FechaNacimiento, @Sexo);
    `;

    await request.query(query);
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
