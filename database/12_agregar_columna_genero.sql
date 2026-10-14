-- 12_agregar_columna_genero.sql
-- Grupo JAMA - DESARROLLO_O
-- Poblar Genero a partir de CURP y Estado Civil / Sexo

USE DESARROLLO_O;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'Genero')
BEGIN
    ALTER TABLE dbo.Colaboradores ADD Genero VARCHAR(10) NULL;
END
GO

UPDATE dbo.Colaboradores
SET Genero = CASE 
    WHEN LEN(RTRIM(LTRIM(CURP))) >= 11 AND UPPER(SUBSTRING(RTRIM(LTRIM(CURP)), 11, 1)) = 'H' THEN 'Hombre'
    WHEN LEN(RTRIM(LTRIM(CURP))) >= 11 AND UPPER(SUBSTRING(RTRIM(LTRIM(CURP)), 11, 1)) = 'M' THEN 'Mujer'
    WHEN UPPER(EstadoCivil) IN ('SOLTERA', 'CASADA', 'VIUDA', 'DIVORCIADA') THEN 'Mujer'
    WHEN UPPER(EstadoCivil) IN ('SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO') THEN 'Hombre'
    WHEN UPPER(Sexo) = 'F' THEN 'Mujer'
    WHEN UPPER(Sexo) = 'H' THEN 'Hombre'
    WHEN UPPER(Sexo) = 'M' AND LEN(CURP) < 11 THEN 'Hombre'
    ELSE 'Hombre'
END
WHERE Genero IS NULL OR Genero = '';
GO

SELECT Genero, COUNT(*) AS Total, SUM(CASE WHEN Activo = 1 THEN 1 ELSE 0 END) AS Activos
FROM dbo.Colaboradores
GROUP BY Genero;
GO
