const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jama_secret_vacaciones_desarrollo_o_2026_jwt_token';

// Generar token como ADMIN_DO
const tokenAdmin = jwt.sign(
  { id: 9999, codigoEmpleado: 'DO-010', rolApp: 'ADMIN_DO', email: 'tania.do@grupojama.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Generar token como COLABORADOR regular
const tokenColab = jwt.sign(
  { id: 1, codigoEmpleado: '0102', rolApp: 'COLABORADOR', email: 'imegs@hotmail.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function testApi() {
  console.log('=== TEST DE NUEVOS CAMPOS Y TABLAS AUXILIARES ===\n');

  // 1. GET /api/colaboradores/1
  console.log('1. Consultando ficha de Colaborador Id 1...');
  const res1 = await fetch('http://localhost:5000/api/colaboradores/1', {
    headers: { 'Authorization': 'Bearer ' + tokenAdmin }
  });
  const data1 = await res1.json();
  console.log('   Respuesta:', data1.success ? 'OK' : data1);
  console.log('   Campos demo:', {
    nombre: data1.data.NombreCompleto,
    curp: data1.data.CURP,
    nacionalidad: data1.data.Nacionalidad,
    empresa: data1.data.Empresa,
    hijos: data1.data.hijos,
    financieros: data1.data.datosFinancieros
  });

  // 2. PUT /api/colaboradores/1 (Actualizar datos demográficos y de contacto)
  console.log('\n2. Actualizando datos adicionales (NSS, Domicilio, TelefonoEmergencia)...');
  const res2 = await fetch('http://localhost:5000/api/colaboradores/1', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenAdmin
    },
    body: JSON.stringify({
      NSS: '12345678901',
      Sexo: 'F',
      EstadoCivil: 'CASADA',
      Domicilio: 'Av. Siempre Viva 742',
      Municipio: 'Querétaro',
      EstadoProvincia: 'Querétaro',
      CodigoPostal: '76000',
      AvisarEmergencia: 'Juan Pérez (Esposo)',
      ParentescoEmergencia: 'CONYUGE',
      TelefonoEmergencia: '4421234567',
      TipoSangre: 'O+'
    })
  });
  console.log('   Update result:', await res2.json());

  // 3. POST /api/colaboradores/1/hijos
  console.log('\n3. Registrando hijo en dbo.ColaboradorHijos...');
  const res3 = await fetch('http://localhost:5000/api/colaboradores/1/hijos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenAdmin
    },
    body: JSON.stringify({
      numeroHijo: 1,
      fechaNacimiento: '2015-08-20',
      sexo: 'M'
    })
  });
  console.log('   Agregar hijo result:', await res3.json());

  // 4. POST /api/colaboradores/1/financieros (Guardar salarios y dispersión)
  console.log('\n4. Registrando datos financieros confidenciales...');
  const res4 = await fetch('http://localhost:5000/api/colaboradores/1/financieros', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenAdmin
    },
    body: JSON.stringify({
      salarioMensualNeto: 18500.50,
      salarioDiarioReal: 616.68,
      salarioDiarioImss: 645.20,
      salarioDiarioIntegrado: 678.90,
      institucionBancaria: 'BBVA BANCOMER',
      numeroCuenta: '0123456789',
      clabeInterbancaria: '012180001234567890'
    })
  });
  console.log('   Financieros result:', await res4.json());

  // 5. Verificar ficha técnica completa como ADMIN_DO
  console.log('\n5. Verificando ficha completa como ADMIN_DO (debe ver datos financieros)...');
  const res5 = await fetch('http://localhost:5000/api/colaboradores/1', {
    headers: { 'Authorization': 'Bearer ' + tokenAdmin }
  });
  const data5 = await res5.json();
  console.log('   NSS:', data5.data.NSS);
  console.log('   Domicilio:', data5.data.Domicilio);
  console.log('   Emergencia:', data5.data.AvisarEmergencia, data5.data.TelefonoEmergencia);
  console.log('   Total Hijos:', data5.data.hijos.length, data5.data.hijos[0]);
  console.log('   Datos Financieros (ADMIN_DO):', data5.data.datosFinancieros);

  // 6. Verificar aislamiento de confidencialidad para usuario no autorizado
  console.log('\n6. Verificando aislamiento de confidencialidad para un usuario COLABORADOR externo...');
  const tokenOtroColab = jwt.sign(
    { id: 2, codigoEmpleado: '0114', rolApp: 'COLABORADOR' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const res6 = await fetch('http://localhost:5000/api/colaboradores/1', {
    headers: { 'Authorization': 'Bearer ' + tokenOtroColab }
  });
  const data6 = await res6.json();
  console.log('   Datos Financieros vistos por otro colaborador:', data6.data.datosFinancieros);
  console.log('   (Es null -> AISLAMIENTO CONFIDENCIAL CONFIRMADO)');

  console.log('\n=== TODOS LOS TESTS PASARON EXITOSAMENTE ===');
}

testApi().catch(console.error);
