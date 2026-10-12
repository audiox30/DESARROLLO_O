const fs = require('fs');
const path = require('path');
const { calcularDiasLFT, calcularAntiguedad, generarPeriodosVacaciones } = require('../services/lftVacacionesService');
const { calcularDetalleDias } = require('../services/diasHabilesService');

const SEED_DATA_PATH = path.resolve(__dirname, 'seedData.json');

// Catálogo de las 8 Empresas de CONTPAQi Nóminas en Grupo JAMA
const EMPRESAS_NOMIPAQ_CATALOGO = [
  { idEmpresa: 1, nombreBaseDatos: 'ctCEMENTOS_MOCTEZ', aliasEmpresa: 'CEMENTOS MOCTEZUMA', activa: true },
  { idEmpresa: 2, nombreBaseDatos: 'ctCONSTRUJAMA_DE_', aliasEmpresa: 'CONSTRUJAMA DE MEXICO S.A. DE C.V.', activa: true },
  { idEmpresa: 3, nombreBaseDatos: 'ctCONTROLADORA_JA', aliasEmpresa: 'CONTROLADORA JAMA, S.C.', activa: true },
  { idEmpresa: 4, nombreBaseDatos: 'ctDISTRIBUIDOR_DE', aliasEmpresa: 'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.', activa: true },
  { idEmpresa: 5, nombreBaseDatos: 'ctDISTRIBUIDORA_J', aliasEmpresa: 'DISTRIBUIDORA JAMA', activa: true },
  { idEmpresa: 6, nombreBaseDatos: 'ctIMPULSORA_DE_NE', aliasEmpresa: 'IMPULSORA DE NEGOCIOS', activa: true },
  { idEmpresa: 7, nombreBaseDatos: 'ctLATINO_CONCRETO', aliasEmpresa: 'LATINO CONCRETOS', activa: true },
  { idEmpresa: 8, nombreBaseDatos: 'ctTRAMO_DEL_CENTR', aliasEmpresa: 'TRAMO DEL CENTRO', activa: true }
];

// Días Inhábiles Iniciales (LFT Art. 74 México y Asuetos)
const festivosOficialesMexico = [
  // 2024
  { fecha: '2024-01-01', descripcion: 'Año Nuevo', esFeriadoOficial: true, activo: true },
  { fecha: '2024-02-05', descripcion: 'Día de la Constitución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2024-03-18', descripcion: 'Natalicio de Benito Juárez', esFeriadoOficial: true, activo: true },
  { fecha: '2024-03-28', descripcion: 'Jueves Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2024-03-29', descripcion: 'Viernes Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2024-05-01', descripcion: 'Día del Trabajo', esFeriadoOficial: true, activo: true },
  { fecha: '2024-09-16', descripcion: 'Día de la Independencia de México', esFeriadoOficial: true, activo: true },
  { fecha: '2024-10-01', descripcion: 'Transmisión del Poder Ejecutivo Federal', esFeriadoOficial: true, activo: true },
  { fecha: '2024-11-18', descripcion: 'Revolución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2024-12-25', descripcion: 'Navidad', esFeriadoOficial: true, activo: true },
  
  // 2025
  { fecha: '2025-01-01', descripcion: 'Año Nuevo', esFeriadoOficial: true, activo: true },
  { fecha: '2025-02-03', descripcion: 'Día de la Constitución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2025-03-17', descripcion: 'Natalicio de Benito Juárez', esFeriadoOficial: true, activo: true },
  { fecha: '2025-04-17', descripcion: 'Jueves Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2025-04-18', descripcion: 'Viernes Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2025-05-01', descripcion: 'Día del Trabajo', esFeriadoOficial: true, activo: true },
  { fecha: '2025-09-16', descripcion: 'Día de la Independencia de México', esFeriadoOficial: true, activo: true },
  { fecha: '2025-11-17', descripcion: 'Revolución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2025-12-25', descripcion: 'Navidad', esFeriadoOficial: true, activo: true },

  // 2026
  { fecha: '2026-01-01', descripcion: 'Año Nuevo', esFeriadoOficial: true, activo: true },
  { fecha: '2026-02-02', descripcion: 'Día de la Constitución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2026-03-16', descripcion: 'Natalicio de Benito Juárez', esFeriadoOficial: true, activo: true },
  { fecha: '2026-04-02', descripcion: 'Jueves Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2026-04-03', descripcion: 'Viernes Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2026-05-01', descripcion: 'Día del Trabajo', esFeriadoOficial: true, activo: true },
  { fecha: '2026-09-16', descripcion: 'Día de la Independencia de México', esFeriadoOficial: true, activo: true },
  { fecha: '2026-11-16', descripcion: 'Revolución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2026-12-25', descripcion: 'Navidad', esFeriadoOficial: true, activo: true },

  // 2027
  { fecha: '2027-01-01', descripcion: 'Año Nuevo', esFeriadoOficial: true, activo: true },
  { fecha: '2027-02-01', descripcion: 'Día de la Constitución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2027-03-15', descripcion: 'Natalicio de Benito Juárez', esFeriadoOficial: true, activo: true },
  { fecha: '2027-03-25', descripcion: 'Jueves Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2027-03-26', descripcion: 'Viernes Santo', esFeriadoOficial: false, activo: true },
  { fecha: '2027-05-01', descripcion: 'Día del Trabajo', esFeriadoOficial: true, activo: true },
  { fecha: '2027-09-16', descripcion: 'Día de la Independencia de México', esFeriadoOficial: true, activo: true },
  { fecha: '2027-11-15', descripcion: 'Revolución Mexicana', esFeriadoOficial: true, activo: true },
  { fecha: '2027-12-25', descripcion: 'Navidad', esFeriadoOficial: true, activo: true }
];

