const test = require('node:test');
const assert = require('node:assert');
const { MONSTERS, HEROES, ECONOMY } = require('../shared/data');
const { makeGame, run, ARENA, center } = require('./helpers');

test('monsters drop double their listed gold', () => {
  const game = makeGame(['knight'], ARENA);
  const p = game.players.get('p0');
  game.enemies = [];
  const before = p.gold;
  const g = game.spawnEnemy('golem', center(10, 6).x, center(10, 6).y);
  game.killEnemy(g, { reward: true });
  const got = p.gold - before;
  assert.ok(got >= MONSTERS.golem.gold[0] * 2 && got <= MONSTERS.golem.gold[1] * 2, String(got));
});

test('clearing a room pays everyone a bonus that grows each floor', () => {
  assert.ok(ECONOMY.roomBonus.length >= 6);
  for (let i = 1; i < ECONOMY.roomBonus.length; i++) assert.ok(ECONOMY.roomBonus[i] > ECONOMY.roomBonus[i - 1]);
  const game = makeGame(['knight', 'archer'], [...ARENA, ...ARENA]);
  const before = [...game.players.values()].map((p) => p.gold);
  for (const e of game.enemies.slice()) game.killEnemy(e, { reward: false });
  game.tick(0.05);
  const after = [...game.players.values()].map((p) => p.gold);
  after.forEach((g, i) => assert.strictEqual(g - before[i], ECONOMY.roomBonus[0]));
  assert.ok(game.drainEvents().some((e) => e.type === 'roombonus'));
});

test('each star on the floor results pays a gold bonus', () => {
  const game = makeGame(['knight'], ARENA.slice(0, 1));
  const p = game.players.get('p0');
  for (const e of game.enemies.slice()) game.killEnemy(e, { reward: false });
  const before = p.gold;
  game.tick(0.05);
  const res = game.lastResults;
  assert.ok(res.starGold > 0);
  assert.strictEqual(res.starGold, res.stars * ECONOMY.starBonus[0]);
  assert.strictEqual(p.gold - before, ECONOMY.roomBonus[0] + res.starGold);
});

test('the Engineer turret is strong: double damage, faster, longer range, lasts 15 s', () => {
  const t = HEROES.engineer.q;
  assert.strictEqual(t.dmg, 14);
  assert.ok(t.every <= 0.43);
  assert.ok(t.range >= 390);
  assert.strictEqual(t.duration, 15);
  const game = makeGame(['engineer'], ARENA);
  const p = game.players.get('p0');
  p.weaponBonus = 20;
  game.enemies = [];
  Object.assign(p, center(4, 6));
  game.setInput('p0', { q: true });
  game.tick(0.05);
  const turret = game.zones.find((z) => z.kind === 'turret');
  assert.ok(turret);
  assert.strictEqual(turret.dmg, 14 + 20, 'the weapon bonus counts in full');
});
