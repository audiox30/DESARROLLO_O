const fs = require('fs');
const path = require('path');
process.env.USE_MOCK_FALLBACK = 'false';
const { getLocalPool } = require('../src/config/database');

async function run() {
  const file = process.argv[2];
  if (!file) throw new Error('Specify file path');
  const fullPath = path.resolve(file);
  console.log('Ejecutando SQL:', fullPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Separar por GO
  const batches = content
    .split(/^\s*GO\s*$/gmi)
    .map(b => b.trim())
    .filter(b => b.length > 0 && !b.startsWith('USE '));

  const pool = await getLocalPool();
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Ejecutando batch ${i + 1}/${batches.length}...`);
    await pool.request().query(batch);
  }
  console.log('¡Script SQL ejecutado con éxito!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error ejecutando script SQL:', err);
  process.exit(1);
});
