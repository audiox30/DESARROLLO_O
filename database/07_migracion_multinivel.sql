-- =================================================================================
-- MIGRACIÓN: APROBACIÓN ESCALONADA EN 2 NIVELES (LÍDER + GERENTE)
-- =================================================================================
USE [DESARROLLO_O];
GO

-- 1. Agregar columna IdAprobadorSegundo a dbo.Colaboradores
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Colaboradores' AND COLUMN_NAME = 'IdAprobadorSegundo')
BEGIN
    ALTER TABLE dbo.Colaboradores ADD IdAprobadorSegundo INT NULL;
    ALTER TABLE dbo.Colaboradores ADD CONSTRAINT FK_Colaboradores_AprobadorSegundo FOREIGN KEY (IdAprobadorSegundo) REFERENCES dbo.Colaboradores(IdColaborador);
    PRINT 'Columna dbo.Colaboradores.IdAprobadorSegundo agregada con éxito.';
END
GO

-- 2. Agregar columnas de tracking de nivel 1 y 2 a dbo.SolicitudesVacaciones
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SolicitudesVacaciones' AND COLUMN_NAME = 'IdAprobadorLider')
BEGIN
    ALTER TABLE dbo.SolicitudesVacaciones ADD IdAprobadorLider INT NULL;
    ALTER TABLE dbo.SolicitudesVacaciones ADD FechaAprobacionLider DATETIME2(0) NULL;
    ALTER TABLE dbo.SolicitudesVacaciones ADD IdAprobadorSegundo INT NULL;
    ALTER TABLE dbo.SolicitudesVacaciones ADD FechaAprobacionSegundo DATETIME2(0) NULL;
    PRINT 'Columnas de tracking multinivel agregadas a dbo.SolicitudesVacaciones.';
END
GO

-- 3. STORED PROCEDURE: Procesar Aprobación Escalonada
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

        -- CASO 1: RECHAZO (Cualquiera de los aprobadores puede rechazar)
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
        END
        -- CASO 2: APROBACIÓN
        ELSE IF @Accion = 'APROBADA'
        BEGIN
            -- 2.1 Aprobación de Nivel 1 (Jefe Directo)
            IF @EstadoActual = 'PENDIENTE_LIDER'
            BEGIN
                -- Si el colaborador tiene Segundo Aprobador (Gerente) configurado y el aprobador no es ADMIN_DO
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
                    -- Si NO requiere segundo aprobador, se aprueba directamente (o se valida directo)
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

                    -- Descontar del saldo más antiguo que tenga días disponibles (FIFO)
                    DECLARE @DiasPorDescontar1 DECIMAL(5,1) = @Dias;
                    DECLARE @IdSaldoCurrent1 INT, @PendienteCurrent1 DECIMAL(5,1);

                    DECLARE curSaldos1 CURSOR LOCAL FAST_FORWARD FOR
                    SELECT IdSaldo, DiasPendientes
                    FROM dbo.SaldosVacaciones
                    WHERE IdColaborador = @IdColaborador AND EsCerrado = 0 AND DiasPendientes > 0
                    ORDER BY AnioPeriodo ASC;

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
                END
            END
            -- 2.2 Aprobación de Nivel 2 (Gerente de Sucursal / Planta)
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

                -- Descontar del saldo más antiguo que tenga días disponibles (FIFO)
                DECLARE @DiasPorDescontar2 DECIMAL(5,1) = @Dias;
                DECLARE @IdSaldoCurrent2 INT, @PendienteCurrent2 DECIMAL(5,1);

                DECLARE curSaldos2 CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, DiasPendientes
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @IdColaborador AND EsCerrado = 0 AND DiasPendientes > 0
                ORDER BY AnioPeriodo ASC;

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
            END
            -- 2.3 Aprobación de DO (en caso de estados legados PENDIENTE_DO)
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

                -- Descontar del saldo más antiguo que tenga días disponibles (FIFO)
                DECLARE @DiasPorDescontar3 DECIMAL(5,1) = @Dias;
                DECLARE @IdSaldoCurrent3 INT, @PendienteCurrent3 DECIMAL(5,1);

                DECLARE curSaldos3 CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, DiasPendientes
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @IdColaborador AND EsCerrado = 0 AND DiasPendientes > 0
                ORDER BY AnioPeriodo ASC;

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
