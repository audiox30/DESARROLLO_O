const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.resolve(__dirname, '../../DOCS/CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx');
const wb = XLSX.readFile(excelPath);
const rowsActivos = XLSX.utils.sheet_to_json(wb.Sheets['ACTIVOS']);
const rowsBajas = XLSX.utils.sheet_to_json(wb.Sheets['BAJAS']);

const seedPath = path.resolve(__dirname, '../src/data/seedData.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const colabs = seed.colaboradores || [];

function excelDateToISO(serial) {
  if (!serial || isNaN(serial) || serial <= 1000) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function clean(s) {
  return (s || '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Map bosses to IDs
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
  'OMAR VILCHIS': 'EDGAR OMAR VILCHIS PAREDES',
  'OSCAR VILCHIS': 'OMAR VILCHIS JIMENEZ',
  'TERESA RODRIGUEZ': 'TERESA ABIGAIL ESCAMILLA ESTRADA',
  'CARLOS RICO': 'CARLOS CERON SANTANDER',
  'MAURO SOLIS': 'JOSE MAURO RODRIGUEZ GUERRA',
  'JOSE ANGEL GARCIA': 'JOSE ANGEL OCHOA GARCIA'
};

const uniqueJefes = [...new Set(rowsActivos.map(r => (r['JEFE INMEDIATO'] || r['JEFE DIRECTO'] || '').trim()).filter(Boolean))];
const bossMap = new Map();

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

// SQL Statements collection
const sqlStatements = [];
sqlStatements.push(`-- =========================================================================`);
sqlStatements.push(`-- SCRIPT: Actualización de Sucursal y Jefes Directos desde Catálogo Excel`);
sqlStatements.push(`-- Fuente: DOCS/CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx`);
sqlStatements.push(`-- =========================================================================`);
sqlStatements.push(`USE DESARROLLO_O;`);
sqlStatements.push(`GO\n`);
sqlStatements.push(`BEGIN TRANSACTION;\n`);

let updatedCount = 0;

colabs.forEach(c => {
  // Find in Excel
  const sub = (c.codigoEmpleado || '').trim();
  let row = rowsActivos.find(r => (r['SUB FIJO'] || '').trim() === sub);
  if (!row) {
    const cNom = String(c.codigoEmpleado || '').replace(/^[A-Z]+-/, '').trim();
    row = rowsActivos.find(r => String(r['NUM DE NOMINA'] || '').trim() === cNom);
  }

  if (row) {
    updatedCount++;
    const rawSucursal = (row['SUCURSAL'] || '').trim() || 'SAN LUIS';
    const rawJefe = (row['JEFE INMEDIATO'] || row['JEFE DIRECTO'] || '').trim();
    const matchedBoss = rawJefe ? bossMap.get(rawJefe) : null;

    let jefeId = matchedBoss ? matchedBoss.id : null;
    let jefeNombre = matchedBoss 
      ? (matchedBoss.nombreCompleto || `${matchedBoss.apellidoPaterno}, ${matchedBoss.nombre}`) 
      : (rawJefe || null);

    // Format jefeNombre if matched boss has separate fields
    if (matchedBoss && matchedBoss.apellidoPaterno && matchedBoss.nombre) {
      const ap = [matchedBoss.apellidoPaterno, matchedBoss.apellidoMaterno].filter(Boolean).join(' ');
      jefeNombre = `${ap}, ${matchedBoss.nombre}`.trim();
    }

    const getStr = (val) => {
      if (val === undefined || val === null) return '';
      const s = String(val).trim();
      return (s === '0' || s === '0.0') ? '' : s;
    };

    const cleanField = (val, forbidden = ['0', 'N', 'NA']) => {
      const s = getStr(val);
      return forbidden.includes(s.toUpperCase()) ? null : s || null;
    };

    const nss = getStr(row['NSS']) || c.nss || null;
    const curp = getStr(row['CURP']) || c.curp || null;
    const rfc = getStr(row['RFC']) || c.rfc || null;
    const fechaNac = excelDateToISO(row['FECHA DE NACIMIENTO']) || c.fechaNacimiento || null;
    const estadoCivil = cleanField(row['ESTADO CIVIL']) || c.estadoCivil || null;
    const nacionalidad = cleanField(row['NACIONALIDAD']) || c.nacionalidad || 'MEXICANA';
    const escolaridad = cleanField(row['ESCOLARIDAD']) || c.escolaridad || null;
    const domicilio = cleanField(row['DOMICILIO']) || c.domicilio || null;
    const diasDescanso = cleanField(row['DIAS QUE DESCANSA']) || c.diasDescanso || 'DOMINGOS';
    const avisarEmergencia = cleanField(row['AVISAR EN CASO DE EMERGENCIA']) || c.avisarEmergencia || null;
    const parentescoEmergencia = cleanField(row['PARENTESCO']) || c.parentescoEmergencia || null;
    const telefonoEmergencia = cleanField(row['TELEFONO DE EMERGENCIA']) || c.telefonoEmergencia || null;
    const tipoSangre = cleanField(row['TIPO DE SANGRE'], ['0', 'N', 'NA', 'NO', 'X']) || c.tipoSangre || null;
    const alergias = cleanField(row['ALERGIAS/PADECIMIENTOS'], ['0', 'N', 'NA', 'NO']) || c.alergiasPadecimientos || null;
    const telefono = cleanField(row['CELULAR']) || c.telefono || null;

    // Update object in seed
    c.sucursal = rawSucursal;
    c.Sucursal = rawSucursal;
    c.jefeInmediato = rawJefe || '';
    c.idJefeDirecto = jefeId;
    c.IdJefeDirecto = jefeId;
    c.NombreJefeDirecto = jefeNombre;
    c.JefeDirectoNombre = jefeNombre;
    c.nss = nss;
    c.NSS = nss;
    c.curp = curp;
    c.CURP = curp;
    c.rfc = rfc;
    c.RFC = rfc;
    c.fechaNacimiento = fechaNac;
    c.FechaNacimiento = fechaNac;
    c.estadoCivil = estadoCivil;
    c.EstadoCivil = estadoCivil;
    c.nacionalidad = nacionalidad;
    c.Nacionalidad = nacionalidad;
    c.escolaridad = escolaridad;
    c.Escolaridad = escolaridad;
    c.domicilio = domicilio;
    c.Domicilio = domicilio;
    c.diasDescanso = diasDescanso;
    c.DiasDescanso = diasDescanso;
    c.avisarEmergencia = avisarEmergencia;
    c.AvisarEmergencia = avisarEmergencia;
    c.ContactoEmergenciaNombre = avisarEmergencia;
    c.parentescoEmergencia = parentescoEmergencia;
    c.ParentescoEmergencia = parentescoEmergencia;
    c.ContactoEmergenciaParentesco = parentescoEmergencia;
    c.telefonoEmergencia = telefonoEmergencia;
    c.TelefonoEmergencia = telefonoEmergencia;
    c.ContactoEmergenciaTelefono = telefonoEmergencia;
    c.tipoSangre = tipoSangre;
    c.TipoSangre = tipoSangre;
    c.alergiasPadecimientos = alergias;
    c.AlergiasPadecimientos = alergias;
    c.PadecimientosMedicos = alergias;
    if (telefono) {
      c.telefono = telefono;
      c.Telefono = telefono;
    }

    // Build SQL Update statement
    const sqlEsc = (val) => {
      if (val === null || val === undefined) return 'NULL';
      const s = String(val).trim();
      if (s === '0' || s === '0.0' || s === 'N' || s === 'NA' || s === 'NO') return 'NULL';
      return `'${s.replace(/'/g, "''")}'`;
    };
    const sqlInt = (val) => val === null || val === undefined ? 'NULL' : Number(val);

    sqlStatements.push(`UPDATE dbo.Colaboradores SET 
      Sucursal = ${sqlEsc(rawSucursal)},
      IdJefeDirecto = ${sqlInt(jefeId)},
      NSS = COALESCE(NSS, ${sqlEsc(nss)}),
      FechaNacimiento = COALESCE(FechaNacimiento, ${sqlEsc(fechaNac)}),
      EstadoCivil = COALESCE(EstadoCivil, ${sqlEsc(estadoCivil)}),
      Nacionalidad = COALESCE(Nacionalidad, ${sqlEsc(nacionalidad)}),
      Escolaridad = COALESCE(Escolaridad, ${sqlEsc(escolaridad)}),
      Domicilio = COALESCE(Domicilio, ${sqlEsc(domicilio)}),
      DiasDescanso = COALESCE(DiasDescanso, ${sqlEsc(diasDescanso)}),
      AvisarEmergencia = COALESCE(AvisarEmergencia, ${sqlEsc(avisarEmergencia)}),
      ParentescoEmergencia = COALESCE(ParentescoEmergencia, ${sqlEsc(parentescoEmergencia)}),
      TelefonoEmergencia = COALESCE(TelefonoEmergencia, ${sqlEsc(telefonoEmergencia)}),
      TipoSangre = COALESCE(TipoSangre, ${sqlEsc(tipoSangre)}),
      AlergiasPadecimientos = COALESCE(AlergiasPadecimientos, ${sqlEsc(alergias)})
    WHERE CodigoEmpleado = ${sqlEsc(c.codigoEmpleado)};`);
  }
});

sqlStatements.push(`\nCOMMIT TRANSACTION;`);
sqlStatements.push(`PRINT 'Actualización de Sucursales y Jefes Directos finalizada exitosamente.';`);
sqlStatements.push(`GO\n`);

// Save updated seedData.json
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf8');
console.log(`Saved updated seedData.json with ${updatedCount} collaborators enriched.`);

// Save SQL migration script
const sqlPath = path.resolve(__dirname, '../../database/09_update_sucursales_y_jefes_excel.sql');
fs.writeFileSync(sqlPath, sqlStatements.join('\n'), 'utf8');
console.log(`Saved SQL update script to ${sqlPath}`);
