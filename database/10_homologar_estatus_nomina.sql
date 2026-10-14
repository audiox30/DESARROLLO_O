-- =========================================================================
-- MIGRACIÓN 10: HOMOLOGACIÓN DE ESTATUS NOMINA (ALTA / BAJA) SEGÚN ACTIVO
-- BASE DE DATOS: DESARROLLO_O (Microsoft SQL Server)
-- =========================================================================

USE [DESARROLLO_O];
GO

PRINT 'Iniciando homologación de EstatusNomina en dbo.Colaboradores...';

-- 1. Actualizar registros activos a 'ALTA'
UPDATE dbo.Colaboradores 
SET EstatusNomina = 'ALTA' 
WHERE Activo = 1;

PRINT 'Registros activos actualizados a EstatusNomina = ''ALTA'': ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- 2. Actualizar registros inactivos a 'BAJA'
UPDATE dbo.Colaboradores 
SET EstatusNomina = 'BAJA' 
WHERE Activo = 0;

PRINT 'Registros inactivos actualizados a EstatusNomina = ''BAJA'': ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- 3. Verificación de distribución de estatus
SELECT 
    Activo,
    EstatusNomina,
    COUNT(*) AS TotalColaboradores
FROM dbo.Colaboradores
GROUP BY Activo, EstatusNomina
ORDER BY Activo DESC, EstatusNomina ASC;
GO
