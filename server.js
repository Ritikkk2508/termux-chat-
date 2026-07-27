const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

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

const wss = new WebSocket.Server({ server, maxPayload: 8 * 1024 * 1024 });

wss.on('connection', (ws) => {
  ws.username = null;
  ws.room = 'general';

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'join') {
      ws.username = msg.name || 'Anonymous';
      ws.room = (msg.room || 'general').trim() || 'general';
      broadcastToRoom(ws.room, { type: 'system', text: `${ws.username} joined the chat` });
      broadcastUserList(ws.room);
      return;
    }

    if (msg.type === 'message' || msg.type === 'image' || msg.type === 'audio') {
      broadcastToRoom(ws.room, {
        type: msg.type,
        id: msg.id,
        name: ws.username || 'Anonymous',
        text: msg.text,
        data: msg.data,
        time: new Date().toLocaleTimeString(),
      });
      return;
    }

    if (msg.type === 'seen') {
      broadcastToRoom(ws.room, { type: 'seen', id: msg.id, by: ws.username });
      return;
    }

    if (msg.type === 'typing') {
      broadcastToRoom(ws.room, { type: 'typing', name: ws.username }, ws);
      return;
    }

    if (msg.type === 'stopTyping') {
      broadcastToRoom(ws.room, { type: 'stopTyping', name: ws.username }, ws);
      return;
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      broadcastToRoom(ws.room, { type: 'system', text: `${ws.username} left the chat` });
      broadcastUserList(ws.room);
    }
  });
});

function broadcastToRoom(room, data, exclude) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.room === room && client !== exclude) {
      client.send(payload);
    }
  });
}

function broadcastUserList(room) {
  const names = [...wss.clients]
    .filter((c) => c.username && c.room === room)
    .map((c) => c.username);
  broadcastToRoom(room, { type: 'userlist', users: names });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('Chat server running!');
  console.log(`Open http://<your-phone-ip>:${PORT} on any device on the same WiFi`);
});
