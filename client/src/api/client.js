const API_BASE = '/api';

let currentToken = localStorage.getItem('jama_vacaciones_token') || '';
let currentUserId = localStorage.getItem('jama_vacaciones_user_id') || '1';

export function setAuthToken(token, userId) {
  currentToken = token;
  currentUserId = userId;
  if (token) localStorage.setItem('jama_vacaciones_token', token);
  else localStorage.removeItem('jama_vacaciones_token');
  if (userId) localStorage.setItem('jama_vacaciones_user_id', String(userId));
}

export function getCurrentUserId() {
  return currentUserId;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
    ...(currentUserId ? { 'x-user-id': String(currentUserId) } : {}),
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
  getPersonasDemo: () => request('/auth/personas'),
  switchUser: (payload) => request('/auth/switch', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/auth/me'),

  // Colaboradores & Saldos
  getColaboradores: (params = '') => request(`/colaboradores${params ? '?' + params : ''}`),
  getMiSaldo: () => request('/colaboradores/saldo'),
  getEquipoLider: () => request('/colaboradores/equipo'),
  getColaborador: (id) => request(`/colaboradores/${id}`),

  // Solicitudes
  crearSolicitud: (data) => request('/solicitudes', { method: 'POST', body: JSON.stringify(data) }),
  getMisSolicitudes: () => request('/solicitudes/mis'),
  getBandejaLider: () => request('/solicitudes/bandeja-lider'),
  getBandejaDO: (params = '') => request(`/solicitudes/bandeja-do${params ? '?' + params : ''}`),
  getSolicitudDetalle: (id) => request(`/solicitudes/${id}`),
  cancelarSolicitud: (id) => request(`/solicitudes/${id}/cancelar`, { method: 'POST' }),

  // Aprobaciones
  aprobarSolicitud: (id, comentarios, metodo = 'WEB') => 
    request(`/aprobaciones/${id}/aprobar`, { method: 'POST', body: JSON.stringify({ comentarios, metodoAutorizacion: metodo }) }),
  rechazarSolicitud: (id, comentarios, metodo = 'WEB') => 
    request(`/aprobaciones/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ comentarios, metodoAutorizacion: metodo }) }),
  simularTeams: (idSolicitud) => 
    request('/aprobaciones/simular-teams', { method: 'POST', body: JSON.stringify({ idSolicitud }) }),

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

  // Sincronización NOMIPAQ
  getSyncStatus: () => request('/sync-nomipaq/status'),
  getSyncPreview: () => request('/sync-nomipaq/preview'),
  ejecutarSync: () => request('/sync-nomipaq/execute', { method: 'POST' }),
  getSyncLogs: () => request('/sync-nomipaq/logs')
};
