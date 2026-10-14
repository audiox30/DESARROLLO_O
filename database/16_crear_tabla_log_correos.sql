-- 16_crear_tabla_log_correos.sql
-- Tabla de auditoría y trazabilidad histórica de correos enviados por el sistema
USE DESARROLLO_O;
GO

IF OBJECT_ID('dbo.LogCorreosEnviados') IS NULL
BEGIN
    CREATE TABLE dbo.LogCorreosEnviados (
        IdLog INT IDENTITY(1,1) PRIMARY KEY,
        DestinatarioOriginal VARCHAR(150) NOT NULL,
        DestinatarioEfectivo VARCHAR(150) NOT NULL,
        Asunto VARCHAR(255) NOT NULL,
        TipoEvento VARCHAR(50) NOT NULL,
        FolioSolicitud VARCHAR(50) NULL,
        EstatusEnvio VARCHAR(20) NOT NULL, -- 'EXITO' o 'ERROR'
        MensajeError VARCHAR(MAX) NULL,
        MessageId VARCHAR(150) NULL,
        FechaEnvio DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );

    CREATE NONCLUSTERED INDEX IX_LogCorreos_FechaEnvio ON dbo.LogCorreosEnviados (FechaEnvio DESC);
    CREATE NONCLUSTERED INDEX IX_LogCorreos_Folio ON dbo.LogCorreosEnviados (FolioSolicitud) WHERE FolioSolicitud IS NOT NULL;
END;
GO
