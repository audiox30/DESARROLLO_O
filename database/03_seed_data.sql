-- =================================================================================
-- PROYECTO: Control de Vacaciones (Desarrollo Organizacional) - Grupo JAMA
-- ARCHIVO: 03_seed_data.sql
-- DESCRIPCIÓN: Días festivos oficiales LFT México, Departamentos, Puestos y Empleados Demo
-- MOTOR: Microsoft SQL Server 2016+
-- =================================================================================

USE ControlVacaciones_DO;
GO

-- =================================================================================
-- 1. CATÁLOGO DE DÍAS FESTIVOS E INHÁBILES OFICIALES (LFT Art. 74 México 2024-2027)
-- =================================================================================
PRINT 'Poblando Días Inhábiles y Festivos Oficiales...';

MERGE dbo.DiasInhabiles AS Target
USING (VALUES
    -- Año 2024
    ('2024-01-01', 'Año Nuevo', 1),
    ('2024-02-05', 'Día de la Constitución Mexicana (Primer lunes de feb)', 1),
    ('2024-03-18', 'Natalicio de Benito Juárez (Tercer lunes de mar)', 1),
    ('2024-03-28', 'Jueves Santo (Asueto Institucional)', 0),
    ('2024-03-29', 'Viernes Santo (Asueto Institucional)', 0),
    ('2024-05-01', 'Día del Trabajo', 1),
    ('2024-09-16', 'Día de la Independencia de México', 1),
    ('2024-10-01', 'Transmisión del Poder Ejecutivo Federal', 1),
    ('2024-11-18', 'Revolución Mexicana (Tercer lunes de nov)', 1),
    ('2024-12-25', 'Navidad', 1),

    -- Año 2025
    ('2025-01-01', 'Año Nuevo', 1),
    ('2025-02-03', 'Día de la Constitución Mexicana (Primer lunes de feb)', 1),
    ('2025-03-17', 'Natalicio de Benito Juárez (Tercer lunes de mar)', 1),
    ('2025-04-17', 'Jueves Santo (Asueto Institucional)', 0),
    ('2025-04-18', 'Viernes Santo (Asueto Institucional)', 0),
    ('2025-05-01', 'Día del Trabajo', 1),
    ('2025-09-16', 'Día de la Independencia de México', 1),
    ('2025-11-17', 'Revolución Mexicana (Tercer lunes de nov)', 1),
    ('2025-12-25', 'Navidad', 1),

    -- Año 2026
    ('2026-01-01', 'Año Nuevo', 1),
    ('2026-02-02', 'Día de la Constitución Mexicana (Primer lunes de feb)', 1),
    ('2026-03-16', 'Natalicio de Benito Juárez (Tercer lunes de mar)', 1),
    ('2026-04-02', 'Jueves Santo (Asueto Institucional)', 0),
    ('2026-04-03', 'Viernes Santo (Asueto Institucional)', 0),
    ('2026-05-01', 'Día del Trabajo', 1),
    ('2026-09-16', 'Día de la Independencia de México', 1),
    ('2026-11-16', 'Revolución Mexicana (Tercer lunes de nov)', 1),
    ('2026-12-25', 'Navidad', 1),

    -- Año 2027
    ('2027-01-01', 'Año Nuevo', 1),
    ('2027-02-01', 'Día de la Constitución Mexicana (Primer lunes de feb)', 1),
    ('2027-03-15', 'Natalicio de Benito Juárez (Tercer lunes de mar)', 1),
    ('2027-03-25', 'Jueves Santo (Asueto Institucional)', 0),
    ('2027-03-26', 'Viernes Santo (Asueto Institucional)', 0),
    ('2027-05-01', 'Día del Trabajo', 1),
    ('2027-09-16', 'Día de la Independencia de México', 1),
    ('2027-11-15', 'Revolución Mexicana (Tercer lunes de nov)', 1),
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
-- 2. CATÁLOGOS BASE: DEPARTAMENTOS Y PUESTOS DE GRUPO JAMA
-- =================================================================================
MERGE dbo.Departamentos AS Target
USING (VALUES
    ('D01', 'ADMINISTRACION'),
    ('D02', 'LOGISTICA'),
    ('D03', 'VENTAS'),
    ('D04', 'OPERACIONES Y PATIO'),
    ('D05', 'DESARROLLO ORGANIZACIONAL'),
    ('D06', 'DIRECCION GENERAL')
) AS Source (CodigoNomipaq, Nombre)
ON (Target.CodigoNomipaq = Source.CodigoNomipaq)
WHEN NOT MATCHED THEN
    INSERT (CodigoNomipaq, Nombre, Activo) VALUES (Source.CodigoNomipaq, Source.Nombre, 1);

MERGE dbo.Puestos AS Target
USING (VALUES
    ('P01', 'GERENTE DE SUCURSAL'),
    ('P02', 'GERENTE DE TESORERIA'),
    ('P03', 'COORDINADOR COMERCIAL'),
    ('P04', 'ENCARGADO DE SUCURSAL'),
    ('P05', 'MONTACARGUISTA 6'),
    ('P06', 'JEFE DE PATIO 3'),
    ('P07', 'ASISTENTE ADMVO Y ABASTO'),
    ('P08', 'ESPECIALISTA DE DESARROLLO ORGANIZACIONAL'),
    ('P09', 'DIRECTOR GENERAL')
) AS Source (CodigoNomipaq, Nombre)
ON (Target.CodigoNomipaq = Source.CodigoNomipaq)
WHEN NOT MATCHED THEN
    INSERT (CodigoNomipaq, Nombre, Activo) VALUES (Source.CodigoNomipaq, Source.Nombre, 1);
GO

-- =================================================================================
-- 3. COLABORADORES INICIALES PARA PRUEBA DE ROLES Y JERARQUÍAS
-- =================================================================================
-- 1. Director General (Nivel 1)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'DIR-001')
BEGIN
    INSERT INTO dbo.Colaboradores (
        CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        'DIR-001', 'MANUEL', 'TOLEDO', 'ALVAREZ',
        'TOAM700101HDFR00', 'TOAM700101XXX', 'mtoledo@grupojama.com', '4441002001',
        'CONTROLADORA JAMA, S.C.', 'CONTROLADORA', '1998-01-15',
        'A', 6, 9, NULL, 'LIDER', 1
    );
