const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');
const enemies = require('../server/enemies');
const { TILE } = require('../shared/tiles');

function place(game, i, x, y) {
  const me = game.players.get('p' + i);
  me.x = x; me.y = y;
  return me;
}

test('gloop squishes for 1 s before leaping', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 400, 312);
  const g = game.spawnEnemy('gloop', 520, 312);
  game.tick(0.05);
  assert.strictEqual(g.state, 'squish');
  const x = g.x;
  run(game, 0.85);
  assert.strictEqual(g.state, 'squish');
  assert.strictEqual(g.x, x);
});

test('gloop leap lands near the target and deals damage', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 400, 312);
  const g = game.spawnEnemy('gloop', 520, 312);
  run(game, 1.6);
  assert.ok(Math.hypot(g.x - 400, g.y - 312) <= 32, `${g.x},${g.y}`);
  assert.ok(me.hp <= 115, String(me.hp));
});

test('gloop walks toward a far target', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 312);
  const g = game.spawnEnemy('gloop', 900, 312);
  run(game, 1);
  assert.ok(g.x < 900 - 50, String(g.x));
});

test('gloop splits into two mini gloops on death; minis do not split', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 600);
  const g = game.spawnEnemy('gloop', 600, 312);
  game.damageEnemy(g, 999, 'p0');
  const minis = game.enemies.filter((e) => e.type === 'minigloop');
  assert.strictEqual(minis.length, 2);
  game.damageEnemy(minis[0], 999, 'p0');
  assert.strictEqual(game.enemies.filter((e) => e.type === 'minigloop').length, 1);
});

test('brood gloops (noReward) do not split and give no gold', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 100, 600);
  const g = game.spawnEnemy('gloop', 600, 312, { noReward: true });
  game.damageEnemy(g, 999, 'p0');
  assert.strictEqual(game.enemies.length, 0);
  assert.strictEqual(me.gold, 0);
});

test('bat screech tells for 0.6 s then slows nearby players', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 400, 312);
  const bat = game.spawnEnemy('bat', 450, 312);
  bat.timers.swoop = 999; // keep it from swooping during this test
  bat.timers.screech = game.time;
  game.tick(0.05);
  assert.strictEqual(bat.state, 'screech');
  assert.strictEqual(game.slowFactor(me), 1);
  run(game, 0.6);
  assert.ok(Math.abs(game.slowFactor(me) - 0.7) < 1e-9);
});

test('bat swoops, bites, then retreats', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 400, 312);
  const bat = game.spawnEnemy('bat', 560, 312);
  bat.timers.screech = 999;
  bat.timers.swoop = game.time;
  run(game, 0.6);
  assert.strictEqual(me.hp, 116);
  assert.strictEqual(bat.state, 'retreat');
});

test('bat flies over pits', () => {
  const rooms = [['wwwwwwwwww', 'wfffffffbw', 'weppppppfw', 'wffffffffw', 'wwwwwwwwww'], ARENA[1]];
  const game = makeGame(['knight'], rooms);
  const bat = game.enemies[0];
  run(game, 2);
  assert.ok(game.enemies.includes(bat));
});

test('enemies ignore downed players', () => {
  const game = makeGame(['knight', 'knight'], ARENA);
  const down = place(game, 0, 300, 312);
  const up = place(game, 1, 900, 312);
  game.damagePlayer(down, 999);
  const g = game.spawnEnemy('gloop', 400, 312);
  assert.strictEqual(enemies.pickTarget(game, g), up);
});

test('taunt pulls enemies onto the knight', () => {
  const game = makeGame(['knight', 'archer'], ARENA);
  const knight = place(game, 0, 500, 312);
  place(game, 1, 300, 312);
  const g = game.spawnEnemy('gloop', 320, 312);
  assert.strictEqual(enemies.pickTarget(game, g).id, 'p1');
  game.setInput('p0', { space: true });
  game.tick(0.05);
  assert.strictEqual(enemies.pickTarget(game, g), knight);
});

test('stunned enemies do not move', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 312);
  const g = game.spawnEnemy('gloop', 900, 312);
  g.stunUntil = game.time + 1;
  run(game, 0.9);
  assert.strictEqual(g.x, 900);
});

test('touching a gloop hurts at most once per 0.8 s', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 600, 312);
  const g = game.spawnEnemy('gloop', 610, 312);
  g.timers.bounce = 999;
  run(game, 0.5);
  assert.strictEqual(me.hp, 115);
});

test('room tiles keep walking monsters inside', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 72, 312);
  const g = game.spawnEnemy('gloop', 200, 312);
  run(game, 5);
  assert.ok(g.x - g.r >= TILE - 0.001);
});
