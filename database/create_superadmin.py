import pyodbc

conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=192.168.20.15,1433;DATABASE=DESARROLLO_O;UID=sa;PWD=Grupojama1;TrustServerCertificate=yes;', autocommit=True)
cur = conn.cursor()

# 1. Actualizar Check Constraint en dbo.UsuariosApp
cur.execute('''
    ALTER TABLE dbo.UsuariosApp DROP CONSTRAINT CK_UsuariosApp_Rol;
    ALTER TABLE dbo.UsuariosApp ADD CONSTRAINT CK_UsuariosApp_Rol CHECK (RolApp IN ('COLABORADOR', 'LIDER', 'ADMIN_DO', 'SUPERADMIN'));
''')
print('[OK] Check constraint actualizado para permitir SUPERADMIN.')

# 2. Departamento y Puesto para Sistemas
cur.execute('''
    IF NOT EXISTS (SELECT 1 FROM dbo.Departamentos WHERE IdEmpresa = 3 AND UPPER(Nombre) = 'SISTEMAS Y TI')
    BEGIN
        INSERT INTO dbo.Departamentos (IdEmpresa, CodigoNomipaq, Nombre, Activo)
        VALUES (3, 'DEP-SIS', 'SISTEMAS Y TI', 1);
    END
    IF NOT EXISTS (SELECT 1 FROM dbo.Puestos WHERE IdEmpresa = 3 AND UPPER(Nombre) = 'ADMINISTRADOR DE SISTEMAS / SUPERADMIN')
    BEGIN
        INSERT INTO dbo.Puestos (IdEmpresa, CodigoNomipaq, Nombre, Activo)
        VALUES (3, 'PUE-SIS', 'ADMINISTRADOR DE SISTEMAS / SUPERADMIN', 1);
    END
''')

# 3. Colaborador para Sistemas
cur.execute('''
    DECLARE @IdDepto INT = (SELECT TOP 1 IdDepartamento FROM dbo.Departamentos WHERE IdEmpresa = 3 AND Nombre = 'SISTEMAS Y TI');
    DECLARE @IdPuesto INT = (SELECT TOP 1 IdPuesto FROM dbo.Puestos WHERE IdEmpresa = 3 AND Nombre = 'ADMINISTRADOR DE SISTEMAS / SUPERADMIN');
    
    IF NOT EXISTS (SELECT 1 FROM dbo.Colaboradores WHERE CodigoEmpleado = 'SIS-001')
    BEGIN
        INSERT INTO dbo.Colaboradores (
            IdEmpresa, CodigoEmpleado, Subfijo, Nombre, ApellidoPaterno, ApellidoMaterno,
            CURP, RFC, Email, Telefono, FechaAlta, EstatusNomina,
            IdDepartamento, IdPuesto, RolApp, Activo, Empresa, Sucursal, FechaCreacion
        )
        VALUES (
            3, 'SIS-001', 'SIS-001', 'ADMINISTRADOR', 'SISTEMAS', 'GRUPO JAMA',
            'SIST000101HJMSIS01', 'SIST000101AB1', 'sistemas@grupojama.com', '444 800 0000',
            '2020-01-01', 'ALTA', @IdDepto, @IdPuesto, 'SUPERADMIN', 1,
            'CONTROLADORA JAMA, S.C.', 'CORPORATIVO', SYSDATETIME()
        );
        PRINT 'Colaborador SIS-001 creado exitosamente.';
    END
    ELSE
    BEGIN
        UPDATE dbo.Colaboradores
        SET RolApp = 'SUPERADMIN', Activo = 1, Email = 'sistemas@grupojama.com'
        WHERE CodigoEmpleado = 'SIS-001';
        PRINT 'Colaborador SIS-001 actualizado.';
    END
''')

cur.execute("SELECT IdColaborador FROM dbo.Colaboradores WHERE CodigoEmpleado = 'SIS-001'")
id_colab_sis = cur.fetchone()[0]

hash_sis = '$2b$10$wR8HnbQHRPFM45402ugOJuPd8kshT7J9s6MS9..hRsK9T8sl7lbPi'

# 4. Usuario 'sistemas'
cur.execute('''
    IF NOT EXISTS (SELECT 1 FROM dbo.UsuariosApp WHERE Username = 'sistemas')
    BEGIN
        INSERT INTO dbo.UsuariosApp (
            IdColaborador, Username, PasswordHash, RolApp, DebeCambiarPassword, Activo
        )
        VALUES (?, 'sistemas', ?, 'SUPERADMIN', 0, 1);
        PRINT 'Usuario sistemas creado.';
    END
    ELSE
    BEGIN
        UPDATE dbo.UsuariosApp
        SET PasswordHash = ?, RolApp = 'SUPERADMIN', DebeCambiarPassword = 0, Activo = 1
        WHERE Username = 'sistemas';
        PRINT 'Usuario sistemas actualizado.';
    END
''', (id_colab_sis, hash_sis, hash_sis))

cur.execute('''
    SELECT u.IdUsuario, u.Username, u.RolApp, c.CodigoEmpleado, c.NombreCompleto, c.Email
    FROM dbo.UsuariosApp u
    JOIN dbo.Colaboradores c ON c.IdColaborador = u.IdColaborador
    WHERE u.Username = 'sistemas'
''')
row = cur.fetchone()
print(f"[OK] Cuenta SuperAdmin configurada: IdUsuario={row[0]}, Username='{row[1]}', Rol='{row[2]}', Colaborador='{row[4]}'")

conn.close()
