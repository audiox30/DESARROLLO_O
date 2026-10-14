const API_BASE = '/api';

let currentToken = localStorage.getItem('jama_vacaciones_token') || '';
let currentUserId = localStorage.getItem('jama_vacaciones_user_id') || '1';
let simulationHeaders = {};
let activeSimulatedRole = null;
let activeSimulatedColabId = null;

export function setActiveSimulation(role, colabId = null) {
  if (role && role !== 'SISTEMAS' && role !== 'SUPERADMIN') {
    activeSimulatedRole = role;
    activeSimulatedColabId = colabId ? String(colabId) : null;
    simulationHeaders = {
      'x-simulate-role': role,
      ...(activeSimulatedColabId ? { 
        'x-simulate-colaborador': activeSimulatedColabId 
      } : {})
    };
  } else {
    activeSimulatedRole = null;
    activeSimulatedColabId = null;
    simulationHeaders = {};
  }
}

export function setSimulationHeaders(headers) {
  simulationHeaders = headers || {};
}

export function setAuthToken(token, userId) {
  currentToken = token || '';
  currentUserId = userId || '';
  if (token) localStorage.setItem('jama_vacaciones_token', token);
  else localStorage.removeItem('jama_vacaciones_token');
  if (userId) localStorage.setItem('jama_vacaciones_user_id', String(userId));
  else localStorage.removeItem('jama_vacaciones_user_id');
}

export function clearAuth() {
  currentToken = '';
  currentUserId = '';
  simulationHeaders = {};
  activeSimulatedRole = null;
  activeSimulatedColabId = null;
  localStorage.removeItem('jama_vacaciones_token');
  localStorage.removeItem('jama_vacaciones_user_id');
  localStorage.removeItem('jama_vacaciones_user');
}

export function getCurrentUserId() {
  return currentUserId;
}

async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const interceptorHeaders = {};

  // Interceptor: adjuntar x-simulate-role si hay simulación activa
  if (activeSimulatedRole) {
    interceptorHeaders['x-simulate-role'] = activeSimulatedRole;
    if (activeSimulatedColabId) {
      interceptorHeaders['x-simulate-colaborador'] = String(activeSimulatedColabId);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
    ...(currentUserId ? { 'x-user-id': String(currentUserId) } : {}),
    ...interceptorHeaders,
    ...simulationHeaders,
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return response.blob();
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ocurrió un error en la solicitud');
  }

  return data;
}

