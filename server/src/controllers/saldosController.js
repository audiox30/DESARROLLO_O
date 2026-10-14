const mockStore = require('../data/mockStore');
const { getLocalPool, isUsingMock } = require('../config/database');
const { generarPeriodosVacaciones } = require('../services/lftVacacionesService');

const saldosController = {
  /**
   * GET /api/saldos/kardex-global
   * Kárdex global de saldos LFT de todos los colaboradores (exclusivo ADMIN_DO)
   */
  getKardexGlobal: async (req, res) => {
    try {
      const { empresa, empresa_id, empresaId, departamento, format } = req.query;

      const pool = await getLocalPool();

      if (!pool || isUsingMock()) {
        let list = mockStore.colaboradores.map(c => ({
          idColaborador: c.id,
          codigoEmpleado: c.codigoEmpleado,
          nombreCompleto: c.nombreCompleto,
          apellidoPaterno: c.apellidoPaterno || '',
          apellidoMaterno: c.apellidoMaterno || '',
          nombre: c.nombre || '',
          empresa: c.empresa,
          idEmpresa: c.idEmpresa,
          sucursal: c.sucursal,
          departamento: c.departamento,
          puesto: c.puesto,
          fechaAlta: c.fechaAlta,
          antiguedadAnios: c.antiguedadAnios,
          diasCorrespondientes: c.diasCorrespondientes,
          diasGozados: c.diasGozados,
          diasDisponibles: c.diasDisponibles
        }));

        if (empresa_id || empresa) {
          const target = String(empresa_id || empresa).toLowerCase();
          list = list.filter(item => String(item.idEmpresa) === target || (item.empresa && item.empresa.toLowerCase().includes(target)));
        }
        if (departamento) list = list.filter(item => item.departamento === departamento);

        // Ordenamiento Alfabético Obligatorio A - Z por Apellidos
        list.sort((a, b) => {
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

        if (format === 'csv') {
          const headers = 'Código,Nombre,Empresa,Sucursal,Departamento,Puesto,Fecha Alta,Antigüedad (Años),Días LFT,Días Gozados,Días Disponibles\n';
          const rows = list.map(c => 
            `"${c.codigoEmpleado}","${c.nombreCompleto}","${c.empresa}","${c.sucursal}","${c.departamento}","${c.puesto}","${c.fechaAlta}",${c.antiguedadAnios},${c.diasCorrespondientes},${c.diasGozados},${c.diasDisponibles}`
          ).join('\n');

          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="KARDEX_VACACIONES_GRUPO_JAMA.csv"');
          return res.send('\uFEFF' + headers + rows);
        }

        return res.json({ success: true, total: list.length, data: list });
      }

      const request = pool.request();
      let whereClauses = ['c.Activo = 1'];

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

      const queryStr = `
        SELECT 
          c.IdColaborador AS idColaborador,
          c.CodigoEmpleado AS codigoEmpleado,
          c.Subfijo AS subfijo,
          CASE 
            WHEN c.ApellidoPaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoPaterno)) <> ''
              THEN RTRIM(LTRIM(c.ApellidoPaterno)) + 
                   CASE WHEN c.ApellidoMaterno IS NOT NULL AND RTRIM(LTRIM(c.ApellidoMaterno)) <> '' 
                        THEN ' ' + RTRIM(LTRIM(c.ApellidoMaterno)) ELSE '' END + 
                   ', ' + RTRIM(LTRIM(ISNULL(c.Nombre, '')))
            ELSE c.NombreCompleto
          END AS nombreCompleto,
          c.Empresa AS empresa,
          c.Sucursal AS sucursal,
          e.AliasEmpresa AS empresaAlias,
          d.Nombre AS departamento,
          p.Nombre AS puesto,
          CONVERT(VARCHAR(10), c.FechaAlta, 120) AS fechaAlta,
          ISNULL(DATEDIFF(YEAR, c.FechaAlta, GETDATE()), 0) AS antiguedadAnios,
          ISNULL(sal.TotalCorrespondientes, 0) AS diasCorrespondientes,
          ISNULL(sal.TotalGozados, 0) AS diasGozados,
          ISNULL(sal.TotalPendientes, 0) AS diasDisponibles
        FROM dbo.Colaboradores c
        LEFT JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
        LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
        LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
        OUTER APPLY (
          SELECT 
            SUM(DiasCorrespondientes) AS TotalCorrespondientes,
            SUM(DiasGozados) AS TotalGozados,
            SUM(DiasPendientes) AS TotalPendientes
          FROM dbo.SaldosVacaciones sv
          WHERE sv.IdColaborador = c.IdColaborador AND sv.EsCerrado = 0
        ) sal
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY c.ApellidoPaterno ASC, c.ApellidoMaterno ASC, c.Nombre ASC;
      `;

      const result = await request.query(queryStr);
      const list = result.recordset;

      if (format === 'csv') {
        const headers = 'Código,Nombre,Empresa,Sucursal,Departamento,Puesto,Fecha Alta,Antigüedad (Años),Días LFT,Días Gozados,Días Disponibles\n';
        const rows = list.map(c => 
          `"${c.codigoEmpleado}","${c.nombreCompleto}","${c.empresa}","${c.sucursal || ''}","${c.departamento || ''}","${c.puesto || ''}","${c.fechaAlta}",${c.antiguedadAnios},${c.diasCorrespondientes},${c.diasGozados},${c.diasDisponibles}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="KARDEX_VACACIONES_GRUPO_JAMA.csv"');
        return res.send('\uFEFF' + headers + rows);
      }

      return res.json({
        success: true,
        total: list.length,
        data: list
      });
    } catch (err) {
      console.error('[saldos.getKardexGlobal]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/saldos/colaborador/:id
   * Kárdex individual con desglose por período LFT
   */
  getKardexColaborador: async (req, res) => {
    try {
      const { id } = req.params;

      if (isUsingMock()) {
        const colab = mockStore.colaboradores.find(c => c.id === Number(id));
        if (!colab) return res.status(404).json({ error: 'Colaborador no encontrado' });

        const enTramite = (mockStore.solicitudes || [])
          .filter(s => s.idColaborador === colab.id && ['PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO'].includes(s.estado))
          .reduce((sum, s) => sum + (s.totalDiasLaborables || 0), 0);

        const periodos = generarPeriodosVacaciones(colab.fechaAlta, colab.diasGozados || 0, enTramite);
        return res.json({
          success: true,
          colaborador: colab,
          periodos,
          periodosVigentes: periodos.filter(p => p.estadoVigencia === 'VIGENTE'),
          historialPeriodos: periodos.filter(p => p.estadoVigencia === 'CADUCADO' || p.estadoVigencia === 'AGOTADO'),
          saldoTotalDisponible: periodos.filter(p => p.estadoVigencia === 'VIGENTE').reduce((sum, p) => sum + p.diasDisponiblesPeriodo, 0)
        });
      }

      const pool = await getLocalPool();

      // Sincronizar períodos
      try {
        await pool.request().input('IdColaborador', Number(id)).execute('dbo.sp_CalcularSaldosVacaciones');
      } catch (e) {
        console.warn('[saldos.getKardexColaborador] Sync warning:', e.message);
      }

      // 1. Obtener datos del colaborador
      const colabRes = await pool.request()
        .input('Id', Number(id))
        .query(`
          SELECT 
            c.IdColaborador AS id, c.IdColaborador, c.CodigoEmpleado, c.Subfijo,
            c.NombreCompleto, c.Empresa, c.Sucursal, c.FechaAlta, c.FechaAltaImss,
            c.EstatusNomina, c.RolApp, c.Activo,
            p.Nombre AS Puesto, d.Nombre AS Departamento,
            j.NombreCompleto AS JefeDirectoNombre
          FROM dbo.Colaboradores c
          LEFT JOIN dbo.Puestos p ON p.IdPuesto = c.IdPuesto
          LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = c.IdDepartamento
          LEFT JOIN dbo.Colaboradores j ON j.IdColaborador = c.IdJefeDirecto
          WHERE c.IdColaborador = @Id
        `);

      const colab = colabRes.recordset[0];
      if (!colab) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      // 2. Obtener períodos de saldo de vacaciones
      const saldosRes = await pool.request()
        .input('Id', Number(id))
        .query(`
          SELECT 
            IdSaldo AS idSaldo,
            AnioPeriodo AS anioPeriodo,
            Periodo AS periodo,
            AntiguedadCumplida AS antiguedadCumplida,
            DiasCorrespondientes AS diasCorrespondientes,
            DiasGozados AS diasGozados,
            DiasPendientes AS diasPendientes,
            DiasEnTramite AS diasEnTramite,
            CONVERT(VARCHAR(10), FechaInicioVigencia, 120) AS fechaInicioVigencia,
            CONVERT(VARCHAR(10), FechaFinVigencia, 120) AS fechaFinVigencia,
            CONVERT(VARCHAR(10), FechaExpiracionPeriodo, 120) AS fechaExpiracionPeriodo,
            EsCerrado AS esCerrado,
            EsAjusteManual AS esAjusteManual,
            SaldoInicialManual AS saldoInicialManual,
            MotivoAjuste AS motivoAjuste,
            CONVERT(VARCHAR(19), FechaAjuste, 120) AS fechaAjuste
          FROM dbo.SaldosVacaciones
          WHERE IdColaborador = @Id
          ORDER BY AntiguedadCumplida ASC
        `);

      const hoy = new Date();
      const hoyStr = hoy.toISOString().split('T')[0];

      const periodosMapeados = saldosRes.recordset.map(s => {
        const periodoStr = s.periodo || `${s.anioPeriodo - 1}-${s.anioPeriodo}`;
        const diffDias = s.fechaFinVigencia 
          ? Math.ceil((new Date(s.fechaFinVigencia + 'T00:00:00') - hoy) / (1000 * 60 * 60 * 24))
          : 0;

        let estadoVigencia = 'VIGENTE';
        if (s.fechaFinVigencia && hoyStr > s.fechaFinVigencia) {
          estadoVigencia = 'CADUCADO';
        } else if (s.fechaInicioVigencia && hoyStr < s.fechaInicioVigencia) {
          estadoVigencia = 'EN_CURSO';
        } else if (s.diasPendientes <= 0) {
          estadoVigencia = 'AGOTADO';
        } else {
          estadoVigencia = 'VIGENTE';
        }

        const diasDisp = estadoVigencia === 'VIGENTE' 
          ? Math.max(0, s.diasPendientes - (s.diasEnTramite || 0)) 
          : 0;

        return {
          ...s,
          idSaldo: s.idSaldo,
          anioPeriodo: s.anioPeriodo,
          periodo: periodoStr,
          cicloTexto: `Año ${s.antiguedadCumplida} • Ciclo ${periodoStr}`,
          diasCorrespondientes: s.diasCorrespondientes,
          diasGozados: s.diasGozados,
          diasPendientes: s.diasPendientes,
          diasEnTramite: s.diasEnTramite || 0,
          diasDisponiblesPeriodo: diasDisp,
          fechaInicioVigencia: s.fechaInicioVigencia,
          fechaFinVigencia: s.fechaFinVigencia,
          fechaExpiracionPeriodo: s.fechaFinVigencia,
          diasRestantesVigencia: diffDias,
          estadoVigencia,
          esProximoAVencer: estadoVigencia === 'VIGENTE' && diffDias <= 60,
          esCerrado: Boolean(s.esCerrado || estadoVigencia === 'CADUCADO' || estadoVigencia === 'AGOTADO'),
          esAjusteManual: Boolean(s.esAjusteManual),
          saldoInicialManual: s.saldoInicialManual,
          motivoAjuste: s.motivoAjuste,
          fechaAjuste: s.fechaAjuste
        };
      });

      const periodosVigentes = periodosMapeados.filter(p => p.estadoVigencia === 'VIGENTE');
      const historialPeriodos = periodosMapeados.filter(p => p.estadoVigencia === 'CADUCADO' || p.estadoVigencia === 'AGOTADO');
      const saldoTotalDisponible = periodosVigentes.reduce((sum, p) => sum + p.diasDisponiblesPeriodo, 0);

      return res.json({
        success: true,
        colaborador: {
          ...colab,
          id: colab.IdColaborador,
          idColaborador: colab.IdColaborador,
          codigoEmpleado: colab.CodigoEmpleado,
          nombreCompleto: colab.NombreCompleto,
          empresa: colab.Empresa,
          sucursal: colab.Sucursal,
          fechaAlta: colab.FechaAlta ? new Date(colab.FechaAlta).toISOString().split('T')[0] : '—',
          puesto: colab.Puesto,
          departamento: colab.Departamento
        },
        periodos: periodosMapeados,
        periodosVigentes,
        historialPeriodos,
        saldoTotalDisponible
      });
    } catch (err) {
      console.error('[saldos.getKardexColaborador]', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/admin/saldos/ajuste-individual
   * Ajuste individual de saldo de vacaciones para un colaborador y período (ADMIN_DO / SISTEMAS)
   */
  ajusteIndividual: async (req, res) => {
    try {
      const { idColaborador, anioPeriodo, periodo, nuevoSaldo, motivo } = req.body;
      const idUsuarioAjusto = req.user?.id || 1;

      if (!idColaborador || nuevoSaldo === undefined || nuevoSaldo === null || nuevoSaldo < 0) {
        return res.status(400).json({ error: 'Datos incompletos o saldo inválido.' });
      }
      if (!motivo || !motivo.trim()) {
        return res.status(400).json({ error: 'El motivo del ajuste es obligatorio.' });
      }

      const saldoEntero = Math.floor(Number(nuevoSaldo));
      if (isNaN(saldoEntero) || saldoEntero < 0) {
        return res.status(400).json({ error: 'El saldo inicial debe ser un número entero mayor o igual a 0.' });
      }

      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        return res.json({
          success: true,
          message: 'Ajuste registrado en modo simulación.',
          nuevoSaldo: saldoEntero
        });
      }

      // 1. Obtener datos del colaborador
      const colabRes = await pool.request()
        .input('IdColaborador', Number(idColaborador))
        .query('SELECT IdColaborador, CodigoEmpleado, NombreCompleto, FechaAlta FROM dbo.Colaboradores WHERE IdColaborador = @IdColaborador');
      
      const colab = colabRes.recordset[0];
      if (!colab) {
        return res.status(404).json({ error: 'Colaborador no encontrado.' });
      }

      // 2. Buscar saldo existente
      let saldoRow = null;
      const targetReq = pool.request().input('IdColaborador', Number(idColaborador));
      if (anioPeriodo) {
        targetReq.input('AnioPeriodo', Number(anioPeriodo));
        const sRes = await targetReq.query('SELECT TOP 1 * FROM dbo.SaldosVacaciones WHERE IdColaborador = @IdColaborador AND AnioPeriodo = @AnioPeriodo');
        saldoRow = sRes.recordset[0];
      } else if (periodo) {
        targetReq.input('Periodo', String(periodo).trim());
        const sRes = await targetReq.query('SELECT TOP 1 * FROM dbo.SaldosVacaciones WHERE IdColaborador = @IdColaborador AND Periodo = @Periodo');
        saldoRow = sRes.recordset[0];
      }

      const periodoNombre = periodo || (saldoRow ? saldoRow.Periodo : (anioPeriodo ? `${anioPeriodo - 1}-${anioPeriodo}` : 'ACTUAL'));
      const saldoAnterior = saldoRow ? (saldoRow.DiasPendientes ?? (saldoRow.DiasCorrespondientes - (saldoRow.DiasGozados || 0))) : 0;
      const diferencia = saldoEntero - saldoAnterior;

      const tx = pool.transaction();
      await tx.begin();

      try {
        if (saldoRow) {
          let nuevosDiasCorrespondientes = saldoRow.DiasCorrespondientes;
          let nuevosDiasGozados = 0;
          if (saldoEntero <= saldoRow.DiasCorrespondientes) {
            nuevosDiasGozados = saldoRow.DiasCorrespondientes - saldoEntero;
          } else {
            nuevosDiasCorrespondientes = saldoEntero;
            nuevosDiasGozados = 0;
          }

          await tx.request()
            .input('IdSaldo', saldoRow.IdSaldo)
            .input('DiasCorrespondientes', nuevosDiasCorrespondientes)
            .input('DiasGozados', nuevosDiasGozados)
            .input('SaldoInicialManual', saldoEntero)
            .input('MotivoAjuste', motivo.trim())
            .input('IdUsuarioAjusto', idUsuarioAjusto)
            .query(`
              UPDATE dbo.SaldosVacaciones
              SET 
                DiasCorrespondientes = @DiasCorrespondientes,
                DiasGozados = @DiasGozados,
                SaldoInicialManual = @SaldoInicialManual,
                EsAjusteManual = 1,
                MotivoAjuste = @MotivoAjuste,
                FechaAjuste = SYSDATETIME(),
                IdUsuarioAjusto = @IdUsuarioAjusto,
                FechaUltimoCalculo = SYSDATETIME()
              WHERE IdSaldo = @IdSaldo;
            `);
        } else {
          const anioVal = anioPeriodo ? Number(anioPeriodo) : new Date().getFullYear();
          await tx.request()
            .input('IdColaborador', Number(idColaborador))
            .input('AnioPeriodo', anioVal)
            .input('Periodo', periodoNombre)
            .input('AntiguedadCumplida', 1)
            .input('DiasCorrespondientes', saldoEntero)
            .input('DiasGozados', 0)
            .input('SaldoInicialManual', saldoEntero)
            .input('MotivoAjuste', motivo.trim())
            .input('IdUsuarioAjusto', idUsuarioAjusto)
            .query(`
              INSERT INTO dbo.SaldosVacaciones (
                IdColaborador, AnioPeriodo, Periodo, AntiguedadCumplida,
                DiasCorrespondientes, DiasGozados, FechaInicioVigencia, FechaFinVigencia,
                FechaExpiracionPeriodo, EsCerrado, FechaUltimoCalculo, DiasEnTramite,
                SaldoInicialManual, EsAjusteManual, MotivoAjuste, FechaAjuste, IdUsuarioAjusto
              ) VALUES (
                @IdColaborador, @AnioPeriodo, @Periodo, @AntiguedadCumplida,
                @DiasCorrespondientes, @DiasGozados, GETDATE(), DATEADD(MONTH, 18, GETDATE()),
                DATEADD(MONTH, 18, GETDATE()), 0, SYSDATETIME(), 0,
                @SaldoInicialManual, 1, @MotivoAjuste, SYSDATETIME(), @IdUsuarioAjusto
              );
            `);
        }

        // Registrar en Bitácora
        await tx.request()
          .input('IdColaborador', Number(idColaborador))
          .input('Periodo', periodoNombre)
          .input('SaldoAnterior', saldoAnterior)
          .input('NuevoSaldo', saldoEntero)
          .input('DiferenciaDias', diferencia)
          .input('Motivo', motivo.trim())
          .input('IdUsuarioAjusto', idUsuarioAjusto)
          .query(`
            INSERT INTO dbo.BitacoraAjustesSaldo (
              IdColaborador, Periodo, SaldoAnterior, NuevoSaldo, DiferenciaDias, Motivo, IdUsuarioAjusto, FechaAjuste
            ) VALUES (
              @IdColaborador, @Periodo, @SaldoAnterior, @NuevoSaldo, @DiferenciaDias, @Motivo, @IdUsuarioAjusto, SYSDATETIME()
            );
          `);

        await tx.commit();

        return res.json({
          success: true,
          message: `Saldo inicial para el período ${periodoNombre} ajustado correctamente a ${saldoEntero} días.`,
          ajuste: {
            idColaborador,
            periodo: periodoNombre,
            saldoAnterior,
            nuevoSaldo: saldoEntero,
            diferencia,
            motivo: motivo.trim()
          }
        });
      } catch (txErr) {
        await tx.rollback();
        throw txErr;
      }
    } catch (err) {
      console.error('[saldos.ajusteIndividual]', err);
      res.status(500).json({ error: err.message || 'Error al guardar el ajuste de saldo.' });
    }
  },

  /**
   * GET /api/admin/saldos/plantilla-excel
   * Descarga la plantilla oficial en formato .xlsx para carga masiva por período
   */
  descargarPlantillaExcel: async (req, res) => {
    try {
      const XLSX = require('xlsx');

      const wb = XLSX.utils.book_new();

      const headers = [
        ['EMPRESA', 'NUM_NOMINA', 'PERIODO_EJERCICIO', 'DIAS_DERECHO_LFT', 'DIAS_GOZADOS', 'DIAS_RESTANTES', 'FECHA_ANIVERSARIO', 'FECHA_VENCE_18M', 'MOTIVO_AJUSTE']
      ];

      const dataRows = [
        ['Controladora JAMA', '0102', '2024-2025', 16, 16, 0, '2024-05-15', '2025-11-15', 'Carga inicial conciliada DO'],
        ['Controladora JAMA', '0102', '2025-2026', 18, 0, 18, '2025-05-15', '2026-11-15', 'Carga inicial conciliada DO'],
        ['Construjama', '0045', '2025-2026', 14, 4, 10, '2025-08-01', '2027-02-01', 'Carga inicial conciliada DO'],
        ['Distribuidora JAMA', '0122', '2025-2026', 20, 5, 15, '2025-03-10', '2026-09-10', 'Carga inicial conciliada DO']
      ];

      const ws = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);

      ws['!cols'] = [
        { wch: 25 }, // EMPRESA
        { wch: 15 }, // NUM_NOMINA
        { wch: 20 }, // PERIODO_EJERCICIO
        { wch: 18 }, // DIAS_DERECHO_LFT
        { wch: 15 }, // DIAS_GOZADOS
        { wch: 16 }, // DIAS_RESTANTES
        { wch: 20 }, // FECHA_ANIVERSARIO
        { wch: 20 }, // FECHA_VENCE_18M
        { wch: 35 }  // MOTIVO_AJUSTE
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'SaldosPorPeriodo');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Saldos_Iniciales_Grupo_JAMA.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    } catch (err) {
      console.error('[saldos.descargarPlantillaExcel]', err);
      res.status(500).json({ error: 'Error al generar la plantilla de Excel.' });
    }
  },

  /**
   * POST /api/admin/saldos/carga-masiva
   * Carga masiva de saldos iniciales por período desde Excel (ADMIN_DO / SISTEMAS)
   */
  cargaMasiva: async (req, res) => {
    try {
      const { registros } = req.body;
      const idUsuarioAjusto = req.user?.id || 1;

      if (!registros || !Array.isArray(registros) || registros.length === 0) {
        return res.status(400).json({ error: 'No se enviaron registros para procesar.' });
      }

      const pool = await getLocalPool();
      if (!pool || isUsingMock()) {
        return res.json({
          success: true,
          mensaje: `Se procesaron ${registros.length} registros en modo simulación.`,
          totalProcesados: registros.length,
          actualizados: registros.length,
          errores: []
        });
      }

      function normalizarTexto(txt) {
        if (!txt) return '';
        return String(txt).trim().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
      }

      function parseFechaExcel(val) {
        if (!val) return null;
        if (val instanceof Date) {
          if (isNaN(val.getTime())) return null;
          return val.toISOString().substring(0, 10);
        }
        if (typeof val === 'number') {
          const d = new Date(Math.round((val - 25569) * 86400 * 1000));
          if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
        }
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else if (parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
        return null;
      }

      function agregarMesesISO(fechaStr, meses) {
        if (!fechaStr) return null;
        const d = new Date(fechaStr + 'T00:00:00');
        if (isNaN(d.getTime())) return null;
        d.setMonth(d.getMonth() + meses);
        return d.toISOString().substring(0, 10);
      }

      // 1. Cargar catálogo de empresas para resolución exacta
      const empRes = await pool.request().query('SELECT IdEmpresa, AliasEmpresa, NombreBaseDatos FROM dbo.EmpresasNomipaq');
      const empresasMap = new Map();
      for (const e of empRes.recordset) {
        if (e.AliasEmpresa) empresasMap.set(normalizarTexto(e.AliasEmpresa), e.IdEmpresa);
        if (e.NombreBaseDatos) empresasMap.set(normalizarTexto(e.NombreBaseDatos), e.IdEmpresa);
      }

      // 2. Mapear colaboradores activos por Código y Empresa
      const colabsRes = await pool.request().query(`
        SELECT IdColaborador, CodigoEmpleado, IdEmpresa, Empresa, NombreCompleto, FechaAlta
        FROM dbo.Colaboradores
        WHERE Activo = 1;
      `);

      const colabsPorEmpresaYCodigo = new Map();
      const colabsPorCodigo = new Map();

      for (const c of colabsRes.recordset) {
        if (c.CodigoEmpleado) {
          const rawCod = String(c.CodigoEmpleado).trim();
          const padCod = rawCod.padStart(5, '0');
          const noZeroCod = rawCod.replace(/^0+/, '');
          const idEmp = c.IdEmpresa;

          if (idEmp) {
            colabsPorEmpresaYCodigo.set(`${idEmp}_${rawCod}`, c);
            colabsPorEmpresaYCodigo.set(`${idEmp}_${padCod}`, c);
            if (noZeroCod) colabsPorEmpresaYCodigo.set(`${idEmp}_${noZeroCod}`, c);
          }

          colabsPorCodigo.set(rawCod, c);
          colabsPorCodigo.set(padCod, c);
          if (noZeroCod) colabsPorCodigo.set(noZeroCod, c);
        }
      }

      const procesados = [];
      const errores = [];
      const hoyStr = new Date().toISOString().substring(0, 10);

      const tx = pool.transaction();
      await tx.begin();

      try {
        for (let i = 0; i < registros.length; i++) {
          const r = registros[i];
          const filaNum = r.fila || (i + 1);
          const empresaRaw = String(r.EMPRESA || r.empresa || r.Empresa || '').trim();
          const codigoRaw = String(r.NUM_NOMINA || r.num_nomina || r.NumNomina || r.CodigoEmpleado || r.codigoEmpleado || r.codigo || '').trim();
          const periodoRaw = String(r.PERIODO_EJERCICIO || r.periodo_ejercicio || r.PeriodoEjercicio || r.Periodo || r.periodo || '').trim();
          
          const diasDerechoRaw = r.DIAS_DERECHO_LFT ?? r.dias_derecho_lft ?? r.DiasDerechoLFT ?? r.diasDerecho ?? r.diasCorrespondientes;
          const diasGozadosRaw = r.DIAS_GOZADOS ?? r.dias_gozados ?? r.DiasGozados ?? r.diasGozados ?? 0;
          const diasRestantesRaw = r.DIAS_RESTANTES ?? r.dias_restantes ?? r.DiasRestantes ?? r.diasRestantes ?? r.DiasSaldoInicial ?? r.diasSaldoInicial;

          const fechaAnivRaw = r.FECHA_ANIVERSARIO || r.fecha_aniversario || r.FechaAniversario;
          const fechaVenceRaw = r.FECHA_VENCE_18M || r.fecha_vence_18m || r.FechaVence18M || r.FECHA_LIMITE_VIGENCIA || r.fecha_limite_vigencia || r.FechaLimiteVigencia;
          const motivoRaw = String(r.MOTIVO_AJUSTE || r.motivo_ajuste || r.MotivoAjuste || r.Motivo || r.motivo || 'Carga inicial conciliada DO').trim();

          if (!codigoRaw) {
            errores.push({ fila: filaNum, codigo: codigoRaw, error: 'Código de colaborador (NUM_NOMINA) no especificado' });
            continue;
          }

          // Resolver colaborador por empresa + código
          let idEmpresaResuelto = null;
          if (empresaRaw) {
            idEmpresaResuelto = empresasMap.get(normalizarTexto(empresaRaw));
          }

          let colab = null;
          if (idEmpresaResuelto) {
            colab = colabsPorEmpresaYCodigo.get(`${idEmpresaResuelto}_${codigoRaw}`) ||
                    colabsPorEmpresaYCodigo.get(`${idEmpresaResuelto}_${codigoRaw.padStart(5, '0')}`) ||
                    colabsPorEmpresaYCodigo.get(`${idEmpresaResuelto}_${codigoRaw.replace(/^0+/, '')}`);
          }
          if (!colab) {
            colab = colabsPorCodigo.get(codigoRaw) || 
                    colabsPorCodigo.get(codigoRaw.padStart(5, '0')) || 
                    colabsPorCodigo.get(codigoRaw.replace(/^0+/, ''));
          }

          if (!colab) {
            errores.push({ fila: filaNum, codigo: codigoRaw, error: `Colaborador con nómina "${codigoRaw}" ${empresaRaw ? 'en empresa "' + empresaRaw + '"' : ''} no encontrado o inactivo.` });
            continue;
          }

          if (!periodoRaw) {
            errores.push({ fila: filaNum, codigo: codigoRaw, error: 'El período (PERIODO_EJERCICIO) es obligatorio (ej. 2024-2025).' });
            continue;
          }

          // Parsing numérico
          const diasDerecho = Math.floor(Number(diasDerechoRaw));
          const diasGozados = Math.floor(Number(diasGozadosRaw));
          let diasRestantes = (diasRestantesRaw !== undefined && diasRestantesRaw !== null && diasRestantesRaw !== '') 
            ? Math.floor(Number(diasRestantesRaw)) 
            : (diasDerecho - diasGozados);

          if (isNaN(diasDerecho) || diasDerecho < 0) {
            errores.push({ fila: filaNum, codigo: codigoRaw, error: `Días derecho LFT inválido: "${diasDerechoRaw}". Debe ser un número >= 0.` });
            continue;
          }
          if (isNaN(diasGozados) || diasGozados < 0) {
            errores.push({ fila: filaNum, codigo: codigoRaw, error: `Días gozados inválido: "${diasGozadosRaw}". Debe ser un número >= 0.` });
            continue;
          }
          if (isNaN(diasRestantes) || diasRestantes < 0) {
            errores.push({ fila: filaNum, codigo: codigoRaw, error: `Días restantes inválido: "${diasRestantesRaw}". Debe ser un número >= 0.` });
            continue;
          }

          // Regla de coherencia matemática:
          if ((diasGozados + diasRestantes) > diasDerecho) {
            errores.push({ 
              fila: filaNum, 
              codigo: codigoRaw, 
              error: `Incoherencia matemática: La suma de Días Gozados (${diasGozados}) y Días Restantes (${diasRestantes}) excede los Días por Ley LFT (${diasDerecho}).` 
            });
            continue;
          }

          // Cálculo o asignación de fechas
          let fechaAniversario = parseFechaExcel(fechaAnivRaw);
          let anioPeriodo = new Date().getFullYear();
          const pParts = periodoRaw.split('-');
          if (pParts.length === 2 && !isNaN(parseInt(pParts[1], 10))) {
            anioPeriodo = parseInt(pParts[1], 10);
          } else if (!isNaN(parseInt(periodoRaw, 10))) {
            anioPeriodo = parseInt(periodoRaw, 10);
          }

          if (!fechaAniversario && colab.FechaAlta) {
            const altaDate = new Date(colab.FechaAlta);
            fechaAniversario = `${anioPeriodo}-${String(altaDate.getMonth() + 1).padStart(2, '0')}-${String(altaDate.getDate()).padStart(2, '0')}`;
          }

          let fechaVence18m = parseFechaExcel(fechaVenceRaw);
          if (!fechaVence18m && fechaAniversario) {
            fechaVence18m = agregarMesesISO(fechaAniversario, 18);
          }

          let antiguedadCumplida = 1;
          if (colab.FechaAlta) {
            antiguedadCumplida = Math.max(1, anioPeriodo - new Date(colab.FechaAlta).getFullYear());
          }

          const esCerrado = (fechaVence18m && hoyStr > fechaVence18m) || diasRestantes <= 0 ? 1 : 0;

          // Buscar saldo existente para este colaborador y período exacto
          const sRes = await tx.request()
            .input('IdColaborador', colab.IdColaborador)
            .input('Periodo', periodoRaw)
            .query('SELECT TOP 1 * FROM dbo.SaldosVacaciones WHERE IdColaborador = @IdColaborador AND Periodo = @Periodo');

          const saldoRow = sRes.recordset[0];
          const saldoAnterior = saldoRow ? (saldoRow.DiasPendientes ?? (saldoRow.DiasCorrespondientes - (saldoRow.DiasGozados || 0))) : 0;
          const diferencia = diasRestantes - saldoAnterior;

          if (saldoRow) {
            await tx.request()
              .input('IdSaldo', saldoRow.IdSaldo)
              .input('AnioPeriodo', anioPeriodo)
              .input('AntiguedadCumplida', antiguedadCumplida)
              .input('DiasCorrespondientes', diasDerecho)
              .input('DiasGozados', diasGozados)
              .input('SaldoInicialManual', diasRestantes)
              .input('MotivoAjuste', motivoRaw)
              .input('IdUsuarioAjusto', idUsuarioAjusto)
              .input('FechaInicioVigencia', fechaAniversario || null)
              .input('FechaFinVigencia', fechaVence18m || null)
              .input('EsCerrado', esCerrado)
              .query(`
                UPDATE dbo.SaldosVacaciones
                SET 
                  AnioPeriodo = @AnioPeriodo,
                  AntiguedadCumplida = @AntiguedadCumplida,
                  DiasCorrespondientes = @DiasCorrespondientes,
                  DiasGozados = @DiasGozados,
                  SaldoInicialManual = @SaldoInicialManual,
                  EsAjusteManual = 1,
                  MotivoAjuste = @MotivoAjuste,
                  FechaAjuste = SYSDATETIME(),
                  IdUsuarioAjusto = @IdUsuarioAjusto,
                  FechaInicioVigencia = ISNULL(@FechaInicioVigencia, FechaInicioVigencia),
                  FechaFinVigencia = ISNULL(@FechaFinVigencia, FechaFinVigencia),
                  FechaExpiracionPeriodo = ISNULL(@FechaFinVigencia, FechaExpiracionPeriodo),
                  EsCerrado = @EsCerrado,
                  FechaUltimoCalculo = SYSDATETIME()
                WHERE IdSaldo = @IdSaldo;
              `);
          } else {
            await tx.request()
              .input('IdColaborador', colab.IdColaborador)
              .input('AnioPeriodo', anioPeriodo)
              .input('Periodo', periodoRaw)
              .input('AntiguedadCumplida', antiguedadCumplida)
              .input('DiasCorrespondientes', diasDerecho)
              .input('DiasGozados', diasGozados)
              .input('FechaInicioVigencia', fechaAniversario || hoyStr)
              .input('FechaFinVigencia', fechaVence18m || agregarMesesISO(hoyStr, 18))
              .input('EsCerrado', esCerrado)
              .input('SaldoInicialManual', diasRestantes)
              .input('MotivoAjuste', motivoRaw)
              .input('IdUsuarioAjusto', idUsuarioAjusto)
              .query(`
                INSERT INTO dbo.SaldosVacaciones (
                  IdColaborador, AnioPeriodo, Periodo, AntiguedadCumplida,
                  DiasCorrespondientes, DiasGozados, FechaInicioVigencia, FechaFinVigencia,
                  FechaExpiracionPeriodo, EsCerrado, FechaUltimoCalculo, DiasEnTramite,
                  SaldoInicialManual, EsAjusteManual, MotivoAjuste, FechaAjuste, IdUsuarioAjusto
                ) VALUES (
                  @IdColaborador, @AnioPeriodo, @Periodo, @AntiguedadCumplida,
                  @DiasCorrespondientes, @DiasGozados, @FechaInicioVigencia, @FechaFinVigencia,
                  @FechaFinVigencia, @EsCerrado, SYSDATETIME(), 0,
                  @SaldoInicialManual, 1, @MotivoAjuste, SYSDATETIME(), @IdUsuarioAjusto
                );
              `);
          }

          // Registrar en Bitácora por cada ciclo cargado
          await tx.request()
            .input('IdColaborador', colab.IdColaborador)
            .input('Periodo', periodoRaw)
            .input('SaldoAnterior', saldoAnterior)
            .input('NuevoSaldo', diasRestantes)
            .input('DiferenciaDias', diferencia)
            .input('Motivo', motivoRaw)
            .input('IdUsuarioAjusto', idUsuarioAjusto)
            .query(`
              INSERT INTO dbo.BitacoraAjustesSaldo (
                IdColaborador, Periodo, SaldoAnterior, NuevoSaldo, DiferenciaDias, Motivo, IdUsuarioAjusto, FechaAjuste
              ) VALUES (
                @IdColaborador, @Periodo, @SaldoAnterior, @NuevoSaldo, @DiferenciaDias, @Motivo, @IdUsuarioAjusto, SYSDATETIME()
              );
            `);

          procesados.push({
            codigo: codigoRaw,
            colaborador: colab.NombreCompleto,
            empresa: colab.Empresa,
            periodo: periodoRaw,
            diasDerecho,
            diasGozados,
            diasRestantes,
            saldoAnterior,
            diferencia,
            fechaVence18m
          });
        }

        await tx.commit();

        return res.json({
          success: true,
          mensaje: `Se procesaron y actualizaron con éxito ${procesados.length} períodos de saldos iniciales.`,
          totalProcesados: registros.length,
          actualizados: procesados.length,
          procesados,
          errores
        });
      } catch (txErr) {
        await tx.rollback();
        throw txErr;
      }
    } catch (err) {
      console.error('[saldos.cargaMasiva]', err);
      res.status(500).json({ error: err.message || 'Error en la carga masiva de saldos.' });
    }
  },

  /**
   * GET /api/admin/saldos/bitacora/:id
   * Historial de auditoría de ajustes de saldo de un colaborador
   */
  getBitacoraColaborador: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getLocalPool();
      if (!pool || isUsingMock()) return res.json({ success: true, data: [] });

      const result = await pool.request()
        .input('IdColaborador', Number(id))
        .query(`
          SELECT 
            b.IdAjuste, b.IdColaborador, b.Periodo, b.SaldoAnterior, b.NuevoSaldo,
            b.DiferenciaDias, b.Motivo,
            CONVERT(VARCHAR(19), b.FechaAjuste, 120) AS FechaAjuste,
            u.NombreCompleto AS UsuarioAjusto
          FROM dbo.BitacoraAjustesSaldo b
          LEFT JOIN dbo.Colaboradores u ON u.IdColaborador = b.IdUsuarioAjusto
          WHERE b.IdColaborador = @IdColaborador
          ORDER BY b.FechaAjuste DESC;
        `);

      return res.json({ success: true, data: result.recordset });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = saldosController;
