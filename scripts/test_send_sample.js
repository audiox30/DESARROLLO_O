const nodemailer = require('../server/node_modules/nodemailer');

const transporter = nodemailer.createTransport({
  host: '192.168.20.16',
  port: 25,
  secure: false,
  requireTLS: false,
  ignoreTLS: true,
  tls: { rejectUnauthorized: false, ciphers: 'SSLv3' },
  auth: {
    user: 'comprobante.fiscal@grupojamacfdi.com',
    pass: 'Mn4jVzzcf28'
  }
});

(async () => {
  try {
    console.log('Verificando transporter...');
    await transporter.verify();
    console.log('Transporter verificado OK');
    
    const info = await transporter.sendMail({
      from: '"Control de Vacaciones Grupo JAMA" <comprobante.fiscal@grupojamacfdi.com>',
      to: 'audiox30@hotmail.com',
      cc: 'soporte@grupojama.com',
      subject: 'Prueba de Conectividad SMTP - Alertas de Vigencia Grupo JAMA',
      text: 'Esta es una prueba de envío de correo.'
    });
    console.log('Correo de prueba enviado con éxito:', info.messageId, info.response);
  } catch(e) {
    console.error('Error enviando:', e);
  }
})();
