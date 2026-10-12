-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 02_functions_and_sps.sql
-- DESCRIPCIÓN: Funciones de cálculo LFT y días hábiles, y Stored Procedures (MERGE y Flujos)
-- MOTOR: Microsoft SQL Server 2016+
-- =================================================================================

USE ControlVacaciones_DO;
GO

-- =================================================================================
-- 1. FUNCIÓN ESCALAR: Días correspondientes según Ley Federal del Trabajo (LFT - Vacaciones Dignas)
-- =================================================================================
CREATE OR ALTER FUNCTION dbo.fn_CalcularDiasLFT
(
    @AntiguedadAnios INT
)
RETURNS DECIMAL(5,1)
AS
BEGIN
    DECLARE @Dias DECIMAL(5,1) = 0.0;

    IF @AntiguedadAnios < 1
        SET @Dias = 0.0;
    ELSE IF @AntiguedadAnios = 1
        SET @Dias = 12.0;
    ELSE IF @AntiguedadAnios = 2
        SET @Dias = 14.0;
    ELSE IF @AntiguedadAnios = 3
        SET @Dias = 16.0;
    ELSE IF @AntiguedadAnios = 4
        SET @Dias = 18.0;
    ELSE IF @AntiguedadAnios = 5
        SET @Dias = 20.0;
    ELSE IF @AntiguedadAnios BETWEEN 6 AND 10
        SET @Dias = 22.0;
    ELSE IF @AntiguedadAnios BETWEEN 11 AND 15
        SET @Dias = 24.0;
    ELSE IF @AntiguedadAnios BETWEEN 16 AND 20
        SET @Dias = 26.0;
    ELSE IF @AntiguedadAnios BETWEEN 21 AND 25
        SET @Dias = 28.0;
    ELSE IF @AntiguedadAnios BETWEEN 26 AND 30
        SET @Dias = 30.0;
    ELSE IF @AntiguedadAnios BETWEEN 31 AND 35
        SET @Dias = 32.0;
    ELSE
        SET @Dias = 32.0 + (FLOOR((@AntiguedadAnios - 31) / 5.0) + 1) * 2.0;

    RETURN @Dias;
END;
GO

-- =================================================================================
-- 2. FUNCIÓN ESCALAR: Cálculo de días hábiles entre dos fechas
--    Omitiendo sábados (según jornada), domingos y registros activos en DiasInhabiles
-- =================================================================================
CREATE OR ALTER FUNCTION dbo.fn_CalcularDiasHabiles
(
    @FechaInicio        DATE,
    @FechaFin           DATE,
    @JornadaLaboralDias INT = 5 -- 5 = Lunes a Viernes; 6 = Lunes a Sábado
)
RETURNS DECIMAL(4,1)
AS
BEGIN
    IF @FechaInicio > @FechaFin OR @FechaInicio IS NULL OR @FechaFin IS NULL
        RETURN 0.0;

    DECLARE @DiasHabiles INT = 0;

    -- CTE recursiva o tabla de números para recorrer el rango día a día de forma determinista
    ;WITH CalendarioRango AS (
        SELECT @FechaInicio AS FechaActual
        UNION ALL
        SELECT DATEADD(DAY, 1, FechaActual)
        FROM CalendarioRango
        WHERE FechaActual < @FechaFin
    )
    SELECT @DiasHabiles = COUNT(*)
    FROM CalendarioRango c
    CROSS APPLY (
        -- @@DATEFIRST independiente usando cálculo modular de fecha
        -- 1 = Domingo, 2 = Lunes, ..., 6 = Viernes, 7 = Sábado
        SELECT (DATEPART(WEEKDAY, c.FechaActual) + @@DATEFIRST - 1) % 7 AS DiaSemanaNormalizado
    ) w
    WHERE 
        -- Excluir Domingo (siempre descanso legal)
        w.DiaSemanaNormalizado <> 1
        -- Si la jornada es de 5 días, excluir también Sábado (0 o 7 según módulo)
        AND (@JornadaLaboralDias = 6 OR w.DiaSemanaNormalizado <> 0)
        -- Excluir días festivos o inhábiles corporativos activos
        AND NOT EXISTS (
            SELECT 1 
            FROM dbo.DiasInhabiles d 
            WHERE d.Fecha = c.FechaActual AND d.Activo = 1
        )
    OPTION (MAXRECURSION 366);

    RETURN CAST(@DiasHabiles AS DECIMAL(4,1));
