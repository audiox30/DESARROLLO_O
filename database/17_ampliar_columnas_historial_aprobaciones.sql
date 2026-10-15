-- =========================================================================
-- Script 17: Corrección de Truncamiento en dbo.HistorialAprobaciones
-- Ampliación de columnas de texto descriptivo (NivelAprobacion, Accion, Comentarios, etc.)
-- Control de Vacaciones - Grupo JAMA (Desarrollo Organizacional)
-- =========================================================================

USE [DESARROLLO_O];
GO

SET NOCOUNT ON;
GO

PRINT '=========================================================================';
PRINT 'Iniciando migración de ampliación de tipos de datos en dbo.HistorialAprobaciones...';
PRINT '=========================================================================';
GO

-- 1. Ampliar NivelAprobacion en dbo.HistorialAprobaciones a VARCHAR(100) NOT NULL
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'HistorialAprobaciones' AND COLUMN_NAME = 'NivelAprobacion'
)
BEGIN
    ALTER TABLE dbo.HistorialAprobaciones ALTER COLUMN NivelAprobacion VARCHAR(100) NOT NULL;
    PRINT '[OK] Columna dbo.HistorialAprobaciones.NivelAprobacion ampliada a VARCHAR(100) NOT NULL.';
END
GO

-- 2. Ampliar Accion en dbo.HistorialAprobaciones a VARCHAR(50) NOT NULL
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'HistorialAprobaciones' AND COLUMN_NAME = 'Accion'
)
BEGIN
    ALTER TABLE dbo.HistorialAprobaciones ALTER COLUMN Accion VARCHAR(50) NOT NULL;
    PRINT '[OK] Columna dbo.HistorialAprobaciones.Accion ampliada a VARCHAR(50) NOT NULL.';
END
GO

-- 3. Ampliar MetodoAutorizacion en dbo.HistorialAprobaciones a VARCHAR(50) NULL
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'HistorialAprobaciones' AND COLUMN_NAME = 'MetodoAutorizacion'
)
BEGIN
    ALTER TABLE dbo.HistorialAprobaciones ALTER COLUMN MetodoAutorizacion VARCHAR(50) NULL;
    PRINT '[OK] Columna dbo.HistorialAprobaciones.MetodoAutorizacion ampliada a VARCHAR(50) NULL.';
END
GO

-- 4. Ampliar Comentarios en dbo.HistorialAprobaciones a VARCHAR(1000) NULL
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'HistorialAprobaciones' AND COLUMN_NAME = 'Comentarios'
)
BEGIN
    ALTER TABLE dbo.HistorialAprobaciones ALTER COLUMN Comentarios VARCHAR(1000) NULL;
    PRINT '[OK] Columna dbo.HistorialAprobaciones.Comentarios ampliada a VARCHAR(1000) NULL.';
END
GO

-- 5. Ampliar Estado y MotivoRechazo en dbo.SolicitudesVacaciones para mayor tolerancia
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'SolicitudesVacaciones' AND COLUMN_NAME = 'Estado'
)
BEGIN
    ALTER TABLE dbo.SolicitudesVacaciones ALTER COLUMN Estado VARCHAR(50) NOT NULL;
    PRINT '[OK] Columna dbo.SolicitudesVacaciones.Estado ampliada a VARCHAR(50) NOT NULL.';
END
GO

IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'SolicitudesVacaciones' AND COLUMN_NAME = 'MotivoRechazo'
)
BEGIN
    ALTER TABLE dbo.SolicitudesVacaciones ALTER COLUMN MotivoRechazo VARCHAR(1000) NULL;
    PRINT '[OK] Columna dbo.SolicitudesVacaciones.MotivoRechazo ampliada a VARCHAR(1000) NULL.';
END
GO

-- 6. Actualizar procedimiento almacenado dbo.sp_ProcesarAprobacionSolicitud
--    para admitir parámetros ampliados y permitir Vo.Bo. de DO sin error de truncamiento
CREATE OR ALTER PROCEDURE dbo.sp_ProcesarAprobacionSolicitud
    @IdSolicitud            INT,
    @IdAprobador            INT,
    @Accion                 VARCHAR(50),      -- 'APROBADA', 'RECHAZADA'
    @Comentarios            VARCHAR(1000) = NULL,
    @MetodoAutorizacion     VARCHAR(50) = 'WEB',
    @DireccionIP            VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EstadoActual VARCHAR(50), @IdColaborador INT, @Dias DECIMAL(4,1);
        SELECT 
            @EstadoActual = Estado, 
            @IdColaborador = IdColaborador, 
            @Dias = TotalDiasLaborables
        FROM dbo.SolicitudesVacaciones WITH (UPDLOCK, ROWLOCK)
        WHERE IdSolicitud = @IdSolicitud;

        IF @EstadoActual IS NULL
            THROW 50010, 'La solicitud no existe.', 1;

        -- Permitir aprobación si está pendiente de líder, gerente, DO, o si DO otorga Vo.Bo. final de cierre
        IF @EstadoActual NOT IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO', 'APROBADA')
            THROW 50011, 'La solicitud no se encuentra en un estado pendiente de aprobación o resolución.', 1;

        DECLARE @RolAprobador VARCHAR(50);
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
                    WHEN @RolAprobador = 'ADMIN_DO' OR @MetodoAutorizacion = 'WEB_DO' THEN 'DESARROLLO_ORGANIZACIONAL'
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
                IF @IdAprobadorSegundo IS NOT NULL AND @RolAprobador <> 'ADMIN_DO' AND @MetodoAutorizacion <> 'WEB_DO'
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
                        CASE WHEN @RolAprobador = 'ADMIN_DO' OR @MetodoAutorizacion = 'WEB_DO' THEN 'DESARROLLO_ORGANIZACIONAL' ELSE 'LIDER_DIRECTO' END, 
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
            -- 2.3 Aprobación / Vo.Bo. por Desarrollo Organizacional
            ELSE IF @EstadoActual IN ('PENDIENTE_DO', 'APROBADA')
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

                -- Solo descontar con PEPS si venía de PENDIENTE_DO (si ya era APROBADA, ya se descontó previamente)
                IF @EstadoActual = 'PENDIENTE_DO'
                BEGIN
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
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT '[OK] Migración 17 aplicada exitosamente en base de datos DESARROLLO_O.';
GO
