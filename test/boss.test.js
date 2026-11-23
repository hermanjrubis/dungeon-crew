const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');

function setup(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  const me = game.players.get('p0');
  me.x = 300; me.y = 312;
  const m = game.spawnEnemy('mother', 700, 312);
  return { game, me, m };
}

test('belly flop shows a shadow for 1.5 s, is untargetable, then hits players under it', () => {
  const { game, me, m } = setup();
  m.timers.brood = 999;
  m.timers.flop = game.time;
  game.tick(0.05);
  assert.strictEqual(m.state, 'airborne');
  assert.strictEqual(m.invulnerable, true);
  const shadow = game.zones.find((z) => z.kind === 'flopShadow');
  assert.ok(shadow);
  assert.deepStrictEqual({ x: shadow.x, y: shadow.y }, { x: 300, y: 312 });
  assert.strictEqual(game.damageEnemy(m, 50, 'p0'), 0);
  run(game, 1.4);
  assert.strictEqual(me.hp, 120);
  run(game, 0.15);
  assert.strictEqual(me.hp, 100);
  assert.deepStrictEqual({ x: m.x, y: m.y }, { x: 300, y: 312 });
  assert.strictEqual(m.invulnerable, false);
});

test('players who move out of the shadow are safe', () => {
  const { game, me, m } = setup();
  m.timers.brood = 999;
  m.timers.flop = game.time;
  game.tick(0.05);
  me.x = 500;
  run(game, 1.6);
  assert.strictEqual(me.hp, 120);
});

test('brood spawns 2 no-reward gloops every 12 s', () => {
  const { game, m } = setup();
  m.timers.flop = 999;
  m.timers.brood = game.time;
  game.tick(0.05);
  const gloops = game.enemies.filter((e) => e.type === 'gloop');
  assert.strictEqual(gloops.length, 2);
  assert.ok(gloops.every((g) => g.noReward));
  assert.ok(Math.abs(m.timers.brood - (game.time + 12)) < 1e-9);
});

test('slime trail slows players 40%', () => {
  const { game, me, m } = setup();
  m.timers.flop = 999;
  m.timers.brood = 999;
  run(game, 1);
  const slime = game.zones.find((z) => z.kind === 'slime');
  assert.ok(slime, 'mother leaves slime while walking');
  me.x = slime.x; me.y = slime.y;
  game.tick(0.05);
  assert.ok(Math.abs(game.slowFactor(me) - 0.6) < 1e-9);
});

test('at half HP the mother splits into two 60 HP halves', () => {
  const { game, m } = setup();
  m.timers.flop = 999;
  m.timers.brood = 999;
  game.damageEnemy(m, 130, 'p0');
  game.tick(0.05);
  assert.ok(!game.enemies.includes(m));
  const halves = game.enemies.filter((e) => e.type === 'halfmother');
  assert.strictEqual(halves.length, 2);
  assert.ok(halves.every((h) => h.hp === 60));
});

test('room clears only after both halves and all gloops die', () => {
  const rooms = [['wwwwwwwwwwww', 'wffffffffffw', 'wefffffMfffw', 'wffffffffffw', 'wwwwwwwwwwww']];
  const game = makeGame(['knight'], rooms);
  const m = game.enemies[0];
  m.timers.flop = 999;
  m.timers.brood = game.time;
  game.tick(0.05);
  game.damageEnemy(m, 200, 'p0');
  game.tick(0.05);
  const halves = game.enemies.filter((e) => e.type === 'halfmother');
  game.damageEnemy(halves[0], 999, 'p0');
  game.damageEnemy(halves[1], 999, 'p0');
  game.tick(0.05);
  assert.strictEqual(game.phase, 'playing');
  while (game.enemies.length) game.damageEnemy(game.enemies[0], 999, 'p0');
  game.tick(0.05);
  assert.strictEqual(game.phase, 'shop');
});

test('the mother gives her gold and xp only once, when the last half dies', () => {
  const { game, me, m } = setup();
  m.timers.flop = 999;
  m.timers.brood = 999;
  game.damageEnemy(m, 130, 'p0');
  game.tick(0.05);
  assert.strictEqual(me.gold, 0);
  const halves = game.enemies.filter((e) => e.type === 'halfmother');
  game.damageEnemy(halves[0], 999, 'p0');
  assert.strictEqual(me.gold, 0);
  game.damageEnemy(halves[1], 999, 'p0');
  assert.strictEqual(me.gold, 40);
  assert.strictEqual(me.xp, 100);
});

test('halves and brood gloops never appear inside a wall when the mother is next to one', () => {
  const tiles = require('../shared/tiles');
  const game = makeGame(['knight'], ARENA);
  const me = game.players.get('p0');
  me.x = 600; me.y = 312;
  const m = game.spawnEnemy('mother', 48 + 41, 312); // pressed against the left wall
  m.timers.flop = 999;
  m.timers.brood = game.time;
  game.tick(0.05);
  game.damageEnemy(m, 130, 'p0');
  game.tick(0.05);
  const inWall = (e) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx, sy]) =>
    tiles.isSolid(tiles.tileAt(game.room, e.x + sx * (e.r - 1), e.y + sy * (e.r - 1)), {}));
  const spawned = game.enemies.filter((e) => e.type === 'halfmother' || e.type === 'gloop');
  assert.strictEqual(spawned.length, 4);
  for (const e of spawned) assert.ok(!inWall(e), `${e.type} at ${e.x},${e.y} is inside a wall`);
});