END;
GO

-- =================================================================================
-- 3. FUNCIÓN TABLA EN LÍNEA (TVF): Desglose día por día para visualización en portal
-- =================================================================================
CREATE OR ALTER FUNCTION dbo.tvf_ObtenerDetalleDiasSolicitud
(
    @FechaInicio        DATE,
    @FechaFin           DATE,
    @JornadaLaboralDias INT = 5
)
RETURNS TABLE
AS
RETURN
(
    WITH CalendarioRango AS (
        SELECT @FechaInicio AS Fecha
        UNION ALL
        SELECT DATEADD(DAY, 1, Fecha)
        FROM CalendarioRango
        WHERE Fecha < @FechaFin
    )
    SELECT 
        c.Fecha,
        DATENAME(WEEKDAY, c.Fecha) AS NombreDiaSemana,
        CASE 
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 1 THEN 1 -- Domingo
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 0 THEN 1 -- Sábado
            ELSE 0
        END AS EsFinDeSemana,
        CASE WHEN d.Fecha IS NOT NULL THEN 1 ELSE 0 END AS EsDiaInhabil,
        ISNULL(d.Descripcion, CASE 
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 1 THEN 'Descanso Semanal (Domingo)'
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 0 THEN 'Descanso Semanal (Sábado)'
            ELSE 'Día Laborable Regular'
        END) AS DescripcionDia,
        ISNULL(d.EsFeriadoOficial, 0) AS EsFeriadoOficial,
        CASE 
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 1 THEN 0 -- Domingo descanso
            WHEN @JornadaLaboralDias = 5 AND ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 0 THEN 0 -- Sábado en 5 días
            WHEN d.Fecha IS NOT NULL AND d.Activo = 1 THEN 0 -- Festivo
            ELSE 1
        END AS EsDiaLaborableEfectivo
    FROM CalendarioRango c
    LEFT JOIN dbo.DiasInhabiles d ON d.Fecha = c.Fecha AND d.Activo = 1
);
GO

-- =================================================================================
-- 4. STORED PROCEDURE: Cálculo de saldos por colaborador o global conforme a LFT
-- =================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_CalcularSaldosVacaciones
    @IdColaborador INT = NULL -- NULL = Recalcular toda la plantilla activa
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaHoy DATE = CAST(SYSDATETIME() AS DATE);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Cursor o CTE para calcular los períodos devengados
        ;WITH PeriodosCalculados AS (
            SELECT 
                c.IdColaborador,
                c.FechaAlta,
                ISNULL(c.FechaReingreso, c.FechaAlta) AS FechaBaseAntiguedad,
                -- Años cumplidos respecto al último aniversario
                DATEDIFF(YEAR, ISNULL(c.FechaReingreso, c.FechaAlta), @FechaHoy) - 
                    CASE 
                        WHEN DATEADD(YEAR, DATEDIFF(YEAR, ISNULL(c.FechaReingreso, c.FechaAlta), @FechaHoy), ISNULL(c.FechaReingreso, c.FechaAlta)) > @FechaHoy 
                        THEN 1 ELSE 0 
                    END AS AntiguedadAnios
            FROM dbo.Colaboradores c
            WHERE c.Activo = 1 
              AND c.EstatusNomina = 'A'
              AND (@IdColaborador IS NULL OR c.IdColaborador = @IdColaborador)
        )
        MERGE dbo.SaldosVacaciones AS Target
        USING (
            SELECT 
                pc.IdColaborador,
                YEAR(DATEADD(YEAR, pc.AntiguedadAnios, pc.FechaBaseAntiguedad)) AS AnioPeriodo,
                pc.AntiguedadAnios,
                dbo.fn_CalcularDiasLFT(pc.AntiguedadAnios) AS DiasCorrespondientes,
                DATEADD(YEAR, pc.AntiguedadAnios, pc.FechaBaseAntiguedad) AS FechaInicioPeriodo,
                DATEADD(DAY, -1, DATEADD(YEAR, pc.AntiguedadAnios + 1, pc.FechaBaseAntiguedad)) AS FechaFinPeriodo,
                -- 18 meses para gozarlas conforme al Art. 81 LFT
                DATEADD(MONTH, 18, DATEADD(YEAR, pc.AntiguedadAnios + 1, pc.FechaBaseAntiguedad)) AS FechaExpiracionPeriodo
            FROM PeriodosCalculados pc
            WHERE pc.AntiguedadAnios >= 1
        ) AS Source
        ON (Target.IdColaborador = Source.IdColaborador AND Target.AnioPeriodo = Source.AnioPeriodo)
        WHEN MATCHED THEN
            UPDATE SET 
                Target.AntiguedadCumplida = Source.AntiguedadAnios,
                Target.DiasCorrespondientes = Source.DiasCorrespondientes,
                Target.FechaInicioPeriodo = Source.FechaInicioPeriodo,
                Target.FechaFinPeriodo = Source.FechaFinPeriodo,
                Target.FechaExpiracionPeriodo = Source.FechaExpiracionPeriodo,
                Target.FechaUltimoCalculo = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (
                IdColaborador, AnioPeriodo, AntiguedadCumplida, 
                DiasCorrespondientes, DiasGozados, FechaInicioPeriodo, 
                FechaFinPeriodo, FechaExpiracionPeriodo, EsCerrado, FechaUltimoCalculo
            )
            VALUES (
                Source.IdColaborador, Source.AnioPeriodo, Source.AntiguedadAnios, 
                Source.DiasCorrespondientes, 0.0, Source.FechaInicioPeriodo, 
                Source.FechaFinPeriodo, Source.FechaExpiracionPeriodo, 0, SYSDATETIME()
            );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =================================================================================
