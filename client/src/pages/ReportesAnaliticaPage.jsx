import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Users, Calendar, Clock, AlertTriangle, 
  Download, Filter, RefreshCw, Search, ChevronRight, 
  BarChart3, CheckCircle2, Building2, CalendarDays, Eye, Sparkles,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { api } from '../api/client';
import { formatearNombreColaborador, compararPorApellidos } from '../utils/formatters';

export default function ReportesAnaliticaPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState('padron'); // 'padron', 'saldos', 'calendario'
  
  // Filtros Globales
  const [empresa, setEmpresa] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));

  // Datos
  const [padronData, setPadronData] = useState([]);
  const [saldosData, setSaldosData] = useState([]);
  const [saldosResumen, setSaldosResumen] = useState([]);
  const [calendarioData, setCalendarioData] = useState([]);
  const [traslapes, setTraslapes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Ordenamiento interactivo de tablas (por defecto A-Z por apellidos)
  const [sortDirectionPadron, setSortDirectionPadron] = useState('asc');
  const [sortDirectionSaldos, setSortDirectionSaldos] = useState('asc');

  function handleSortPadron() {
    const nextDir = sortDirectionPadron === 'asc' ? 'desc' : 'asc';
    setSortDirectionPadron(nextDir);
    setPadronData(prev => [...prev].sort((a, b) => compararPorApellidos(a.NombreCompleto, b.NombreCompleto, nextDir)));
  }

  function handleSortSaldos() {
    const nextDir = sortDirectionSaldos === 'asc' ? 'desc' : 'asc';
    setSortDirectionSaldos(nextDir);
    setSaldosData(prev => [...prev].sort((a, b) => compararPorApellidos(a.NombreCompleto, b.NombreCompleto, nextDir)));
  }

  // Sub-vista de Calendario: 'lista' o 'mensual'
  const [vistaCalendario, setVistaCalendario] = useState('lista');

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
        console.warn('Usando catálogo estático de empresas:', err);
      }
    }
    fetchEmpresas();
  }, []);

  useEffect(() => {
    cargarReporte();
  }, [activeTab, empresa, sucursal, departamento, mes, anio]);

  const MESES = [
    { num: '1', nombre: 'Enero' },
    { num: '2', nombre: 'Febrero' },
    { num: '3', nombre: 'Marzo' },
    { num: '4', nombre: 'Abril' },
    { num: '5', nombre: 'Mayo' },
    { num: '6', nombre: 'Junio' },
    { num: '7', nombre: 'Julio' },
    { num: '8', nombre: 'Agosto' },
    { num: '9', nombre: 'Septiembre' },
    { num: '10', nombre: 'Octubre' },
    { num: '11', nombre: 'Noviembre' },
    { num: '12', nombre: 'Diciembre' }
  ];

  async function cargarReporte() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (empresa) {
        params.append('empresa_id', empresa);
        params.append('empresa', empresa);
      }
      if (sucursal) params.append('sucursal', sucursal);
      if (departamento) params.append('departamento', departamento);

      if (activeTab === 'padron') {
        if (fechaInicio) params.append('fechaInicio', fechaInicio);
        if (fechaFin) params.append('fechaFin', fechaFin);
        const res = await api.getReportePadron(params.toString());
        if (res.success) {
          const sorted = [...(res.data || [])].sort((a, b) => compararPorApellidos(a.NombreCompleto, b.NombreCompleto, 'asc'));
          setPadronData(sorted);
          setSortDirectionPadron('asc');
        }
      } else if (activeTab === 'saldos') {
        const res = await api.getReporteSaldos(params.toString());
        if (res.success) {
          const sorted = [...(res.data || [])].sort((a, b) => compararPorApellidos(a.NombreCompleto, b.NombreCompleto, 'asc'));
          setSaldosData(sorted);
          setSortDirectionSaldos('asc');
          setSaldosResumen(res.resumenPorEmpresa || []);
        }
      } else if (activeTab === 'calendario') {
        if (mes) params.append('mes', mes);
        if (anio) params.append('anio', anio);
        const res = await api.getReporteCalendarioAusencias(params.toString());
        if (res.success) {
          setCalendarioData(res.data || []);
          setTraslapes(res.traslapes || []);
        }
      }
    } catch (err) {
      console.error('Error cargando reporte:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportarExcel() {
    try {
      setDownloading(true);
      const params = new URLSearchParams();
      if (empresa) {
        params.append('empresa_id', empresa);
        params.append('empresa', empresa);
      }
      if (sucursal) params.append('sucursal', sucursal);
      if (departamento) params.append('departamento', departamento);

      if (activeTab === 'padron') {
        if (fechaInicio) params.append('fechaInicio', fechaInicio);
        if (fechaFin) params.append('fechaFin', fechaFin);
        await api.descargarReportePadronExcel(params.toString());
      } else if (activeTab === 'saldos') {
        await api.descargarReporteSaldosExcel(params.toString());
      } else if (activeTab === 'calendario') {
        if (mes) params.append('mes', mes);
        if (anio) params.append('anio', anio);
        await api.descargarReporteCalendarioAusenciasExcel(params.toString());
      }
    } catch (err) {
      alert('Error descargando Excel: ' + err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Encabezado Principal */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
              Módulo de Analítica y Reportes
            </span>
            <span className="text-xs text-slate-400">• Exportación Oficial .XLSX</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Centro de Inteligencia y Reportería de Vacaciones
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Información consolidada de las 8 razones sociales con cálculos de LFT (Vacaciones Dignas) y monitoreo de ausencias.
          </p>
        </div>

        <button
          onClick={handleExportarExcel}
          disabled={downloading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{downloading ? 'Generando Excel...' : 'Exportar a Excel (.xlsx)'}</span>
          <Download className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* Pestañas de Selección de Reporte */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('padron')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'padron'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>1. Padrón y Estructura Organizacional</span>
        </button>

        <button
          onClick={() => setActiveTab('saldos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'saldos'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>2. Saldos y Kárdex LFT</span>
        </button>

        <button
          onClick={() => setActiveTab('calendario')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'calendario'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-purple-600" />
          <span>3. Calendario de Ausencias & Traslapes</span>
        </button>
      </div>

      {/* Barra de Filtros Globales en Cascada */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mr-1">
          <Filter className="w-4 h-4" />
          <span>Filtros:</span>
        </div>

        {/* Filtro Empresa */}
        <select
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none max-w-[210px]"
        >
          <option value="">Todas las Empresas ({empresasCatalog.length})</option>
          {empresasCatalog.map(emp => (
            <option key={emp.idEmpresa || emp.id} value={emp.idEmpresa || emp.id}>
              {emp.aliasEmpresa || emp.alias}
            </option>
          ))}
        </select>

        {/* Filtro Sucursal */}
        <input
          type="text"
          value={sucursal}
          onChange={(e) => setSucursal(e.target.value)}
          placeholder="Sucursal / Unidad..."
          className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none w-36"
        />

        {/* Filtro Departamento */}
        <input
          type="text"
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          placeholder="Departamento..."
          className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none w-36"
        />

        {/* Filtros específicos de Fechas o Mes/Año */}
        {activeTab === 'calendario' ? (
          <div className="flex items-center gap-2">
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none"
            >
              {MESES.map(m => (
                <option key={m.num} value={m.num}>{m.nombre}</option>
              ))}
            </select>

            <select
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-3 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              title="Fecha Alta Desde"
              className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none text-slate-600"
            />
            <span className="text-slate-400 text-xs">al</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              title="Fecha Alta Hasta"
              className="bg-slate-50 border border-slate-300 rounded-xl text-xs px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-600 outline-none text-slate-600"
            />
          </div>
        )}

        <button
          onClick={cargarReporte}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition ml-auto"
          title="Recargar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* REPORTE 1: PADRÓN DE COLABORADORES */}
      {activeTab === 'padron' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Padrón de Empleados Registrados ({padronData.length})
            </span>
            <span className="text-xs text-slate-500">
              Antigüedad calculada al corte de hoy
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={handleSortPadron}
                      className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition cursor-pointer"
                      title="Ordenar por apellidos (A - Z / Z - A)"
                    >
                      <span>Nombre Completo</span>
                      {sortDirectionPadron === 'asc' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                          A - Z <ArrowUp className="w-2.5 h-2.5 ml-0.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                          Z - A <ArrowDown className="w-2.5 h-2.5 ml-0.5" />
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Razón Social</th>
                  <th className="py-3 px-4">Sucursal</th>
                  <th className="py-3 px-4">Departamento</th>
                  <th className="py-3 px-4">Puesto</th>
                  <th className="py-3 px-4">Fecha Alta</th>
                  <th className="py-3 px-4 text-center">Antigüedad</th>
                  <th className="py-3 px-4">Jefe Directo</th>
                  <th className="py-3 px-4 text-center">Hijos</th>
                  <th className="py-3 px-4 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400">
                      Cargando padrón organizacional...
                    </td>
                  </tr>
                ) : padronData.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400">
                      No hay colaboradores que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  padronData.slice(0, 100).map(r => (
                    <tr key={r.IdColaborador} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.CodigoEmpleado}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{formatearNombreColaborador(r.NombreCompleto)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.Empresa}</td>
                      <td className="py-3 px-4 text-slate-600">{r.Sucursal}</td>
                      <td className="py-3 px-4 text-slate-600">{r.Departamento}</td>
                      <td className="py-3 px-4 text-slate-600">{r.Puesto}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{r.FechaAlta}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700 bg-blue-50/50">
                        {r.AntiguedadAnios} años
                      </td>
                      <td className="py-3 px-4 text-amber-900 font-medium">{formatearNombreColaborador(r.JefeDirecto)}</td>
                      <td className="py-3 px-4 text-center">
                        {r.TotalHijos > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] bg-purple-100 text-purple-800">
                            {r.TotalHijos} {r.TotalHijos === 1 ? 'hijo' : 'hijos'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          r.EstatusSistema === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {r.EstatusSistema}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {padronData.length > 100 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
              Mostrando los primeros 100 registros en vista previa. Para analizar los {padronData.length} registros completos, usa el botón <strong>Exportar a Excel (.xlsx)</strong>.
            </div>
          )}
        </div>
      )}

      {/* REPORTE 2: SALDOS Y KÁRDEX LFT */}
      {activeTab === 'saldos' && (
        <div className="space-y-6">
          
          {/* Tarjetas de Resumen por Empresa */}
          {saldosResumen.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {saldosResumen.map(res => (
                <div key={res.empresa} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 truncate" title={res.empresa}>{res.empresa}</span>
                    <span className="font-bold text-slate-500">{res.totalColaboradores} colabs</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">Días Disponibles:</span>
                    <span className="text-xl font-black text-emerald-700">{res.totalSaldoDisponible}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Gozados: {res.totalDiasGozados}</span>
                    <span>En Trámite: {res.totalDiasEnTramite}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla de Detalle de Saldos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Detalle Individual de Saldos y Disponibilidad ({saldosData.length} colaboradores activos)
              </span>
              <span className="text-xs text-slate-500 font-medium">Reforma LFT Vacaciones Dignas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={handleSortSaldos}
                        className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition cursor-pointer"
                        title="Ordenar por apellidos (A - Z / Z - A)"
                      >
                        <span>Colaborador</span>
                        {sortDirectionSaldos === 'asc' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            A - Z <ArrowUp className="w-2.5 h-2.5 ml-0.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            Z - A <ArrowDown className="w-2.5 h-2.5 ml-0.5" />
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Período Vigente</th>
                    <th className="py-3 px-4 text-center">Días Ley LFT</th>
                    <th className="py-3 px-4 text-center">Días Gozados</th>
                    <th className="py-3 px-4 text-center">En Trámite</th>
                    <th className="py-3 px-4 text-center">Saldo Disponible Real</th>
                    <th className="py-3 px-4 text-center">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        Calculando kárdex y saldos de vacaciones...
                      </td>
                    </tr>
                  ) : saldosData.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        No se encontraron registros de saldos activos.
                      </td>
                    </tr>
                  ) : (
                    saldosData.slice(0, 100).map(s => (
                      <tr key={s.IdColaborador} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.CodigoEmpleado}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{formatearNombreColaborador(s.NombreCompleto)}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{s.Empresa}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{s.PeriodoVigente}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{s.DiasLeyLFT}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{s.DiasGozados}</td>
                        <td className="py-3 px-4 text-center text-amber-600 font-semibold">{s.DiasEnTramite}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs">
                            {s.SaldoDisponibleReal} días
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 text-[11px] whitespace-nowrap">
                          {s.FechaVencimiento}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {saldosData.length > 100 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                Mostrando 100 de {saldosData.length} registros en pantalla. Usa el botón <strong>Exportar a Excel (.xlsx)</strong> para el kárdex consolidado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTE 3: CALENDARIO DE AUSENCIAS Y TRASLAPES */}
      {activeTab === 'calendario' && (
        <div className="space-y-6">
          
          {/* Alertas de Traslapes Operativos en el Mismo Departamento */}
          {traslapes.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-300 text-amber-950 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wider">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Atención: Se detectaron {traslapes.length} traslapes simultáneos de vacaciones</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Los siguientes colaboradores del mismo departamento y empresa tienen períodos aprobados o en trámite que se solapan en fechas. Revisa la cobertura operativa para evitar ausencias críticas:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {traslapes.map((t, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200 text-xs shadow-xs space-y-1">
                    <div className="font-extrabold text-slate-900 flex items-center justify-between">
                      <span>{t.departamento}</span>
                      <span className="text-[10px] text-slate-500">{t.empresa}</span>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      • <strong>{formatearNombreColaborador(t.colaborador1)}</strong>: {t.fechas1}
                    </div>
                    <div className="text-[11px] text-slate-700">
                      • <strong>{formatearNombreColaborador(t.colaborador2)}</strong>: {t.fechas2}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla de Ausencias Programadas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Programación de Vacaciones ({calendarioData.length} registros en período)
              </span>
              <span className="text-xs text-slate-500">
                Mes {mes} / {anio}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Folio</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Empresa / Sucursal</th>
                    <th className="py-3 px-4">Departamento / Puesto</th>
                    <th className="py-3 px-4">Período de Ausencia</th>
                    <th className="py-3 px-4 text-center">Días Hábiles</th>
                    <th className="py-3 px-4">Jefe Directo</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-400">
                        Cargando calendario de ausencias...
                      </td>
                    </tr>
                  ) : calendarioData.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-400">
                        No hay ausencias programadas en el mes y año seleccionados.
                      </td>
                    </tr>
                  ) : (
                    calendarioData.map(a => (
                      <tr key={a.IdSolicitud} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">{a.Folio}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{formatearNombreColaborador(a.NombreCompleto)}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 block">{a.Empresa}</span>
                          <span className="text-[11px] text-slate-400">{a.Sucursal || 'Matriz'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-800 font-medium block">{a.Departamento || 'General'}</span>
                          <span className="text-[11px] text-slate-400">{a.Puesto}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {a.FechaInicio} al {a.FechaFin}
                        </td>
                        <td className="py-3 px-4 text-center font-black text-blue-700 bg-blue-50/50">
                          {a.TotalDiasLaborables} días
                        </td>
                        <td className="py-3 px-4 text-amber-900 font-medium">{formatearNombreColaborador(a.JefeDirectoNombre || '—')}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            a.Estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-800' :
                            a.Estado === 'PENDIENTE_DO' ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {a.Estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
