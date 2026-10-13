-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 02_functions_and_sps.sql
-- DESCRIPCIÓN: Funciones de cálculo LFT, Procedimiento de Staging y Flujos de Autorización
-- BASE DE DATOS: DESARROLLO_O
-- =================================================================================

USE DESARROLLO_O;
GO

-- =================================================================================
-- 1. FUNCIÓN ESCALAR: Días correspondientes según Ley Federal del Trabajo (LFT México)
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
-- 2. FUNCIÓN ESCALAR: Cálculo de días hábiles entre dos fechas (omite festivos y descansos)
-- =================================================================================
CREATE OR ALTER FUNCTION dbo.fn_CalcularDiasHabiles
(
    @FechaInicio        DATE,
    @FechaFin           DATE,
    @JornadaLaboralDias INT = 6 -- Estándar Grupo JAMA: 6 = Lunes a Sábado
)
RETURNS DECIMAL(4,1)
AS
BEGIN
    IF @FechaInicio > @FechaFin OR @FechaInicio IS NULL OR @FechaFin IS NULL
        RETURN 0.0;

    DECLARE @DiasHabiles INT = 0;

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
        -- Fórmula normalizada independiente de @@DATEFIRST:
        -- 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
        SELECT (DATEPART(WEEKDAY, c.FechaActual) + @@DATEFIRST - 1) % 7 AS DiaSemanaNormalizado
    ) w
    WHERE 
        w.DiaSemanaNormalizado <> 0 -- Excluir exclusivamente Domingo
        AND (@JornadaLaboralDias = 6 OR w.DiaSemanaNormalizado <> 6) -- En jornada de 5 días se excluiría Sábado (6)
        AND NOT EXISTS (
            SELECT 1 
            FROM dbo.DiasInhabiles d 
            WHERE d.Fecha = c.FechaActual
        )
    OPTION (MAXRECURSION 366);

    RETURN CAST(@DiasHabiles AS DECIMAL(4,1));
END;
GO

