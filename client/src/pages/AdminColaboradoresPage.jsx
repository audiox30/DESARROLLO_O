import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, Search, Filter, RefreshCw, KeyRound, Edit3, 
  ShieldCheck, AlertCircle, CheckCircle2, X, Phone, Heart, 
  Clock, Shield, ArrowUpDown, Copy, Check, Baby, Eye, Trash2, Plus, Calendar,
  ChevronDown, ChevronUp, Lock, Building2, User, CreditCard, Briefcase, Mail, MapPin,
  Sliders, Upload
} from 'lucide-react';
import { api } from '../api/client';
import ModalCargaMasivaSaldos from '../components/ModalCargaMasivaSaldos';
import SeccionAjusteSaldo from '../components/SeccionAjusteSaldo';
import { 
  formatearNombreColaborador, 
  formatearEtiquetaSelector, 
  compararPorApellidos,
  obtenerInicialesColaborador,
  desglosarNombre
} from '../utils/formatters';

function calcularAntiguedad(fechaAltaStr) {
  if (!fechaAltaStr) return '';
  const d = new Date(fechaAltaStr);
  if (isNaN(d.getTime())) return '';
  const hoy = new Date();
  let anios = hoy.getFullYear() - d.getFullYear();
  let meses = hoy.getMonth() - d.getMonth();
  if (meses < 0 || (meses === 0 && hoy.getDate() < d.getDate())) {
    anios--;
    meses += 12;
  }
  if (anios > 0) {
    return `${anios} ${anios === 1 ? 'año' : 'años'}${meses > 0 ? `, ${meses} m` : ''}`;
  }
  return `${Math.max(1, meses)} ${meses <= 1 ? 'mes' : 'meses'}`;
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return '—';
  try {
    const s = String(fechaStr).substring(0, 10);
    const [y, m, d] = s.split('-');
    if (y && m && d && y.length === 4) {
      return `${d}/${m}/${y}`;
    }
    const dateObj = new Date(fechaStr);
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('es-MX');
  } catch (e) {
    return '—';
  }
}

function CampoSoloLectura({ label, valor, icono: Icono = Lock, monospace = false, placeholderVacio = '—' }) {
  const tieneValor = valor !== null && valor !== undefined && String(valor).trim() !== '' && String(valor).trim() !== '—';
  const textoAMostrar = tieneValor ? valor : placeholderVacio;
  const esVacio = !tieneValor;

  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1.5">
        <Icono className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="truncate">{label}</span>
      </label>
      <div className="relative">
        <input
          type="text"
          readOnly
          value={textoAMostrar}
          title={tieneValor ? "Dato oficial sincronizado desde CONTPAQi Nóminas (Solo lectura)" : "Sin dato registrado en nómina"}
          className={`w-full px-3 py-2 bg-slate-100/90 border border-slate-200/90 rounded-xl text-xs outline-none cursor-not-allowed select-all ${
            esVacio ? 'text-slate-400 italic font-medium' : 'text-slate-700 font-semibold'
          } ${
            monospace && tieneValor ? 'font-mono' : ''
          }`}
        />
        <Lock className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
      </div>
    </div>
  );
}

const OPCIONES_DIAS_SEMANA = [
  { id: 'LUNES', label: 'Lunes' },
  { id: 'MARTES', label: 'Martes' },
  { id: 'MIERCOLES', label: 'Miércoles' },
  { id: 'JUEVES', label: 'Jueves' },
  { id: 'VIERNES', label: 'Viernes' },
  { id: 'SABADO', label: 'Sábado' },
  { id: 'DOMINGO', label: 'Domingo', esEstandar: true }
];

function parseDiasDescanso(val) {
  if (!val) return ['DOMINGO'];
  let tokens = [];
  if (Array.isArray(val)) {
    tokens = val;
  } else if (typeof val === 'string') {
    if (val.trim().startsWith('[') && val.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) tokens = parsed;
      } catch (e) {}
    }
    if (tokens.length === 0) {
      tokens = val.split(/[,;\/yY]+/);
    }
  }

  const selected = new Set();
  for (let raw of tokens) {
    const norm = String(raw).trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes('DOM')) selected.add('DOMINGO');
    else if (norm.includes('LUN')) selected.add('LUNES');
    else if (norm.includes('MAR')) selected.add('MARTES');
    else if (norm.includes('MIE')) selected.add('MIERCOLES');
    else if (norm.includes('JUE')) selected.add('JUEVES');
    else if (norm.includes('VIE')) selected.add('VIERNES');
    else if (norm.includes('SAB')) selected.add('SABADO');
  }

  if (selected.size === 0) {
    selected.add('DOMINGO');
  }

  return OPCIONES_DIAS_SEMANA.filter(d => selected.has(d.id)).map(d => d.id);
}

