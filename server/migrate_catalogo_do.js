const sql = require('mssql');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const config = {
  user: process.env.LOCAL_DB_USER,
  password: process.env.LOCAL_DB_PASSWORD,
  server: process.env.LOCAL_DB_SERVER,
  port: parseInt(process.env.LOCAL_DB_PORT, 10),
  database: 'DESARROLLO_O',
  options: { encrypt: false, trustServerCertificate: true }
};

async function runMigration() {
  console.log('Conectando a SQL Server Local:', config.server, config.database);
  const pool = await new sql.ConnectionPool(config).connect();

  console.log('1. Verificando y agregando columnas a dbo.Colaboradores...');
  
  const columnsToAdd = [
    // Identificadores y SS
    { name: 'Subfijo', type: 'VARCHAR(20) NULL' },
    { name: 'NSS', type: 'VARCHAR(15) NULL' },
    // Demográficos
    { name: 'Sexo', type: 'CHAR(1) NULL' },
    { name: 'FechaNacimiento', type: 'DATE NULL' },
    { name: 'EstadoCivil', type: 'VARCHAR(20) NULL' },
    { name: 'Nacionalidad', type: "VARCHAR(50) CONSTRAINT DF_Colaboradores_Nacionalidad DEFAULT ('MEXICANA')" },
    { name: 'Escolaridad', type: 'VARCHAR(80) NULL' },
    // Domicilio
    { name: 'Domicilio', type: 'VARCHAR(250) NULL' },
    { name: 'Municipio', type: 'VARCHAR(100) NULL' },
    { name: 'EstadoProvincia', type: 'VARCHAR(100) NULL' },
    { name: 'CodigoPostal', type: 'VARCHAR(10) NULL' },
    // Condiciones operativas y vacaciones
    { name: 'DiasDescanso', type: 'VARCHAR(50) NULL' },
    { name: 'CentroCostos', type: 'VARCHAR(50) NULL' },
    { name: 'TipoNomina', type: 'VARCHAR(30) NULL' },
    { name: 'TipoContrato', type: 'VARCHAR(50) NULL' },
    { name: 'PeriodicidadPago', type: 'VARCHAR(30) NULL' },
    { name: 'FechaAltaImss', type: 'DATE NULL' },
    { name: 'FechaEvaluacion', type: 'DATE NULL' },
    { name: 'DomicilioLaboral', type: 'VARCHAR(250) NULL' },
    // Emergencias y salud
    { name: 'AvisarEmergencia', type: 'VARCHAR(120) NULL' },
    { name: 'ParentescoEmergencia', type: 'VARCHAR(50) NULL' },
    { name: 'TelefonoEmergencia', type: 'VARCHAR(30) NULL' },
    { name: 'TipoSangre', type: 'VARCHAR(10) NULL' },
    { name: 'AlergiasPadecimientos', type: 'VARCHAR(200) NULL' },
    // Beneficiarios y créditos
    { name: 'Beneficiario', type: 'VARCHAR(150) NULL' },
    { name: 'ParentescoBeneficiario', type: 'VARCHAR(50) NULL' },
    { name: 'RfcBeneficiario', type: 'VARCHAR(13) NULL' },
    { name: 'TieneInfonavit', type: 'VARCHAR(10) NULL' },
    { name: 'TieneFonacot', type: 'VARCHAR(10) NULL' },
    { name: 'FuenteReclutamiento', type: 'VARCHAR(100) NULL' }
  ];

  for (const col of columnsToAdd) {
    const check = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Colaboradores' AND COLUMN_NAME = '${col.name}'
    `);
    if (check.recordset.length === 0) {
      console.log(`  -> Agregando columna: ${col.name}...`);
      await pool.request().query(`ALTER TABLE dbo.Colaboradores ADD ${col.name} ${col.type};`);
    } else {
      console.log(`  [OK] Columna ya presente: ${col.name}`);
    }
  }

  console.log('\n2. Creando tabla dbo.ColaboradorHijos...');
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.ColaboradorHijos', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ColaboradorHijos (
            IdHijo              INT IDENTITY(1,1) NOT NULL,
            IdColaborador       INT NOT NULL,
            NumeroHijo          INT NOT NULL,
            FechaNacimiento     DATE NULL,
            Sexo                CHAR(1) NULL,
            FechaRegistro       DATETIME2(0) NOT NULL CONSTRAINT DF_ColaboradorHijos_FechaRegistro DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT PK_ColaboradorHijos PRIMARY KEY CLUSTERED (IdHijo),
            CONSTRAINT FK_ColaboradorHijos_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE,
            CONSTRAINT UQ_Colaborador_Hijo UNIQUE NONCLUSTERED (IdColaborador, NumeroHijo)
        );
        CREATE NONCLUSTERED INDEX IX_ColaboradorHijos_Colaborador ON dbo.ColaboradorHijos (IdColaborador);
        PRINT 'Tabla dbo.ColaboradorHijos creada.';
    END
  `);

  console.log('3. Creando tabla dbo.ColaboradorBajas...');
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.ColaboradorBajas', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ColaboradorBajas (
            IdBaja                      INT IDENTITY(1,1) NOT NULL,
            IdColaborador               INT NOT NULL,
            FechaBaja                   DATE NOT NULL,
            TipoBaja                    VARCHAR(100) NULL,
            Comentarios                 VARCHAR(500) NULL,
            RenunciaVoluntaria          VARCHAR(50) NULL,
            ConvenioFiniquito           VARCHAR(50) NULL,
            ConvenioConfidencialidad    VARCHAR(50) NULL,
            FechaRegistro               DATETIME2(0) NOT NULL CONSTRAINT DF_ColaboradorBajas_FechaRegistro DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT PK_ColaboradorBajas PRIMARY KEY CLUSTERED (IdBaja),
            CONSTRAINT FK_ColaboradorBajas_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE
        );
        CREATE NONCLUSTERED INDEX IX_ColaboradorBajas_Colaborador ON dbo.ColaboradorBajas (IdColaborador);
        PRINT 'Tabla dbo.ColaboradorBajas creada.';
    END
  `);

  console.log('4. Creando tabla dbo.ColaboradorDatosFinancieros...');
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.ColaboradorDatosFinancieros', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ColaboradorDatosFinancieros (
            IdColaborador           INT NOT NULL,
            SalarioMensualNeto      DECIMAL(18,4) NULL,
            SalarioDiarioReal       DECIMAL(18,4) NULL,
            SalarioDiarioImss       DECIMAL(18,4) NULL,
            SalarioDiarioIntegrado  DECIMAL(18,4) NULL,
            InstitucionBancaria     VARCHAR(100) NULL,
            NumeroCuenta            VARCHAR(30) NULL,
            ClabeInterbancaria      VARCHAR(18) NULL,
            FechaUltimaModificacion DATETIME2(0) NOT NULL CONSTRAINT DF_ColabFinanciero_FechaMod DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT PK_ColaboradorDatosFinancieros PRIMARY KEY CLUSTERED (IdColaborador),
            CONSTRAINT FK_ColaboradorDatosFinancieros_Colaborador FOREIGN KEY (IdColaborador) REFERENCES dbo.Colaboradores (IdColaborador) ON DELETE CASCADE
        );
        PRINT 'Tabla dbo.ColaboradorDatosFinancieros creada.';
    END
  `);

  // Verificación final
  const resCol = await pool.request().query("SELECT COUNT(*) AS totalCols FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Colaboradores'");
  const resTables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('ColaboradorHijos', 'ColaboradorBajas', 'ColaboradorDatosFinancieros')");

  console.log('\n=============================================================================');
  console.log('VERIFICACIÓN DEL MODELO DE DATOS EN DESARROLLO_O:');
  console.log(`- Columnas totales en dbo.Colaboradores: ${resCol.recordset[0].totalCols}`);
  console.log('- Tablas auxiliares confirmadas:');
  console.table(resTables.recordset);
  console.log('=============================================================================');

  await pool.close();
}

runMigration().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