-- =================================================================================
-- 3. FUNCIÓN TABLA EN LÍNEA (TVF): Desglose día por día para el portal de colaborador
-- =================================================================================
CREATE OR ALTER FUNCTION dbo.tvf_ObtenerDetalleDiasSolicitud
(
    @FechaInicio        DATE,
    @FechaFin           DATE,
    @JornadaLaboralDias INT = 6
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
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 0 THEN 1 -- Domingo
            WHEN @JornadaLaboralDias = 5 AND ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 6 THEN 1 -- Sábado
            ELSE 0
        END AS EsFinDeSemana,
        CASE WHEN d.Fecha IS NOT NULL THEN 1 ELSE 0 END AS EsDiaInhabil,
        ISNULL(d.Descripcion, CASE 
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 0 THEN 'Descanso Semanal (Domingo)'
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 6 THEN 'Día Laborable Regular (Sábado)'
            ELSE 'Día Laborable Regular'
        END) AS DescripcionDia,
        ISNULL(d.EsFeriadoOficial, 0) AS EsFeriadoOficial,
        CASE 
            WHEN ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 0 THEN 0 -- Domingo descanso
            WHEN @JornadaLaboralDias = 5 AND ((DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7) = 6 THEN 0
            WHEN d.Fecha IS NOT NULL THEN 0
            ELSE 1
        END AS EsDiaLaborableEfectivo
    FROM CalendarioRango c
    LEFT JOIN dbo.DiasInhabiles d ON d.Fecha = c.Fecha
);
GO

-- =================================================================================
-- 4. STORED PROCEDURE: Cálculo de saldos devengados por colaborador conforme a LFT
-- =================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_CalcularSaldosVacaciones
    @IdColaborador INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaHoy DATE = CAST(SYSDATETIME() AS DATE);

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH PeriodosCalculados AS (
            SELECT 
                c.IdColaborador,
                c.FechaAlta,
                ISNULL(c.FechaReingreso, c.FechaAlta) AS FechaBaseAntiguedad,
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
-- 5. STORED PROCEDURE: Aplicación Atómica de Staging desde Backend (MERGE Multi-Empresa)
--    Regla de Integridad Estricta: NUNCA sobreescribir IdJefeDirecto ni RolApp
-- =================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_AplicarStagingNomipaq
    @IdEmpresa          INT,
    @TipoEjecucion      VARCHAR(20) = 'MANUAL',
    @IdUsuarioEjecuto   INT = NULL,
    @JsonDepartamentos  NVARCHAR(MAX),
    @JsonPuestos        NVARCHAR(MAX),
    @JsonEmpleados      NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Insertados INT = 0;
    DECLARE @Actualizados INT = 0;
    DECLARE @Desactivados INT = 0;
    DECLARE @NombreBD VARCHAR(100);

    SELECT @NombreBD = NombreBaseDatos FROM dbo.EmpresasNomipaq WHERE IdEmpresa = @IdEmpresa;

    IF @NombreBD IS NULL
        THROW 50020, 'La empresa especificada no existe en dbo.EmpresasNomipaq.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 5.1 Tablas Temporales de Staging en memoria de la sesión
        CREATE TABLE #StagingDeptos (
            CodigoNomipaq VARCHAR(20),
            Nombre VARCHAR(150)
        );

        CREATE TABLE #StagingPuestos (
            CodigoNomipaq VARCHAR(20),
            Nombre VARCHAR(150)
        );

        CREATE TABLE #StagingEmpleados (
            CodigoEmpleado      VARCHAR(30),
            Nombre              VARCHAR(100),
            ApellidoPaterno     VARCHAR(100),
            ApellidoMaterno     VARCHAR(100),
            CURP                VARCHAR(18),
            RFC                 VARCHAR(13),
            Email               VARCHAR(150),
            Empresa             VARCHAR(150),
            Sucursal            VARCHAR(100),
            FechaAlta           DATE,
            FechaReingreso      DATE,
            EstatusNomina       VARCHAR(10),
            CodigoDepartamento  VARCHAR(20),
            CodigoPuesto        VARCHAR(20)
        );

        -- Poblar desde JSON recibido del backend
        INSERT INTO #StagingDeptos (CodigoNomipaq, Nombre)
        SELECT CodigoNomipaq, Nombre
        FROM OPENJSON(@JsonDepartamentos)
        WITH (
            CodigoNomipaq VARCHAR(20) '$.codigo',
            Nombre VARCHAR(150) '$.nombre'
        );

        INSERT INTO #StagingPuestos (CodigoNomipaq, Nombre)
        SELECT CodigoNomipaq, Nombre
        FROM OPENJSON(@JsonPuestos)
        WITH (
            CodigoNomipaq VARCHAR(20) '$.codigo',
            Nombre VARCHAR(150) '$.nombre'
        );

        INSERT INTO #StagingEmpleados (
            CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
            CURP, RFC, Email, Empresa, Sucursal, FechaAlta, FechaReingreso,
            EstatusNomina, CodigoDepartamento, CodigoPuesto
        )
        SELECT 
            CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
            CURP, RFC, Email, Empresa, Sucursal, FechaAlta, FechaReingreso,
            EstatusNomina, CodigoDepartamento, CodigoPuesto
        FROM OPENJSON(@JsonEmpleados)
        WITH (
            CodigoEmpleado VARCHAR(30) '$.codigoEmpleado',
            Nombre VARCHAR(100) '$.nombre',
            ApellidoPaterno VARCHAR(100) '$.apellidoPaterno',
            ApellidoMaterno VARCHAR(100) '$.apellidoMaterno',
            CURP VARCHAR(18) '$.curp',
            RFC VARCHAR(13) '$.rfc',
            Email VARCHAR(150) '$.email',
            Empresa VARCHAR(150) '$.empresa',
            Sucursal VARCHAR(100) '$.sucursal',
            FechaAlta DATE '$.fechaAlta',
            FechaReingreso DATE '$.fechaReingreso',
            EstatusNomina VARCHAR(10) '$.estatusNomina',
            CodigoDepartamento VARCHAR(20) '$.codigoDepartamento',
            CodigoPuesto VARCHAR(20) '$.codigoPuesto'
        );

        -- 5.2 MERGE Departamentos por Empresa
        MERGE dbo.Departamentos AS Target
        USING #StagingDeptos AS Source
        ON (Target.IdEmpresa = @IdEmpresa AND Target.CodigoNomipaq = Source.CodigoNomipaq)
        WHEN MATCHED AND Target.Nombre <> Source.Nombre THEN
            UPDATE SET Target.Nombre = Source.Nombre, Target.FechaModificacion = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (IdEmpresa, CodigoNomipaq, Nombre, Activo, FechaCreacion)
            VALUES (@IdEmpresa, Source.CodigoNomipaq, Source.Nombre, 1, SYSDATETIME());

        -- 5.3 MERGE Puestos por Empresa
        MERGE dbo.Puestos AS Target
        USING #StagingPuestos AS Source
        ON (Target.IdEmpresa = @IdEmpresa AND Target.CodigoNomipaq = Source.CodigoNomipaq)
        WHEN MATCHED AND Target.Nombre <> Source.Nombre THEN
            UPDATE SET Target.Nombre = Source.Nombre, Target.FechaModificacion = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (IdEmpresa, CodigoNomipaq, Nombre, Activo, FechaCreacion)
            VALUES (@IdEmpresa, Source.CodigoNomipaq, Source.Nombre, 1, SYSDATETIME());

        -- 5.4 MERGE Colaboradores (Llave compuesta: IdEmpresa, CodigoEmpleado)
        -- REGLA ESTRICTA: NUNCA SOBREESCRIBIR IdJefeDirecto NI RolApp
        DECLARE @MergeOutput TABLE (Accion VARCHAR(20));

        MERGE dbo.Colaboradores AS Target
        USING (
            SELECT 
                s.CodigoEmpleado, s.Nombre, s.ApellidoPaterno, s.ApellidoMaterno,
                s.CURP, s.RFC, s.Email, s.Empresa, s.Sucursal, s.FechaAlta, s.FechaReingreso,
                s.EstatusNomina,
                d.IdDepartamento,
                p.IdPuesto
            FROM #StagingEmpleados s
            LEFT JOIN dbo.Departamentos d ON d.IdEmpresa = @IdEmpresa AND d.CodigoNomipaq = s.CodigoDepartamento
            LEFT JOIN dbo.Puestos p ON p.IdEmpresa = @IdEmpresa AND p.CodigoNomipaq = s.CodigoPuesto
        ) AS Source
        ON (Target.IdEmpresa = @IdEmpresa AND Target.CodigoEmpleado = Source.CodigoEmpleado)
        WHEN MATCHED THEN
            UPDATE SET 
                Target.Nombre = Source.Nombre,
                Target.ApellidoPaterno = Source.ApellidoPaterno,
                Target.ApellidoMaterno = Source.ApellidoMaterno,
                Target.CURP = Source.CURP,
                Target.RFC = Source.RFC,
                Target.Email = ISNULL(Target.Email, Source.Email),
                Target.Empresa = ISNULL(Source.Empresa, Target.Empresa),
                Target.Sucursal = ISNULL(Source.Sucursal, Target.Sucursal),
                Target.FechaAlta = Source.FechaAlta,
                Target.FechaReingreso = Source.FechaReingreso,
                Target.EstatusNomina = Source.EstatusNomina,
                Target.IdDepartamento = ISNULL(Source.IdDepartamento, Target.IdDepartamento),
                Target.IdPuesto = ISNULL(Source.IdPuesto, Target.IdPuesto),
                Target.Activo = CASE WHEN Source.EstatusNomina = 'A' THEN 1 ELSE 0 END,
                Target.UltimaSincronizacion = SYSDATETIME(),
                Target.FechaModificacion = SYSDATETIME()
                -- NOTA: IdJefeDirecto y RolApp NO SE MODIFICAN AQUÍ (Preservación local)
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
                CURP, RFC, Email, Empresa, Sucursal, FechaAlta, FechaReingreso,
                EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto,
                RolApp, Activo, UltimaSincronizacion, FechaCreacion
            )
            VALUES (
                @IdEmpresa, Source.CodigoEmpleado, Source.Nombre, Source.ApellidoPaterno, Source.ApellidoMaterno,
                Source.CURP, Source.RFC, Source.Email, Source.Empresa, Source.Sucursal, Source.FechaAlta, Source.FechaReingreso,
                Source.EstatusNomina, Source.IdDepartamento, Source.IdPuesto, NULL,
                'COLABORADOR', CASE WHEN Source.EstatusNomina = 'A' THEN 1 ELSE 0 END,
                SYSDATETIME(), SYSDATETIME()
            )
        OUTPUT $action INTO @MergeOutput;

        SELECT @Insertados = COUNT(*) FROM @MergeOutput WHERE Accion = 'INSERT';
        SELECT @Actualizados = COUNT(*) FROM @MergeOutput WHERE Accion = 'UPDATE';

        -- 5.5 Actualizar última sincronización de la empresa
        UPDATE dbo.EmpresasNomipaq
        SET UltimaSincronizacion = SYSDATETIME()
        WHERE IdEmpresa = @IdEmpresa;

        -- 5.6 Recalcular saldos de vacaciones para la empresa sincronizada
        EXEC dbo.sp_CalcularSaldosVacaciones;

        -- 5.7 Registrar Bitácora de Auditoría
        DECLARE @LogMsg NVARCHAR(MAX) = CONCAT('Sincronización exitosa [', @NombreBD, ']. Insertados: ', @Insertados, ', Actualizados: ', @Actualizados);

        INSERT INTO dbo.BitacoraSincronizacionNomipaq (
            FechaEjecucion, TipoEjecucion, IdEmpresa, NombreBaseDatos,
            IdUsuarioEjecuto, RegistrosInsertados, RegistrosActualizados,
            RegistrosDesactivados, DetalleLog, Exitoso
        )
        VALUES (
            SYSDATETIME(), @TipoEjecucion, @IdEmpresa, @NombreBD,
            @IdUsuarioEjecuto, @Insertados, @Actualizados, 0, @LogMsg, 1
        );

        -- Limpiar temporales
        DROP TABLE #StagingEmpleados;
        DROP TABLE #StagingDeptos;
        DROP TABLE #StagingPuestos;

        COMMIT TRANSACTION;

        SELECT 
            1 AS Exito,
            @IdEmpresa AS IdEmpresa,
            @NombreBD AS BaseDatos,
            @Insertados AS RegistrosInsertados,
            @Actualizados AS RegistrosActualizados,
            @LogMsg AS Mensaje;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        
        DECLARE @Err NVARCHAR(MAX) = ERROR_MESSAGE();
        INSERT INTO dbo.BitacoraSincronizacionNomipaq (
            FechaEjecucion, TipoEjecucion, IdEmpresa, NombreBaseDatos,
            IdUsuarioEjecuto, RegistrosInsertados, RegistrosActualizados,
            RegistrosDesactivados, DetalleLog, Exitoso
        )
        VALUES (
            SYSDATETIME(), @TipoEjecucion, @IdEmpresa, @NombreBD,
            @IdUsuarioEjecuto, 0, 0, 0, CONCAT('Error: ', @Err), 0
        );

        THROW;
    END CATCH;
