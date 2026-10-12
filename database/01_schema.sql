-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 01_schema.sql
-- DESCRIPCIÓN: Creación de Base de Datos, Tablas, Restricciones (Constraints) e Índices
-- MOTOR: Microsoft SQL Server 2016+ / 2019 / 2022 / Azure SQL
-- =================================================================================

-- 1. CREACIÓN DE BASE DE DATOS INDEPENDIENTE
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ControlVacaciones_DO')
BEGIN
    CREATE DATABASE ControlVacaciones_DO;
END
GO

USE ControlVacaciones_DO;
GO

-- Limpieza preventiva si se desea reiniciar el esquema (opcional / idempotente)
-- =================================================================================

-- 2. TABLA: Departamentos (sincronizada desde NOMIPAQ nom10003)
IF OBJECT_ID(N'dbo.Departamentos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departamentos (
        IdDepartamento      INT IDENTITY(1,1) NOT NULL,
        CodigoNomipaq       VARCHAR(20) NOT NULL,
        Nombre              VARCHAR(150) NOT NULL,
        Activo              BIT NOT NULL CONSTRAINT DF_Departamentos_Activo DEFAULT (1),
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Departamentos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion   DATETIME2(0) NULL,
        CONSTRAINT PK_Departamentos PRIMARY KEY CLUSTERED (IdDepartamento),
        CONSTRAINT UQ_Departamentos_CodigoNomipaq UNIQUE NONCLUSTERED (CodigoNomipaq)
    );
END
GO

-- 3. TABLA: Puestos (sincronizada desde NOMIPAQ nom10002)
IF OBJECT_ID(N'dbo.Puestos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Puestos (
        IdPuesto            INT IDENTITY(1,1) NOT NULL,
        CodigoNomipaq       VARCHAR(20) NOT NULL,
        Nombre              VARCHAR(150) NOT NULL,
        Activo              BIT NOT NULL CONSTRAINT DF_Puestos_Activo DEFAULT (1),
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Puestos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion   DATETIME2(0) NULL,
        CONSTRAINT PK_Puestos PRIMARY KEY CLUSTERED (IdPuesto),
        CONSTRAINT UQ_Puestos_CodigoNomipaq UNIQUE NONCLUSTERED (CodigoNomipaq)
    );
END
GO

