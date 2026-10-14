-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 11_motor_vigencia_18_meses_lft.sql
-- DESCRIPCIÓN: Implementación del Motor de Vigencia de 18 Meses (Art. 81 y 516 LFT)
--              y Desglose Interactivo de Saldos por Período Anual
-- BASE DE DATOS: DESARROLLO_O
-- =================================================================================

USE DESARROLLO_O;
GO

-- 1. Asegurar columnas necesarias en dbo.SaldosVacaciones
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SaldosVacaciones' AND COLUMN_NAME='Periodo')
BEGIN
    ALTER TABLE dbo.SaldosVacaciones ADD Periodo VARCHAR(30) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SaldosVacaciones' AND COLUMN_NAME='FechaInicioVigencia')
BEGIN
    ALTER TABLE dbo.SaldosVacaciones ADD FechaInicioVigencia DATE NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SaldosVacaciones' AND COLUMN_NAME='FechaFinVigencia')
BEGIN
    ALTER TABLE dbo.SaldosVacaciones ADD FechaFinVigencia DATE NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SaldosVacaciones' AND COLUMN_NAME='DiasEnTramite')
BEGIN
    ALTER TABLE dbo.SaldosVacaciones ADD DiasEnTramite INT NOT NULL CONSTRAINT DF_Saldos_DiasEnTramite DEFAULT (0);
END
GO

-- 2. Stored Procedure: dbo.sp_CalcularSaldosVacaciones
-- Genera y sincroniza todos los períodos desde el aniversario 1 hasta AntigüedadCumplida
-- Calcula FechaInicioVigencia, FechaFinVigencia (+18 meses) y distribuye DiasEnTramite por PEPS.
CREATE OR ALTER PROCEDURE dbo.sp_CalcularSaldosVacaciones
    @IdColaborador INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaHoy DATE = CAST(SYSDATETIME() AS DATE);

    BEGIN TRY
        -- A) Tally/Numbers CTE para generar aniversarios 1 a 50
        ;WITH Numeros AS (
            SELECT 1 AS N
            UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
            UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
            UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
            UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
            UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
            UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
            UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
            UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45
            UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49 UNION ALL SELECT 50
        ),
        Colabs AS (
            SELECT 
                c.IdColaborador,
                c.FechaAlta,
                CASE 
                    WHEN c.FechaReingreso IS NOT NULL AND c.FechaReingreso > '1950-01-01' AND c.FechaReingreso > c.FechaAlta 
                    THEN c.FechaReingreso 
                    ELSE c.FechaAlta 
                END AS FechaBaseAntiguedad,
                DATEDIFF(YEAR, 
                    CASE 
                        WHEN c.FechaReingreso IS NOT NULL AND c.FechaReingreso > '1950-01-01' AND c.FechaReingreso > c.FechaAlta 
                        THEN c.FechaReingreso 
                        ELSE c.FechaAlta 
                    END, 
                    @FechaHoy
                ) - 
                    CASE 
                        WHEN DATEADD(YEAR, 
                            DATEDIFF(YEAR, 
                                CASE 
                                    WHEN c.FechaReingreso IS NOT NULL AND c.FechaReingreso > '1950-01-01' AND c.FechaReingreso > c.FechaAlta 
                                    THEN c.FechaReingreso 
                                    ELSE c.FechaAlta 
                                END, 
                                @FechaHoy
                            ), 
                            CASE 
                                WHEN c.FechaReingreso IS NOT NULL AND c.FechaReingreso > '1950-01-01' AND c.FechaReingreso > c.FechaAlta 
                                THEN c.FechaReingreso 
                                ELSE c.FechaAlta 
                            END
                        ) > @FechaHoy 
                        THEN 1 ELSE 0 
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
                Target.DiasCorrespondientes = Source.DiasCorrespondientes,
                Target.FechaInicioVigencia = Source.FechaInicioVigencia,
                Target.FechaFinVigencia = Source.FechaFinVigencia,
                Target.FechaExpiracionPeriodo = Source.FechaFinVigencia,
                Target.Periodo = Source.Periodo,
                Target.EsCerrado = CASE 
                    WHEN @FechaHoy > Source.FechaFinVigencia THEN 1 
                    WHEN (Source.DiasCorrespondientes - Target.DiasGozados) <= 0 THEN 1 
                    ELSE 0 
                END,
                Target.FechaUltimoCalculo = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (
                IdColaborador, AnioPeriodo, AntiguedadCumplida, 
                DiasCorrespondientes, DiasGozados, FechaInicioVigencia,
                FechaFinVigencia, FechaExpiracionPeriodo, Periodo,
                EsCerrado, FechaUltimoCalculo, DiasEnTramite
            )
            VALUES (
                Source.IdColaborador, Source.AnioPeriodo, Source.AntiguedadCumplida, 
                Source.DiasCorrespondientes, 0, Source.FechaInicioVigencia,
                Source.FechaFinVigencia, Source.FechaFinVigencia, Source.Periodo,
                CASE WHEN @FechaHoy > Source.FechaFinVigencia THEN 1 ELSE 0 END,
                SYSDATETIME(), 0
            );

        -- B) Distribuir DiasEnTramite mediante PEPS sobre períodos VIGENTES
        -- Resetear primero
        UPDATE s
        SET s.DiasEnTramite = 0
        FROM dbo.SaldosVacaciones s
        WHERE (@IdColaborador IS NULL OR s.IdColaborador = @IdColaborador);

        -- Cursor de colaboradores con solicitudes en trámite
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
GO

