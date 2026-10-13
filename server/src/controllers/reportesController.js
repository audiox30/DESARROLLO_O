const XLSX = require('xlsx');
const { getLocalPool, isUsingMock } = require('../config/database');

const reportesController = {
  /**
   * GET /api/reportes/padron
   * Reporte 1: Padrón de Colaboradores y Estructura Organizacional
   */
  getPadron: async (req, res) => {
    try {
      const { empresa, empresa_id, empresaId, sucursal, departamento, fechaInicio, fechaFin, format } = req.query;
      const pool = await getLocalPool();
      const request = pool.request();
      let whereClauses = [];

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

      if (sucursal && sucursal.trim()) {
        request.input('Sucursal', `%${sucursal.trim()}%`);
        whereClauses.push('c.Sucursal LIKE @Sucursal');
      }

      if (departamento && departamento.trim()) {
        request.input('Depto', `%${departamento.trim()}%`);
        whereClauses.push('d.Nombre LIKE @Depto');
      }

      if (fechaInicio) {
        request.input('FechaInicio', fechaInicio);
        whereClauses.push('c.FechaAlta >= @FechaInicio');
      }

      if (fechaFin) {
        request.input('FechaFin', fechaFin);
        whereClauses.push('c.FechaAlta <= @FechaFin');
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT 
          c.IdColaborador, c.CodigoEmpleado, c.Subfijo, c.NombreCompleto,
          e.AliasEmpresa AS Empresa, ISNULL(c.Sucursal, 'Matriz') AS Sucursal,
          ISNULL(d.Nombre, 'Sin Departamento') AS Departamento,
          ISNULL(p.Nombre, 'Sin Puesto') AS Puesto,
          CONVERT(VARCHAR(10), c.FechaAlta, 120) AS FechaAlta,
          DATEDIFF(YEAR, c.FechaAlta, GETDATE()) AS AntiguedadAnios,
          ISNULL(j.NombreCompleto, 'Sin Asignar') AS JefeDirecto,
          c.EstatusNomina, c.RolApp,
          CASE WHEN c.Activo = 1 THEN 'ACTIVO' ELSE 'BAJA' END AS EstatusSistema,
          ISNULL(c.Telefono, '—') AS Telefono,
          ISNULL(c.Email, '—') AS Email,
          (SELECT COUNT(*) FROM dbo.ColaboradorHijos h WHERE h.IdColaborador = c.IdColaborador) AS TotalHijos,
          ISNULL(c.DiasDescanso, 'Domingos') AS DiasDescanso
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
        ${whereSQL}
        ORDER BY e.AliasEmpresa, c.ApellidoPaterno, c.Nombre;
      `;

      const result = await request.query(query);
      const data = result.recordset;

      // Si se solicita exportación en Excel (.xlsx)
      if (format === 'xlsx') {
        const rows = data.map(r => ({
          'Código': r.CodigoEmpleado,
          'Nombre Completo': r.NombreCompleto,
          'Empresa (Razón Social)': r.Empresa,
          'Sucursal / Unidad': r.Sucursal,
          'Departamento': r.Departamento,
          'Puesto': r.Puesto,
          'Fecha de Alta': r.FechaAlta,
          'Antigüedad (Años)': r.AntiguedadAnios,
          'Jefe Directo': r.JefeDirecto,
          'No. de Hijos': r.TotalHijos || 0,
          'Estatus Nómina': r.EstatusNomina,
          'Rol en App': r.RolApp,
          'Teléfono': r.Telefono,
          'Días de Descanso': r.DiasDescanso
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Padron_Colaboradores');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=PADRON_COLABORADORES_JAMA_${new Date().toISOString().split('T')[0]}.xlsx`);
        return res.send(buffer);
      }

      return res.json({
        success: true,
        total: data.length,
        data
      });
    } catch (err) {
      console.error('[reportes.getPadron]', err);
      res.status(500).json({ error: 'Error al generar reporte de padrón de colaboradores.' });
    }
  },

  /**
   * GET /api/reportes/saldos
   * Reporte 2: Saldos de Vacaciones (Kárdex y Disponibilidad LFT)
   */
  getSaldos: async (req, res) => {
    try {
      const { empresa, empresa_id, empresaId, sucursal, departamento, format } = req.query;
      const pool = await getLocalPool();
      const request = pool.request();
      let whereClauses = ['c.Activo = 1'];

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

      if (sucursal && sucursal.trim()) {
        request.input('Sucursal', `%${sucursal.trim()}%`);
        whereClauses.push('c.Sucursal LIKE @Sucursal');
      }

      if (departamento && departamento.trim()) {
        request.input('Depto', `%${departamento.trim()}%`);
        whereClauses.push('d.Nombre LIKE @Depto');
      }

      const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

      const query = `
        SELECT 
          c.IdColaborador, c.CodigoEmpleado, c.NombreCompleto,
          e.AliasEmpresa AS Empresa, ISNULL(c.Sucursal, 'Matriz') AS Sucursal,
          ISNULL(d.Nombre, 'General') AS Departamento,
          CONVERT(VARCHAR(10), c.FechaAlta, 120) AS FechaAlta,
          DATEDIFF(YEAR, c.FechaAlta, GETDATE()) AS AntiguedadAnios,
          ISNULL(sal.PeriodoVigente, CONVERT(VARCHAR(4), YEAR(GETDATE()) - 1) + '-' + CONVERT(VARCHAR(4), YEAR(GETDATE()))) AS PeriodoVigente,
          ISNULL(sal.DiasCorrespondientes, 0) AS DiasLeyLFT,
          ISNULL(sal.DiasGozados, 0) AS DiasGozados,
          ISNULL(tram.DiasEnTramite, 0) AS DiasEnTramite,
          ISNULL(sal.DiasPendientes, 0) - ISNULL(tram.DiasEnTramite, 0) AS SaldoDisponibleReal,
          ISNULL(CONVERT(VARCHAR(10), sal.FechaExpiracion, 120), '—') AS FechaVencimiento
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        OUTER APPLY (
          SELECT 
            TOP 1
            CONVERT(VARCHAR(4), sv.AnioPeriodo - 1) + '-' + CONVERT(VARCHAR(4), sv.AnioPeriodo) AS PeriodoVigente,
            SUM(sv.DiasCorrespondientes) OVER() AS DiasCorrespondientes,
            SUM(sv.DiasGozados) OVER() AS DiasGozados,
            SUM(sv.DiasPendientes) OVER() AS DiasPendientes,
            MAX(sv.FechaExpiracionPeriodo) OVER() AS FechaExpiracion
          FROM dbo.SaldosVacaciones sv
          WHERE sv.IdColaborador = c.IdColaborador AND sv.EsCerrado = 0
          ORDER BY sv.AnioPeriodo DESC
        ) sal
        OUTER APPLY (
          SELECT ISNULL(SUM(sol.TotalDiasLaborables), 0) AS DiasEnTramite
          FROM dbo.SolicitudesVacaciones sol
          WHERE sol.IdColaborador = c.IdColaborador AND sol.Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO')
        ) tram
        ${whereSQL}
        ORDER BY e.AliasEmpresa, c.ApellidoPaterno, c.Nombre;
      `;

      const result = await request.query(query);
      const data = result.recordset;

      // Resumen agrupado por Empresa
      const resumenPorEmpresa = {};
      data.forEach(r => {
        const emp = r.Empresa || 'Otras';
        if (!resumenPorEmpresa[emp]) {
          resumenPorEmpresa[emp] = {
            empresa: emp,
            totalColaboradores: 0,
            totalDiasLey: 0,
            totalDiasGozados: 0,
            totalDiasEnTramite: 0,
            totalSaldoDisponible: 0
          };
        }
        resumenPorEmpresa[emp].totalColaboradores += 1;
        resumenPorEmpresa[emp].totalDiasLey += (r.DiasLeyLFT || 0);
        resumenPorEmpresa[emp].totalDiasGozados += (r.DiasGozados || 0);
        resumenPorEmpresa[emp].totalDiasEnTramite += (r.DiasEnTramite || 0);
        resumenPorEmpresa[emp].totalSaldoDisponible += (r.SaldoDisponibleReal || 0);
      });

      const resumenList = Object.values(resumenPorEmpresa);

      if (format === 'xlsx') {
        const rowsDetalle = data.map(r => ({
          'Código': r.CodigoEmpleado,
          'Colaborador': r.NombreCompleto,
          'Empresa': r.Empresa,
          'Sucursal': r.Sucursal,
          'Departamento': r.Departamento,
          'Fecha Ingreso': r.FechaAlta,
          'Antigüedad (Años)': r.AntiguedadAnios,
          'Período Vigente': r.PeriodoVigente,
          'Días por Ley (LFT)': r.DiasLeyLFT,
          'Días Gozados': r.DiasGozados,
          'Días en Trámite': r.DiasEnTramite,
          'Saldo Disponible Real': r.SaldoDisponibleReal,
          'Fecha Vencimiento': r.FechaVencimiento
        }));

        const rowsResumen = resumenList.map(r => ({
          'Empresa': r.empresa,
          'Total Empleados': r.totalColaboradores,
          'Total Días Ley LFT': r.totalDiasLey,
          'Total Días Gozados': r.totalDiasGozados,
          'Total Días en Trámite': r.totalDiasEnTramite,
          'Total Días Disponibles': r.totalSaldoDisponible,
          'Promedio Días Disp / Empleado': Math.round((r.totalSaldoDisponible / (r.totalColaboradores || 1)) * 10) / 10
        }));

        const wb = XLSX.utils.book_new();
        const wsDetalle = XLSX.utils.json_to_sheet(rowsDetalle);
        const wsResumen = XLSX.utils.json_to_sheet(rowsResumen);

        XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle_Saldos_Colaborador');
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Por_Empresa');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=SALDOS_VACACIONES_JAMA_${new Date().toISOString().split('T')[0]}.xlsx`);
        return res.send(buffer);
      }

      return res.json({
        success: true,
        total: data.length,
        resumenPorEmpresa: resumenList,
        data
      });
    } catch (err) {
      console.error('[reportes.getSaldos]', err);
      res.status(500).json({ error: 'Error al generar reporte de saldos de vacaciones.' });
    }
  },

  /**
   * GET /api/reportes/calendario-ausencias
   * Reporte 3: Calendario de Ausencias y Vacaciones Programadas
   */
  getCalendarioAusencias: async (req, res) => {
    try {
      const { empresa, empresa_id, empresaId, sucursal, departamento, mes, anio = new Date().getFullYear(), format } = req.query;
      const callerRol = req.user.rol || req.user.rolApp;
      const callerColabId = req.user.id_colaborador || req.user.id;
      const isSuperOrAdmin = callerRol === 'ADMIN_DO' || callerRol === 'SUPERADMIN' || callerRol === 'SISTEMAS';

      const pool = await getLocalPool();
      const request = pool.request();
      let whereClauses = ["s.Estado IN ('APROBADA', 'PENDIENTE_DO', 'PENDIENTE_LIDER')"];

      // Si es un LÍDER (y no es Admin DO/Sistemas), restringir a su propio equipo
      if (!isSuperOrAdmin && callerRol === 'LIDER') {
        request.input('LiderId', callerColabId);
        whereClauses.push('c.IdJefeDirecto = @LiderId');
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

      if (sucursal && sucursal.trim()) {
        request.input('Sucursal', `%${sucursal.trim()}%`);
        whereClauses.push('c.Sucursal LIKE @Sucursal');
      }

      if (departamento && departamento.trim()) {
        request.input('Depto', `%${departamento.trim()}%`);
        whereClauses.push('d.Nombre LIKE @Depto');
      }

      // Filtro de año
      if (anio) {
        request.input('Anio', Number(anio));
        whereClauses.push('(YEAR(s.FechaInicio) = @Anio OR YEAR(s.FechaFin) = @Anio)');
      }

      // Filtro de mes (1 al 12)
      if (mes) {
        request.input('Mes', Number(mes));
        whereClauses.push('(MONTH(s.FechaInicio) = @Mes OR MONTH(s.FechaFin) = @Mes)');
      }

      const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

      const query = `
        SELECT 
          s.IdSolicitud, s.Folio, s.FechaInicio, s.FechaFin, s.TotalDiasLaborables,
          s.Estado, s.MotivoComentarios, s.FechaCreacion,
          c.IdColaborador, c.CodigoEmpleado, c.NombreCompleto, c.Sucursal,
          e.AliasEmpresa AS Empresa,
          d.Nombre AS Departamento, p.Nombre AS Puesto,
          j.NombreCompleto AS JefeDirectoNombre
        FROM dbo.SolicitudesVacaciones s
        JOIN dbo.Colaboradores c ON c.IdColaborador = s.IdColaborador
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
        ${whereSQL}
        ORDER BY s.FechaInicio ASC;
      `;

      const result = await request.query(query);
      const ausencias = result.recordset;

      // Detección de posibles traslapes en el mismo departamento y período
      const traslapes = [];
      for (let i = 0; i < ausencias.length; i++) {
        for (let j = i + 1; j < ausencias.length; j++) {
          const a = ausencias[i];
          const b = ausencias[j];

          if (a.Departamento && a.Departamento === b.Departamento && a.Empresa === b.Empresa) {
            // Verificar solapamiento de fechas
            const inicioA = new Date(a.FechaInicio);
            const finA = new Date(a.FechaFin);
            const inicioB = new Date(b.FechaInicio);
            const finB = new Date(b.FechaFin);

            if (inicioA <= finB && inicioB <= finA) {
              traslapes.push({
                departamento: a.Departamento,
                empresa: a.Empresa,
                colaborador1: a.NombreCompleto,
                fechas1: `${a.FechaInicio} al ${a.FechaFin}`,
                colaborador2: b.NombreCompleto,
                fechas2: `${b.FechaInicio} al ${b.FechaFin}`,
                alerta: 'Traslape simultáneo de vacaciones detectado en el mismo departamento'
              });
            }
          }
        }
      }

      if (format === 'xlsx') {
        const rowsAusencias = ausencias.map(a => ({
          'Folio': a.Folio,
          'Colaborador': a.NombreCompleto,
          'Empresa': a.Empresa,
          'Sucursal': a.Sucursal || 'Matriz',
          'Departamento': a.Departamento,
          'Puesto': a.Puesto,
          'Fecha Inicio': a.FechaInicio,
          'Fecha Fin': a.FechaFin,
          'Días Hábiles': a.TotalDiasLaborables,
          'Estado': a.Estado,
          'Jefe Directo': a.JefeDirectoNombre,
          'Motivo': a.MotivoComentarios || '—'
        }));

        const rowsTraslapes = traslapes.map(t => ({
          'Departamento': t.departamento,
          'Empresa': t.empresa,
          'Colaborador A': t.colaborador1,
          'Período A': t.fechas1,
          'Colaborador B': t.colaborador2,
          'Período B': t.fechas2,
          'Observación': t.alerta
        }));

        const wb = XLSX.utils.book_new();
        const wsAus = XLSX.utils.json_to_sheet(rowsAusencias);
        XLSX.utils.book_append_sheet(wb, wsAus, 'Calendario_Ausencias');

        if (rowsTraslapes.length > 0) {
          const wsTras = XLSX.utils.json_to_sheet(rowsTraslapes);
          XLSX.utils.book_append_sheet(wb, wsTras, 'Alertas_Traslapes');
        }

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=CALENDARIO_AUSENCIAS_JAMA_${anio}_${mes || 'ANUAL'}.xlsx`);
        return res.send(buffer);
      }

      return res.json({
        success: true,
        total: ausencias.length,
        totalTraslapes: traslapes.length,
        traslapes,
        data: ausencias
      });
    } catch (err) {
      console.error('[reportes.getCalendarioAusencias]', err);
      res.status(500).json({ error: 'Error al consultar calendario de ausencias.' });
    }
  }
};

module.exports = reportesController;
