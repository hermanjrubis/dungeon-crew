// Starts a real server and connects two fake players to it.
const test = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { createServer } = require('../server/index');

function connect(port) {
  return new Promise((resolve) => {
    const s = io('http://localhost:' + port, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
  });
}
const emit = (s, ev, payload) => new Promise((resolve) => s.emit(ev, payload, resolve));
const once = (s, ev) => new Promise((resolve) => s.once(ev, resolve));

test('two players create, join, pick, lock, start and get snapshots', async () => {
  const server = await createServer({ port: 0 });
  const a = await connect(server.port);
  const b = await connect(server.port);
  try {
    const created = await emit(a, 'room:create', { name: 'Kai' });
    assert.strictEqual(created.ok, true);
    const joined = await emit(b, 'room:join', { name: 'Mira', code: created.code.toLowerCase() });
    assert.strictEqual(joined.ok, true);

    b.emit('lobby:pick', { heroClass: 'archer', color: 'teal' });
    const lobbyState = once(a, 'lobby:state');
    a.emit('lobby:lock', { locked: true });
    b.emit('lobby:lock', { locked: true });
    const state = await lobbyState;
    assert.strictEqual(state.players.length, 2);

    // Listen before starting: the server sends game:start right after the reply.
    const startA = once(a, 'game:start');
    const snapB = once(b, 'game:snapshot');
    // Wait until both locks have arrived, then start.
    let started = { ok: false };
    for (let i = 0; i < 20 && !started.ok; i++) {
      started = await emit(a, 'lobby:start', {});
      if (!started.ok) await new Promise((r) => setTimeout(r, 20));
    }
    assert.strictEqual(started.ok, true);

    const [start, snap] = await Promise.all([startA, snapB]);
    assert.strictEqual(start.you, a.id);
    assert.strictEqual(snap.players.length, 2);
    const mira = snap.players.find((p) => p.name === 'Mira');
    assert.strictEqual(mira.heroClass, 'archer');
    assert.strictEqual(mira.color, 'teal');

    // The game opens with a title card; wait for it to finish.
    assert.strictEqual(snap.transition.kind, 'start');
    let current = snap;
    while (current.transition) current = await once(b, 'game:snapshot');

    // Holding right moves Mira on the server.
    const x0 = current.players.find((p) => p.name === 'Mira').x;
    b.emit('input', { right: true, aim: 0 });
    await new Promise((r) => setTimeout(r, 300));
    const later = await once(b, 'game:snapshot');
    assert.ok(later.players.find((p) => p.name === 'Mira').x > x0);
  } finally {
    a.close();
    b.close();
    await server.close();
  }
});

test('joining a missing room gives a clear error', async () => {
  const server = await createServer({ port: 0 });
  const a = await connect(server.port);
  try {
    const res = await emit(a, 'room:join', { name: 'Kai', code: 'ZZZZ' });
    assert.deepStrictEqual(res, { ok: false, error: 'No room with that code' });
  } finally {
    a.close();
    await server.close();
  }
});

test('bad payloads do not crash the server', async () => {
  const server = await createServer({ port: 0 });
  const a = await connect(server.port);
  try {
    a.emit('room:create', null, () => {});
    a.emit('lobby:pick', 'nonsense');
    a.emit('input', 42);
    a.emit('shop:buy', undefined, () => {});
    a.emit('lobby:start');
    const res = await emit(a, 'room:create', { name: 'Kai' });
    assert.strictEqual(res.ok, true);
  } finally {
    a.close();
    await server.close();
  }
});