END;
GO

-- =================================================================================
-- 6. STORED PROCEDURE: Registrar Solicitud de Vacaciones
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

        DECLARE @Activo BIT, @Jornada INT, @IdJefe INT;
        SELECT 
            @Activo = Activo, 
            @Jornada = ISNULL(JornadaLaboralDias, 6), 
            @IdJefe = IdJefeDirecto
        FROM dbo.Colaboradores
        WHERE IdColaborador = @IdColaborador;

        IF @Activo IS NULL OR @Activo = 0
            THROW 50001, 'El colaborador especificado no está activo en el sistema.', 1;

        -- Validar que fecha de inicio y fin no sean domingo
        IF ((DATEPART(WEEKDAY, @FechaInicio) + @@DATEFIRST - 1) % 7) = 0
            THROW 50005, 'La fecha de inicio no puede ser un Domingo (día de descanso semanal obligatorio).', 1;

        IF ((DATEPART(WEEKDAY, @FechaFin) + @@DATEFIRST - 1) % 7) = 0
            THROW 50006, 'La fecha de fin no puede ser un Domingo (día de descanso semanal obligatorio).', 1;

        DECLARE @DiasLaborables DECIMAL(4,1);
        SET @DiasLaborables = dbo.fn_CalcularDiasHabiles(@FechaInicio, @FechaFin, @Jornada);

        IF @DiasLaborables <= 0
            THROW 50002, 'El rango seleccionado no contiene ningún día hábil laborable.', 1;

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

        IF @EstadoActual NOT IN ('PENDIENTE_LIDER', 'PENDIENTE_DO')
            THROW 50011, 'La solicitud no se encuentra en un estado pendiente de aprobación.', 1;

        DECLARE @RolAprobador VARCHAR(20);
        SELECT @RolAprobador = RolApp FROM dbo.Colaboradores WHERE IdColaborador = @IdAprobador;

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
