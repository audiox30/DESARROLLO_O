-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 01_schema.sql
-- DESCRIPCIÓN: DDL de Base de Datos DESARROLLO_O con soporte Multi-Empresa para CONTPAQi Nóminas
-- MOTOR: Microsoft SQL Server 2016+ / 2019 / 2022
-- =================================================================================

-- 1. CREACIÓN DE BASE DE DATOS LOCAL
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'DESARROLLO_O')
BEGIN
    CREATE DATABASE DESARROLLO_O;
END
GO

USE DESARROLLO_O;
GO

-- =================================================================================
-- 2. TABLA: EmpresasNomipaq (Catálogo de Razones Sociales / Bases de Datos Remotas)
-- =================================================================================
IF OBJECT_ID(N'dbo.EmpresasNomipaq', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmpresasNomipaq (
        IdEmpresa           INT IDENTITY(1,1) NOT NULL,
        NombreBaseDatos     VARCHAR(100) NOT NULL, -- Nombre exacto en CONTPAQi (ej. ctCONSTRUJAMA_DE_)
        AliasEmpresa        VARCHAR(150) NOT NULL, -- Nombre comercial o razón social
        Activa              BIT NOT NULL CONSTRAINT DF_EmpresasNomipaq_Activa DEFAULT (1),
        UltimaSincronizacion DATETIME2(0) NULL,
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_EmpresasNomipaq_FechaCreacion DEFAULT (SYSDATETIME()),
        
        CONSTRAINT PK_EmpresasNomipaq PRIMARY KEY CLUSTERED (IdEmpresa),
        CONSTRAINT UQ_EmpresasNomipaq_NombreBaseDatos UNIQUE NONCLUSTERED (NombreBaseDatos)
    );
END
GO

-- =================================================================================
-- 3. TABLA: Departamentos (Sincronizada desde nom10003 por cada empresa remota)
-- =================================================================================
IF OBJECT_ID(N'dbo.Departamentos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departamentos (
        IdDepartamento      INT IDENTITY(1,1) NOT NULL,
        IdEmpresa           INT NOT NULL,
        CodigoNomipaq       VARCHAR(20) NOT NULL,
        Nombre              VARCHAR(150) NOT NULL,
        Activo              BIT NOT NULL CONSTRAINT DF_Departamentos_Activo DEFAULT (1),
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Departamentos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion   DATETIME2(0) NULL,
        
        CONSTRAINT PK_Departamentos PRIMARY KEY CLUSTERED (IdDepartamento),
        CONSTRAINT FK_Departamentos_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq (IdEmpresa),
        CONSTRAINT UQ_Departamentos_Empresa_Codigo UNIQUE NONCLUSTERED (IdEmpresa, CodigoNomipaq)
    );
END
GO

-- =================================================================================
-- 4. TABLA: Puestos (Sincronizada desde nom10002 por cada empresa remota)
-- =================================================================================
IF OBJECT_ID(N'dbo.Puestos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Puestos (
        IdPuesto            INT IDENTITY(1,1) NOT NULL,
        IdEmpresa           INT NOT NULL,
        CodigoNomipaq       VARCHAR(20) NOT NULL,
        Nombre              VARCHAR(150) NOT NULL,
        Activo              BIT NOT NULL CONSTRAINT DF_Puestos_Activo DEFAULT (1),
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Puestos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion   DATETIME2(0) NULL,
        
        CONSTRAINT PK_Puestos PRIMARY KEY CLUSTERED (IdPuesto),
        CONSTRAINT FK_Puestos_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq (IdEmpresa),
        CONSTRAINT UQ_Puestos_Empresa_Codigo UNIQUE NONCLUSTERED (IdEmpresa, CodigoNomipaq)
    );
END
GO

-- =================================================================================
-- 5. TABLA: Colaboradores (Llave compuesta natural: IdEmpresa + CodigoEmpleado)
-- =================================================================================
IF OBJECT_ID(N'dbo.Colaboradores', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Colaboradores (
        IdColaborador       INT IDENTITY(1,1) NOT NULL,
        IdEmpresa           INT NOT NULL,
        CodigoEmpleado      VARCHAR(30) NOT NULL,
        Nombre              VARCHAR(100) NOT NULL,
        ApellidoPaterno     VARCHAR(100) NOT NULL,
        ApellidoMaterno     VARCHAR(100) NULL,
        NombreCompleto      AS (RTRIM(LTRIM(Nombre + ' ' + ApellidoPaterno + ISNULL(' ' + ApellidoMaterno, '')))) PERSISTED,
        CURP                VARCHAR(18) NULL,
        RFC                 VARCHAR(13) NULL,
        Email               VARCHAR(150) NULL,
        Telefono            VARCHAR(30) NULL,
        Empresa             VARCHAR(150) NULL,
        Sucursal            VARCHAR(100) NULL,
        FechaAlta           DATE NOT NULL,
        FechaReingreso      DATE NULL,
        EstatusNomina       VARCHAR(10) NOT NULL CONSTRAINT DF_Colaboradores_EstatusNomina DEFAULT ('A'), -- 'A' Activo, 'B' Baja
        IdDepartamento      INT NULL,
        IdPuesto            INT NULL,
        IdJefeDirecto       INT NULL, -- Exclusivo de la aplicación (NUNCA sobreescribir en MERGE)
        IdAprobadorSegundo  INT NULL, -- Aprobador Nivel 2 (Gerente de Sucursal / Planta)
        RolApp              VARCHAR(20) NOT NULL CONSTRAINT DF_Colaboradores_RolApp DEFAULT ('COLABORADOR'), -- Exclusivo (NUNCA sobreescribir)
        JornadaLaboralDias  INT NOT NULL CONSTRAINT DF_Colaboradores_Jornada DEFAULT (6), -- Jornada Estándar Grupo JAMA (Lunes a Sábado)
        Activo              BIT NOT NULL CONSTRAINT DF_Colaboradores_Activo DEFAULT (1),
        
        -- Campos adicionales del Catálogo Maestro de DO (Excel ACTIVOS y BAJAS)
        -- Identificadores y Seguridad Social
        Subfijo             VARCHAR(20) NULL,
        NSS                 VARCHAR(15) NULL,
        -- Datos Demográficos
        Sexo                CHAR(1) NULL,
        FechaNacimiento     DATE NULL,
        EstadoCivil         VARCHAR(20) NULL,
        Nacionalidad        VARCHAR(50) CONSTRAINT DF_Colaboradores_Nacionalidad DEFAULT ('MEXICANA'),
        Escolaridad         VARCHAR(80) NULL,
        -- Domicilio Particular
        Domicilio           VARCHAR(250) NULL,
        Municipio           VARCHAR(100) NULL,
        EstadoProvincia     VARCHAR(100) NULL,
        CodigoPostal        VARCHAR(10) NULL,
        -- Condiciones Operativas y Vacaciones
        DiasDescanso        VARCHAR(50) NULL,
        CentroCostos        VARCHAR(50) NULL,
        TipoNomina          VARCHAR(30) NULL,
        TipoContrato        VARCHAR(50) NULL,
        PeriodicidadPago    VARCHAR(30) NULL,
        FechaAltaImss       DATE NULL,
        FechaEvaluacion     DATE NULL,
        DomicilioLaboral    VARCHAR(250) NULL,
        -- Emergencias y Salud
        AvisarEmergencia    VARCHAR(120) NULL,
        ParentescoEmergencia VARCHAR(50) NULL,
        TelefonoEmergencia  VARCHAR(30) NULL,
        TipoSangre          VARCHAR(10) NULL,
        AlergiasPadecimientos VARCHAR(200) NULL,
        -- Beneficiarios y Créditos
        Beneficiario        VARCHAR(150) NULL,
        ParentescoBeneficiario VARCHAR(50) NULL,
        RfcBeneficiario     VARCHAR(13) NULL,
        TieneInfonavit      VARCHAR(10) NULL,
        TieneFonacot        VARCHAR(10) NULL,
        FuenteReclutamiento VARCHAR(100) NULL,
        
        UltimaSincronizacion DATETIME2(0) NULL,
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Colaboradores_FechaCreacion DEFAULT (SYSUTCDATETIME()),
        FechaModificacion   DATETIME2(0) NULL,
        
        CONSTRAINT PK_Colaboradores PRIMARY KEY CLUSTERED (IdColaborador),
        CONSTRAINT FK_Colaboradores_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq (IdEmpresa),
        CONSTRAINT FK_Colaboradores_Departamento FOREIGN KEY (IdDepartamento) REFERENCES dbo.Departamentos (IdDepartamento),
        CONSTRAINT FK_Colaboradores_Puesto FOREIGN KEY (IdPuesto) REFERENCES dbo.Puestos (IdPuesto),
        CONSTRAINT FK_Colaboradores_JefeDirecto FOREIGN KEY (IdJefeDirecto) REFERENCES dbo.Colaboradores (IdColaborador),
        CONSTRAINT UQ_Colaboradores_Empresa_Codigo UNIQUE NONCLUSTERED (IdEmpresa, CodigoEmpleado),
        CONSTRAINT CK_Colaboradores_RolApp CHECK (RolApp IN ('COLABORADOR', 'LIDER', 'ADMIN_DO')),
        CONSTRAINT CK_Colaboradores_EstatusNomina CHECK (EstatusNomina IN ('A', 'B'))
    );
END
GO

-- =================================================================================
-- 6. TABLA: DiasInhabiles (Festivos oficiales LFT de México y días institucionales)
-- =================================================================================
IF OBJECT_ID(N'dbo.DiasInhabiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DiasInhabiles (
        IdDiaInhabil        INT IDENTITY(1,1) NOT NULL,
        Fecha               DATE NOT NULL,
        Descripcion         VARCHAR(150) NOT NULL,
        EsFeriadoOficial    BIT NOT NULL CONSTRAINT DF_DiasInhabiles_EsFeriado DEFAULT (1),
        Activo              BIT NOT NULL CONSTRAINT DF_DiasInhabiles_Activo DEFAULT (1),
        CONSTRAINT PK_DiasInhabiles PRIMARY KEY CLUSTERED (IdDiaInhabil),
        CONSTRAINT UQ_DiasInhabiles_Fecha UNIQUE NONCLUSTERED (Fecha)
    );
END
GO

-- =================================================================================
-- 7. TABLA: SaldosVacaciones (Cálculo acumulado y devengado conforme a LFT)
-- =================================================================================
IF OBJECT_ID(N'dbo.SaldosVacaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SaldosVacaciones (
        IdSaldo                 INT IDENTITY(1,1) NOT NULL,
        IdColaborador           INT NOT NULL,
        AnioPeriodo             INT NOT NULL,
        AntiguedadCumplida      INT NOT NULL,
        DiasCorrespondientes    DECIMAL(5,1) NOT NULL,
        DiasGozados             DECIMAL(5,1) NOT NULL CONSTRAINT DF_Saldos_DiasGozados DEFAULT (0.0),
        DiasPendientes          AS (DiasCorrespondientes - DiasGozados),
        FechaInicioPeriodo      DATE NOT NULL,
        FechaFinPeriodo         DATE NOT NULL,
        FechaExpiracionPeriodo  DATE NOT NULL,
        EsCerrado               BIT NOT NULL CONSTRAINT DF_Saldos_EsCerrado DEFAULT (0),
        FechaUltimoCalculo      DATETIME2(0) NOT NULL CONSTRAINT DF_Saldos_FechaCalculo DEFAULT (SYSDATETIME()),
        
        CONSTRAINT PK_SaldosVacaciones PRIMARY KEY CLUSTERED (IdSaldo),
        CONSTRAINT FK_Saldos_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE,
        CONSTRAINT UQ_Saldos_Colaborador_Periodo UNIQUE NONCLUSTERED (IdColaborador, AnioPeriodo)
    );
END
GO

-- =================================================================================
-- 8. TABLA: SolicitudesVacaciones (Transacciones del ciclo de vida)
-- =================================================================================
IF OBJECT_ID(N'dbo.SolicitudesVacaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SolicitudesVacaciones (
        IdSolicitud             INT IDENTITY(1,1) NOT NULL,
        Folio                   VARCHAR(30) NOT NULL,
        IdColaborador           INT NOT NULL,
        FechaCreacion           DATETIME2(0) NOT NULL CONSTRAINT DF_Solicitudes_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaInicio             DATE NOT NULL,
        FechaFin                DATE NOT NULL,
        TotalDiasLaborables     DECIMAL(4,1) NOT NULL,
        TotalDiasNaturales      AS (DATEDIFF(DAY, FechaInicio, FechaFin) + 1),
        MotivoComentarios       VARCHAR(500) NULL,
        Estado                  VARCHAR(25) NOT NULL CONSTRAINT DF_Solicitudes_Estado DEFAULT ('PENDIENTE_LIDER'),
        FechaResolucion         DATETIME2(0) NULL,
        IdAprobadorFinal        INT NULL,
        MotivoRechazo           VARCHAR(500) NULL,
        IdAprobadorLider        INT NULL,
        FechaAprobacionLider    DATETIME2(0) NULL,
        IdAprobadorSegundo      INT NULL,
        FechaAprobacionSegundo  DATETIME2(0) NULL,
        
        CONSTRAINT PK_SolicitudesVacaciones PRIMARY KEY CLUSTERED (IdSolicitud),
        CONSTRAINT UQ_Solicitudes_Folio UNIQUE NONCLUSTERED (Folio),
        CONSTRAINT FK_Solicitudes_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador),
        CONSTRAINT FK_Solicitudes_AprobadorFinal FOREIGN KEY (IdAprobadorFinal) REFERENCES dbo.Colaboradores (IdColaborador),
        CONSTRAINT CK_Solicitudes_Estado CHECK (Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_GERENTE', 'PENDIENTE_DO', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
        CONSTRAINT CK_Solicitudes_RangoFechas CHECK (FechaFin >= FechaInicio)
    );
END
GO

-- =================================================================================
-- 9. TABLA: HistorialAprobaciones (Trazabilidad y sellado digital inmutable)
-- =================================================================================
IF OBJECT_ID(N'dbo.HistorialAprobaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialAprobaciones (
        IdAprobacion            INT IDENTITY(1,1) NOT NULL,
        IdSolicitud             INT NOT NULL,
        IdAprobador             INT NOT NULL,
        NivelAprobacion         VARCHAR(30) NOT NULL,
        Accion                  VARCHAR(20) NOT NULL,
        Comentarios             VARCHAR(500) NULL,
        MetodoAutorizacion      VARCHAR(20) NOT NULL CONSTRAINT DF_Historial_Metodo DEFAULT ('WEB'),
        FechaAccion             DATETIME2(0) NOT NULL CONSTRAINT DF_Historial_FechaAccion DEFAULT (SYSDATETIME()),
        DireccionIP             VARCHAR(45) NULL,
        
        CONSTRAINT PK_HistorialAprobaciones PRIMARY KEY CLUSTERED (IdAprobacion),
        CONSTRAINT FK_Historial_Solicitud FOREIGN KEY (IdSolicitud) REFERENCES dbo.SolicitudesVacaciones (IdSolicitud) ON DELETE CASCADE,
        CONSTRAINT FK_Historial_Aprobador FOREIGN KEY (IdAprobador) REFERENCES dbo.Colaboradores (IdColaborador)
    );
END
GO

-- =================================================================================
-- 10. TABLA: BitacoraSincronizacionNomipaq (Auditoría multi-empresa)
-- =================================================================================
IF OBJECT_ID(N'dbo.BitacoraSincronizacionNomipaq', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BitacoraSincronizacionNomipaq (
        IdSync                  INT IDENTITY(1,1) NOT NULL,
        FechaEjecucion          DATETIME2(0) NOT NULL CONSTRAINT DF_Sync_Fecha DEFAULT (SYSDATETIME()),
        TipoEjecucion           VARCHAR(20) NOT NULL CONSTRAINT DF_Sync_Tipo DEFAULT ('MANUAL'),
        IdEmpresa               INT NULL,
        NombreBaseDatos         VARCHAR(100) NULL,
        IdUsuarioEjecuto        INT NULL,
        RegistrosInsertados     INT NOT NULL DEFAULT (0),
        RegistrosActualizados   INT NOT NULL DEFAULT (0),
        RegistrosDesactivados   INT NOT NULL DEFAULT (0),
        DetalleLog              NVARCHAR(MAX) NULL,
        Exitoso                 BIT NOT NULL DEFAULT (1),
        
        CONSTRAINT PK_BitacoraSync PRIMARY KEY CLUSTERED (IdSync),
        CONSTRAINT FK_BitacoraSync_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq (IdEmpresa)
    );
END
GO

-- =================================================================================
-- 11. TABLA: ColaboradorHijos (Catálogo de descendientes / prestaciones familiares)
-- =================================================================================
IF OBJECT_ID(N'dbo.ColaboradorHijos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ColaboradorHijos (
        IdHijo              INT IDENTITY(1,1) NOT NULL,
        IdColaborador       INT NOT NULL,
        NumeroHijo          INT NOT NULL,
        Nombre              VARCHAR(150) NULL,
        FechaNacimiento     DATE NULL,
        Sexo                CHAR(1) NULL,
        FechaRegistro       DATETIME2(0) NOT NULL CONSTRAINT DF_ColaboradorHijos_FechaRegistro DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ColaboradorHijos PRIMARY KEY CLUSTERED (IdHijo),
        CONSTRAINT FK_ColaboradorHijos_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE,
        CONSTRAINT UQ_Colaborador_Hijo UNIQUE NONCLUSTERED (IdColaborador, NumeroHijo)
    );
    CREATE NONCLUSTERED INDEX IX_ColaboradorHijos_Colaborador ON dbo.ColaboradorHijos (IdColaborador);
END
GO

-- =================================================================================
-- 12. TABLA: ColaboradorBajas (Historial y causas de desvinculación laboral)
-- =================================================================================
IF OBJECT_ID(N'dbo.ColaboradorBajas', N'U') IS NULL
BEGIN
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
END
GO

-- =================================================================================
-- 13. TABLA: ColaboradorDatosFinancieros (Aislamiento de salarios y dispersión bancaria)
-- =================================================================================
IF OBJECT_ID(N'dbo.ColaboradorDatosFinancieros', N'U') IS NULL
BEGIN
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
END
GO

-- =================================================================================
-- 14. ÍNDICES DE RENDIMIENTO (Performance)
-- =================================================================================
CREATE NONCLUSTERED INDEX IX_Colaboradores_Empresa_Activo 
ON dbo.Colaboradores (IdEmpresa, Activo) 
INCLUDE (CodigoEmpleado, NombreCompleto, IdDepartamento, IdPuesto, IdJefeDirecto);

CREATE NONCLUSTERED INDEX IX_Colaboradores_IdJefeDirecto 
ON dbo.Colaboradores (IdJefeDirecto) 
INCLUDE (NombreCompleto, Activo, EstatusNomina);

CREATE NONCLUSTERED INDEX IX_Solicitudes_Estado_IdColaborador 
ON dbo.SolicitudesVacaciones (Estado, IdColaborador) 
INCLUDE (FechaInicio, FechaFin, TotalDiasLaborables, Folio);

CREATE NONCLUSTERED INDEX IX_Saldos_IdColaborador 
ON dbo.SaldosVacaciones (IdColaborador, EsCerrado) 
INCLUDE (AnioPeriodo, DiasCorrespondientes, DiasGozados, FechaExpiracionPeriodo);
GO