-- 5. STORED PROCEDURE: Sincronización incremental (MERGE) desde NOMIPAQ
--    Preserva roles de app, jerarquías de jefe directo locales y configuraciones
-- =================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_SincronizarDesdeNomipaq
    @TipoEjecucion      VARCHAR(20) = 'MANUAL', -- 'MANUAL' o 'AUTOMATICA'
    @IdUsuarioEjecuto   INT = NULL,
    @NomipaqDbName      VARCHAR(100) = 'nomipaq_jama'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Insertados INT = 0;
    DECLARE @Actualizados INT = 0;
    DECLARE @Desactivados INT = 0;
    DECLARE @LogMensaje NVARCHAR(MAX) = N'';

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 5.1 MERGE DE DEPARTAMENTOS desde nom10003
        -- Si la base de nomipaq está en la misma instancia o vista federada
        IF OBJECT_ID(N'dbo.vw_Nomipaq_Departamentos', N'V') IS NOT NULL
        BEGIN
            MERGE dbo.Departamentos AS Target
            USING dbo.vw_Nomipaq_Departamentos AS Source
            ON (Target.CodigoNomipaq = Source.CodigoNomipaq)
            WHEN MATCHED AND Target.Nombre <> Source.Nombre THEN
                UPDATE SET Target.Nombre = Source.Nombre, Target.FechaModificacion = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (CodigoNomipaq, Nombre, Activo, FechaCreacion)
                VALUES (Source.CodigoNomipaq, Source.Nombre, 1, SYSDATETIME());
        END

        -- 5.2 MERGE DE PUESTOS desde nom10002
        IF OBJECT_ID(N'dbo.vw_Nomipaq_Puestos', N'V') IS NOT NULL
        BEGIN
            MERGE dbo.Puestos AS Target
            USING dbo.vw_Nomipaq_Puestos AS Source
            ON (Target.CodigoNomipaq = Source.CodigoNomipaq)
            WHEN MATCHED AND Target.Nombre <> Source.Nombre THEN
                UPDATE SET Target.Nombre = Source.Nombre, Target.FechaModificacion = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (CodigoNomipaq, Nombre, Activo, FechaCreacion)
                VALUES (Source.CodigoNomipaq, Source.Nombre, 1, SYSDATETIME());
        END

        -- 5.3 MERGE DE COLABORADORES desde nom10001
        -- REGLA DE NEGOCIO: No sobreescribir RolApp ni IdJefeDirecto si ya han sido asignados localmente
        IF OBJECT_ID(N'dbo.vw_Nomipaq_Empleados', N'V') IS NOT NULL
        BEGIN
            -- Tabla temporal para capturar acciones
            DECLARE @MergeOutput TABLE (Accion VARCHAR(20));

            MERGE dbo.Colaboradores AS Target
            USING dbo.vw_Nomipaq_Empleados AS Source
            ON (Target.CodigoEmpleado = Source.CodigoEmpleado)
            WHEN MATCHED THEN
                UPDATE SET 
                    Target.Nombre = Source.Nombre,
                    Target.ApellidoPaterno = Source.ApellidoPaterno,
                    Target.ApellidoMaterno = Source.ApellidoMaterno,
                    Target.CURP = Source.CURP,
                    Target.RFC = Source.RFC,
                    Target.Email = ISNULL(Target.Email, Source.Email),
                    Target.FechaAlta = Source.FechaAlta,
                    Target.FechaReingreso = Source.FechaReingreso,
                    Target.EstatusNomina = Source.EstatusNomina,
                    Target.Empresa = ISNULL(Source.Empresa, Target.Empresa),
                    Target.Sucursal = ISNULL(Source.Sucursal, Target.Sucursal),
                    Target.IdDepartamento = ISNULL(Source.IdDepartamentoLocal, Target.IdDepartamento),
                    Target.IdPuesto = ISNULL(Source.IdPuestoLocal, Target.IdPuesto),
                    Target.Activo = CASE WHEN Source.EstatusNomina = 'A' THEN 1 ELSE 0 END,
                    Target.UltimaSincronizacion = SYSDATETIME(),
                    Target.FechaModificacion = SYSDATETIME()
            WHEN NOT MATCHED BY TARGET THEN
                INSERT (
                    CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
                    CURP, RFC, Email, Empresa, Sucursal, FechaAlta, FechaReingreso,
                    EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto,
                    RolApp, Activo, UltimaSincronizacion, FechaCreacion
                )
                VALUES (
                    Source.CodigoEmpleado, Source.Nombre, Source.ApellidoPaterno, Source.ApellidoMaterno,
                    Source.CURP, Source.RFC, Source.Email, Source.Empresa, Source.Sucursal, Source.FechaAlta, Source.FechaReingreso,
                    Source.EstatusNomina, Source.IdDepartamentoLocal, Source.IdPuestoLocal, NULL,
                    'COLABORADOR', CASE WHEN Source.EstatusNomina = 'A' THEN 1 ELSE 0 END,
                    SYSDATETIME(), SYSDATETIME()
                )
            OUTPUT $action INTO @MergeOutput;

            SELECT @Insertados = COUNT(*) FROM @MergeOutput WHERE Accion = 'INSERT';
            SELECT @Actualizados = COUNT(*) FROM @MergeOutput WHERE Accion = 'UPDATE';
        END

        -- 5.4 Actualización automática de saldos LFT tras sincronizar
        EXEC dbo.sp_CalcularSaldosVacaciones @IdColaborador = NULL;

        SET @LogMensaje = CONCAT(N'Sincronización finalizada con éxito. Insertados: ', @Insertados, N', Actualizados: ', @Actualizados);

        INSERT INTO dbo.BitacoraSincronizacionNomipaq (
            FechaEjecucion, TipoEjecucion, IdUsuarioEjecuto, 
            RegistrosInsertados, RegistrosActualizados, RegistrosDesactivados, 
            DetalleLog, Exitoso
        )
        VALUES (
            SYSDATETIME(), @TipoEjecucion, @IdUsuarioEjecuto, 
            @Insertados, @Actualizados, @Desactivados, 
            @LogMensaje, 1
        );

        COMMIT TRANSACTION;

        SELECT 
            1 AS Exito, 
            @Insertados AS RegistrosInsertados, 
            @Actualizados AS RegistrosActualizados, 
            @LogMensaje AS Mensaje;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SET @LogMensaje = CONCAT(N'Error en sincronización NOMIPAQ: ', ERROR_MESSAGE());

        INSERT INTO dbo.BitacoraSincronizacionNomipaq (
            FechaEjecucion, TipoEjecucion, IdUsuarioEjecuto, 
            RegistrosInsertados, RegistrosActualizados, RegistrosDesactivados, 
            DetalleLog, Exitoso
        )
        VALUES (
            SYSDATETIME(), @TipoEjecucion, @IdUsuarioEjecuto, 
            0, 0, 0, 
            @LogMensaje, 0
        );

        THROW;
    END CATCH;
