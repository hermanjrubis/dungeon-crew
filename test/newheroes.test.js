const test = require('node:test');
const assert = require('node:assert');
const data = require('../shared/data');
const { makeGame, run, center, ARENA } = require('./helpers');

const me = (game, i = 0) => game.players.get('p' + i);
const ROOMS = [ARENA[0], ARENA[0]];
function at(game, i, tx, ty) { Object.assign(me(game, i), center(tx, ty)); }
function press(game, id, keys) { game.setInput(id, { aim: 0, ...keys }); }
function dummy(game, type, tx, ty) {
  const e = game.spawnEnemy(type, center(tx, ty).x, center(tx, ty).y);
  e.speed = 0;
  e.timers.bounce = 999;
  return e;
}

test('the lobby offers five heroes', () => {
  assert.deepStrictEqual(data.CLASSES, ['knight', 'archer', 'mage', 'warden', 'engineer']);
  assert.strictEqual(data.HEROES.warden.name, 'Stonewarden');
  assert.strictEqual(data.HEROES.warden.hp, 170);
  assert.strictEqual(data.HEROES.engineer.name, 'Engineer');
});

// ---------- Stonewarden ----------

test('rock throw shoots a rock', () => {
  const game = makeGame(['warden'], ROOMS);
  at(game, 0, 3, 6);
  dummy(game, 'golem', 20, 6);
  press(game, 'p0', { attack: true });
  game.tick(0.05);
  const rock = game.projectiles.find((p) => p.kind === 'rock');
  assert.ok(rock);
  assert.strictEqual(rock.r, 9);
  assert.ok(game.drainEvents().some((e) => e.type === 'attack' && e.kind === 'warden'));
});

test('a boulder rolls through monsters, hitting each once', () => {
  const game = makeGame(['warden'], ROOMS);
  at(game, 0, 3, 6);
  const a = dummy(game, 'golem', 6, 6);
  const b = dummy(game, 'golem', 9, 6);
  a.hp = b.hp = 500;
  press(game, 'p0', { q: true });
  run(game, 1.5);
  // golems take half from the front: 22 -> 11
  assert.strictEqual(a.hp, 500 - 11);
  assert.strictEqual(b.hp, 500 - 11);
  assert.ok(a.x > center(6, 6).x, 'pushed along');
});

test('quake stomp stuns monsters nearby and only slows bosses', () => {
  const game = makeGame(['warden'], ROOMS);
  at(game, 0, 10, 6);
  const g = dummy(game, 'gloop', 11, 6);
  const boss = dummy(game, 'king', 9, 6);
  const far = dummy(game, 'gloop', 16, 6);
  g.hp = 100;
  press(game, 'p0', { space: true });
  game.tick(0.05);
  assert.strictEqual(g.hp, 86);
  assert.ok(g.stunUntil > game.time + 1);
  assert.ok(!(boss.stunUntil > game.time));
  assert.ok(game.slowFactor(boss) < 1);
  assert.strictEqual(far.hp, far.maxHp);
  assert.ok(game.drainEvents().some((e) => e.type === 'cast' && e.skill === 'quake'));
});

test('thick skin takes 30% less damage, never 0', () => {
  const game = makeGame(['warden'], ROOMS);
  assert.strictEqual(game.damagePlayer(me(game), 20, 'test'), 14);
  assert.strictEqual(game.damagePlayer(me(game), 1, 'test'), 1);
});

test('thick skin also cuts poison and lava', () => {
  const game = makeGame(['warden', 'knight'], ROOMS);
  dummy(game, 'gloop', 20, 2); // keep the room busy
  for (let i = 0; i < 20; i++) { game.poisonPlayer(me(game, 0), 10, 0.05); game.poisonPlayer(me(game, 1), 10, 0.05); }
  assert.strictEqual(170 - me(game, 0).hp, 7);
  assert.strictEqual(120 - me(game, 1).hp, 10);
  me(game, 0).hp = 170;
  game.burnPlayer(me(game, 0));
  run(game, 3.1);
  assert.strictEqual(170 - me(game, 0).hp, 6); // 9 burn * 0.7
});

test('wing gust pushes the Stonewarden half as far', () => {
  const game = makeGame(['warden', 'knight'], ROOMS);
  const d = game.spawnEnemy('dragon', center(12, 6).x, center(12, 6).y);
  d.speed = 0;
  d.attackIdx = 1;
  d.timers.tail = 999;
  Object.assign(me(game, 0), { x: d.x + 100, y: d.y });
  Object.assign(me(game, 1), { x: d.x - 100, y: d.y });
  run(game, 3.1);
  assert.ok(Math.abs(me(game, 0).x - (d.x + 196)) < 1, `warden x ${me(game, 0).x - d.x}`);
  assert.ok(Math.abs(me(game, 1).x - (d.x - 292)) < 1);
});

