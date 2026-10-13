/**
 * Script de Migración y Vinculación: Correo Corporativo (Directorio Teams v1.9 -> dbo.Colaboradores)
 */
const { getLocalPool } = require('../src/config/database');

const directorioMappings = [
  { nombre: "Enrique Alvarez", email: "soporte@grupojama.com" },
  { nombre: "Rodolfo Villalobos", email: "rvillalobos@grupojama1.onmicrosoft.com" },
  { nombre: "Javier Perez Jiménez", email: "logistica.ags@obratotal.mx" },
  { nombre: "Karen Salinas de Luna", email: "facturacion.ags@obratotal.mx" },
  { nombre: "Noemy Almanza Huerta", email: "credito.ags@obratotal.mx" },
  { nombre: "Daisy González Beltran", email: "ventasuno.ags@obratotal.mx" },
  { nombre: "Jorge Cárdenas Castillo", email: "ventasdos.ags@obratotal.mx" },
  { nombre: "Monserrat Navarro Carrillo", email: "administracion.slp@obratotal.mx" },
  { nombre: "Rodrigo Sánchez Quiroz", email: "rsanchez@grupojama1.onmicrosoft.com" },
  { nombre: "Paola Aleman Bueno", email: "credito.slp@obratotal.mx" },
  { nombre: "Manuel Martínez Lopez", email: "logistica.slp@obratotal.mx" },
  { nombre: "Maricela Quintero Herrera", email: "facturacion.slp@obratotal.mx" },
  { nombre: "Carlos Cañizalez", email: "ventascuatro.slp@obratotal.mx" },
  { nombre: "Francisco Martínez Diaz", email: "ventastres.slp@obratotal.mx" },
  { nombre: "Juan Manuel Candelaria", email: "ventasdos.slp@obratotal.mx" },
  { nombre: "Juan Carlos Fernández", email: "ventasuno.slp@obratotal.mx" },
  { nombre: "Mariela Martínez Azua", email: "facturacion.valles@obratotal.mx" },
  { nombre: "Isabel Aguillón Garcia", email: "credito.valles@obratotal.mx" },
  { nombre: "Norma Rodríguez Soria", email: "logistica.valles@obratotal.mx" },
  { nombre: "Elizabeth Montero Castillo", email: "auxiliar.valles@obratotal.mx" },
  { nombre: "Carolina Resendiz Villalon", email: "administracion.valles@obratotal.mx" },
  { nombre: "Jose Chapa Hernandez", email: "jchapa@grupojama1.onmicrosoft.com" },
  { nombre: "Rosa Terrones Rivera", email: "ventasuno.valles@obratotal.mx" },
  { nombre: "David Martínez Perez", email: "ventasdos.valles@obratotal.mx" },
  { nombre: "Yadira Coronado Gámez", email: "facturacion.mat@obratotal.mx" },
  { nombre: "Sanjuana García Candia", email: "credito.mat@obratotal.mx" },
  { nombre: "Mario Obregon Prieto", email: "mobregon@grupojama1.onmicrosoft.com" },
  { nombre: "Jesús Hernández Salazar", email: "ventasuno.mat@obratotal.mx" },
  { nombre: "Edgar Orozco Cruz", email: "ventasdos.mat@obratotal.mx" },
  { nombre: "Francisco Garza Jasso", email: "logistica.mat@obratotal.mx" },
  { nombre: "Guadalupe Rivera Pascual", email: "logistica.gdl@obratotal.mx" },
  { nombre: "Alejandra Rocha Reyes", email: "credito.gdl@obratotal.mx" },
  { nombre: "María de Jesus Araiza", email: "maraiza@grupojama1.onmicrosoft.com" },
  { nombre: "Mayra Salcido", email: "administracion.gdl@obratotal.mx" },
  { nombre: "Martín Valadez Frias", email: "ventasuno.gdl@obratotal.mx" },
  { nombre: "Eduardo Lopez Salinas", email: "comercial.gdl@obratotal.mx" },
  { nombre: "Jorge Luis Flores Calderón", email: "flores.jorge@obratotal.mx" },
  { nombre: "Jennifer Lopez", email: "facturacion.gdl@obratotal.mx" },
  { nombre: "Angel Amaya", email: "jamaya@grupojama1.onmicrosoft.com" },
  { nombre: "Juan Rosas Tinajero", email: "logistica.mty@obratotal.mx" },
  { nombre: "Isabel Ramos Reyes", email: "facturacion.mty@obratotal.mx" },
  { nombre: "Selene Ambriz Orozco", email: "credito.mty@obratotal.mx" },
  { nombre: "Isidro Medellín", email: "ventasuno.mty@obratotal.mx" },
  { nombre: "Jesús Pérez Ríos", email: "ventasdos.mty@obratotal.mx" },
  { nombre: "Griselda González Diaz", email: "facturacion.rv@obratotal.mx" },
  { nombre: "Melissa Gómez Avila", email: "credito.rv@obratotal.mx" },
  { nombre: "Marisela Lopez Hernandez", email: "mlopez@grupojama1.onmicrosoft.com" },
  { nombre: "Magdalena Hernandez Arias", email: "administracion.rv@obratotal.mx" },
  { nombre: "Karla Rodríguez Hernandez", email: "logistica.rv@obratotal.mx" },
  { nombre: "Diana Rivera Almazan", email: "auxiliar.rv@obratotal.mx" },
  { nombre: "Tania Briones", email: "ventasdos.rv@obratotal.mx" },
  { nombre: "Edgar Segura", email: "ventasuno.rv@obratotal.mx" },
  { nombre: "Francisco Guzmán", email: "guzman.francisco@latinoconcretos.com" },
  { nombre: "David Martínez Saldívar", email: "martinez.david@latinoconcretos.com" },
  { nombre: "Gloria Mora Isabelles", email: "mora.gloria@latinoconcretos.com" },
  { nombre: "Samuel Cuevas Salas", email: "cuevas.samuel@latinoconcretos.com" },
  { nombre: "Fidel Cabrera", email: "cabrera.fidel@latinoconcretos.com" },
  { nombre: "Jose Luis Lozano Curto", email: "ventasuno.norte@latinoconcretos.com" },
  { nombre: "Jose Luis Campos", email: "superintendente.norte@latinoconcretos.com" },
  { nombre: "Raúl Arreguín", email: "arreguin.raul@grupojama1.onmicrosoft.com" },
  { nombre: "Mónica Delgadillo Guerrero", email: "delgadillo.monica@latinoconcretos.com" },
  { nombre: "Ulises Garces", email: "garces.ulises@latinoconcretos.com" },
  { nombre: "Juan Salas", email: "salas.juan@latinoconcretos.com" },
  { nombre: "Juan González", email: "gonzalez.juan@latinoconcretos.com" },
  { nombre: "Gabriela Mortera Jiménez", email: "facturacion.slp@latinoconcretos.com" },
  { nombre: "Daniela Juárez Saldierna", email: "facturacion.gdl@latinoconcretos.com" },
  { nombre: "Paulina Alvarado Beltran", email: "suministro.slp@latinoconcretos.com" },
  { nombre: "Jose García Ochoa", email: "garcia.jose@grupojama1.onmicrosoft.com" },
  { nombre: "Manuel Velazquez Arzola", email: "velazquez.manuel@latinoconcretos.com" },
  { nombre: "Víctor Honorato Anota", email: "honorato.victor@latinoconcretos.com" },
  { nombre: "David Cruces Sanchez", email: "laboratorio.villa@latinoconcretos.com" },
  { nombre: "Carlo Omar Cabrera Olvera", email: "ccabrera@tramodelcentro.com" },
  { nombre: "Carlos Cerón Santander", email: "seguridad@grupojama1.onmicrosoft.com" },
  { nombre: "Laura Cervantes", email: "aux.diagnostico@tramodelcentro.com" },
  { nombre: "Francisco Castillo Neave", email: "coordinacion.operaciones@tramodelcentro.com" },
  { nombre: "Dulce Angge Carrizales Rangel", email: "facturacion@tramodelcentro.com" },
  { nombre: "Eduardo Bravo Hernandez", email: "supervisor.mtto@tramodelcentro.com" },
  { nombre: "Efraín Salgado Sanchez", email: "esalgado@grupojama1.onmicrosoft.com" },
  { nombre: "Fabiola Alejandra Gamboa", email: "fgamboa@tramodelcentro.com" },
  { nombre: "Griselda Abigail Lopez Castañeda", email: "serviciomedico@tramodelcentro.com" },
  { nombre: "Héctor Limón Méndez", email: "operaciones1@grupojama1.onmicrosoft.com" },
  { nombre: "Oswaldo Andrade Dominguez", email: "jefe.combustible@grupojama1.onmicrosoft.com" },
  { nombre: "Humberto Rangel Hernandez", email: "jefe.monitoreo@grupojama1.onmicrosoft.com" },
  { nombre: "Irving Joel Martinez Zavala", email: "liquidaciones@tramodelcentro.com" },
  { nombre: "Ismael Loredo Quintana", email: "iloredo@tramodelcentro.com" },
  { nombre: "Abigail Escamilla", email: "operaciones2@grupojama1.onmicrosoft.com" },
  { nombre: "Jorge Guante Cruz", email: "jguante@grupojama1.onmicrosoft.com" },
  { nombre: "Juan Antonio Tristán", email: "jtristan@grupojama1.onmicrosoft.com" },
  { nombre: "Jesús Rodriguez Salazar", email: "juanrodriguez@tramodelcentro.com" },
  { nombre: "Isabel Bautista Briseño", email: "ibautista@tramodelcentro.com" },
  { nombre: "Liliana Moreno Muñiz", email: "control_unidades@tramodelcentro.com" },
  { nombre: "Lizeth Alonso Cortez", email: "lalonso@tramodelcentro.com" },
  { nombre: "Nohemí Hernandez Hernandez", email: "atesoreria@tramodelcentro.com" },
  { nombre: "María Jose Hernandez", email: "coordinacion.operacionesdos@tramodelcentro.com" },
  { nombre: "Mateo Hernández Sanchez", email: "mhernandez@grupojama1.onmicrosoft.com" },
  { nombre: "Michael Castillo Lopez", email: "jefe.operaciones@grupojama1.onmicrosoft.com" },
  { nombre: "Nery Celia García Torres", email: "cobranza@tramodelcentro.com" },
  { nombre: "Noemi Soto Martinez", email: "reclutamiento@tramodelcentro.com" },
  { nombre: "Rodolfo González Benitez", email: "rgonzalez@grupojama1.onmicrosoft.com" },
  { nombre: "Saide Lizett González", email: "aux.mtto@tramodelcentro.com" },
  { nombre: "Griselda Torres Castillo", email: "pagoproveedores@tramodelcentro.com" },
  { nombre: "Martha Torres", email: "mtorres@tramodelcentro.com" },
  { nombre: "Matías Robledo", email: "coordinador.mtto@tramodelcentro.com" },
  { nombre: "Sandra Silva González", email: "llantas@tramodelcentro.com" },
  { nombre: "Mirna Beiza Aguirre", email: "mbeiza@moctezuma-gdl.com" },
  { nombre: "Angelica Solano Beltran", email: "administracion@moctezuma-gdl.com" },
  { nombre: "Lucía Cárdenas", email: "lacardenas@grupojama.com" },
  { nombre: "Mauro Rodriguez", email: "jmrodriguez@grupojama.com" },
  { nombre: "Eduardo Sánchez", email: "emacias@grupojama.com" },
  { nombre: "Enrique Briones", email: "auditoria-jama@outlook.com" },
  { nombre: "María Vera", email: "adm.rh-jama@outlook.com" },
  { nombre: "Tania Hurtado", email: "generalista.rh-jama@outlook.com" },
  { nombre: "Beatriz Campos", email: "recursoshumanos@grupojama.com" },
  { nombre: "Verónica Soto", email: "vsoto@grupojama.com" },
  { nombre: "Felipe Vanegas", email: "fvanegas-jama@outlook.com" },
  { nombre: "Cecilia Madrigal", email: "cmadrigal-jama@outlook.com" },
  { nombre: "Cristina Salas", email: "csalas-jama@outlook.com" },
  { nombre: "Fernanda Arvizu", email: "farvizu-jama@outlook.com" },
  { nombre: "Esther González", email: "egonzalez-jama@outlook.com" },
  { nombre: "Luis Torres", email: "ltorres-jama@outlook.com" },
  { nombre: "Karola Linares", email: "klinares-jama@outlook.com" },
  { nombre: "Aranza Morales", email: "asistentedir@grupojama.com" },
  { nombre: "Jorge García", email: "jgarcia@grupojama.com" },
  { nombre: "Jesús Torres", email: "jtorres@grupojama.com" },
  { nombre: "Eduardo Blanco", email: "eblanco@grupojama.com" },
  { nombre: "Susana Martínez", email: "smartinez@grupojama.com" },
  { nombre: "Carmen Martínez", email: "cmartinez@grupojama.com" },
  { nombre: "Rocío González", email: "rogonzale@grupojama.com" },
  { nombre: "Pierre Perez", email: "pperez@grupojama.com" }
];

