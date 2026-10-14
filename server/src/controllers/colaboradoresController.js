const mockStore = require('../data/mockStore');
const { getLocalPool, isUsingMock } = require('../config/database');
const { generarPeriodosVacaciones } = require('../services/lftVacacionesService');
const ColaboradorModel = require('../models/colaboradorModel');

const colaboradoresController = {
  /**
   * Listado paginado de colaboradores con filtros
   */
  getAll: async (req, res) => {
    try {
      const { search, departamento, empresa, empresa_id, empresaId, rolApp, estatus, limit = 50, page = 1 } = req.query;

      if (isUsingMock()) {
        let list = [...mockStore.colaboradores].map(c => {
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
            Email: c.email || c.Email || null,
            EmailNomina: c.email || c.Email || null,
            EmailCorporativo: c.emailCorporativo || c.EmailCorporativo || null,
            Activo: isActivo,
            activo: isActivo,
            EstatusNomina: isActivo ? 'ALTA' : 'BAJA',
            estatusNomina: isActivo ? 'ALTA' : 'BAJA',
            RolApp: c.rolApp || c.rol || 'COLABORADOR'
          };
        });

        const estatusNorm = String(estatus || '').trim().toLowerCase();
        if (['bajas', 'baja', '0', 'inactivos', 'inactivo'].includes(estatusNorm)) {
          list = list.filter(c => !c.Activo);
        } else if (['todos', 'all'].includes(estatusNorm)) {
          // Mostrar activos y bajas
        } else {
          // Por defecto o 'activos' -> c.Activo = 1
          list = list.filter(c => c.Activo);
        }

        if (search) {
          const s = search.toLowerCase();
          list = list.filter(c => 
            (c.NombreCompleto && c.NombreCompleto.toLowerCase().includes(s)) || 
            (c.CodigoEmpleado && c.CodigoEmpleado.toLowerCase().includes(s)) ||
            (c.CURP && c.CURP.toLowerCase().includes(s))
          );
        }

        if (departamento) {
          list = list.filter(c => c.Departamento && c.Departamento.toLowerCase().includes(departamento.toLowerCase()));
        }

        if (empresa_id || empresa) {
          const target = String(empresa_id || empresa).toLowerCase();
          list = list.filter(c => String(c.idEmpresa) === target || (c.Empresa && c.Empresa.toLowerCase().includes(target)));
        }

        if (rolApp) {
          list = list.filter(c => c.RolApp === rolApp);
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
        const startIndex = (page - 1) * limit;
        const paginated = list.slice(startIndex, startIndex + Number(limit));

        return res.json({
          success: true,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / limit),
          data: paginated
        });
      } else {
        const pool = await getLocalPool();
        const request = pool.request();
        let whereClauses = [];

        const estatusNorm = String(estatus || '').trim().toLowerCase();
        if (['bajas', 'baja', '0', 'inactivos', 'inactivo'].includes(estatusNorm)) {
          whereClauses.push('c.Activo = 0');
        } else if (['todos', 'all'].includes(estatusNorm)) {
          // Mostrar activos y bajas (sin filtro de Activo)
        } else {
          // Por defecto o 'activos' -> c.Activo = 1
          whereClauses.push('c.Activo = 1');
        }

        if (search) {
          request.input('Search', `%${search}%`);
          whereClauses.push('(c.NombreCompleto LIKE @Search OR c.CodigoEmpleado LIKE @Search OR c.CURP LIKE @Search OR c.RFC LIKE @Search)');
        }

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

        if (departamento) {
          request.input('Depto', `%${departamento}%`);
          whereClauses.push('d.Nombre LIKE @Depto');
        }

        if (rolApp) {
          request.input('RolApp', rolApp);
          whereClauses.push('c.RolApp = @RolApp');
        }

        const query = `
          SELECT 
            c.IdColaborador AS id, c.IdColaborador, c.IdEmpresa, e.AliasEmpresa AS Empresa,
            c.CodigoEmpleado, c.Subfijo, c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno,
            CASE 
              WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
                THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
                     CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                          THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
                     ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
              ELSE c.NombreCompleto
            END AS NombreCompleto,
            c.Sucursal,
            c.CURP, c.RFC, c.NSS, c.Email, c.Email AS EmailNomina, c.EmailCorporativo, c.Telefono,
            d.Nombre AS Departamento, p.Nombre AS Puesto,
            c.FechaAlta, c.FechaReingreso, c.EstatusNomina, c.RolApp, c.JornadaLaboralDias, c.Activo,
            c.IdJefeDirecto,
            jefe.NombreCompleto AS NombreJefeDirecto,
            jefe.NombreCompleto AS JefeDirectoNombre,
            c.IdAprobadorSegundo,
            gerente.NombreCompleto AS NombreGerenteSucursal,
            gerente.NombreCompleto AS SegundoAprobadorNombre
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Colaboradores jefe ON jefe.IdColaborador = c.IdJefeDirecto
          LEFT JOIN dbo.Colaboradores gerente ON gerente.IdColaborador = c.IdAprobadorSegundo
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY c.ApellidoPaterno ASC, c.ApellidoMaterno ASC, c.Nombre ASC;
        `;
        const result = await request.query(query);
        return res.json({
          success: true,
          total: result.recordset.length,
          data: result.recordset
        });
      }
    } catch (err) {
      console.error('[colaboradores.getAll]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtiene la ficha técnica completa del colaborador
   * Incluye aislamiento de confidencialidad en datos financieros
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const rolSolicitante = req.user ? req.user.rolApp : 'COLABORADOR';
      const idUsuario = req.user ? req.user.id : null;

      const colaborador = await ColaboradorModel.obtenerDetalleCompleto(Number(id), rolSolicitante, idUsuario);
      if (!colaborador) return res.status(404).json({ error: 'Colaborador no encontrado.' });

      return res.json({ success: true, data: colaborador });
    } catch (err) {
      console.error('[colaboradores.getById]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Actualización de datos del colaborador
   */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      // Solo ADMIN_DO, SUPERADMIN, SISTEMAS o el propio colaborador pueden modificar
      const rol = req.user ? req.user.rolApp : null;
      const esAdmin = rol === 'ADMIN_DO' || rol === 'SUPERADMIN' || rol === 'SISTEMAS';
      if (!esAdmin && Number(req.user.id) !== Number(id)) {
        return res.status(403).json({ error: 'No tienes permisos para modificar este colaborador.' });
      }

      await ColaboradorModel.actualizar(Number(id), req.body);
      return res.json({ success: true, message: 'Colaborador actualizado exitosamente.' });
    } catch (err) {
      console.error('Error al actualizar colaborador:', err);
      return res.status(500).json({ error: err.message || 'Error al actualizar colaborador.' });
    }
  },

  /**
   * Consulta de hijos de un colaborador (dbo.ColaboradorHijos)
   */
  getHijos: async (req, res) => {
    try {
      const { id } = req.params;
      const hijos = await ColaboradorModel.obtenerHijos(Number(id));
      return res.json({ success: true, total: (hijos || []).length, data: hijos });
    } catch (err) {
      console.error('[colaboradores.getHijos]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Registro o actualización de hijo (dbo.ColaboradorHijos)
   */
  agregarHijo: async (req, res) => {
    try {
      const { 
        idHijo,
        numeroHijo, 
        numero_hijo, 
        nombre, 
        nombreCompleto, 
        fechaNacimiento, 
        fecha_nacimiento, 
        sexo 
      } = req.body;

      const num = numeroHijo || numero_hijo;
      const nom = (nombre || nombreCompleto || '').trim();
      const fn = fechaNacimiento || fecha_nacimiento || null;

      const resultado = await ColaboradorModel.agregarHijo(Number(id), { 
        idHijo,
        numeroHijo: num, 
        nombre: nom, 
        fechaNacimiento: fn, 
        sexo 
      });

      const hijos = await ColaboradorModel.obtenerHijos(Number(id));
      return res.json({ success: true, message: 'Hijo registrado con éxito.', data: hijos, resultado });
    } catch (err) {
      console.error('[colaboradores.agregarHijo]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Eliminación de hijo (dbo.ColaboradorHijos)
   */
  eliminarHijo: async (req, res) => {
    try {
      const { id, idHijo } = req.params;
      await ColaboradorModel.eliminarHijo(Number(id), Number(idHijo));
      const hijos = await ColaboradorModel.obtenerHijos(Number(id));
      return res.json({ success: true, message: 'Hijo/dependiente eliminado con éxito.', data: hijos });
    } catch (err) {
      console.error('[colaboradores.eliminarHijo]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Registro o actualización de datos financieros confidenciales (dbo.ColaboradorDatosFinancieros)
   * Solo disponible para Desarrollo Organizacional (ADMIN_DO)
   */
  guardarDatosFinancieros: async (req, res) => {
    try {
      const { id } = req.params;
      if (req.user.rolApp !== 'ADMIN_DO') {
        return res.status(403).json({ error: 'Acceso denegado: solo Desarrollo Organizacional puede gestionar salarios y datos financieros.' });
      }

      await ColaboradorModel.guardarDatosFinancieros(Number(id), req.body);
      return res.json({ success: true, message: 'Datos financieros actualizados confidencialmente.' });
    } catch (err) {
      console.error('[colaboradores.guardarDatosFinancieros]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Registro de baja laboral (dbo.ColaboradorBajas)
   * Solo disponible para Desarrollo Organizacional (ADMIN_DO)
   */
  registrarBaja: async (req, res) => {
    try {
      const { id } = req.params;
      if (req.user.rolApp !== 'ADMIN_DO') {
        return res.status(403).json({ error: 'Acceso denegado: solo Desarrollo Organizacional puede registrar bajas.' });
      }

      const { fechaBaja, tipoBaja, comentarios, renunciaVoluntaria, convenioFiniquito, convenioConfidencialidad } = req.body;
      if (!fechaBaja) return res.status(400).json({ error: 'La fecha de baja es requerida.' });

      await ColaboradorModel.registrarBaja(Number(id), {
        fechaBaja, tipoBaja, comentarios, renunciaVoluntaria, convenioFiniquito, convenioConfidencialidad
      });
      return res.json({ success: true, message: 'Baja del colaborador registrada correctamente.' });
    } catch (err) {
      console.error('[colaboradores.registrarBaja]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Portal del Colaborador: Resumen de saldos y períodos
   */
  getMiSaldo: async (req, res) => {
    try {
      const idColaborador = req.user.id;

      if (isUsingMock()) {
        const colab = mockStore.colaboradores.find(c => c.id === Number(idColaborador)) || mockStore.colaboradores[0];
        
        const enTramite = mockStore.solicitudes
          .filter(s => s.idColaborador === colab.id && ['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(s.estado))
          .reduce((sum, s) => sum + s.totalDiasLaborables, 0);

        const periodos = colab.saldos || generarPeriodosVacaciones(colab.fechaAlta, colab.diasGozados);

        return res.json({
          success: true,
          colaborador: {
            id: colab.id,
            nombreCompleto: colab.nombreCompleto,
            codigoEmpleado: colab.codigoEmpleado,
            puesto: colab.puesto,
            departamento: colab.departamento,
            empresa: colab.empresa,
            fechaAlta: colab.fechaAlta,
            antiguedadAnios: colab.antiguedadAnios,
            diasDescanso: colab.diasDescanso || 'DOMINGO'
          },
          resumen: {
            diasCorrespondientes: colab.diasCorrespondientes,
            diasGozados: colab.diasGozados,
            diasEnTramite: enTramite,
            diasDisponibles: Math.max(0, colab.diasDisponibles - enTramite)
          },
          periodos
        });
      } else {
        const pool = await getLocalPool();
        const colabRes = await pool.request()
          .input('Id', idColaborador)
          .query(`
            SELECT 
              c.IdColaborador AS id, c.CodigoEmpleado, c.NombreCompleto, c.FechaAlta, c.DiasDescanso,
              p.Nombre AS Puesto, d.Nombre AS Departamento, e.AliasEmpresa AS Empresa,
              DATEDIFF(YEAR, c.FechaAlta, GETDATE()) AS AntiguedadAnios
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE c.IdColaborador = @Id;
          `);
        
        const saldosRes = await pool.request()
          .input('Id', idColaborador)
          .query(`
            SELECT 
              IdSaldo, IdColaborador, AnioPeriodo, AntiguedadCumplida,
              DiasCorrespondientes, DiasGozados, DiasPendientes,
              FechaExpiracionPeriodo, EsCerrado
            FROM dbo.SaldosVacaciones 
            WHERE IdColaborador = @Id 
            ORDER BY AnioPeriodo DESC;
          `);

        const enTramiteRes = await pool.request()
          .input('Id', idColaborador)
          .query(`
            SELECT ISNULL(SUM(TotalDiasLaborables), 0) AS DiasEnTramite
            FROM dbo.SolicitudesVacaciones
            WHERE IdColaborador = @Id AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO');
          `);

        const diasEnTramite = enTramiteRes.recordset[0] ? enTramiteRes.recordset[0].DiasEnTramite : 0;
        const saldos = saldosRes.recordset;
        const totalCorrespondientes = saldos.reduce((sum, s) => sum + (s.DiasCorrespondientes || 0), 0);
        const totalGozados = saldos.reduce((sum, s) => sum + (s.DiasGozados || 0), 0);
        const totalPendientes = saldos.reduce((sum, s) => sum + (s.DiasPendientes || 0), 0);
        const colab = colabRes.recordset[0] || {};
        return res.json({
          success: true,
          colaborador: {
            ...colab,
            id: colab.id,
            nombreCompleto: colab.NombreCompleto,
            codigoEmpleado: colab.CodigoEmpleado,
            puesto: colab.Puesto,
            departamento: colab.Departamento,
            empresa: colab.Empresa,
            fechaAlta: colab.FechaAlta,
            antiguedadAnios: colab.AntiguedadAnios,
            diasDescanso: colab.DiasDescanso || 'DOMINGO'
          },
          resumen: {
            diasCorrespondientes: totalCorrespondientes,
            diasGozados: totalGozados,
            diasEnTramite,
            diasDisponibles: Math.max(0, totalPendientes - diasEnTramite)
          },
          periodos: saldos
        });
      }
    } catch (err) {
      console.error('[colaboradores.getMiSaldo]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Portal del Líder: Subordinados a su cargo
   */
  getEquipoLider: async (req, res) => {
    try {
      const idLider = req.user.id;

      if (isUsingMock()) {
        let equipo = mockStore.colaboradores.filter(c => c.idJefeDirecto === Number(idLider));
        if (equipo.length === 0 && (req.user.rolApp === 'LIDER' || req.user.rolApp === 'ADMIN_DO')) {
          equipo = mockStore.colaboradores.slice(0, 8);
        }
        equipo.sort((a, b) => {
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
        return res.json({ success: true, total: equipo.length, data: equipo });
      } else {
        const pool = await getLocalPool();
        const result = await pool.request()
          .input('IdLider', idLider)
          .query(`
            SELECT 
              c.IdColaborador AS id, c.CodigoEmpleado,
              CASE 
                WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
                  THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
                       CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                            THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
                       ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
                ELSE c.NombreCompleto
              END AS NombreCompleto,
              p.Nombre AS Puesto, d.Nombre AS Departamento, e.AliasEmpresa AS Empresa,
              c.FechaAlta, c.Email
            FROM dbo.Colaboradores c
            LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
            LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
            LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
            WHERE c.IdJefeDirecto = @IdLider AND c.Activo = 1
            ORDER BY c.ApellidoPaterno ASC, c.ApellidoMaterno ASC, c.Nombre ASC;
          `);
        return res.json({ success: true, total: result.recordset.length, data: result.recordset });
      }
    } catch (err) {
      console.error('[colaboradores.getEquipoLider]', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = colaboradoresController;
