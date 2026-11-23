const test = require('node:test');
const assert = require('node:assert');
const { makeGame, run, center, ARENA } = require('./helpers');

const me = (game, i = 0) => game.players.get('p' + i);

function golemGame(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  const g = game.spawnEnemy('golem', center(10, 6).x, center(10, 6).y);
  g.speed = 0; // stand still so only the slam can hit
  return { game, g };
}

test('the golem raises its fists for 1 s then slams everyone within 2 tiles', () => {
  const { game, g } = golemGame();
  Object.assign(me(game), { x: g.x + 80, y: g.y });
  run(game, 2.05);
  assert.strictEqual(g.state, 'raise');
  run(game, 0.9);
  assert.strictEqual(me(game).hp, 120);
  run(game, 0.15);
  assert.strictEqual(me(game).hp, 100);
  assert.ok(game.drainEvents().some((e) => e.type === 'slam' && e.r === 96));
});

test('a player 3 tiles away is safe from the slam', () => {
  const { game, g } = golemGame();
  Object.assign(me(game), { x: g.x + 144, y: g.y });
  run(game, 4);
  assert.strictEqual(me(game).hp, 120);
});

test('hits from the front do half damage, from behind full', () => {
  const { game, g } = golemGame(['knight', 'knight']);
  Object.assign(me(game, 0), { x: g.x + 50, y: g.y });
  Object.assign(me(game, 1), { x: g.x - 70, y: g.y });
  game.tick(0.05); // the golem turns to face the closest player
  game.drainEvents();
  assert.strictEqual(game.damageEnemy(g, 14, 'p0'), 7);
  assert.strictEqual(game.damageEnemy(g, 14, 'p1'), 14);
  const hits = game.drainEvents().filter((e) => e.type === 'damage' && e.enemyId === g.id);
  assert.deepStrictEqual(hits.map((e) => !!e.armored), [true, false]);
  assert.strictEqual(typeof game.snapshot().enemies[0].facing, 'number');
});

test('hazard damage is never halved', () => {
  const { game, g } = golemGame();
  Object.assign(me(game), { x: g.x + 50, y: g.y });
  game.tick(0.05);
  assert.strictEqual(game.damageEnemy(g, 14, null), 14);
});
