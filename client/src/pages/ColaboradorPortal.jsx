import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  FileText, Ban, Sparkles, RefreshCw, Baby, User, Heart, Phone, Shield, Briefcase, Trash2
} from 'lucide-react';
import { api } from '../api/client';
import StatCards from '../components/StatCards';
import KardexVacaciones from '../components/KardexVacaciones';
import ModalNuevaSolicitud from '../components/ModalNuevaSolicitud';
import ModalDesgloseSaldo from '../components/ModalDesgloseSaldo';
import RefreshButton from '../components/RefreshButton';
import { formatearNombreColaborador } from '../utils/formatters';

function formatFechaUI(fecha) {
  if (!fecha) return '—';
  try {
    const s = String(fecha).substring(0, 10);
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [y, m, d] = parts;
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mesNombre = meses[parseInt(m, 10) - 1] || m;
      return `${d} ${mesNombre} ${y}`;
    }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
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

export default function ColaboradorPortal({ currentUser }) {
  const [saldoData, setSaldoData] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalDesgloseAbierto, setModalDesgloseAbierto] = useState(false);
  const [subTab, setSubTab] = useState('solicitudes'); // 'solicitudes', 'kardex', 'perfil'
  const [descargandoId, setDescargandoId] = useState(null);
  const [toastError, setToastError] = useState('');
  const [toastSuccess, setToastSuccess] = useState('');

  // Datos del perfil y dependientes
  const [perfilColab, setPerfilColab] = useState(null);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [formNuevoHijo, setFormNuevoHijo] = useState({ nombre: '', fechaNacimiento: '', sexo: 'M' });
  const [guardandoHijo, setGuardandoHijo] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    cargarDatos();
    cargarPerfil();
  }, [currentUser]);

  function mostrarToast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  }

  async function cargarPerfil() {
    try {
      setLoadingPerfil(true);
      const colabId = currentUser?.id || currentUser?.id_colaborador;
      if (colabId) {
        const res = await api.getColaborador(colabId);
        if (res.success) {
          setPerfilColab(res.data);
        }
      }
    } catch (err) {
      console.warn('No se pudo cargar perfil extendido:', err);
    } finally {
      setLoadingPerfil(false);
    }
  }

  async function handleAgregarHijoColaborador(e) {
    e.preventDefault();
    const colabId = currentUser?.id || currentUser?.id_colaborador;
    if (!colabId) return;
    if (!formNuevoHijo.nombre || !formNuevoHijo.nombre.trim()) {
      alert('Debe ingresar el nombre completo del hijo o dependiente.');
      return;
    }
    try {
      setGuardandoHijo(true);
      const res = await api.agregarHijo(colabId, {
        ...formNuevoHijo,
        nombre: formNuevoHijo.nombre.trim()
      });
      if (res.success) {
        mostrarToast('Hijo/dependiente registrado exitosamente.');
        setFormNuevoHijo({ nombre: '', fechaNacimiento: '', sexo: 'M' });
        cargarPerfil();
      }
    } catch (err) {
      alert('Error registrando hijo: ' + err.message);
    } finally {
      setGuardandoHijo(false);
    }
  }

  async function handleEliminarHijoColaborador(idHijo) {
    const colabId = currentUser?.id || currentUser?.id_colaborador;
    if (!colabId) return;
    if (!window.confirm('¿Confirmas la eliminación de este registro de hijo/dependiente?')) return;
    try {
      const res = await api.eliminarHijo(colabId, idHijo);
      if (res.success) {
        mostrarToast('Registro de hijo/dependiente eliminado.');
        cargarPerfil();
      }
    } catch (err) {
      alert('Error eliminando hijo: ' + err.message);
    }
  }

  async function cargarDatos() {
    try {
      setLoading(true);
      const [saldoRes, solRes] = await Promise.all([
        api.getMiSaldo(),
        api.getMisSolicitudes()
      ]);

      if (saldoRes.success) setSaldoData(saldoRes);
      if (solRes.success) setSolicitudes(solRes.data || []);
    } catch (err) {
      console.error('Error cargando portal colaborador:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDescargarPdf(idSolicitud, folio) {
    const id = idSolicitud || folio;
    if (!id) {
      setToastError('No se pudo identificar la solicitud para generar el Formato FDO-84.');
      setTimeout(() => setToastError(''), 5000);
      return;
    }

    try {
      setDescargandoId(idSolicitud);
      setToastError('');
      await api.descargarPdfFdo84(idSolicitud, folio);
    } catch (err) {
      console.error('[Error generando PDF FDO-84]', err);
      setToastError(err.message || 'No se pudo generar o descargar el Formato Oficial FDO-84.');
      setTimeout(() => setToastError(''), 6000);
    } finally {
      setDescargandoId(null);
    }
  }

  async function handleCancelar(id) {
    if (!window.confirm('¿Seguro que deseas cancelar esta solicitud de vacaciones?')) return;
    try {
      const res = await api.cancelarSolicitud(id);
      if (res.success) {
        cargarDatos();
      }
    } catch (err) {
      alert('Error cancelando: ' + err.message);
    }
  }

  const estadoBadge = {
    'PENDIENTE_LIDER': {
      label: 'Pendiente de Líder',
      classes: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: Clock
    },
    'PENDIENTE_DO': {
      label: 'Pendiente VoBo DO',
      classes: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Clock
    },
    'APROBADA': {
      label: 'Aprobada',
      classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: CheckCircle2
    },
    'RECHAZADA': {
      label: 'Rechazada',
      classes: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: XCircle
    },
    'CANCELADA': {
      label: 'Cancelada',
      classes: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: Ban
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida y Acciones */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Bienvenido, {formatearNombreColaborador(currentUser?.nombreCompleto || 'Colaborador')}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Activo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser?.puesto} • {currentUser?.departamento} • {currentUser?.empresa}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <RefreshButton
            onClick={cargarDatos}
            isLoading={loading}
            label="Actualizar Saldo y Solicitudes"
            loadingLabel="Actualizando..."
          />

          <button
            onClick={() => setModalAbierto(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nueva Solicitud de Vacaciones
          </button>
        </div>
      </div>

      {/* Métricas Principales de Saldos LFT */}
      <StatCards 
        resumen={saldoData?.resumen} 
        colaborador={saldoData?.colaborador} 
        onAbrirDesglose={() => setModalDesgloseAbierto(true)}
      />

      {/* Subnavegación: Solicitudes vs Kárdex */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex items-center gap-4 px-6 pt-4 border-b border-slate-100">
          <button
            onClick={() => setSubTab('solicitudes')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              subTab === 'solicitudes'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Mis Solicitudes Registradas ({solicitudes.length})
          </button>

          <button
            onClick={() => setSubTab('kardex')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              subTab === 'kardex'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Kárdex de Períodos LFT
          </button>

          <button
            onClick={() => setSubTab('perfil')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'perfil'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Baby className="w-4 h-4 text-pink-500" />
            Mi Expediente & Familia {perfilColab?.hijos ? `(${perfilColab.hijos.length})` : ''}
          </button>
        </div>

        {toastMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="p-6">
          {/* Toast / Alerta de Error en PDF u Operación */}
          {toastError && (
            <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{toastError}</div>
              <button 
                type="button" 
                onClick={() => setToastError('')}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2 text-sm leading-none"
              >
                ×
              </button>
            </div>
          )}

          {subTab === 'solicitudes' ? (
            <div>
              {solicitudes.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">No tienes solicitudes registradas aún</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Programa tu período de descanso seleccionando las fechas en nuestro simulador en tiempo real.
                  </p>
                  <button
                    onClick={() => setModalAbierto(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    Crear primera solicitud
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="pb-3 px-3">Folio</th>
                        <th className="pb-3 px-3">Período Solicitado</th>
                        <th className="pb-3 px-3 text-center">Días Hábiles</th>
                        <th className="pb-3 px-3">Fecha de Creación</th>
                        <th className="pb-3 px-3">Estado</th>
                        <th className="pb-3 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {solicitudes.map((s, idx) => {
                        const idSol = s.idSolicitud || s.IdSolicitud || s.id;
                        const folio = s.folio || s.Folio || (idSol ? `VAC-${idSol}` : '—');
                        const fechaInicio = s.fechaInicio || s.FechaInicio || '—';
                        const fechaFin = s.fechaFin || s.FechaFin || '—';
                        const totalDias = s.totalDiasLaborables ?? s.TotalDiasLaborables ?? s.diasHabiles ?? s.total_dias ?? 0;
                        const fechaCreacion = s.fechaCreacion || s.FechaCreacion;
                        const estado = s.estado || s.Estado || 'PENDIENTE_LIDER';
                        const badge = estadoBadge[estado] || estadoBadge['PENDIENTE_LIDER'];
                        const Icon = badge.icon;
                        const esCancelable = ['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(estado);
                        const motivoRechazo = s.motivoRechazo || s.MotivoRechazo;
                        const motivoComentarios = s.motivoComentarios || s.MotivoComentarios;

                        return (
                          <tr key={idSol || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                              {folio}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="font-bold text-slate-800">{fechaInicio}</span>
                              <span className="text-slate-400 mx-1.5">al</span>
                              <span className="font-bold text-slate-800">{fechaFin}</span>
                              {motivoComentarios && (
                                <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                  {motivoComentarios}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg font-black text-blue-700 bg-blue-50 border border-blue-100">
                                {totalDias} días
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {formatFechaUI(fechaCreacion)}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.classes}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {badge.label}
                              </span>
                              {motivoRechazo && (
                                <p className="text-[11px] text-rose-600 font-medium mt-1">
                                  Motivo: {motivoRechazo}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDescargarPdf(idSol, folio)}
                                  disabled={descargandoId === idSol}
                                  title="Ver y Descargar Formato Oficial FDO-84 (PDF)"
                                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  {descargandoId === idSol ? (
                                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                  <span>{descargandoId === idSol ? 'Abriendo...' : 'Formato FDO-84'}</span>
                                </button>
                                {esCancelable && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelar(idSol)}
                                    className="text-slate-400 hover:text-rose-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : subTab === 'kardex' ? (
            <KardexVacaciones 
              periodos={saldoData?.periodos} 
              colaborador={saldoData?.colaborador} 
              resumen={saldoData?.resumen}
            />
          ) : (
            /* SubTab 3: Mi Expediente & Familia */
            <div className="space-y-6">
              {loadingPerfil ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-semibold">Cargando expediente personal...</p>
                </div>
              ) : (
                <>
                  {/* Resumen Ficha y Datos Laborales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        <span>Datos Laborales & Empresa</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Empresa:</span>
                          <span className="font-semibold text-slate-800">{perfilColab?.Empresa || currentUser?.empresa || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Nómina / Código:</span>
                          <span className="font-mono font-bold text-slate-800">{perfilColab?.CodigoEmpleado || currentUser?.codigoEmpleado || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Departamento:</span>
                          <span className="font-semibold text-slate-800">{perfilColab?.Departamento || currentUser?.departamento || 'General'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Puesto:</span>
                          <span className="font-semibold text-slate-800">{perfilColab?.Puesto || currentUser?.puesto || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Jefe Directo:</span>
                          <span className="font-semibold text-amber-800">{perfilColab?.JefeDirectoNombre || 'Sin Jefe Asignado'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Días de Descanso:</span>
                          <span className="font-semibold text-slate-800">{perfilColab?.DiasDescanso || 'Domingos'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-rose-600" />
                        <span>Contacto de Emergencia & Salud</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Contacto de Emergencia:</span>
                          <span className="font-bold text-slate-800">{perfilColab?.AvisarEmergencia || 'Sin registrar'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Parentesco:</span>
                          <span className="font-semibold text-slate-800">{perfilColab?.ParentescoEmergencia || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Teléfono Emergencia:</span>
                          <span className="font-mono font-bold text-rose-700">{perfilColab?.TelefonoEmergencia || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tipo de Sangre:</span>
                          <span className="font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{perfilColab?.TipoSangre || 'No registrado'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Alergias / Padecimientos:</span>
                          <span className="font-medium text-slate-700">{perfilColab?.AlergiasPadecimientos || 'Ninguna'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección Hijos / Dependientes Familiares */}
                  <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center">
                          <Baby className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">
                            Mis Hijos & Dependientes Familiares
                          </h4>
                          <p className="text-xs text-slate-500">
                            Registro en nómina (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">dbo.ColaboradorHijos</code>) para prestaciones y eventos familiares.
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-pink-50 text-pink-700 font-bold rounded-full text-xs border border-pink-200">
                        {(perfilColab?.hijos || []).length} {((perfilColab?.hijos || []).length === 1) ? 'hijo registrado' : 'hijos registrados'}
                      </span>
                    </div>

                    {/* Grid de Hijos */}
                    <div className="mt-4">
                      {(!perfilColab?.hijos || perfilColab.hijos.length === 0) ? (
                        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                          <Baby className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-700">Aún no tienes hijos registrados en tu expediente</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                            Puedes dar de alta a tus dependientes utilizando el formulario inferior para que sean contemplados en prestaciones institucionales.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {perfilColab.hijos.map((h, i) => {
                            const fn = h.FechaNacimiento || h.fechaNacimiento;
                            const sx = (h.Sexo || h.sexo || '').toUpperCase();
                            const num = h.NumeroHijo || h.numeroHijo || (i + 1);
                            const nom = (h.Nombre || h.nombre || '').trim();
                            const idH = h.IdHijo || h.idHijo;
                            return (
                              <div key={idH || i} className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-start justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                                    #{num}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-black text-slate-900 truncate">
                                        Hijo #{num}{nom ? ` • ${nom}` : ''}
                                      </span>
                                      {sx === 'M' ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded shrink-0">Niño</span>
                                      ) : sx === 'F' ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 text-pink-800 rounded shrink-0">Niña</span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">Indef.</span>
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
                                {idH && (
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarHijoColaborador(idH)}
                                    className="p-1 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                    title="Eliminar dependiente"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Formulario para Registrar Nuevo Hijo */}
                    <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <h5 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-blue-600" />
                        <span>Registrar Nuevo Hijo o Dependiente</span>
                      </h5>
                      <form onSubmit={handleAgregarHijoColaborador} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Nombre Completo del Hijo / Dependiente <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Juan Pérez García"
                            value={formNuevoHijo.nombre}
                            onChange={(e) => setFormNuevoHijo({ ...formNuevoHijo, nombre: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                            required
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Fecha de Nacimiento <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={formNuevoHijo.fechaNacimiento}
                            onChange={(e) => setFormNuevoHijo({ ...formNuevoHijo, fechaNacimiento: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Sexo
                          </label>
                          <select
                            value={formNuevoHijo.sexo}
                            onChange={(e) => setFormNuevoHijo({ ...formNuevoHijo, sexo: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                          >
                            <option value="M">👦 Masculino</option>
                            <option value="F">👧 Femenino</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <button
                            type="submit"
                            disabled={guardandoHijo}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{guardandoHijo ? 'Registrando...' : 'Registrar Hijo'}</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva Solicitud */}
      <ModalNuevaSolicitud
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        saldoDisponible={saldoData?.resumen?.diasDisponibles || 0}
        diasDescanso={saldoData?.colaborador?.diasDescanso || 'DOMINGO'}
        onSuccess={() => {
          cargarDatos();
        }}
      />

      {/* Modal Desglose Interactivo de Saldo y Vigencias (18 Meses LFT) */}
      <ModalDesgloseSaldo
        isOpen={modalDesgloseAbierto}
        onClose={() => setModalDesgloseAbierto(false)}
        saldoData={saldoData}
        onNuevaSolicitud={() => setModalAbierto(true)}
      />
    </div>
  );
}
