// The hub: everything a server does with players, without caring HOW they are
// connected. The Node server (server/index.js) and the Cloudflare server
// (cloud/worker.js) both pass their connections' messages in here.
//
// Messages on the wire are JSON:
//   browser -> server   { e: 'room:create', d: { name }, a: 3 }   (a = reply id, optional)
//   server  -> browser  { r: 3, d: { ok: true, code } }          (a reply)
//   server  -> browser  { e: 'game:snapshot', d: { ... } }       (an event)
const { Lobby } = require('./lobby');
const { Game } = require('./game');

const DEBUG_GOLD = { 2: 300, 3: 500, 4: 900 };

// debug: testing switches { floor: 3, room: 1, skipToShop: true }
function createHub({ debug = {} } = {}) {
  const lobby = new Lobby();
  const clients = new Map(); // id -> send(event, data)

  const sendTo = (id, e, d) => {
    const send = clients.get(id);
    if (send) send(e, d);
  };
  const broadcast = (room, e, d) => {
    for (const id of room.players.keys()) sendTo(id, e, d);
  };
  const sendLobby = (room) => broadcast(room, 'lobby:state', lobby.publicState(room));
  const sendShop = (room) => broadcast(room, 'shop:state', room.game.shopState());

  function startGame(room) {
    const players = [...room.players.values()].map(({ id, name, heroClass, color }) => ({ id, name, heroClass, color }));
    const game = new Game(players);
    room.game = game;
    if (debug.floor) {
      const floor = Math.max(1, Math.min(game.floors.length, Number(debug.floor)));
      game.startFloor(floor - 1);
      for (const pl of game.players.values()) pl.gold = DEBUG_GOLD[floor] || 300;
    }
    if (debug.room !== undefined && debug.room !== null && debug.room !== '') {
      game.roomIndex = Math.max(0, Math.min(game.layouts.length - 1, Number(debug.room)));
      game.loadRoom();
    }
    if (debug.skipToShop) {
      game.phase = 'shop';
      for (const pl of game.players.values()) pl.gold = 150;
    }
    room.lastTick = Date.now();
    room.phaseSent = game.phase;
    sendLobby(room);
    for (const pl of players) sendTo(pl.id, 'game:start', { you: pl.id, code: room.code });
    if (game.phase === 'shop') sendShop(room);
  }

  // What each message does. `reply` answers the sender.
  const handlers = {
    'room:create': (id, p, reply) => joined(id, lobby.createRoom(id, p.name), reply),
    'room:join': (id, p, reply) => joined(id, lobby.joinRoom(id, p.name, p.code), reply),
    'lobby:pick': (id, p, reply) => {
      reply(lobby.pick(id, { heroClass: p.heroClass, color: p.color }));
      const room = lobby.roomOf(id);
      if (room) sendLobby(room);
    },
    'lobby:lock': (id, p) => {
      lobby.setLocked(id, p.locked === true);
      const room = lobby.roomOf(id);
      if (room) sendLobby(room);
    },
    'lobby:start': (id, p, reply) => {
      const res = lobby.start(id);
      reply(res);
      if (res.ok) startGame(lobby.roomOf(id));
    },
    input: (id, p) => {
      const room = lobby.roomOf(id);
      if (room && room.game) room.game.setInput(id, p);
    },
    'game:pause': (id, p) => {
      const room = lobby.roomOf(id);
      if (room && room.game) room.game.setPaused(id, p.paused === true);
    },
    'shop:buy': (id, p, reply) => {
      const room = lobby.roomOf(id);
      if (!room || !room.game) return reply({ ok: false, error: 'Not in a game' });
      reply(room.game.buy(id, p.itemId));
      sendShop(room);
    },
    'shop:ready': (id, p) => {
      const room = lobby.roomOf(id);
      if (!room || !room.game) return;
      room.game.setShopReady(id, p.ready === true);
      sendShop(room);
    }
  };

  function joined(id, res, reply) {
    reply(res);
    if (res.ok) sendLobby(lobby.roomOf(id));
  }

  return {
    connect(id, send) {
      clients.set(id, send);
    },

    // One message from a connected browser. Bad input never throws.
    message(id, event, payload, reply = () => {}) {
      if (!clients.has(id)) return;
      const handler = Object.prototype.hasOwnProperty.call(handlers, event) ? handlers[event] : null;
      if (!handler) return;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
      try {
        handler(id, payload, reply);
      } catch (err) {
        console.error('Error handling', event, err);
        reply({ ok: false, error: 'Server error' });
      }
    },

    // One raw text frame: parse it and answer replies with `sendFrame(text)`.
    handleFrame(id, text, sendFrame) {
      let msg;
      try { msg = JSON.parse(text); } catch (e) { return; }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.e !== 'string') return;
      const hasReply = Number.isInteger(msg.a);
      this.message(id, msg.e, msg.d, (d) => {
        if (hasReply) sendFrame(JSON.stringify({ r: msg.a, d }));
      });
    },

    disconnect(id) {
      clients.delete(id);
      const room = lobby.leave(id);
      if (!room) return;
      if (room.game) {
        room.game.removePlayer(id);
        if (room.game.phase === 'shop') sendShop(room);
      }
      sendLobby(room);
    },

    // Move every running game forward and tell its players.
    tick(now) {
      for (const room of lobby.rooms.values()) {
        const game = room.game;
        if (!game) continue;
        const dt = (now - room.lastTick) / 1000;
        room.lastTick = now;
        if (game.phase === 'playing') {
          game.tick(dt);
          broadcast(room, 'game:snapshot', game.snapshot());
        }
        const events = game.drainEvents();
        if (events.length) broadcast(room, 'game:events', events);
        if (game.phase !== room.phaseSent) {
          room.phaseSent = game.phase;
          if (game.phase === 'shop') sendShop(room);
          if (game.phase === 'done') broadcast(room, 'game:done', game.shopState());
        }
      }
    },

    hasGames() {
      for (const room of lobby.rooms.values()) if (room.game) return true;
      return false;
    },

    size() {
      return clients.size;
    }
  };
}

module.exports = { createHub };
