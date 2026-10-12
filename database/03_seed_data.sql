-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 03_seed_data.sql
-- DESCRIPCIÓN: Catálogo de las 8 Empresas NOMIPAQ, Días Festivos LFT 2024-2027 y Cuentas Demo
-- BASE DE DATOS: DESARROLLO_O
-- =================================================================================

USE DESARROLLO_O;
GO

-- =================================================================================
-- 1. CATÁLOGO DE LAS 8 EMPRESAS / BASES DE DATOS DE CONTPAQi NÓMINAS
-- =================================================================================
PRINT 'Inicializando catálogo de las 8 empresas de Grupo JAMA...';

MERGE dbo.EmpresasNomipaq AS Target
USING (VALUES
    ('ctCEMENTOS_MOCTEZ', 'CEMENTOS MOCTEZUMA', 1),
    ('ctCONSTRUJAMA_DE_', 'CONSTRUJAMA DE MEXICO S.A. DE C.V.', 1),
    ('ctCONTROLADORA_JA', 'CONTROLADORA JAMA, S.C.', 1),
    ('ctDISTRIBUIDOR_DE', 'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.', 1),
    ('ctDISTRIBUIDORA_J', 'DISTRIBUIDORA JAMA', 1),
    ('ctIMPULSORA_DE_NE', 'IMPULSORA DE NEGOCIOS', 1),
    ('ctLATINO_CONCRETO', 'LATINO CONCRETOS', 1),
    ('ctTRAMO_DEL_CENTR', 'TRAMO DEL CENTRO', 1)
) AS Source (NombreBaseDatos, AliasEmpresa, Activa)
ON (Target.NombreBaseDatos = Source.NombreBaseDatos)
WHEN MATCHED THEN
    UPDATE SET Target.AliasEmpresa = Source.AliasEmpresa, Target.Activa = Source.Activa
WHEN NOT MATCHED THEN
    INSERT (NombreBaseDatos, AliasEmpresa, Activa)
    VALUES (Source.NombreBaseDatos, Source.AliasEmpresa, Source.Activa);
GO

-- =================================================================================
-- 2. CATÁLOGO DE DÍAS FESTIVOS E INHÁBILES OFICIALES (LFT Art. 74 México 2024-2027)
-- =================================================================================
PRINT 'Poblando Días Inhábiles y Festivos Oficiales LFT...';

MERGE dbo.DiasInhabiles AS Target
USING (VALUES
    -- 2024
    ('2024-01-01', 'Año Nuevo', 1),
    ('2024-02-05', 'Día de la Constitución Mexicana', 1),
    ('2024-03-18', 'Natalicio de Benito Juárez', 1),
    ('2024-03-28', 'Jueves Santo', 0),
    ('2024-03-29', 'Viernes Santo', 0),
    ('2024-05-01', 'Día del Trabajo', 1),
    ('2024-09-16', 'Día de la Independencia de México', 1),
    ('2024-10-01', 'Transmisión del Poder Ejecutivo Federal', 1),
    ('2024-11-18', 'Revolución Mexicana', 1),
    ('2024-12-25', 'Navidad', 1),

    -- 2025
    ('2025-01-01', 'Año Nuevo', 1),
    ('2025-02-03', 'Día de la Constitución Mexicana', 1),
    ('2025-03-17', 'Natalicio de Benito Juárez', 1),
    ('2025-04-17', 'Jueves Santo', 0),
    ('2025-04-18', 'Viernes Santo', 0),
    ('2025-05-01', 'Día del Trabajo', 1),
    ('2025-09-16', 'Día de la Independencia de México', 1),
    ('2025-11-17', 'Revolución Mexicana', 1),
    ('2025-12-25', 'Navidad', 1),

    -- 2026
    ('2026-01-01', 'Año Nuevo', 1),
    ('2026-02-02', 'Día de la Constitución Mexicana', 1),
    ('2026-03-16', 'Natalicio de Benito Juárez', 1),
    ('2026-04-02', 'Jueves Santo', 0),
    ('2026-04-03', 'Viernes Santo', 0),
    ('2026-05-01', 'Día del Trabajo', 1),
    ('2026-09-16', 'Día de la Independencia de México', 1),
    ('2026-11-16', 'Revolución Mexicana', 1),
    ('2026-12-25', 'Navidad', 1),

    -- 2027
    ('2027-01-01', 'Año Nuevo', 1),
    ('2027-02-01', 'Día de la Constitución Mexicana', 1),
    ('2027-03-15', 'Natalicio de Benito Juárez', 1),
    ('2027-03-25', 'Jueves Santo', 0),
    ('2027-03-26', 'Viernes Santo', 0),
    ('2027-05-01', 'Día del Trabajo', 1),
    ('2027-09-16', 'Día de la Independencia de México', 1),
    ('2027-11-15', 'Revolución Mexicana', 1),
    ('2027-12-25', 'Navidad', 1)
) AS Source (Fecha, Descripcion, EsFeriadoOficial)
ON (Target.Fecha = CAST(Source.Fecha AS DATE))
WHEN MATCHED THEN
    UPDATE SET Target.Descripcion = Source.Descripcion, Target.EsFeriadoOficial = Source.EsFeriadoOficial