function normalizar(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras comunes a ignorar para el matching de tokens significativos
const STOP_WORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'MA', 'EL']);

async function ejecutarMigracion() {
  const pool = await getLocalPool();

  // Asegurar que la columna existe
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Colaboradores' AND COLUMN_NAME = 'EmailCorporativo')
    BEGIN
      ALTER TABLE dbo.Colaboradores ADD EmailCorporativo VARCHAR(150) NULL;
    END
  `);

  // Obtener todos los colaboradores de la BD
  const colabRes = await pool.request().query(`
    SELECT IdColaborador, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno, NombreCompleto, Email, EmailCorporativo, Activo
    FROM dbo.Colaboradores
  `);
  const colaboradores = colabRes.recordset;

  // Normalizar datos de la BD
  const dbIndexed = colaboradores.map(c => ({
    raw: c,
    id: c.IdColaborador,
    nombreCompletoNorm: normalizar(c.NombreCompleto || `${c.Nombre} ${c.ApellidoPaterno} ${c.ApellidoMaterno || ''}`),
    nombreNorm: normalizar(c.Nombre),
    paternoNorm: normalizar(c.ApellidoPaterno),
    maternoNorm: normalizar(c.ApellidoMaterno),
    tokens: normalizar(c.NombreCompleto || `${c.Nombre} ${c.ApellidoPaterno} ${c.ApellidoMaterno || ''}`)
      .split(' ')
      .filter(t => t.length > 1 && !STOP_WORDS.has(t)),
    activo: c.Activo === null || c.Activo === true || c.Activo === 1
  }));

  console.log(`[MIGRACIÓN] Total colaboradores en BD: ${colaboradores.length}`);
  console.log(`[MIGRACIÓN] Total registros en directorio a vincular: ${directorioMappings.length}`);

  let coincidencias = 0;
  let noEncontrados = [];
  let actualizaciones = [];

  for (const entry of directorioMappings) {
    const normBuscado = normalizar(entry.nombre);
    const tokensBuscados = normBuscado.split(' ').filter(t => t.length > 1 && !STOP_WORDS.has(t));

    // Estrategia 1: Coincidencia exacta o inclusión de todos los tokens buscados
    let candidatos = dbIndexed.filter(c => {
      if (tokensBuscados.includes('NOHEMI') && c.tokens.includes('LOURDES')) return false;
      return tokensBuscados.every(tb => c.tokens.some(ct => ct === tb || (tb === 'NOHEMI' && ct === 'NOEMI') || ct.startsWith(tb) || tb.startsWith(ct)));
    });

    // Si hay varios candidatos, preferir activos y con más coincidencia
    if (candidatos.length > 1) {
      const activos = candidatos.filter(c => c.activo);
      if (activos.length === 1) {
        candidatos = activos;
      } else {
        // Ordenar por cercanía de longitud
        candidatos.sort((a, b) => Math.abs(a.nombreCompletoNorm.length - normBuscado.length) - Math.abs(b.nombreCompletoNorm.length - normBuscado.length));
      }
    }

    // Estrategia 2: Si no hubo candidatos, buscar primer nombre y primer apellido
    if (candidatos.length === 0 && tokensBuscados.length >= 2) {
      const tPrimerNombre = tokensBuscados[0];
      const tApellido = tokensBuscados[tokensBuscados.length - 1];
      candidatos = dbIndexed.filter(c => {
        const tieneNombre = c.tokens.some(ct => ct === tPrimerNombre);
        const tieneApellido = c.tokens.some(ct => ct === tApellido);
        return tieneNombre && tieneApellido;
      });
      if (candidatos.length > 1) {
        const activos = candidatos.filter(c => c.activo);
        if (activos.length === 1) candidatos = activos;
      }
    }

    // Estrategia 3: Caso especial nombres como "Carmen Martínez" -> "MA. DEL CARMEN MARTINEZ"
    if (candidatos.length === 0) {
      for (const tb of tokensBuscados) {
        const posibles = dbIndexed.filter(c => c.nombreCompletoNorm.includes(tb));
        if (posibles.length > 0) {
          // verificar si algún otro token coincide
          const otrosTokens = tokensBuscados.filter(x => x !== tb);
          const mejor = posibles.find(p => otrosTokens.some(ot => p.nombreCompletoNorm.includes(ot)));
          if (mejor) {
            candidatos = [mejor];
            break;
          }
        }
      }
    }

    // Estrategia 4: Variantes fonéticas comunes (Z <-> S al final, Nohemi <-> Noemi, Ma. del Carmen)
    if (candidatos.length === 0) {
      const tokensVariantes = tokensBuscados.map(t => {
        let v = t;
        if (v.endsWith('Z')) v = v.slice(0, -1) + 'S';
        else if (v.endsWith('S')) v = v.slice(0, -1) + 'Z';
        if (v === 'NOHEMI') v = 'NOEMI';
        else if (v === 'NOEMI') v = 'NOHEMI';
        return v;
      });

      candidatos = dbIndexed.filter(c => {
        return tokensBuscados.some((tb, idx) => {
          const varT = tokensVariantes[idx];
          return c.tokens.some(ct => ct === tb || ct === varT || ct.startsWith(tb.slice(0, -1)));
        }) && tokensBuscados.length >= 2 && tokensBuscados.filter((tb, idx) => {
          const varT = tokensVariantes[idx];
          return c.tokens.some(ct => ct === tb || ct === varT);
        }).length >= Math.min(2, tokensBuscados.length);
      });
      if (candidatos.length > 1) {
        const activos = candidatos.filter(c => c.activo);
        if (activos.length === 1) candidatos = activos;
      }
    }

    if (candidatos.length > 0) {
      const match = candidatos[0];
      coincidencias++;
      actualizaciones.push({
        idColaborador: match.id,
        nombreDirectorio: entry.nombre,
        nombreBD: match.raw.NombreCompleto,
        codigoEmpleado: match.raw.CodigoEmpleado,
        emailCorporativo: entry.email.trim().toLowerCase()
      });
    } else {
      noEncontrados.push(entry);
    }
  }

  console.log(`\n======================================================`);
  console.log(`  RESUMEN DE EMPATE DIRECTO:`);
  console.log(`  ✔ Coincidencias encontradas: ${coincidencias} de ${directorioMappings.length}`);
  console.log(`  ✖ No encontrados: ${noEncontrados.length}`);
  console.log(`======================================================\n`);

  if (noEncontrados.length > 0) {
    console.log(`Pendientes / No encontrados:`);
    noEncontrados.forEach(ne => console.log(` - ${ne.nombre} -> ${ne.email}`));
    console.log(``);
  }

  // Aplicar actualización en BD
  let actualizadosCount = 0;
  for (const act of actualizaciones) {
    await pool.request()
      .input('IdColaborador', act.idColaborador)
      .input('EmailCorporativo', act.emailCorporativo)
      .query(`
        UPDATE dbo.Colaboradores
        SET EmailCorporativo = @EmailCorporativo,
            FechaModificacion = GETDATE()
        WHERE IdColaborador = @IdColaborador
      `);
    actualizadosCount++;
  }

  console.log(`✔ Se actualizaron exitosamente ${actualizadosCount} colaboradores con su Correo Corporativo en la BD.\n`);
  return { coincidencias, noEncontrados, actualizaciones };
}

if (require.main === module) {
  ejecutarMigracion()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error durante la migración:', err);
      process.exit(1);
    });
}

module.exports = { ejecutarMigracion, directorioMappings };
