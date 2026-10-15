const bcrypt = require('bcryptjs');
const { getLocalPool, isUsingMock } = require('../config/database');

const adminColaboradoresController = {
  /**
   * GET /api/admin/colaboradores
   * Catálogo administrativo de colaboradores con filtros completos
   */
  getColaboradoresAdmin: async (req, res) => {
    try {
      const { 
        search, 
        empresa, 
        empresa_id,
        empresaId,
        departamento, 
        sucursal, 
        estatus = 'activos', 
        page = 1, 
        limit = 50 
      } = req.query;

      const pool = await getLocalPool();

      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        let list = [...(mockStore.colaboradores || [])].map(c => {
          const numHijos = (mockStore.colaboradorHijos || []).filter(h => (h.idColaborador === c.id || h.IdColaborador === c.id)).length;
          const isActivo = c.Activo !== false && c.activo !== false;
          return {
            ...c,
            IdColaborador: c.id || c.IdColaborador,
            id: c.id || c.IdColaborador,
            CodigoEmpleado: c.codigoEmpleado || c.CodigoEmpleado,
            NombreCompleto: c.nombreCompleto || c.NombreCompleto,
            Empresa: c.empresa || c.Empresa,
            Sucursal: c.Sucursal || c.sucursal || 'SAN LUIS',
            sucursal: c.Sucursal || c.sucursal || 'SAN LUIS',
            Departamento: c.departamento || c.Departamento,
            Puesto: c.puesto || c.Puesto,
            IdJefeDirecto: c.idJefeDirecto || c.IdJefeDirecto || null,
            NombreJefeDirecto: c.NombreJefeDirecto || c.JefeDirectoNombre || null,
            JefeDirectoNombre: c.NombreJefeDirecto || c.JefeDirectoNombre || null,
            IdAprobadorSegundo: c.idAprobadorSegundo || c.IdAprobadorSegundo || null,
            NombreGerenteSucursal: c.NombreGerenteSucursal || c.SegundoAprobadorNombre || null,
            SegundoAprobadorNombre: c.NombreGerenteSucursal || c.SegundoAprobadorNombre || null,
            EmailNomina: c.email || c.Email || null,
            EmailCorporativo: c.emailCorporativo || c.EmailCorporativo || null,
            CURP: c.curp || c.CURP || null,
            RFC: c.rfc || c.RFC || null,
            NSS: c.nss || c.NSS || null,
            Sexo: c.sexo || c.Sexo || null,
            Genero: c.genero || c.Genero || null,
            FechaAlta: c.fechaAlta || c.FechaAlta || null,
            FechaNacimiento: c.fechaNacimiento || c.FechaNacimiento || null,
            EstadoCivil: c.estadoCivil || c.EstadoCivil || null,
            Nacionalidad: c.nacionalidad || c.Nacionalidad || 'MEXICANA',
            Escolaridad: c.escolaridad || c.Escolaridad || null,
            DiasDescanso: c.diasDescanso || c.DiasDescanso || 'DOMINGOS',
            AvisarEmergencia: c.avisarEmergencia || c.AvisarEmergencia || null,
            ContactoEmergenciaNombre: c.avisarEmergencia || c.AvisarEmergencia || null,
            ParentescoEmergencia: c.parentescoEmergencia || c.ParentescoEmergencia || null,
            ContactoEmergenciaParentesco: c.parentescoEmergencia || c.ParentescoEmergencia || null,
            TelefonoEmergencia: c.telefonoEmergencia || c.TelefonoEmergencia || null,
            ContactoEmergenciaTelefono: c.telefonoEmergencia || c.TelefonoEmergencia || null,
            TipoSangre: c.tipoSangre || c.TipoSangre || null,
            AlergiasPadecimientos: c.alergiasPadecimientos || c.AlergiasPadecimientos || null,
            PadecimientosMedicos: c.alergiasPadecimientos || c.AlergiasPadecimientos || null,
            Activo: isActivo,
            activo: isActivo,
            EstatusNomina: isActivo ? 'ALTA' : 'BAJA',
            estatusNomina: isActivo ? 'ALTA' : 'BAJA',
            RolApp: c.rolApp || c.rol || 'COLABORADOR',
            Telefono: c.telefono || '',
            TotalHijos: numHijos,
            totalHijos: numHijos
          };
        });

        const estatusNorm = String(estatus || '').trim().toLowerCase();
        if (['activos', 'activo', '1', 'alta', 'altas'].includes(estatusNorm)) {
          list = list.filter(c => c.Activo);
        } else if (['bajas', 'baja', '0', 'inactivos', 'inactivo'].includes(estatusNorm)) {
          list = list.filter(c => !c.Activo);
        }

        if (search && search.trim()) {
          const s = search.toLowerCase();
          list = list.filter(c => 
            (c.NombreCompleto && c.NombreCompleto.toLowerCase().includes(s)) || 
            (c.CodigoEmpleado && c.CodigoEmpleado.toLowerCase().includes(s))
          );
        }

        if (empresa_id || empresa) {
          const target = String(empresa_id || empresa).toLowerCase();
          list = list.filter(c => String(c.idEmpresa) === target || (c.Empresa && c.Empresa.toLowerCase().includes(target)));
        }

        if (departamento) {
          list = list.filter(c => c.Departamento && c.Departamento.toLowerCase().includes(departamento.toLowerCase()));
        }

        if (sucursal) {
          list = list.filter(c => c.Sucursal && c.Sucursal.toLowerCase().includes(sucursal.toLowerCase()));
        }

        // Ordenamiento Alfabético Obligatorio A - Z por Apellidos
        list.sort((a, b) => {
          const apA = (a.apellidoPaterno || a.ApellidoPaterno || '').toUpperCase();
          const apB = (b.apellidoPaterno || b.ApellidoPaterno || '').toUpperCase();
          if (apA !== apB) return apA.localeCompare(apB, 'es', { sensitivity: 'base' });
          const amA = (a.apellidoMaterno || a.ApellidoMaterno || '').toUpperCase();
          const amB = (b.apellidoMaterno || b.ApellidoMaterno || '').toUpperCase();
          if (amA !== amB) return amA.localeCompare(amB, 'es', { sensitivity: 'base' });
          const nomA = (a.nombre || a.Nombre || '').toUpperCase();
          const nomB = (b.nombre || b.Nombre || '').toUpperCase();
          return nomA.localeCompare(nomB, 'es', { sensitivity: 'base' });
        });

        const total = list.length;
        const offset = (Number(page) - 1) * Number(limit);
        const paginated = list.slice(offset, offset + Number(limit));

        return res.json({
          success: true,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
          data: paginated
        });
      }

      const request = pool.request();
      let whereClauses = [];

      // Filtro de estatus estrictamente basado en c.Activo
      const estatusNorm = String(estatus || '').trim().toLowerCase();
      if (['activos', 'activo', '1', 'alta', 'altas'].includes(estatusNorm)) {
        whereClauses.push('c.Activo = 1');
      } else if (['bajas', 'baja', '0', 'inactivos', 'inactivo'].includes(estatusNorm)) {
        whereClauses.push('c.Activo = 0');
      }
      // Si el filtro recibe 'todos', o vacío/null: No agregar condición de estatus (mostrar activos y bajas)

      // Buscador por Nombre, Nómina, CURP o RFC
      if (search && search.trim()) {
        request.input('Search', `%${search.trim()}%`);
        whereClauses.push('(c.NombreCompleto LIKE @Search OR c.CodigoEmpleado LIKE @Search OR c.CURP LIKE @Search OR c.RFC LIKE @Search)');
      }

      // Filtro de Empresa por ID o comparación flexible
      const targetEmpresaId = empresa_id || empresaId || (!isNaN(empresa) && empresa !== '' && empresa !== null ? Number(empresa) : null);
      if (targetEmpresaId) {
        request.input('IdEmpresa', Number(targetEmpresaId));
        whereClauses.push('(c.IdEmpresa = @IdEmpresa OR e.IdEmpresa = @IdEmpresa)');
      } else if (empresa && empresa.trim()) {
        const empVal = empresa.trim();
        request.input('EmpresaVal', empVal);
        request.input('EmpresaLike', `%${empVal}%`);
        whereClauses.push('(c.Empresa LIKE @EmpresaLike OR @EmpresaVal LIKE \'%\' + c.Empresa + \'%\' OR e.AliasEmpresa LIKE @EmpresaLike OR @EmpresaVal LIKE \'%\' + e.AliasEmpresa + \'%\')');
      }

      // Filtro por Departamento
      if (departamento && departamento.trim()) {
        request.input('Depto', `%${departamento.trim()}%`);
        whereClauses.push('d.Nombre LIKE @Depto');
      }

      // Filtro por Sucursal
      if (sucursal && sucursal.trim()) {
        request.input('Sucursal', `%${sucursal.trim()}%`);
        whereClauses.push('c.Sucursal LIKE @Sucursal');
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT 
          c.IdColaborador AS id, c.IdColaborador, c.IdEmpresa,
          e.AliasEmpresa AS Empresa, e.NombreBaseDatos,
          c.CodigoEmpleado, c.Subfijo,
          CASE 
            WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
                   CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
            ELSE c.NombreCompleto
          END AS NombreCompleto,
          c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno,
          c.CURP, c.RFC, c.NSS, c.Sexo, c.Genero, c.Email, c.Email AS EmailNomina, c.EmailCorporativo, c.Telefono,
          c.Sucursal, c.JornadaLaboralDias,
          d.IdDepartamento, d.Nombre AS Departamento,
          p.IdPuesto, p.Nombre AS Puesto,
          c.IdJefeDirecto, 
          CASE 
            WHEN j.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(j.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(j.ApellidoPaterno)) + 
                   CASE WHEN j.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(j.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(j.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(j.Nombre, '')))
            ELSE j.NombreCompleto
          END AS JefeDirectoNombre,
          CASE 
            WHEN j.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(j.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(j.ApellidoPaterno)) + 
                   CASE WHEN j.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(j.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(j.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(j.Nombre, '')))
            ELSE j.NombreCompleto
          END AS NombreJefeDirecto,
          c.IdAprobadorSegundo, 
          CASE 
            WHEN j2.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(j2.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(j2.ApellidoPaterno)) + 
                   CASE WHEN j2.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(j2.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(j2.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(j2.Nombre, '')))
            ELSE j2.NombreCompleto
          END AS SegundoAprobadorNombre,
          CASE 
            WHEN j2.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(j2.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(j2.ApellidoPaterno)) + 
                   CASE WHEN j2.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(j2.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(j2.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(j2.Nombre, '')))
            ELSE j2.NombreCompleto
          END AS NombreGerenteSucursal,
          c.RolApp, c.Activo, c.EstatusNomina, c.FechaAlta, c.FechaReingreso,
          c.DiasDescanso, c.CentroCostos, c.TipoNomina,
          c.TipoContrato, c.PeriodicidadPago, c.FechaAltaImss, c.FechaEvaluacion, c.FechaRealContratacion,
          c.FechaNacimiento, c.EstadoCivil, c.Nacionalidad, c.Escolaridad,
          c.AvisarEmergencia, c.AvisarEmergencia AS ContactoEmergenciaNombre,
          c.ParentescoEmergencia, c.ParentescoEmergencia AS ContactoEmergenciaParentesco,
          c.TelefonoEmergencia, c.TelefonoEmergencia AS ContactoEmergenciaTelefono,
          c.TipoSangre, 
          c.AlergiasPadecimientos, c.AlergiasPadecimientos AS PadecimientosMedicos,
          fin.InstitucionBancaria, fin.NumeroCuenta, fin.ClabeInterbancaria,
          (SELECT COUNT(*) FROM dbo.ColaboradorHijos h WHERE h.IdColaborador = c.IdColaborador) AS TotalHijos,
          u.IdUsuario, u.Username, u.DebeCambiarPassword,
          u.Activo AS UsuarioActivo, u.UltimoAcceso
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
        LEFT JOIN dbo.Colaboradores j2 ON j2.IdColaborador = c.IdAprobadorSegundo
        LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
        LEFT JOIN dbo.ColaboradorDatosFinancieros fin ON fin.IdColaborador = c.IdColaborador
        ${whereSQL}
        ORDER BY c.ApellidoPaterno ASC, c.ApellidoMaterno ASC, c.Nombre ASC;
      `;

      const result = await request.query(query);
      const total = result.recordset.length;
      const offset = (Number(page) - 1) * Number(limit);
      const paginated = result.recordset.slice(offset, offset + Number(limit));

      return res.json({
        success: true,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        data: paginated
      });
    } catch (err) {
      console.error('[adminColaboradores.getColaboradoresAdmin]', err);
      res.status(500).json({ error: 'Error al consultar catálogo administrativo de colaboradores.' });
    }
  },

  /**
   * PUT /api/admin/colaboradores/:id
   * Edita campos complementarios protegidos contra sincronización NOMIPAQ
   */
  updateComplementarios: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        idJefeDirecto,
        idAprobadorSegundo,
        emailCorporativo,
        email_corporativo,
        EmailCorporativo,
        diasDescanso,
        rolApp,
        fechaRealContratacion,
        FechaRealContratacion,
        centroCostos,
        CentroCostos,
        tipoNomina,
        TipoNomina,
        tipoContrato,
        TipoContrato,
        periodicidadPago,
        PeriodicidadPago,
        fechaAltaImss,
        FechaAltaImss,
        fechaEvaluacion,
        FechaEvaluacion,
        telefono,
        avisarEmergencia,
        parentescoEmergencia,
        telefonoEmergencia,
        tipoSangre,
        alergiasPadecimientos
      } = req.body;

      // 1. Sanitización de parámetros:
      // Segundo Aprobador (IdAprobadorSegundo)
      let parsedAprobadorSegundo = null;
      if (idAprobadorSegundo !== undefined && idAprobadorSegundo !== null && idAprobadorSegundo !== '' && idAprobadorSegundo !== 'none') {
        const numSegundo = Number(idAprobadorSegundo);
        if (!isNaN(numSegundo) && numSegundo > 0) {
          parsedAprobadorSegundo = numSegundo;
        }
      }

      // Jefe Directo (IdJefeDirecto)
      let parsedJefeDirecto = null;
      if (idJefeDirecto !== undefined && idJefeDirecto !== null && idJefeDirecto !== '' && idJefeDirecto !== 'none') {
        const numJefe = Number(idJefeDirecto);
        if (!isNaN(numJefe) && numJefe > 0) {
          parsedJefeDirecto = numJefe;
        }
      }

      // Validar que el colaborador no sea su propio jefe o segundo aprobador
      if (parsedJefeDirecto && parsedJefeDirecto === Number(id)) {
        return res.status(400).json({ error: 'Un colaborador no puede ser su propio jefe directo.' });
      }
      if (parsedAprobadorSegundo && parsedAprobadorSegundo === Number(id)) {
        return res.status(400).json({ error: 'Un colaborador no puede ser su propio segundo aprobador.' });
      }

      // Días de Descanso Semanal (DiasDescanso)
      let diasDescansoStr = 'DOMINGO';
      if (Array.isArray(diasDescanso)) {
        diasDescansoStr = diasDescanso.length > 0 ? diasDescanso.join(', ') : 'DOMINGO';
      } else if (typeof diasDescanso === 'string' && diasDescanso.trim()) {
        diasDescansoStr = diasDescanso.trim().toUpperCase();
      }

      // Correo Corporativo (EmailCorporativo)
      const rawEmailCorp = emailCorporativo !== undefined ? emailCorporativo : (email_corporativo !== undefined ? email_corporativo : EmailCorporativo);
      const emailCorpSanitizado = (rawEmailCorp && typeof rawEmailCorp === 'string' && rawEmailCorp.trim())
        ? rawEmailCorp.trim().toLowerCase()
        : null;

      const telefonoSanitizado = (telefono && typeof telefono === 'string' && telefono.trim()) ? telefono.trim() : null;
      const avisarEmergenciaSanitizado = (avisarEmergencia && typeof avisarEmergencia === 'string' && avisarEmergencia.trim()) ? avisarEmergencia.trim() : null;
      const parentescoEmergenciaSanitizado = (parentescoEmergencia && typeof parentescoEmergencia === 'string' && parentescoEmergencia.trim()) ? parentescoEmergencia.trim() : null;
      const telefonoEmergenciaSanitizado = (telefonoEmergencia && typeof telefonoEmergencia === 'string' && telefonoEmergencia.trim()) ? telefonoEmergencia.trim() : null;
      const tipoSangreSanitizado = (tipoSangre && typeof tipoSangre === 'string' && tipoSangre.trim()) ? tipoSangre.trim() : null;
      const alergiasSanitizado = (alergiasPadecimientos && typeof alergiasPadecimientos === 'string' && alergiasPadecimientos.trim()) ? alergiasPadecimientos.trim() : null;
      const rolAppFinal = rolApp ? String(rolApp).trim().toUpperCase() : 'COLABORADOR';

      // Campos laborales y de contratación (DESARROLLO_O)
      const rawFechaReal = fechaRealContratacion !== undefined ? fechaRealContratacion : FechaRealContratacion;
      const fechaRealSanitizada = (rawFechaReal && typeof rawFechaReal === 'string' && rawFechaReal.trim())
        ? rawFechaReal.trim().substring(0, 10)
        : null;

      const rawCentroCostos = centroCostos !== undefined ? centroCostos : CentroCostos;
      const centroCostosSanitizado = (rawCentroCostos && typeof rawCentroCostos === 'string' && rawCentroCostos.trim())
        ? rawCentroCostos.trim()
        : null;

      const rawTipoNomina = tipoNomina !== undefined ? tipoNomina : TipoNomina;
      const tipoNominaSanitizado = (rawTipoNomina && typeof rawTipoNomina === 'string' && rawTipoNomina.trim())
        ? rawTipoNomina.trim()
        : null;

      const rawTipoContrato = tipoContrato !== undefined ? tipoContrato : TipoContrato;
      const tipoContratoSanitizado = (rawTipoContrato && typeof rawTipoContrato === 'string' && rawTipoContrato.trim())
        ? rawTipoContrato.trim()
        : null;

      const rawPeriodicidadPago = periodicidadPago !== undefined ? periodicidadPago : PeriodicidadPago;
      const periodicidadPagoSanitizado = (rawPeriodicidadPago && typeof rawPeriodicidadPago === 'string' && rawPeriodicidadPago.trim())
        ? rawPeriodicidadPago.trim()
        : null;

      const rawFechaAltaImss = fechaAltaImss !== undefined ? fechaAltaImss : FechaAltaImss;
      const fechaAltaImssSanitizada = (rawFechaAltaImss && typeof rawFechaAltaImss === 'string' && rawFechaAltaImss.trim())
        ? rawFechaAltaImss.trim().substring(0, 10)
        : null;

      const rawFechaEvaluacion = fechaEvaluacion !== undefined ? fechaEvaluacion : FechaEvaluacion;
      const fechaEvaluacionSanitizada = (rawFechaEvaluacion && typeof rawFechaEvaluacion === 'string' && rawFechaEvaluacion.trim())
        ? rawFechaEvaluacion.trim().substring(0, 10)
        : null;

      const pool = await getLocalPool();

      // MODO FALLBACK (Motor Local / Mock)
      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        const colabIndex = (mockStore.colaboradores || []).findIndex(c => (c.id === Number(id) || c.IdColaborador === Number(id)));
        if (colabIndex === -1) {
          return res.status(404).json({ error: 'Colaborador no encontrado.' });
        }

        const colab = mockStore.colaboradores[colabIndex];
        const jefeSel = (mockStore.colaboradores || []).find(j => (j.id === parsedJefeDirecto || j.IdColaborador === parsedJefeDirecto));
        const segundoSel = (mockStore.colaboradores || []).find(j => (j.id === parsedAprobadorSegundo || j.IdColaborador === parsedAprobadorSegundo));

        mockStore.colaboradores[colabIndex] = {
          ...colab,
          IdJefeDirecto: parsedJefeDirecto,
          idJefeDirecto: parsedJefeDirecto,
          JefeDirectoNombre: jefeSel ? (jefeSel.NombreCompleto || `${jefeSel.nombre || ''} ${jefeSel.apellidoPaterno || ''}`) : null,
          IdAprobadorSegundo: parsedAprobadorSegundo,
          idAprobadorSegundo: parsedAprobadorSegundo,
          SegundoAprobadorNombre: segundoSel ? (segundoSel.NombreCompleto || `${segundoSel.nombre || ''} ${segundoSel.apellidoPaterno || ''}`) : null,
          EmailCorporativo: emailCorpSanitizado,
          emailCorporativo: emailCorpSanitizado,
          email_corporativo: emailCorpSanitizado,
          DiasDescanso: diasDescansoStr,
          diasDescanso: diasDescansoStr,
          RolApp: rolAppFinal,
          rolApp: rolAppFinal,
          FechaRealContratacion: fechaRealSanitizada,
          fechaRealContratacion: fechaRealSanitizada,
          CentroCostos: centroCostosSanitizado,
          centroCostos: centroCostosSanitizado,
          TipoNomina: tipoNominaSanitizado,
          tipoNomina: tipoNominaSanitizado,
          TipoContrato: tipoContratoSanitizado,
          tipoContrato: tipoContratoSanitizado,
          PeriodicidadPago: periodicidadPagoSanitizado,
          periodicidadPago: periodicidadPagoSanitizado,
          FechaAltaImss: fechaAltaImssSanitizada,
          fechaAltaImss: fechaAltaImssSanitizada,
          FechaEvaluacion: fechaEvaluacionSanitizada,
          fechaEvaluacion: fechaEvaluacionSanitizada,
          Telefono: telefonoSanitizado !== null ? telefonoSanitizado : colab.Telefono,
          telefono: telefonoSanitizado !== null ? telefonoSanitizado : colab.telefono,
          AvisarEmergencia: avisarEmergenciaSanitizado,
          avisarEmergencia: avisarEmergenciaSanitizado,
          ParentescoEmergencia: parentescoEmergenciaSanitizado,
          parentescoEmergencia: parentescoEmergenciaSanitizado,
          TelefonoEmergencia: telefonoEmergenciaSanitizado,
          telefonoEmergencia: telefonoEmergenciaSanitizado,
          TipoSangre: tipoSangreSanitizado,
          tipoSangre: tipoSangreSanitizado,
          AlergiasPadecimientos: alergiasSanitizado,
          alergiasPadecimientos: alergiasSanitizado,
          FechaModificacion: new Date().toISOString()
        };

        // Si el usuario existe en mockStore.usuarios, sincronizar RolApp
        if (mockStore.usuarios) {
          const userIdx = mockStore.usuarios.findIndex(u => (u.idColaborador === Number(id) || u.IdColaborador === Number(id)));
          if (userIdx !== -1 && mockStore.usuarios[userIdx].rolApp !== 'SUPERADMIN' && mockStore.usuarios[userIdx].rolApp !== 'SISTEMAS') {
            mockStore.usuarios[userIdx].rolApp = rolAppFinal;
          }
        }

        return res.json({
          success: true,
          message: 'Información complementaria actualizada y protegida contra sincronización NOMIPAQ.'
        });
      }

      // MODO SQL SERVER
      // Validar existencia de colaborador
      const checkColab = await pool.request()
        .input('Id', Number(id))
        .query('SELECT IdColaborador, NombreCompleto, RolApp FROM dbo.Colaboradores WHERE IdColaborador = @Id');

      if (!checkColab.recordset[0]) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
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
      request.input('Id', Number(id));
      request.input('IdJefeDirecto', parsedJefeDirecto);
      request.input('IdAprobadorSegundo', parsedAprobadorSegundo);
      request.input('EmailCorporativo', emailCorpSanitizado);
      request.input('DiasDescanso', diasDescansoStr);
      request.input('RolApp', rolAppFinal);
      request.input('CentroCostos', centroCostosSanitizado);
      request.input('TipoNomina', tipoNominaSanitizado);
      request.input('TipoContrato', tipoContratoSanitizado);
      request.input('PeriodicidadPago', periodicidadPagoSanitizado);
      request.input('FechaAltaImss', fechaAltaImssSanitizada);
      request.input('FechaEvaluacion', fechaEvaluacionSanitizada);
      request.input('FechaRealContratacion', fechaRealSanitizada);
      request.input('Telefono', telefonoSanitizado);
      request.input('AvisarEmergencia', avisarEmergenciaSanitizado);
      request.input('ParentescoEmergencia', parentescoEmergenciaSanitizado);
      request.input('TelefonoEmergencia', telefonoEmergenciaSanitizado);
      request.input('TipoSangre', tipoSangreSanitizado);
      request.input('AlergiasPadecimientos', alergiasSanitizado);

      await request.query(`
        UPDATE dbo.Colaboradores
        SET 
          IdJefeDirecto = @IdJefeDirecto,
          IdAprobadorSegundo = @IdAprobadorSegundo,
          EmailCorporativo = @EmailCorporativo,
          DiasDescanso = @DiasDescanso,
          RolApp = @RolApp,
          CentroCostos = @CentroCostos,
          TipoNomina = @TipoNomina,
          TipoContrato = @TipoContrato,
          PeriodicidadPago = @PeriodicidadPago,
          FechaAltaImss = @FechaAltaImss,
          FechaEvaluacion = @FechaEvaluacion,
          FechaRealContratacion = @FechaRealContratacion,
          Telefono = @Telefono,
          AvisarEmergencia = @AvisarEmergencia,
          ParentescoEmergencia = @ParentescoEmergencia,
          TelefonoEmergencia = @TelefonoEmergencia,
          TipoSangre = @TipoSangre,
          AlergiasPadecimientos = @AlergiasPadecimientos,
          FechaModificacion = SYSDATETIME()
        WHERE IdColaborador = @Id;
      `);

      // Sincronizar RolApp en dbo.UsuariosApp si el usuario existe
      if (rolAppFinal) {
        await pool.request()
          .input('IdColaborador', Number(id))
          .input('RolApp', rolAppFinal)
          .query(`
            UPDATE dbo.UsuariosApp 
            SET RolApp = @RolApp 
            WHERE IdColaborador = @IdColaborador AND RolApp <> 'SUPERADMIN' AND RolApp <> 'SISTEMAS';
          `);
      }

      return res.json({
        success: true,
        message: 'Información complementaria actualizada y protegida contra sincronización NOMIPAQ.'
      });
    } catch (error) {
      console.error('Error al actualizar colaborador:', error);
      return res.status(500).json({ error: error.message || 'Error al actualizar información complementaria.' });
    }
  },

  /**
   * POST /api/admin/colaboradores/:id/reset-password
   * Reseteo administrativo de contraseña con bandera obligatoria DebeCambiarPassword
   */
  resetPasswordAdmin: async (req, res) => {
    try {
      const { id } = req.params;
      const { passwordTemporal } = req.body;

      // Si no se define contraseña temporal manual, generar una institucional segura
      const nuevaClave = passwordTemporal && passwordTemporal.trim().length >= 8
        ? passwordTemporal.trim()
        : `JAMA-${Math.floor(1000 + Math.random() * 9000)}!`;

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(nuevaClave, salt);

      const pool = await getLocalPool();

      // Verificar si ya tiene cuenta en UsuariosApp
      const checkUser = await pool.request()
        .input('IdColaborador', id)
        .query('SELECT IdUsuario, Username, RolApp FROM dbo.UsuariosApp WHERE IdColaborador = @IdColaborador');

      let usernameFinal = '';

      if (checkUser.recordset[0]) {
        // Actualizar clave y marcar DebeCambiarPassword = 1
        usernameFinal = checkUser.recordset[0].Username;
        await pool.request()
          .input('IdUsuario', checkUser.recordset[0].IdUsuario)
          .input('PasswordHash', hash)
          .query(`
            UPDATE dbo.UsuariosApp 
            SET PasswordHash = @PasswordHash, 
                DebeCambiarPassword = 1,
                FechaModificacionPassword = SYSDATETIME()
            WHERE IdUsuario = @IdUsuario;
          `);
      } else {
        // Crear cuenta en UsuariosApp
        const colabRes = await pool.request()
          .input('Id', id)
          .query('SELECT CodigoEmpleado, Email, RolApp FROM dbo.Colaboradores WHERE IdColaborador = @Id');

        const colab = colabRes.recordset[0];
        if (!colab) return res.status(404).json({ error: 'Colaborador no encontrado.' });

        usernameFinal = colab.CodigoEmpleado || `user_${id}`;
        await pool.request()
          .input('IdColaborador', id)
          .input('Username', usernameFinal)
          .input('PasswordHash', hash)
          .input('RolApp', colab.RolApp || 'COLABORADOR')
          .query(`
            INSERT INTO dbo.UsuariosApp (IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo)
            VALUES (@IdColaborador, @Username, @PasswordHash, @RolApp, 1, 1);
          `);
      }

      return res.json({
        success: true,
        username: usernameFinal,
        passwordTemporal: nuevaClave,
        message: `Contraseña restablecida exitosamente para ${usernameFinal}. Se solicitará cambio obligatorio en su próximo inicio de sesión.`
      });
    } catch (err) {
      console.error('[adminColaboradores.resetPasswordAdmin]', err);
      res.status(500).json({ error: 'Error al restablecer la contraseña del colaborador.' });
    }
  },

  /**
   * GET /api/admin/roles/administradores-do
   * Lista de colaboradores con rol activo ADMIN_DO
   */
  getAdministradoresDO: async (req, res) => {
    try {
      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        const adminColabs = (mockStore.colaboradores || []).filter(c => c.rolApp === 'ADMIN_DO' || c.rol === 'ADMIN_DO');
        adminColabs.sort((a, b) => {
          const apA = (a.apellidoPaterno || '').toUpperCase();
          const apB = (b.apellidoPaterno || '').toUpperCase();
          if (apA !== apB) return apA.localeCompare(apB, 'es', { sensitivity: 'base' });
          const amA = (a.apellidoMaterno || '').toUpperCase();
          const amB = (b.apellidoMaterno || '').toUpperCase();
          if (amA !== amB) return amA.localeCompare(amB, 'es', { sensitivity: 'base' });
          const nomA = (a.nombre || '').toUpperCase();
          const nomB = (b.nombre || '').toUpperCase();
          return nomA.localeCompare(nomB, 'es', { sensitivity: 'base' });
        });
        return res.json({
          success: true,
          total: adminColabs.length,
          data: adminColabs.map(c => ({
            IdColaborador: c.id,
            CodigoEmpleado: c.codigoEmpleado,
            NombreCompleto: c.nombreCompleto,
            Email: c.email,
            RolApp: 'ADMIN_DO',
            Empresa: c.empresa,
            Departamento: c.departamento,
            Puesto: c.puesto,
            IdUsuario: c.id,
            Username: c.username || c.codigoEmpleado,
            UltimoAcceso: new Date().toISOString(),
            UsuarioActivo: true,
            FechaAsignacion: '2026-01-01'
          }))
        });
      }

      const result = await pool.request().query(`
        SELECT 
          c.IdColaborador, c.CodigoEmpleado,
          CASE 
            WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
                   CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
            ELSE c.NombreCompleto
          END AS NombreCompleto,
          c.Email,
          c.RolApp, e.AliasEmpresa AS Empresa, d.Nombre AS Departamento, p.Nombre AS Puesto,
          u.IdUsuario, u.Username, u.UltimoAcceso, u.Activo AS UsuarioActivo,
          u.FechaCreacion AS FechaAsignacion
        FROM dbo.Colaboradores c
        JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        WHERE c.RolApp = 'ADMIN_DO' OR u.RolApp = 'ADMIN_DO'
        ORDER BY c.ApellidoPaterno ASC, c.ApellidoMaterno ASC, c.Nombre ASC;
      `);

      return res.json({
        success: true,
        total: result.recordset.length,
        data: result.recordset
      });
    } catch (err) {
      console.error('[adminColaboradores.getAdministradoresDO]', err);
      res.status(500).json({ error: 'Error al listar administradores de DO.' });
    }
  },

  /**
   * POST /api/admin/roles/asignar-admin-do
   * Promueve a un colaborador al rol ADMIN_DO
   */
  asignarAdminDO: async (req, res) => {
    try {
      const { idColaborador } = req.body;
      if (!idColaborador) {
        return res.status(400).json({ error: 'Debe especificar el Id del colaborador a promover.' });
      }

      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        const colab = (mockStore.colaboradores || []).find(c => 
          Number(c.id) === Number(idColaborador) || Number(c.IdColaborador) === Number(idColaborador)
        );
        if (!colab) {
          return res.status(404).json({ error: 'Colaborador no encontrado.' });
        }
        if (colab.activo === false || colab.Activo === false) {
          return res.status(400).json({ error: 'No es posible asignar permisos a un colaborador con estatus de BAJA.' });
        }

        colab.rolApp = 'ADMIN_DO';
        colab.rol = 'ADMIN_DO';
        if (colab.RolApp) colab.RolApp = 'ADMIN_DO';

        return res.json({
          success: true,
          message: `${colab.nombreCompleto} ha sido promovido al rol ADMIN_DO (Desarrollo Organizacional) exitosamente.`
        });
      }

      // Validar existencia de colaborador
      const colabRes = await pool.request()
        .input('IdColaborador', idColaborador)
        .query('SELECT IdColaborador, CodigoEmpleado, NombreCompleto, RolApp, Activo FROM dbo.Colaboradores WHERE IdColaborador = @IdColaborador');

      const colab = colabRes.recordset[0];
      if (!colab) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      if (!colab.Activo) {
        return res.status(400).json({ error: 'No es posible asignar permisos a un colaborador con estatus de BAJA.' });
      }

      // Actualizar en dbo.Colaboradores
      await pool.request()
        .input('IdColaborador', idColaborador)
        .query("UPDATE dbo.Colaboradores SET RolApp = 'ADMIN_DO' WHERE IdColaborador = @IdColaborador");

      // Actualizar o crear en dbo.UsuariosApp
      const checkUser = await pool.request()
        .input('IdColaborador', idColaborador)
        .query('SELECT IdUsuario FROM dbo.UsuariosApp WHERE IdColaborador = @IdColaborador');

      if (checkUser.recordset[0]) {
        await pool.request()
          .input('IdColaborador', idColaborador)
          .query("UPDATE dbo.UsuariosApp SET RolApp = 'ADMIN_DO', Activo = 1 WHERE IdColaborador = @IdColaborador");
      } else {
        const defaultHash = bcrypt.hashSync('Grupojama2026!', 10);
        await pool.request()
          .input('IdColaborador', idColaborador)
          .input('Username', colab.CodigoEmpleado)
          .input('Hash', defaultHash)
          .query(`
            INSERT INTO dbo.UsuariosApp (IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo)
            VALUES (@IdColaborador, @Username, @Hash, 'ADMIN_DO', 1, 1);
          `);
      }

      return res.json({
        success: true,
        message: `${colab.NombreCompleto} ha sido promovido al rol ADMIN_DO (Desarrollo Organizacional) exitosamente.`
      });
    } catch (error) {
      console.error('Error detallado al asignar rol ADMIN_DO:', error);
      res.status(500).json({ 
        error: error.message || 'Error al asignar rol ADMIN_DO.',
        message: error.message || 'Error al asignar rol ADMIN_DO.'
      });
    }
  },

  /**
   * POST /api/admin/roles/revocar-admin-do
   * Revoca rol ADMIN_DO y lo regresa a COLABORADOR o LIDER
   */
  revocarAdminDO: async (req, res) => {
    try {
      const { idColaborador, nuevoRol = 'COLABORADOR' } = req.body;
      const callerColabId = req.user?.id_colaborador || req.user?.id;

      if (!idColaborador) {
        return res.status(400).json({ error: 'Debe especificar el colaborador a revocar.' });
      }

      // Regla de protección 1: No puede revocar su propio rol
      if (callerColabId && Number(callerColabId) === Number(idColaborador)) {
        return res.status(400).json({ error: 'Por seguridad, no puedes revocar tu propio rol de ADMIN_DO.' });
      }

      // Sanitización estricta del nuevo rol en Backend
      const rolNuevo = ['COLABORADOR', 'LIDER'].includes(nuevoRol) ? nuevoRol : 'COLABORADOR';

      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        const mockStore = require('../data/mockStore');
        const colab = (mockStore.colaboradores || []).find(c => 
          Number(c.id) === Number(idColaborador) || Number(c.IdColaborador) === Number(idColaborador)
        );
        if (!colab) {
          return res.status(404).json({ error: 'Colaborador no encontrado.' });
        }
        if (colab.rolApp === 'SUPERADMIN' || colab.rolApp === 'SISTEMAS' || colab.rol === 'SUPERADMIN' || colab.rol === 'SISTEMAS' || colab.username === 'sistemas') {
          return res.status(400).json({ error: 'No es posible revocar privilegios a un usuario con rol SISTEMAS (SuperAdmin).' });
        }

        colab.rolApp = rolNuevo;
        colab.rol = rolNuevo;
        if (colab.RolApp) colab.RolApp = rolNuevo;

        return res.json({
          success: true,
          message: `Privilegios de ADMIN_DO revocados para ${colab.nombreCompleto}. Ahora cuenta con rol ${rolNuevo}.`
        });
      }

      // Regla de protección 2: No revocar a SISTEMAS / SUPERADMIN
      const checkTarget = await pool.request()
        .input('IdColaborador', idColaborador)
        .query(`
          SELECT c.IdColaborador, c.NombreCompleto, c.RolApp, u.RolApp AS UserRol, u.Username
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.UsuariosApp u ON u.IdColaborador = c.IdColaborador
          WHERE c.IdColaborador = @IdColaborador;
        `);

      const target = checkTarget.recordset[0];
      if (!target) return res.status(404).json({ error: 'Colaborador no encontrado.' });

      if (target.UserRol === 'SUPERADMIN' || target.UserRol === 'SISTEMAS' || target.Username === 'sistemas') {
        return res.status(400).json({ error: 'No es posible revocar privilegios a un usuario con rol SISTEMAS (SuperAdmin).' });
      }

      await pool.request()
        .input('IdColaborador', idColaborador)
        .input('NuevoRol', rolNuevo)
        .query(`
          UPDATE dbo.UsuariosApp
          SET RolApp = @NuevoRol
          WHERE IdColaborador = @IdColaborador;

          UPDATE dbo.Colaboradores
          SET RolApp = @NuevoRol
          WHERE IdColaborador = @IdColaborador;
        `);

      return res.json({
        success: true,
        message: `Privilegios de ADMIN_DO revocados para ${target.NombreCompleto}. Ahora cuenta con rol ${rolNuevo}.`
      });
    } catch (error) {
      console.error('Error detallado al revocar rol ADMIN_DO:', error);
      res.status(500).json({ 
        error: error.message || 'Error al revocar rol ADMIN_DO.',
        message: error.message || 'Error al revocar rol ADMIN_DO.'
      });
    }
  }
};

module.exports = adminColaboradoresController;