class MockStore {
  constructor() {
    this.empresasNomipaq = [...EMPRESAS_NOMIPAQ_CATALOGO];
    this.departamentos = [];
    this.puestos = [];
    this.colaboradores = [];
    this.diasInhabiles = [...festivosOficialesMexico];
    this.solicitudes = [];
    this.historialAprobaciones = [];
    this.bitacoraSync = [];
    this.folioCounter = 100;
    this.init();
  }

  init() {
    if (fs.existsSync(SEED_DATA_PATH)) {
      try {
        const raw = fs.readFileSync(SEED_DATA_PATH, 'utf-8');
        const data = JSON.parse(raw);
        this.departamentos = data.departamentos || [];
        this.puestos = data.puestos || [];
        
        // Mapear cada colaborador a una de las 8 razones sociales
        this.colaboradores = (data.colaboradores || []).map(c => {
          const antiguedad = calcularAntiguedad(c.fechaAlta);
          const diasCorrespondientes = calcularDiasLFT(antiguedad);
          const diasGozados = c.diasGozados || 0;
          
          let idEmpresa = 2; // Default Construjama
          const empNombre = (c.empresa || '').toUpperCase();
          if (empNombre.includes('CONTROLADORA')) idEmpresa = 3;
          else if (empNombre.includes('DISTRIBUIDOR DE CEMENTO') || empNombre.includes('DICOSA')) idEmpresa = 4;
          else if (empNombre.includes('DISTRIBUIDORA JAMA')) idEmpresa = 5;
          else if (empNombre.includes('CEMENTO')) idEmpresa = 1;
          else if (empNombre.includes('IMPULSORA')) idEmpresa = 6;
          else if (empNombre.includes('LATINO')) idEmpresa = 7;
          else if (empNombre.includes('TRAMO')) idEmpresa = 8;

          return {
            ...c,
            idEmpresa,
            antiguedadAnios: antiguedad,
            diasCorrespondientes,
            diasGozados,
            diasDisponibles: Math.max(0, diasCorrespondientes - diasGozados),
            jornadaLaboralDias: 5,
            saldos: generarPeriodosVacaciones(c.fechaAlta, diasGozados)
          };
        });
        console.log(`[MockStore-DESARROLLO_O] Cargados ${this.colaboradores.length} colaboradores en 8 empresas.`);
      } catch (err) {
        console.error('[MockStore-DESARROLLO_O] Error cargando seedData.json:', err);
      }
    }

    this.initSampleSolicitudes();
  }