// ---------- Engineer ----------

test("the engineer's wrench swings", () => {
  const game = makeGame(['engineer'], ROOMS);
  at(game, 0, 5, 6);
  const g = dummy(game, 'gloop', 6, 6);
  g.hp = 100;
  press(game, 'p0', { attack: true });
  game.tick(0.05);
  assert.strictEqual(g.hp, 100 - (9 + 3));
});

test('a turret shoots the nearest monster for 15 s', () => {
  const game = makeGame(['engineer'], ROOMS);
  at(game, 0, 4, 6);
  const g = dummy(game, 'golem', 9, 6);
  g.hp = 1000;
  g.facing = Math.PI; // facing the turret: half damage from the front... turrets have no facing, so full damage
  press(game, 'p0', { q: true });
  game.tick(0.05);
  press(game, 'p0', {});
  const turret = game.zones.find((z) => z.kind === 'turret');
  assert.ok(turret);
  run(game, 3);
  assert.ok(g.hp < 1000);
  assert.ok(game.drainEvents().some((e) => e.type === 'turretfire'));
  run(game, 12.5);
  assert.ok(!game.zones.some((z) => z.kind === 'turret'), 'gone after 15 s');
});

test('a new turret replaces the old one, but two engineers keep one each', () => {
  const game = makeGame(['engineer', 'engineer'], ROOMS);
  dummy(game, 'gloop', 20, 2);
  press(game, 'p0', { q: true });
  game.tick(0.05);
  me(game).cd.q = 0;
  press(game, 'p0', {});
  game.tick(0.05);
  press(game, 'p0', { q: true });
  press(game, 'p1', { q: true });
  game.tick(0.05);
  const turrets = game.zones.filter((z) => z.kind === 'turret');
  assert.deepStrictEqual(turrets.map((t) => t.ownerId).sort(), ['p0', 'p1']);
});

test('mines arm, then blow up when a monster steps close', () => {
  const game = makeGame(['engineer'], ROOMS);
  at(game, 0, 4, 6);
  const keep = dummy(game, 'gloop', 20, 2);
  press(game, 'p0', { space: true });
  game.tick(0.05);
  press(game, 'p0', {});
  at(game, 0, 2, 2);
  const mine = game.zones.find((z) => z.kind === 'mine');
  assert.ok(mine);
  const g = dummy(game, 'gloop', 4, 6);
  g.hp = 100;
  game.tick(0.05);
  assert.strictEqual(g.hp, 100, 'not armed yet');
  run(game, 0.6);
  assert.strictEqual(g.hp, 70);
  assert.ok(!game.zones.some((z) => z.kind === 'mine'));
  assert.strictEqual(keep.hp, keep.maxHp);
});

test('at most two mines', () => {
  const game = makeGame(['engineer'], ROOMS);
  dummy(game, 'gloop', 20, 2);
  for (let i = 0; i < 3; i++) {
    at(game, 0, 3 + i * 3, 8);
    me(game).cd.space = 0;
    press(game, 'p0', { space: true });
    game.tick(0.05);
    press(game, 'p0', {});
    game.tick(0.05);
  }
  const mines = game.zones.filter((z) => z.kind === 'mine');
  assert.strictEqual(mines.length, 2);
  assert.deepStrictEqual(mines.map((m) => Math.round(m.x)), [center(6, 8).x, center(9, 8).x]);
});

test('turrets and mines vanish when the room changes', () => {
  const game = makeGame(['engineer'], ROOMS);
  dummy(game, 'gloop', 20, 2);
  press(game, 'p0', { q: true, space: true });
  game.tick(0.05);
  assert.strictEqual(game.zones.filter((z) => z.kind === 'turret' || z.kind === 'mine').length, 2);
  game.nextRoom();
  assert.strictEqual(game.zones.length, 0);
});

test('scrapper gives the engineer 10% more gold', () => {
  const game = makeGame(['engineer', 'knight'], ROOMS);
  const golem = game.spawnEnemy('golem', 300, 300);
  game.damageEnemy(golem, 999, 'p1');
  // rng () => 0 -> the lowest roll: 10 gold, doubled = 20; engineer gets 22
  assert.strictEqual(me(game, 1).gold, 20);
  assert.strictEqual(me(game, 0).gold, 22);
});

test("the shops sell the new heroes' weapons", () => {
  assert.strictEqual(data.SHOP_WEAPONS.warden, 'Iron Sling');
  assert.strictEqual(data.SHOPS.forge.weapons.engineer, 'Arc Wrench');
  assert.strictEqual(data.SHOPS.crown.weapons.warden, 'Magma Sling');
});
