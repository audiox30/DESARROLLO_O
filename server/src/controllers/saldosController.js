const mockStore = require('../data/mockStore');
const { getPool, isUsingMock } = require('../config/database');
const { generarPeriodosVacaciones } = require('../services/lftVacacionesService');

const saldosController = {
  getKardexGlobal: async (req, res) => {
    try {
      const { empresa, departamento, format } = req.query;

      let list = mockStore.colaboradores.map(c => {
        return {
          idColaborador: c.id,
          codigoEmpleado: c.codigoEmpleado,
          nombreCompleto: c.nombreCompleto,
          empresa: c.empresa,
          sucursal: c.sucursal,
          departamento: c.departamento,
          puesto: c.puesto,
          fechaAlta: c.fechaAlta,
          antiguedadAnios: c.antiguedadAnios,
          diasCorrespondientes: c.diasCorrespondientes,
          diasGozados: c.diasGozados,
          diasDisponibles: c.diasDisponibles
        };
      });

      if (empresa) {
        list = list.filter(item => item.empresa === empresa);
      }
      if (departamento) {
        list = list.filter(item => item.departamento === departamento);
      }

      if (format === 'csv') {
        const headers = 'Código,Nombre,Empresa,Sucursal,Departamento,Puesto,Fecha Alta,Antigüedad (Años),Días LFT,Días Gozados,Días Disponibles\n';
        const rows = list.map(c => 
          `"${c.codigoEmpleado}","${c.nombreCompleto}","${c.empresa}","${c.sucursal}","${c.departamento}","${c.puesto}","${c.fechaAlta}",${c.antiguedadAnios},${c.diasCorrespondientes},${c.diasGozados},${c.diasDisponibles}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="KARDEX_VACACIONES_GRUPO_JAMA.csv"');
        return res.send('\uFEFF' + headers + rows);
      }

      return res.json({
        success: true,
        total: list.length,
        data: list
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getKardexColaborador: async (req, res) => {
    try {
      const { id } = req.params;
      const colab = mockStore.colaboradores.find(c => c.id === Number(id));
      if (!colab) return res.status(404).json({ error: 'Colaborador no encontrado' });

      const periodos = colab.saldos || generarPeriodosVacaciones(colab.fechaAlta, colab.diasGozados);

      return res.json({
        success: true,
        colaborador: colab,
        periodos
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = saldosController;
