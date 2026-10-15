import React, { useState, useEffect } from 'react';
import { 
  Settings, Database, Mail, Calendar, HardDrive, 
  RotateCw, Save, CheckCircle, AlertCircle, Send, 
  Eye, EyeOff, ShieldAlert, Check, Server, Clock, 
  Layers, Lock, AlertTriangle, Terminal, Cpu,
  Search, Filter, X, ExternalLink, ShieldCheck, MailCheck,
  FileText, ArrowRight, RefreshCw, XCircle, Bell, Sparkles
} from 'lucide-react';
import { api } from '../api/client';

function formatearFechaHora(fechaStr) {
  if (!fechaStr) return '-';
  try {
    const [fecha, hora] = fechaStr.split(' ');
    if (!fecha) return fechaStr;
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y} ${hora || ''}`.trim();
  } catch {
    return fechaStr;
  }
}

function getTipoEventoBadge(tipo) {
  switch (tipo) {
    case 'NUEVA_SOLICITUD':
      return { label: 'Nueva Solicitud', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'PENDIENTE_GERENTE':
      return { label: 'Vo.Bo. Gerente', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'APROBADA_LIDER':
      return { label: 'Aprobación Líder', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'RECHAZADA_LIDER':
      return { label: 'Rechazo Líder', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'CANCELADA_COLABORADOR':
      return { label: 'Cancelada', bg: 'bg-slate-100 text-slate-700 border-slate-300' };
    case 'CONCLUIDA_DO':
      return { label: 'Resolución DO', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'RECHAZADA_DO':
      return { label: 'Rechazo DO', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'PRUEBA_TI':
      return { label: 'Prueba SMTP (TI)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    default:
      return { label: tipo || 'Notificación', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export default function AdminConfiguracionPage({ currentUser, onNavigateTab }) {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probandoCorreo, setProbandoCorreo] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [resultadoPruebaCorreo, setResultadoPruebaCorreo] = useState(null);

  // Auditoría de Correos Enviados (dbo.LogCorreosEnviados)
  const [logsCorreo, setLogsCorreo] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filtroEstatusLog, setFiltroEstatusLog] = useState('TODOS');
  const [busquedaLog, setBusquedaLog] = useState('');
  const [modalDetalleLog, setModalDetalleLog] = useState(null);

  // Avisos de Vigencia LFT (dbo.LogAvisosVigenciaEnviados)
  const [logsAvisosVigencia, setLogsAvisosVigencia] = useState([]);
  const [loadingLogsAvisos, setLoadingLogsAvisos] = useState(false);
  const [filtroTipoAviso, setFiltroTipoAviso] = useState('TODOS');
  const [filtroEstatusAviso, setFiltroEstatusAviso] = useState('TODOS');
  const [busquedaAviso, setBusquedaAviso] = useState('');
  const [ejecutandoAvisos, setEjecutandoAvisos] = useState(false);
  const [resultadoAvisos, setResultadoAvisos] = useState(null);

  // Pestaña activa dentro del panel ('todas', 'contpaqi', 'email', 'avisos-vigencia', 'log-correos', 'vacaciones', 'mantenimiento')
  const [seccionActiva, setSeccionActiva] = useState('todas');

  // Valores de los formularios
  const [valores, setValores] = useState({
    // CONTPAQi
    CONTPAQI_SERVER: '192.168.20.15',
    CONTPAQI_PORT: '1433',
    CONTPAQI_DB_MATRIZ: 'Nomipaq',
    CONTPAQI_SYNC_AUTO: 'true',
    CONTPAQI_SYNC_HORA: '02:00',
    // EMAIL
    SMTP_HOST: '192.168.20.16',
    SMTP_PORT: '25',
    SMTP_USER: 'comprobante.fiscal@grupojamacfdi.com',
    SMTP_PASS: '',
    SMTP_SECURE: 'false',
    SMTP_FROM_NAME: 'Control de Vacaciones Grupo JAMA',
    SMTP_NOTIF_ENABLED: 'true',
    // AVISOS DE VIGENCIA LFT
    AVISOS_VIGENCIA_ENABLED: 'true',
    AVISOS_VIGENCIA_HORA: '08:00',
    AVISOS_VIGENCIA_ANIVERSARIO: 'true',
    AVISOS_VIGENCIA_12_MESES: 'true',
    AVISOS_VIGENCIA_15_MESES: 'true',
    AVISOS_VIGENCIA_18_MESES: 'true',
    AVISOS_VIGENCIA_COPIA_LIDER: 'true',
    AVISOS_VIGENCIA_COPIA_DO: 'true',
    AVISOS_VIGENCIA_EMAIL_DO: 'admin.rh@grupojama.com',
    // VACACIONES
    VAC_DIAS_AVISO_MINIMO: '15',
    VAC_MESES_CADUCIDAD_LFT: '18',
    VAC_BLOQUEO_SALDO_NEGATIVO: 'true',
    VAC_PERMITIR_MEDIOS_DIAS: 'false',
    VAC_HORA_CORTE_SOLICITUD: '17:00',
    // MANTENIMIENTO
    SYS_AUDITORIA_DIAS_RETENCION: '90',
    SYS_NAS_BACKUP_PATH: '\\\\192.168.20.20\\Backups\\Vacaciones',
    SYS_NAS_BACKUP_AUTO: 'true',
    SYS_LIMPIEZA_TOKENS_DIAS: '7'
  });

  const [mostrarPasswordSmtp, setMostrarPasswordSmtp] = useState(false);
  const [correoDestinoPrueba, setCorreoDestinoPrueba] = useState(currentUser?.email || currentUser?.Email || 'sistemas@grupojama.com.mx');
  const [cambiosPendientes, setCambiosPendientes] = useState(false);

  const rolUpper = String(currentUser?.rolApp || currentUser?.rol || '').toUpperCase();
  const usernameLower = String(currentUser?.username || '').toLowerCase();
  const esSistemas = rolUpper === 'SISTEMAS' || rolUpper === 'SUPERADMIN' || usernameLower === 'sistemas';
  const esAdminDO = rolUpper === 'ADMIN_DO' || usernameLower === 'admin.do' || usernameLower === 'admin_do';
  const esAutorizado = esSistemas || esAdminDO;

  useEffect(() => {
    if (esAutorizado) {
      cargarConfiguracion();
      cargarLogsCorreo();
      cargarLogsAvisosVigencia();
    } else {
      setLoading(false);
    }
  }, [esAutorizado]);

  async function cargarLogsCorreo(filtroOverride = null, busquedaOverride = null) {
    try {
      setLoadingLogs(true);
      const estatus = filtroOverride !== null ? filtroOverride : filtroEstatusLog;
      const busqueda = busquedaOverride !== null ? busquedaOverride : busquedaLog;

      const qParams = new URLSearchParams();
      qParams.set('limite', '100');
      if (estatus && estatus !== 'TODOS') qParams.set('estatus', estatus);
      if (busqueda && busqueda.trim()) qParams.set('busqueda', busqueda.trim());

      const res = await api.getLogCorreos(qParams.toString());
      if (res && res.success) {
        setLogsCorreo(res.data || []);
      }
    } catch (err) {
      console.error('Error al cargar log de auditoría de correos:', err);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function cargarLogsAvisosVigencia(tipoOverride = null, estatusOverride = null, busquedaOverride = null) {
    try {
      setLoadingLogsAvisos(true);
      const tipo = tipoOverride !== null ? tipoOverride : filtroTipoAviso;
      const estatus = estatusOverride !== null ? estatusOverride : filtroEstatusAviso;
      const busqueda = busquedaOverride !== null ? busquedaOverride : busquedaAviso;

      const qParams = new URLSearchParams();
      if (tipo && tipo !== 'TODOS') qParams.set('tipoAviso', tipo);
      if (estatus && estatus !== 'TODOS') qParams.set('estatus', estatus);
      if (busqueda && busqueda.trim()) qParams.set('busqueda', busqueda.trim());

      const res = await api.getLogsAvisosVigencia(qParams.toString());
      if (res && res.success) {
        setLogsAvisosVigencia(res.data || []);
      }
    } catch (err) {
      console.error('Error al cargar bitácora de avisos de vigencia:', err);
    } finally {
      setLoadingLogsAvisos(false);
    }
  }

  async function handleEjecutarBarridoAvisos(simular = false) {
    try {
      setEjecutandoAvisos(true);
      setResultadoAvisos(null);
      setMensajeError('');
      const res = await api.ejecutarAvisosVigencia({ simular, forzarEnvio: true });
      if (res && res.success) {
        setResultadoAvisos({
          tipo: 'exito',
          simulacion: simular,
          mensaje: res.mensaje,
          enviados: res.enviados,
          evaluados: res.evaluados,
          omitidos: res.omitidos,
          detalles: res.detalles
        });
        setMensajeExito(res.mensaje);
        cargarLogsAvisosVigencia();
      } else {
        setMensajeError(res.error || 'Error al ejecutar barrido de avisos de vigencia.');
      }
    } catch (err) {
      console.error('Error al ejecutar barrido:', err);
      setMensajeError('Error en servidor al procesar avisos: ' + err.message);
    } finally {
      setEjecutandoAvisos(false);
    }
  }

  async function cargarConfiguracion() {
    try {
      setLoading(true);
      setMensajeError('');
      const res = await api.getConfiguracionSistema();
      if (res.success && res.valores) {
        setValores(prev => ({
          ...prev,
          ...res.valores
        }));
        setCambiosPendientes(false);
      }
    } catch (err) {
      console.error('Error al cargar configuración:', err);
      setMensajeError('No se pudo cargar la configuración del sistema: ' + (err.message || 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(clave, valor) {
    setValores(prev => ({
      ...prev,
      [clave]: valor
    }));
    setCambiosPendientes(true);
  }

  async function handleGuardar(e) {
    if (e) e.preventDefault();
    try {
      setGuardando(true);
      setMensajeExito('');
      setMensajeError('');
      const res = await api.updateConfiguracionSistema({ valores });
      if (res.success) {
        setMensajeExito(res.message || 'Parámetros del sistema guardados exitosamente.');
        setCambiosPendientes(false);
        setTimeout(() => setMensajeExito(''), 6000);
      } else {
        setMensajeError(res.error || 'Ocurrió un error al guardar los parámetros.');
      }
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      setMensajeError('Error al guardar configuración: ' + (err.message || 'Error en servidor'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleProbarCorreo(e) {
    if (e) e.preventDefault();
    try {
      setProbandoCorreo(true);
      setResultadoPruebaCorreo(null);
      setMensajeError('');
      
      const payload = {
        host: valores.SMTP_HOST,
        port: valores.SMTP_PORT,
        user: valores.SMTP_USER,
        pass: valores.SMTP_PASS,
        secure: valores.SMTP_SECURE,
        fromName: valores.SMTP_FROM_NAME,
        destinatario: correoDestinoPrueba
      };

      const res = await api.probarCorreoSistema(payload);
      if (res.success) {
        setResultadoPruebaCorreo({
          tipo: 'exito',
          mensaje: res.message || 'Correo de prueba enviado con éxito.',
          detalles: res.detalles
        });
      } else {
        setResultadoPruebaCorreo({
          tipo: 'error',
          mensaje: res.error || 'Fallo en la comunicación con el servidor SMTP.',
          detalles: res.detalles
        });
      }
      cargarLogsCorreo();
    } catch (err) {
      console.error('Error probando correo:', err);
      setResultadoPruebaCorreo({
        tipo: 'error',
        mensaje: 'Error al ejecutar prueba SMTP: ' + (err.message || 'Tiempo de espera agotado')
      });
      cargarLogsCorreo();
    } finally {
      setProbandoCorreo(false);
    }
  }

  // Si el usuario no tiene rol SISTEMAS ni ADMIN_DO, bloquear acceso visual con 403
  if (!esAutorizado) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-base font-black text-slate-800 uppercase tracking-wider">
          Acceso Restringido • 403 Prohibido
        </h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          El <strong>Panel de Configuración Global</strong> está reservado exclusivamente para la administración institucional (<strong>SISTEMAS TI</strong> y <strong>DESARROLLO ORGANIZACIONAL</strong>) de Grupo JAMA.
        </p>
        <div className="mt-6">
          <button
            onClick={() => onNavigateTab ? onNavigateTab('colaborador') : window.location.href = '/'}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Regresar a Mi Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. ENCABEZADO PRINCIPAL DE LA VISTA */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
              esSistemas 
                ? 'bg-purple-100 text-purple-900 border-purple-200' 
                : 'bg-blue-100 text-blue-900 border-blue-200'
            }`}>
              {esSistemas ? 'Sistemas TI • SuperAdmin' : 'Desarrollo Organizacional • Admin DO'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-purple-600" />
              DESARROLLO_O (SQL Server)
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-purple-700" />
            Configuración Global del Sistema
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Parámetros de infraestructura centralizada, conectores CONTPAQi® Nóminas, relay SMTP institucional y políticas LFT.
          </p>
        </div>

        {/* Botones de Acción del Encabezado */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={cargarConfiguracion}
            disabled={loading || guardando}
            className="bg-white border border-slate-200/80 rounded-xl shadow-xs hover:shadow-sm text-xs font-semibold text-slate-700 px-3.5 py-2 inline-flex items-center gap-2 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            title="Recargar parámetros actuales desde la base de datos"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando...' : 'Recargar'}</span>
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer ${
              cambiosPendientes
                ? 'bg-purple-700 hover:bg-purple-800 text-white ring-2 ring-purple-400/40 animate-pulse'
                : 'bg-slate-900 hover:bg-black text-white'
            }`}
          >
            <Save className={`w-3.5 h-3.5 ${guardando ? 'animate-spin' : ''}`} />
            <span>{guardando ? 'Guardando...' : cambiosPendientes ? 'Guardar Cambios *' : 'Guardar Parámetros'}</span>
          </button>
        </div>
      </div>

      {/* 2. BANNERS DE MENSAJES DE ESTADO */}
      {mensajeExito && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{mensajeExito}</span>
        </div>
      )}

      {mensajeError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{mensajeError}</span>
        </div>
      )}

      {/* 3. BARRA DE PESTAÑAS DE FILTRO RÁPIDO */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'todas', label: 'Todas las Secciones', icono: Layers },
          { id: 'contpaqi', label: 'CONTPAQi® Nóminas', icono: Database },
          { id: 'email', label: 'Servidor Correo SMTP', icono: Mail },
          { id: 'avisos-vigencia', label: 'Avisos de Vigencia LFT', icono: Bell },
          { id: 'log-correos', label: 'Log de Auditoría de Envíos', icono: ShieldAlert },
          { id: 'vacaciones', label: 'Parámetros Vacaciones LFT', icono: Calendar },
          { id: 'mantenimiento', label: 'Mantenimiento & NAS', icono: HardDrive }
        ].map(tab => {
          const Icon = tab.icono;
          const activa = seccionActiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSeccionActiva(tab.id);
                if (tab.id === 'log-correos') cargarLogsCorreo();
                if (tab.id === 'avisos-vigencia') cargarLogsAvisosVigencia();
              }}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activa 
                  ? 'bg-purple-900 text-white shadow-xs' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activa ? 'text-purple-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleGuardar} className="space-y-6">

        {/* =========================================================================
            TARJETA 1: CONEXIÓN Y PARÁMETROS DE CONTPAQi® NÓMINAS
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'contpaqi') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">1. Conexión y Parámetros de CONTPAQi® Nóminas</h3>
                  <p className="text-[11px] text-slate-500">
                    Instancia local de SQL Server y base de datos matriz para sincronización de catálogos y kárdex.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Servicio Conectado
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Servidor SQL Nóminas (Host / IP)</span>
                  <span className="text-[10px] text-slate-400">Puerto 1433</span>
                </label>
                <input
                  type="text"
                  value={valores.CONTPAQI_SERVER}
                  onChange={(e) => handleInputChange('CONTPAQI_SERVER', e.target.value)}
                  placeholder="192.168.20.15"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Dirección de red del servidor de nóminas.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Puerto TCP SQL Server
                </label>
                <input
                  type="number"
                  value={valores.CONTPAQI_PORT}
                  onChange={(e) => handleInputChange('CONTPAQI_PORT', e.target.value)}
                  placeholder="1433"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Puerto estándar de escucha de Microsoft SQL Server.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Base de Datos Matriz / Catálogo
                </label>
                <input
                  type="text"
                  value={valores.CONTPAQI_DB_MATRIZ}
                  onChange={(e) => handleInputChange('CONTPAQI_DB_MATRIZ', e.target.value)}
                  placeholder="Nomipaq"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Base de datos con catálogo general de empresas.</p>
              </div>

              <div className="md:col-span-2 p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-700 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-blue-950 block">Sincronización Automática Diaria</span>
                    <span className="text-[11px] text-blue-800">Ejecuta la conciliación nocturna de colaboradores y altas de nómina.</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Hora:</span>
                    <input
                      type="time"
                      value={valores.CONTPAQI_SYNC_HORA}
                      onChange={(e) => handleInputChange('CONTPAQI_SYNC_HORA', e.target.value)}
                      className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={valores.CONTPAQI_SYNC_AUTO === 'true'}
                      onChange={(e) => handleInputChange('CONTPAQI_SYNC_AUTO', e.target.checked ? 'true' : 'false')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Acción Inmediata</span>
                  <span className="text-[11px] text-slate-400">Ir a bandeja de sincronización</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('sistemas') : null}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Abrir Panel TI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TARJETA 2: CONFIGURACIÓN DE NOTIFICACIONES POR CORREO (SMTP)
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'email') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">2. Configuración de Notificaciones por Correo (SMTP / Relay)</h3>
                  <p className="text-[11px] text-slate-500">
                    Servidor saliente para avisos de solicitudes, aprobaciones de jefes y resoluciones de DO.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <span className="text-[11px] text-slate-500">Envío de Correos:</span>
                <input
                  type="checkbox"
                  checked={valores.SMTP_NOTIF_ENABLED === 'true'}
                  onChange={(e) => handleInputChange('SMTP_NOTIF_ENABLED', e.target.checked ? 'true' : 'false')}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className={valores.SMTP_NOTIF_ENABLED === 'true' ? 'text-emerald-700' : 'text-slate-400'}>
                  {valores.SMTP_NOTIF_ENABLED === 'true' ? 'Habilitado' : 'Pausado'}
                </span>
              </label>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Servidor SMTP / Relay IP
                  </label>
                  <input
                    type="text"
                    value={valores.SMTP_HOST}
                    onChange={(e) => handleInputChange('SMTP_HOST', e.target.value)}
                    placeholder="192.168.20.29 o smtp.office365.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Host de Office 365, Google Workspace o Relay interno.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Puerto de Servicio
                  </label>
                  <select
                    value={valores.SMTP_PORT}
                    onChange={(e) => {
                      const p = e.target.value;
                      handleInputChange('SMTP_PORT', p);
                      if (p === '465') handleInputChange('SMTP_SECURE', 'true');
                      else handleInputChange('SMTP_SECURE', 'false');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                  >
                    <option value="587">587 (Recomendado - STARTTLS / Office 365)</option>
                    <option value="465">465 (SSL / TLS directo)</option>
                    <option value="25">25 (Relay local interno sin autenticación)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Puerto de escucha del transporte SMTP.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre del Remitente Institucional
                  </label>
                  <input
                    type="text"
                    value={valores.SMTP_FROM_NAME}
                    onChange={(e) => handleInputChange('SMTP_FROM_NAME', e.target.value)}
                    placeholder="Control de Vacaciones Grupo JAMA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Nombre que verán los colaboradores en su bandeja de entrada.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cuenta / Usuario Remitente
                  </label>
                  <input
                    type="email"
                    value={valores.SMTP_USER}
                    onChange={(e) => handleInputChange('SMTP_USER', e.target.value)}
                    placeholder="notificaciones@grupojama.com.mx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Dirección de correo autenticada.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Contraseña / Token de Aplicación</span>
                    <button
                      type="button"
                      onClick={() => setMostrarPasswordSmtp(!mostrarPasswordSmtp)}
                      className="text-[10px] text-purple-700 hover:text-purple-900 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {mostrarPasswordSmtp ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{mostrarPasswordSmtp ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </label>
                  <input
                    type={mostrarPasswordSmtp ? 'text' : 'password'}
                    value={valores.SMTP_PASS}
                    onChange={(e) => handleInputChange('SMTP_PASS', e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Dejar vacío si es un relay anónimo por IP.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Seguridad de Transporte
                  </label>
                  <select
                    value={valores.SMTP_SECURE}
                    onChange={(e) => handleInputChange('SMTP_SECURE', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                  >
                    <option value="false">STARTTLS (Estándar puerto 587)</option>
                    <option value="true">SSL Directo (Puerto 465)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Cifrado de la conexión con el servidor.</p>
                </div>
              </div>

              {/* MÓDULO DE PRUEBA DE ENVÍO SMTP */}
              <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-xl mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-purple-700" />
                      Prueba Interactiva de Envío SMTP
                    </h4>
                    <p className="text-[11px] text-purple-800 mt-0.5">
                      Envía un correo de validación con los parámetros ingresados para verificar la conectividad de red y credenciales.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={correoDestinoPrueba}
                      onChange={(e) => setCorreoDestinoPrueba(e.target.value)}
                      placeholder="correo@grupojama.com.mx"
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-600 outline-none w-56"
                    />
                    <button
                      type="button"
                      onClick={handleProbarCorreo}
                      disabled={probandoCorreo}
                      className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <RotateCw className={`w-3 h-3 ${probandoCorreo ? 'animate-spin' : ''}`} />
                      <span>{probandoCorreo ? 'Enviando...' : 'Probar Envío'}</span>
                    </button>
                  </div>
                </div>

                {resultadoPruebaCorreo && (
                  <div className={`mt-3 p-3 rounded-xl border text-xs ${
                    resultadoPruebaCorreo.tipo === 'exito'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {resultadoPruebaCorreo.tipo === 'exito' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>{resultadoPruebaCorreo.mensaje}</span>
                    </div>
                    {resultadoPruebaCorreo.detalles && (
                      <div className="text-[10px] font-mono text-slate-600 mt-1">
                        {JSON.stringify(resultadoPruebaCorreo.detalles)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TARJETA 3: CONFIGURACIÓN DE AVISOS Y NOTIFICACIONES DE VIGENCIA LFT
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'avisos-vigencia') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    3. Configuración de Avisos y Notificaciones de Vigencia
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automatización de felicitaciones de aniversario y alertas preventivas de caducidad a los 12, 15 y 18 meses (Art. 81 y 516 LFT).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                  valores.AVISOS_VIGENCIA_ENABLED === 'true'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${valores.AVISOS_VIGENCIA_ENABLED === 'true' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span>{valores.AVISOS_VIGENCIA_ENABLED === 'true' ? 'Automatización Activa' : 'Pausada'}</span>
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Controles Principales del Cron / Programador */}
              <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Envío Automático Diario de Avisos</h4>
                    <p className="text-[11px] text-slate-500">
                      Dispara la evaluación diaria en segundo plano de todos los colaboradores activos y envía los correos correspondientes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">Hora de Envío:</label>
                    <input
                      type="time"
                      value={valores.AVISOS_VIGENCIA_HORA || '08:00'}
                      onChange={(e) => handleInputChange('AVISOS_VIGENCIA_HORA', e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={valores.AVISOS_VIGENCIA_ENABLED === 'true'}
                      onChange={(e) => handleInputChange('AVISOS_VIGENCIA_ENABLED', e.target.checked ? 'true' : 'false')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* Matriz de los 4 Tipos de Avisos Parametrizables */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Tipos de Avisos Parametrizables (Regla de Envío Único por Ciclo)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aviso 1: Aniversario */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">🎉</span>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">1. Felicitación y Saldo de Nuevo Aniversario</h5>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold">Tipo: ANIVERSARIO_NUEVO</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={valores.AVISOS_VIGENCIA_ANIVERSARIO === 'true'}
                          onChange={(e) => handleInputChange('AVISOS_VIGENCIA_ANIVERSARIO', e.target.checked ? 'true' : 'false')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Envía un correo de felicitación por aniversario cumplido notificando los nuevos días por ley acreditados (Art. 76 LFT) y el nuevo ciclo de vigencia.
                    </p>
                  </div>

                  {/* Aviso 2: Alerta 12 Meses */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">⏳</span>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">2. Alerta Preventiva a los 12 Meses</h5>
                          <span className="text-[10px] font-mono text-blue-700 font-bold">Tipo: ALERTA_12_MESES (Restan 6 meses)</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={valores.AVISOS_VIGENCIA_12_MESES === 'true'}
                          onChange={(e) => handleInputChange('AVISOS_VIGENCIA_12_MESES', e.target.checked ? 'true' : 'false')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Avisa al colaborador que se cumplió 1 año del ciclo y le restan 6 meses conforme al Art. 81 LFT para disfrutar su saldo disponible.
                    </p>
                  </div>

                  {/* Aviso 3: Alerta 15 Meses */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition-all shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">3. Alerta Preventiva Urgente a los 15 Meses</h5>
                          <span className="text-[10px] font-mono text-amber-700 font-bold">Tipo: ALERTA_15_MESES (Restan 3 meses)</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={valores.AVISOS_VIGENCIA_15_MESES === 'true'}
                          onChange={(e) => handleInputChange('AVISOS_VIGENCIA_15_MESES', e.target.checked ? 'true' : 'false')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Recordatorio con cuenta regresiva indicando que restan solo 90 días para que venza el período, instando a programar fechas inmediatas.
                    </p>
                  </div>

                  {/* Aviso 4: Caducidad 18 Meses */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-rose-300 transition-all shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">🛑</span>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">4. Notificación de Caducidad a los 18 Meses</h5>
                          <span className="text-[10px] font-mono text-rose-700 font-bold">Tipo: CADUCIDAD_18_MESES (Término legal)</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={valores.AVISOS_VIGENCIA_18_MESES === 'true'}
                          onChange={(e) => handleInputChange('AVISOS_VIGENCIA_18_MESES', e.target.checked ? 'true' : 'false')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Notificación formal de conclusión de vigencia del período conforme a los Artículos 81 y 516 de la LFT.
                    </p>
                  </div>
                </div>
              </div>

              {/* Copias Institucionales (Líder / DO) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Enrutamiento de Copias Institucionales (CC)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={valores.AVISOS_VIGENCIA_COPIA_LIDER === 'true'}
                      onChange={(e) => handleInputChange('AVISOS_VIGENCIA_COPIA_LIDER', e.target.checked ? 'true' : 'false')}
                      className="mt-0.5 rounded text-purple-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Copiar al Líder / Jefe Directo</span>
                      <span className="text-[11px] text-slate-500">
                        Envía copia en las alertas de 12, 15 y 18 meses para coordinar los descansos de su equipo.
                      </span>
                    </div>
                  </label>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valores.AVISOS_VIGENCIA_COPIA_DO === 'true'}
                        onChange={(e) => handleInputChange('AVISOS_VIGENCIA_COPIA_DO', e.target.checked ? 'true' : 'false')}
                        className="rounded text-purple-600"
                      />
                      <span className="text-xs font-bold text-slate-900">Copiar a Desarrollo Organizacional</span>
                    </label>
                    <input
                      type="email"
                      value={valores.AVISOS_VIGENCIA_EMAIL_DO || ''}
                      onChange={(e) => handleInputChange('AVISOS_VIGENCIA_EMAIL_DO', e.target.value)}
                      placeholder="admin.rh@grupojama.com"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </div>
              </div>

              {/* Barra de Acciones Inmediatas (Simular / Ejecutar Manual) */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Bitácora activa: <code className="text-slate-600 font-bold">dbo.LogAvisosVigenciaEnviados</code> ({logsAvisosVigencia.length} registros auditados)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEjecutarBarridoAvisos(true)}
                    disabled={ejecutandoAvisos}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Evalúa cuántos avisos se enviarían hoy sin emitir correos reales"
                  >
                    <Search className={`w-3.5 h-3.5 ${ejecutandoAvisos ? 'animate-spin' : ''}`} />
                    <span>Simular Detección</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEjecutarBarridoAvisos(false)}
                    disabled={ejecutandoAvisos}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${ejecutandoAvisos ? 'animate-spin' : ''}`} />
                    <span>{ejecutandoAvisos ? 'Procesando Barrido...' : 'Ejecutar Barrido Manual Ahora'}</span>
                  </button>
                </div>
              </div>

              {/* Resultado del Barrido Manual / Simulación */}
              {resultadoAvisos && (
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 text-xs text-purple-950 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      {resultadoAvisos.simulacion ? 'Resultado de la Simulación:' : 'Resultado del Barrido en Vivo:'}
                    </span>
                    <button type="button" onClick={() => setResultadoAvisos(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <p className="text-slate-700">{resultadoAvisos.mensaje}</p>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-purple-100">
                      Evaluados: <strong>{resultadoAvisos.evaluados}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-purple-100 text-emerald-700">
                      Por enviar / Enviados: <strong>{resultadoAvisos.enviados}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-purple-100 text-slate-500">
                      Omitidos (ya enviados): <strong>{resultadoAvisos.omitidos}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Bitácora Integrada de dbo.LogAvisosVigenciaEnviados */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                    Auditoría de Avisos Registrados (dbo.LogAvisosVigenciaEnviados)
                  </h4>

                  {/* Filtro y Buscador */}
                  <div className="flex items-center gap-2">
                    <select
                      value={filtroTipoAviso}
                      onChange={(e) => {
                        setFiltroTipoAviso(e.target.value);
                        cargarLogsAvisosVigencia(e.target.value, null, null);
                      }}
                      className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg outline-none text-slate-700"
                    >
                      <option value="TODOS">Todos los Tipos</option>
                      <option value="ANIVERSARIO_NUEVO">Aniversario Nuevo</option>
                      <option value="ALERTA_12_MESES">Alerta 12 Meses</option>
                      <option value="ALERTA_15_MESES">Alerta 15 Meses</option>
                      <option value="CADUCIDAD_18_MESES">Caducidad 18 Meses</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => cargarLogsAvisosVigencia()}
                      disabled={loadingLogsAvisos}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      title="Refrescar bitácora"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${loadingLogsAvisos ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Tabla de Registros */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Fecha Envío</th>
                        <th className="py-2.5 px-3">Colaborador</th>
                        <th className="py-2.5 px-3">Período</th>
                        <th className="py-2.5 px-3">Tipo Aviso</th>
                        <th className="py-2.5 px-3 text-center">Días Restantes</th>
                        <th className="py-2.5 px-3">Destinatario</th>
                        <th className="py-2.5 px-3 text-right">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingLogsAvisos ? (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-400">
                            <RotateCw className="w-4 h-4 animate-spin mx-auto mb-1 text-purple-600" />
                            Consultando bitácora de avisos...
                          </td>
                        </tr>
                      ) : logsAvisosVigencia.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-400">
                            No se han registrado envíos de avisos de vigencia aún.
                          </td>
                        </tr>
                      ) : (
                        logsAvisosVigencia.map((l) => {
                          const badge = l.TipoAviso === 'ANIVERSARIO_NUEVO'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : l.TipoAviso === 'ALERTA_15_MESES'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : l.TipoAviso === 'CADUCIDAD_18_MESES'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200';

                          return (
                            <tr key={l.IdLogAviso} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {formatearFechaHora(l.FechaEnvio)}
                              </td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-slate-900 block">{l.ColaboradorNombre}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{l.CodigoEmpleado} • {l.Empresa}</span>
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                                {l.Periodo}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
                                  {l.TipoAviso}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-slate-700">
                                {l.DiasRestantesAlerta} d
                              </td>
                              <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-[160px]" title={l.Destinatario}>
                                {l.Destinatario}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  l.EstatusEnvio === 'ENVIADO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : l.EstatusEnvio === 'SIMULADO'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {l.EstatusEnvio}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TARJETA 4: PARÁMETROS GENERALES DE VACACIONES LFT
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'vacaciones') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">4. Parámetros Generales de Vacaciones LFT</h3>
                  <p className="text-[11px] text-slate-500">
                    Reglas operativas, anticipación obligatoria y políticas conforme a la Ley Federal del Trabajo (Vacaciones Dignas).
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                LFT 2023+
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Anticipación Mínima de Aviso</span>
                  <span className="text-[10px] text-slate-400">Días naturales</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={valores.VAC_DIAS_AVISO_MINIMO}
                    onChange={(e) => handleInputChange('VAC_DIAS_AVISO_MINIMO', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    días
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Días previos requeridos para que el colaborador solicite.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Vigencia Legal de Período (LFT)</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Art. 81 LFT</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="6"
                    max="36"
                    value={valores.VAC_MESES_CADUCIDAD_LFT}
                    onChange={(e) => handleInputChange('VAC_MESES_CADUCIDAD_LFT', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    meses
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Meses posteriores al aniversario antes de vencer el saldo.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hora de Corte para Mismo Día
                </label>
                <input
                  type="time"
                  value={valores.VAC_HORA_CORTE_SOLICITUD}
                  onChange={(e) => handleInputChange('VAC_HORA_CORTE_SOLICITUD', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Límite horario para cómputo de días laborales.</p>
              </div>

              <div className="md:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Bloquear Solicitudes que Excedan Saldo Disponible</span>
                  <span className="text-[11px] text-slate-500">Impide que los colaboradores soliciten más días de los que tienen acumulados en LFT.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={valores.VAC_BLOQUEO_SALDO_NEGATIVO === 'true'}
                    onChange={(e) => handleInputChange('VAC_BLOQUEO_SALDO_NEGATIVO', e.target.checked ? 'true' : 'false')}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Permitir Medios Días</span>
                  <span className="text-[11px] text-slate-500">Fraccionamiento por turnos</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={valores.VAC_PERMITIR_MEDIOS_DIAS === 'true'}
                    onChange={(e) => handleInputChange('VAC_PERMITIR_MEDIOS_DIAS', e.target.checked ? 'true' : 'false')}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TARJETA 4: AUDITORÍA Y MANTENIMIENTO DE INFRAESTRUCTURA
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'mantenimiento') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">5. Auditoría, Mantenimiento & Synology NAS</h3>
                  <p className="text-[11px] text-slate-500">
                    Depuración de bitácoras, respaldo en red local NAS y políticas de sesiones.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Almacenamiento Local
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ruta de Almacenamiento en Synology NAS (SMB)
                </label>
                <input
                  type="text"
                  value={valores.SYS_NAS_BACKUP_PATH}
                  onChange={(e) => handleInputChange('SYS_NAS_BACKUP_PATH', e.target.value)}
                  placeholder="\\192.168.20.20\Backups\Vacaciones"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Recurso de red compartido para volcados .BAK y exportaciones.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Días de Retención en Bitácora de Auditoría</span>
                  <span className="text-[10px] text-slate-400">HistorialAprobaciones</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="30"
                    max="365"
                    value={valores.SYS_AUDITORIA_DIAS_RETENCION}
                    onChange={(e) => handleInputChange('SYS_AUDITORIA_DIAS_RETENCION', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    días
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Tiempo antes de archivar registros de accesos y aprobaciones.</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Respaldo Automático Nocturno</span>
                  <span className="text-[11px] text-slate-500">Copia de seguridad en Synology NAS programada</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={valores.SYS_NAS_BACKUP_AUTO === 'true'}
                    onChange={(e) => handleInputChange('SYS_NAS_BACKUP_AUTO', e.target.checked ? 'true' : 'false')}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Purgar Tokens de Sesión Expirados</span>
                  <span className="text-[11px] text-slate-500">Retención máxima: {valores.SYS_LIMPIEZA_TOKENS_DIAS} días</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Activo
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TARJETA 5: BITÁCORA Y LOG DE AUDITORÍA DE ENVÍOS DE CORREO
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'log-correos') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">5. Log de Auditoría de Envíos de Correo</h3>
                  <p className="text-[11px] text-slate-500">
                    Trazabilidad histórica de notificaciones emitidas, estatus de entrega y modo de pruebas (dbo.LogCorreosEnviados).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cargarLogsCorreo()}
                  disabled={loadingLogs}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Actualizar registros del log"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>{loadingLogs ? 'Actualizando...' : 'Refrescar'}</span>
                </button>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <Check className="w-3 h-3 text-purple-600" />
                  Auditoría TI Activa
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* METRIC CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Notificaciones</span>
                    <Mail className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">{logsCorreo.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Últimos registros en bitácora</div>
                </div>

                {/* Exitosos */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                  <div className="flex items-center justify-between text-emerald-700 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Entregados (Éxito)</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-900">
                    {logsCorreo.filter(l => l.estatusEnvio === 'EXITO').length}
                  </div>
                  <div className="text-[10px] text-emerald-700/80 mt-0.5">Aceptados por relay SMTP</div>
                </div>

                {/* Fallidos */}
                <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-xl">
                  <div className="flex items-center justify-between text-rose-700 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Fallidos (Error)</span>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-xl font-black text-rose-900">
                    {logsCorreo.filter(l => l.estatusEnvio === 'ERROR').length}
                  </div>
                  <div className="text-[10px] text-rose-700/80 mt-0.5">Rechazos de conexión / DNS</div>
                </div>

                {/* Sandbox / Redirigidos */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl">
                  <div className="flex items-center justify-between text-amber-800 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Sandbox / Auditoría</span>
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-xl font-black text-amber-950">
                    {logsCorreo.filter(l => l.destinatarioEfectivo && l.destinatarioOriginal && 
                      (l.destinatarioEfectivo.toLowerCase() !== l.destinatarioOriginal.toLowerCase() || 
                       l.destinatarioEfectivo.toLowerCase().includes('soporte@grupojama'))).length}
                  </div>
                  <div className="text-[10px] text-amber-800/80 mt-0.5">Redirigidos a Soporte TI</div>
                </div>
              </div>

              {/* SEARCH & FILTERS BAR */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={busquedaLog}
                      onChange={(e) => setBusquedaLog(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cargarLogsCorreo(); } }}
                      placeholder="Buscar por folio (#SOL-...), correo destinatario o asunto..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                    {busquedaLog && (
                      <button
                        type="button"
                        onClick={() => { setBusquedaLog(''); cargarLogsCorreo(filtroEstatusLog, ''); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => cargarLogsCorreo()}
                    className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs"
                  >
                    Buscar
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filtroEstatusLog}
                    onChange={(e) => {
                      setFiltroEstatusLog(e.target.value);
                      cargarLogsCorreo(e.target.value, busquedaLog);
                    }}
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer"
                  >
                    <option value="TODOS">Todos los Estatus</option>
                    <option value="EXITO">Solo Éxito (EXITO)</option>
                    <option value="ERROR">Solo Fallidos (ERROR)</option>
                  </select>
                </div>
              </div>

              {/* TABLA DE AUDITORÍA */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Fecha y Hora</th>
                      <th className="px-4 py-3">Evento / Tipo</th>
                      <th className="px-4 py-3">Folio</th>
                      <th className="px-4 py-3">Destinatario (Original → Efectivo)</th>
                      <th className="px-4 py-3">Asunto</th>
                      <th className="px-4 py-3 text-center">Estatus</th>
                      <th className="px-4 py-3 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-10 text-center text-slate-400">
                          <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                          <span>Cargando bitácora de auditoría...</span>
                        </td>
                      </tr>
                    ) : logsCorreo.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                          <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">No se encontraron registros de auditoría</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {busquedaLog || filtroEstatusLog !== 'TODOS'
                              ? 'Intente modificar los filtros de búsqueda.'
                              : 'Aún no se han registrado envíos de correo en dbo.LogCorreosEnviados.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      logsCorreo.map((log) => {
                        const badge = getTipoEventoBadge(log.tipoEvento);
                        const esSandbox = log.destinatarioEfectivo && log.destinatarioOriginal && 
                          (log.destinatarioEfectivo.toLowerCase() !== log.destinatarioOriginal.toLowerCase() ||
                           log.destinatarioEfectivo.toLowerCase().includes('soporte@grupojama'));

                        return (
                          <tr key={log.idLog} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 text-[11px] font-mono text-slate-600 whitespace-nowrap">
                              {formatearFechaHora(log.fechaEnvio)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                              {log.folioSolicitud ? (
                                <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                  {log.folioSolicitud}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {esSandbox ? (
                                <div className="space-y-0.5">
                                  <div className="text-[11px] text-slate-400 font-mono line-through truncate max-w-xs" title={log.destinatarioOriginal}>
                                    {log.destinatarioOriginal}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple-900 font-bold">
                                    <span className="text-purple-500">→</span>
                                    <span className="truncate max-w-xs" title={log.destinatarioEfectivo}>{log.destinatarioEfectivo}</span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                      Sandbox
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs font-mono text-slate-700 truncate max-w-xs block" title={log.destinatarioEfectivo || log.destinatarioOriginal}>
                                  {log.destinatarioEfectivo || log.destinatarioOriginal}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.asunto}>
                              {log.asunto}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {log.estatusEnvio === 'EXITO' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  ÉXITO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  ERROR
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setModalDetalleLog(log)}
                                className="px-2.5 py-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg text-xs font-semibold transition border border-slate-200 hover:border-purple-200 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detalle</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 6. BOTÓN FLOTANTE / INFERIOR DE GUARDADO (OCULTO EN PESTAÑA LOGS) */}
        {seccionActiva !== 'log-correos' && (
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Todos los cambios quedan registrados con fecha, hora y usuario en dbo.ConfiguracionSistema.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={cargarConfiguracion}
                disabled={loading || guardando}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancelar / Descartar
              </button>
              <button
                type="submit"
                disabled={guardando || loading}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save className={`w-3.5 h-3.5 ${guardando ? 'animate-spin' : ''}`} />
                <span>{guardando ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
              </button>
            </div>
          </div>
        )}

      </form>

      {/* MODAL DE DETALLE TÉCNICO DE AUDITORÍA */}
      {modalDetalleLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* HEADER */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Detalle Técnico de Notificación #{modalDetalleLog.idLog}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Registro auditado en dbo.LogCorreosEnviados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDetalleLog(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* BANNER STATUS */}
              {modalDetalleLog.estatusEnvio === 'EXITO' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Notificación procesada y aceptada por el servidor SMTP.</span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">El mensaje fue entregado al canal de transporte sin errores.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Fallo en la comunicación con el servidor SMTP.</span>
                    <p className="text-[11px] text-rose-700 mt-0.5">El servidor rechazó o no pudo completar la entrega del correo.</p>
                  </div>
                </div>
              )}

              {/* METADATA GRID */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">Fecha y Hora de Registro:</span>
                  <span className="font-mono text-slate-800 font-bold">{formatearFechaHora(modalDetalleLog.fechaEnvio)}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">Tipo de Evento:</span>
                  <span className="font-bold text-slate-800">{modalDetalleLog.tipoEvento}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">Folio de Solicitud:</span>
                  <span className="font-mono font-bold text-purple-700">{modalDetalleLog.folioSolicitud || 'N/A (Prueba TI)'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">Estatus de Envío:</span>
                  <span className={`font-bold ${modalDetalleLog.estatusEnvio === 'EXITO' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {modalDetalleLog.estatusEnvio}
                  </span>
                </div>

                <div className="md:col-span-2 border-t border-slate-200/80 pt-2.5">
                  <span className="text-[11px] text-slate-400 block font-semibold">Destinatario Previsto (Original):</span>
                  <span className="font-mono text-slate-800 break-all">{modalDetalleLog.destinatarioOriginal}</span>
                </div>

                <div className="md:col-span-2">
                  <span className="text-[11px] text-slate-400 block font-semibold">Destinatario Real (Efectivo):</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-purple-950 break-all">{modalDetalleLog.destinatarioEfectivo}</span>
                    {modalDetalleLog.destinatarioEfectivo !== modalDetalleLog.destinatarioOriginal && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                        Modo Auditoría / Sandbox
                      </span>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 border-t border-slate-200/80 pt-2.5">
                  <span className="text-[11px] text-slate-400 block font-semibold">Asunto del Correo:</span>
                  <span className="font-medium text-slate-900">{modalDetalleLog.asunto}</span>
                </div>

                {modalDetalleLog.messageId && (
                  <div className="md:col-span-2">
                    <span className="text-[11px] text-slate-400 block font-semibold">RFC 2822 Message-ID:</span>
                    <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 block break-all select-all">
                      {modalDetalleLog.messageId}
                    </span>
                  </div>
                )}
              </div>

              {/* ERROR TRACE IF ANY */}
              {modalDetalleLog.mensajeError && (
                <div>
                  <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Traza Técnica del Error Reportado:</span>
                  </label>
                  <pre className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-mono text-rose-950 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {modalDetalleLog.mensajeError}
                  </pre>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalDetalleLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
