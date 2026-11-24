const test = require('node:test');
const assert = require('node:assert');
const { LOOT, MONSTERS } = require('../shared/data');
const loot = require('../server/loot');
const { makeGame, ARENA, center } = require('./helpers');

function arena(classes = ['knight']) {
  const game = makeGame(classes, [...ARENA, ...ARENA]);
  for (const e of game.enemies.slice()) game.killEnemy(e, { reward: false });
  game.tick(0.05); // the room-clear bonus is paid here, before the test starts
  game.drainEvents();
  game.loot = [];
  return game;
}
const far = () => center(14, 8);

test('the loot table matches the design', () => {
  assert.deepStrictEqual(LOOT.chance, { feather: 0.02, potion: 0.06, heart: 0.12, coins: 0.35 });
  assert.strictEqual(LOOT.life, 12);
  assert.strictEqual(LOOT.heartHeal, 0.2);
});

test('a kill rolls at most one drop, picked by chance', () => {
  const cases = [[0.01, 'feather'], [0.05, 'potion'], [0.15, 'heart'], [0.4, 'coins'], [0.9, null]];
  for (const [roll, kind] of cases) {
    const game = arena();
    const e = game.spawnEnemy('golem', far().x, far().y);
    game.rng = () => roll;
    game.killEnemy(e, { reward: true });
    assert.strictEqual(game.loot.length, kind ? 1 : 0, String(roll));
    if (kind) assert.strictEqual(game.loot[0].kind, kind);
  }
});

test('a coin pile is worth 1 to 2 times the monster gold', () => {
  const game = arena();
  const e = game.spawnEnemy('golem', far().x, far().y);
  game.rng = () => 0.4;
  game.killEnemy(e, { reward: true });
  const [lo, hi] = MONSTERS.golem.gold;
  const amt = game.loot[0].amount;
  assert.ok(amt >= lo * 2 && amt <= hi * 2 * 2, String(amt));
});

test('a boss always drops 5 to 8 coin piles and a potion', () => {
  const game = arena();
  const e = game.spawnEnemy('mother', far().x, far().y);
  game.killEnemy(e, { reward: true });
  const coins = game.loot.filter((l) => l.kind === 'coins').length;
  assert.ok(coins >= 5 && coins <= 8, String(coins));
  assert.strictEqual(game.loot.filter((l) => l.kind === 'potion').length, 1);
});

test('summoned helpers and unrewarded kills drop nothing', () => {
  const game = arena();
  game.rng = () => 0.01;
  const a = game.spawnEnemy('bat', far().x, far().y);
  a.summonedBy = 999;
  game.killEnemy(a, { reward: true });
  const b = game.spawnEnemy('golem', far().x, far().y);
  game.killEnemy(b, { reward: false });
  assert.strictEqual(game.loot.length, 0);
});

test('first hero to touch it keeps it; only one hero gets it', () => {
  const game = arena(['knight', 'archer']);
  const [p, q] = [...game.players.values()];
  q.x = p.x - 4; q.y = p.y;
  loot.drop(game, 'potion', p.x + 10, p.y);
  const before = [p.potions, q.potions];
  game.tick(0.05);
  assert.strictEqual(p.potions + q.potions - before[0] - before[1], 1);
  assert.strictEqual(p.potions - before[0], 1, 'the closer hero wins');
  assert.strictEqual(game.loot.length, 0);
  const ev = game.drainEvents().find((e) => e.type === 'pickup');
  assert.deepStrictEqual([ev.kind, ev.playerId, ev.amount, typeof ev.id], ['potion', p.id, 1, 'number']);
});

test('coins go only to the picker and count in their stats', () => {
  const game = arena(['knight', 'archer']);
  const [p, q] = [...game.players.values()];
  q.x = far().x; q.y = far().y;
  loot.drop(game, 'coins', p.x, p.y, 17);
  const g = [p.gold, q.gold, p.stats.gold];
  game.tick(0.05);
  assert.deepStrictEqual([p.gold - g[0], q.gold - g[1], p.stats.gold - g[2]], [17, 0, 17]);
});

test('feathers go in the bag; hearts heal 20% at once', () => {
  const game = arena();
  const p = game.players.get('p0');
  loot.drop(game, 'feather', p.x, p.y);
  game.tick(0.05);
  assert.strictEqual(p.feathers, 1);
  p.hp = 10;
  loot.drop(game, 'heart', p.x, p.y);
  game.tick(0.05);
  assert.strictEqual(p.hp, 10 + Math.round(p.maxHp * 0.2));
});

test('a fallen hero cannot pick things up', () => {
  const game = arena(['knight', 'archer']);
  const [p, q] = [...game.players.values()];
  q.x = far().x; q.y = far().y;
  p.downed = true;
  loot.drop(game, 'potion', p.x, p.y);
  const before = p.potions;
  game.tick(0.05);
  assert.strictEqual(p.potions, before);
  assert.strictEqual(game.loot.length, 1);
});

test('loot vanishes after 12 seconds and when the room changes', () => {
  const game = arena();
  loot.drop(game, 'coins', far().x, far().y, 5);
  game.time += 11.9; game.tick(0.05);
  assert.strictEqual(game.loot.length, 1);
  game.time += 0.2; game.tick(0.05);
  assert.strictEqual(game.loot.length, 0);
  loot.drop(game, 'coins', far().x, far().y, 5);
  game.roomIndex = 1; game.loadRoom();
  assert.strictEqual(game.loot.length, 0);
});

test('the snapshot lists loot on the floor', () => {
  const game = arena();
  loot.drop(game, 'heart', far().x, far().y);
  const s = game.snapshot().loot;
  assert.strictEqual(s.length, 1);
  assert.deepStrictEqual(Object.keys(s[0]).sort(), ['id', 'kind', 'until', 'x', 'y']);
});
