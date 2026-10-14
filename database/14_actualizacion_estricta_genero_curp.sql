-- 14_actualizacion_estricta_genero_curp.sql
-- Regla estricta 100% basada en el carácter de la posición 11 de la CURP (RENAPO)
USE DESARROLLO_O;
GO

UPDATE dbo.Colaboradores
SET Genero = CASE 
    WHEN LEN(RTRIM(LTRIM(CURP))) >= 11 AND UPPER(SUBSTRING(RTRIM(LTRIM(CURP)), 11, 1)) = 'M' THEN 'Mujer'
    WHEN LEN(RTRIM(LTRIM(CURP))) >= 11 AND UPPER(SUBSTRING(RTRIM(LTRIM(CURP)), 11, 1)) = 'H' THEN 'Hombre'
    ELSE NULL
END;
GO

SELECT 
    ISNULL(Genero, 'NULL / No especificado') AS Genero,
    COUNT(*) AS Total,
    SUM(CASE WHEN Activo = 1 THEN 1 ELSE 0 END) AS Activos
FROM dbo.Colaboradores
GROUP BY Genero;
GO