  initSampleSolicitudes() {
    const benito = this.colaboradores.find(c => c.codigoEmpleado === 'CONS-100') || this.colaboradores[0];
    const mirna = this.colaboradores.find(c => c.codigoEmpleado === 'DICO-107') || this.colaboradores[1];
    const mary = this.colaboradores.find(c => c.codigoEmpleado === 'CONS-103') || this.colaboradores[2];

    if (benito) {
      this.solicitudes.push({
        idSolicitud: 1,
        folio: 'VAC-2026-00001',
        idColaborador: benito.id,
        idEmpresa: benito.idEmpresa || 2,
        colaboradorNombre: benito.nombreCompleto,
        colaboradorCodigo: benito.codigoEmpleado,
        colaboradorPuesto: benito.puesto,
        colaboradorDepartamento: benito.departamento,
        colaboradorEmpresa: benito.empresa,
        idJefeDirecto: benito.idJefeDirecto,
        fechaCreacion: '2026-10-01T09:30:00Z',
        fechaInicio: '2026-10-19',
        fechaFin: '2026-10-23',
        totalDiasLaborables: 5,
        totalDiasNaturales: 5,
        motivoComentarios: 'Vacaciones familiares programadas de octubre.',
        estado: 'PENDIENTE_LIDER',
        fechaResolucion: null,
        idAprobadorFinal: null,
        motivoRechazo: null
      });

      this.historialAprobaciones.push({
        idAprobacion: 1,
        idSolicitud: 1,
        idAprobador: benito.id,
        aprobadorNombre: benito.nombreCompleto,
        nivelAprobacion: 'COLABORADOR',
        accion: 'ENVIADA',
        comentarios: 'Solicitud generada e ingresada al flujo de autorización',
        metodoAutorizacion: 'WEB',
        fechaAccion: '2026-10-01T09:30:00Z'
      });
    }

    if (mirna) {
      this.solicitudes.push({
        idSolicitud: 2,
        folio: 'VAC-2026-00002',
        idColaborador: mirna.id,
        idEmpresa: mirna.idEmpresa || 4,
        colaboradorNombre: mirna.nombreCompleto,
        colaboradorCodigo: mirna.codigoEmpleado,
        colaboradorPuesto: mirna.puesto,
        colaboradorDepartamento: mirna.departamento,
        colaboradorEmpresa: mirna.empresa,
        idJefeDirecto: mirna.idJefeDirecto,
        fechaCreacion: '2026-09-15T11:00:00Z',
        fechaInicio: '2026-11-03',
        fechaFin: '2026-11-06',
        totalDiasLaborables: 4,
        totalDiasNaturales: 4,
        motivoComentarios: 'Descanso de aniversario laboral.',
        estado: 'PENDIENTE_DO',
        fechaResolucion: null,
        idAprobadorFinal: null,
        motivoRechazo: null
      });

      this.historialAprobaciones.push(
        {
          idAprobacion: 2,
          idSolicitud: 2,
          idAprobador: mirna.id,
          aprobadorNombre: mirna.nombreCompleto,
          nivelAprobacion: 'COLABORADOR',
          accion: 'ENVIADA',
          comentarios: 'Solicitud enviada a líder',
          metodoAutorizacion: 'WEB',
          fechaAccion: '2026-09-15T11:00:00Z'
        },
        {
          idAprobacion: 3,
          idSolicitud: 2,
          idAprobador: mary ? mary.id : 3,
          aprobadorNombre: mary ? mary.nombreCompleto : 'MARIA DE JESUS ARAIZA',
          nivelAprobacion: 'LIDER_DIRECTO',
          accion: 'APROBADA',
          comentarios: 'Autorizado por Gerencia. Enviado a VoBo de DO.',
          metodoAutorizacion: 'TEAMS',
          fechaAccion: '2026-09-16T14:10:00Z'
        }
      );
    }
  }

