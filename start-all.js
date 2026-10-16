const { spawn } = require('child_process');
const path = require('path');

console.log('Iniciando Sistema de Control de Vacaciones - Grupo JAMA...');

const serverPath = path.resolve(__dirname, 'server');
const serverProcess = spawn('node', ['src/app.js'], {
  cwd: serverPath,
  stdio: 'inherit',
  shell: true
});

serverProcess.on('exit', (code) => {
  console.log(`El servidor se detuvo con código ${code}`);
  process.exit(code || 0);
});
