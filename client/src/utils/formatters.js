/**
 * Utilidades de Estandarización de Nombres y Ordenamiento Alfabético A - Z
 * Formato Mandatorio: "APELLIDO PATERNO APELLIDO MATERNO, NOMBRES"
 * Ejemplo: "ACOSTA MARTINEZ, VALERIA GUADALUPE"
 */

/**
 * Formatea el nombre de un colaborador asegurando que inicie por apellidos.
 * @param {Object|string} c - Objeto colaborador o string de nombre
 * @returns {string} Nombre en formato "APELLIDOS, NOMBRES"
 */
export function formatearNombreColaborador(c) {
  if (!c) return '—';

  // Si es un objeto colaborador con propiedades individuales de apellidos y nombres
  if (typeof c === 'object') {
    const apPat = (c.apellidoPaterno || c.ApellidoPaterno || '').trim();
    const apMat = (c.apellidoMaterno || c.ApellidoMaterno || '').trim();
    const nom = (c.nombre || c.Nombre || '').trim();
    const apellidos = [apPat, apMat].filter(Boolean).join(' ');

    if (apellidos && nom) {
      return `${apellidos}, ${nom}`;
    }
    if (apellidos) return apellidos;
    if (nom) return nom;

    // Si no tiene campos individuales, revisar nombreCompleto / NombreCompleto / colaboradorNombre
    const nc = (
      c.NombreCompleto ||
      c.nombreCompleto ||
      c.colaboradorNombre ||
      c.ColaboradorNombre ||
      c.colaborador ||
      c.Colaborador ||
      ''
    ).trim();

    if (nc) {
      return normalizarTextoNombre(nc);
    }

    return '—';
  }

  // Si es una cadena de texto directa
  if (typeof c === 'string') {
    return normalizarTextoNombre(c);
  }

  return String(c);
}

/**
 * Normaliza un string de nombre para asegurar que quede en formato "APELLIDOS, NOMBRES".
 * Si ya contiene coma, se respeta tal cual con limpieza de espacios.
 */
function normalizarTextoNombre(str) {
  if (!str) return '—';
  const trimmed = str.trim();
  if (trimmed.includes(',')) {
    // Ya tiene estructura "APELLIDOS, NOMBRES"
    const partes = trimmed.split(',').map(p => p.trim());
    return `${partes[0]}, ${partes.slice(1).join(' ')}`.trim();
  }

  // Si viene en formato "NOMBRE APELLIDO_P APELLIDO_M" (sin comas)
  // Devolvemos el texto respetando los apellidos si es identificable
  return trimmed;
}

/**
 * Formato de etiqueta para menús desplegables (<select>, autocompletados y comboboxes):
 * "APELLIDOS, NOMBRES (Nómina - Empresa/Sucursal)"
 * Ejemplo: "ACOSTA MARTINEZ, VALERIA GUADALUPE (0836 - Tramo del Centro)"
 * @param {Object} c - Objeto colaborador
 * @returns {string} Etiqueta formateada
 */
export function formatearEtiquetaSelector(c) {
  if (!c) return '';
  const nombre = formatearNombreColaborador(c);
  const nomina = (c.CodigoEmpleado || c.codigoEmpleado || c.codigo || '').trim();
  const empresa = (c.Empresa || c.empresa || c.AliasEmpresa || c.aliasEmpresa || '').trim();
  const sucursal = (c.Sucursal || c.sucursal || '').trim();

  let ubicacion = empresa;
  if (sucursal && sucursal !== 'Matriz' && sucursal !== 'CENTRAL' && sucursal !== empresa) {
    ubicacion = empresa ? `${empresa} / ${sucursal}` : sucursal;
  }

  const detalles = [nomina, ubicacion].filter(Boolean).join(' - ');
  return detalles ? `${nombre} (${detalles})` : nombre;
}

/**
 * Compara dos colaboradores por apellidos en sentido alfabético estricto (A - Z)
 * @param {Object|string} a 
 * @param {Object|string} b 
 * @param {'asc'|'desc'} direccion 
 * @returns {number}
 */
export function compararPorApellidos(a, b, direccion = 'asc') {
  const nomA = formatearNombreColaborador(a).toLowerCase();
  const nomB = formatearNombreColaborador(b).toLowerCase();
  const cmp = nomA.localeCompare(nomB, 'es', { sensitivity: 'base' });
  return direccion === 'desc' ? -cmp : cmp;
}

/**
 * Desglosa un colaborador o nombre completo en dos partes:
 * - apellidos: Renglón 1 (Superior)
 * - nombres: Renglón 2 (Inferior)
 * @param {Object|string} c - Objeto colaborador o string de nombre
 * @returns {{ apellidos: string, nombres: string }}
 */
export function desglosarNombre(c) {
  if (!c) return { apellidos: '—', nombres: '' };

  // Si tiene campos individuales
  if (typeof c === 'object') {
    const apPat = (c.apellidoPaterno || c.ApellidoPaterno || '').trim();
    const apMat = (c.apellidoMaterno || c.ApellidoMaterno || '').trim();
    const nom = (c.nombre || c.Nombre || '').trim();
    const apellidosIndividuales = [apPat, apMat].filter(Boolean).join(' ');

    if (apellidosIndividuales) {
      return {
        apellidos: apellidosIndividuales.toUpperCase(),
        nombres: nom ? nom.toUpperCase() : ''
      };
    }
  }

  // Si viene como string o nombre consolidado
  let str = '';
  if (typeof c === 'object') {
    str = (
      c.NombreCompleto ||
      c.nombreCompleto ||
      c.NombreJefeDirecto ||
      c.JefeDirectoNombre ||
      c.colaboradorNombre ||
      c.ColaboradorNombre ||
      c.colaborador ||
      c.Colaborador ||
      ''
    ).trim();
  } else if (typeof c === 'string') {
    str = c.trim();
  }

  if (!str) return { apellidos: '—', nombres: '' };

  // Caso 1: Tiene coma "APELLIDOS, NOMBRES"
  if (str.includes(',')) {
    const partes = str.split(',');
    const apellidos = partes[0].trim().toUpperCase();
    const nombres = partes.slice(1).join(' ').trim().toUpperCase();
    return { apellidos: apellidos || '—', nombres: nombres || '' };
  }

  // Caso 2: Formato consolidado "APELLIDO_P APELLIDO_M NOMBRE(S)"
  // Extraer las primeras 2 palabras como Apellidos y el resto como Nombres
  const palabras = str.split(/\s+/).filter(Boolean);
  if (palabras.length <= 2) {
    return { apellidos: str.toUpperCase(), nombres: '' };
  }
  const apellidos = palabras.slice(0, 2).join(' ').toUpperCase();
  const nombres = palabras.slice(2).join(' ').toUpperCase();
  return { apellidos, nombres };
}

/**
 * Extrae las 2 letras iniciales para los avatares circulares basados en apellidos
 * @param {Object|string} c 
 * @returns {string} Dos letras mayúsculas
 */
export function obtenerInicialesColaborador(c) {
  const nombre = formatearNombreColaborador(c);
  if (!nombre || nombre === '—') return 'CO';
  const palabras = nombre.replace(',', '').trim().split(/\s+/);
  if (palabras.length >= 2) {
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }
  return nombre.substring(0, 2).toUpperCase();
}

