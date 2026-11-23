const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');

// Put player i at (x, y) aiming right.
function place(game, i, x, y) {
  const me = game.players.get('p' + i);
  me.x = x; me.y = y;
  return me;
}
const press = (game, i, keys) => game.setInput('p' + i, { aim: 0, ...keys });

test('knight swing hits enemy in front but not behind', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 600, 312);
  const front = game.spawnEnemy('gloop', 650, 312);
  const behind = game.spawnEnemy('gloop', 550, 312);
  press(game, 0, { attack: true });
  game.tick(0.05);
  assert.strictEqual(front.hp, 6);
  assert.strictEqual(behind.hp, 20);
});

test('shield bash pushes back 96 px and stuns 1 s', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 600, 312);
  const g = game.spawnEnemy('gloop', 650, 312);
  press(game, 0, { q: true });
  game.tick(0.05);
  assert.strictEqual(g.hp, 12);
  assert.ok(Math.abs(g.x - 746) < 1, String(g.x));
  assert.ok(Math.abs(g.stunUntil - (game.time + 1)) < 0.051);
});

test('archer arrow travels and damages the first enemy it touches', () => {
  const game = makeGame(['archer'], ARENA);
  place(game, 0, 600, 312);
  const first = game.spawnEnemy('mother', 800, 312);
  const second = game.spawnEnemy('mother', 950, 312);
  press(game, 0, { attack: true });
  game.tick(0.05);
  press(game, 0, {});
  run(game, 0.5);
  assert.strictEqual(first.hp, 240);
  assert.strictEqual(second.hp, 250);
  assert.strictEqual(game.projectiles.length, 0);
});

test('arrows stop at walls', () => {
  const game = makeGame(['archer'], ARENA);
  place(game, 0, 1000, 312);
  press(game, 0, { attack: true });
  game.tick(0.05);
  assert.strictEqual(game.projectiles.length, 1);
  press(game, 0, {});
  run(game, 0.5);
  assert.strictEqual(game.projectiles.length, 0);
});

test('dodge roll makes the archer invulnerable while rolling', () => {
  const game = makeGame(['archer'], ARENA);
  const me = place(game, 0, 300, 312);
  press(game, 0, { space: true, right: true });
  game.tick(0.05);
  press(game, 0, {});
  assert.strictEqual(game.damagePlayer(me, 30), 0);
  assert.strictEqual(me.hp, 80);
  run(game, 0.3);
  assert.ok(Math.abs(me.x - 460) < 2, String(me.x));
  game.damagePlayer(me, 30);
  assert.strictEqual(me.hp, 50);
});

test('mage bolt costs 5 mana and fails at 0 mana', () => {
  const game = makeGame(['mage'], ARENA);
  const me = place(game, 0, 300, 312);
  press(game, 0, { attack: true });
  game.tick(0.05);
  assert.strictEqual(game.projectiles.length, 1);
  assert.ok(me.mana <= 95.5 && me.mana >= 95, String(me.mana));
  game.projectiles.length = 0;
  me.mana = 0;
  me.cd.attack = 0;
  game.tick(0.05);
  assert.strictEqual(game.projectiles.length, 0);
});

test('fireball explodes for 24 damage in radius 64', () => {
  const game = makeGame(['mage'], ARENA);
  place(game, 0, 600, 312);
  const hit = game.spawnEnemy('mother', 720, 312);
  const near = game.spawnEnemy('mother', 720, 380);
  const far = game.spawnEnemy('mother', 720, 560);
  press(game, 0, { q: true });
  game.tick(0.05);
  press(game, 0, {});
  run(game, 0.5);
  assert.strictEqual(hit.hp, 226);
  assert.strictEqual(near.hp, 226);
  assert.strictEqual(far.hp, 250);
  assert.ok(game.zones.some((z) => z.kind === 'fireBlast') || game.drainEvents().length > 0);
});

test('heal circle heals a teammate inside 10 HP per second, not one outside', () => {
  const game = makeGame(['mage', 'knight', 'knight'], ARENA);
  place(game, 0, 300, 312);
  const inside = place(game, 1, 320, 312);
  const outside = place(game, 2, 700, 312);
  inside.hp = 50;
  outside.hp = 50;
  press(game, 0, { space: true });
  game.tick(0.05);
  press(game, 0, {});
  run(game, 3.1);
  assert.strictEqual(inside.hp, 80);
  assert.strictEqual(outside.hp, 50);
});

test('arrow rain deals 5 every 0.25 s for 2 s', () => {
  const game = makeGame(['archer'], ARENA);
  place(game, 0, 300, 312);
  const m = game.spawnEnemy('mother', 660, 312);
  press(game, 0, { q: true });
  game.tick(0.05);
  press(game, 0, {});
  run(game, 0.5);
  assert.strictEqual(m.hp, 240);
  run(game, 2);
  assert.strictEqual(m.hp, 210);
});

test('cooldowns block reuse', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 300, 312);
  press(game, 0, { space: true });
  game.tick(0.05);
  const until = game.tauntBy.until;
  press(game, 0, {});
  run(game, 1);
  press(game, 0, { space: true });
  game.tick(0.05);
  assert.strictEqual(game.tauntBy.until, until);
});

test('stunned or downed players cannot act', () => {
  const game = makeGame(['knight', 'knight'], ARENA);
  const a = place(game, 0, 600, 312);
  const b = place(game, 1, 600, 500);
  const g1 = game.spawnEnemy('gloop', 650, 312);
  const g2 = game.spawnEnemy('gloop', 650, 500);
  a.stunUntil = game.time + 5;
  game.damagePlayer(b, 999);
  press(game, 0, { attack: true });
  press(game, 1, { attack: true });
  game.tick(0.05);
  assert.strictEqual(g1.hp, 20);
  assert.strictEqual(g2.hp, 20);
});
