const sql = require('mssql');
require('dotenv').config();

async function updateCols() {
  const p = await sql.connect({
    user: process.env.LOCAL_DB_USER,
    password: process.env.LOCAL_DB_PASSWORD,
    server: process.env.LOCAL_DB_SERVER,
    port: 1433,
    database: 'DESARROLLO_O',
    options: { encrypt: false, trustServerCertificate: true }
  });

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'Telefono')
      ALTER TABLE dbo.Colaboradores ADD Telefono VARCHAR(30) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'Empresa')
      ALTER TABLE dbo.Colaboradores ADD Empresa VARCHAR(150) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'Sucursal')
      ALTER TABLE dbo.Colaboradores ADD Sucursal VARCHAR(100) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Colaboradores') AND name = 'JornadaLaboralDias')
      ALTER TABLE dbo.Colaboradores ADD JornadaLaboralDias INT NOT NULL CONSTRAINT DF_Colaboradores_Jornada DEFAULT (5);
  `);
  console.log('Columns Telefono, Empresa, Sucursal, JornadaLaboralDias verified/added');

  await p.request().query(`
    UPDATE c
    SET c.Empresa = e.AliasEmpresa
    FROM dbo.Colaboradores c
    JOIN dbo.EmpresasNomipaq e ON e.IdEmpresa = c.IdEmpresa
    WHERE c.Empresa IS NULL;
  `);
  console.log('Empresa alias populated in Colaboradores');

  await p.close();
}

updateCols().catch(console.error);