WHEN NOT MATCHED THEN
    INSERT (Fecha, Descripcion, EsFeriadoOficial, Activo)
    VALUES (CAST(Source.Fecha AS DATE), Source.Descripcion, Source.EsFeriadoOficial, 1);
GO

-- =================================================================================
-- 3. DEPARTAMENTOS Y PUESTOS BASE POR EMPRESA
-- =================================================================================
DECLARE @IdConstrujama INT, @IdControladora INT, @IdDicosa INT;
SELECT @IdConstrujama = IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctCONSTRUJAMA_DE_';
SELECT @IdControladora = IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctCONTROLADORA_JA';
SELECT @IdDicosa = IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctDISTRIBUIDOR_DE';

-- Departamentos en Construjama
MERGE dbo.Departamentos AS Target
USING (VALUES
    (@IdConstrujama, 'D01', 'ADMINISTRACION'),
    (@IdConstrujama, 'D02', 'LOGISTICA'),
    (@IdConstrujama, 'D03', 'VENTAS'),
    (@IdControladora, 'D05', 'DESARROLLO ORGANIZACIONAL'),
    (@IdControladora, 'D06', 'DIRECCION GENERAL'),
    (@IdDicosa, 'D01', 'ADMINISTRACION')
) AS Source (IdEmpresa, CodigoNomipaq, Nombre)
ON (Target.IdEmpresa = Source.IdEmpresa AND Target.CodigoNomipaq = Source.CodigoNomipaq)
WHEN NOT MATCHED THEN
    INSERT (IdEmpresa, CodigoNomipaq, Nombre, Activo) VALUES (Source.IdEmpresa, Source.CodigoNomipaq, Source.Nombre, 1);

-- Puestos
MERGE dbo.Puestos AS Target
USING (VALUES
    (@IdConstrujama, 'P01', 'GERENTE DE SUCURSAL'),
    (@IdConstrujama, 'P05', 'MONTACARGUISTA 6'),
    (@IdControladora, 'P08', 'ESPECIALISTA DE DESARROLLO ORGANIZACIONAL'),
    (@IdControladora, 'P09', 'DIRECTOR GENERAL'),
    (@IdDicosa, 'P04', 'ENCARGADO DE SUCURSAL')
) AS Source (IdEmpresa, CodigoNomipaq, Nombre)
ON (Target.IdEmpresa = Source.IdEmpresa AND Target.CodigoNomipaq = Source.CodigoNomipaq)
WHEN NOT MATCHED THEN
    INSERT (IdEmpresa, CodigoNomipaq, Nombre, Activo) VALUES (Source.IdEmpresa, Source.CodigoNomipaq, Source.Nombre, 1);
GO