  getDiasInhabilesMap() {
    const map = {};
    for (const d of this.diasInhabiles) {
      if (d.activo) map[d.fecha] = d;
    }
    return map;
  }

  // Generador de staging contingente para una base específica
  generarStagingEmpresa(idEmpresa, nombreBD, aliasEmpresa) {
    const empColabs = this.colaboradores.filter(c => c.idEmpresa === idEmpresa);
    const departamentos = [
      { codigo: 'D01', nombre: 'ADMINISTRACION' },
      { codigo: 'D02', nombre: 'LOGISTICA' },
      { codigo: 'D03', nombre: 'VENTAS' },
      { codigo: 'D04', nombre: 'OPERACIONES' }
    ];
    const puestos = [
      { codigo: 'P01', nombre: 'GERENTE DE SUCURSAL' },
      { codigo: 'P02', nombre: 'ENCARGADO DE SUCURSAL' },
      { codigo: 'P05', nombre: 'MONTACARGUISTA 6' }
    ];

    const empleados = (empColabs.length > 0 ? empColabs : this.colaboradores.slice(0, 15)).map(c => ({
      codigoEmpleado: c.codigoEmpleado,
      nombre: c.nombre,
      apellidoPaterno: c.apellidoPaterno,
      apellidoMaterno: c.apellidoMaterno || '',
      curp: c.curp || '',
      rfc: c.rfc || '',
      email: c.email || '',
      empresa: aliasEmpresa,
      sucursal: c.sucursal || 'CENTRAL',
      fechaAlta: c.fechaAlta,
      fechaReingreso: c.fechaReingreso || null,
      estatusNomina: c.estatusNomina || 'A',
      codigoDepartamento: 'D01',
      codigoPuesto: 'P01'
    }));

    return { departamentos, puestos, empleados };
  }

