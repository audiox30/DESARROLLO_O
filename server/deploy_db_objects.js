const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const config = {
  user: process.env.LOCAL_DB_USER,
  password: process.env.LOCAL_DB_PASSWORD,
  server: process.env.LOCAL_DB_SERVER,
  port: parseInt(process.env.LOCAL_DB_PORT, 10),
  database: 'DESARROLLO_O',
  options: { encrypt: false, trustServerCertificate: true }
};

async function deploy() {
  console.log('Conectando a DESARROLLO_O en', config.server);
  const pool = await new sql.ConnectionPool(config).connect();

  // 1. BitacoraSincronizacionNomipaq
  console.log('1. Creando o actualizando dbo.BitacoraSincronizacionNomipaq...');
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.BitacoraSincronizacionNomipaq', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.BitacoraSincronizacionNomipaq (
            IdSync                  INT IDENTITY(1,1) NOT NULL,
            FechaEjecucion          DATETIME2(0) NOT NULL CONSTRAINT DF_BitacoraSync_Fecha DEFAULT (SYSDATETIME()),
            TipoEjecucion           VARCHAR(20) NOT NULL CONSTRAINT DF_BitacoraSync_Tipo DEFAULT ('MANUAL'),
            IdEmpresa               INT NULL,
            NombreBaseDatos         VARCHAR(100) NULL,
            IdUsuarioEjecuto        INT NULL,
            RegistrosInsertados     INT NOT NULL DEFAULT (0),
            RegistrosActualizados   INT NOT NULL DEFAULT (0),
            RegistrosDesactivados   INT NOT NULL DEFAULT (0),
            DetalleLog              NVARCHAR(MAX) NULL,
            Exitoso                 BIT NOT NULL DEFAULT (1),
            CONSTRAINT PK_BitacoraSync PRIMARY KEY CLUSTERED (IdSync)
        );
    END
  `);

  // Asegurar que CURP en Colaboradores acepte NULL y existan columnas complementarias
  console.log('Asegurando columnas en dbo.Colaboradores...');
  await pool.request().query(`
    ALTER TABLE dbo.Colaboradores ALTER COLUMN CURP VARCHAR(18) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'EmailCorporativo')
        ALTER TABLE dbo.Colaboradores ADD EmailCorporativo VARCHAR(150) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'IdAprobadorSegundo')
        ALTER TABLE dbo.Colaboradores ADD IdAprobadorSegundo INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'DiasDescanso')
        ALTER TABLE dbo.Colaboradores ADD DiasDescanso VARCHAR(100) NULL;
    ELSE
        ALTER TABLE dbo.Colaboradores ALTER COLUMN DiasDescanso VARCHAR(100) NULL;
  `);

  // 2. Función LFT
  console.log('2. Instalando dbo.fn_CalcularDiasLFT...');
  await pool.request().query(`
    CREATE OR ALTER FUNCTION dbo.fn_CalcularDiasLFT
    (
        @AntiguedadAnios INT
    )
    RETURNS INT
    AS
    BEGIN
        DECLARE @Dias INT = 0;
        IF @AntiguedadAnios < 1 SET @Dias = 0;
        ELSE IF @AntiguedadAnios = 1 SET @Dias = 12;
        ELSE IF @AntiguedadAnios = 2 SET @Dias = 14;
        ELSE IF @AntiguedadAnios = 3 SET @Dias = 16;
        ELSE IF @AntiguedadAnios = 4 SET @Dias = 18;
        ELSE IF @AntiguedadAnios = 5 SET @Dias = 20;
        ELSE IF @AntiguedadAnios BETWEEN 6 AND 10 SET @Dias = 22;
        ELSE IF @AntiguedadAnios BETWEEN 11 AND 15 SET @Dias = 24;
        ELSE IF @AntiguedadAnios BETWEEN 16 AND 20 SET @Dias = 26;
        ELSE IF @AntiguedadAnios BETWEEN 21 AND 25 SET @Dias = 28;
        ELSE IF @AntiguedadAnios BETWEEN 26 AND 30 SET @Dias = 30;
        ELSE IF @AntiguedadAnios BETWEEN 31 AND 35 SET @Dias = 32;
        ELSE SET @Dias = 32 + (FLOOR((@AntiguedadAnios - 31) / 5.0) + 1) * 2;
        RETURN @Dias;
    END;
  `);

  // 3. Stored Procedure sp_CalcularSaldosVacaciones exacto a las columnas de la tabla
  console.log('3. Instalando dbo.sp_CalcularSaldosVacaciones...');
  await pool.request().query(`
    CREATE OR ALTER PROCEDURE dbo.sp_CalcularSaldosVacaciones
        @IdColaborador INT = NULL
    AS
    BEGIN
        SET NOCOUNT ON;
        DECLARE @FechaHoy DATE = CAST(SYSDATETIME() AS DATE);
        BEGIN TRY
            ;WITH PeriodosCalculados AS (
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
            )
            MERGE dbo.SaldosVacaciones AS Target
            USING (
                SELECT 
                    pc.IdColaborador,
                    YEAR(DATEADD(YEAR, CASE WHEN pc.AntiguedadAnios >= 1 THEN pc.AntiguedadAnios ELSE 0 END, pc.FechaBaseAntiguedad)) AS AnioPeriodo,
                    pc.AntiguedadAnios,
                    dbo.fn_CalcularDiasLFT(pc.AntiguedadAnios) AS DiasCorrespondientes,
                    DATEADD(MONTH, 18, DATEADD(YEAR, pc.AntiguedadAnios + 1, pc.FechaBaseAntiguedad)) AS FechaExpiracionPeriodo
                FROM PeriodosCalculados pc
            ) AS Source
            ON (Target.IdColaborador = Source.IdColaborador AND Target.AnioPeriodo = Source.AnioPeriodo)
            WHEN MATCHED THEN
                UPDATE SET 
                    Target.AntiguedadCumplida = Source.AntiguedadAnios,
                    Target.DiasCorrespondientes = Source.DiasCorrespondientes,
                    Target.FechaExpiracionPeriodo = Source.FechaExpiracionPeriodo
            WHEN NOT MATCHED THEN
                INSERT (
                    IdColaborador, AnioPeriodo, AntiguedadCumplida, 
                    DiasCorrespondientes, DiasGozados, FechaExpiracionPeriodo, EsCerrado
                )
                VALUES (
                    Source.IdColaborador, Source.AnioPeriodo, Source.AntiguedadAnios, 
                    Source.DiasCorrespondientes, 0, Source.FechaExpiracionPeriodo, 0
                );
        END TRY
        BEGIN CATCH
            PRINT 'Error al calcular saldos: ' + ERROR_MESSAGE();
        END CATCH
    END;
  `);

  // 4. Stored Procedure sp_AplicarStagingNomipaq
  console.log('4. Instalando dbo.sp_AplicarStagingNomipaq...');
  await pool.request().query(`
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
        DECLARE @NombreBD VARCHAR(100);

        SELECT @NombreBD = NombreBaseDatos FROM dbo.EmpresasNomipaq WHERE IdEmpresa = @IdEmpresa;
        IF @NombreBD IS NULL SET @NombreBD = CONCAT('EMPRESA_', @IdEmpresa);

        BEGIN TRY
            BEGIN TRANSACTION;

            CREATE TABLE #StagingDeptos (
                CodigoNomipaq VARCHAR(30),
                Nombre VARCHAR(150)
            );

            CREATE TABLE #StagingPuestos (
                CodigoNomipaq VARCHAR(30),
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
                FechaAlta           DATE,
                FechaReingreso      DATE,
                EstatusNomina       VARCHAR(10),
                CodigoDepartamento  VARCHAR(30),
                CodigoPuesto        VARCHAR(30)
            );

            INSERT INTO #StagingDeptos (CodigoNomipaq, Nombre)
            SELECT CodigoNomipaq, Nombre
            FROM OPENJSON(@JsonDepartamentos)
            WITH (
                CodigoNomipaq VARCHAR(30) '$.codigo',
                Nombre VARCHAR(150) '$.nombre'
            );

            INSERT INTO #StagingPuestos (CodigoNomipaq, Nombre)
            SELECT CodigoNomipaq, Nombre
            FROM OPENJSON(@JsonPuestos)
            WITH (
                CodigoNomipaq VARCHAR(30) '$.codigo',
                Nombre VARCHAR(150) '$.nombre'
            );

            INSERT INTO #StagingEmpleados (
                CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
                CURP, RFC, Email, FechaAlta, FechaReingreso,
                EstatusNomina, CodigoDepartamento, CodigoPuesto
            )
            SELECT 
                CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
                NULLIF(CURP, ''), NULLIF(RFC, ''), NULLIF(Email, ''), FechaAlta, FechaReingreso,
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
                FechaAlta DATE '$.fechaAlta',
                FechaReingreso DATE '$.fechaReingreso',
                EstatusNomina VARCHAR(10) '$.estatusNomina',
                CodigoDepartamento VARCHAR(30) '$.codigoDepartamento',
                CodigoPuesto VARCHAR(30) '$.codigoPuesto'
            );

            -- MERGE Departamentos
            ;WITH DeptosUnicos AS (
                SELECT CodigoNomipaq, Nombre,
                       ROW_NUMBER() OVER (PARTITION BY CodigoNomipaq ORDER BY Nombre) AS rn
                FROM #StagingDeptos
                WHERE CodigoNomipaq IS NOT NULL AND RTRIM(LTRIM(CodigoNomipaq)) <> ''
            )
            MERGE dbo.Departamentos AS Target
            USING (SELECT CodigoNomipaq, Nombre FROM DeptosUnicos WHERE rn = 1) AS Source
            ON (Target.IdEmpresa = @IdEmpresa AND Target.CodigoNomipaq = Source.CodigoNomipaq)
            WHEN MATCHED AND Target.Nombre <> Source.Nombre THEN
                UPDATE SET Target.Nombre = Source.Nombre
            WHEN NOT MATCHED THEN
                INSERT (IdEmpresa, CodigoNomipaq, Nombre, Activo)
                VALUES (@IdEmpresa, Source.CodigoNomipaq, Source.Nombre, 1);

            -- MERGE Puestos
            ;WITH PuestosUnicos AS (
                SELECT CodigoNomipaq, Nombre,
                       ROW_NUMBER() OVER (PARTITION BY CodigoNomipaq ORDER BY Nombre) AS rn
                FROM #StagingPuestos
                WHERE CodigoNomipaq IS NOT NULL AND RTRIM(LTRIM(CodigoNomipaq)) <> ''
            )
            MERGE dbo.Puestos AS Target
            USING (SELECT CodigoNomipaq, Nombre FROM PuestosUnicos WHERE rn = 1) AS Source
            ON (Target.IdEmpresa = @IdEmpresa AND Target.CodigoNomipaq = Source.CodigoNomipaq)
            WHEN MATCHED AND Target.Nombre <> Source.Nombre THEN
                UPDATE SET Target.Nombre = Source.Nombre
            WHEN NOT MATCHED THEN
                INSERT (IdEmpresa, CodigoNomipaq, Nombre, Activo)
                VALUES (@IdEmpresa, Source.CodigoNomipaq, Source.Nombre, 1);

            -- MERGE Colaboradores
            -- REGLA DE NEGOCIO ESTRICTA: NUNCA SOBREESCRIBIR IdJefeDirecto NI RolApp
            DECLARE @MergeOutput TABLE (Accion VARCHAR(20));

            ;WITH EmpleadosUnicos AS (
                SELECT 
                    s.CodigoEmpleado, s.Nombre, s.ApellidoPaterno, s.ApellidoMaterno,
                    s.CURP, s.RFC, s.Email, s.FechaAlta, s.FechaReingreso,
                    s.EstatusNomina, s.CodigoDepartamento, s.CodigoPuesto,
                    ROW_NUMBER() OVER (PARTITION BY s.CodigoEmpleado ORDER BY s.FechaAlta DESC) AS rn
                FROM #StagingEmpleados s
                WHERE s.CodigoEmpleado IS NOT NULL AND RTRIM(LTRIM(s.CodigoEmpleado)) <> ''
            )
            MERGE dbo.Colaboradores AS Target
            USING (
                SELECT 
                    s.CodigoEmpleado, s.Nombre, s.ApellidoPaterno, s.ApellidoMaterno,
                    s.CURP, s.RFC, s.Email, s.FechaAlta, s.FechaReingreso,
                    s.EstatusNomina,
                    d.IdDepartamento,
                    p.IdPuesto
                FROM EmpleadosUnicos s
                LEFT JOIN dbo.Departamentos d ON d.IdEmpresa = @IdEmpresa AND d.CodigoNomipaq = s.CodigoDepartamento
                LEFT JOIN dbo.Puestos p ON p.IdEmpresa = @IdEmpresa AND p.CodigoNomipaq = s.CodigoPuesto
                WHERE s.rn = 1
            ) AS Source
            ON (Target.IdEmpresa = @IdEmpresa AND Target.CodigoEmpleado = Source.CodigoEmpleado)
            WHEN MATCHED THEN
                UPDATE SET 
                    Target.Nombre = Source.Nombre,
                    Target.ApellidoPaterno = Source.ApellidoPaterno,
                    Target.ApellidoMaterno = Source.ApellidoMaterno,
                    Target.CURP = COALESCE(Source.CURP, Target.CURP),
                    Target.RFC = COALESCE(Source.RFC, Target.RFC),
                    Target.Email = ISNULL(Target.Email, Source.Email),
                    Target.FechaAlta = Source.FechaAlta,
                    Target.FechaReingreso = Source.FechaReingreso,
                    Target.EstatusNomina = Source.EstatusNomina,
                    Target.IdDepartamento = ISNULL(Source.IdDepartamento, Target.IdDepartamento),
                    Target.IdPuesto = ISNULL(Source.IdPuesto, Target.IdPuesto),
                    Target.Activo = CASE WHEN Source.EstatusNomina = 'A' THEN 1 ELSE 0 END,
                    Target.FechaUltimaSincronizacion = SYSDATETIME()
            WHEN NOT MATCHED BY TARGET THEN
                INSERT (
                    IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
                    CURP, RFC, Email, FechaAlta, FechaReingreso,
                    EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto,
                    RolApp, Activo, FechaUltimaSincronizacion
                )
                VALUES (
                    @IdEmpresa, Source.CodigoEmpleado, Source.Nombre, Source.ApellidoPaterno, Source.ApellidoMaterno,
                    Source.CURP, Source.RFC, Source.Email, Source.FechaAlta, Source.FechaReingreso,
                    Source.EstatusNomina, Source.IdDepartamento, Source.IdPuesto, NULL,
                    'COLABORADOR', CASE WHEN Source.EstatusNomina = 'A' THEN 1 ELSE 0 END,
                    SYSDATETIME()
                )
            OUTPUT $action INTO @MergeOutput;

            SELECT @Insertados = COUNT(*) FROM @MergeOutput WHERE Accion = 'INSERT';
            SELECT @Actualizados = COUNT(*) FROM @MergeOutput WHERE Accion = 'UPDATE';

            -- Actualizar fecha última sincronización
            UPDATE dbo.EmpresasNomipaq SET Activa = 1 WHERE IdEmpresa = @IdEmpresa;

            -- Calcular saldos de vacaciones para colaboradores actualizados/insertados
            EXEC dbo.sp_CalcularSaldosVacaciones;

            DECLARE @LogMsg NVARCHAR(MAX) = CONCAT('Sincronizado [', @NombreBD, ']. Insertados: ', @Insertados, ', Actualizados: ', @Actualizados);

            INSERT INTO dbo.BitacoraSincronizacionNomipaq (
                FechaEjecucion, TipoEjecucion, IdEmpresa, NombreBaseDatos,
                IdUsuarioEjecuto, RegistrosInsertados, RegistrosActualizados,
                RegistrosDesactivados, DetalleLog, Exitoso
            )
            VALUES (
                SYSDATETIME(), @TipoEjecucion, @IdEmpresa, @NombreBD,
                @IdUsuarioEjecuto, @Insertados, @Actualizados, 0, @LogMsg, 1
            );

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
  `);

  console.log('Homologando EstatusNomina (ALTA/BAJA) en dbo.Colaboradores...');
  await pool.request().query(`
    UPDATE dbo.Colaboradores SET EstatusNomina = 'ALTA' WHERE Activo = 1;
    UPDATE dbo.Colaboradores SET EstatusNomina = 'BAJA' WHERE Activo = 0;
  `);

  console.log('✅ Despliegue de procedimientos y tablas en DESARROLLO_O concluido con éxito.');
  await pool.close();
}

deploy().catch(err => {
  console.error('Error durante despliegue:', err);
  process.exit(1);
});
