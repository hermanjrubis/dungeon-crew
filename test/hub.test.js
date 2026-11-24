const test = require('node:test');
const assert = require('node:assert');
const { createHub } = require('../server/hub');

// A fake connection that records everything the hub sends it.
function fakeClient(hub, id) {
  const got = [];
  hub.connect(id, (e, d) => got.push({ e, d }));
  const ask = (e, d) => new Promise((resolve) => hub.message(id, e, d, resolve));
  const last = (e) => [...got].reverse().find((m) => m.e === e);
  return { id, got, ask, last, send: (e, d) => hub.message(id, e, d, () => {}) };
}

async function startedGame(hub) {
  const a = fakeClient(hub, 'a');
  const b = fakeClient(hub, 'b');
  const { code } = await a.ask('room:create', { name: 'Kai' });
  await b.ask('room:join', { name: 'Mira', code });
  a.send('lobby:lock', { locked: true });
  b.send('lobby:lock', { locked: true });
  const started = await a.ask('lobby:start', {});
  return { a, b, code, started };
}

test('create, join, pick, lock and start send lobby states and game:start to both players', async () => {
  const hub = createHub();
  const a = fakeClient(hub, 'a');
  const b = fakeClient(hub, 'b');
  const created = await a.ask('room:create', { name: 'Kai' });
  assert.strictEqual(created.ok, true);
  assert.strictEqual((await b.ask('room:join', { name: 'Mira', code: created.code.toLowerCase() })).ok, true);
  assert.strictEqual((await b.ask('lobby:pick', { heroClass: 'archer' })).ok, true);
  assert.strictEqual(a.last('lobby:state').d.players.length, 2);
  assert.strictEqual(a.last('lobby:state').d.players[1].heroClass, 'archer');
  a.send('lobby:lock', { locked: true });
  b.send('lobby:lock', { locked: true });
  assert.strictEqual((await a.ask('lobby:start', {})).ok, true);
  assert.deepStrictEqual(a.last('game:start').d, { you: 'a', code: created.code });
  assert.deepStrictEqual(b.last('game:start').d, { you: 'b', code: created.code });
});

test('tick sends snapshots to everyone in the game', async () => {
  const hub = createHub();
  const { a, b } = await startedGame(hub);
  assert.strictEqual(hub.hasGames(), true);
  const t = Date.now();
  hub.tick(t);
  hub.tick(t + 50);
  assert.ok(a.last('game:snapshot'));
  assert.ok(b.last('game:snapshot'));
  assert.strictEqual(a.last('game:snapshot').d.players.length, 2);
});

test('a disconnect removes the player from the lobby', async () => {
  const hub = createHub();
  const a = fakeClient(hub, 'a');
  const b = fakeClient(hub, 'b');
  const { code } = await a.ask('room:create', { name: 'Kai' });
  await b.ask('room:join', { name: 'Mira', code });
  hub.disconnect('b');
  assert.strictEqual(a.last('lobby:state').d.players.length, 1);
  assert.strictEqual(hub.size(), 1);
});

test('bad frames and unknown sockets are ignored', async () => {
  const hub = createHub();
  const frames = [];
  hub.connect('a', () => {});
  for (const bad of ['not json', '{}', '[1,2]', '{"e":5}', 'null']) hub.handleFrame('a', bad, (f) => frames.push(f));
  hub.handleFrame('ghost', JSON.stringify({ e: 'room:create', d: { name: 'X' }, a: 1 }), (f) => frames.push(f));
  hub.message('ghost', 'input', {}, () => {});
  assert.deepStrictEqual(frames, []);
  hub.handleFrame('a', JSON.stringify({ e: 'room:create', d: 'oops', a: 7 }), (f) => frames.push(f));
  const reply = JSON.parse(frames[0]);
  assert.strictEqual(reply.r, 7);
  assert.strictEqual(reply.d.ok, true);
});

test('debug.floor starts on that floor with its gold', async () => {
  const hub = createHub({ debug: { floor: 3 } });
  const { a } = await startedGame(hub);
  hub.tick(Date.now());
  const snap = a.last('game:snapshot').d;
  assert.strictEqual(snap.floorIndex, 2);
  assert.strictEqual(snap.players[0].gold, 500);
});

test('after the run ends, Play again brings the whole crew back to the same room lobby', async () => {
  const hub = createHub();
  const { a, b, code } = await startedGame(hub);
  // not allowed while the game is still running
  assert.strictEqual((await a.ask('room:again', {})).ok, false);
  const { Game } = require('../server/game');
  // finish the run
  const room = hub._roomOf ? hub._roomOf('a') : null;
  assert.ok(room, 'hub exposes the room for tests');
  room.game.phase = 'done';
  const res = await b.ask('room:again', {});
  assert.strictEqual(res.ok, true);
  const state = a.last('lobby:state').d;
  assert.strictEqual(state.code, code);
  assert.strictEqual(state.phase, 'lobby');
  assert.strictEqual(state.players.length, 2);
  assert.ok(state.players.every((p) => p.locked === false));
  assert.strictEqual(room.game, null);
  // and the crew can start again
  a.send('lobby:lock', { locked: true });
  b.send('lobby:lock', { locked: true });
  assert.strictEqual((await a.ask('lobby:start', {})).ok, true);
  assert.strictEqual(b.last('game:start').d.you, 'b');
  assert.ok(Game);
});
