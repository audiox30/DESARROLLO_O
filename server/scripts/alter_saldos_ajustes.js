const { getLocalPool } = require('../src/config/database');

async function run() {
  try {
    const pool = await getLocalPool();
    console.log('[DB] Conectado para asegurar columnas de ajuste en dbo.SaldosVacaciones...');
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaldosVacaciones') AND name = 'MotivoAjuste')
      BEGIN
        ALTER TABLE dbo.SaldosVacaciones ADD MotivoAjuste VARCHAR(255) NULL;
        PRINT 'Columna MotivoAjuste agregada.';
      END

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaldosVacaciones') AND name = 'FechaAjuste')
      BEGIN
        ALTER TABLE dbo.SaldosVacaciones ADD FechaAjuste DATETIME2 NULL;
        PRINT 'Columna FechaAjuste agregada.';
      END

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaldosVacaciones') AND name = 'IdUsuarioAjusto')
      BEGIN
        ALTER TABLE dbo.SaldosVacaciones ADD IdUsuarioAjusto INT NULL;
        PRINT 'Columna IdUsuarioAjusto agregada.';
      END
    `);

    console.log('[OK] Columnas aseguradas exitosamente.');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR]', err);
    process.exit(1);
  }
}

run();
