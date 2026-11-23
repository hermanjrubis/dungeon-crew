// The server: serves the game page and runs every room's game.
// Start it with `npm start`, then open http://localhost:3000
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Lobby } = require('./lobby');
const { Game } = require('./game');
const { TICK_RATE } = require('../shared/data');

const ROOT = path.join(__dirname, '..');

function createServer({ port = 3000 } = {}) {
  const app = express();
  app.use(express.static(path.join(ROOT, 'client')));
  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.get('/vendor/phaser.min.js', (req, res) => {
    res.sendFile(path.join(ROOT, 'node_modules', 'phaser', 'dist', 'phaser.min.js'));
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  const lobby = new Lobby();

  const channel = (room) => 'room:' + room.code;
  const sendLobby = (room) => io.to(channel(room)).emit('lobby:state', lobby.publicState(room));
  const sendShop = (room) => io.to(channel(room)).emit('shop:state', room.game.shopState());

  io.on('connection', (socket) => {
    // Every handler accepts (payload, ack) but survives missing or bad values.
    const on = (event, handler) => {
      socket.on(event, (payload, ack) => {
        if (typeof payload === 'function') { ack = payload; payload = {}; }
        if (!payload || typeof payload !== 'object') payload = {};
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          handler(payload, reply);
        } catch (err) {
          console.error('Error handling', event, err);
          reply({ ok: false, error: 'Server error' });
        }
      });
    };

    const joinChannel = (res, reply) => {
      if (res.ok) {
        const room = lobby.roomOf(socket.id);
        for (const ch of socket.rooms) if (ch !== socket.id) socket.leave(ch);
        socket.join(channel(room));
        reply(res);
        sendLobby(room);
      } else reply(res);
    };

    on('room:create', (p, reply) => joinChannel(lobby.createRoom(socket.id, p.name), reply));
    on('room:join', (p, reply) => joinChannel(lobby.joinRoom(socket.id, p.name, p.code), reply));

    on('lobby:pick', (p, reply) => {
      const res = lobby.pick(socket.id, { heroClass: p.heroClass, color: p.color });
      reply(res);
      const room = lobby.roomOf(socket.id);
      if (room) sendLobby(room);
    });

    on('lobby:lock', (p) => {
      lobby.setLocked(socket.id, p.locked === true);
      const room = lobby.roomOf(socket.id);
      if (room) sendLobby(room);
    });

    on('lobby:start', (p, reply) => {
      const res = lobby.start(socket.id);
      reply(res);
      if (!res.ok) return;
      const room = lobby.roomOf(socket.id);
      const players = [...room.players.values()].map(({ id, name, heroClass, color }) => ({ id, name, heroClass, color }));
      room.game = new Game(players);
      // Testing switches: DEBUG_FLOOR=2 starts on Floor 2 with 300 gold; DEBUG_ROOM=3 jumps to room 4 (counting from 0).
      if (process.env.DEBUG_FLOOR) {
        room.game.startFloor(Math.max(0, Math.min(room.game.floors.length - 1, Number(process.env.DEBUG_FLOOR) - 1)));
        for (const pl of room.game.players.values()) pl.gold = 300;
      }
      if (process.env.DEBUG_ROOM) {
        room.game.roomIndex = Math.max(0, Math.min(room.game.layouts.length - 1, Number(process.env.DEBUG_ROOM)));
        room.game.loadRoom();
      }
      if (process.env.DEBUG_SKIP_TO_SHOP) {
        room.game.phase = 'shop';
        for (const pl of room.game.players.values()) pl.gold = 150;
      }
      room.lastTick = Date.now();
      sendLobby(room);
      for (const pl of players) io.to(pl.id).emit('game:start', { you: pl.id, code: room.code });
      if (room.game.phase === 'shop') sendShop(room);
    });

    on('input', (p) => {
      const room = lobby.roomOf(socket.id);
      if (room && room.game) room.game.setInput(socket.id, p);
    });

    on('game:pause', (p) => {
      const room = lobby.roomOf(socket.id);
      if (room && room.game) room.game.setPaused(socket.id, p.paused === true);
    });

    on('shop:buy', (p, reply) => {
      const room = lobby.roomOf(socket.id);
      if (!room || !room.game) return reply({ ok: false, error: 'Not in a game' });
      reply(room.game.buy(socket.id, p.itemId));
      sendShop(room);
    });

    on('shop:ready', (p) => {
      const room = lobby.roomOf(socket.id);
      if (!room || !room.game) return;
      room.game.setShopReady(socket.id, p.ready === true);
      sendShop(room);
    });

    socket.on('disconnect', () => {
      const room = lobby.leave(socket.id);
      if (!room) return;
      if (room.game) {
        room.game.removePlayer(socket.id);
        if (room.game.phase === 'shop') sendShop(room);
      }
      sendLobby(room);
    });
  });

  // The game loop: every room with a running game moves forward 20 times a second.
  const loop = setInterval(() => {
    const now = Date.now();
    for (const room of lobby.rooms.values()) {
      const game = room.game;
      if (!game) continue;
      const dt = (now - room.lastTick) / 1000;
      room.lastTick = now;
      const before = game.phase;
      if (game.phase === 'playing') {
        game.tick(dt);
        io.to(channel(room)).emit('game:snapshot', game.snapshot());
      }
      const events = game.drainEvents();
      if (events.length) io.to(channel(room)).emit('game:events', events);
      if (game.phase !== before || game.phase !== room.phase) {
        room.phase = game.phase;
        if (game.phase === 'shop') sendShop(room);
        if (game.phase === 'done') io.to(channel(room)).emit('game:done', game.shopState());
      }
    }
  }, 1000 / TICK_RATE);

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      resolve({
        port: httpServer.address().port,
        close: () => new Promise((done) => {
          clearInterval(loop);
          io.close(() => done());
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

module.exports = { createServer };
