const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.resolve(__dirname, '../../DOCS/CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx');
const wb = XLSX.readFile(excelPath);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['ACTIVOS']);
const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/seedData.json'), 'utf8'));
const colabs = seed.colaboradores || [];

function clean(s) {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const uniqueJefes = [...new Set(rows.map(r => (r['JEFE INMEDIATO'] || r['JEFE DIRECTO'] || '').trim()).filter(Boolean))];
console.log('Unique bosses count:', uniqueJefes.length);

const bossMap = new Map();

// Direct nickname overrides
const NICKNAMES = {
  'MARY ARAIZA': 'MARIA DE JESUS ARAIZA VAZQUEZ',
  'MARIA ARAIZA': 'MARIA DE JESUS ARAIZA VAZQUEZ',
  'MIGUEL ALVARADO': 'JOSE PORFIRIO ALVARADO MOLINA',
  'EDILBERTO': 'EDILBERTO GUEL GUEL',
  'PAULIN': 'PAULINO RANGEL RAMIREZ',
  'ARMANDO': 'JORGE ARMANDO MIRELES GARAY',
  'MIRELES GARAY': 'JORGE ARMANDO MIRELES GARAY',
  'JOSE CHAPA': 'JOSE LEON CHAPA HERNANDEZ',
  'ABRAHAM GONALEZ': 'ABRAHAM GONZALEZ LOREDO',
  'OMAR VILCHIS': 'EDGAR OMAR VILCHIS PAREDES'
};

for (const b of uniqueJefes) {
  let targetSearch = NICKNAMES[b] || b;
  const bTokens = clean(targetSearch).split(' ').filter(t => t.length > 2);
  let best = null;
  let bestScore = 0;

  for (const c of colabs) {
    const nomCompleto = [c.nombre, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ');
    const fullTokens = clean(nomCompleto).split(' ');
    let score = 0;
    for (const t of bTokens) {
      if (fullTokens.includes(t)) score++;
    }
    const minTokensNeeded = Math.min(2, bTokens.length);
    if (score > bestScore && score >= minTokensNeeded) {
      bestScore = score;
      best = c;
    }
  }
  bossMap.set(b, best);
}

let foundCount = 0;
const results = {};
uniqueJefes.forEach(b => {
  const m = bossMap.get(b);
  if (m) {
    foundCount++;
    results[b] = {
      id: m.id,
      nombreCompleto: m.nombreCompleto,
      puesto: m.puesto,
      empresa: m.empresa
    };
    console.log(`✅ "${b}" -> ID ${m.id}: ${m.nombreCompleto} (${m.puesto})`);
  } else {
    console.log(`❌ "${b}" -> NOT FOUND`);
  }
});

console.log(`\nFound ${foundCount} of ${uniqueJefes.length} bosses.`);
