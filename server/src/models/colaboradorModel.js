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

      const jefeId = colab.idJefeDirecto || colab.IdJefeDirecto;
      const jColab = jefeId ? (mockStore.colaboradores || []).find(c => c.id === Number(jefeId)) : null;
      const jefeNombre = jColab ? (jColab.nombreCompleto || jColab.NombreCompleto) : (colab.NombreJefeDirecto || colab.JefeDirectoNombre || colab.jefeInmediato || null);

      const segundoId = colab.idAprobadorSegundo || colab.IdAprobadorSegundo;
      const gColab = segundoId ? (mockStore.colaboradores || []).find(c => c.id === Number(segundoId)) : null;
      const segundoNombre = gColab ? (gColab.nombreCompleto || gColab.NombreCompleto) : (colab.NombreGerenteSucursal || colab.SegundoAprobadorNombre || null);

      const finData = financieros || {
        InstitucionBancaria: 'BBVA',
        NumeroCuenta: '0123456789',
        ClabeInterbancaria: '012700001234567890'
      };

      return {
        ...colab,
        IdColaborador: colab.id || colab.IdColaborador,
        NombreCompleto: colab.nombreCompleto || colab.NombreCompleto,
        CodigoEmpleado: colab.codigoEmpleado || colab.CodigoEmpleado,
        Empresa: colab.empresa || colab.Empresa,
        Sucursal: colab.Sucursal || colab.sucursal || 'SAN LUIS',
        sucursal: colab.Sucursal || colab.sucursal || 'SAN LUIS',
        Departamento: colab.departamento || colab.Departamento,
        Puesto: colab.puesto || colab.Puesto,
        IdJefeDirecto: jefeId || null,
        NombreJefeDirecto: jefeNombre,
        JefeDirectoNombre: jefeNombre,
        IdAprobadorSegundo: segundoId || null,
        NombreGerenteSucursal: segundoNombre,
        SegundoAprobadorNombre: segundoNombre,
        EmailCorporativo: colab.emailCorporativo || colab.EmailCorporativo,
        emailCorporativo: colab.emailCorporativo || colab.EmailCorporativo,
        DiasDescanso: colab.diasDescanso || colab.DiasDescanso || 'DOMINGOS',
        RolApp: colab.rolApp || colab.RolApp,
        Activo: colab.activo !== undefined ? colab.activo : (colab.Activo !== undefined ? colab.Activo : true),
        Telefono: colab.telefono || colab.Telefono,
        AvisarEmergencia: colab.ContactoEmergenciaNombre || colab.avisarEmergencia || colab.AvisarEmergencia,
        ContactoEmergenciaNombre: colab.ContactoEmergenciaNombre || colab.avisarEmergencia || colab.AvisarEmergencia,
        ParentescoEmergencia: colab.ContactoEmergenciaParentesco || colab.parentescoEmergencia || colab.ParentescoEmergencia,
        ContactoEmergenciaParentesco: colab.ContactoEmergenciaParentesco || colab.parentescoEmergencia || colab.ParentescoEmergencia,
        TelefonoEmergencia: colab.ContactoEmergenciaTelefono || colab.telefonoEmergencia || colab.TelefonoEmergencia,
        ContactoEmergenciaTelefono: colab.ContactoEmergenciaTelefono || colab.telefonoEmergencia || colab.TelefonoEmergencia,
        TipoSangre: colab.tipoSangre || colab.TipoSangre,
        AlergiasPadecimientos: colab.PadecimientosMedicos || colab.alergiasPadecimientos || colab.AlergiasPadecimientos,
        PadecimientosMedicos: colab.PadecimientosMedicos || colab.alergiasPadecimientos || colab.AlergiasPadecimientos,
        FechaAlta: colab.fechaAlta || colab.FechaAlta,
        FechaRealContratacion: colab.fechaRealContratacion || colab.FechaRealContratacion,
        FechaNacimiento: colab.fechaNacimiento || colab.FechaNacimiento,
        CURP: colab.curp || colab.CURP,
        RFC: colab.rfc || colab.RFC,
        NSS: colab.nss || colab.NSS,
        Email: colab.email || colab.Email,
        EmailNomina: colab.email || colab.Email,
        TotalHijos: (hijos || []).length,
        totalHijos: (hijos || []).length,
        hijos,
        baja,
        datosFinancieros: finData,
        InstitucionBancaria: finData.InstitucionBancaria,
        NumeroCuenta: finData.NumeroCuenta,
        ClabeInterbancaria: finData.ClabeInterbancaria
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
        c.Sucursal,
        c.CURP,
        c.RFC,
        c.NSS,
        c.Sexo,
        c.Genero,
        c.FechaNacimiento,
        c.EstadoCivil,
        c.Nacionalidad,
        c.Escolaridad,
        c.Email,
        c.Email AS EmailNomina,
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
        c.FechaRealContratacion,
        c.TipoBaja,
        c.TallaCamisa,
        c.TallaPantalon,
        c.TallaCalzado,
        c.TallaChamarra,
        c.DomicilioLaboral,
        c.AvisarEmergencia,
        c.AvisarEmergencia AS ContactoEmergenciaNombre,
        c.ParentescoEmergencia,
        c.ParentescoEmergencia AS ContactoEmergenciaParentesco,
        c.TelefonoEmergencia,
        c.TelefonoEmergencia AS ContactoEmergenciaTelefono,
        c.TipoSangre,
        c.AlergiasPadecimientos,
        c.AlergiasPadecimientos AS PadecimientosMedicos,
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
        j.NombreCompleto AS NombreJefeDirecto,
        c.IdAprobadorSegundo,
        j2.NombreCompleto AS SegundoAprobadorNombre,
        j2.NombreCompleto AS NombreGerenteSucursal,
        c.RolApp,
        c.JornadaLaboralDias,
        c.Activo,
        c.FechaUltimaSincronizacion,
        df.InstitucionBancaria,
        df.NumeroCuenta,
        df.ClabeInterbancaria
      FROM dbo.Colaboradores c
      LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
      LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
      LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
      LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
      LEFT JOIN dbo.Colaboradores j2 ON j2.IdColaborador = c.IdAprobadorSegundo
      LEFT JOIN dbo.ColaboradorDatosFinancieros df ON df.IdColaborador = c.IdColaborador
      WHERE c.IdColaborador = @IdColaborador;
    `;

    const colabRes = await request.query(colabQuery);
    if (!colabRes.recordset[0]) return null;

    const colaborador = colabRes.recordset[0];
    if (!colaborador.Genero) {
      const curpVal = String(colaborador.CURP || '').trim().toUpperCase();
      if (curpVal.length >= 11) {
        const c11 = curpVal.charAt(10);
        if (c11 === 'M') colaborador.Genero = 'Mujer';
        else if (c11 === 'H') colaborador.Genero = 'Hombre';
        else colaborador.Genero = 'No especificado';
      } else {
        colaborador.Genero = 'No especificado';
      }
    }
    colaborador.genero = colaborador.Genero;
    colaborador.emailCorporativo = colaborador.EmailCorporativo;
    colaborador.email_corporativo = colaborador.EmailCorporativo;

    // 2. Hijos
    const hijosRes = await pool.request()
      .input('IdColaborador', idColaborador)
      .query(`
        SELECT 
          IdHijo, IdColaborador, NumeroHijo, Nombre, 
          CONVERT(VARCHAR(10), FechaNacimiento, 120) AS FechaNacimiento, 
          Sexo, FechaRegistro
        FROM dbo.ColaboradorHijos
        WHERE IdColaborador = @IdColaborador
        ORDER BY NumeroHijo ASC;
      `);
    colaborador.hijos = (hijosRes.recordset || []).map(h => ({
      IdHijo: h.IdHijo,
      idHijo: h.IdHijo,
      IdColaborador: h.IdColaborador,
      idColaborador: h.IdColaborador,
      NumeroHijo: h.NumeroHijo,
      numeroHijo: h.NumeroHijo,
      Nombre: h.Nombre,
      nombre: h.Nombre,
      FechaNacimiento: h.FechaNacimiento,
      fechaNacimiento: h.FechaNacimiento,
      Sexo: h.Sexo,
      sexo: h.Sexo,
      FechaRegistro: h.FechaRegistro,
      fechaRegistro: h.FechaRegistro
    }));

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
   * Obtiene exclusivamente los hijos de un colaborador
   */
  static async obtenerHijos(idColaborador) {
    const pool = await getLocalPool();
    if (!pool || isUsingMock()) {
      return (mockStore.colaboradorHijos || [])
        .filter(h => (h.idColaborador === Number(idColaborador) || h.IdColaborador === Number(idColaborador)))
        .map(h => ({
          IdHijo: h.idHijo || h.IdHijo,
          idHijo: h.idHijo || h.IdHijo,
          IdColaborador: h.idColaborador || h.IdColaborador,
          idColaborador: h.idColaborador || h.IdColaborador,
          NumeroHijo: h.numeroHijo || h.NumeroHijo,
          numeroHijo: h.numeroHijo || h.NumeroHijo,
          FechaNacimiento: h.fechaNacimiento || h.FechaNacimiento,
          fechaNacimiento: h.fechaNacimiento || h.FechaNacimiento,
          Sexo: h.sexo || h.Sexo,
          sexo: h.sexo || h.Sexo,
          FechaRegistro: h.fechaRegistro || h.FechaRegistro
        }));
    }

    const res = await pool.request()
      .input('IdColaborador', idColaborador)
      .query(`
        SELECT IdHijo, IdColaborador, NumeroHijo, FechaNacimiento, Sexo, FechaRegistro
        FROM dbo.ColaboradorHijos
        WHERE IdColaborador = @IdColaborador
        ORDER BY NumeroHijo ASC;
      `);

    return (res.recordset || []).map(h => ({
      IdHijo: h.IdHijo,
      idHijo: h.IdHijo,
      IdColaborador: h.IdColaborador,
      idColaborador: h.IdColaborador,
      NumeroHijo: h.NumeroHijo,
      numeroHijo: h.NumeroHijo,
      FechaNacimiento: h.FechaNacimiento,
      fechaNacimiento: h.FechaNacimiento,
      Sexo: h.Sexo,
      sexo: h.Sexo,
      FechaRegistro: h.FechaRegistro,
      fechaRegistro: h.FechaRegistro
    }));
  }

  /**
   * Actualiza los datos generales del colaborador
   */
  static async actualizar(idColaborador, campos) {
    const pool = await getLocalPool();

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

    // Sanitización Segundo Aprobador (IdAprobadorSegundo)
    if (normalizados.IdAprobadorSegundo === '' || normalizados.IdAprobadorSegundo === 'none' || normalizados.IdAprobadorSegundo === null) {
      normalizados.IdAprobadorSegundo = null;
    } else if (normalizados.IdAprobadorSegundo !== undefined) {
      const numSec = Number(normalizados.IdAprobadorSegundo);
      normalizados.IdAprobadorSegundo = (!isNaN(numSec) && numSec > 0) ? numSec : null;
    }

    // Sanitización Jefe Directo (IdJefeDirecto)
    if (normalizados.IdJefeDirecto === '' || normalizados.IdJefeDirecto === 'none' || normalizados.IdJefeDirecto === null) {
      normalizados.IdJefeDirecto = null;
    } else if (normalizados.IdJefeDirecto !== undefined) {
      const numJefe = Number(normalizados.IdJefeDirecto);
      normalizados.IdJefeDirecto = (!isNaN(numJefe) && numJefe > 0) ? numJefe : null;
    }

    // Sanitización Días de Descanso (DiasDescanso)
    if (Array.isArray(normalizados.diasDescanso)) {
      normalizados.DiasDescanso = normalizados.diasDescanso.length > 0 ? normalizados.diasDescanso.join(', ') : 'DOMINGO';
    } else if (Array.isArray(normalizados.DiasDescanso)) {
      normalizados.DiasDescanso = normalizados.DiasDescanso.length > 0 ? normalizados.DiasDescanso.join(', ') : 'DOMINGO';
    } else if (typeof normalizados.DiasDescanso === 'string') {
      normalizados.DiasDescanso = normalizados.DiasDescanso.trim() ? normalizados.DiasDescanso.trim().toUpperCase() : 'DOMINGO';
    }

    // Sanitización Correo Corporativo (EmailCorporativo)
    if (typeof normalizados.EmailCorporativo === 'string') {
      normalizados.EmailCorporativo = normalizados.EmailCorporativo.trim().toLowerCase() || null;
    }

    if (!pool || isUsingMock()) {
      const mockStore = require('../data/mockStore');
      const idx = (mockStore.colaboradores || []).findIndex(c => (c.id === Number(idColaborador) || c.IdColaborador === Number(idColaborador)));
      if (idx !== -1) {
        mockStore.colaboradores[idx] = {
          ...mockStore.colaboradores[idx],
          ...normalizados,
          IdAprobadorSegundo: normalizados.IdAprobadorSegundo,
          IdJefeDirecto: normalizados.IdJefeDirecto,
          EmailCorporativo: normalizados.EmailCorporativo,
          DiasDescanso: normalizados.DiasDescanso,
          FechaModificacion: new Date().toISOString()
        };
      }
      return { success: true, idColaborador };
    }

    // Asegurar que las columnas requeridas existan en la tabla Colaboradores
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'EmailCorporativo')
          ALTER TABLE dbo.Colaboradores ADD EmailCorporativo VARCHAR(150) NULL;

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'IdAprobadorSegundo')
          ALTER TABLE dbo.Colaboradores ADD IdAprobadorSegundo INT NULL;

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'DiasDescanso')
          ALTER TABLE dbo.Colaboradores ADD DiasDescanso VARCHAR(100) NULL;
      ELSE
          ALTER TABLE dbo.Colaboradores ALTER COLUMN DiasDescanso VARCHAR(100) NULL;

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'FechaRealContratacion')
          ALTER TABLE dbo.Colaboradores ADD FechaRealContratacion DATE NULL;
    `);

    const request = pool.request();
    request.input('IdColaborador', Number(idColaborador));

    const asignaciones = [];
    const permitidos = [
      'Subfijo', 'NSS', 'Sexo', 'FechaNacimiento', 'EstadoCivil', 'Nacionalidad', 'Escolaridad',
      'Domicilio', 'Municipio', 'EstadoProvincia', 'CodigoPostal', 'Email', 'EmailCorporativo', 'Telefono',
      'DiasDescanso', 'CentroCostos', 'TipoNomina', 'TipoContrato', 'PeriodicidadPago',
      'FechaAltaImss', 'FechaEvaluacion', 'FechaRealContratacion', 'DomicilioLaboral',
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
        ISNULL(Parentesco, 'Hijo(a)') AS Parentesco,
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

  static async agregarHijo(idColaborador, { idHijo, numeroHijo, nombre, parentesco, fechaNacimiento, sexo }) {
    const pool = await getLocalPool();
    const parentescoFinal = (parentesco && String(parentesco).trim()) ? String(parentesco).trim() : 'Hijo(a)';

    if (!pool || isUsingMock()) {
      if (!mockStore.colaboradorHijos) mockStore.colaboradorHijos = [];
      const colabId = Number(idColaborador);
      const existentes = mockStore.colaboradorHijos.filter(h => h.idColaborador === colabId);
      const numFinal = (numeroHijo && Number(numeroHijo) > 0) 
        ? Number(numeroHijo) 
        : (existentes.reduce((max, h) => Math.max(max, h.NumeroHijo || h.numeroHijo || 0), 0) + 1);
      
      const nuevo = {
        IdHijo: idHijo || Date.now(),
        idHijo: idHijo || Date.now(),
        IdColaborador: colabId,
        idColaborador: colabId,
        NumeroHijo: numFinal,
        numeroHijo: numFinal,
        Nombre: nombre ? String(nombre).trim() : null,
        nombre: nombre ? String(nombre).trim() : null,
        Parentesco: parentescoFinal,
        parentesco: parentescoFinal,
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
    request.input('Parentesco', parentescoFinal);
    request.input('FechaNacimiento', fechaNacimiento || null);
    request.input('Sexo', (sexo ? String(sexo).trim().toUpperCase().substring(0, 1) : null));

    if (idHijo) {
      request.input('IdHijo', Number(idHijo));
      await request.query(`
        UPDATE dbo.ColaboradorHijos
        SET Nombre = COALESCE(@Nombre, Nombre),
            Parentesco = COALESCE(@Parentesco, Parentesco),
            FechaNacimiento = @FechaNacimiento,
            Sexo = @Sexo,
            FechaRegistro = SYSUTCDATETIME()
        WHERE IdHijo = @IdHijo AND IdColaborador = @IdColaborador;
      `);
      return { success: true, idHijo };
    }

    const query = `
      DECLARE @NumFinal INT = @NumeroHijo;
      IF @NumFinal IS NULL OR @NumFinal <= 0 OR EXISTS (SELECT 1 FROM dbo.ColaboradorHijos WHERE IdColaborador = @IdColaborador AND NumeroHijo = @NumFinal)
      BEGIN
        SELECT @NumFinal = ISNULL((SELECT MAX(NumeroHijo) FROM dbo.ColaboradorHijos WHERE IdColaborador = @IdColaborador), 0) + 1;
      END

      INSERT INTO dbo.ColaboradorHijos (IdColaborador, NumeroHijo, Nombre, Parentesco, FechaNacimiento, Sexo, FechaRegistro)
      VALUES (@IdColaborador, @NumFinal, @Nombre, @Parentesco, @FechaNacimiento, @Sexo, SYSUTCDATETIME());
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
