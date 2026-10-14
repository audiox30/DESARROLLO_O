-- 13_corregir_genero_curp.sql
-- Corrección oficial RENAPO: Posición 11 de la CURP: 'M' = Mujer, 'H' = Hombre
USE DESARROLLO_O;
GO

UPDATE dbo.Colaboradores
SET Genero = CASE 
    WHEN LEN(RTRIM(LTRIM(CURP))) >= 11 AND UPPER(SUBSTRING(RTRIM(LTRIM(CURP)), 11, 1)) = 'M' THEN 'Mujer'
    WHEN LEN(RTRIM(LTRIM(CURP))) >= 11 AND UPPER(SUBSTRING(RTRIM(LTRIM(CURP)), 11, 1)) = 'H' THEN 'Hombre'
    WHEN UPPER(EstadoCivil) IN ('SOLTERA', 'CASADA', 'VIUDA', 'DIVORCIADA') THEN 'Mujer'
    WHEN UPPER(EstadoCivil) IN ('SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO') THEN 'Hombre'
    WHEN UPPER(Sexo) = 'F' THEN 'Mujer'
    WHEN UPPER(Sexo) IN ('M', 'H') THEN 'Hombre'
    ELSE Genero
END;
GO

SELECT Genero, COUNT(*) AS Total, SUM(CASE WHEN Activo = 1 THEN 1 ELSE 0 END) AS Activos
FROM dbo.Colaboradores
GROUP BY Genero;
GO