  // Sincronización Multi-Empresa con preservación estricta de IdJefeDirecto y RolApp
  aplicarSincronizacionMultiEmpresa(idEmpresa, nombreBD, datos, idUsuario = null) {
    let insertados = 0;
    let actualizados = 0;

    for (const emp of datos.empleados) {
      // Búsqueda por llave única natural compuesta: (IdEmpresa, CodigoEmpleado)
      const index = this.colaboradores.findIndex(c => 
        c.idEmpresa === Number(idEmpresa) && c.codigoEmpleado === emp.codigoEmpleado
      );

      if (index >= 0) {
        // MATCHED: Actualizar datos de nómina preservando IdJefeDirecto y RolApp
        const existente = this.colaboradores[index];
        this.colaboradores[index] = {
          ...existente,
          nombre: emp.nombre,
          apellidoPaterno: emp.apellidoPaterno,
          apellidoMaterno: emp.apellidoMaterno,
          nombreCompleto: `${emp.nombre} ${emp.apellidoPaterno} ${emp.apellidoMaterno}`.trim(),
          curp: emp.curp,
          rfc: emp.rfc,
          email: emp.email || existente.email,
          empresa: emp.empresa || existente.empresa,
          sucursal: emp.sucursal || existente.sucursal,
          fechaAlta: emp.fechaAlta,
          fechaReingreso: emp.fechaReingreso,
          estatusNomina: emp.estatusNomina,
          activo: emp.estatusNomina === 'A',
          // REGLA CRUCIAL: IdJefeDirecto y RolApp SE CONSERVAN
          idJefeDirecto: existente.idJefeDirecto,
          rolApp: existente.rolApp,
          ultimaSincronizacion: new Date().toISOString()
        };
        actualizados++;
      } else {
        // NOT MATCHED: Insertar nuevo colaborador inicializando rol y jefe nulo
        const antiguedad = calcularAntiguedad(emp.fechaAlta);
        const diasCorrespondientes = calcularDiasLFT(antiguedad);

        const nuevoColab = {
          id: this.colaboradores.length + 1,
          idEmpresa: Number(idEmpresa),
          codigoEmpleado: emp.codigoEmpleado,
          nombre: emp.nombre,
          apellidoPaterno: emp.apellidoPaterno,
          apellidoMaterno: emp.apellidoMaterno,
          nombreCompleto: `${emp.nombre} ${emp.apellidoPaterno} ${emp.apellidoMaterno}`.trim(),
          curp: emp.curp,
          rfc: emp.rfc,
          email: emp.email || `${emp.codigoEmpleado.toLowerCase()}@grupojama.com`,
          empresa: emp.empresa,
          sucursal: emp.sucursal,
          fechaAlta: emp.fechaAlta,
          fechaReingreso: emp.fechaReingreso,
          estatusNomina: emp.estatusNomina,
          idDepartamento: null,
          idPuesto: null,
          idJefeDirecto: null, // Nuevo colaborador: sin jefe asignado localmente
          rolApp: 'COLABORADOR', // Rol base por defecto
          activo: emp.estatusNomina === 'A',
          antiguedadAnios: antiguedad,
          diasCorrespondientes,
          diasGozados: 0,
          diasDisponibles: diasCorrespondientes,
          jornadaLaboralDias: 5,
          saldos: generarPeriodosVacaciones(emp.fechaAlta, 0),
          ultimaSincronizacion: new Date().toISOString()
        };
        this.colaboradores.push(nuevoColab);
        insertados++;
      }
    }

    const log = {
      idSync: this.bitacoraSync.length + 1,
      fechaEjecucion: new Date().toISOString(),
      tipoEjecucion: 'MANUAL',
      idEmpresa,
      nombreBaseDatos: nombreBD,
      idUsuarioEjecuto: idUsuario,
      registrosInsertados: insertados,
      registrosActualizados: actualizados,
      registrosDesactivados: 0,
      detalleLog: `Sincronización multi-empresa completada para ${nombreBD}.`,
      exitoso: true
    };
    this.bitacoraSync.unshift(log);

    return {
      exito: 1,
      idEmpresa,
      baseDatos: nombreBD,
      registrosInsertados: insertados,
      registrosActualizados: actualizados,
      mensaje: `Sincronización multi-empresa exitosa en ${nombreBD}.`
    };
  }