-- 3. Actualizar dbo.sp_RegistrarSolicitudVacaciones con validación estricta de saldo VIGENTE
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarSolicitudVacaciones
    @IdColaborador      INT,
    @FechaInicio        DATE,
    @FechaFin           DATE,
    @MotivoComentarios  VARCHAR(500) = NULL,
    @IdSolicitudCreada  INT OUTPUT,
    @FolioGenerado      VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Activo BIT, @Jornada INT, @IdJefe INT, @DiasDescanso VARCHAR(150);
        SELECT 
            @Activo = Activo, 
            @Jornada = ISNULL(JornadaLaboralDias, 6), 
            @IdJefe = IdJefeDirecto,
            @DiasDescanso = ISNULL(DiasDescanso, 'DOMINGO')
        FROM dbo.Colaboradores
        WHERE IdColaborador = @IdColaborador;

        IF @Activo IS NULL OR @Activo = 0
            THROW 50001, 'El colaborador especificado no está activo en el sistema.', 1;

        DECLARE @DescansoNormSP VARCHAR(200) = UPPER(@DiasDescanso);

        -- Validar descanso inicio
        DECLARE @DiaInicioIndex INT = (DATEPART(WEEKDAY, @FechaInicio) + @@DATEFIRST - 1) % 7;
        DECLARE @DiaInicioNorm VARCHAR(20) = CASE @DiaInicioIndex
            WHEN 0 THEN 'DOMINGO' WHEN 1 THEN 'LUNES' WHEN 2 THEN 'MARTES'
            WHEN 3 THEN 'MIERCOLES' WHEN 4 THEN 'JUEVES' WHEN 5 THEN 'VIERNES' WHEN 6 THEN 'SABADO'
        END;
        IF @DescansoNormSP LIKE '%' + @DiaInicioNorm + '%' 
           OR (@DiaInicioNorm = 'SABADO' AND @DescansoNormSP LIKE '%SÁBADO%')
           OR (@DiaInicioNorm = 'MIERCOLES' AND @DescansoNormSP LIKE '%MIÉRCOLES%')
        BEGIN
            DECLARE @MsgInicio NVARCHAR(200) = CONCAT('La fecha de inicio no puede ser un día de descanso semanal programado para el colaborador (', @DiaInicioNorm, ').');
            THROW 50005, @MsgInicio, 1;
        END

        -- Validar descanso fin
        DECLARE @DiaFinIndex INT = (DATEPART(WEEKDAY, @FechaFin) + @@DATEFIRST - 1) % 7;
        DECLARE @DiaFinNorm VARCHAR(20) = CASE @DiaFinIndex
            WHEN 0 THEN 'DOMINGO' WHEN 1 THEN 'LUNES' WHEN 2 THEN 'MARTES'
            WHEN 3 THEN 'MIERCOLES' WHEN 4 THEN 'JUEVES' WHEN 5 THEN 'VIERNES' WHEN 6 THEN 'SABADO'
        END;
        IF @DescansoNormSP LIKE '%' + @DiaFinNorm + '%' 
           OR (@DiaFinNorm = 'SABADO' AND @DescansoNormSP LIKE '%SÁBADO%')
           OR (@DiaFinNorm = 'MIERCOLES' AND @DescansoNormSP LIKE '%MIÉRCOLES%')
        BEGIN
            DECLARE @MsgFin NVARCHAR(200) = CONCAT('La fecha de fin no puede ser un día de descanso semanal programado para el colaborador (', @DiaFinNorm, ').');
            THROW 50006, @MsgFin, 1;
        END

        DECLARE @DiasLaborables DECIMAL(4,1);
        SET @DiasLaborables = dbo.fn_CalcularDiasHabiles(@FechaInicio, @FechaFin, @Jornada, @DiasDescanso);

        IF @DiasLaborables <= 0
            THROW 50002, 'El rango seleccionado no contiene ningún día hábil laborable.', 1;

        -- Regla LFT 18 Meses: Solo sumar períodos VIGENTES
        DECLARE @FechaHoy DATE = CAST(SYSDATETIME() AS DATE);
        DECLARE @SaldoVigente DECIMAL(5,1) = 0.0;
        SELECT @SaldoVigente = ISNULL(SUM(DiasPendientes), 0.0)
        FROM dbo.SaldosVacaciones
        WHERE IdColaborador = @IdColaborador 
          AND EsCerrado = 0
          AND @FechaHoy >= FechaInicioVigencia 
          AND @FechaHoy <= FechaFinVigencia;

        DECLARE @DiasEnTramite DECIMAL(5,1) = 0.0;
        SELECT @DiasEnTramite = ISNULL(SUM(TotalDiasLaborables), 0.0)
        FROM dbo.SolicitudesVacaciones
        WHERE IdColaborador = @IdColaborador AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO');

        IF (@SaldoVigente - @DiasEnTramite) < @DiasLaborables
        BEGIN
            DECLARE @MsgErr NVARCHAR(200) = CONCAT('Saldo insuficiente. Disponibles vigentes (18 meses): ', (@SaldoVigente - @DiasEnTramite), ' días. Solicitados: ', @DiasLaborables, ' días.');
            THROW 50003, @MsgErr, 1;
        END

        IF EXISTS (
            SELECT 1 
            FROM dbo.SolicitudesVacaciones
            WHERE IdColaborador = @IdColaborador
              AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO', 'APROBADA')
              AND @FechaInicio <= FechaFin 
              AND @FechaFin >= FechaInicio
        )
        BEGIN
            THROW 50004, 'Ya existe una solicitud en trámite o aprobada en este rango de fechas.', 1;
        END

        DECLARE @AnioActual INT = YEAR(SYSDATETIME());
        DECLARE @Consecutivo INT;
        SELECT @Consecutivo = COUNT(*) + 1 
        FROM dbo.SolicitudesVacaciones 
        WHERE YEAR(FechaCreacion) = @AnioActual;

        SET @FolioGenerado = CONCAT('VAC-', @AnioActual, '-', RIGHT('00000' + CAST(@Consecutivo AS VARCHAR(5)), 5));

        INSERT INTO dbo.SolicitudesVacaciones (
            Folio, IdColaborador, FechaCreacion, FechaInicio, 
            FechaFin, TotalDiasLaborables, MotivoComentarios, Estado
        )
        VALUES (
            @FolioGenerado, @IdColaborador, SYSDATETIME(), @FechaInicio, 
            @FechaFin, @DiasLaborables, @MotivoComentarios, 'PENDIENTE_LIDER'
        );

        SET @IdSolicitudCreada = SCOPE_IDENTITY();

        INSERT INTO dbo.HistorialAprobaciones (
            IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion
        )
        VALUES (
            @IdSolicitudCreada, @IdColaborador, 'COLABORADOR', 'ENVIADA', 'Solicitud registrada e ingresada al flujo de autorización', 'WEB'
        );

        -- Re-balancear DiasEnTramite en dbo.SaldosVacaciones
        EXEC dbo.sp_CalcularSaldosVacaciones @IdColaborador;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4. Actualizar dbo.sp_ProcesarAprobacionSolicitud para descontar con PEPS sobre períodos VIGENTES
