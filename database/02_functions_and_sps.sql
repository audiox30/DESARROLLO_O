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
    @JornadaLaboralDias INT = 6, -- Estándar Grupo JAMA: 6 = Lunes a Sábado
    @DiasDescanso       VARCHAR(150) = NULL
)
RETURNS DECIMAL(4,1)
AS
BEGIN
    IF @FechaInicio > @FechaFin OR @FechaInicio IS NULL OR @FechaFin IS NULL
        RETURN 0.0;

    DECLARE @DescansoNorm VARCHAR(200);
    IF @DiasDescanso IS NOT NULL AND LTRIM(RTRIM(@DiasDescanso)) <> ''
        SET @DescansoNorm = UPPER(@DiasDescanso);
    ELSE IF @JornadaLaboralDias = 5
        SET @DescansoNorm = 'SABADO, DOMINGO';
    ELSE
        SET @DescansoNorm = 'DOMINGO';

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
        -- 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
        SELECT (DATEPART(WEEKDAY, c.FechaActual) + @@DATEFIRST - 1) % 7 AS DiaSemanaIndex
    ) w
    CROSS APPLY (
        SELECT CASE w.DiaSemanaIndex
            WHEN 0 THEN 'DOMINGO'
            WHEN 1 THEN 'LUNES'
            WHEN 2 THEN 'MARTES'
            WHEN 3 THEN 'MIERCOLES'
            WHEN 4 THEN 'JUEVES'
            WHEN 5 THEN 'VIERNES'
            WHEN 6 THEN 'SABADO'
        END AS NombreDiaNorm
    ) n
    WHERE 
        -- Excluir si el día de la semana coincide con los días de descanso configurados
        NOT (
            @DescansoNorm LIKE '%' + n.NombreDiaNorm + '%'
            OR (n.NombreDiaNorm = 'SABADO' AND @DescansoNorm LIKE '%SÁBADO%')
            OR (n.NombreDiaNorm = 'MIERCOLES' AND @DescansoNorm LIKE '%MIÉRCOLES%')
        )
        -- Excluir días festivos oficiales registrados en dbo.DiasInhabiles
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
    @JornadaLaboralDias INT = 6,
    @DiasDescanso       VARCHAR(150) = NULL
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
    ),
    DescansoConfig AS (
        SELECT UPPER(
            CASE 
                WHEN @DiasDescanso IS NOT NULL AND LTRIM(RTRIM(@DiasDescanso)) <> '' THEN @DiasDescanso
                WHEN @JornadaLaboralDias = 5 THEN 'SABADO, DOMINGO'
                ELSE 'DOMINGO'
            END
        ) AS DescansoNorm
    )
    SELECT 
        c.Fecha,
        DATENAME(WEEKDAY, c.Fecha) AS NombreDiaSemana,
        CASE 
            WHEN dc.DescansoNorm LIKE '%' + n.NombreDiaNorm + '%' 
              OR (n.NombreDiaNorm = 'SABADO' AND dc.DescansoNorm LIKE '%SÁBADO%')
              OR (n.NombreDiaNorm = 'MIERCOLES' AND dc.DescansoNorm LIKE '%MIÉRCOLES%')
            THEN 1
            ELSE 0
        END AS EsFinDeSemana,
        CASE WHEN d.Fecha IS NOT NULL THEN 1 ELSE 0 END AS EsDiaInhabil,
        ISNULL(d.Descripcion, CASE 
            WHEN dc.DescansoNorm LIKE '%' + n.NombreDiaNorm + '%' 
              OR (n.NombreDiaNorm = 'SABADO' AND dc.DescansoNorm LIKE '%SÁBADO%')
              OR (n.NombreDiaNorm = 'MIERCOLES' AND dc.DescansoNorm LIKE '%MIÉRCOLES%')
            THEN CONCAT('Descanso Semanal (', DATENAME(WEEKDAY, c.Fecha), ')')
            ELSE 'Día Laborable Regular'
        END) AS DescripcionDia,
        ISNULL(d.EsFeriadoOficial, 0) AS EsFeriadoOficial,
        CASE 
            WHEN (dc.DescansoNorm LIKE '%' + n.NombreDiaNorm + '%' 
              OR (n.NombreDiaNorm = 'SABADO' AND dc.DescansoNorm LIKE '%SÁBADO%')
              OR (n.NombreDiaNorm = 'MIERCOLES' AND dc.DescansoNorm LIKE '%MIÉRCOLES%')) THEN 0
            WHEN d.Fecha IS NOT NULL THEN 0
            ELSE 1
        END AS EsDiaLaborableEfectivo
    FROM CalendarioRango c
    CROSS JOIN DescansoConfig dc
    CROSS APPLY (
        SELECT (DATEPART(WEEKDAY, c.Fecha) + @@DATEFIRST - 1) % 7 AS DiaSemanaIndex
    ) w
    CROSS APPLY (
        SELECT CASE w.DiaSemanaIndex
            WHEN 0 THEN 'DOMINGO'
            WHEN 1 THEN 'LUNES'
            WHEN 2 THEN 'MARTES'
            WHEN 3 THEN 'MIERCOLES'
            WHEN 4 THEN 'JUEVES'
            WHEN 5 THEN 'VIERNES'
            WHEN 6 THEN 'SABADO'
        END AS NombreDiaNorm
    ) n
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

        -- Validar que fecha de inicio no coincida con descanso del colaborador
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

        -- Validar que fecha de fin no coincida con descanso del colaborador
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
-- 7. STORED PROCEDURE: Procesar Aprobación Escalonada (Líder Directo / Gerente de Sucursal / DO)
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
                    -- Si NO requiere segundo aprobador, se aprueba directamente (o si es ADMIN_DO)
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
