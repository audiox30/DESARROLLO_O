import React, { useState, useEffect } from 'react';
import { 
  Settings, Database, Mail, Calendar, HardDrive, 
  RotateCw, Save, CheckCircle, AlertCircle, Send, 
  Eye, EyeOff, ShieldAlert, Check, Server, Clock, 
  Layers, Lock, AlertTriangle, Terminal, Cpu
} from 'lucide-react';
import { api } from '../api/client';

export default function AdminConfiguracionPage({ currentUser, onNavigateTab }) {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probandoCorreo, setProbandoCorreo] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [resultadoPruebaCorreo, setResultadoPruebaCorreo] = useState(null);

  // Pestaña activa dentro del panel ('todas', 'contpaqi', 'email', 'vacaciones', 'mantenimiento')
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
    SMTP_HOST: 'smtp.office365.com',
    SMTP_PORT: '587',
    SMTP_USER: 'notificaciones@grupojama.com.mx',
    SMTP_PASS: '',
    SMTP_SECURE: 'false',
    SMTP_FROM_NAME: 'Control de Vacaciones Grupo JAMA',
    SMTP_NOTIF_ENABLED: 'true',
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

  const esSistemas = currentUser?.rolApp === 'SISTEMAS' || currentUser?.rolApp === 'SUPERADMIN' ||
    currentUser?.rol === 'SISTEMAS' || currentUser?.rol === 'SUPERADMIN' ||
    currentUser?.username === 'sistemas';

  useEffect(() => {
    if (esSistemas) {
      cargarConfiguracion();
    }
  }, [esSistemas]);

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
    } catch (err) {
      console.error('Error probando correo:', err);
      setResultadoPruebaCorreo({
        tipo: 'error',
        mensaje: 'Error al ejecutar prueba SMTP: ' + (err.message || 'Tiempo de espera agotado')
      });
    } finally {
      setProbandoCorreo(false);
    }
  }

  // Si el usuario no tiene rol SISTEMAS, bloquear acceso visual con 403
  if (!esSistemas) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-base font-black text-slate-800 uppercase tracking-wider">
          Acceso Restringido • 403 Prohibido
        </h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          El <strong>Panel de Configuración Global</strong> está reservado exclusivamente para la cuenta maestra y administradores con rol oficial <strong>SISTEMAS (TI)</strong> de Grupo JAMA.
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-100 text-purple-900 border border-purple-200">
              Sistemas TI • SuperAdmin
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
          { id: 'vacaciones', label: 'Parámetros Vacaciones LFT', icono: Calendar },
          { id: 'mantenimiento', label: 'Mantenimiento & NAS', icono: HardDrive }
        ].map(tab => {
          const Icon = tab.icono;
          const activa = seccionActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSeccionActiva(tab.id)}
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
                    placeholder="smtp.office365.com o 192.168.20.x"
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
            TARJETA 3: PARÁMETROS GENERALES DE VACACIONES LFT
           ========================================================================= */}
        {(seccionActiva === 'todas' || seccionActiva === 'vacaciones') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">3. Parámetros Generales de Vacaciones LFT</h3>
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
                  <h3 className="text-sm font-bold text-slate-800">4. Auditoría, Mantenimiento & Synology NAS</h3>
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

        {/* 4. BOTÓN FLOTANTE / INFERIOR DE GUARDADO */}
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

      </form>

    </div>
  );
}