-- =================================================================================
-- 4. COLABORADORES INICIALES CON LLAVE COMPUESTA (IdEmpresa, CodigoEmpleado)
-- =================================================================================
DECLARE @IdConstrujama INT, @IdControladora INT, @IdDicosa INT;
SELECT @IdConstrujama = IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctCONSTRUJAMA_DE_';
SELECT @IdControladora = IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctCONTROLADORA_JA';
SELECT @IdDicosa = IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctDISTRIBUIDOR_DE';

-- 1. Director General (Nivel 1)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE IdEmpresa = @IdControladora AND CodigoEmpleado = 'DIR-001')
BEGIN
    INSERT INTO dbo.Colaboradores (
        IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, RolApp, Activo
    )
    VALUES (
        @IdControladora, 'DIR-001', 'MANUEL', 'TOLEDO', 'ALVAREZ',
        'TOAM700101HDFR00', 'TOAM700101XXX', 'mtoledo@grupojama.com', '4441002001',
        'CONTROLADORA JAMA, S.C.', 'CONTROLADORA', '1998-01-15',
        'A', 'LIDER', 1
    );
END

-- 2. Administrador de Desarrollo Organizacional (Admin DO)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE IdEmpresa = @IdControladora AND CodigoEmpleado = 'DO-010')
BEGIN
    INSERT INTO dbo.Colaboradores (
        IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, RolApp, Activo
    )
    VALUES (
        @IdControladora, 'DO-010', 'TANIA', 'RAMIREZ', 'MEDINA',
        'RAMT880520MDFR00', 'RAMT880520XXX', 'tania.do@grupojama.com', '4441002002',
        'CONTROLADORA JAMA, S.C.', 'CONTROLADORA', '2016-03-01',
        'A', 'ADMIN_DO', 1
    );
END

-- 3. Líder de Sucursal (Gerente con equipo a cargo en Construjama)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE IdEmpresa = @IdConstrujama AND CodigoEmpleado = 'CONS-103')
BEGIN
    INSERT INTO dbo.Colaboradores (
        IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, RolApp, Activo
    )
    VALUES (
        @IdConstrujama, 'CONS-103', 'MARIA DE JESUS', 'ARAIZA', 'VAZQUEZ',
        'AIVM750812MDFR00', 'AIVM750812XXX', 'maraiza@grupojama.com', '4441002003',
        'CONSTRUJAMA DE MEXICO S.A. DE C.V.', 'GUADALAJARA', '2003-01-15',
        'A', 'LIDER', 1
    );
END

-- Obtener ID de Mary Araiza
DECLARE @IdLiderMary INT;
SELECT @IdLiderMary = IdColaborador FROM dbo.Colaboradores WHERE CodigoEmpleado = 'CONS-103';

-- 4. Colaborador en Construjama (Benito Salazar)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE IdEmpresa = @IdConstrujama AND CodigoEmpleado = 'CONS-100')
BEGIN
    INSERT INTO dbo.Colaboradores (
        IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        @IdConstrujama, 'CONS-100', 'BENITO', 'SALAZAR', 'GRIMALDO',
        'SAGB790214HDFR00', 'SAGB790214XXX', 'bsalazar@grupojama.com', '4441002006',
        'CONSTRUJAMA DE MEXICO S.A. DE C.V.', 'SAN LUIS', '2000-06-17',
        'A', @IdLiderMary, 'COLABORADOR', 1
    );
END

-- 5. Colaborador en Dicosa (Mirna Luz Beiza)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE IdEmpresa = @IdDicosa AND CodigoEmpleado = 'DICO-107')
BEGIN
    INSERT INTO dbo.Colaboradores (
        IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        @IdDicosa, 'DICO-107', 'MIRNA LUZ', 'BEIZA', 'AGUIRRE',
        'BEAM820410MDFR00', 'BEAM820410XXX', 'mbeiza@grupojama.com', '4441002004',
        'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.', 'DICOSA', '2004-07-01',
        'A', @IdLiderMary, 'COLABORADOR', 1
    );
END
GO

-- 5. Cálculo automático de saldos iniciales LFT
EXEC dbo.sp_CalcularSaldosVacaciones;
GO

PRINT 'Inicialización de DESARROLLO_O con soporte multi-empresa completada con éxito.';
GO
