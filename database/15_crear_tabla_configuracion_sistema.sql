-- 15_crear_tabla_configuracion_sistema.sql
-- Tabla y parámetros de configuración global del sistema para rol SISTEMAS
USE DESARROLLO_O;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConfiguracionSistema')
BEGIN
    CREATE TABLE dbo.ConfiguracionSistema (
        Clave VARCHAR(50) NOT NULL PRIMARY KEY,
        Valor VARCHAR(MAX) NULL,
        Descripcion VARCHAR(255) NULL,
        Categoria VARCHAR(50) NULL,
        FechaActualizacion DATETIME2 DEFAULT SYSUTCDATETIME(),
        ActualizadoPor VARCHAR(100) NULL
    );
END
GO

MERGE dbo.ConfiguracionSistema AS Target
USING (VALUES
    -- 1. CONTPAQi Nóminas
    ('CONTPAQI_SERVER', '192.168.20.15', 'Dirección IP o Host del servidor SQL de CONTPAQi Nóminas', 'CONTPAQI'),
    ('CONTPAQI_PORT', '1433', 'Puerto de conexión TCP de SQL Server Nóminas', 'CONTPAQI'),
    ('CONTPAQI_DB_MATRIZ', 'Nomipaq', 'Nombre de la base de datos matriz o catálogo de empresas', 'CONTPAQI'),
    ('CONTPAQI_SYNC_AUTO', 'true', 'Sincronización automática periódica activada', 'CONTPAQI'),
    ('CONTPAQI_SYNC_HORA', '02:00', 'Hora programada para sincronización nocturna (HH:mm)', 'CONTPAQI'),

    -- 2. Correo y Notificaciones (SMTP)
    ('SMTP_HOST', 'smtp.office365.com', 'Servidor de Relay SMTP (IP o FQDN)', 'EMAIL'),
    ('SMTP_PORT', '587', 'Puerto del servicio SMTP (587 TLS / 465 SSL / 25 Relay)', 'EMAIL'),
    ('SMTP_USER', 'notificaciones@grupojama.com.mx', 'Usuario o cuenta de correo remitente autenticado', 'EMAIL'),
    ('SMTP_PASS', '', 'Contraseña de la cuenta de correo (dejar vacío si es Relay anónimo)', 'EMAIL'),
    ('SMTP_SECURE', 'false', 'Conexión SSL/TLS directa (true para puerto 465, false para STARTTLS)', 'EMAIL'),
    ('SMTP_FROM_NAME', 'Control de Vacaciones Grupo JAMA', 'Nombre del remitente institucional en los correos', 'EMAIL'),
    ('SMTP_NOTIF_ENABLED', 'true', 'Envío activo de notificaciones automáticas por correo', 'EMAIL'),

    -- 3. Parámetros de Vacaciones LFT
    ('VAC_DIAS_AVISO_MINIMO', '15', 'Días mínimos de anticipación para solicitar vacaciones', 'VACACIONES'),
    ('VAC_MESES_CADUCIDAD_LFT', '18', 'Meses legales de vigencia tras cumplir el aniversario (LFT)', 'VACACIONES'),
    ('VAC_BLOQUEO_SALDO_NEGATIVO', 'true', 'Bloquear solicitudes que excedan el saldo disponible', 'VACACIONES'),
    ('VAC_PERMITIR_MEDIOS_DIAS', 'false', 'Permitir solicitudes por medios días laborales', 'VACACIONES'),
    ('VAC_HORA_CORTE_SOLICITUD', '17:00', 'Hora límite de registro de solicitudes para el mismo día', 'VACACIONES'),

    -- 4. Auditoría y Mantenimiento
    ('SYS_AUDITORIA_DIAS_RETENCION', '90', 'Días de retención para bitácora de accesos y aprobaciones', 'MANTENIMIENTO'),
    ('SYS_NAS_BACKUP_PATH', '\\192.168.20.20\Backups\Vacaciones', 'Ruta de almacenamiento de respaldos en Synology NAS', 'MANTENIMIENTO'),
    ('SYS_NAS_BACKUP_AUTO', 'true', 'Respaldo automático nocturno programado', 'MANTENIMIENTO'),
    ('SYS_LIMPIEZA_TOKENS_DIAS', '7', 'Días para purgar tokens de sesión expirados', 'MANTENIMIENTO')
) AS Source (Clave, Valor, Descripcion, Categoria)
ON (Target.Clave = Source.Clave)
WHEN NOT MATCHED THEN
    INSERT (Clave, Valor, Descripcion, Categoria, FechaActualizacion, ActualizadoPor)
    VALUES (Source.Clave, Source.Valor, Source.Descripcion, Source.Categoria, SYSUTCDATETIME(), 'SISTEMAS_INIT');
GO

SELECT Categoria, COUNT(*) AS Parametros
FROM dbo.ConfiguracionSistema
GROUP BY Categoria;
GO