END

-- 2. Administrador de Desarrollo Organizacional (Admin DO)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'DO-010')
BEGIN
    INSERT INTO dbo.Colaboradores (
        CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        'DO-010', 'TANIA', 'RAMIREZ', 'MEDINA',
        'RAMT880520MDFR00', 'RAMT880520XXX', 'tania.do@grupojama.com', '4441002002',
        'CONTROLADORA JAMA, S.C.', 'CONTROLADORA', '2016-03-01',
        'A', 5, 8, 1, 'ADMIN_DO', 1
    );
END

-- 3. Líder de Sucursal (Gerente con colaboradores a cargo)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'CONS-103')
BEGIN
    INSERT INTO dbo.Colaboradores (
        CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        'CONS-103', 'MARIA DE JESUS', 'ARAIZA', 'VAZQUEZ',
        'AIVM750812MDFR00', 'AIVM750812XXX', 'maraiza@grupojama.com', '4441002003',
        'CONSTRUJAMA DE MEXICO S.A. de C.V.', 'GUADALAJARA', '2003-01-15',
        'A', 1, 1, 1, 'LIDER', 1
    );
END

-- Obtener ID generado de la líder María de Jesús Araiza
DECLARE @IdLiderMary INT;
SELECT @IdLiderMary = IdColaborador FROM dbo.Colaboradores WHERE CodigoEmpleado = 'CONS-103';

-- 4. Colaborador a cargo de Mary Araiza (Mirna Luz Beiza)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'DICO-107')
BEGIN
    INSERT INTO dbo.Colaboradores (
        CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        'DICO-107', 'MIRNA LUZ', 'BEIZA', 'AGUIRRE',
        'BEAM820410MDFR00', 'BEAM820410XXX', 'mbeiza@grupojama.com', '4441002004',
        'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.', 'DICOSA', '2004-07-01',
        'A', 1, 4, @IdLiderMary, 'COLABORADOR', 1
    );
END

-- 5. Colaborador a cargo de Mary Araiza (José Eduardo López)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'CONS-112')
BEGIN
    INSERT INTO dbo.Colaboradores (
        CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        'CONS-112', 'JOSE EDUARDO', 'LOPEZ', 'SALINAS',
        'LOSJ860915HDFR00', 'LOSJ860915XXX', 'jlopez@grupojama.com', '4441002005',
        'CONSTRUJAMA DE MEXICO S.A. de C.V.', 'GUADALAJARA', '2008-10-27',
        'A', 3, 3, @IdLiderMary, 'COLABORADOR', 1
    );
END

-- 6. Colaborador de Logística (Benito Salazar Grimaldo)
IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'CONS-100')
BEGIN
    INSERT INTO dbo.Colaboradores (
        CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
        CURP, RFC, Email, Telefono, Empresa, Sucursal, FechaAlta,
        EstatusNomina, IdDepartamento, IdPuesto, IdJefeDirecto, RolApp, Activo
    )
    VALUES (
        'CONS-100', 'BENITO', 'SALAZAR', 'GRIMALDO',
        'SAGB790214HDFR00', 'SAGB790214XXX', 'bsalazar@grupojama.com', '4441002006',
        'CONSTRUJAMA DE MEXICO S.A. de C.V.', 'SAN LUIS', '2000-06-17',
        'A', 2, 5, @IdLiderMary, 'COLABORADOR', 1
    );
END
GO

-- 4. Ejecución del cálculo de saldos iniciales de los colaboradores dados de alta
EXEC dbo.sp_CalcularSaldosVacaciones;
GO

PRINT 'Datos semilla inicializados satisfactoriamente.';
GO
