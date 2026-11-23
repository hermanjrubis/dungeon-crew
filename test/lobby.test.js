const test = require('node:test');
const assert = require('node:assert');
const { Lobby } = require('../server/lobby');

function roomWith(n) {
  const lobby = new Lobby();
  const { code } = lobby.createRoom('p0', 'Kai');
  for (let i = 1; i < n; i++) lobby.joinRoom('p' + i, 'P' + i, code);
  return { lobby, code };
}

test('codes are 4 capital letters without I or O', () => {
  const lobby = new Lobby();
  for (let i = 0; i < 50; i++) {
    const { code } = lobby.createRoom('s' + i, 'X');
    assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  }
});

test('join with lowercase and spaces works', () => {
  const lobby = new Lobby();
  const { code } = lobby.createRoom('a', 'Kai');
  const res = lobby.joinRoom('b', 'Mira', '  ' + code.toLowerCase() + ' ');
  assert.deepStrictEqual(res, { ok: true, code });
  assert.strictEqual(lobby.roomOf('b').code, code);
});

test('unknown code is refused', () => {
  const lobby = new Lobby();
  assert.deepStrictEqual(lobby.joinRoom('b', 'Mira', 'ZZZZ'), { ok: false, error: 'No room with that code' });
});

test('fifth player is refused', () => {
  const { lobby, code } = roomWith(4);
  assert.deepStrictEqual(lobby.joinRoom('p4', 'Late', code), { ok: false, error: 'Room is full' });
});

test('new players get the first free color and the knight', () => {
  const { lobby } = roomWith(2);
  const players = lobby.publicState(lobby.roomOf('p0')).players;
  assert.strictEqual(players[0].color, 'orange');
  assert.strictEqual(players[1].color, 'blue');
  assert.strictEqual(players[1].heroClass, 'knight');
});

test('each color once per room', () => {
  const { lobby } = roomWith(2);
  assert.deepStrictEqual(lobby.pick('p1', { color: 'orange' }), { ok: false, error: 'Color taken' });
  assert.deepStrictEqual(lobby.pick('p1', { color: 'teal', heroClass: 'archer' }), { ok: true });
  const p1 = lobby.publicState(lobby.roomOf('p1')).players[1];
  assert.strictEqual(p1.color, 'teal');
  assert.strictEqual(p1.heroClass, 'archer');
});

test('unknown hero class or color is refused', () => {
  const { lobby } = roomWith(1);
  assert.strictEqual(lobby.pick('p0', { heroClass: 'dragon' }).ok, false);
  assert.strictEqual(lobby.pick('p0', { color: 'green' }).ok, false);
});

test('picks are ignored while locked', () => {
  const { lobby } = roomWith(1);
  lobby.setLocked('p0', true);
  lobby.pick('p0', { heroClass: 'mage' });
  assert.strictEqual(lobby.publicState(lobby.roomOf('p0')).players[0].heroClass, 'knight');
});

test('names are trimmed, max 12 chars, blank becomes "Player"', () => {
  const lobby = new Lobby();
  const { code } = lobby.createRoom('a', '   ');
  lobby.joinRoom('b', '  Supercalifragilistic  ', code);
  const players = lobby.publicState(lobby.roomOf('a')).players;
  assert.strictEqual(players[0].name, 'Player');
  assert.strictEqual(players[1].name, 'Supercalifra');
});

test('only host can start, and only when all locked', () => {
  const { lobby } = roomWith(2);
  lobby.setLocked('p0', true);
  assert.deepStrictEqual(lobby.start('p0'), { ok: false, error: 'Everyone must lock in' });
  lobby.setLocked('p1', true);
  assert.deepStrictEqual(lobby.start('p1'), { ok: false, error: 'Only the host can start' });
  assert.deepStrictEqual(lobby.start('p0'), { ok: true });
  assert.strictEqual(lobby.roomOf('p0').phase, 'playing');
});

test('host leaving passes host to next player', () => {
  const { lobby } = roomWith(2);
  const room = lobby.leave('p0');
  assert.strictEqual(room.hostId, 'p1');
  lobby.setLocked('p1', true);
  assert.deepStrictEqual(lobby.start('p1'), { ok: true });
});

test('cannot join after start', () => {
  const { lobby, code } = roomWith(1);
  lobby.setLocked('p0', true);
  lobby.start('p0');
  assert.deepStrictEqual(lobby.joinRoom('x', 'Late', code), { ok: false, error: 'Game already started' });
});

test('last player leaving deletes the room', () => {
  const { lobby, code } = roomWith(1);
  assert.strictEqual(lobby.leave('p0'), null);
  assert.strictEqual(lobby.joinRoom('x', 'Late', code).ok, false);
});

test('a socket already in a room leaves it before creating another', () => {
  const lobby = new Lobby();
  const first = lobby.createRoom('a', 'Kai').code;
  const second = lobby.createRoom('a', 'Kai').code;
  assert.notStrictEqual(first, second);
  assert.strictEqual(lobby.joinRoom('b', 'Mira', first).ok, false);
});
