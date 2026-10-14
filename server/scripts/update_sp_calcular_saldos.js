const { getLocalPool } = require('../src/config/database');

async function run() {
  try {
    const pool = await getLocalPool();
    console.log('[DB] Actualizando sp_CalcularSaldosVacaciones con protección de ajustes manuales...');
    
    await pool.request().query(`
CREATE OR ALTER PROCEDURE dbo.sp_CalcularSaldosVacaciones
    @IdColaborador INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        DECLARE @FechaHoy DATE = CAST(GETDATE() AS DATE);

        -- Tabla temporal de números para generar períodos por cada año de antigüedad
        ;WITH Numeros AS (
            SELECT 1 AS N
            UNION ALL
            SELECT N + 1 FROM Numeros WHERE N < 60
        ),
        Colabs AS (
            SELECT 
                c.IdColaborador,
                c.FechaAlta,
                c.FechaAlta AS FechaBaseAntiguedad,
                DATEDIFF(YEAR, c.FechaAlta, @FechaHoy) - 
                CASE 
                    WHEN (MONTH(@FechaHoy) < MONTH(c.FechaAlta)) OR 
                         (MONTH(@FechaHoy) = MONTH(c.FechaAlta) AND DAY(@FechaHoy) < DAY(c.FechaAlta)) 
                    THEN 1 
                    ELSE 0 
                END AS AntiguedadAnios
            FROM dbo.Colaboradores c
            WHERE c.Activo = 1 
              AND (@IdColaborador IS NULL OR c.IdColaborador = @IdColaborador)
        ),
        PeriodosCalculados AS (
            SELECT 
                c.IdColaborador,
                num.N AS AntiguedadCumplida,
                YEAR(DATEADD(YEAR, num.N, c.FechaBaseAntiguedad)) AS AnioPeriodo,
                CONCAT(YEAR(DATEADD(YEAR, num.N - 1, c.FechaBaseAntiguedad)), '-', YEAR(DATEADD(YEAR, num.N, c.FechaBaseAntiguedad))) AS Periodo,
                dbo.fn_CalcularDiasLFT(num.N) AS DiasCorrespondientes,
                DATEADD(YEAR, num.N, c.FechaBaseAntiguedad) AS FechaInicioVigencia,
                DATEADD(MONTH, 18, DATEADD(YEAR, num.N, c.FechaBaseAntiguedad)) AS FechaFinVigencia
            FROM Colabs c
            INNER JOIN Numeros num ON num.N <= c.AntiguedadAnios
            WHERE c.AntiguedadAnios >= 1
        )
        MERGE dbo.SaldosVacaciones AS Target
        USING PeriodosCalculados AS Source
        ON (Target.IdColaborador = Source.IdColaborador AND Target.AnioPeriodo = Source.AnioPeriodo)
        WHEN MATCHED THEN
            UPDATE SET 
                Target.AntiguedadCumplida = Source.AntiguedadCumplida,
                Target.DiasCorrespondientes = CASE 
                    WHEN Target.EsAjusteManual = 1 AND Target.DiasCorrespondientes > Source.DiasCorrespondientes 
                    THEN Target.DiasCorrespondientes 
                    ELSE Source.DiasCorrespondientes 
                END,
                Target.FechaInicioVigencia = Source.FechaInicioVigencia,
                Target.FechaFinVigencia = Source.FechaFinVigencia,
                Target.FechaExpiracionPeriodo = Source.FechaFinVigencia,
                Target.Periodo = Source.Periodo,
                Target.EsCerrado = CASE 
                    WHEN @FechaHoy > Source.FechaFinVigencia THEN 1 
                    WHEN (Target.DiasCorrespondientes - Target.DiasGozados) <= 0 THEN 1 
                    ELSE 0 
                END,
                Target.FechaUltimoCalculo = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (
                IdColaborador, AnioPeriodo, AntiguedadCumplida, 
                DiasCorrespondientes, DiasGozados, FechaInicioVigencia,
                FechaFinVigencia, FechaExpiracionPeriodo, Periodo,
                EsCerrado, FechaUltimoCalculo, DiasEnTramite,
                EsAjusteManual, SaldoInicialManual
            )
            VALUES (
                Source.IdColaborador, Source.AnioPeriodo, Source.AntiguedadCumplida, 
                Source.DiasCorrespondientes, 0, Source.FechaInicioVigencia,
                Source.FechaFinVigencia, Source.FechaFinVigencia, Source.Periodo,
                CASE WHEN @FechaHoy > Source.FechaFinVigencia THEN 1 ELSE 0 END,
                SYSDATETIME(), 0,
                0, NULL
            );

        -- B) Distribuir DiasEnTramite mediante PEPS sobre períodos VIGENTES
        UPDATE s
        SET s.DiasEnTramite = 0
        FROM dbo.SaldosVacaciones s
        WHERE (@IdColaborador IS NULL OR s.IdColaborador = @IdColaborador);

        DECLARE @CurColabId INT;
        DECLARE curColabsTramite CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT sol.IdColaborador
        FROM dbo.SolicitudesVacaciones sol
        WHERE sol.Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO')
          AND (@IdColaborador IS NULL OR sol.IdColaborador = @IdColaborador);

        OPEN curColabsTramite;
        FETCH NEXT FROM curColabsTramite INTO @CurColabId;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @TotalTramite DECIMAL(5,1) = 0.0;
            SELECT @TotalTramite = ISNULL(SUM(TotalDiasLaborables), 0.0)
            FROM dbo.SolicitudesVacaciones
            WHERE IdColaborador = @CurColabId 
              AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO');

            IF @TotalTramite > 0
            BEGIN
                DECLARE @CurIdSaldo INT, @CurDisp DECIMAL(5,1);
                DECLARE curSaldosVig CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, (DiasCorrespondientes - DiasGozados) AS DiasDisp
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @CurColabId
                  AND @FechaHoy >= FechaInicioVigencia
                  AND @FechaHoy <= FechaFinVigencia
                  AND (DiasCorrespondientes - DiasGozados) > 0
                ORDER BY FechaFinVigencia ASC, AnioPeriodo ASC;

                OPEN curSaldosVig;
                FETCH NEXT FROM curSaldosVig INTO @CurIdSaldo, @CurDisp;

                WHILE @@FETCH_STATUS = 0 AND @TotalTramite > 0
                BEGIN
                    IF @CurDisp >= @TotalTramite
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasEnTramite = @TotalTramite
                        WHERE IdSaldo = @CurIdSaldo;
                        SET @TotalTramite = 0;
                    END
                    ELSE
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasEnTramite = @CurDisp
                        WHERE IdSaldo = @CurIdSaldo;
                        SET @TotalTramite = @TotalTramite - @CurDisp;
                    END
                    FETCH NEXT FROM curSaldosVig INTO @CurIdSaldo, @CurDisp;
                END

                CLOSE curSaldosVig;
                DEALLOCATE curSaldosVig;
            END

            FETCH NEXT FROM curColabsTramite INTO @CurColabId;
        END

        CLOSE curColabsTramite;
        DEALLOCATE curColabsTramite;

    END TRY
    BEGIN CATCH
        PRINT 'Error al calcular saldos: ' + ERROR_MESSAGE();
        THROW;
    END CATCH
END;
    `);

    console.log('[OK] Stored procedure sp_CalcularSaldosVacaciones actualizado.');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR]', err);
    process.exit(1);
  }
}

run();
