/**
 * Script de Actualización Masiva de Correo Corporativo
 * Directorio Institucional v2 - 14/10/2026
 * Grupo JAMA - DESARROLLO_O
 */

const { getPool, sql } = require('../server/src/config/database');

const DIRECTORIO_V2 = [
  // Dominio moctezuma-gdl.com (DICOSA)
  { nombre: 'Angelica Solano', correo: 'administracion@moctezuma-gdl.com', empresa: 'DICOSA' },
  { nombre: 'Mirna Beiza', correo: 'mbeiza@moctezuma-gdl.com', empresa: 'DICOSA' },

  // Dominio grupojama.com (Controladora / Corporativo)
  { nombre: 'Adriana Calderón', correo: 'acalderon@grupojama.com', empresa: 'Controladora' },
  { nombre: 'María Vera', correo: 'admin.rh@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Aranza Morales', correo: 'asistentedir@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Cecilia Madrigal', correo: 'cmadrigal@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Carmen Martínez', correo: 'cmartinez@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Cristina Salas', correo: 'csalas@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Enrique Briones', correo: 'ebriones@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Eduardo Sánchez', correo: 'emacias@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Eduardo Blanco', correo: 'eblanco@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Esther González', correo: 'egonzalez@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Fernanda Arvizu', correo: 'farvizu@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Felipe Vanegas', correo: 'fvanegas@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Tania Hurtado', correo: 'generalista.rh@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Jorge García', correo: 'jgarcia@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Jesús Torres', correo: 'jtorres@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Karola Linares', correo: 'klinares@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Luis Torres', correo: 'ltorres@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Lucía Cárdenas', correo: 'lcardenas@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Mauro Rodriguez', correo: 'jmrodriguez@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Manuel Toledo', correo: 'mtoledo@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Pierre Pérez', correo: 'pperez@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Beatriz Campos', correo: 'recursoshumanos@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Rocío González', correo: 'rogonzale@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Susana Martinez', correo: 'smartinez@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Enrique Álvarez', correo: 'soporte@grupojama.com', empresa: 'Controladora' },
  { nombre: 'Verónica Soto', correo: 'vsoto@grupojama.com', empresa: 'Controladora' },

  // Dominio latinoconcretos.com
  { nombre: 'Raúl Arreguín', correo: 'arreguin.raul@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Monica Delgadillo', correo: 'delgadillo.monica@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Daniela Juárez', correo: 'facturacion.gdl@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Gabriela Mortera', correo: 'facturacion.slp@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Ulises Garces', correo: 'garces.ulises@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Jose Angel García', correo: 'garcia.jose@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Juan González', correo: 'gonzalez.juan@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Juan Salas', correo: 'salas.juan@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Paulina Alvarado', correo: 'suministro.slp@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Manuel Velazquez', correo: 'velazquez.manuel@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Jose Luis Campos', correo: 'superintentende.norte@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Jose Luis Lozano', correo: 'ventasuno.norte@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Francisco Guzmán', correo: 'guzman.francisco@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Luis Padilla', correo: 'laboratorio.tlaquepaque@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Sergio Lopez', correo: 'lopez.sergio@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'David Martínez', correo: 'martinez.david@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Gloria Mora', correo: 'mora.gloria@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Yair Samuel Cuevas Salas', correo: 'cuevas.samuel@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Víctor Honorato Anota', correo: 'honorato.victor@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'David Cruces Sanchez', correo: 'laboratorio.villa@latinoconcretos.com', empresa: 'Latino Concretos' },
  { nombre: 'Eduardo Reyes Castillejo', correo: 'superintendente.villa@latinoconcretos.com', empresa: 'Latino Concretos' },

  // Dominio obratotal.mx (Construjama / Obra Total)
  { nombre: 'Noemy Almanza', correo: 'credito.ags@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Karen Salinas de Luna', correo: 'facturacion.ags@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Javier Perez', correo: 'logistica.ags@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Rodolfo Villalobos', correo: 'rodolfo.villalobos@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Jorge Cárdenas', correo: 'ventasdos.ags@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Daisy González', correo: 'ventasuno.ags@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Sanjuana García', correo: 'credito.mat@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Yadira Coronado', correo: 'facturacion.mat@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Edilberto Garza', correo: 'logistica.mat@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Mario Obregon', correo: 'mario.obregon@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Edgar Orozco', correo: 'ventasdos.mat@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Jesús Hernandez', correo: 'ventasuno.mat@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Mayra Salcido', correo: 'administracion.gdl@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Eduardo López', correo: 'comercial.gdl@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Alejandra Rocha', correo: 'credito.gdl@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Jennifer Lopez', correo: 'facturacion.gdl@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Guadalupe Rivera', correo: 'logistica.gdl@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'María Araiza', correo: 'maria.araiza@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Martín Valadez', correo: 'ventasuno.gdl@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Jorge Luis Flores', correo: 'flores.jorge@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Angel Amaya', correo: 'angel.amaya@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Selene Ambriz', correo: 'credito.mty@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Isabel Ramos', correo: 'facturacion.mty@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Juan Rosas', correo: 'logistica.mty@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Isidro Medellín', correo: 'ventasuno.mty@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Jesús Manuel Pérez', correo: 'ventasdos.mty@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Arturo Obregon Sifuentes', correo: 'obregon.arturo@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Magdalena Hernandez', correo: 'administracion.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Diana Rivera', correo: 'auxiliar.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Melissa Gomez', correo: 'credito.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Griselda Gonzalez', correo: 'facturacion.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Karla Rodríguez', correo: 'logistica.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Marisela Lopez', correo: 'marisela.lopez@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Tania Briones', correo: 'ventasdos.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Edgar Segura', correo: 'ventasuno.rv@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Carolina Resendiz', correo: 'administracion.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Elizabeth Montero', correo: 'auxiliar.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Isabel Aguillón', correo: 'credito.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Mariela Martínez', correo: 'facturacion.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Jose Chapa', correo: 'jose.chapa@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Norma Rodríguez', correo: 'logistica.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'David Martínez', correo: 'ventasdos.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Rosa Terrones', correo: 'ventasuno.valles@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Monserrat Navarro', correo: 'administracion.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Paola Alemán', correo: 'credito.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Maricela Quintero', correo: 'facturacion.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Manuel Martínez', correo: 'logistica.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Rodrigo Sánchez', correo: 'rodrigo.sanchez@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Claudio Alexis Campo', correo: 'ventascuatro.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Juan Manuel Candelaria', correo: 'ventasdos.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Francisco Martínez', correo: 'ventastres.slp@obratotal.mx', empresa: 'Construjama' },
  { nombre: 'Juan Carlos Veraud', correo: 'ventasuno.slp@obratotal.mx', empresa: 'Construjama' },

  // Dominio tramodelcentro.com (Tramo del Centro)
  { nombre: 'Abigail Escamilla', correo: 'aescamilla@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Luis Rodriguez', correo: 'analista.capacitacion@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Miguel Escalante', correo: 'analista.talento@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Tania Sanchez', correo: 'asistente.administrativo@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Nohemi Hernandez', correo: 'atesoreria@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Cristobal Regalado', correo: 'aux.diagnostico@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Saide González', correo: 'aux.mtto@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Carlo Cabrera', correo: 'ccabrera@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Nery García', correo: 'cobranza@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Melany Gámez', correo: 'coordinacion.operaciones@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'María José Hernández', correo: 'coordinacion.operacionesdos@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Martín Alvarado', correo: 'coordinador.mtto@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Efraín Salgado', correo: 'esalgado@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Dulce Carrizales', correo: 'facturacion@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Fabiola Gamboa', correo: 'fgamboa@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Héctor Limón', correo: 'hlimon@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Isabel Bautista', correo: 'ibautista@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Ismael Loredo', correo: 'iloredo@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Rafael Ponce', correo: 'instructor.combustible@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Oswaldo Andrade', correo: 'jefe.combustible@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Humberto Rangel', correo: 'jefe.monitoreo@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Michael Castillo', correo: 'jefeoperaciones@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Jorge Guante', correo: 'jguante@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Juan Antonio Tristán', correo: 'jtristan@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Juan Jesús Rodriguez', correo: 'juanrodriguez@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Lizeth Alonso', correo: 'lalonso@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Irving Martínez', correo: 'liquidaciones@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Sandra Silva', correo: 'llantas@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Mateo Hernandez', correo: 'mhernandez@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Martha Torres', correo: 'mtorres@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Griselda Torres', correo: 'pagoproveedores@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Nohemí Soto', correo: 'reclutamiento@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Fátima Carrillo', correo: 'recursoshumanos@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Rodolfo González', correo: 'rgonzalez@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Carlos Cerón', correo: 'seguridad@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Griselda Lopez', correo: 'serviciomedico@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Bernardo Orta', correo: 'sistemas@tramodelcentro.com', empresa: 'Tramo' },
  { nombre: 'Eduardo Bravo', correo: 'supervisor.mtto@tramodelcentro.com', empresa: 'Tramo' }
];

function normalizar(texto) {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

async function ejecutarActualizacionCorreos() {
  console.log('================================================================');
  console.log('  ACTUALIZACIÓN MASIVA DE CORREO CORPORATIVO (Directorio v2)');
  console.log('  Base de Datos: DESARROLLO_O (dbo.Colaboradores)');
  console.log('================================================================');

  const pool = await getPool();

  // 1. Obtener todos los colaboradores activos e inactivos de la base de datos
  const colabRes = await pool.request().query(`
    SELECT 
      c.IdColaborador,
      c.CodigoEmpleado,
      c.NombreCompleto,
      c.Nombre,
      c.ApellidoPaterno,
      c.ApellidoMaterno,
      c.Empresa,
      e.AliasEmpresa,
      e.NombreBaseDatos,
      c.Sucursal,
      c.EmailCorporativo,
      c.Activo
    FROM dbo.Colaboradores c
    LEFT JOIN dbo.EmpresasNomipaq e ON c.IdEmpresa = e.IdEmpresa;
  `);

  const colaboradores = colabRes.recordset;
  console.log(`[INFO] Colaboradores en BD: ${colaboradores.length}`);
  console.log(`[INFO] Registros a procesar en Directorio v2: ${DIRECTORIO_V2.length}`);

  let actualizados = 0;
  let yaAsignados = 0;
  const noEncontrados = [];
  const asignadosLog = [];

  for (const item of DIRECTORIO_V2) {
    const normBuscado = normalizar(item.nombre);
    const palabrasBuscadas = normBuscado.split(' ').filter(p => p.length >= 3);
    const normEmpresaBuscada = normalizar(item.empresa);

    // Buscar candidatos
    const candidatos = [];

    for (const c of colaboradores) {
      const normCompleto = normalizar(c.NombreCompleto);
      const normNombre = normalizar(c.Nombre);
      const normPat = normalizar(c.ApellidoPaterno);
      const normMat = normalizar(c.ApellidoMaterno);
      const normCombinado1 = `${normNombre} ${normPat}`.trim();
      const normCombinado2 = `${normPat} ${normMat} ${normNombre}`.trim();

      // Evaluar coincidencia
      let coincide = false;

      // Coincidencia exacta de subcadena
      if (normCompleto.includes(normBuscado) || 
          normCombinado1.includes(normBuscado) || 
          normCombinado2.includes(normBuscado)) {
        coincide = true;
      } else {
        // Coincidencia de todas las palabras clave (ej. Nombre + Apellido)
        const contieneTodas = palabrasBuscadas.length >= 2 && 
          palabrasBuscadas.every(p => normCompleto.includes(p) || normCombinado1.includes(p) || normCombinado2.includes(p));
        if (contieneTodas) {
          coincide = true;
        }
      }

      if (coincide) {
        // Ponderar candidato: coincidencia de empresa, si está activo, etc.
        let puntaje = 0;
        if (c.Activo) puntaje += 10;
        
        const normEmpresaC = normalizar(c.AliasEmpresa || c.Empresa || c.NombreBaseDatos || '');
        const normSucursalC = normalizar(c.Sucursal || '');

        if (normEmpresaBuscada) {
          if (normEmpresaC.includes(normEmpresaBuscada) || normSucursalC.includes(normEmpresaBuscada)) {
            puntaje += 20;
          }
          if (normEmpresaBuscada === 'TRAMO' && (normEmpresaC.includes('TRAMO') || normSucursalC.includes('TRAMO'))) {
            puntaje += 30;
          }
          if (normEmpresaBuscada === 'CONSTRUJAMA' && (normEmpresaC.includes('CONSTRUJAMA') || normEmpresaC.includes('OBRA'))) {
            puntaje += 30;
          }
          if (normEmpresaBuscada === 'LATINO CONCRETOS' && (normEmpresaC.includes('LATINO') || normEmpresaC.includes('CONCRETO'))) {
            puntaje += 30;
          }
          if (normEmpresaBuscada === 'CONTROLADORA' && (normEmpresaC.includes('CONTROLADORA') || normSucursalC.includes('CONTROLADORA') || normSucursalC.includes('CORPORATIVO'))) {
            puntaje += 30;
          }
          if (normEmpresaBuscada === 'DICOSA' && (normEmpresaC.includes('CEMENTO') || normEmpresaC.includes('DISTRIBUIDOR') || normSucursalC.includes('DICOSA') || normSucursalC.includes('CEMENTOS'))) {
            puntaje += 30;
          }
        }

        candidatos.push({ colaborador: c, puntaje });
      }
    }

    if (candidatos.length === 0) {
      noEncontrados.push(item);
    } else {
      // Ordenar por mayor puntaje
      candidatos.sort((a, b) => b.puntaje - a.puntaje);
      const seleccionado = candidatos[0].colaborador;

      // Ejecutar UPDATE en BD si es diferente
      if (seleccionado.EmailCorporativo !== item.correo) {
        await pool.request()
          .input('IdColaborador', seleccionado.IdColaborador)
          .input('EmailCorporativo', item.correo.trim().toLowerCase())
          .query(`
            UPDATE dbo.Colaboradores
            SET EmailCorporativo = @EmailCorporativo
            WHERE IdColaborador = @IdColaborador;
          `);
        actualizados++;
        asignadosLog.push({
          nombreDirectorio: item.nombre,
          empresaDirectorio: item.empresa,
          correo: item.correo,
          codigo: seleccionado.CodigoEmpleado,
          nombreBD: seleccionado.NombreCompleto,
          empresaBD: seleccionado.AliasEmpresa || seleccionado.Empresa,
          sucursalBD: seleccionado.Sucursal,
          status: 'ACTUALIZADO'
        });
      } else {
        yaAsignados++;
        asignadosLog.push({
          nombreDirectorio: item.nombre,
          empresaDirectorio: item.empresa,
          correo: item.correo,
          codigo: seleccionado.CodigoEmpleado,
          nombreBD: seleccionado.NombreCompleto,
          empresaBD: seleccionado.AliasEmpresa || seleccionado.Empresa,
          sucursalBD: seleccionado.Sucursal,
          status: 'YA_COINCIDIA'
        });
      }
    }
  }

  // Resumen final de conteos en base de datos
  const totalRes = await pool.request().query(`
    SELECT 
      COUNT(*) AS TotalColaboradoresConCorreo,
      COUNT(DISTINCT c.IdColaborador) AS ColaboradoresUnicos,
      SUM(CASE WHEN c.Activo = 1 THEN 1 ELSE 0 END) AS ActivosConCorreo
    FROM dbo.Colaboradores c
    WHERE c.EmailCorporativo IS NOT NULL AND RTRIM(LTRIM(c.EmailCorporativo)) <> '';
  `);

  console.log('\n================================================================');
  console.log('  RESULTADO DE LA ACTUALIZACIÓN');
  console.log('================================================================');
  console.log(`✅ Registros actualizados en esta corrida: ${actualizados}`);
  console.log(`ℹ️ Registros que ya tenían el correo correcto: ${yaAsignados}`);
  console.log(`⚠️ Registros no encontrados: ${noEncontrados.length}`);
  if (noEncontrados.length > 0) {
    console.log('No encontrados:', noEncontrados);
  }
  console.log('\n--- CONTEO GENERAL EN dbo.Colaboradores ---');
  console.log('Total Colaboradores con EmailCorporativo:', totalRes.recordset[0].TotalColaboradoresConCorreo);
  console.log('Total Activos con EmailCorporativo:', totalRes.recordset[0].ActivosConCorreo);
  console.log('================================================================');

  process.exit(0);
}

ejecutarActualizacionCorreos().catch(err => {
  console.error('[FATAL] Error en la actualización masiva de correos:', err);
  process.exit(1);
});
