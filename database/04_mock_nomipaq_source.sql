-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 04_mock_nomipaq_source.sql
-- DESCRIPCIÓN: Estructura de extracción y simulación de CONTPAQi Nóminas (NOMIPAQ)
--              Crea las tablas nativas (nom10001, nom10002, nom10003) y las vistas
--              de extracción de solo lectura hacia ControlVacaciones_DO.
-- =================================================================================

-- 1. BASE DE DATOS NOMIPAQ (o instancia existente de nóminas)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'nomipaq_jama')
BEGIN
    CREATE DATABASE nomipaq_jama;
END
GO

USE nomipaq_jama;
GO

-- 2. TABLA NATIVA NOMIPAQ: nom10003 (Departamentos)
IF OBJECT_ID(N'dbo.nom10003', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.nom10003 (
        iddepartamento      INT NOT NULL,
        numerodepartamento  VARCHAR(20) NOT NULL,
        descripcion         VARCHAR(100) NOT NULL,
        CONSTRAINT PK_nom10003 PRIMARY KEY (iddepartamento)
    );
END
GO

-- 3. TABLA NATIVA NOMIPAQ: nom10002 (Puestos)
IF OBJECT_ID(N'dbo.nom10002', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.nom10002 (
        idpuesto            INT NOT NULL,
        numeropuesto        VARCHAR(20) NOT NULL,
        descripcion         VARCHAR(100) NOT NULL,
        CONSTRAINT PK_nom10002 PRIMARY KEY (idpuesto)
    );
END
GO

-- 4. TABLA NATIVA NOMIPAQ: nom10001 (Catálogo de Empleados / Trabajadores)
IF OBJECT_ID(N'dbo.nom10001', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.nom10001 (
        idempleado          INT NOT NULL,
        codigoempleado      VARCHAR(30) NOT NULL,
        nombre              VARCHAR(80) NOT NULL,
        apellidopaterno     VARCHAR(80) NOT NULL,
        apellidomaterno     VARCHAR(80) NULL,
        curp                VARCHAR(18) NULL,
        rfc                 VARCHAR(13) NULL,
        correolectronico    VARCHAR(150) NULL,
        fechaalta           DATETIME NOT NULL,
        fechareingreso      DATETIME NULL,
        fechabaja           DATETIME NULL,
        estadoempleado      CHAR(1) NOT NULL DEFAULT 'A', -- 'A' = Activo, 'B' = Baja
        iddepartamento      INT NULL,
        idpuesto            INT NULL,
        campousuario1       VARCHAR(100) NULL, -- Empresa (ej. CONSTRUJAMA, DICOSA)
        campousuario2       VARCHAR(100) NULL, -- Sucursal (ej. SAN LUIS, GUADALAJARA)
        CONSTRAINT PK_nom10001 PRIMARY KEY (idempleado)
    );
END
GO

-- 5. POBLADO DE MUESTRA PARA VALIDAR EXTRACCIÓN
INSERT INTO dbo.nom10003 (iddepartamento, numerodepartamento, descripcion)
VALUES 
    (1, 'D01', 'ADMINISTRACION'),
    (2, 'D02', 'LOGISTICA'),
    (3, 'D03', 'VENTAS'),
    (4, 'D04', 'OPERACIONES Y PATIO'),
    (5, 'D05', 'DESARROLLO ORGANIZACIONAL')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion); -- o script idempotente

MERGE dbo.nom10003 AS Target
USING (VALUES
    (1, 'D01', 'ADMINISTRACION'),
    (2, 'D02', 'LOGISTICA'),
    (3, 'D03', 'VENTAS'),
    (4, 'D04', 'OPERACIONES Y PATIO'),
    (5, 'D05', 'DESARROLLO ORGANIZACIONAL')
) AS Source (iddepartamento, numerodepartamento, descripcion)
ON Target.iddepartamento = Source.iddepartamento
WHEN MATCHED THEN UPDATE SET descripcion = Source.descripcion
WHEN NOT MATCHED THEN INSERT (iddepartamento, numerodepartamento, descripcion) VALUES (Source.iddepartamento, Source.numerodepartamento, Source.descripcion);

MERGE dbo.nom10002 AS Target
USING (VALUES
    (1, 'P01', 'GERENTE DE SUCURSAL'),
    (2, 'P02', 'GERENTE DE TESORERIA'),
    (3, 'P03', 'COORDINADOR COMERCIAL'),
    (4, 'P04', 'ENCARGADO DE SUCURSAL'),
    (5, 'P05', 'MONTACARGUISTA 6'),
    (6, 'P06', 'JEFE DE PATIO 3'),
    (7, 'P07', 'ASISTENTE ADMVO Y ABASTO')
) AS Source (idpuesto, numeropuesto, descripcion)
ON Target.idpuesto = Source.idpuesto
WHEN MATCHED THEN UPDATE SET descripcion = Source.descripcion
WHEN NOT MATCHED THEN INSERT (idpuesto, numeropuesto, descripcion) VALUES (Source.idpuesto, Source.numeropuesto, Source.descripcion);

MERGE dbo.nom10001 AS Target
USING (VALUES
    (100, 'CONS-100', 'BENITO', 'SALAZAR', 'GRIMALDO', 'SAGB790214HDFR00', 'SAGB790214XXX', 'bsalazar@grupojama.com', '2000-06-17', NULL, 'A', 2, 5, 'CONSTRUJAMA DE MEXICO S.A. de C.V.', 'SAN LUIS'),
    (102, 'CONT-102', 'ROCIO IMELDA', 'GONZALEZ', 'SALAS', 'GOSR751010MDFR00', 'GOSR751010XXX', 'rgonzalez@grupojama.com', '2002-10-18', NULL, 'A', 1, 2, 'CONTROLADORA JAMA, S.C.', 'CONTROLADORA'),
    (103, 'CONS-103', 'MARIA DE JESUS', 'ARAIZA', 'VAZQUEZ', 'AIVM750812MDFR00', 'AIVM750812XXX', 'maraiza@grupojama.com', '2003-01-15', NULL, 'A', 1, 1, 'CONSTRUJAMA DE MEXICO S.A. de C.V.', 'GUADALAJARA'),
    (107, 'DICO-107', 'MIRNA LUZ', 'BEIZA', 'AGUIRRE', 'BEAM820410MDFR00', 'BEAM820410XXX', 'mbeiza@grupojama.com', '2004-07-01', NULL, 'A', 1, 4, 'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.', 'DICOSA'),
    (112, 'CONS-112', 'JOSE EDUARDO', 'LOPEZ', 'SALINAS', 'LOSJ860915HDFR00', 'LOSJ860915XXX', 'jlopez@grupojama.com', '2008-10-27', NULL, 'A', 3, 3, 'CONSTRUJAMA DE MEXICO S.A. de C.V.', 'GUADALAJARA')
) AS Source (idempleado, codigoempleado, nombre, apellidopaterno, apellidomaterno, curp, rfc, correolectronico, fechaalta, fechareingreso, estadoempleado, iddepartamento, idpuesto, campousuario1, campousuario2)
ON Target.idempleado = Source.idempleado
WHEN MATCHED THEN 
    UPDATE SET 
        nombre = Source.nombre,
        apellidopaterno = Source.apellidopaterno,
        apellidomaterno = Source.apellidomaterno,
        estadoempleado = Source.estadoempleado
WHEN NOT MATCHED THEN
    INSERT (idempleado, codigoempleado, nombre, apellidopaterno, apellidomaterno, curp, rfc, correolectronico, fechaalta, fechareingreso, estadoempleado, iddepartamento, idpuesto, campousuario1, campousuario2)
    VALUES (Source.idempleado, Source.codigoempleado, Source.nombre, Source.apellidopaterno, Source.apellidomaterno, Source.curp, Source.rfc, Source.correolectronico, Source.fechaalta, Source.fechareingreso, Source.estadoempleado, Source.iddepartamento, Source.idpuesto, Source.campousuario1, Source.campousuario2);
GO

-- =================================================================================
-- 6. VISTAS DE EXTRACCIÓN EN ControlVacaciones_DO (Lectura segura desacoplada)
-- =================================================================================
USE ControlVacaciones_DO;
GO

-- Vista para Departamentos
CREATE OR ALTER VIEW dbo.vw_Nomipaq_Departamentos
AS
SELECT 
    d.numerodepartamento AS CodigoNomipaq,
    RTRIM(LTRIM(d.descripcion)) AS Nombre
FROM nomipaq_jama.dbo.nom10003 d;
GO

-- Vista para Puestos
CREATE OR ALTER VIEW dbo.vw_Nomipaq_Puestos
AS
SELECT 
    p.numeropuesto AS CodigoNomipaq,
    RTRIM(LTRIM(p.descripcion)) AS Nombre
FROM nomipaq_jama.dbo.nom10002 p;
GO

-- Vista para Empleados
CREATE OR ALTER VIEW dbo.vw_Nomipaq_Empleados
AS
SELECT 
    e.codigoempleado AS CodigoEmpleado,
    RTRIM(LTRIM(e.nombre)) AS Nombre,
    RTRIM(LTRIM(e.apellidopaterno)) AS ApellidoPaterno,
    RTRIM(LTRIM(ISNULL(e.apellidomaterno, ''))) AS ApellidoMaterno,
    e.curp AS CURP,
    e.rfc AS RFC,
    e.correolectronico AS Email,
    e.campousuario1 AS Empresa,
    e.campousuario2 AS Sucursal,
    CAST(e.fechaalta AS DATE) AS FechaAlta,
    CAST(e.fechareingreso AS DATE) AS FechaReingreso,
    e.estadoempleado AS EstatusNomina,
    loc_d.IdDepartamento AS IdDepartamentoLocal,
    loc_p.IdPuesto AS IdPuestoLocal
FROM nomipaq_jama.dbo.nom10001 e
LEFT JOIN nomipaq_jama.dbo.nom10003 d ON d.iddepartamento = e.iddepartamento
LEFT JOIN dbo.Departamentos loc_d ON loc_d.CodigoNomipaq = d.numerodepartamento
LEFT JOIN nomipaq_jama.dbo.nom10002 p ON p.idpuesto = e.idpuesto
LEFT JOIN dbo.Puestos loc_p ON loc_p.CodigoNomipaq = p.numeropuesto;
GO
