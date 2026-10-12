"""
=================================================================================
MIGRACIÓN Y SETUP: MÓDULO DE AUTENTICACIÓN, USUARIOS APP Y RBAC
Base de Datos: DESARROLLO_O (Microsoft SQL Server)
=================================================================================
"""
import pyodbc
import os
import sys

# Configuración segura de salida
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_SERVER = os.getenv('LOCAL_DB_SERVER', '192.168.20.15,1433')
DB_NAME = os.getenv('LOCAL_DB_NAME', 'DESARROLLO_O')
DB_USER = os.getenv('LOCAL_DB_USER', 'sa')
DB_PASS = os.getenv('LOCAL_DB_PASSWORD', 'Grupojama1')

CONN_STR = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={DB_SERVER};"
    f"DATABASE={DB_NAME};"
    f"UID={DB_USER};"
    f"PWD={DB_PASS};"
    f"TrustServerCertificate=yes;"
)

def run():
    print("=" * 77)
    print("CONFIGURACION DE TABLA dbo.UsuariosApp, RBAC Y PROCEDIMIENTOS DE SEGURIDAD")
    print("=" * 77)

    conn = pyodbc.connect(CONN_STR, autocommit=True)
    cursor = conn.cursor()

    # 1. Crear tabla dbo.UsuariosApp
    print("\n1. Verificando/creando tabla dbo.UsuariosApp...")
    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UsuariosApp' AND schema_id = SCHEMA_ID('dbo'))
        BEGIN
            CREATE TABLE dbo.UsuariosApp (
                IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
                IdColaborador INT NOT NULL CONSTRAINT FK_UsuariosApp_Colaboradores FOREIGN KEY REFERENCES dbo.Colaboradores(IdColaborador),
                Username VARCHAR(100) NOT NULL CONSTRAINT UQ_UsuariosApp_Username UNIQUE,
                PasswordHash VARCHAR(255) NOT NULL,
                RolApp VARCHAR(30) NOT NULL CONSTRAINT CK_UsuariosApp_Rol CHECK (RolApp IN ('COLABORADOR', 'LIDER', 'ADMIN_DO')),
                DebeCambiarPassword BIT NOT NULL CONSTRAINT DF_UsuariosApp_DebeCambiar DEFAULT 1,
                Activo BIT NOT NULL CONSTRAINT DF_UsuariosApp_Activo DEFAULT 1,
                FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_UsuariosApp_FechaCreacion DEFAULT SYSUTCDATETIME(),
                UltimoAcceso DATETIME2 NULL,
                FechaModificacionPassword DATETIME2 NULL,
                CONSTRAINT UQ_UsuariosApp_Colaborador UNIQUE (IdColaborador)
            );
            CREATE INDEX IX_UsuariosApp_Username ON dbo.UsuariosApp(Username);
            CREATE INDEX IX_UsuariosApp_Colaborador ON dbo.UsuariosApp(IdColaborador);
            PRINT '[OK] Tabla dbo.UsuariosApp creada exitosamente.';
        END
        ELSE
        BEGIN
            PRINT '[INFO] Tabla dbo.UsuariosApp ya existe.';
        END
    """)

    # 2. Agregar columnas adicionales a SolicitudesVacaciones e HistorialAprobaciones si faltan
    print("\n2. Asegurando columnas operativas en tablas de solicitudes...")
    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SolicitudesVacaciones') AND name = 'IdAprobadorFinal')
            ALTER TABLE dbo.SolicitudesVacaciones ADD IdAprobadorFinal INT NULL;

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SolicitudesVacaciones') AND name = 'MotivoRechazo')
            ALTER TABLE dbo.SolicitudesVacaciones ADD MotivoRechazo VARCHAR(500) NULL;

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.HistorialAprobaciones') AND name = 'MetodoAutorizacion')
            ALTER TABLE dbo.HistorialAprobaciones ADD MetodoAutorizacion VARCHAR(20) DEFAULT 'WEB';

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.HistorialAprobaciones') AND name = 'DireccionIP')
            ALTER TABLE dbo.HistorialAprobaciones ADD DireccionIP VARCHAR(45) NULL;

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaldosVacaciones') AND name = 'FechaUltimoCalculo')
            ALTER TABLE dbo.SaldosVacaciones ADD FechaUltimoCalculo DATETIME2 NULL;
    """)
    print("[OK] Columnas operativas validadas.")

    # 3. Crear/Actualizar Procedimientos Almacenados de Solicitudes y Aprobación
    print("\n3. Creando Stored Procedures de Registro y Resolución de Solicitudes...")

    # 3.1 sp_RegistrarSolicitudVacaciones
    cursor.execute("""
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarSolicitudVacaciones
    @IdColaborador      INT,
    @FechaInicio        DATE,
    @FechaFin           DATE,
    @MotivoComentarios  VARCHAR(500) = NULL,
    @IdSolicitudCreada  INT OUTPUT,
    @FolioGenerado      VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Activo BIT, @Jornada INT, @IdJefe INT;
        SELECT @Activo = Activo, @Jornada = ISNULL(JornadaLaboralDias, 5), @IdJefe = IdJefeDirecto
        FROM dbo.Colaboradores
        WHERE IdColaborador = @IdColaborador;

        IF @Activo IS NULL OR @Activo = 0
            THROW 50001, 'El colaborador especificado no está activo en el sistema.', 1;

        DECLARE @DiasLaborables DECIMAL(4,1);
        SET @DiasLaborables = dbo.fn_CalcularDiasHabiles(@FechaInicio, @FechaFin, @Jornada);

        IF @DiasLaborables <= 0
            THROW 50002, 'El rango seleccionado no contiene ningún día hábil laborable.', 1;

        DECLARE @SaldoDisponible DECIMAL(5,1) = 0.0;
        SELECT @SaldoDisponible = ISNULL(SUM(DiasPendientes), 0.0)
        FROM dbo.SaldosVacaciones
        WHERE IdColaborador = @IdColaborador AND EsCerrado = 0;

        DECLARE @DiasEnTramite DECIMAL(5,1) = 0.0;
        SELECT @DiasEnTramite = ISNULL(SUM(TotalDiasLaborables), 0.0)
        FROM dbo.SolicitudesVacaciones
        WHERE IdColaborador = @IdColaborador AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO');

        IF (@SaldoDisponible - @DiasEnTramite) < @DiasLaborables
        BEGIN
            DECLARE @MsgErr NVARCHAR(200) = CONCAT('Saldo insuficiente. Disponibles: ', (@SaldoDisponible - @DiasEnTramite), ' días. Solicitados: ', @DiasLaborables, ' días.');
            THROW 50003, @MsgErr, 1;
        END

        IF EXISTS (
            SELECT 1 
            FROM dbo.SolicitudesVacaciones
            WHERE IdColaborador = @IdColaborador
              AND Estado IN ('PENDIENTE_LIDER', 'PENDIENTE_DO', 'APROBADA')
              AND @FechaInicio <= FechaFin 
              AND @FechaFin >= FechaInicio
        )
        BEGIN
            THROW 50004, 'Ya existe una solicitud en trámite o aprobada en este rango de fechas.', 1;
        END

        DECLARE @AnioActual INT = YEAR(SYSDATETIME());
        DECLARE @Consecutivo INT;
        SELECT @Consecutivo = COUNT(*) + 1 
        FROM dbo.SolicitudesVacaciones 
        WHERE YEAR(FechaCreacion) = @AnioActual;

        SET @FolioGenerado = CONCAT('VAC-', @AnioActual, '-', RIGHT('00000' + CAST(@Consecutivo AS VARCHAR(5)), 5));

        INSERT INTO dbo.SolicitudesVacaciones (
            Folio, IdColaborador, FechaCreacion, FechaInicio, 
            FechaFin, TotalDiasLaborables, MotivoComentarios, Estado
        )
        VALUES (
            @FolioGenerado, @IdColaborador, SYSDATETIME(), @FechaInicio, 
            @FechaFin, @DiasLaborables, @MotivoComentarios, 'PENDIENTE_LIDER'
        );

        SET @IdSolicitudCreada = SCOPE_IDENTITY();

        INSERT INTO dbo.HistorialAprobaciones (
            IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion
        )
        VALUES (
            @IdSolicitudCreada, @IdColaborador, 'COLABORADOR', 'ENVIADA', 'Solicitud registrada e ingresada al flujo de autorización', 'WEB'
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
    """)
    print("[OK] Stored Procedure dbo.sp_RegistrarSolicitudVacaciones compilado.")

    # 3.2 sp_ProcesarAprobacionSolicitud
    cursor.execute("""
CREATE OR ALTER PROCEDURE dbo.sp_ProcesarAprobacionSolicitud
    @IdSolicitud            INT,
    @IdAprobador            INT,
    @Accion                 VARCHAR(20),      -- 'APROBADA', 'RECHAZADA'
    @Comentarios            VARCHAR(500) = NULL,
    @MetodoAutorizacion     VARCHAR(20) = 'WEB',
    @DireccionIP            VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EstadoActual VARCHAR(25), @IdColaborador INT, @Dias DECIMAL(4,1);
        SELECT 
            @EstadoActual = Estado, 
            @IdColaborador = IdColaborador, 
            @Dias = TotalDiasLaborables
        FROM dbo.SolicitudesVacaciones WITH (UPDLOCK, ROWLOCK)
        WHERE IdSolicitud = @IdSolicitud;

        IF @EstadoActual IS NULL
            THROW 50010, 'La solicitud no existe.', 1;

        IF @EstadoActual NOT IN ('PENDIENTE_LIDER', 'PENDIENTE_DO')
            THROW 50011, 'La solicitud no se encuentra en un estado pendiente de resolución.', 1;

        DECLARE @RolAprobador VARCHAR(20);
        SELECT @RolAprobador = RolApp FROM dbo.Colaboradores WHERE IdColaborador = @IdAprobador;

        IF @Accion = 'RECHAZADA' AND (LTRIM(RTRIM(ISNULL(@Comentarios, ''))) = '')
            THROW 50012, 'El motivo de rechazo es obligatorio para registrar la resolución.', 1;

        IF @Accion = 'RECHAZADA'
        BEGIN
            UPDATE dbo.SolicitudesVacaciones
            SET 
                Estado = 'RECHAZADA',
                FechaResolucion = SYSDATETIME(),
                IdAprobadorFinal = @IdAprobador,
                MotivoRechazo = @Comentarios
            WHERE IdSolicitud = @IdSolicitud;

            INSERT INTO dbo.HistorialAprobaciones (
                IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
            )
            VALUES (
                @IdSolicitud, @IdAprobador, 
                CASE WHEN @RolAprobador = 'ADMIN_DO' THEN 'DESARROLLO_ORGANIZACIONAL' ELSE 'LIDER_DIRECTO' END,
                'RECHAZADA', @Comentarios, @MetodoAutorizacion, @DireccionIP
            );
        END
        ELSE IF @Accion = 'APROBADA'
        BEGIN
            IF @EstadoActual = 'PENDIENTE_LIDER' AND @RolAprobador <> 'ADMIN_DO'
            BEGIN
                UPDATE dbo.SolicitudesVacaciones
                SET Estado = 'PENDIENTE_DO'
                WHERE IdSolicitud = @IdSolicitud;

                INSERT INTO dbo.HistorialAprobaciones (
                    IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                )
                VALUES (
                    @IdSolicitud, @IdAprobador, 'LIDER_DIRECTO', 'APROBADA', 
                    ISNULL(@Comentarios, 'Aprobada por Líder Directo. Enviada a VoBo de Desarrollo Organizacional.'), 
                    @MetodoAutorizacion, @DireccionIP
                );
            END
            ELSE
            BEGIN
                UPDATE dbo.SolicitudesVacaciones
                SET 
                    Estado = 'APROBADA',
                    FechaResolucion = SYSDATETIME(),
                    IdAprobadorFinal = @IdAprobador
                WHERE IdSolicitud = @IdSolicitud;

                -- Descontar del saldo más antiguo con días disponibles (FIFO)
                DECLARE @DiasPorDescontar DECIMAL(5,1) = @Dias;
                DECLARE @IdSaldoCurrent INT, @PendienteCurrent DECIMAL(5,1);

                DECLARE curSaldos CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdSaldo, DiasPendientes
                FROM dbo.SaldosVacaciones
                WHERE IdColaborador = @IdColaborador AND EsCerrado = 0 AND DiasPendientes > 0
                ORDER BY AnioPeriodo ASC;

                OPEN curSaldos;
                FETCH NEXT FROM curSaldos INTO @IdSaldoCurrent, @PendienteCurrent;

                WHILE @@FETCH_STATUS = 0 AND @DiasPorDescontar > 0
                BEGIN
                    IF @PendienteCurrent >= @DiasPorDescontar
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasGozados + @DiasPorDescontar,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent;

                        SET @DiasPorDescontar = 0;
                    END
                    ELSE
                    BEGIN
                        UPDATE dbo.SaldosVacaciones
                        SET DiasGozados = DiasCorrespondientes,
                            EsCerrado = 1,
                            FechaUltimoCalculo = SYSDATETIME()
                        WHERE IdSaldo = @IdSaldoCurrent;

                        SET @DiasPorDescontar = @DiasPorDescontar - @PendienteCurrent;
                    END

                    FETCH NEXT FROM curSaldos INTO @IdSaldoCurrent, @PendienteCurrent;
                END

                CLOSE curSaldos;
                DEALLOCATE curSaldos;

                INSERT INTO dbo.HistorialAprobaciones (
                    IdSolicitud, IdAprobador, NivelAprobacion, Accion, Comentarios, MetodoAutorizacion, DireccionIP
                )
                VALUES (
                    @IdSolicitud, @IdAprobador, 'DESARROLLO_ORGANIZACIONAL', 'APROBADA', 
                    ISNULL(@Comentarios, 'Aprobación final aplicada e impactada en saldos de nómina.'), 
                    @MetodoAutorizacion, @DireccionIP
                );
            END
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
    """)
    print("[OK] Stored Procedure dbo.sp_ProcesarAprobacionSolicitud compilado.")

    # 4. Poblar / Aprovisionar dbo.UsuariosApp para colaboradores activos
    print("\n4. Aprovisionando usuarios en dbo.UsuariosApp...")
    # Hash bcrypt estándar para la clave temporal 'Grupojama2026!'
    # Generado con bcrypt salt=10: $2b$10$9/sf8EtxSQMgh.YDTolOBeklXecfig8wHdQrR2lK/elHD7i6XFZGe
    DEFAULT_BCRYPT_HASH = '$2b$10$9/sf8EtxSQMgh.YDTolOBeklXecfig8wHdQrR2lK/elHD7i6XFZGe'

    cursor.execute("""
        SELECT c.IdColaborador, c.IdEmpresa, c.CodigoEmpleado, c.Subfijo,
               c.NombreCompleto, c.Email, c.RolApp
        FROM dbo.Colaboradores c
        WHERE c.Activo = 1
        ORDER BY c.IdColaborador
    """)
    colabs = cursor.fetchall()
    print(f"Colaboradores activos a aprovisionar: {len(colabs)}")

    # Obtener usernames existentes
    cursor.execute("SELECT Username, IdColaborador FROM dbo.UsuariosApp")
    existing_users = {r[0]: r[1] for r in cursor.fetchall()}
    existing_colab_ids = set(existing_users.values())

    inserted_count = 0
    updated_count = 0

    for id_colab, id_emp, cod, sub, nombre, email, rol in colabs:
        if id_colab in existing_colab_ids:
            continue

        # Generar Username único
        cod_clean = cod.strip()
        candidate_username = cod_clean
        if candidate_username in existing_users:
            candidate_username = f"EMP{id_emp}_{cod_clean}"
        if candidate_username in existing_users:
            candidate_username = f"USER_{id_colab}"

        rol_user = rol if rol in ('COLABORADOR', 'LIDER', 'ADMIN_DO') else 'COLABORADOR'

        cursor.execute("""
            INSERT INTO dbo.UsuariosApp (
                IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo
            )
            VALUES (?, ?, ?, ?, 1, 1)
        """, (id_colab, candidate_username, DEFAULT_BCRYPT_HASH, rol_user))
        
        existing_users[candidate_username] = id_colab
        existing_colab_ids.add(id_colab)
        inserted_count += 1

    print(f"[OK] Cuentas aprovisionadas en dbo.UsuariosApp: {inserted_count} nuevas.")

    # Asegurar cuentas demo con usernames amigables
    demo_mappings = [
        (29, 'admin.do', 'ADMIN_DO'),        # Tania del Carmen Hurtado Avalos (Admin DO)
        (850, 'lider.ulises', 'LIDER'),      # Ulises Antonio Garces Rodriguez (Líder Directo)
        (1039, 'colab.gonzalo', 'COLABORADOR'), # Gonzalo Ramirez Gallardo (Colaborador)
        (25, 'colab.rocio', 'COLABORADOR')   # Rocio Imelda Gonzalez Salas (Colaborador)
    ]

    for id_c, uname, target_rol in demo_mappings:
        # Asegurar rol en Colaboradores
        cursor.execute("UPDATE dbo.Colaboradores SET RolApp = ? WHERE IdColaborador = ?", (target_rol, id_c))
        
        # Verificar si ya existe usuario para ese id_c
        cursor.execute("SELECT IdUsuario, Username FROM dbo.UsuariosApp WHERE IdColaborador = ?", (id_c,))
        row = cursor.fetchone()
        if row:
            # Actualizar username y rol
            cursor.execute("""
                UPDATE dbo.UsuariosApp 
                SET Username = ?, RolApp = ?, PasswordHash = ?, DebeCambiarPassword = 1, Activo = 1 
                WHERE IdUsuario = ?
            """, (uname, target_rol, DEFAULT_BCRYPT_HASH, row[0]))
        else:
            cursor.execute("""
                INSERT INTO dbo.UsuariosApp (IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo)
                VALUES (?, ?, ?, ?, 1, 1)
            """, (id_c, uname, DEFAULT_BCRYPT_HASH, target_rol))
        print(f"  * Usuario demo configurado: '{uname}' -> Colaborador {id_c} ({target_rol})")

    # 5. Auditoría final
    cursor.execute("""
        SELECT 
            (SELECT COUNT(*) FROM dbo.UsuariosApp) AS TotalUsuarios,
            (SELECT COUNT(*) FROM dbo.UsuariosApp WHERE RolApp = 'COLABORADOR') AS Colaboradores,
            (SELECT COUNT(*) FROM dbo.UsuariosApp WHERE RolApp = 'LIDER') AS Lideres,
            (SELECT COUNT(*) FROM dbo.UsuariosApp WHERE RolApp = 'ADMIN_DO') AS Admins,
            (SELECT COUNT(*) FROM dbo.UsuariosApp WHERE DebeCambiarPassword = 1) AS PendientesCambioPassword;
    """)
    aud = cursor.fetchone()
    print("\nAuditoría dbo.UsuariosApp:")
    print(f"  • Total Usuarios Activos:         {aud[0]}")
    print(f"  • Rol COLABORADOR:                {aud[1]}")
    print(f"  • Rol LIDER:                      {aud[2]}")
    print(f"  • Rol ADMIN_DO:                   {aud[3]}")
    print(f"  • Con DebeCambiarPassword = 1:    {aud[4]}")
    print(f"  • Clave por defecto para todos:   'Grupojama2026!'")

    conn.close()
    print("\n" + "=" * 77)
    print("MIGRACION DE AUTENTICACION Y RBAC COMPLETADA CON EXITO")
    print("=" * 77)

if __name__ == '__main__':
    run()
