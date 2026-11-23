// Poison, enemy projectiles and being held in place (rooted).
const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');

function place(game, i, x, y) {
  const me = game.players.get('p' + i);
  me.x = x; me.y = y;
  return me;
}

test('poison 3 per second deals 3 damage over 1 s, ignoring defense', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 300, 312);
  me.defense = 6;
  for (let i = 0; i < 20; i++) game.poisonPlayer(me, 3, 0.05);
  assert.strictEqual(me.hp, 117);
  assert.strictEqual(game.snapshot().players[0].poisoned, true);
});

test('full Cellar Guard set halves poison', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 300, 312);
  me.owned = ['helm', 'mail', 'boots'];
  for (let i = 0; i < 40; i++) game.poisonPlayer(me, 3, 0.05);
  assert.strictEqual(me.hp, 117);
});

test('enemy arrows hurt players but not monsters', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 600, 312);
  const m = game.spawnEnemy('mother', 450, 312);
  m.stunUntil = 999;
  game.addProjectile({ kind: 'enemyArrow', hostile: true, x: 380, y: 312, vx: 420, vy: 0, r: 6, dmg: 8, until: game.time + 2 });
  run(game, 0.6);
  assert.strictEqual(me.hp, 112);
  assert.strictEqual(m.hp, 250);
  assert.strictEqual(game.projectiles.length, 0);
});

test('dodge roll dodges enemy arrows', () => {
  const game = makeGame(['archer'], ARENA);
  const me = place(game, 0, 600, 312);
  me.invulnUntil = game.time + 5;
  game.addProjectile({ kind: 'enemyArrow', hostile: true, x: 500, y: 312, vx: 420, vy: 0, r: 6, dmg: 8, until: game.time + 2 });
  run(game, 0.5);
  assert.strictEqual(me.hp, 80);
});

test("rooted players can't walk but can still attack", () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 600, 312);
  const g = game.spawnEnemy('mother', 650, 312);
  g.stunUntil = 999;
  me.rootUntil = game.time + 1;
  game.setInput('p0', { right: true, attack: true, aim: 0 });
  game.tick(0.05);
  assert.strictEqual(me.x, 600);
  assert.strictEqual(g.hp, 236);
  assert.strictEqual(game.snapshot().players[0].rooted, true);
});
