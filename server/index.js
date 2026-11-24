// The local server: serves the game page and runs every room's game.
// Start it with `npm start`, then open http://localhost:3000
// (For playing online, the same rooms run on Cloudflare: see cloud/worker.js.)
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { createHub } = require('./hub');
const { TICK_RATE } = require('../shared/data');

const ROOT = path.join(__dirname, '..');

// Testing switches from the environment: DEBUG_FLOOR=3, DEBUG_ROOM=1, DEBUG_SKIP_TO_SHOP=1.
function debugFromEnv(env = process.env) {
  return {
    floor: env.DEBUG_FLOOR ? Number(env.DEBUG_FLOOR) : null,
    room: env.DEBUG_ROOM !== undefined ? env.DEBUG_ROOM : null,
    skipToShop: !!env.DEBUG_SKIP_TO_SHOP
  };
}

function createServer({ port = 3000 } = {}) {
  const app = express();
  app.use(express.static(path.join(ROOT, 'client')));
  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.get('/vendor/phaser.min.js', (req, res) => {
    res.sendFile(path.join(ROOT, 'node_modules', 'phaser', 'dist', 'phaser.min.js'));
  });

  const httpServer = http.createServer(app);
  const hub = createHub({ debug: debugFromEnv() });
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  let nextId = 1;

  wss.on('connection', (ws) => {
    const id = 'c' + nextId++;
    const sendFrame = (text) => { if (ws.readyState === ws.OPEN) ws.send(text); };
    hub.connect(id, (e, d) => sendFrame(JSON.stringify({ e, d })));
    sendFrame(JSON.stringify({ e: 'hello', d: { id } }));
    ws.on('message', (data) => hub.handleFrame(id, String(data), sendFrame));
    ws.on('close', () => hub.disconnect(id));
    ws.on('error', () => {});
  });

  // The game loop: every room with a running game moves forward 20 times a second.
  const loop = setInterval(() => hub.tick(Date.now()), 1000 / TICK_RATE);

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      resolve({
        port: httpServer.address().port,
        hub, // for smoke scripts
        close: () => new Promise((done) => {
          clearInterval(loop);
          for (const ws of wss.clients) ws.terminate();
          wss.close(() => httpServer.close(() => done()));
        })
      });
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer({ port }).then((s) => {
    console.log(`Dungeon Crew is running: open http://localhost:${s.port}`);
  });
}

module.exports = { createServer, debugFromEnv };