export const api = {
  // Auth & Personas
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  cambiarPassword: (data) => request('/auth/cambiar-password', { method: 'POST', body: JSON.stringify(data) }),
  getPersonasDemo: () => request('/auth/personas'),
  switchUser: (payload) => request('/auth/switch', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/auth/me'),

  // Catálogo Empresas Nomipaq
  getEmpresas: () => request('/empresas'),

  // Módulo Líder (RBAC)
  getLiderSolicitudesPendientes: () => request('/lider/solicitudes-pendientes'),
  resolverSolicitudLider: (id, accion, comentarios) => 
    request(`/lider/solicitud/${id}/resolver`, { method: 'POST', body: JSON.stringify({ accion, comentarios }) }),
  getMiEquipoLider: () => request('/lider/mi-equipo'),
  getSolicitudesColaborador: (id) => request(`/lider/colaborador/${id}/solicitudes`),

  // Colaboradores & Saldos
  getColaboradores: (params = '') => request(`/colaboradores${params ? '?' + params : ''}`),
  getMiSaldo: () => request('/colaboradores/saldo'),
  getEquipoLider: () => request('/colaboradores/equipo'),
  getColaborador: (id) => request(`/colaboradores/${id}`),
  updateColaborador: (id, data) => request(`/colaboradores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getColaboradorHijos: (id) => request(`/colaboradores/${id}/hijos`),
  agregarHijo: (id, data) => request(`/colaboradores/${id}/hijos`, { method: 'POST', body: JSON.stringify(data) }),
  eliminarHijo: (id, idHijo) => request(`/colaboradores/${id}/hijos/${idHijo}`, { method: 'DELETE' }),
  getKardexColaborador: (id) => request(`/saldos/colaborador/${id}`),
  getHijosColaborador: (id) => request(`/colaboradores/${id}/hijos`),
  agregarHijoColaborador: (id, data) => request(`/colaboradores/${id}/hijos`, { method: 'POST', body: JSON.stringify(data) }),
  eliminarHijoColaborador: (id, idHijo) => request(`/colaboradores/${id}/hijos/${idHijo}`, { method: 'DELETE' }),

  // Solicitudes
  crearSolicitud: (data) => request('/solicitudes', { method: 'POST', body: JSON.stringify(data) }),
  getMisSolicitudes: () => request('/solicitudes/mis'),
  getBandejaLider: () => request('/solicitudes/bandeja-lider'),
  getBandejaDO: (params = '') => request(`/solicitudes/bandeja-do${params ? '?' + params : ''}`),
  getSolicitudDetalle: (id) => request(`/solicitudes/${id}`),
  cancelarSolicitud: (id) => request(`/solicitudes/${id}/cancelar`, { method: 'POST' }),
  descargarPdfFdo84: async (idSolicitud, folio = '') => {
    if (!idSolicitud) {
      throw new Error('Identificador de solicitud no válido para generar el formato FDO-84.');
    }
    const res = await fetch(`${API_BASE}/solicitudes/${idSolicitud}/pdf`, {
      headers: {
        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        'x-user-id': String(currentUserId),
        ...simulationHeaders
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al generar formato FDO-84' }));
      throw new Error(err.error || 'Error al generar formato FDO-84');
    }
    const blob = await res.blob();
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(pdfBlob);

    // Intentar abrir visor en nueva pestaña
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Si la ventana emergente fue bloqueada, forzar descarga con nombre institucional
      const folioLimpio = folio ? String(folio).replace(/[^a-zA-Z0-9_-]/g, '_') : idSolicitud;
      const nombreArchivo = `FDO-84_Solicitud_${folioLimpio}.pdf`;
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  },

  // Aprobaciones
  aprobarSolicitud: (id, comentarios, metodo = 'WEB') => 
    request(`/aprobaciones/${id}/aprobar`, { method: 'POST', body: JSON.stringify({ comentarios, metodoAutorizacion: metodo }) }),
  rechazarSolicitud: (id, comentarios, metodo = 'WEB') => 
    request(`/aprobaciones/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ comentarios, metodoAutorizacion: metodo }) }),

  // Días Inhábiles
  getDiasInhabiles: () => request('/dias-inhabiles'),
  agregarDiaInhabil: (data) => request('/dias-inhabiles', { method: 'POST', body: JSON.stringify(data) }),
  eliminarDiaInhabil: (fecha) => request(`/dias-inhabiles/${fecha}`, { method: 'DELETE' }),
  calcularDiasHabiles: (data) => request('/dias-inhabiles/calcular', { method: 'POST', body: JSON.stringify(data) }),

  // Kardex y Reportes
  getKardexGlobal: (params = '') => request(`/saldos/kardex-global${params ? '?' + params : ''}`),
  descargarKardexCSV: async () => {
    const res = await fetch(`${API_BASE}/saldos/kardex-global?format=csv`, {
      headers: {
        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        'x-user-id': String(currentUserId)
      }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KARDEX_VACACIONES_GRUPO_JAMA_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // Sincronización NOMIPAQ Multi-Empresa
  getSyncStatus: () => request('/sync-nomipaq/status'),
  sincronizarEmpleados: () => request('/admin/sincronizar-empleados', { method: 'POST' }),
  getSyncTaskStatus: (taskId) => request(`/admin/sincronizar-empleados/status/${taskId}`),
  getSyncLogs: () => request('/sync-nomipaq/logs'),

  // Módulo Sistemas / TI (SuperAdmin)
  getSistemasUsuarios: () => request('/sistemas/usuarios'),
  toggleUsuarioActivo: (id) => request(`/sistemas/usuarios/${id}/toggle-activo`, { method: 'POST' }),
  resetUsuarioPassword: (id) => request(`/sistemas/usuarios/${id}/reset-password`, { method: 'POST' }),
  getSistemasAuditoria: () => request('/sistemas/auditoria'),
  getSistemasDiagnostico: () => request('/sistemas/diagnostico'),

  // Descarga Genérica de Archivos Excel (.xlsx)
  descargarExcel: async (endpoint, filename) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        'x-user-id': String(currentUserId),
        ...simulationHeaders
      }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `REPORTE_JAMA_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // Catálogo Administrativo de Colaboradores & Roles (ADMIN_DO / SISTEMAS)
  getColaboradoresAdmin: (params = '') => request(`/admin/colaboradores${params ? '?' + params : ''}`),
  updateColaboradorComplementarios: (id, data) => request(`/admin/colaboradores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetColaboradorPasswordAdmin: (id, data = {}) => request(`/admin/colaboradores/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),

  getAdministradoresDO: () => request('/admin/roles/administradores-do'),
  asignarAdminDO: (idColaborador) => request('/admin/roles/asignar-admin-do', { method: 'POST', body: JSON.stringify({ idColaborador }) }),
  revocarAdminDO: (idColaborador, nuevoRol) => request('/admin/roles/revocar-admin-do', { method: 'POST', body: JSON.stringify({ idColaborador, nuevoRol }) }),

  // Módulo de Reportes y Analítica
  getReportePadron: (params = '') => request(`/reportes/padron${params ? '?' + params : ''}`),
  descargarReportePadronExcel: (params = '') => 
    api.descargarExcel(`/reportes/padron?format=xlsx${params ? '&' + params : ''}`, `PADRON_COLABORADORES_JAMA_${new Date().toISOString().split('T')[0]}.xlsx`),

  getReporteSaldos: (params = '') => request(`/reportes/saldos${params ? '?' + params : ''}`),
  descargarReporteSaldosExcel: (params = '') => 
    api.descargarExcel(`/reportes/saldos?format=xlsx${params ? '&' + params : ''}`, `SALDOS_VACACIONES_JAMA_${new Date().toISOString().split('T')[0]}.xlsx`),

  getReporteCalendarioAusencias: (params = '') => request(`/reportes/calendario-ausencias${params ? '?' + params : ''}`),
  descargarReporteCalendarioAusenciasExcel: (params = '') => 
    api.descargarExcel(`/reportes/calendario-ausencias?format=xlsx${params ? '&' + params : ''}`, `CALENDARIO_AUSENCIAS_JAMA_${new Date().toISOString().split('T')[0]}.xlsx`)
};