END;
GO

-- =================================================================================
-- 6. STORED PROCEDURE: Crear Solicitud de Vacaciones con Validación y Bloqueo
-- =================================================================================
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

        -- Validar colaborador activo
        DECLARE @Activo BIT, @Jornada INT, @IdJefe INT;
        SELECT @Activo = Activo, @Jornada = JornadaLaboralDias, @IdJefe = IdJefeDirecto
        FROM dbo.Colaboradores
        WHERE IdColaborador = @IdColaborador;

        IF @Activo IS NULL OR @Activo = 0
            THROW 50001, 'El colaborador especificado no está activo en el sistema.', 1;

        -- Calcular días hábiles
        DECLARE @DiasLaborables DECIMAL(4,1);
        SET @DiasLaborables = dbo.fn_CalcularDiasHabiles(@FechaInicio, @FechaFin, @Jornada);

        IF @DiasLaborables <= 0
            THROW 50002, 'El rango seleccionado no contiene ningún día hábil laborable.', 1;

        -- Validar saldo acumulado disponible (Total pendientes - Solicitudes actualmente pendientes)
        DECLARE @SaldoDisponible DECIMAL(5,1) = 0.0;
        SELECT @SaldoDisponible = ISNULL(SUM(DiasPendientes), 0.0)
        FROM dbo.SaldosVacaciones
        WHERE IdColaborador = @IdColaborador AND EsCerrado = 0;

        DECLARE @DiasEnTramite DECIMAL(5,1) = 0.0;
        SELECT @DiasEnTramite = ISNULL(SUM(TotalDiasLaborables), 0.0)
        FROM dbo.SolicitudesVacaciones
        WHERE IdColaborador = @IdColaborador AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO');

        IF (@SaldoDisponible - @DiasEnTramite) < @DiasLaborables
        BEGIN
            DECLARE @MsgErr NVARCHAR(200) = CONCAT('Saldo insuficiente. Disponibles: ', (@SaldoDisponible - @DiasEnTramite), ' días. Solicitados: ', @DiasLaborables, ' días.');
            THROW 50003, @MsgErr, 1;
        END

        -- Validar solapamiento con otras solicitudes aprobadas o en trámite
        IF EXISTS (
            SELECT 1 
            FROM dbo.SolicitudesVacaciones
            WHERE IdColaborador = @IdColaborador
              AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO', 'APROBADA')
              AND @FechaInicio <= FechaFin 
              AND @FechaFin >= FechaInicio
        )
        BEGIN
            THROW 50004, 'Ya existe una solicitud en trámite o aprobada en este rango de fechas.', 1;
        END

        -- Generar Folio consecutivo (Ej: VAC-2026-00042)
        DECLARE @AnioActual INT = YEAR(SYSDATETIME());
        DECLARE @Consecutivo INT;
        SELECT @Consecutivo = COUNT(*) + 1 
        FROM dbo.SolicitudesVacaciones 
        WHERE YEAR(FechaCreacion) = @AnioActual;

        SET @FolioGenerado = CONCAT('VAC-', @AnioActual, '-', RIGHT('00000' + CAST(@Consecutivo AS VARCHAR(5)), 5));

        -- Insertar Solicitud
        INSERT INTO dbo.SolicitudesVacaciones (
            Folio, IdColaborador, FechaCreacion, FechaInicio, 
            FechaFin, TotalDiasLaborables, MotivoComentarios, Estado
        )
        VALUES (
            @FolioGenerado, @IdColaborador, SYSDATETIME(), @FechaInicio, 
            @FechaFin, @DiasLaborables, @MotivoComentarios, 'PENDIENTE_LIDER'
        );

        SET @IdSolicitudCreada = SCOPE_IDENTITY();

        -- Registrar en Bitácora de Aprobaciones
        INSERT INTO dbo.HistorialAprobaciones (
            IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion
        )
        VALUES (
            @IdSolicitudCreada, @IdColaborador, 'COLABORADOR', 'ENVIADA', 'Solicitud registrada e ingresada al flujo de autorización', 'WEB'
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =================================================================================
-- 7. STORED PROCEDURE: Procesar Aprobación o Rechazo (Líder / DO)
-- =================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_ProcesarAprobacionSolicitud
    @IdSolicitud            INT,
    @IdAprobador            INT,
    @Accion                 VARCHAR(20),      -- 'APROBADA', 'RECHAZADA'
    @Comentarios            VARCHAR(500) = NULL,
    @MetodoAutorizacion     VARCHAR(20) = 'WEB', -- 'WEB' o 'TEAMS'
    @DireccionIP            VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validar solicitud
        DECLARE @EstadoActual VARCHAR(25), @IdColaborador INT, @Dias DECIMAL(4,1);
        SELECT 
            @EstadoActual = Estado, 
            @IdColaborador = IdColaborador, 
            @Dias = TotalDiasLaborables
        FROM dbo.SolicitudesVacaciones WITH (UPDLOCK, ROWLOCK)
        WHERE IdSolicitud = @IdSolicitud;

        IF @EstadoActual IS NULL
            THROW 50010, 'La solicitud no existe.', 1;

        IF @EstadoActual NOT IN ('PENDIENTE_LIDER', 'PENDIENTE_DO')
            THROW 50011, 'La solicitud no se encuentra en un estado pendiente de aprobación.', 1;

        -- Validar datos del aprobador
        DECLARE @RolAprobador VARCHAR(20), @IdJefeColaborador INT;
        SELECT @RolAprobador = RolApp FROM dbo.Colaboradores WHERE IdColaborador = @IdAprobador;
        SELECT @IdJefeColaborador = IdJefeDirecto FROM dbo.Colaboradores WHERE IdColaborador = @IdColaborador;

        -- Regla estricta: Rechazo requiere comentario obligatorio
        IF @Accion = 'RECHAZADA' AND (LTRIM(RTRIM(ISNULL(@Comentarios, ''))) = '')
            THROW 50012, 'El motivo de rechazo es obligatorio para registrar la resolución.', 1;

        IF @Accion = 'RECHAZADA'
        BEGIN
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
                CASE WHEN @RolAprobador = 'ADMIN_DO' THEN 'DESARROLLO_ORGANIZACIONAL' ELSE 'LIDER_DIRECTO' END,
                'RECHAZADA', @Comentarios, @MetodoAutorizacion, @DireccionIP
            );
        END
        ELSE IF @Accion = 'APROBADA'
        BEGIN
            -- Si es Líder y falta visto bueno de DO
            IF @EstadoActual = 'PENDIENTE_LIDER' AND @RolAprobador <> 'ADMIN_DO'
            BEGIN
                UPDATE dbo.SolicitudesVacaciones
                SET Estado = 'PENDIENTE_DO'
                WHERE IdSolicitud = @IdSolicitud;

                INSERT INTO dbo.HistorialAprobaciones (
                    IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                )
                VALUES (
                    @IdSolicitud, @IdAprobador, 'LIDER_DIRECTO', 'APROBADA', 
                    ISNULL(@Comentarios, 'Aprobada por Líder Directo. Enviada a VoBo de Desarrollo Organizacional.'), 
                    @MetodoAutorizacion, @DireccionIP
                );
            END
            ELSE
            BEGIN
                -- Aprobación final (VoBo de DO o Líder Admin)
                UPDATE dbo.SolicitudesVacaciones
                SET 
                    Estado = 'APROBADA',
                    FechaResolucion = SYSDATETIME(),
                    IdAprobadorFinal = @IdAprobador
                WHERE IdSolicitud = @IdSolicitud;

                -- Descontar del saldo más antiguo que tenga días disponibles (FIFO)
                DECLARE @DiasPorDescontar DECIMAL(5,1) = @Dias;
                DECLARE @IdSaldoCurrent INT, @PendienteCurrent DECIMAL(5,1);

                DECLARE curSaldos CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, DiasPendientes
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @IdColaborador AND EsCerrado = 0 AND DiasPendientes > 0
                ORDER BY AnioPeriodo ASC;

                OPEN curSaldos;
                FETCH NEXT FROM curSaldos INTO @IdSaldoCurrent, @PendienteCurrent;

                WHILE @@FETCH_STATUS = 0 AND @DiasPorDescontar > 0
                BEGIN
                    IF @PendienteCurrent >= @DiasPorDescontar
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasGozados + @DiasPorDescontar,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent;

                        SET @DiasPorDescontar = 0;
                    END
                    ELSE
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasCorrespondientes,
                            EsCerrado = 1,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent;

                        SET @DiasPorDescontar = @DiasPorDescontar - @PendienteCurrent;
                    END

                    FETCH NEXT FROM curSaldos INTO @IdSaldoCurrent, @PendienteCurrent;
                END

                CLOSE curSaldos;
                DEALLOCATE curSaldos;

                INSERT INTO dbo.HistorialAprobaciones (
                    IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                )
                VALUES (
                    @IdSolicitud, @IdAprobador, 'DESARROLLO_ORGANIZACIONAL', 'APROBADA', 
                    ISNULL(@Comentarios, 'Aprobación final aplicada e impactada en saldos de nómina.'), 
                    @MetodoAutorizacion, @DireccionIP
                );
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