-- 4. TABLA: Colaboradores (sincronizada desde NOMIPAQ nom10001 con atributos locales de gobernanza)
IF OBJECT_ID(N'dbo.Colaboradores', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Colaboradores (
        IdColaborador       INT IDENTITY(1,1) NOT NULL,
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
        IdJefeDirecto       INT NULL,
        RolApp              VARCHAR(20) NOT NULL CONSTRAINT DF_Colaboradores_RolApp DEFAULT ('COLABORADOR'),
        JornadaLaboralDias  INT NOT NULL CONSTRAINT DF_Colaboradores_Jornada DEFAULT (5), -- 5 días (L-V) o 6 días (L-S)
        Activo              BIT NOT NULL CONSTRAINT DF_Colaboradores_Activo DEFAULT (1),
        UltimaSincronizacion DATETIME2(0) NULL,
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Colaboradores_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion   DATETIME2(0) NULL,
        
        CONSTRAINT PK_Colaboradores PRIMARY KEY CLUSTERED (IdColaborador),
        CONSTRAINT UQ_Colaboradores_CodigoEmpleado UNIQUE NONCLUSTERED (CodigoEmpleado),
        CONSTRAINT FK_Colaboradores_Departamento FOREIGN KEY (IdDepartamento) REFERENCES dbo.Departamentos (IdDepartamento),
        CONSTRAINT FK_Colaboradores_Puesto FOREIGN KEY (IdPuesto) REFERENCES dbo.Puestos (IdPuesto),
        CONSTRAINT FK_Colaboradores_JefeDirecto FOREIGN KEY (IdJefeDirecto) REFERENCES dbo.Colaboradores (IdColaborador),
        CONSTRAINT CK_Colaboradores_RolApp CHECK (RolApp IN ('COLABORADOR', 'LIDER', 'ADMIN_DO')),
        CONSTRAINT CK_Colaboradores_EstatusNomina CHECK (EstatusNomina IN ('A', 'B'))
    );
END
GO

-- 5. TABLA: DiasInhabiles (Festivos oficiales LFT de México y días de asueto acordados por empresa)
IF OBJECT_ID(N'dbo.DiasInhabiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DiasInhabiles (
        IdDiaInhabil        INT IDENTITY(1,1) NOT NULL,
        Fecha               DATE NOT NULL,
        Descripcion         VARCHAR(150) NOT NULL,
        EsFeriadoOficial    BIT NOT NULL CONSTRAINT DF_DiasInhabiles_EsFeriado DEFAULT (1), -- 1 LFT Art. 74, 0 Día inhábil interno
        Activo              BIT NOT NULL CONSTRAINT DF_DiasInhabiles_Activo DEFAULT (1),
        CONSTRAINT PK_DiasInhabiles PRIMARY KEY CLUSTERED (IdDiaInhabil),
        CONSTRAINT UQ_DiasInhabiles_Fecha UNIQUE NONCLUSTERED (Fecha)
    );
END
GO

-- 6. TABLA: SaldosVacaciones (Cálculo acumulado y devengado por período anual conforme a LFT Vacaciones Dignas)
IF OBJECT_ID(N'dbo.SaldosVacaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SaldosVacaciones (
        IdSaldo                 INT IDENTITY(1,1) NOT NULL,
        IdColaborador           INT NOT NULL,
        AnioPeriodo             INT NOT NULL,                    -- Ejemplo: 2024, 2025, 2026
        AntiguedadCumplida      INT NOT NULL,                    -- Años cumplidos de servicio
        DiasCorrespondientes    DECIMAL(5,1) NOT NULL,          -- Conforme a la tabla de Vacaciones Dignas LFT
        DiasGozados             DECIMAL(5,1) NOT NULL CONSTRAINT DF_Saldos_DiasGozados DEFAULT (0.0),
        DiasPendientes          AS (DiasCorrespondientes - DiasGozados), -- Calculado persistente o dinámico
        FechaInicioPeriodo      DATE NOT NULL,
        FechaFinPeriodo         DATE NOT NULL,
        FechaExpiracionPeriodo  DATE NOT NULL,                   -- Usualmente 18 meses después de cumplir aniversario (LFT)
        EsCerrado               BIT NOT NULL CONSTRAINT DF_Saldos_EsCerrado DEFAULT (0),
        FechaUltimoCalculo      DATETIME2(0) NOT NULL CONSTRAINT DF_Saldos_FechaCalculo DEFAULT (SYSDATETIME()),
        
        CONSTRAINT PK_SaldosVacaciones PRIMARY KEY CLUSTERED (IdSaldo),
        CONSTRAINT FK_Saldos_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE,
        CONSTRAINT UQ_Saldos_Colaborador_Periodo UNIQUE NONCLUSTERED (IdColaborador, AnioPeriodo)
    );
END
GO

-- 7. TABLA: SolicitudesVacaciones (Registro transaccional de solicitudes y ciclo de vida)
IF OBJECT_ID(N'dbo.SolicitudesVacaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SolicitudesVacaciones (
        IdSolicitud             INT IDENTITY(1,1) NOT NULL,
        Folio                   VARCHAR(30) NOT NULL,            -- Ej: VAC-2026-0001
        IdColaborador           INT NOT NULL,
        FechaCreacion           DATETIME2(0) NOT NULL CONSTRAINT DF_Solicitudes_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaInicio             DATE NOT NULL,
        FechaFin                DATE NOT NULL,
        TotalDiasLaborables     DECIMAL(4,1) NOT NULL,          -- Días hábiles calculados omitiendo festivos y descansos
        TotalDiasNaturales      AS (DATEDIFF(DAY, FechaInicio, FechaFin) + 1),
        MotivoComentarios       VARCHAR(500) NULL,
        Estado                  VARCHAR(25) NOT NULL CONSTRAINT DF_Solicitudes_Estado DEFAULT ('PENDIENTE_LIDER'),
        FechaResolucion         DATETIME2(0) NULL,
        IdAprobadorFinal        INT NULL,
        MotivoRechazo           VARCHAR(500) NULL,
        
        CONSTRAINT PK_SolicitudesVacaciones PRIMARY KEY CLUSTERED (IdSolicitud),
        CONSTRAINT UQ_Solicitudes_Folio UNIQUE NONCLUSTERED (Folio),
        CONSTRAINT FK_Solicitudes_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador),
        CONSTRAINT FK_Solicitudes_AprobadorFinal FOREIGN KEY (IdAprobadorFinal) REFERENCES dbo.Colaboradores (IdColaborador),
        CONSTRAINT CK_Solicitudes_Estado CHECK (Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
        CONSTRAINT CK_Solicitudes_RangoFechas CHECK (FechaFin >= FechaInicio)
    );
END
GO

-- 8. TABLA: HistorialAprobaciones (Trazabilidad y sellado digital inmutable)
IF OBJECT_ID(N'dbo.HistorialAprobaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialAprobaciones (
        IdAprobacion            INT IDENTITY(1,1) NOT NULL,
        IdSolicitud             INT NOT NULL,
        IdAprobador             INT NOT NULL,
        NivelAprobacion         VARCHAR(30) NOT NULL,            -- 'LIDER_DIRECTO', 'DESARROLLO_ORGANIZACIONAL', 'SISTEMA'
        Accion                  VARCHAR(20) NOT NULL,            -- 'ENVIADA', 'APROBADA', 'RECHAZADA', 'CANCELADA'
        Comentarios             VARCHAR(500) NULL,
        MetodoAutorizacion      VARCHAR(20) NOT NULL CONSTRAINT DF_Historial_Metodo DEFAULT ('WEB'), -- 'WEB', 'TEAMS', 'API'
        FechaAccion             DATETIME2(0) NOT NULL CONSTRAINT DF_Historial_FechaAccion DEFAULT (SYSDATETIME()),
        DireccionIP             VARCHAR(45) NULL,
        
        CONSTRAINT PK_HistorialAprobaciones PRIMARY KEY CLUSTERED (IdAprobacion),
        CONSTRAINT FK_Historial_Solicitud FOREIGN KEY (IdSolicitud) REFERENCES dbo.SolicitudesVacaciones (IdSolicitud) ON DELETE CASCADE,
        CONSTRAINT FK_Historial_Aprobador FOREIGN KEY (IdAprobador) REFERENCES dbo.Colaboradores (IdColaborador)
    );
END
GO

-- 9. TABLA: BitacoraSincronizacionNomipaq (Auditoría de sincronizaciones nocturnas/manuales)
IF OBJECT_ID(N'dbo.BitacoraSincronizacionNomipaq', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BitacoraSincronizacionNomipaq (
        IdSync                  INT IDENTITY(1,1) NOT NULL,
        FechaEjecucion          DATETIME2(0) NOT NULL CONSTRAINT DF_Sync_Fecha DEFAULT (SYSDATETIME()),
        TipoEjecucion           VARCHAR(20) NOT NULL CONSTRAINT DF_Sync_Tipo DEFAULT ('MANUAL'), -- 'MANUAL', 'AUTOMATICA'
        IdUsuarioEjecuto        INT NULL,
        RegistrosInsertados     INT NOT NULL DEFAULT (0),
        RegistrosActualizados   INT NOT NULL DEFAULT (0),
        RegistrosDesactivados   INT NOT NULL DEFAULT (0),
        DetalleLog              NVARCHAR(MAX) NULL,
        Exitoso                 BIT NOT NULL DEFAULT (1),
        CONSTRAINT PK_BitacoraSync PRIMARY KEY CLUSTERED (IdSync)
    );
END
GO

-- =================================================================================
-- 10. ÍNDICES DE RENDIMIENTO (Performance & Queries frecuentes)
-- =================================================================================

-- Colaboradores: Búsqueda rápida por jefe, departamento y estatus
CREATE NONCLUSTERED INDEX IX_Colaboradores_IdJefeDirecto 
ON dbo.Colaboradores (IdJefeDirecto) 
INCLUDE (Nombre, ApellidoPaterno, ApellidoMaterno, Activo, EstatusNomina);

CREATE NONCLUSTERED INDEX IX_Colaboradores_IdDepartamento 
ON dbo.Colaboradores (IdDepartamento) 
INCLUDE (Activo, EstatusNomina);

CREATE NONCLUSTERED INDEX IX_Colaboradores_RolApp 
ON dbo.Colaboradores (RolApp) 
INCLUDE (Activo, Email);

-- Solicitudes: Filtrado ágil por colaborador y estado (para bandejas del líder y DO)
CREATE NONCLUSTERED INDEX IX_Solicitudes_IdColaborador_Estado 
ON dbo.SolicitudesVacaciones (IdColaborador, Estado) 
INCLUDE (FechaInicio, FechaFin, TotalDiasLaborables, Folio);

CREATE NONCLUSTERED INDEX IX_Solicitudes_Estado 
ON dbo.SolicitudesVacaciones (Estado) 
INCLUDE (IdColaborador, FechaInicio, FechaFin, TotalDiasLaborables, Folio);

-- Saldos: Consulta de saldo disponible
CREATE NONCLUSTERED INDEX IX_Saldos_IdColaborador_EsCerrado 
ON dbo.SaldosVacaciones (IdColaborador, EsCerrado) 
INCLUDE (AnioPeriodo, DiasCorrespondientes, DiasGozados, FechaExpiracionPeriodo);

-- Días Inhábiles: Búsqueda por rango de fechas
CREATE NONCLUSTERED INDEX IX_DiasInhabiles_Fecha 
ON dbo.DiasInhabiles (Fecha, Activo) 
INCLUDE (Descripcion, EsFeriadoOficial);
GO
