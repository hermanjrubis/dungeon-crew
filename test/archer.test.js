const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');

function place(game, i, x, y) {
  const me = game.players.get('p' + i);
  me.x = x; me.y = y;
  return me;
}
const archerOf = (game) => game.enemies.find((e) => e.type === 'archer');

test('archer backs away when you are close', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 300, 312);
  const a = game.spawnEnemy('archer', 360, 312);
  a.timers.volley = 999;
  run(game, 0.5);
  assert.ok(a.x > 390, String(a.x));
});

test('volley draws for 1 s then fires 3 arrows in a fan', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 300, 312);
  const a = game.spawnEnemy('archer', 560, 312);
  a.timers.volley = game.time;
  game.tick(0.05);
  assert.strictEqual(a.state, 'draw');
  run(game, 0.9);
  assert.strictEqual(game.projectiles.length, 0);
  run(game, 0.15);
  const shots = game.projectiles.filter((p) => p.hostile);
  assert.strictEqual(shots.length, 3);
  const angles = shots.map((s) => Math.atan2(s.vy, s.vx)).sort((x, y) => x - y);
  assert.ok(Math.abs(angles[1] - Math.PI) < 0.01 || Math.abs(Math.abs(angles[1]) - Math.PI) < 0.3);
  assert.ok(new Set(angles.map((x) => x.toFixed(2))).size === 3);
});

test('killed archer leaves bones that rebuild after 5 s', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 600);
  const a = game.spawnEnemy('archer', 700, 312);
  game.damageEnemy(a, 999, 'p0');
  const bones = game.enemies.find((e) => e.type === 'bones');
  assert.ok(bones);
  assert.ok(!game.enemies.includes(a));
  run(game, 4.9);
  assert.ok(game.enemies.includes(bones));
  run(game, 0.2);
  const back = archerOf(game);
  assert.ok(back);
  assert.strictEqual(back.hp, 30);
  assert.ok(!game.enemies.some((e) => e.type === 'bones'));
});

test('standing on the bones destroys them and pays 15 XP and 5 gold', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 100, 600);
  const a = game.spawnEnemy('archer', 700, 312);
  game.damageEnemy(a, 999, 'p0');
  assert.strictEqual(me.gold, 0);
  me.x = 700; me.y = 312;
  game.tick(0.05);
  assert.strictEqual(game.enemies.length, 0);
  assert.strictEqual(me.xp, 15);
  assert.strictEqual(me.gold, 5);
  assert.ok(game.drainEvents().some((e) => e.type === 'bonesBroken'));
});

test('the room is not clear while bones remain', () => {
  const rooms = [['wwwwwwwwwwww', 'wffffffffffw', 'weffffffaffd', 'wffffffffffw', 'wwwwwwwwwwww'], ARENA[1]];
  const game = makeGame(['knight'], rooms);
  const me = game.players.get('p0');
  game.damageEnemy(archerOf(game), 999, 'p0');
  game.tick(0.05);
  assert.strictEqual(game.doorOpen, false);
  const bones = game.enemies.find((e) => e.type === 'bones');
  me.x = bones.x; me.y = bones.y;
  game.tick(0.05);
  game.tick(0.05);
  assert.strictEqual(game.doorOpen, true);
});
