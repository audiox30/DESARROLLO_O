-- =================================================================================
-- SCRIPT DE MIGRACIÓN Y SINCRONIZACIÓN: Poblado de Datos Financieros desde CONTPAQi Nóminas
-- Base de Datos Destino: DESARROLLO_O (SQL Server)
-- Bases Origen: nom10001 en las 8 bases de datos de CONTPAQi Nóminas (COMPAC)
-- =================================================================================

USE DESARROLLO_O;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT '=============================================================================';
PRINT '  INICIANDO SCRIPT: POBLADO DE DATOS FINANCIEROS (CONTPAQi NÓMINAS)';
PRINT '=============================================================================';

-- 1. VERIFICACIÓN Y CREACIÓN DE TABLA dbo.ColaboradorDatosFinancieros SI NO EXISTE
IF OBJECT_ID(N'dbo.ColaboradorDatosFinancieros', N'U') IS NULL
BEGIN
    PRINT 'Creando tabla dbo.ColaboradorDatosFinancieros...';
    CREATE TABLE dbo.ColaboradorDatosFinancieros (
        IdColaborador           INT NOT NULL,
        SalarioMensualNeto      DECIMAL(18,4) NULL,
        SalarioDiarioReal       DECIMAL(18,4) NULL,
        SalarioDiarioImss       DECIMAL(18,4) NULL,
        SalarioDiarioIntegrado  DECIMAL(18,4) NULL,
        InstitucionBancaria     VARCHAR(100) NULL,
        NumeroCuenta            VARCHAR(30) NULL,
        ClabeInterbancaria      VARCHAR(18) NULL,
        FechaUltimaModificacion DATETIME2(0) NOT NULL CONSTRAINT DF_ColabFinanciero_FechaMod DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ColaboradorDatosFinancieros PRIMARY KEY CLUSTERED (IdColaborador),
        CONSTRAINT FK_ColaboradorDatosFinancieros_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE
    );
    PRINT '  -> Tabla dbo.ColaboradorDatosFinancieros creada exitosamente.';
END
ELSE
BEGIN
    PRINT '  [OK] Tabla dbo.ColaboradorDatosFinancieros ya existe.';
END;
GO

-- 2. FUNCIÓN ESCALAR DE RESOLUCIÓN DE INSTITUCIÓN BANCARIA (SAT CATALOG)
CREATE OR ALTER FUNCTION dbo.fn_ResolverBancoSAT (
    @CodigoBanco VARCHAR(10),
    @ClabeInterbancaria VARCHAR(25)
)
RETURNS VARCHAR(100)
AS
BEGIN
    DECLARE @CodTrim VARCHAR(10) = RTRIM(LTRIM(ISNULL(@CodigoBanco, '')));
    DECLARE @ClabeTrim VARCHAR(25) = RTRIM(LTRIM(ISNULL(@ClabeInterbancaria, '')));
    DECLARE @Banco VARCHAR(100) = NULL;

    -- A. Mapeo por código oficial de catálogo SAT (3 dígitos)
    SET @Banco = CASE @CodTrim
        WHEN '002' THEN 'BANAMEX'
        WHEN '012' THEN 'BBVA'
        WHEN '014' THEN 'SANTANDER'
        WHEN '021' THEN 'HSBC'
        WHEN '030' THEN 'BANBAJIO'
        WHEN '036' THEN 'INBURSA'
        WHEN '042' THEN 'MIFEL'
        WHEN '044' THEN 'SCOTIABANK'
        WHEN '058' THEN 'BANREGIO'
        WHEN '059' THEN 'INVEX'
        WHEN '060' THEN 'BANSI'
        WHEN '062' THEN 'AFIRME'
        WHEN '072' THEN 'BANORTE'
        WHEN '127' THEN 'BANCO AZTECA'
        WHEN '130' THEN 'COMPARTAMOS BANCO'
        WHEN '136' THEN 'INTERCAM BANCO'
        WHEN '137' THEN 'BANCOPPEL'
        WHEN '138' THEN 'ABC CAPITAL'
        WHEN '140' THEN 'CONSUBANCO'
        WHEN '143' THEN 'CIBANCO'
        WHEN '145' THEN 'BANCO MULTIVA'
        WHEN '166' THEN 'BANCO DEL BIENESTAR'
        WHEN '646' THEN 'STP'
        ELSE NULL
    END;

    -- B. Si no se especificó código pero la CLABE tiene 18 dígitos, deducir de los primeros 3 dígitos
    IF @Banco IS NULL AND LEN(@ClabeTrim) = 18
    BEGIN
        SET @Banco = CASE SUBSTRING(@ClabeTrim, 1, 3)
            WHEN '002' THEN 'BANAMEX'
            WHEN '012' THEN 'BBVA'
            WHEN '014' THEN 'SANTANDER'
            WHEN '021' THEN 'HSBC'
            WHEN '030' THEN 'BANBAJIO'
            WHEN '036' THEN 'INBURSA'
            WHEN '042' THEN 'MIFEL'
            WHEN '044' THEN 'SCOTIABANK'
            WHEN '058' THEN 'BANREGIO'
            WHEN '059' THEN 'INVEX'
            WHEN '060' THEN 'BANSI'
            WHEN '062' THEN 'AFIRME'
            WHEN '072' THEN 'BANORTE'
            WHEN '127' THEN 'BANCO AZTECA'
            WHEN '130' THEN 'COMPARTAMOS BANCO'
            WHEN '136' THEN 'INTERCAM BANCO'
            WHEN '137' THEN 'BANCOPPEL'
            WHEN '140' THEN 'CONSUBANCO'
            WHEN '143' THEN 'CIBANCO'
            WHEN '145' THEN 'BANCO MULTIVA'
            WHEN '166' THEN 'BANCO DEL BIENESTAR'
            WHEN '646' THEN 'STP'
            ELSE NULL
        END;
    END;

    IF @Banco IS NULL AND @CodTrim <> ''
        SET @Banco = @CodTrim;

    RETURN @Banco;
