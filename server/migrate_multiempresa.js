const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const config = {
  user: process.env.LOCAL_DB_USER,
  password: process.env.LOCAL_DB_PASSWORD,
  server: process.env.LOCAL_DB_SERVER,
  port: parseInt(process.env.LOCAL_DB_PORT, 10),
  database: 'DESARROLLO_O',
  options: { encrypt: false, trustServerCertificate: true }
};

async function migrate() {
  console.log('Iniciando migración multi-empresa en DESARROLLO_O...');
  const pool = await new sql.ConnectionPool(config).connect();

  // 1. Departamentos
  const checkDepto = await pool.request().query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Departamentos' AND COLUMN_NAME = 'IdEmpresa'");
  if (checkDepto.recordset[0].c === 0) {
    console.log('Agregando IdEmpresa a Departamentos...');
    await pool.request().query(`
      ALTER TABLE dbo.Departamentos ADD IdEmpresa INT NULL;
    `);
    await pool.request().query(`
      ALTER TABLE dbo.Departamentos ADD CONSTRAINT FK_Departamentos_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq(IdEmpresa);
    `);
  }

  // 2. Puestos
  const checkPuestos = await pool.request().query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Puestos' AND COLUMN_NAME = 'IdEmpresa'");
  if (checkPuestos.recordset[0].c === 0) {
    console.log('Agregando IdEmpresa a Puestos...');
    await pool.request().query(`
      ALTER TABLE dbo.Puestos ADD IdEmpresa INT NULL;
    `);
    await pool.request().query(`
      ALTER TABLE dbo.Puestos ADD CONSTRAINT FK_Puestos_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq(IdEmpresa);
    `);
  }

  // 3. Colaboradores
  const checkColab = await pool.request().query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Colaboradores' AND COLUMN_NAME = 'IdEmpresa'");
  if (checkColab.recordset[0].c === 0) {
    console.log('Agregando IdEmpresa a Colaboradores...');
    await pool.request().query(`
      ALTER TABLE dbo.Colaboradores ADD IdEmpresa INT NULL;
    `);
    await pool.request().query(`
      ALTER TABLE dbo.Colaboradores ADD CONSTRAINT FK_Colaboradores_Empresa FOREIGN KEY (IdEmpresa) REFERENCES dbo.EmpresasNomipaq(IdEmpresa);
    `);
  }

  // 4. Índices / Restricciones compuestas
  // Verificar si existe índice o constraint único previo en CodigoEmpleado
  console.log('Asegurando índices compuestos multi-empresa...');
  await pool.request().query(`
    -- Dropear constraint previa de CodigoEmpleado si existía sin IdEmpresa
    DECLARE @uqName NVARCHAR(200);
    SELECT @uqName = kc.name 
    FROM sys.key_constraints kc
    JOIN sys.tables t ON kc.parent_object_id = t.object_id
    WHERE t.name = 'Colaboradores' AND kc.type = 'UQ' AND kc.name LIKE '%CodigoEmpleado%';
    
    IF @uqName IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE dbo.Colaboradores DROP CONSTRAINT ' + @uqName);
    END;

    -- Dropear índice único previo si existía
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Colaboradores_CodigoEmpleado' AND object_id = OBJECT_ID('dbo.Colaboradores'))
    BEGIN
      DROP INDEX UQ_Colaboradores_CodigoEmpleado ON dbo.Colaboradores;
    END;

    -- Crear índice único compuesto (IdEmpresa, CodigoEmpleado)
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Colaboradores_Empresa_Codigo' AND object_id = OBJECT_ID('dbo.Colaboradores'))
    BEGIN
      CREATE UNIQUE NONCLUSTERED INDEX UQ_Colaboradores_Empresa_Codigo 
      ON dbo.Colaboradores (IdEmpresa, CodigoEmpleado) 
      WHERE IdEmpresa IS NOT NULL;
    END;

    -- Índice para Departamentos (IdEmpresa, CodigoNomipaq)
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Departamentos_Empresa_Codigo' AND object_id = OBJECT_ID('dbo.Departamentos'))
    BEGIN
      CREATE UNIQUE NONCLUSTERED INDEX UQ_Departamentos_Empresa_Codigo 
      ON dbo.Departamentos (IdEmpresa, CodigoNomipaq) 
      WHERE IdEmpresa IS NOT NULL;
    END;

    -- Índice para Puestos (IdEmpresa, CodigoNomipaq)
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Puestos_Empresa_Codigo' AND object_id = OBJECT_ID('dbo.Puestos'))
    BEGIN
      CREATE UNIQUE NONCLUSTERED INDEX UQ_Puestos_Empresa_Codigo 
      ON dbo.Puestos (IdEmpresa, CodigoNomipaq) 
      WHERE IdEmpresa IS NOT NULL;
    END;
  `);

  console.log('✅ Migración multi-empresa completada con éxito.');
  await pool.close();
}

migrate().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
