-- =================================================================================
-- SCRIPT DE MIGRACIÓN DDL: Ampliación de Catálogo Maestro de Colaboradores y Tablas Auxiliares
-- Base de Datos: DESARROLLO_O (SQL Server)
-- =================================================================================

USE DESARROLLO_O;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =================================================================================
-- 1. MODIFICACIÓN A dbo.Colaboradores: Incorporación de campos del catálogo maestro
-- =================================================================================
PRINT 'Verificando y agregando columnas a dbo.Colaboradores...';

-- A. Identificadores y Seguridad Social
IF COL_LENGTH(N'dbo.Colaboradores', N'Subfijo') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Subfijo VARCHAR(20) NULL;
    PRINT '  -> Columna Subfijo agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'NSS') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD NSS VARCHAR(15) NULL;
    PRINT '  -> Columna NSS agregada.';
END;

-- B. Datos Demográficos
IF COL_LENGTH(N'dbo.Colaboradores', N'Sexo') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Sexo CHAR(1) NULL;
    PRINT '  -> Columna Sexo agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'FechaNacimiento') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD FechaNacimiento DATE NULL;
    PRINT '  -> Columna FechaNacimiento agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'EstadoCivil') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD EstadoCivil VARCHAR(20) NULL;
    PRINT '  -> Columna EstadoCivil agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'Nacionalidad') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Nacionalidad VARCHAR(50) CONSTRAINT DF_Colaboradores_Nacionalidad DEFAULT ('MEXICANA');
    PRINT '  -> Columna Nacionalidad agregada con default MEXICANA.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'Escolaridad') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Escolaridad VARCHAR(80) NULL;
    PRINT '  -> Columna Escolaridad agregada.';
END;

-- C. Domicilio Particular
IF COL_LENGTH(N'dbo.Colaboradores', N'Domicilio') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Domicilio VARCHAR(250) NULL;
    PRINT '  -> Columna Domicilio agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'Municipio') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Municipio VARCHAR(100) NULL;
    PRINT '  -> Columna Municipio agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'EstadoProvincia') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD EstadoProvincia VARCHAR(100) NULL;
    PRINT '  -> Columna EstadoProvincia agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'CodigoPostal') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD CodigoPostal VARCHAR(10) NULL;
    PRINT '  -> Columna CodigoPostal agregada.';
END;

-- D. Condiciones Operativas y Contrato
IF COL_LENGTH(N'dbo.Colaboradores', N'DiasDescanso') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD DiasDescanso VARCHAR(50) NULL;
    PRINT '  -> Columna DiasDescanso agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'CentroCostos') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD CentroCostos VARCHAR(50) NULL;
    PRINT '  -> Columna CentroCostos agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'TipoNomina') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD TipoNomina VARCHAR(30) NULL;
    PRINT '  -> Columna TipoNomina agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'TipoContrato') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD TipoContrato VARCHAR(50) NULL;
    PRINT '  -> Columna TipoContrato agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'PeriodicidadPago') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD PeriodicidadPago VARCHAR(30) NULL;
    PRINT '  -> Columna PeriodicidadPago agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'FechaAltaImss') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD FechaAltaImss DATE NULL;
    PRINT '  -> Columna FechaAltaImss agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'FechaEvaluacion') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD FechaEvaluacion DATE NULL;
    PRINT '  -> Columna FechaEvaluacion agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'DomicilioLaboral') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD DomicilioLaboral VARCHAR(250) NULL;
    PRINT '  -> Columna DomicilioLaboral agregada.';
END;

-- E. Emergencias y Salud
IF COL_LENGTH(N'dbo.Colaboradores', N'AvisarEmergencia') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD AvisarEmergencia VARCHAR(120) NULL;
    PRINT '  -> Columna AvisarEmergencia agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'ParentescoEmergencia') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD ParentescoEmergencia VARCHAR(50) NULL;
    PRINT '  -> Columna ParentescoEmergencia agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'TelefonoEmergencia') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD TelefonoEmergencia VARCHAR(30) NULL;
    PRINT '  -> Columna TelefonoEmergencia agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'TipoSangre') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD TipoSangre VARCHAR(10) NULL;
    PRINT '  -> Columna TipoSangre agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'AlergiasPadecimientos') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD AlergiasPadecimientos VARCHAR(200) NULL;
    PRINT '  -> Columna AlergiasPadecimientos agregada.';
END;

