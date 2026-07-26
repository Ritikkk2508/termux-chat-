const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.js': 'application/javascript',
      '.json': 'application/manifest+json',
      '.png': 'image/png',
      '.html': 'text/html',
    };
    const type = mimeTypes[ext] || 'text/html';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.username = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'join') {
      ws.username = msg.name || 'Anonymous';
      broadcast({ type: 'system', text: `${ws.username} joined the chat` });
      broadcastUserList();
      return;
    }

    if (msg.type === 'message') {
      broadcast({
        type: 'message',
        name: ws.username || 'Anonymous',
        text: msg.text,
        time: new Date().toLocaleTimeString(),
      });
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      broadcast({ type: 'system', text: `${ws.username} left the chat` });
      broadcastUserList();
    }
  });
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function broadcastUserList() {
  const names = [...wss.clients].filter((c) => c.username).map((c) => c.username);
  broadcast({ type: 'userlist', users: names });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('Chat server running!');
  console.log(`Open http://<your-phone-ip>:${PORT} on any device on the same WiFi`);
});
