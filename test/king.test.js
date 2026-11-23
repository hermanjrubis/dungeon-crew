const test = require('node:test');
const assert = require('node:assert');
const { makeGame, run, center, ARENA } = require('./helpers');

const me = (game, i = 0) => game.players.get('p' + i);

function kingGame(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  const k = game.spawnEnemy('king', center(12, 6).x, center(12, 6).y);
  k.speed = 0;
  return { game, k };
}
const bolts = (game) => game.projectiles.filter((p) => p.kind === 'shadowBolt');

test('royal sweep warns for 1 s then hits in front, not behind', () => {
  const { game, k } = kingGame(['knight', 'knight']);
  Object.assign(me(game, 0), { x: k.x + 90, y: k.y });
  Object.assign(me(game, 1), { x: k.x - 100, y: k.y });
  run(game, 2.05);
  assert.strictEqual(k.state, 'raise');
  run(game, 0.9);
  assert.strictEqual(me(game, 0).hp, 120);
  run(game, 0.15);
  assert.strictEqual(me(game, 0).hp, 95);
  assert.strictEqual(me(game, 1).hp, 120);
  assert.ok(game.drainEvents().some((e) => e.type === 'sweep'));
});

test('summon court calls 3 gloops that give no gold', () => {
  const { game } = kingGame();
  Object.assign(me(game), center(2, 6));
  run(game, 8.1);
  const court = game.enemies.filter((e) => e.type === 'gloop');
  assert.strictEqual(court.length, 3);
  assert.ok(court.every((e) => e.noReward));
});

test('at half HP the crown flares once and he gets faster', () => {
  const { game, k } = kingGame();
  k.speed = 70;
  Object.assign(me(game), center(2, 2));
  k.hp = 300;
  run(game, 0.5);
  const flares = game.drainEvents().filter((e) => e.type === 'crownflare');
  assert.strictEqual(flares.length, 1);
  assert.ok(Math.abs(k.speed - 98) < 1e-9);
  assert.strictEqual(k.phase2, true);
});

test('shadow ring fires 12 bolts after a 1.5 s glow, only in phase 2', () => {
  const { game, k } = kingGame();
  Object.assign(me(game), center(2, 2));
  run(game, 7);
  assert.strictEqual(bolts(game).length, 0);
  k.hp = 300;
  run(game, 1.1);
  assert.strictEqual(k.state, 'ring');
  run(game, 1.4);
  assert.strictEqual(bolts(game).length, 0);
  run(game, 0.15);
  assert.strictEqual(bolts(game).length, 12);
  assert.ok(bolts(game).every((b) => b.hostile && b.dmg === 15));
});

test('king HP is 750 with two players', () => {
  const { k } = kingGame(['knight', 'mage']);
  assert.strictEqual(k.maxHp, 750);
});