  // Métodos de Solicitudes
  crearSolicitud(idColaborador, fechaInicio, fechaFin, motivoComentarios) {
    const colab = this.colaboradores.find(c => c.id === Number(idColaborador));
    if (!colab) throw new Error('Colaborador no encontrado.');

    const map = this.getDiasInhabilesMap();
    const detalle = calcularDetalleDias(fechaInicio, fechaFin, map, colab.jornadaLaboralDias || 5);

    if (detalle.totalDiasLaborables <= 0) {
      throw new Error('El rango seleccionado no contiene ningún día hábil laborable.');
    }

    const solicitudesEnTramite = this.solicitudes.filter(s => 
      s.idColaborador === colab.id && ['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(s.estado)
    );
    const diasEnTramite = solicitudesEnTramite.reduce((acc, s) => acc + s.totalDiasLaborables, 0);

    const disponibleReal = colab.diasDisponibles - diasEnTramite;
    if (disponibleReal < detalle.totalDiasLaborables) {
      throw new Error(`Saldo insuficiente. Días disponibles: ${disponibleReal}, Días solicitados: ${detalle.totalDiasLaborables}.`);
    }

    const traslape = this.solicitudes.find(s => 
      s.idColaborador === colab.id &&
      ['PENDIENTE_LIDER', 'PENDIENTE_DO', 'APROBADA'].includes(s.estado) &&
      fechaInicio <= s.fechaFin && fechaFin >= s.fechaInicio
    );
    if (traslape) {
      throw new Error('Ya existe una solicitud activa en el rango de fechas seleccionado.');
    }

    this.folioCounter++;
    const anioActual = new Date().getFullYear();
    const folio = `VAC-${anioActual}-${String(this.folioCounter).padStart(5, '0')}`;

    const nuevaSolicitud = {
      idSolicitud: this.solicitudes.length + 1,
      folio,
      idColaborador: colab.id,
      idEmpresa: colab.idEmpresa,
      colaboradorNombre: colab.nombreCompleto,
      colaboradorCodigo: colab.codigoEmpleado,
      colaboradorPuesto: colab.puesto,
      colaboradorDepartamento: colab.departamento,
      colaboradorEmpresa: colab.empresa,
      idJefeDirecto: colab.idJefeDirecto,
      fechaCreacion: new Date().toISOString(),
      fechaInicio,
      fechaFin,
      totalDiasLaborables: detalle.totalDiasLaborables,
      totalDiasNaturales: detalle.totalDiasNaturales,
      motivoComentarios: motivoComentarios || 'Vacaciones solicitadas vía portal de autoservicio',
      estado: 'PENDIENTE_LIDER',
      fechaResolucion: null,
      idAprobadorFinal: null,
      motivoRechazo: null
    };

    this.solicitudes.unshift(nuevaSolicitud);

    this.historialAprobaciones.push({
      idAprobacion: this.historialAprobaciones.length + 1,
      idSolicitud: nuevaSolicitud.idSolicitud,
      idAprobador: colab.id,
      aprobadorNombre: colab.nombreCompleto,
      nivelAprobacion: 'COLABORADOR',
      accion: 'ENVIADA',
      comentarios: 'Solicitud registrada en portal y remitida a Líder Directo',
      metodoAutorizacion: 'WEB',
      fechaAccion: new Date().toISOString()
    });

    return nuevaSolicitud;
  }

  aprobarSolicitud(idSolicitud, idAprobador, comentarios, metodo = 'WEB') {
    const solicitud = this.solicitudes.find(s => s.idSolicitud === Number(idSolicitud));
    if (!solicitud) throw new Error('Solicitud no encontrada.');

    const aprobador = this.colaboradores.find(c => c.id === Number(idAprobador));
    const esDO = aprobador && aprobador.rolApp === 'ADMIN_DO';

    if (solicitud.estado === 'PENDIENTE_LIDER' && !esDO) {
      solicitud.estado = 'PENDIENTE_DO';
      this.historialAprobaciones.push({
        idAprobacion: this.historialAprobaciones.length + 1,
        idSolicitud: solicitud.idSolicitud,
        idAprobador: aprobador ? aprobador.id : 0,
        aprobadorNombre: aprobador ? aprobador.nombreCompleto : 'LÍDER DIRECTO',
        nivelAprobacion: 'LIDER_DIRECTO',
        accion: 'APROBADA',
        comentarios: comentarios || 'Aprobado por Líder Directo. Enviado a Desarrollo Organizacional.',
        metodoAutorizacion: metodo,
        fechaAccion: new Date().toISOString()
      });
    } else {
      solicitud.estado = 'APROBADA';
      solicitud.fechaResolucion = new Date().toISOString();
      solicitud.idAprobadorFinal = aprobador ? aprobador.id : null;

      const colab = this.colaboradores.find(c => c.id === solicitud.idColaborador);
      if (colab) {
        colab.diasGozados += solicitud.totalDiasLaborables;
        colab.diasDisponibles = Math.max(0, colab.diasCorrespondientes - colab.diasGozados);
        let diasRestantes = solicitud.totalDiasLaborables;
        if (colab.saldos) {
          for (const s of colab.saldos) {
            if (s.diasPendientes > 0 && diasRestantes > 0) {
              const descontar = Math.min(s.diasPendientes, diasRestantes);
              s.diasGozados += descontar;
              s.diasPendientes -= descontar;
              diasRestantes -= descontar;
              if (s.diasPendientes === 0) s.esCerrado = true;
            }
          }
        }
      }

      this.historialAprobaciones.push({
        idAprobacion: this.historialAprobaciones.length + 1,
        idSolicitud: solicitud.idSolicitud,
        idAprobador: aprobador ? aprobador.id : 0,
        aprobadorNombre: aprobador ? aprobador.nombreCompleto : 'DESARROLLO ORGANIZACIONAL',
        nivelAprobacion: 'DESARROLLO_ORGANIZACIONAL',
        accion: 'APROBADA',
        comentarios: comentarios || 'VoBo otorgado por DO. Reflejado en nómina.',
        metodoAutorizacion: metodo,
        fechaAccion: new Date().toISOString()
      });
    }

    return solicitud;
  }

  rechazarSolicitud(idSolicitud, idAprobador, comentarios, metodo = 'WEB') {
    if (!comentarios || !comentarios.trim()) {
      throw new Error('El motivo de rechazo es obligatorio para registrar la resolución.');
    }

    const solicitud = this.solicitudes.find(s => s.idSolicitud === Number(idSolicitud));
    if (!solicitud) throw new Error('Solicitud no encontrada.');

    const aprobador = this.colaboradores.find(c => c.id === Number(idAprobador));

    solicitud.estado = 'RECHAZADA';
    solicitud.fechaResolucion = new Date().toISOString();
    solicitud.idAprobadorFinal = aprobador ? aprobador.id : null;
    solicitud.motivoRechazo = comentarios.trim();

    this.historialAprobaciones.push({
      idAprobacion: this.historialAprobaciones.length + 1,
      idSolicitud: solicitud.idSolicitud,
      idAprobador: aprobador ? aprobador.id : 0,
      aprobadorNombre: aprobador ? aprobador.nombreCompleto : 'APROBADOR',
      nivelAprobacion: aprobador && aprobador.rolApp === 'ADMIN_DO' ? 'DESARROLLO_ORGANIZACIONAL' : 'LIDER_DIRECTO',
      accion: 'RECHAZADA',
      comentarios: comentarios.trim(),
      metodoAutorizacion: metodo,
      fechaAccion: new Date().toISOString()
    });

    return solicitud;
  }

  cancelarSolicitud(idSolicitud, idColaborador) {
    const solicitud = this.solicitudes.find(s => s.idSolicitud === Number(idSolicitud));
    if (!solicitud) throw new Error('Solicitud no encontrada.');

    if (solicitud.idColaborador !== Number(idColaborador)) {
      throw new Error('No está autorizado a cancelar esta solicitud.');
    }

    if (!['PENDIENTE_LIDER', 'PENDIENTE_DO'].includes(solicitud.estado)) {
      throw new Error('Solo se pueden cancelar solicitudes que se encuentren en estado pendiente.');
    }

    solicitud.estado = 'CANCELADA';
    solicitud.fechaResolucion = new Date().toISOString();

    const colab = this.colaboradores.find(c => c.id === Number(idColaborador));

    this.historialAprobaciones.push({
      idAprobacion: this.historialAprobaciones.length + 1,
      idSolicitud: solicitud.idSolicitud,
      idAprobador: colab ? colab.id : 0,
      aprobadorNombre: colab ? colab.nombreCompleto : 'COLABORADOR',
      nivelAprobacion: 'COLABORADOR',
      accion: 'CANCELADA',
      comentarios: 'Solicitud cancelada por el colaborador',
      metodoAutorizacion: 'WEB',
      fechaAccion: new Date().toISOString()
    });

    return solicitud;
  }
}

const mockStore = new MockStore();
module.exports = mockStore;