function SelectorDiasDescanso({ value = ['DOMINGO'], onChange, disabled = false }) {
  const [abierto, setAbierto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const seleccionados = Array.isArray(value) && value.length > 0 ? value : ['DOMINGO'];

  function toggleDia(id) {
    if (disabled) return;
    let nuevo;
    if (seleccionados.includes(id)) {
      nuevo = seleccionados.filter(d => d !== id);
    } else {
      nuevo = [...seleccionados, id];
    }
    // Si no se selecciona ninguno, mantener al menos Domingo por defecto
    if (nuevo.length === 0) {
      nuevo = ['DOMINGO'];
    } else {
      nuevo = OPCIONES_DIAS_SEMANA.filter(d => nuevo.includes(d.id)).map(d => d.id);
    }
    onChange(nuevo);
  }

  function aplicarPreset(preset) {
    if (disabled) return;
    if (preset === 'DOMINGO') {
      onChange(['DOMINGO']);
    } else if (preset === 'SAB_DOM') {
      onChange(['SABADO', 'DOMINGO']);
    }
  }

  const esSoloDomingo = seleccionados.length === 1 && seleccionados[0] === 'DOMINGO';
  const esSabDom = seleccionados.length === 2 && seleccionados.includes('SABADO') && seleccionados.includes('DOMINGO');

  return (
    <div className="relative" ref={containerRef}>
      {/* Botón trigger cerrado */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setAbierto(!abierto)}
        className={`w-full min-h-[40px] px-3 py-1.5 ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-90' : 'bg-slate-50 hover:bg-slate-100/70 cursor-pointer'} border border-slate-300 rounded-xl text-left flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-600 outline-none transition`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 py-0.5">
          {seleccionados.map(id => {
            const opt = OPCIONES_DIAS_SEMANA.find(o => o.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100/80 text-blue-800 text-[11px] font-bold border border-blue-200"
              >
                {opt ? opt.label : id}
              </span>
            );
          })}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {/* Menú Desplegable con Checklist */}
      {abierto && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-100">
          {/* Cabecera con Presets Rápidos */}
          <div className="pb-2.5 mb-2 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Opciones Rápidas (Presets)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => aplicarPreset('DOMINGO')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  esSoloDomingo 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Solo Domingo (JAMA)
              </button>
              <button
                type="button"
                onClick={() => aplicarPreset('SAB_DOM')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  esSabDom 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Sábado y Domingo
              </button>
            </div>
          </div>

          {/* Checklist de los 7 días */}
          <div className="space-y-1 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Seleccionar Días de Descanso Semanal:
            </span>
            {OPCIONES_DIAS_SEMANA.map(dia => {
              const estaMarcado = seleccionados.includes(dia.id);
              return (
                <div
                  key={dia.id}
                  onClick={() => toggleDia(dia.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer select-none ${
                    estaMarcado 
                      ? 'bg-blue-50/80 text-blue-900 font-bold' 
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={estaMarcado}
                      onChange={() => {}} // Manejado por el click en fila
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer pointer-events-none"
                    />
                    <span>{dia.label}</span>
                  </div>
                  {dia.esEstandar && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      Estándar LFT
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Informativo */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">
              {seleccionados.length} día(s) inhábil(es) semanal(es)
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 'No especificada';
  try {
    const nacimiento = new Date(fechaNacimiento);
    if (isNaN(nacimiento.getTime())) return 'No especificada';
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    if (edad <= 0) {
      const meses = Math.max(0, (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + hoy.getMonth() - nacimiento.getMonth());
      return meses === 1 ? '1 mes' : `${meses} meses`;
    }
    return `${edad} ${edad === 1 ? 'año' : 'años'}`;
  } catch (e) {
    return 'No especificada';
  }
}
export default function AdminColaboradoresPage({ currentUser }) {
  const userActual = currentUser || JSON.parse(localStorage.getItem('jama_vacaciones_user') || '{}');
  const esAdminDO = userActual?.rolApp === 'ADMIN_DO' || userActual?.rolApp === 'SUPERADMIN' || userActual?.rolApp === 'SISTEMAS' || userActual?.rol === 'ADMIN_DO' || userActual?.rol === 'SUPERADMIN' || userActual?.rol === 'SISTEMAS' || userActual?.username === 'sistemas';

  const [colaboradores, setColaboradores] = useState([]);
  const [todosLosJefes, setTodosLosJefes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [estatus, setEstatus] = useState('activos');

  // Modales
  const [colabEditar, setColabEditar] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [formEditar, setFormEditar] = useState({});
  const [guardandoEditar, setGuardandoEditar] = useState(false);
  const [errorEditar, setErrorEditar] = useState('');
  const [acordeonNominaAbierto, setAcordeonNominaAbierto] = useState(true);
  const [pestanaModal, setPestanaModal] = useState('general'); // 'general' | 'ajuste_saldo'
  const [mostrarModalCargaMasiva, setMostrarModalCargaMasiva] = useState(false);

  // Modal Ficha Completa
  const [colabFicha, setColabFicha] = useState(null);
  const [fichaData, setFichaData] = useState(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  const [colabReset, setColabReset] = useState(null);
  const [passwordManual, setPasswordManual] = useState('');
  const [resetResult, setResetResult] = useState(null);
  const [guardandoReset, setGuardandoReset] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal de Hijos
  const [colabHijos, setColabHijos] = useState(null);
  const [hijosList, setHijosList] = useState([]);
  const [loadingHijos, setLoadingHijos] = useState(false);
  const [guardandoHijo, setGuardandoHijo] = useState(false);
  const [errorHijos, setErrorHijos] = useState('');
  const [nuevoHijo, setNuevoHijo] = useState({
    nombre: '',
    fechaNacimiento: '',
    sexo: 'M'
  });

  // Toast
  const [toast, setToast] = useState('');

  // Sincronización CONTPAQi Nóminas
  const [sincronizando, setSincronizando] = useState(false);
  const pollSyncRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollSyncRef.current) clearInterval(pollSyncRef.current);
    };
  }, []);

  const FALLBACK_EMPRESAS = [
    { idEmpresa: 1, aliasEmpresa: 'Cementos Moctezuma' },
    { idEmpresa: 2, aliasEmpresa: 'Construjama' },
    { idEmpresa: 3, aliasEmpresa: 'Controladora JAMA' },
    { idEmpresa: 4, aliasEmpresa: 'Distribuidor del Centro' },
    { idEmpresa: 5, aliasEmpresa: 'Distribuidora JAMA' },
    { idEmpresa: 6, aliasEmpresa: 'Impulsora de Negocios' },
    { idEmpresa: 7, aliasEmpresa: 'Latino Concretos' },
    { idEmpresa: 8, aliasEmpresa: 'Tramo del Centro' }
  ];

  const [empresasCatalog, setEmpresasCatalog] = useState(FALLBACK_EMPRESAS);

  useEffect(() => {
    async function fetchEmpresas() {
      try {
        const res = await api.getEmpresas();
        if (res.success && res.data && res.data.length > 0) {
          setEmpresasCatalog(res.data);
        }
      } catch (err) {
        console.warn('Usando catálogo estático de empresas en Admin:', err);
      }
    }
    fetchEmpresas();
  }, []);

  useEffect(() => {
    cargarColaboradores();
  }, [page, empresa, departamento, sucursal, estatus]);

  useEffect(() => {
    cargarCatalogoJefes();
  }, []);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  }

  async function handleSincronizarContpaqi() {
    if (sincronizando) return;
    try {
      setSincronizando(true);
      const res = await api.sincronizarEmpleados();
      if (res.success && res.taskId) {
        mostrarToast('Sincronización con CONTPAQi® Nóminas iniciada en segundo plano...');
        let pollCount = 0;
        const maxPolls = 60; // 60 * 1.5s = 90 segundos máximo de espera
        pollSyncRef.current = setInterval(async () => {
          pollCount++;
          if (pollCount > maxPolls) {
            clearInterval(pollSyncRef.current);
            setSincronizando(false);
            mostrarToast('La sincronización sigue procesándose en segundo plano.');
            cargarColaboradores();
            return;
          }
          try {
            const statusRes = await api.getSyncTaskStatus(res.taskId);
            if (statusRes.success && statusRes.task) {
              if (statusRes.task.estado === 'COMPLETED') {
                clearInterval(pollSyncRef.current);
                setSincronizando(false);
                mostrarToast('¡Sincronización desde CONTPAQi® Nóminas completada con éxito!');
                cargarColaboradores();
              } else if (statusRes.task.estado === 'ERROR') {
                clearInterval(pollSyncRef.current);
                setSincronizando(false);
                alert('Error en la tarea de sincronización: ' + (statusRes.task.error || 'Ocurrió un error'));
              }
            }
          } catch (pollErr) {
            console.error('Error sondeando estado de sincronización:', pollErr);
          }
        }, 1500);
      } else {
        setSincronizando(false);
        mostrarToast(res.message || 'Sincronización procesada.');
        cargarColaboradores();
      }
    } catch (err) {
      console.error('Error iniciando sincronización:', err);
      alert('Error iniciando sincronización CONTPAQi: ' + err.message);
      setSincronizando(false);
    }
  }

  // Ordenación Alfabética Obligatoria (defaultSort: 'asc' A - Z por Apellidos)
  const [sortDirection, setSortDirection] = useState('asc');

  async function cargarCatalogoJefes() {
    try {
      const res = await api.getColaboradoresAdmin('estatus=activos&limit=1000');
      if (res.success) {
        const sorted = (res.data || []).sort((a, b) => compararPorApellidos(a, b, 'asc'));
        setTodosLosJefes(sorted);
      }
    } catch (err) {
      console.error('Error cargando catálogo de jefes:', err);
    }
  }

  async function cargarColaboradores() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '25');
      if (search.trim()) params.append('search', search.trim());
      if (empresa) {
        params.append('empresa_id', empresa);
        params.append('empresa', empresa);
      }
      if (departamento) params.append('departamento', departamento);
      if (sucursal) params.append('sucursal', sucursal);
      if (estatus) params.append('estatus', estatus);

      const res = await api.getColaboradoresAdmin(params.toString());
      if (res.success) {
        const sorted = (res.data || []).sort((a, b) => compararPorApellidos(a, b, sortDirection));
        setColaboradores(sorted);
        setTotal(res.total);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Error cargando colaboradores:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    cargarColaboradores();
  }

  function abrirModalEditar(c, readOnly = false) {
    setColabEditar(c);
    setIsReadOnly(Boolean(readOnly));
    setAcordeonNominaAbierto(true);
    setPestanaModal('general');
    setFormEditar({
      idJefeDirecto: c.IdJefeDirecto || '',
      idAprobadorSegundo: c.IdAprobadorSegundo || '',
      emailCorporativo: c.EmailCorporativo || c.emailCorporativo || '',
      diasDescanso: parseDiasDescanso(c.DiasDescanso),
      rolApp: c.RolApp || 'COLABORADOR',
      telefono: c.Telefono || '',
      avisarEmergencia: c.AvisarEmergencia || '',
      parentescoEmergencia: c.ParentescoEmergencia || '',
      telefonoEmergencia: c.TelefonoEmergencia || '',
      tipoSangre: c.TipoSangre || '',
      alergiasPadecimientos: c.AlergiasPadecimientos || ''
    });
    setErrorEditar('');
  }

  async function abrirModalFicha(c) {
    setColabFicha(c);
    setLoadingFicha(true);
    setFichaData(null);
    try {
      const idColab = c.IdColaborador || c.id;
      const res = await api.getColaborador(idColab);
      if (res.success) {
        setFichaData(res.data);
      }
    } catch (err) {
      console.error('Error cargando expediente del colaborador:', err);
      alert('Error cargando expediente: ' + err.message);
    } finally {
      setLoadingFicha(false);
    }
  }

  async function handleGuardarEditar(e) {
    e.preventDefault();
    setErrorEditar('');
    try {
      setGuardandoEditar(true);

      // 1. Sanitización de Segundo Aprobador (IdAprobadorSegundo)
      // Si el valor es "", "none" o no se seleccionó ninguno, convertir forzosamente a null
      const idAprobadorSegundoSanitizado = (formEditar.idAprobadorSegundo && formEditar.idAprobadorSegundo !== 'none' && String(formEditar.idAprobadorSegundo).trim() !== '')
        ? Number(formEditar.idAprobadorSegundo)
        : null;

      // 2. Sanitización de Jefe Directo (IdJefeDirecto)
      const idJefeDirectoSanitizado = (formEditar.idJefeDirecto && formEditar.idJefeDirecto !== 'none' && String(formEditar.idJefeDirecto).trim() !== '')
        ? Number(formEditar.idJefeDirecto)
        : null;

      // 3. Sanitización de Días de Descanso Semanal (DiasDescanso)
      // Si viene como arreglo (ej. ['DOMINGO']), convertirlo a string con .join(', ')
      let diasDescansoSanitizado = 'DOMINGO';
      if (Array.isArray(formEditar.diasDescanso)) {
        diasDescansoSanitizado = formEditar.diasDescanso.length > 0 ? formEditar.diasDescanso.join(', ') : 'DOMINGO';
      } else if (typeof formEditar.diasDescanso === 'string' && formEditar.diasDescanso.trim() !== '') {
        diasDescansoSanitizado = formEditar.diasDescanso.trim().toUpperCase();
      }

      // 4. Sanitización de Correo Corporativo (EmailCorporativo)
      // Si viene como string vacío "", guardar como NULL o trim() del correo
      const emailCorpVal = (formEditar.emailCorporativo && typeof formEditar.emailCorporativo === 'string' && formEditar.emailCorporativo.trim() !== '')
        ? formEditar.emailCorporativo.trim().toLowerCase()
        : null;

      const payload = {
        ...formEditar,
        email_corporativo: emailCorpVal,
        emailCorporativo: emailCorpVal,
        EmailCorporativo: emailCorpVal,
        idJefeDirecto: idJefeDirectoSanitizado,
        IdJefeDirecto: idJefeDirectoSanitizado,
        idAprobadorSegundo: idAprobadorSegundoSanitizado,
        IdAprobadorSegundo: idAprobadorSegundoSanitizado,
        diasDescanso: diasDescansoSanitizado,
        DiasDescanso: diasDescansoSanitizado,
        telefono: (formEditar.telefono && typeof formEditar.telefono === 'string' && formEditar.telefono.trim() !== '') ? formEditar.telefono.trim() : null,
        avisarEmergencia: (formEditar.avisarEmergencia && typeof formEditar.avisarEmergencia === 'string' && formEditar.avisarEmergencia.trim() !== '') ? formEditar.avisarEmergencia.trim() : null,
        parentescoEmergencia: (formEditar.parentescoEmergencia && typeof formEditar.parentescoEmergencia === 'string' && formEditar.parentescoEmergencia.trim() !== '') ? formEditar.parentescoEmergencia.trim() : null,
        telefonoEmergencia: (formEditar.telefonoEmergencia && typeof formEditar.telefonoEmergencia === 'string' && formEditar.telefonoEmergencia.trim() !== '') ? formEditar.telefonoEmergencia.trim() : null,
        tipoSangre: (formEditar.tipoSangre && typeof formEditar.tipoSangre === 'string' && formEditar.tipoSangre.trim() !== '') ? formEditar.tipoSangre.trim() : null,
        alergiasPadecimientos: (formEditar.alergiasPadecimientos && typeof formEditar.alergiasPadecimientos === 'string' && formEditar.alergiasPadecimientos.trim() !== '') ? formEditar.alergiasPadecimientos.trim() : null
      };

      const res = await api.updateColaboradorComplementarios(colabEditar.IdColaborador, payload);
      if (res.success) {
        mostrarToast(res.message || 'Información complementaria guardada correctamente.');
        const jefeSel = todosLosJefes.find(j => String(j.IdColaborador) === String(payload.idJefeDirecto));
        const segundoSel = todosLosJefes.find(j => String(j.IdColaborador) === String(payload.idAprobadorSegundo));
        
        setColaboradores(prev => prev.map(c => 
          c.IdColaborador === colabEditar.IdColaborador 
            ? { 
                ...c, 
                ...payload, 
                EmailCorporativo: payload.emailCorporativo,
                DiasDescanso: payload.diasDescanso,
                IdJefeDirecto: payload.idJefeDirecto,
                JefeDirectoNombre: jefeSel ? jefeSel.NombreCompleto : null,
                IdAprobadorSegundo: payload.idAprobadorSegundo,
                SegundoAprobadorNombre: segundoSel ? segundoSel.NombreCompleto : null
              } 
            : c
        ));
        setColabEditar(null);
      }
    } catch (err) {
      console.error('Error al actualizar colaborador:', err);
      const errorMsg = err.message || 'Error al actualizar información complementaria.';
      setErrorEditar(errorMsg);
      alert('Error al actualizar información complementaria: ' + errorMsg);
    } finally {
      setGuardandoEditar(false);
    }
  }

  function abrirModalReset(c) {
    setColabReset(c);
    setPasswordManual(`JAMA-${Math.floor(1000 + Math.random() * 9000)}!`);
    setResetResult(null);
    setCopied(false);
  }

  async function handleEjecutarReset(e) {
    e.preventDefault();
    try {
      setGuardandoReset(true);
      const res = await api.resetColaboradorPasswordAdmin(colabReset.IdColaborador, {
        passwordTemporal: passwordManual
      });
      if (res.success) {
        setResetResult(res);
        cargarColaboradores();
      }
    } catch (err) {
      alert('Error restableciendo contraseña: ' + err.message);
    } finally {
      setGuardandoReset(false);
    }
  }

  function copiarPassword() {
    if (resetResult?.passwordTemporal) {
      navigator.clipboard.writeText(resetResult.passwordTemporal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function abrirModalHijos(colab) {
    setColabHijos(colab);
    setLoadingHijos(true);
    setErrorHijos('');
    try {
      const res = await api.getHijosColaborador(colab.IdColaborador);
      if (res.success) {
        setHijosList(res.data || []);
        setNuevoHijo({
          nombre: '',
          fechaNacimiento: '',
          sexo: 'M'
        });
      }
    } catch (err) {
      console.error('Error al cargar hijos del colaborador:', err);
      setErrorHijos(err.message || 'Error cargando catálogo de hijos.');
    } finally {
      setLoadingHijos(false);
    }
  }

  async function handleAgregarHijo(e) {
    e.preventDefault();
    if (!colabHijos) return;
    if (!nuevoHijo.nombre || !nuevoHijo.nombre.trim()) {
      setErrorHijos('El nombre completo del hijo o dependiente es obligatorio.');
      return;
    }
    setErrorHijos('');
    try {
      setGuardandoHijo(true);
      const payload = {
        nombre: nuevoHijo.nombre.trim(),
        numeroHijo: (hijosList.length || 0) + 1,
        fechaNacimiento: nuevoHijo.fechaNacimiento || null,
        sexo: nuevoHijo.sexo || 'M'
      };
      const res = await api.agregarHijoColaborador(colabHijos.IdColaborador, payload);
      if (res.success) {
        mostrarToast('Hijo registrado exitosamente.');
        setHijosList(res.data || []);
        setNuevoHijo({
          nombre: '',
          fechaNacimiento: '',
          sexo: 'M'
        });
        setColaboradores(prev => prev.map(c => 
          c.IdColaborador === colabHijos.IdColaborador 
            ? { ...c, TotalHijos: res.data?.length || ((c.TotalHijos || 0) + 1) } 
            : c
        ));
        setColabEditar(prev => prev && prev.IdColaborador === colabHijos.IdColaborador
          ? { ...prev, TotalHijos: res.data?.length || ((prev.TotalHijos || 0) + 1) }
          : prev
        );
        setFichaData(prev => prev && (prev.IdColaborador === colabHijos.IdColaborador)
          ? { ...prev, hijos: res.data || [] }
          : prev
        );
      }
    } catch (err) {
      setErrorHijos(err.message || 'Error guardando hijo.');
    } finally {
      setGuardandoHijo(false);
    }
  }

  async function handleEliminarHijo(idHijo) {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de hijo?')) return;
    try {
      const res = await api.eliminarHijoColaborador(colabHijos.IdColaborador, idHijo);
      if (res.success) {
        mostrarToast('Hijo eliminado exitosamente.');
        setHijosList(res.data || []);
        setNuevoHijo({
          nombre: '',
          fechaNacimiento: '',
          sexo: 'M'
        });
        setColaboradores(prev => prev.map(c => 
          c.IdColaborador === colabHijos.IdColaborador 
            ? { ...c, TotalHijos: res.data?.length || Math.max(0, (c.TotalHijos || 1) - 1) } 
            : c
        ));
        setColabEditar(prev => prev && prev.IdColaborador === colabHijos.IdColaborador
          ? { ...prev, TotalHijos: res.data?.length || Math.max(0, (prev.TotalHijos || 1) - 1) }
          : prev
        );
        setFichaData(prev => prev && (prev.IdColaborador === colabHijos.IdColaborador)
          ? { ...prev, hijos: res.data || [] }
          : prev
        );
      }
    } catch (err) {
      alert('Error eliminando hijo: ' + err.message);
    }
  }

  function calcularEdad(fechaNacStr) {
    if (!fechaNacStr) return 'No registrada';
    const parts = fechaNacStr.split('-');
    if (parts.length !== 3) return fechaNacStr;
    const nac = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
    if (isNaN(nac.getTime())) return 'Fecha inválida';
    const hoy = new Date();
    let edad = hoy.getUTCFullYear() - nac.getUTCFullYear();
    const m = hoy.getUTCMonth() - nac.getUTCMonth();
    if (m < 0 || (m === 0 && hoy.getUTCDate() < nac.getUTCDate())) {
      edad--;
    }
    return edad >= 0 ? `${edad} ${edad === 1 ? 'año' : 'años'}` : '—';
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-700 text-white shadow-2xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
              Desarrollo Organizacional & TI
            </span>
            <span className="text-xs text-slate-400">• Catálogo Central</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Catálogo Administrativo de Colaboradores
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de jerarquía de aprobación, rol aplicativo, datos médicos, contactos de emergencia y credenciales de acceso.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {esAdminDO && (
            <button
              type="button"
              onClick={() => setMostrarModalCargaMasiva(true)}
              title="Carga masiva de saldos iniciales reales de vacaciones mediante archivo Excel (.xlsx)"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs select-none bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 cursor-pointer active:scale-[0.98]"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>📤 Cargar Saldos Iniciales (Excel)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSincronizarContpaqi}
            disabled={sincronizando}
            title="Ejecuta la sincronización de altas, bajas y datos maestros desde las bases de datos de CONTPAQi Nóminas hacia la app."
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs select-none ${
              sincronizando
                ? 'bg-blue-50 text-blue-700 border border-blue-200 cursor-not-allowed opacity-90'
                : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar desde CONTPAQi® Nóminas'}</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros en Cascada */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          
          {/* Buscador de texto */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Nombre, Nómina, CURP o RFC..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
            />
          </div>

          {/* Filtro Empresa */}
          <select
            value={empresa}
            onChange={(e) => { setEmpresa(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-blue-600 outline-none max-w-[210px]"
          >
            <option value="">Todas las Empresas ({empresasCatalog.length})</option>
            {empresasCatalog.map(emp => (
              <option key={emp.idEmpresa || emp.id} value={emp.idEmpresa || emp.id}>
                {emp.aliasEmpresa || emp.alias}
              </option>
            ))}
          </select>

          {/* Filtro Estatus */}
          <select
            value={estatus}
            onChange={(e) => { setEstatus(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-700"
          >
            <option value="activos">Solo Activos</option>
            <option value="bajas">Solo Bajas</option>
            <option value="todos">Todos los Registros</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Tabla de Colaboradores */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-28 min-w-[110px] whitespace-nowrap">Nómina / Código</th>
                <th className="py-2.5 px-3 min-w-[190px]">
                  <button
                    type="button"
                    onClick={() => {
                      const next = sortDirection === 'asc' ? 'desc' : 'asc';
                      setSortDirection(next);
                      setColaboradores(prev => [...prev].sort((a, b) => compararPorApellidos(a, b, next)));
                    }}
                    className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-blue-700 cursor-pointer uppercase text-[10px] tracking-wider transition group"
                    title="Ordenamiento Alfabético Obligatorio A - Z por Apellidos"
                  >
                    <span>Colaborador</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100/90 text-blue-800 text-[9px] font-black border border-blue-200">
                      <ArrowUpDown className="w-2.5 h-2.5" />
                      {sortDirection === 'asc' ? 'A - Z' : 'Z - A'}
                    </span>
                  </button>
                </th>
                <th className="py-2.5 px-3 min-w-[130px]">Empresa / Sucursal</th>
                <th className="py-2.5 px-3 min-w-[140px]">Departamento / Puesto</th>
                <th className="py-2.5 px-3 min-w-[150px]">Jefe Directo (Aprobador)</th>
                <th className="py-2.5 px-3 w-24 text-center whitespace-nowrap">Rol App</th>
                <th className="py-2.5 px-3 text-center w-28 min-w-[110px] sticky right-0 bg-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] z-10 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Consultando catálogo de colaboradores...</span>
                    </div>
                  </td>
                </tr>
              ) : colaboradores.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No se encontraron colaboradores con los filtros especificados.
                  </td>
                </tr>
              ) : (
                colaboradores.map((c) => {
                  const colabNombres = desglosarNombre(c);
                  const jefeVal = c.NombreJefeDirecto || c.JefeDirectoNombre;
                  const jefeNombres = jefeVal ? desglosarNombre(jefeVal) : null;
                  const segundoVal = c.NombreGerenteSucursal || c.SegundoAprobadorNombre;
                  const segundoNombres = segundoVal ? desglosarNombre(segundoVal) : null;

                  return (
                    <tr key={c.IdColaborador || c.id} className="group hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start justify-center">
                          {/* Renglón 1 (Superior): Código / Número de Nómina en negrita */}
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-slate-800 font-mono leading-tight">
                              {c.CodigoEmpleado}
                            </span>
                            {c.Subfijo && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {c.Subfijo}
                              </span>
                            )}
                          </div>

                          {/* Renglón 2 (Inferior): Badge de estatus justo debajo del código */}
                          {c.Activo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Alta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Baja
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Colaborador: Desglose en dos renglones (Apellidos arriba, Nombres abajo) */}
                      <td className="py-2.5 px-3 min-w-[190px]">
                        <div className="flex flex-col justify-center gap-0.5 max-w-[240px]">
                          {/* Enlace/botón interactivo para consultar la Ficha en modo SOLO LECTURA */}
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(c, true)}
                            title="Consultar Ficha del Colaborador (Solo Lectura)"
                            className="text-left group/colab cursor-pointer focus:outline-none"
                          >
                            {/* Renglón 1: Apellidos en mayúsculas, negrita destacada */}
                            <span className="font-semibold text-slate-900 text-sm uppercase leading-tight truncate block group-hover/colab:text-blue-700 group-hover/colab:underline transition" title={colabNombres.apellidos}>
                              {colabNombres.apellidos}
                            </span>
                            {/* Renglón 2: Nombres en fuente regular */}
                            {colabNombres.nombres && (
                              <span className="text-xs text-slate-600 font-medium leading-tight truncate block group-hover/colab:text-blue-600 transition" title={colabNombres.nombres}>
                                {colabNombres.nombres}
                              </span>
                            )}
                          </button>
                          {/* Renglón 3: Correo electrónico tenue */}
                          <div className="flex items-center gap-1 truncate max-w-[240px] mt-0.5">
                            {c.EmailCorporativo ? (
                              <span className="text-[11px] text-blue-700 font-medium truncate flex items-center gap-1" title={`Corporativo: ${c.EmailCorporativo}`}>
                                <Mail className="w-2.5 h-2.5 shrink-0 text-blue-600" />
                                {c.EmailCorporativo}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 truncate" title={`Nómina: ${c.Email || 'Sin correo'}`}>
                                {c.Email || 'Sin correo registrado'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Empresa / Sucursal */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <div className="flex flex-col justify-center gap-0.5">
                          <span className="font-semibold text-slate-800 block truncate max-w-[160px]" title={c.Empresa}>{c.Empresa}</span>
                          <span className="text-[11px] text-slate-400 block truncate max-w-[160px]" title={c.Sucursal || c.sucursal || 'Matriz'}>{c.Sucursal || c.sucursal || 'Matriz'}</span>
                        </div>
                      </td>

                      {/* Departamento / Puesto */}
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="flex flex-col justify-center gap-0.5">
                          <span className="text-slate-800 font-medium block truncate max-w-[160px]" title={c.Departamento || 'General'}>{c.Departamento || 'General'}</span>
                          <span className="text-[11px] text-slate-400 block truncate max-w-[160px]" title={c.Puesto || '—'}>{c.Puesto || '—'}</span>
                        </div>
                      </td>

                      {/* Jefe Directo (Aprobador): Desglose en dos renglones */}
                      <td className="py-2.5 px-3 min-w-[150px]">
                        <div className="flex flex-col justify-center gap-1">
                          {jefeNombres ? (
                            <div className="bg-amber-50/70 border border-amber-200/60 rounded px-2 py-1 inline-block max-w-[180px]">
                              <div className="flex flex-col justify-center gap-0.5">
                                {/* Renglón 1: Apellidos del Jefe */}
                                <span className="font-medium text-slate-800 text-xs uppercase leading-tight truncate" title={jefeNombres.apellidos}>
                                  {jefeNombres.apellidos}
                                </span>
                                {/* Renglón 2: Nombres del Jefe */}
                                {jefeNombres.nombres && (
                                  <span className="text-[11px] text-slate-500 leading-tight truncate" title={jefeNombres.nombres}>
                                    {jefeNombres.nombres}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="italic text-slate-400 text-xs">Sin Jefe Directo</span>
                          )}

                          {segundoNombres && (
                            <div className="bg-indigo-50/60 border border-indigo-200/60 rounded px-1.5 py-0.5 inline-block max-w-[180px]">
                              <div className="flex flex-col justify-center text-[10px]">
                                <span className="font-semibold text-indigo-900 uppercase leading-tight truncate" title={`NV2: ${segundoNombres.apellidos}`}>
                                  NV2: {segundoNombres.apellidos}
                                </span>
                                {segundoNombres.nombres && (
                                  <span className="text-[9px] text-indigo-700 leading-tight truncate">
                                    {segundoNombres.nombres}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                          c.RolApp === 'ADMIN_DO' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          c.RolApp === 'LIDER' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {c.RolApp}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] z-10 w-28 min-w-[110px]">
                        <div className="flex flex-col items-stretch justify-center gap-1.5 w-full">
                          <button
                            onClick={() => abrirModalEditar(c, false)}
                            title="Editar Ficha del Colaborador e Información Complementaria"
                            className="w-full flex items-center justify-center gap-1.5 text-xs py-1 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg font-semibold transition cursor-pointer shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => abrirModalReset(c)}
                            title="Restablecer Contraseña Institucional"
                            className="w-full flex items-center justify-center gap-1 text-[11px] py-0.5 px-2 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded-lg font-medium transition cursor-pointer"
                          >
                            <KeyRound className="w-3 h-3 text-slate-400 group-hover:text-amber-600" />
                            <span>Clave</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando página {page} de {totalPages} ({total} colaboradores totales)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: EDICIÓN DE CAMPOS COMPLEMENTARIOS */}
      {colabEditar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8 max-h-[92vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                    isReadOnly 
                      ? 'bg-purple-100 text-purple-800 border-purple-200' 
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    {isReadOnly ? 'Consulta / Solo Lectura 🔒' : 'Ficha de Colaborador'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    CONTPAQi Sincronizado
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {isReadOnly ? 'Ficha del Colaborador: ' : 'Editar Colaborador: '}{formatearNombreColaborador(colabEditar)}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Nómina: {colabEditar.CodigoEmpleado} • Empresa: {colabEditar.Empresa || '—'}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setColabEditar(null)} 
                title="Cerrar"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Navegación del Modal */}
            <div className="flex items-center gap-2 border-b border-slate-200 mt-4 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setPestanaModal('general')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  pestanaModal === 'general'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Datos Generales y Nómina</span>
              </button>

              {esAdminDO && (
                <button
                  type="button"
                  onClick={() => setPestanaModal('ajuste_saldo')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    pestanaModal === 'ajuste_saldo'
                      ? 'bg-purple-700 text-white shadow-2xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>⚙️ Ajuste de Saldo de Vacaciones / Saldo Inicial</span>
                </button>
              )}
            </div>

            {pestanaModal === 'ajuste_saldo' ? (
              <div className="mt-4">
                <SeccionAjusteSaldo 
                  colaborador={colabEditar} 
                  onSuccess={() => {
                    cargarColaboradores();
                    setToast('Saldo inicial actualizado exitosamente.');
                  }} 
                />
              </div>
            ) : (
              <div>
                {/* ACORDEÓN: DATOS MAESTROS DE NÓMINA (CONTPAQi NÓMINAS) - SOLO LECTURA */}
                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 shadow-2xs">
              <button
                type="button"
                onClick={() => setAcordeonNominaAbierto(!acordeonNominaAbierto)}
                className="w-full px-4 py-3 bg-slate-100/80 hover:bg-slate-200/60 border-b border-slate-200/80 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg">
                    <Lock className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Datos Maestros de Nómina (CONTPAQi)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/90 text-slate-600 rounded-full">
                        Solo Lectura 🔒
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Estructura organizacional, identidad legal, datos personales y cuentas de dispersión
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-[11px] font-semibold hidden sm:inline">
                    {acordeonNominaAbierto ? 'Ocultar datos de nómina' : 'Mostrar datos de nómina'}
                  </span>
                  {acordeonNominaAbierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {acordeonNominaAbierto && (
                <div className="p-4 space-y-4 bg-white/70">
                  {/* Banner de Advertencia / Protección Oficial */}
                  <div className="p-3 bg-amber-50/90 border border-amber-200/90 text-amber-900 rounded-xl text-xs flex items-center gap-2.5">
                    <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                    <span className="font-medium leading-relaxed">
                      🔒 Información sincronizada directamente desde CONTPAQi Nóminas. Modificaciones a estos campos deben realizarse en el sistema de nómina oficial.
                    </span>
                  </div>

                  {/* GRUPO A: Estructura Organizacional y Puesto */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 text-slate-800">
                      <Building2 className="w-4 h-4 text-blue-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Grupo A: Estructura Organizacional y Puesto
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <CampoSoloLectura label="Empresa" valor={colabEditar.Empresa} icono={Building2} />
                      <CampoSoloLectura label="Sucursal" valor={colabEditar.Sucursal} icono={Building2} />
                      <CampoSoloLectura label="Departamento" valor={colabEditar.Departamento} icono={Briefcase} />
                      <CampoSoloLectura label="Puesto" valor={colabEditar.Puesto} icono={Briefcase} />
                      <CampoSoloLectura 
                        label="Fecha de Alta (Antigüedad)" 
                        valor={colabEditar.FechaAlta 
                          ? `${formatearFecha(colabEditar.FechaAlta)}${calcularAntiguedad(colabEditar.FechaAlta) ? ` (${calcularAntiguedad(colabEditar.FechaAlta)})` : ''}` 
                          : '—'} 
                        icono={Calendar} 
                      />
                      <CampoSoloLectura 
                        label="Jefe Directo (registrado en Nómina)" 
                        valor={colabEditar.JefeDirectoNombre || '—'} 
                        icono={User} 
                      />
                      <CampoSoloLectura 
                        label="Rol / Tipo Nómina" 
                        valor={colabEditar.TipoNomina || colabEditar.EstatusNomina || '—'} 
                        icono={Shield} 
                      />
                    </div>
                  </div>

                  {/* GRUPO B: Identidad Legal y Seguridad Social */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 text-slate-800">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Grupo B: Identidad Legal y Seguridad Social
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <CampoSoloLectura label="RFC" valor={colabEditar.RFC} icono={ShieldCheck} monospace />
                      <CampoSoloLectura label="CURP" valor={colabEditar.CURP} icono={ShieldCheck} monospace />
                      <CampoSoloLectura label="NSS" valor={colabEditar.NSS} icono={ShieldCheck} monospace />
                    </div>
                  </div>

                  {/* GRUPO C: Datos Personales */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 text-slate-800">
                      <User className="w-4 h-4 text-indigo-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Grupo C: Datos Personales
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {/* Fila 1 (3 columnas): Fecha de Nacimiento, Género, Estado Civil */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <CampoSoloLectura 
                          label="Fecha de Nacimiento" 
                          valor={formatearFecha(colabEditar.FechaNacimiento)} 
                          icono={Calendar} 
                        />
                        <CampoSoloLectura 
                          label="Género" 
                          valor={colabEditar.Genero || (colabEditar.Sexo === 'F' ? 'Mujer' : 'Hombre')} 
                          icono={Lock} 
                        />
                        <CampoSoloLectura 
                          label="Estado Civil" 
                          valor={colabEditar.EstadoCivil} 
                          icono={User} 
                        />
                      </div>

                      {/* Fila 2 (2 columnas): CURP, Nacionalidad */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CampoSoloLectura 
                          label="CURP" 
                          valor={colabEditar.CURP} 
                          icono={ShieldCheck} 
                          monospace 
                        />
                        <CampoSoloLectura 
                          label="Nacionalidad" 
                          valor={colabEditar.Nacionalidad} 
                          icono={User} 
                        />
                      </div>

                      {/* Fila 3 (Ancho completo): Correo Nómina / Personal */}
                      <div>
                        <CampoSoloLectura 
                          label="Correo Nómina / Personal" 
                          valor={colabEditar.Email} 
                          icono={Mail} 
                          placeholderVacio="Sin correo registrado en nómina" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* GRUPO D: Datos Financieros / Dispersión */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 text-slate-800">
                      <CreditCard className="w-4 h-4 text-teal-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Grupo D: Datos Financieros / Dispersión
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <CampoSoloLectura 
                        label="Institución Bancaria" 
                        valor={colabEditar.InstitucionBancaria} 
                        icono={CreditCard} 
                        placeholderVacio="Sin registro en nómina"
                      />
                      <CampoSoloLectura 
                        label="Número de Cuenta" 
                        valor={colabEditar.NumeroCuenta} 
                        icono={CreditCard} 
                        monospace 
                        placeholderVacio="Sin registro en nómina"
                      />
                      <CampoSoloLectura 
                        label="CLABE Interbancaria" 
                        valor={colabEditar.ClabeInterbancaria} 
                        icono={CreditCard} 
                        monospace 
                        placeholderVacio="Sin registro en nómina"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN: DATOS COMPLEMENTARIOS */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-700" />
                    {isReadOnly 
                      ? 'Datos Complementarios (Consulta / Solo Lectura)' 
                      : 'Datos Complementarios Editables (Internos de la Aplicación)'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isReadOnly 
                      ? 'Información de operación interna y bienestar del colaborador.' 
                      : 'Campos de operación interna y bienestar que se preservan intactos durante la sincronización con Nóminas.'}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isReadOnly ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                  {isReadOnly ? 'Solo Lectura 🔒' : 'Editable en App ✏️'}
                </span>
              </div>

              {errorEditar && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorEditar}</span>
                </div>
              )}

              <form onSubmit={isReadOnly ? (e) => e.preventDefault() : handleGuardarEditar} className="space-y-4">
                <fieldset disabled={isReadOnly} className="contents space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Jefe Directo (Aprobador Nivel 1) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Jefe Directo (Aprobador Nivel 1 - Vo.Bo. Operativo)</span>
                      <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Obligatorio</span>
                    </label>
                    <select
                      value={formEditar.idJefeDirecto}
                      disabled={isReadOnly}
                      onChange={(e) => setFormEditar({ ...formEditar, idJefeDirecto: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="">-- Sin Jefe Directo Asignado --</option>
                      {todosLosJefes
                        .filter(j => j.IdColaborador !== colabEditar.IdColaborador)
                        .sort((a, b) => compararPorApellidos(a, b, 'asc'))
                        .map(j => (
                          <option key={j.IdColaborador} value={j.IdColaborador}>
                            {formatearEtiquetaSelector(j)}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Segundo Aprobador (Nivel 2) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Segundo Aprobador / Gerente de Sucursal (Nivel 2 - Autorización Definitiva)</span>
                      <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">Opcional</span>
                    </label>
                    <select
                      value={formEditar.idAprobadorSegundo}
                      disabled={isReadOnly}
                      onChange={(e) => setFormEditar({ ...formEditar, idAprobadorSegundo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none"
                    >
                      <option value="">-- Ninguno / No aplica (Aprobación directa con Nivel 1) --</option>
                      {todosLosJefes
                        .filter(j => j.IdColaborador !== colabEditar.IdColaborador && (!formEditar.idJefeDirecto || j.IdColaborador !== Number(formEditar.idJefeDirecto)))
                        .sort((a, b) => compararPorApellidos(a, b, 'asc'))
                        .map(j => (
                          <option key={j.IdColaborador} value={j.IdColaborador}>
                            {formatearEtiquetaSelector(j)}
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Si se asigna un segundo aprobador, el Jefe Directo emitirá el Vo.Bo. inicial y la solicitud pasará a la bandeja del Gerente para su formalización definitiva.
                    </p>
                  </div>

                  {/* Rol App */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rol en la Aplicación
                    </label>
                    <select
                      value={formEditar.rolApp}
                      disabled={isReadOnly}
                      onChange={(e) => setFormEditar({ ...formEditar, rolApp: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="COLABORADOR">COLABORADOR (Solicitante estándar)</option>
                      <option value="LIDER">LÍDER (Jefe con bandeja de autorización)</option>
                      <option value="ADMIN_DO">ADMIN_DO (Desarrollo Organizacional)</option>
                    </select>
                  </div>

                  {/* Días de Descanso */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Días de Descanso Semanal</span>
                      <span className="text-[10px] text-slate-400 font-normal">Excluidos de vacaciones</span>
                    </label>
                    <SelectorDiasDescanso
                      value={formEditar.diasDescanso}
                      disabled={isReadOnly}
                      onChange={(nuevos) => setFormEditar({ ...formEditar, diasDescanso: nuevos })}
                    />
                  </div>

                  {/* FILA GRID 3 COLUMNAS: [ Correo Corporativo / Empresa ] | [ Teléfono Particular ] | [ Tipo de Sangre ] */}
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-blue-50/40 border border-blue-100 rounded-2xl">
                    {/* Correo Corporativo */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-blue-950 font-bold">
                          <Mail className="w-3.5 h-3.5 text-blue-600" />
                          Correo Corporativo
                        </span>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-100/70 px-1.5 py-0.5 rounded border border-blue-200">
                          Empresa
                        </span>
                      </label>
                      <input
                        type="email"
                        name="email_corporativo"
                        disabled={isReadOnly}
                        value={formEditar.emailCorporativo}
                        onChange={(e) => setFormEditar({ ...formEditar, emailCorporativo: e.target.value })}
                        placeholder="ejemplo@grupojama.com.mx / @latinoconcretos.com"
                        className="w-full px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 truncate" title="Recepción de avisos de vacaciones y Teams">
                        Avisos de vacaciones y Teams
                      </p>
                    </div>

                    {/* Teléfono Particular */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          Teléfono / Celular Particular
                        </span>
                      </label>
                      <input
                        type="text"
                        name="telefono"
                        disabled={isReadOnly}
                        value={formEditar.telefono}
                        onChange={(e) => setFormEditar({ ...formEditar, telefono: e.target.value })}
                        placeholder="Ej. 4441234567"
                        className="w-full px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        Contacto telefónico directo
                      </p>
                    </div>

                    {/* Tipo de Sangre */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-rose-500" />
                          Tipo de Sangre
                        </span>
                      </label>
                      <input
                        type="text"
                        name="tipo_sangre"
                        disabled={isReadOnly}
                        value={formEditar.tipoSangre}
                        onChange={(e) => setFormEditar({ ...formEditar, tipoSangre: e.target.value })}
                        placeholder="Ej. O+, A+, B+, etc."
                        className="w-full px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        Registro médico interno
                      </p>
                    </div>
                  </div>


                  {/* Contacto de Emergencia: Nombre */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Avisar en Caso de Emergencia (Nombre)
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formEditar.avisarEmergencia}
                      onChange={(e) => setFormEditar({ ...formEditar, avisarEmergencia: e.target.value })}
                      placeholder="Nombre del familiar o contacto"
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  {/* Parentesco y Teléfono de Emergencia */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Parentesco
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={formEditar.parentescoEmergencia}
                        onChange={(e) => setFormEditar({ ...formEditar, parentescoEmergencia: e.target.value })}
                        placeholder="Esposa, Padre..."
                        className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Teléfono Emerg.
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={formEditar.telefonoEmergencia}
                        onChange={(e) => setFormEditar({ ...formEditar, telefonoEmergencia: e.target.value })}
                        placeholder="Teléfono"
                        className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                  </div>

                  {/* Alergias / Padecimientos */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alergias / Padecimientos Médicos
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formEditar.alergiasPadecimientos}
                      onChange={(e) => setFormEditar({ ...formEditar, alergiasPadecimientos: e.target.value })}
                      placeholder="Alergias a medicamentos, padecimientos crónicos, etc."
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  {/* Hijos / Dependientes Familiares */}
                  <div className="sm:col-span-2 p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                        <Baby className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">Hijos y Dependientes Registrados</span>
                        <span className="text-[11px] text-purple-700">
                          {colabEditar.TotalHijos > 0 
                            ? `${colabEditar.TotalHijos} ${colabEditar.TotalHijos === 1 ? 'hijo registrado' : 'hijos registrados'} en el sistema` 
                            : 'Sin hijos registrados actualmente'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirModalHijos(colabEditar)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <Baby className="w-3.5 h-3.5" />
                      <span>{isReadOnly ? 'Ver Hijos' : 'Ver / Gestionar Hijos'} ({colabEditar.TotalHijos || 0})</span>
                    </button>
                  </div>

                </div>
                </fieldset>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {isReadOnly 
                      ? 'ℹ️ Modo de solo lectura: los datos mostrados son de consulta.' 
                      : '🔒 Campos blindados: NUNCA son sobreescritos al sincronizar con CONTPAQi.'}
                  </span>
                  <div className="flex items-center gap-2">
                    {isReadOnly ? (
                      <button
                        type="button"
                        onClick={() => setColabEditar(null)}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Cerrar
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setColabEditar(null)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={guardandoEditar}
                          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {guardandoEditar ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )}



      {/* MODAL 2: RESTABLECIMIENTO DE CONTRASEÑA */}
      {colabReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <KeyRound className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Restablecer Contraseña</h3>
                  <p className="text-xs text-slate-500">{formatearNombreColaborador(colabReset)}</p>
                </div>
              </div>
              <button onClick={() => setColabReset(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetResult ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Contraseña Restablecida!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    La clave temporal ha sido actualizada en la base de datos con la bandera <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono font-bold">debe_cambiar_password = 1</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Contraseña Temporal Asignada:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={resetResult.passwordTemporal}
                      className="flex-1 px-3.5 py-2.5 bg-slate-100 font-mono font-black text-slate-900 text-sm rounded-xl border border-slate-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={copiarPassword}
                      className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setColabReset(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEjecutarReset} className="mt-4 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Define una contraseña temporal para este usuario o utiliza la clave segura generada automáticamente. Al ingresar, el sistema le exigirá definir una nueva clave personal.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contraseña Temporal (mínimo 8 caracteres):
                  </label>
                  <input
                    type="text"
                    required
                    value={passwordManual}
                    onChange={(e) => setPasswordManual(e.target.value)}
                    placeholder="Ej. JAMA-2026!"
                    className="w-full px-3.5 py-2.5 bg-slate-50 font-mono font-bold text-slate-900 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setColabReset(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoReset}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {guardandoReset ? 'Restableciendo...' : 'Restablecer Clave'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL 3: FICHA TÉCNICA / EXPEDIENTE COMPLETO DEL COLABORADOR */}
      {colabFicha && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            {/* Encabezado Ficha */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                  {obtenerInicialesColaborador(colabFicha)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200 uppercase">
                      Expediente del Colaborador
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colabFicha.Activo ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
                      {colabFicha.Activo ? 'Alta / Activo' : 'Baja'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {formatearNombreColaborador(colabFicha)}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Nómina: <span className="font-mono font-bold text-slate-700">{colabFicha.CodigoEmpleado}</span> • {colabFicha.Empresa} • {colabFicha.Puesto}
                  </p>
                </div>
              </div>
              <button onClick={() => setColabFicha(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingFicha ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs font-semibold">Cargando expediente completo y dependientes familiares...</p>
              </div>
            ) : (
              <div className="mt-5 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {/* 1. Datos Institucionales */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span>Información Laboral & Organización</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Empresa</span>
                      <span className="font-semibold text-slate-800">{fichaData?.Empresa || colabFicha.Empresa || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Sucursal</span>
                      <span className="font-semibold text-slate-800">{fichaData?.Sucursal || colabFicha.Sucursal || colabFicha.sucursal || 'Matriz'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Departamento</span>
                      <span className="font-semibold text-slate-800">{fichaData?.Departamento || colabFicha.Departamento || 'General'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Puesto</span>
                      <span className="font-semibold text-slate-800">{fichaData?.Puesto || colabFicha.Puesto || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Jefe Directo (Aprobador NV1)</span>
                      <span className="font-semibold text-amber-800">
                        {formatearNombreColaborador(fichaData?.NombreJefeDirecto || fichaData?.JefeDirectoNombre || colabFicha.NombreJefeDirecto || colabFicha.JefeDirectoNombre || 'Sin Jefe Asignado')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Segundo Aprobador (NV2)</span>
                      <span className="font-semibold text-indigo-800">
                        {(fichaData?.NombreGerenteSucursal || fichaData?.SegundoAprobadorNombre || colabFicha.NombreGerenteSucursal || colabFicha.SegundoAprobadorNombre)
                          ? formatearNombreColaborador(fichaData?.NombreGerenteSucursal || fichaData?.SegundoAprobadorNombre || colabFicha.NombreGerenteSucursal || colabFicha.SegundoAprobadorNombre)
                          : 'Sin Segundo Aprobador'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Fecha de Alta</span>
                      <span className="font-mono text-slate-700">
                        {fichaData?.FechaAlta ? `${formatearFecha(fichaData.FechaAlta)} (${calcularAntiguedad(fichaData.FechaAlta)})` : (colabFicha.FechaAlta ? `${formatearFecha(colabFicha.FechaAlta)} (${calcularAntiguedad(colabFicha.FechaAlta)})` : '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Días de Descanso</span>
                      <span className="font-medium text-slate-700">{fichaData?.DiasDescanso || colabFicha.DiasDescanso || 'DOMINGO'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Rol en la App</span>
                      <span className="font-bold text-blue-700">{fichaData?.RolApp || colabFicha.RolApp || 'COLABORADOR'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Tipo Nómina / Contrato</span>
                      <span className="font-medium text-slate-700">{fichaData?.TipoNomina || 'Quincenal'} • {fichaData?.TipoContrato || 'Planta'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Datos Personales y Fiscales */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Identidad & Datos Fiscales</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">CURP</span>
                      <span className="font-mono text-slate-800 font-semibold">{fichaData?.CURP || colabFicha.CURP || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">RFC</span>
                      <span className="font-mono text-slate-800 font-semibold">{fichaData?.RFC || colabFicha.RFC || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">NSS (Seguro Social)</span>
                      <span className="font-mono text-slate-800 font-semibold">{fichaData?.NSS || colabFicha.NSS || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Fecha Nacimiento</span>
                      <span className="font-medium text-slate-700">
                        {fichaData?.FechaNacimiento ? formatearFecha(fichaData.FechaNacimiento) : (colabFicha.FechaNacimiento ? formatearFecha(colabFicha.FechaNacimiento) : '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Teléfono / Celular</span>
                      <span className="font-mono text-slate-800">{fichaData?.Telefono || colabFicha.Telefono || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Correo Corporativo</span>
                      <span className="text-slate-800 font-medium truncate block" title={fichaData?.EmailCorporativo || colabFicha.EmailCorporativo || 'Sin correo corporativo'}>
                        {fichaData?.EmailCorporativo || colabFicha.EmailCorporativo || 'Sin correo corporativo'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Correo Nómina</span>
                      <span className="text-slate-600 truncate block" title={fichaData?.EmailNomina || fichaData?.Email || colabFicha.Email || 'Sin correo registrado'}>
                        {fichaData?.EmailNomina || fichaData?.Email || colabFicha.Email || 'Sin correo registrado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Estado Civil</span>
                      <span className="font-medium text-slate-700">{fichaData?.EstadoCivil || colabFicha.EstadoCivil || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Nacionalidad</span>
                      <span className="font-medium text-slate-700">{fichaData?.Nacionalidad || colabFicha.Nacionalidad || 'Mexicana'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Escolaridad</span>
                      <span className="font-medium text-slate-700">{fichaData?.Escolaridad || colabFicha.Escolaridad || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block">Domicilio</span>
                      <span className="font-medium text-slate-700 truncate block" title={fichaData?.Domicilio || colabFicha.Domicilio || '—'}>
                        {fichaData?.Domicilio || colabFicha.Domicilio || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Datos Financieros para Dispersión de Nómina */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>Datos Financieros (Dispersión de Nómina CONTPAQi)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Institución Bancaria</span>
                      <span className="font-semibold text-slate-800">{fichaData?.InstitucionBancaria || 'BBVA BANCOMER'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Número de Cuenta</span>
                      <span className="font-mono text-slate-800 font-semibold">{fichaData?.NumeroCuenta || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">CLABE Interbancaria</span>
                      <span className="font-mono text-slate-800 font-semibold">{fichaData?.ClabeInterbancaria || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Forma de Pago</span>
                      <span className="font-medium text-slate-700">{fichaData?.FormaPago || 'Transferencia Electrónica'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Contacto de Emergencia & Salud */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-600" />
                    <span>Contacto de Emergencia & Salud</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Contacto de Emergencia</span>
                      <span className="font-bold text-slate-800">{fichaData?.ContactoEmergenciaNombre || fichaData?.AvisarEmergencia || colabFicha.AvisarEmergencia || 'Sin registrar'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Parentesco</span>
                      <span className="font-medium text-slate-700">{fichaData?.ContactoEmergenciaParentesco || fichaData?.ParentescoEmergencia || colabFicha.ParentescoEmergencia || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Teléfono de Emergencia</span>
                      <span className="font-mono font-bold text-rose-700">{fichaData?.ContactoEmergenciaTelefono || fichaData?.TelefonoEmergencia || colabFicha.TelefonoEmergencia || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Tipo de Sangre</span>
                      <span className="font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                        {fichaData?.TipoSangre || colabFicha.TipoSangre || 'No registrado'}
                      </span>
                    </div>
                    <div className="sm:col-span-4">
                      <span className="text-[11px] text-slate-400 block">Alergias / Padecimientos Médicos</span>
                      <span className="text-slate-700 font-medium">{fichaData?.PadecimientosMedicos || fichaData?.AlergiasPadecimientos || colabFicha.AlergiasPadecimientos || 'Ninguno manifestado'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Hijos y Dependientes Familiares (dbo.ColaboradorHijos) */}
                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center">
                        <Baby className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                          Hijos & Dependientes Familiares
                        </h4>
                        <p className="text-[11px] text-slate-500">Datos registrados en dbo.ColaboradorHijos para prestaciones y SGMM</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => abrirModalHijos(colabFicha)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        title="Ver / Gestionar Hijos"
                      >
                        <Baby className="w-3.5 h-3.5" />
                        <span>Ver / Gestionar Hijos</span>
                      </button>
                      <span className="text-xs font-bold px-2.5 py-1 bg-pink-50 text-pink-700 rounded-full border border-pink-200">
                        {(fichaData?.hijos || []).length} {((fichaData?.hijos || []).length === 1) ? 'hijo registrado' : 'hijos registrados'}
                      </span>
                    </div>
                  </div>

                  {(!fichaData?.hijos || fichaData.hijos.length === 0) ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Baby className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-600">No cuenta con hijos o dependientes registrados</p>
                      <button
                        type="button"
                        onClick={() => abrirModalHijos(colabFicha)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Registrar Hijos</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {fichaData.hijos.map((h, i) => {
                        const fn = h.FechaNacimiento || h.fechaNacimiento;
                        const sx = (h.Sexo || h.sexo || '').toUpperCase();
                        const num = h.NumeroHijo || h.numeroHijo || (i + 1);
                        return (
                          <div key={h.IdHijo || h.idHijo || i} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                              #{num}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-black text-slate-800">Hijo #{num}</span>
                                {sx === 'M' ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">Niño</span>
                                ) : sx === 'F' ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 text-pink-800 rounded">Niña</span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">Indef.</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Nacimiento: <span className="font-mono text-slate-700">{fn ? new Date(fn).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'No capturada'}</span>
                              </p>
                              <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                                Edad: <span className="text-indigo-600">{calcularEdad(fn)}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pie Modal Ficha */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
              <span className="text-[11px] text-slate-400">
                Expediente consultado en tiempo real desde Microsoft SQL Server DESARROLLO_O
              </span>
              <button
                type="button"
                onClick={() => setColabFicha(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: GESTIÓN Y CONSULTA DE HIJOS / DEPENDIENTES (dbo.ColaboradorHijos) */}
      {colabHijos && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          {/* Overlay Semitransparente Independiente */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[60] transition-opacity" 
            onClick={() => setColabHijos(null)}
          />

          {/* Diálogo Centrado en Capa Superior */}
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 overflow-y-auto pointer-events-none">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in duration-100 pointer-events-auto relative z-[70] max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl">
                    <Baby className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-base">Hijos y Dependientes Registrados</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        {hijosList.length} {hijosList.length === 1 ? 'hijo' : 'hijos'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {formatearNombreColaborador(colabHijos)} <span className="font-mono text-slate-400">({colabHijos.CodigoEmpleado} • {colabHijos.Empresa})</span>
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setColabHijos(null)} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorHijos && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorHijos}</span>
                </div>
              )}

              {/* Listado de Hijos */}
              <div className="mt-4 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Descendientes Registrados en Base de Datos (dbo.ColaboradorHijos)
                </span>

                {loadingHijos ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                    Cargando información de hijos...
                  </div>
                ) : hijosList.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                    <Baby className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                    Este colaborador no tiene hijos registrados actualmente en el sistema.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-12 text-center">#</th>
                            <th className="py-2.5 px-3">Nombre Completo</th>
                            <th className="py-2.5 px-3">Fecha de Nacimiento</th>
                            <th className="py-2.5 px-3">Edad Actual</th>
                            <th className="py-2.5 px-3">Sexo</th>
                            <th className="py-2.5 px-3 text-center w-16">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {hijosList.map((hijo) => {
                            const edadTexto = hijo.EdadCalculada !== undefined && hijo.EdadCalculada !== null
                              ? `${hijo.EdadCalculada} ${hijo.EdadCalculada === 1 ? 'año' : 'años'}`
                              : calcularEdad(hijo.FechaNacimiento);
                            const isMasc = hijo.Sexo === 'M';
                            const isFem = hijo.Sexo === 'F';
                            return (
                              <tr key={hijo.IdHijo || hijo.NumeroHijo} className="hover:bg-purple-50/30 transition">
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                                    isMasc ? 'bg-blue-100 text-blue-700' :
                                    isFem ? 'bg-pink-100 text-pink-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    #{hijo.NumeroHijo}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {hijo.Nombre || <span className="text-slate-400 italic font-normal">Sin nombre registrado</span>}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                  {hijo.FechaNacimiento || <span className="text-slate-400">No registrada</span>}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-purple-700">
                                  {hijo.FechaNacimiento ? edadTexto : <span className="text-slate-400 font-normal">—</span>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isMasc ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                    isFem ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {isMasc ? 'Masculino' : isFem ? 'Femenino' : 'No especificado'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarHijo(hijo.IdHijo)}
                                    title="Eliminar registro de hijo"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Formulario para Agregar Nuevo Hijo */}
              <form onSubmit={handleAgregarHijo} className="mt-5 p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                  <Plus className="w-4 h-4 text-purple-700" />
                  <span>Registrar Nuevo Hijo para este Colaborador</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      No. de Hijo
                    </label>
                    <div className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-purple-800 flex items-center justify-center h-[34px]">
                      #{hijosList.length + 1} (Auto)
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nombre Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Sofía Hernández"
                      value={nuevoHijo.nombre || ''}
                      onChange={(e) => setNuevoHijo({ ...nuevoHijo, nombre: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-600 outline-none h-[34px]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Fecha de Nacimiento
                    </label>
                    <input
                      type="date"
                      value={nuevoHijo.fechaNacimiento || ''}
                      onChange={(e) => setNuevoHijo({ ...nuevoHijo, fechaNacimiento: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-600 outline-none h-[34px]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Sexo
                    </label>
                    <select
                      value={nuevoHijo.sexo || 'M'}
                      onChange={(e) => setNuevoHijo({ ...nuevoHijo, sexo: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-600 outline-none h-[34px]"
                    >
                      <option value="M">Masculino (M)</option>
                      <option value="F">Femenino (F)</option>
                      <option value="X">No especificado</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={guardandoHijo}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{guardandoHijo ? 'Registrando...' : 'Agregar Hijo a Expediente'}</span>
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Información protegida en tabla relacional <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">dbo.ColaboradorHijos</code>.
                </span>
                <button
                  type="button"
                  onClick={() => setColabHijos(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Carga Masiva de Saldos Iniciales (Excel) */}
      <ModalCargaMasivaSaldos
        isOpen={mostrarModalCargaMasiva}
        onClose={() => setMostrarModalCargaMasiva(false)}
        onSuccess={() => {
          cargarColaboradores();
          setToast('Carga masiva de saldos aplicada exitosamente.');
        }}
      />

    </div>
  );
}
