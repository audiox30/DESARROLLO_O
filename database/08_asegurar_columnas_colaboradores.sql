-- =================================================================================
-- SCRIPT DDL: Asegurar Columnas Requeridas en dbo.Colaboradores
-- Base de Datos: DESARROLLO_O (SQL Server)
-- =================================================================================

USE DESARROLLO_O;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT 'Asegurando columnas requeridas en dbo.Colaboradores...';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'EmailCorporativo')
BEGIN
    ALTER TABLE dbo.Colaboradores ADD EmailCorporativo VARCHAR(150) NULL;
    PRINT '  -> Columna EmailCorporativo agregada exitosamente.';
END
ELSE
BEGIN
    PRINT '  -> Columna EmailCorporativo ya existe.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'IdAprobadorSegundo')
BEGIN
    ALTER TABLE dbo.Colaboradores ADD IdAprobadorSegundo INT NULL;
    PRINT '  -> Columna IdAprobadorSegundo agregada exitosamente.';
END
ELSE
BEGIN
    PRINT '  -> Columna IdAprobadorSegundo ya existe.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'DiasDescanso')
BEGIN
    ALTER TABLE dbo.Colaboradores ADD DiasDescanso VARCHAR(100) NULL;
    PRINT '  -> Columna DiasDescanso agregada exitosamente.';
END
ELSE
BEGIN
    ALTER TABLE dbo.Colaboradores ALTER COLUMN DiasDescanso VARCHAR(100) NULL;
    PRINT '  -> Columna DiasDescanso verificada/ampliada a VARCHAR(100).';
END
GO

PRINT 'Verificación de columnas en dbo.Colaboradores completada.';
GO