END;
GO

-- 3. STORED PROCEDURE: Sincronización Masiva Atómica de Datos Financieros por Lote
CREATE OR ALTER PROCEDURE dbo.sp_SincronizarDatosFinancierosLote
    @JsonDatosFinancieros NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        MERGE dbo.ColaboradorDatosFinancieros AS tgt
        USING (
            SELECT 
                idColaborador,
                institucionBancaria,
                numeroCuenta,
                clabeInterbancaria,
                salarioDiarioReal,
                salarioDiarioImss,
                salarioDiarioIntegrado
            FROM OPENJSON(@JsonDatosFinancieros)
            WITH (
                idColaborador INT '$.idColaborador',
                institucionBancaria VARCHAR(100) '$.institucionBancaria',
                numeroCuenta VARCHAR(30) '$.numeroCuenta',
                clabeInterbancaria VARCHAR(18) '$.clabeInterbancaria',
                salarioDiarioReal DECIMAL(18,4) '$.salarioDiarioReal',
                salarioDiarioImss DECIMAL(18,4) '$.salarioDiarioImss',
                salarioDiarioIntegrado DECIMAL(18,4) '$.salarioDiarioIntegrado'
            )
        ) AS src
        ON (tgt.IdColaborador = src.idColaborador)
        WHEN MATCHED THEN
            UPDATE SET 
                tgt.InstitucionBancaria     = src.institucionBancaria,
                tgt.NumeroCuenta            = src.numeroCuenta,
                tgt.ClabeInterbancaria      = src.clabeInterbancaria,
                tgt.SalarioDiarioReal       = src.salarioDiarioReal,
                tgt.SalarioDiarioImss       = src.salarioDiarioImss,
                tgt.SalarioDiarioIntegrado  = src.salarioDiarioIntegrado,
                tgt.FechaUltimaModificacion = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (
                IdColaborador,
                InstitucionBancaria,
                NumeroCuenta,
                ClabeInterbancaria,
                SalarioDiarioReal,
                SalarioDiarioImss,
                SalarioDiarioIntegrado,
                FechaUltimaModificacion
            )
            VALUES (
                src.idColaborador,
                src.institucionBancaria,
                src.numeroCuenta,
                src.clabeInterbancaria,
                src.salarioDiarioReal,
                src.salarioDiarioImss,
                src.salarioDiarioIntegrado,
                SYSUTCDATETIME()
            );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT 'Objetos de base de datos creados/actualizados exitosamente.';
PRINT '=============================================================================';
GO