-- F. Beneficiarios y Créditos
IF COL_LENGTH(N'dbo.Colaboradores', N'Beneficiario') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Beneficiario VARCHAR(150) NULL;
    PRINT '  -> Columna Beneficiario agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'ParentescoBeneficiario') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD ParentescoBeneficiario VARCHAR(50) NULL;
    PRINT '  -> Columna ParentescoBeneficiario agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'RfcBeneficiario') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD RfcBeneficiario VARCHAR(13) NULL;
    PRINT '  -> Columna RfcBeneficiario agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'TieneInfonavit') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD TieneInfonavit VARCHAR(10) NULL;
    PRINT '  -> Columna TieneInfonavit agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'TieneFonacot') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD TieneFonacot VARCHAR(10) NULL;
    PRINT '  -> Columna TieneFonacot agregada.';
END;

IF COL_LENGTH(N'dbo.Colaboradores', N'FuenteReclutamiento') IS NULL
BEGIN
    ALTER TABLE dbo.Colaboradores ADD FuenteReclutamiento VARCHAR(100) NULL;
    PRINT '  -> Columna FuenteReclutamiento agregada.';
END;
GO

-- =================================================================================
-- 2. CREACIÓN DE TABLAS AUXILIARES Y NORMALIZACIÓN
-- =================================================================================

-- A. TABLA: dbo.ColaboradorHijos
IF OBJECT_ID(N'dbo.ColaboradorHijos', N'U') IS NULL
BEGIN
    PRINT 'Creando tabla dbo.ColaboradorHijos...';
    CREATE TABLE dbo.ColaboradorHijos (
        IdHijo              INT IDENTITY(1,1) NOT NULL,
        IdColaborador       INT NOT NULL,
        NumeroHijo          INT NOT NULL,
        FechaNacimiento     DATE NULL,
        Sexo                CHAR(1) NULL,
        FechaRegistro       DATETIME2(0) NOT NULL CONSTRAINT DF_ColaboradorHijos_FechaRegistro DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ColaboradorHijos PRIMARY KEY CLUSTERED (IdHijo),
        CONSTRAINT FK_ColaboradorHijos_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE,
        CONSTRAINT UQ_Colaborador_Hijo UNIQUE NONCLUSTERED (IdColaborador, NumeroHijo)
    );
    CREATE NONCLUSTERED INDEX IX_ColaboradorHijos_Colaborador ON dbo.ColaboradorHijos (IdColaborador);
    PRINT '  -> Tabla dbo.ColaboradorHijos creada exitosamente.';
END
ELSE
BEGIN
    PRINT '  -> Tabla dbo.ColaboradorHijos ya existe.';
END;
GO

-- B. TABLA: dbo.ColaboradorBajas
IF OBJECT_ID(N'dbo.ColaboradorBajas', N'U') IS NULL
BEGIN
    PRINT 'Creando tabla dbo.ColaboradorBajas...';
    CREATE TABLE dbo.ColaboradorBajas (
        IdBaja                      INT IDENTITY(1,1) NOT NULL,
        IdColaborador               INT NOT NULL,
        FechaBaja                   DATE NOT NULL,
        TipoBaja                    VARCHAR(100) NULL,
        Comentarios                 VARCHAR(500) NULL,
        RenunciaVoluntaria          VARCHAR(50) NULL,
        ConvenioFiniquito           VARCHAR(50) NULL,
        ConvenioConfidencialidad    VARCHAR(50) NULL,
        FechaRegistro               DATETIME2(0) NOT NULL CONSTRAINT DF_ColaboradorBajas_FechaRegistro DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ColaboradorBajas PRIMARY KEY CLUSTERED (IdBaja),
        CONSTRAINT FK_ColaboradorBajas_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_ColaboradorBajas_Colaborador ON dbo.ColaboradorBajas (IdColaborador);
    PRINT '  -> Tabla dbo.ColaboradorBajas creada exitosamente.';
END
ELSE
BEGIN
    PRINT '  -> Tabla dbo.ColaboradorBajas ya existe.';
END;
GO

-- C. TABLA: dbo.ColaboradorDatosFinancieros (Aislamiento de Confidencialidad y Salarios)
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
    PRINT '  -> Tabla dbo.ColaboradorDatosFinancieros ya existe.';
END;
GO

PRINT '=============================================================================';
PRINT '  MIGRACIÓN DEL MODELO DE DATOS DE DESARROLLO_O FINALIZADA CON ÉXITO';
PRINT '=============================================================================';
GO
