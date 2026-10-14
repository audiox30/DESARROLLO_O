import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, 
  XCircle, X, RefreshCw, FileText, ArrowRight, ShieldCheck, HelpCircle 
} from 'lucide-react';
import { api } from '../api/client';

function formatFechaCelda(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().substring(0, 10);
  }
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return s;
}

export default function ModalCargaMasivaSaldos({ isOpen, onClose, onSuccess }) {
  const [archivo, setArchivo] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [analizando, setAnalizando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [filtroVista, setFiltroVista] = useState('todos'); // 'todos' | 'validos' | 'errores'
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDescargarPlantilla = async () => {
    try {
      setDescargandoPlantilla(true);
      await api.descargarPlantillaSaldosExcel();
    } catch (err) {
      console.error('Error descargando plantilla:', err);
      setErrorGlobal('No se pudo descargar la plantilla oficial.');
    } finally {
      setDescargandoPlantilla(false);
    }
  };

  const procesarArchivo = (file) => {
    if (!file) return;
    setErrorGlobal('');
    setResultado(null);
    setArchivo(file);
    setAnalizando(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length < 2) {
          setErrorGlobal('El archivo está vacío o no contiene suficientes filas.');
          setAnalizando(false);
          return;
        }

        // Buscar fila de encabezados
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
          const rowText = rawJson[i].map(c => String(c).trim().toLowerCase()).join(' ');
          if (rowText.includes('nomina') || rowText.includes('empleado') || rowText.includes('periodo') || rowText.includes('saldo')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
        }

        const headers = rawJson[headerRowIndex].map(h => String(h || '').trim());
        const dataRows = rawJson.slice(headerRowIndex + 1);

        // Mapeo flexible por nombres oficiales
        const colIndices = {
          empresa: headers.findIndex(h => /empresa|razon|razón/i.test(h)),
          codigo: headers.findIndex(h => /num_nomina|n[oó]mina|c[oó]digo|empleado/i.test(h)),
          periodo: headers.findIndex(h => /periodo_ejercicio|per[ií]odo|ejercicio|ciclo/i.test(h)),
          diasDerecho: headers.findIndex(h => /dias_derecho_lft|derecho|ley|correspondientes/i.test(h)),
          diasGozados: headers.findIndex(h => /dias_gozados|gozados|disfrutados|tomados/i.test(h)),
          diasRestantes: headers.findIndex(h => /dias_restantes|restantes|saldo|disponible/i.test(h)),
          fechaAniversario: headers.findIndex(h => /fecha_aniversario|aniversario|inicio/i.test(h)),
          fechaVence18m: headers.findIndex(h => /fecha_vence_18m|fecha_limite_vigencia|limite|vence|caducidad|fin/i.test(h)),
          motivo: headers.findIndex(h => /motivo_ajuste|motivo|observaci[oó]n|raz[oó]n/i.test(h))
        };

        const parsed = [];
        dataRows.forEach((row, idx) => {
          if (!row || row.every(c => c === '' || c === null || c === undefined)) return;

          const empresa = colIndices.empresa !== -1 ? String(row[colIndices.empresa] || '').trim() : '';
          const codigo = colIndices.codigo !== -1 ? String(row[colIndices.codigo] || '').trim() : String(row[1] || row[0] || '').trim();
          const periodo = colIndices.periodo !== -1 ? String(row[colIndices.periodo] || '').trim() : '';
          
          const derechoRaw = colIndices.diasDerecho !== -1 ? row[colIndices.diasDerecho] : '';
          const gozadosRaw = colIndices.diasGozados !== -1 ? row[colIndices.diasGozados] : 0;
          const restantesRaw = colIndices.diasRestantes !== -1 ? row[colIndices.diasRestantes] : '';

          const fechaAnivRaw = colIndices.fechaAniversario !== -1 ? formatFechaCelda(row[colIndices.fechaAniversario]) : '';
          const fechaVenceRaw = colIndices.fechaVence18m !== -1 ? formatFechaCelda(row[colIndices.fechaVence18m]) : '';
          const motivo = colIndices.motivo !== -1 ? String(row[colIndices.motivo] || '').trim() : 'Carga inicial conciliada DO';

          const filaNum = headerRowIndex + idx + 2;
          const errores = [];

          if (!codigo) {
            errores.push('Falta el número de nómina');
          }
          if (!periodo) {
            errores.push('Falta el período (ej. 2024-2025)');
          }

          const derechoNum = Number(derechoRaw);
          const gozadosNum = Number(gozadosRaw);
          let restantesNum = restantesRaw !== '' ? Number(restantesRaw) : (derechoNum - gozadosNum);

          if (derechoRaw === '' || isNaN(derechoNum) || derechoNum < 0) {
            errores.push('Días por Ley LFT debe ser un número entero >= 0');
          }
          if (isNaN(gozadosNum) || gozadosNum < 0) {
            errores.push('Días Gozados debe ser un número entero >= 0');
          }
          if (isNaN(restantesNum) || restantesNum < 0) {
            errores.push('Días Restantes debe ser un número entero >= 0');
          }

          if (!isNaN(derechoNum) && !isNaN(gozadosNum) && !isNaN(restantesNum)) {
            if ((gozadosNum + restantesNum) > derechoNum) {
              errores.push(`Gozados (${gozadosNum}) + Restantes (${restantesNum}) excede Días LFT (${derechoNum})`);
            } else if (restantesNum !== (derechoNum - gozadosNum)) {
              errores.push(`Restantes (${restantesNum}) != Derecho (${derechoNum}) - Gozados (${gozadosNum})`);
            }
          }

          parsed.push({
            fila: filaNum,
            empresa,
            codigoEmpleado: codigo,
            periodo,
            diasDerechoLFT: isNaN(derechoNum) ? 0 : Math.floor(derechoNum),
            diasGozados: isNaN(gozadosNum) ? 0 : Math.floor(gozadosNum),
            diasRestantes: isNaN(restantesNum) ? 0 : Math.floor(restantesNum),
            fechaAniversario: fechaAnivRaw,
            fechaVence18M: fechaVenceRaw,
            motivo: motivo || 'Carga inicial conciliada DO',
            esValido: errores.length === 0,
            errores
          });
        });

        if (parsed.length === 0) {
          setErrorGlobal('No se detectaron registros de datos válidos en la hoja de Excel.');
        }

        setRegistros(parsed);
      } catch (err) {
        console.error('Error parseando Excel:', err);
        setErrorGlobal('Ocurrió un error al procesar el archivo Excel. Asegúrese de que sea un archivo .xlsx válido.');
      } finally {
        setAnalizando(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      procesarArchivo(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      procesarArchivo(e.target.files[0]);
    }
  };

  const handleImportar = async () => {
    const validos = registros.filter(r => r.esValido);
    if (validos.length === 0) {
      setErrorGlobal('No hay registros válidos para importar.');
      return;
    }

    try {
      setProcesando(true);
      setErrorGlobal('');
      const payload = validos.map(r => ({
        empresa: r.empresa,
        num_nomina: r.codigoEmpleado,
        periodo_ejercicio: r.periodo,
        dias_derecho_lft: r.diasDerechoLFT,
        dias_gozados: r.diasGozados,
        dias_restantes: r.diasRestantes,
        fecha_aniversario: r.fechaAniversario,
        fecha_vence_18m: r.fechaVence18M,
        motivo_ajuste: r.motivo
      }));

      const res = await api.cargarSaldosMasivos(payload);
      setResultado(res);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error importando saldos masivos:', err);
      setErrorGlobal(err.message || 'Error al aplicar los saldos iniciales en el servidor.');
    } finally {
      setProcesando(false);
    }
  };

  const totalValidos = registros.filter(r => r.esValido).length;
  const totalErrores = registros.filter(r => !r.esValido).length;

  const registrosAMostrar = registros.filter(r => {
    if (filtroVista === 'validos') return r.esValido;
    if (filtroVista === 'errores') return !r.esValido;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-100 my-8 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Carga Masiva de Saldos Iniciales por Período
                </h3>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block mt-0.5">
                  Importación por Ciclo LFT (Días Gozados y Restantes)
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 max-w-3xl">
              Importa o concilia saldos iniciales fila por fila a nivel <strong>período</strong> (ej. 2024-2025, 2025-2026). Cada ciclo conserva su fecha de vigencia legal de 18 meses y audita en la bitácora institucional.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            title="Cerrar modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Resultado Exitoso */}
        {resultado ? (
          <div className="p-6 my-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-black text-slate-900">
              ¡Períodos de Vacaciones Importados Exitosamente!
            </h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Se han registrado y actualizado <strong>{resultado.actualizados || 0}</strong> períodos en la base de datos de Grupo JAMA, con bitácora de auditoría completa.
            </p>

            {resultado.errores && resultado.errores.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left max-w-lg mx-auto text-xs text-amber-900">
                <span className="font-bold block mb-1">Observaciones / Filas con error ({resultado.errores.length}):</span>
                <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                  {resultado.errores.map((err, i) => (
                    <li key={i}>Fila {err.fila || '-'}: {err.error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Cerrar y Ver Catálogo Actualizado
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            
            {/* Barra Superior con Botón de Descargar Plantilla */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    Paso 1: Descargar Plantilla Oficial por Período (.xlsx)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Columnas oficiales: <code>EMPRESA, NUM_NOMINA, PERIODO_EJERCICIO, DIAS_DERECHO_LFT, DIAS_GOZADOS, DIAS_RESTANTES, FECHA_ANIVERSARIO, FECHA_VENCE_18M, MOTIVO_AJUSTE</code>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDescargarPlantilla}
                disabled={descargandoPlantilla}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer"
              >
                <Download className={`w-3.5 h-3.5 ${descargandoPlantilla ? 'animate-bounce text-blue-600' : 'text-slate-600'}`} />
                <span>{descargandoPlantilla ? 'Descargando...' : 'Descargar Plantilla Oficial (.xlsx)'}</span>
              </button>
            </div>

            {/* Zona Drag & Drop */}
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer select-none ${
                archivo 
                  ? 'bg-emerald-50/40 border-emerald-400' 
                  : 'bg-slate-50/70 hover:bg-slate-100/60 border-slate-300 hover:border-blue-400'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <Upload className={`w-10 h-10 mx-auto mb-2 ${archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
              <p className="text-xs font-bold text-slate-800">
                {archivo ? archivo.name : 'Arrastra tu archivo Excel aquí o haz clic para seleccionarlo'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Formatos compatibles: Microsoft Excel (.xlsx, .xls)
              </p>
            </div>

            {/* Error Global */}
            {errorGlobal && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorGlobal}</span>
              </div>
            )}

            {/* Vista Previa de Registros */}
            {registros.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Vista Previa ({registros.length} períodos detectados)
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {totalValidos} listos
                    </span>
                    {totalErrores > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        {totalErrores} con observaciones
                      </span>
                    )}
                  </div>

                  {/* Selector de filtro de vista */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFiltroVista('todos')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        filtroVista === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos ({registros.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroVista('validos')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        filtroVista === 'validos' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      Válidos ({totalValidos})
                    </button>
                    {totalErrores > 0 && (
                      <button
                        type="button"
                        onClick={() => setFiltroVista('errores')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          filtroVista === 'errores' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        Errores ({totalErrores})
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabla de Registros */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider z-10">
                      <tr>
                        <th className="py-2.5 px-2 text-center">#</th>
                        <th className="py-2.5 px-2.5">Empresa</th>
                        <th className="py-2.5 px-2.5">Nómina</th>
                        <th className="py-2.5 px-2.5">Período</th>
                        <th className="py-2.5 px-2 text-center">Días Ley</th>
                        <th className="py-2.5 px-2 text-center">Gozados</th>
                        <th className="py-2.5 px-2 text-center">Restantes</th>
                        <th className="py-2.5 px-2.5">Aniversario</th>
                        <th className="py-2.5 px-2.5">Vence 18m</th>
                        <th className="py-2.5 px-2.5">Motivo</th>
                        <th className="py-2.5 px-2.5 text-right">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registrosAMostrar.map((r, i) => (
                        <tr key={i} className={r.esValido ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/70'}>
                          <td className="py-2 px-2 text-center font-mono text-slate-400">#{r.fila}</td>
                          <td className="py-2 px-2.5 text-slate-800 font-medium truncate max-w-[130px]" title={r.empresa}>
                            {r.empresa || '—'}
                          </td>
                          <td className="py-2 px-2.5 font-bold font-mono text-slate-900">{r.codigoEmpleado || '—'}</td>
                          <td className="py-2 px-2.5 font-bold font-mono text-blue-900">{r.periodo}</td>
                          <td className="py-2 px-2 text-center font-bold text-slate-700">{r.diasDerechoLFT}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{r.diasGozados}</td>
                          <td className="py-2 px-2 text-center">
                            <span className="font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {r.diasRestantes}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-mono text-slate-600 text-[11px]">{r.fechaAniversario || '—'}</td>
                          <td className="py-2 px-2.5 font-mono text-slate-600 text-[11px]">{r.fechaVence18M || '—'}</td>
                          <td className="py-2 px-2.5 text-slate-600 truncate max-w-[140px]" title={r.motivo}>
                            {r.motivo}
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            {r.esValido ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Válido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full" title={r.errores.join(' • ')}>
                                <XCircle className="w-3 h-3" />
                                {r.errores[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!resultado && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Transacción segura: actualiza cada ciclo en <code>dbo.SaldosVacaciones</code> y audita en <code>dbo.BitacoraAjustesSaldo</code>.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={procesando}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer flex-1 sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportar}
                disabled={procesando || totalValidos === 0}
                className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs flex-1 sm:flex-none cursor-pointer ${
                  procesando || totalValidos === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                }`}
              >
                {procesando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando períodos en BD...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aplicar e Importar {totalValidos > 0 ? `(${totalValidos})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