CREATE OR ALTER PROCEDURE dbo.sp_ProcesarAprobacionSolicitud
    @IdSolicitud            INT,
    @IdAprobador            INT,
    @Accion                 VARCHAR(20),      -- 'APROBADA', 'RECHAZADA'
    @Comentarios            VARCHAR(500) = NULL,
    @MetodoAutorizacion     VARCHAR(20) = 'WEB',
    @DireccionIP            VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EstadoActual VARCHAR(25), @IdColaborador INT, @Dias DECIMAL(4,1);
        SELECT 
            @EstadoActual = Estado, 
            @IdColaborador = IdColaborador, 
            @Dias = TotalDiasLaborables
        FROM dbo.SolicitudesVacaciones WITH (UPDLOCK, ROWLOCK)
        WHERE IdSolicitud = @IdSolicitud;

        IF @EstadoActual IS NULL
            THROW 50010, 'La solicitud no existe.', 1;

        IF @EstadoActual NOT IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO')
            THROW 50011, 'La solicitud no se encuentra en un estado pendiente de aprobación.', 1;

        DECLARE @RolAprobador VARCHAR(20);
        SELECT @RolAprobador = RolApp FROM dbo.Colaboradores WHERE IdColaborador = @IdAprobador;

        DECLARE @IdJefeDirecto INT, @IdAprobadorSegundo INT;
        SELECT 
            @IdJefeDirecto = IdJefeDirecto,
            @IdAprobadorSegundo = IdAprobadorSegundo
        FROM dbo.Colaboradores 
        WHERE IdColaborador = @IdColaborador;

        -- CASO 1: RECHAZO
        IF @Accion = 'RECHAZADA'
        BEGIN
            IF (LTRIM(RTRIM(ISNULL(@Comentarios, ''))) = '')
                THROW 50012, 'El motivo de rechazo es obligatorio para registrar la resolución.', 1;

            UPDATE dbo.SolicitudesVacaciones
            SET 
                Estado = 'RECHAZADA',
                FechaResolucion = SYSDATETIME(),
                IdAprobadorFinal = @IdAprobador,
                MotivoRechazo = @Comentarios
            WHERE IdSolicitud = @IdSolicitud;

            INSERT INTO dbo.HistorialAprobaciones (
                IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
            )
            VALUES (
                @IdSolicitud, @IdAprobador, 
                CASE 
                    WHEN @RolAprobador = 'ADMIN_DO' THEN 'DESARROLLO_ORGANIZACIONAL'
                    WHEN @EstadoActual = 'PENDIENTE_GERENTE' THEN 'GERENTE_SUCURSAL'
                    ELSE 'LIDER_DIRECTO' 
                END,
                'RECHAZADA', @Comentarios, @MetodoAutorizacion, @DireccionIP
            );

            -- Re-balancear DiasEnTramite
            EXEC dbo.sp_CalcularSaldosVacaciones @IdColaborador;
        END
        -- CASO 2: APROBACIÓN
        ELSE IF @Accion = 'APROBADA'
        BEGIN
            -- 2.1 Aprobación Nivel 1 (Jefe Directo)
            IF @EstadoActual = 'PENDIENTE_LIDER'
            BEGIN
                IF @IdAprobadorSegundo IS NOT NULL AND @RolAprobador <> 'ADMIN_DO'
                BEGIN
                    UPDATE dbo.SolicitudesVacaciones
                    SET 
                        Estado = 'PENDIENTE_GERENTE',
                        IdAprobadorLider = @IdAprobador,
                        FechaAprobacionLider = SYSDATETIME()
                    WHERE IdSolicitud = @IdSolicitud;

                    INSERT INTO dbo.HistorialAprobaciones (
                        IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                    )
                    VALUES (
                        @IdSolicitud, @IdAprobador, 'LIDER_DIRECTO', 'APROBADA', 
                        ISNULL(@Comentarios, 'Visto Bueno Nivel 1 (Jefe Directo). Enviada a autorización gerencial.'), 
                        @MetodoAutorizacion, @DireccionIP
                    );
                END
                ELSE
                BEGIN
                    -- Aprobación Directa Final
                    UPDATE dbo.SolicitudesVacaciones
                    SET 
                        Estado = 'APROBADA',
                        FechaResolucion = SYSDATETIME(),
                        IdAprobadorLider = @IdAprobador,
                        FechaAprobacionLider = SYSDATETIME(),
                        IdAprobadorFinal = @IdAprobador
                    WHERE IdSolicitud = @IdSolicitud;

                    INSERT INTO dbo.HistorialAprobaciones (
                        IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                    )
                    VALUES (
                        @IdSolicitud, @IdAprobador, 
                        CASE WHEN @RolAprobador = 'ADMIN_DO' THEN 'DESARROLLO_ORGANIZACIONAL' ELSE 'LIDER_DIRECTO' END, 
                        'APROBADA', 
                        ISNULL(@Comentarios, 'Autorización completa. Período registrado y saldos descontados.'), 
                        @MetodoAutorizacion, @DireccionIP
                    );

                    -- Descontar con PEPS (período vigente más próximo a vencer primero)
                    DECLARE @DiasPorDescontar1 DECIMAL(5,1) = @Dias;
                    DECLARE @IdSaldoCurrent1 INT, @PendienteCurrent1 DECIMAL(5,1);

                    DECLARE curSaldos1 CURSOR LOCAL FAST_FORWARD FOR
                    SELECT IdSaldo, DiasPendientes
                    FROM dbo.SaldosVacaciones
                    WHERE IdColaborador = @IdColaborador 
                      AND EsCerrado = 0 
                      AND DiasPendientes > 0
                      AND FechaFinVigencia >= CAST(SYSDATETIME() AS DATE)
                    ORDER BY FechaFinVigencia ASC, AnioPeriodo ASC;

                    OPEN curSaldos1;
                    FETCH NEXT FROM curSaldos1 INTO @IdSaldoCurrent1, @PendienteCurrent1;

                    WHILE @@FETCH_STATUS = 0 AND @DiasPorDescontar1 > 0
                    BEGIN
                        IF @PendienteCurrent1 >= @DiasPorDescontar1
                        BEGIN
                            UPDATE dbo.SaldosVacaciones
                            SET DiasGozados = DiasGozados + @DiasPorDescontar1,
                                FechaUltimoCalculo = SYSDATETIME()
                            WHERE IdSaldo = @IdSaldoCurrent1;
                            SET @DiasPorDescontar1 = 0;
                        END
                        ELSE
                        BEGIN
                            UPDATE dbo.SaldosVacaciones
                            SET DiasGozados = DiasGozados + @PendienteCurrent1,
                                EsCerrado = 1,
                                FechaUltimoCalculo = SYSDATETIME()
                            WHERE IdSaldo = @IdSaldoCurrent1;
                            SET @DiasPorDescontar1 = @DiasPorDescontar1 - @PendienteCurrent1;
                        END

                        FETCH NEXT FROM curSaldos1 INTO @IdSaldoCurrent1, @PendienteCurrent1;
                    END

                    CLOSE curSaldos1;
                    DEALLOCATE curSaldos1;

                    -- Re-balancear períodos
                    EXEC dbo.sp_CalcularSaldosVacaciones @IdColaborador;
                END
            END
            -- 2.2 Aprobación Nivel 2 (Gerente de Sucursal)
            ELSE IF @EstadoActual = 'PENDIENTE_GERENTE'
            BEGIN
                UPDATE dbo.SolicitudesVacaciones
                SET 
                    Estado = 'APROBADA',
                    FechaResolucion = SYSDATETIME(),
                    IdAprobadorSegundo = @IdAprobador,
                    FechaAprobacionSegundo = SYSDATETIME(),
                    IdAprobadorFinal = @IdAprobador
                WHERE IdSolicitud = @IdSolicitud;

                INSERT INTO dbo.HistorialAprobaciones (
                    IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                )
                VALUES (
                    @IdSolicitud, @IdAprobador, 'GERENTE_SUCURSAL', 'APROBADA', 
                    ISNULL(@Comentarios, 'Autorización Nivel 2 (Gerente de Sucursal / Planta). Período formalizado.'), 
                    @MetodoAutorizacion, @DireccionIP
                );

                -- Descontar con PEPS
                DECLARE @DiasPorDescontar2 DECIMAL(5,1) = @Dias;
                DECLARE @IdSaldoCurrent2 INT, @PendienteCurrent2 DECIMAL(5,1);

                DECLARE curSaldos2 CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, DiasPendientes
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @IdColaborador 
                  AND EsCerrado = 0 
                  AND DiasPendientes > 0
                  AND FechaFinVigencia >= CAST(SYSDATETIME() AS DATE)
                ORDER BY FechaFinVigencia ASC, AnioPeriodo ASC;

                OPEN curSaldos2;
                FETCH NEXT FROM curSaldos2 INTO @IdSaldoCurrent2, @PendienteCurrent2;

                WHILE @@FETCH_STATUS = 0 AND @DiasPorDescontar2 > 0
                BEGIN
                    IF @PendienteCurrent2 >= @DiasPorDescontar2
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasGozados + @DiasPorDescontar2,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent2;
                        SET @DiasPorDescontar2 = 0;
                    END
                    ELSE
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasGozados + @PendienteCurrent2,
                            EsCerrado = 1,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent2;
                        SET @DiasPorDescontar2 = @DiasPorDescontar2 - @PendienteCurrent2;
                    END

                    FETCH NEXT FROM curSaldos2 INTO @IdSaldoCurrent2, @PendienteCurrent2;
                END

                CLOSE curSaldos2;
                DEALLOCATE curSaldos2;

                EXEC dbo.sp_CalcularSaldosVacaciones @IdColaborador;
            END
            -- 2.3 Aprobación DO
            ELSE IF @EstadoActual = 'PENDIENTE_DO'
            BEGIN
                UPDATE dbo.SolicitudesVacaciones
                SET 
                    Estado = 'APROBADA',
                    FechaResolucion = SYSDATETIME(),
                    IdAprobadorFinal = @IdAprobador
                WHERE IdSolicitud = @IdSolicitud;

                INSERT INTO dbo.HistorialAprobaciones (
                    IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                )
                VALUES (
                    @IdSolicitud, @IdAprobador, 'DESARROLLO_ORGANIZACIONAL', 'APROBADA', 
                    ISNULL(@Comentarios, 'VoBo final de Desarrollo Organizacional.'), 
                    @MetodoAutorizacion, @DireccionIP
                );

                -- Descontar con PEPS
                DECLARE @DiasPorDescontar3 DECIMAL(5,1) = @Dias;
                DECLARE @IdSaldoCurrent3 INT, @PendienteCurrent3 DECIMAL(5,1);

                DECLARE curSaldos3 CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, DiasPendientes
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @IdColaborador 
                  AND EsCerrado = 0 
                  AND DiasPendientes > 0
                  AND FechaFinVigencia >= CAST(SYSDATETIME() AS DATE)
                ORDER BY FechaFinVigencia ASC, AnioPeriodo ASC;

                OPEN curSaldos3;
                FETCH NEXT FROM curSaldos3 INTO @IdSaldoCurrent3, @PendienteCurrent3;

                WHILE @@FETCH_STATUS = 0 AND @DiasPorDescontar3 > 0
                BEGIN
                    IF @PendienteCurrent3 >= @DiasPorDescontar3
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasGozados + @DiasPorDescontar3,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent3;
                        SET @DiasPorDescontar3 = 0;
                    END
                    ELSE
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasGozados + @PendienteCurrent3,
                            EsCerrado = 1,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent3;
                        SET @DiasPorDescontar3 = @DiasPorDescontar3 - @PendienteCurrent3;
                    END

                    FETCH NEXT FROM curSaldos3 INTO @IdSaldoCurrent3, @PendienteCurrent3;
                END

                CLOSE curSaldos3;
                DEALLOCATE curSaldos3;

                EXEC dbo.sp_CalcularSaldosVacaciones @IdColaborador;
            END
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 5. Ejecutar la sincronización inicial de saldos para todos los colaboradores activos
EXEC dbo.sp_CalcularSaldosVacaciones;
GO

PRINT 'Motor de Vigencia 18 Meses instalado y saldos sincronizados con éxito.';
