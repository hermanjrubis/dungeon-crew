const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');

function place(game, i, x, y) {
  const me = game.players.get('p' + i);
  me.x = x; me.y = y;
  return me;
}
const count = (game, type) => game.enemies.filter((e) => e.type === type).length;

test('sporecap swells then puffs poison when you come close', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 600, 312);
  const c = game.spawnEnemy('sporecap', 670, 312);
  c.timers.seed = 999;
  c.timers.puff = game.time;
  game.tick(0.05);
  assert.strictEqual(c.state, 'swell');
  assert.ok(!game.zones.some((z) => z.kind === 'poisonCloud'));
  run(game, 0.6);
  assert.ok(game.zones.some((z) => z.kind === 'poisonCloud'));
});

test('a sporecap far away does not puff', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 200, 312);
  const c = game.spawnEnemy('sporecap', 800, 312);
  c.timers.seed = 999;
  c.timers.puff = game.time;
  run(game, 1);
  assert.notStrictEqual(c.state, 'swell');
  assert.ok(!game.zones.some((z) => z.kind === 'poisonCloud'));
});

test('standing in the cloud poisons 3 per second', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 600, 312);
  const c = game.spawnEnemy('sporecap', 670, 312);
  c.timers.seed = 999;
  c.timers.puff = game.time;
  run(game, 0.65);
  const hp = me.hp;
  run(game, 1);
  assert.ok(hp - me.hp >= 2 && hp - me.hp <= 3, `took ${hp - me.hp}`);
});

test('seed grows into a sporecap after 10 s', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 600);
  const c = game.spawnEnemy('sporecap', 700, 312);
  c.timers.puff = 999;
  c.timers.seed = game.time;
  game.tick(0.05);
  assert.strictEqual(count(game, 'seed'), 1);
  const seed = game.enemies.find((e) => e.type === 'seed');
  assert.ok(Math.hypot(seed.x - c.x, seed.y - c.y) <= 3 * 48 + 1);
  run(game, 10.05);
  assert.strictEqual(count(game, 'seed'), 0);
  assert.strictEqual(count(game, 'sporecap'), 2);
});

test('one hit breaks a seed', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 600);
  const seed = game.spawnEnemy('seed', 700, 312, { noReward: true });
  game.damageEnemy(seed, 1, 'p0');
  assert.strictEqual(count(game, 'seed'), 0);
});

test('never more than 6 sporecaps and seeds in a room', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 600);
  const caps = [];
  for (let i = 0; i < 5; i++) caps.push(game.spawnEnemy('sporecap', 500 + i * 60, 200));
  for (const c of caps) { c.timers.puff = 999; c.timers.seed = game.time; }
  for (let i = 0; i < 40; i++) {
    run(game, 1);
    assert.ok(count(game, 'sporecap') + count(game, 'seed') <= 6);
  }
});
