const dgram = require('dgram');
const net = require('net');

const targetIp = '192.168.20.29';

console.log(`Buscando instancias de SQL Server en ${targetIp}...`);

// 1. Probar SQL Server Browser (UDP 1434)
function probeSqlBrowser(ip, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    client.on('message', (msg) => {
      resolved = true;
      client.close();
      const text = msg.toString('ascii');
      resolve({ success: true, raw: text });
    });

    client.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        client.close();
        resolve({ success: false, error: err.message });
      }
    });

    // 0x02 = SVR_ALL query
    const message = Buffer.from([0x02]);
    client.send(message, 0, message.length, 1434, ip, (err) => {
      if (err && !resolved) {
        resolved = true;
        client.close();
        resolve({ success: false, error: err.message });
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { client.close(); } catch (e) {}
        resolve({ success: false, timeout: true });
      }
    }, timeoutMs);
  });
}

// 2. Escanear puertos comunes
async function scanCommonPorts(ip) {
  const commonPorts = [1433, 1434, 1435, 49152, 49153, 49154, 49155, 49156, 49157, 14333];
  console.log(`Escaneando puertos TCP comunes en ${ip}...`);

  for (const port of commonPorts) {
    const isOpen = await new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(1200);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
      s.on('error', () => { s.destroy(); resolve(false); });
      s.connect(port, ip);
    });

    if (isOpen) {
      console.log(`  -> Puerto TCP ${port} está ABIERTO`);
    }
  }
}

async function main() {
  const browserResult = await probeSqlBrowser(targetIp);
  if (browserResult.success) {
    console.log('✅ ¡Respuesta recibida de SQL Server Browser (UDP 1434)!');
    console.log('--- Instancias descubiertas ---');
    console.log(browserResult.raw);
  } else {
    console.log(`⚠️ SQL Browser (UDP 1434) no respondió (Timeout/Bloqueado).`);
  }

  await scanCommonPorts(targetIp);
}

main().catch(console.error);
