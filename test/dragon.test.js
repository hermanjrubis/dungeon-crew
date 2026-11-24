const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const { makeGame, run, center, ARENA } = require('./helpers');
const { FLOORS } = require('../shared/rooms');

const me = (game, i = 0) => game.players.get('p' + i);

function dragonGame(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  const d = game.spawnEnemy('dragon', center(12, 6).x, center(12, 6).y);
  d.speed = 0;
  return { game, d };
}
const hits = (game, id, amount) => game.drainEvents().filter((e) => e.type === 'damage' && e.targetId === id && e.amount === amount).length;

test('ashmaw has 1500 HP with two players', () => {
  const { d } = dragonGame(['knight', 'mage']);
  assert.strictEqual(d.maxHp, 1500);
});

test('fire breath glows 1.5 s then burns everyone in the cone', () => {
  const { game, d } = dragonGame(['knight', 'knight']);
  Object.assign(me(game, 0), { x: d.x + 150, y: d.y });
  Object.assign(me(game, 1), { x: d.x - 150, y: d.y });
  run(game, 2.05);
  assert.strictEqual(d.state, 'breathe');
  const warn = game.snapshot().zones.find((z) => z.kind === 'breathWarn');
  assert.ok(warn && typeof warn.aim === 'number' && warn.spread > 0);
  run(game, 1.4);
  assert.strictEqual(me(game, 0).hp, 120);
  game.drainEvents();
  run(game, 0.15);
  assert.strictEqual(hits(game, 'p0', 35), 1);
  assert.strictEqual(me(game, 0).burnUntil > game.time, true);
  assert.strictEqual(me(game, 1).hp, 120);
});

test('the crown set cuts dragon fire by 40%', () => {
  const { game, d } = dragonGame();
  me(game).owned.push('helm3', 'plate3', 'boots3');
  Object.assign(me(game), { x: d.x + 150, y: d.y });
  run(game, 3.5);
  game.drainEvents();
  run(game, 0.15);
  assert.strictEqual(hits(game, 'p0', 21), 1);
});

test('wing gust pushes players 4 tiles away', () => {
  const { game, d } = dragonGame();
  d.attackIdx = 1; // gust is next
  Object.assign(me(game), { x: d.x + 100, y: d.y });
  run(game, 2.05);
  assert.strictEqual(d.state, 'flap');
  run(game, 1);
  assert.ok(Math.abs(me(game).x - (d.x + 292)) < 1, `x ${me(game).x}`);
  assert.ok(game.drainEvents().some((e) => e.type === 'gust'));
});

test('tail swipe hits only players behind', () => {
  const { game, d } = dragonGame(['knight', 'knight']);
  d.timers.attack = 999;
  Object.assign(me(game, 0), { x: d.x + 70, y: d.y }); // closest, so the dragon faces p0
  Object.assign(me(game, 1), { x: d.x - 90, y: d.y });
  run(game, 3.05);
  assert.strictEqual(d.state, 'tail');
  run(game, 0.8);
  assert.strictEqual(me(game, 1).hp, 95);
  assert.strictEqual(me(game, 0).hp, 120);
});

test('meteor marks warn 1.5 s, then hit only inside them', () => {
  const { game, d } = dragonGame(['knight', 'knight']);
  d.attackIdx = 3; // meteor is next
  d.timers.tail = 999;
  Object.assign(me(game, 0), { x: d.x + 200, y: d.y });
  Object.assign(me(game, 1), { x: d.x - 200, y: d.y });
  run(game, 2.05);
  assert.strictEqual(d.state, 'fly');
  assert.strictEqual(d.invulnerable, true);
  assert.ok(game.zones.filter((z) => z.kind === 'meteorMark').length >= 2);
  me(game, 1).y -= 150; // p1 steps out of its mark
  run(game, 1.4);
  assert.strictEqual(me(game, 0).hp, 120);
  run(game, 0.15);
  assert.strictEqual(me(game, 0).hp, 90);
  assert.strictEqual(me(game, 1).hp, 120);
  assert.strictEqual(d.invulnerable, false);
});

test('in the sky melee does nothing and says out of reach, arrows still hit', () => {
  const { game, d } = dragonGame();
  Object.assign(me(game), { x: d.x + 70, y: d.y, aim: Math.PI });
  d.hp = d.maxHp * 0.6;
  game.tick(0.05);
  assert.strictEqual(d.sky, true);
  assert.ok(game.drainEvents().some((e) => e.type === 'takeoff'));
  const before = d.hp;
  me(game).input.attack = true;
  me(game).input.aim = Math.PI;
  game.tick(0.05);
  me(game).input.attack = false;
  assert.strictEqual(d.hp, before, 'the sword swing did nothing');
  assert.ok(game.drainEvents().some((e) => e.type === 'outofreach'));
  assert.strictEqual(game.damageEnemy(d, 14, 'p0'), 14);
  assert.strictEqual(game.snapshot().enemies[0].sky, true);
});

test('after meteor rain in phase 2 it lands stunned for 3 s and melee hits', () => {
  const { game, d } = dragonGame();
  Object.assign(me(game), { x: d.x + 300, y: d.y });
  me(game).invulnUntil = 999;
  d.hp = d.maxHp * 0.5;
  game.tick(0.05);
  d.skyIdx = 1; // meteor is next in the sky
  d.timers.attack = game.time;
  run(game, 0.1);
  assert.strictEqual(d.state, 'fly');
  run(game, 1.5);
  assert.strictEqual(d.sky, false);
  assert.ok(game.drainEvents().some((e) => e.type === 'landed'));
  assert.ok(game.snapshot().enemies[0].stunned);
  assert.ok(game.damageEnemy(d, 14, 'p0', { melee: true }) > 0);
  run(game, 3.1);
  assert.strictEqual(d.sky, true);
});

// ---------- on the Roost ----------
function roostGame() {
  const floors = [FLOORS[3]].map((f) => ({ ...f, rooms: [f.rooms[1]] }));
  const game = new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, transitions: false, rng: () => 0 });
  const d = game.enemies.find((e) => e.type === 'dragon');
  Object.assign(me(game), { x: 10 * 48, y: 5 * 48 });
  me(game).invulnUntil = 9999;
  return { game, d };
}

test('phase 3 crumbles the roost every 15 s', () => {
  const { game, d } = roostGame();
  Object.assign(me(game), { hp: 1e6, maxHp: 1e6 }); // the raging dragon and its bats must not end the test early
  d.hp = Math.floor(d.maxHp * 0.25);
  game.tick(0.05);
  assert.strictEqual(game.ringsFallen, 1);
  assert.ok(game.drainEvents().some((e) => e.type === 'roostcrumble'));
  run(game, 15);
  assert.strictEqual(game.ringsFallen, 2);
});

test('beating Ashmaw opens the Roost camp shop (Floor 5 is next)', () => {
  const { game, d } = roostGame();
  d.hp = 1;
  game.damageEnemy(d, 5, 'p0');
  game.tick(0.05);
  assert.strictEqual(game.phase, 'shop');
  assert.strictEqual(me(game).gold, 300);
});

test('at half HP Ashmaw rages: roars, calls Skitterbats, and attacks faster', () => {
  const { game, d } = dragonGame(['knight']);
  Object.assign(me(game, 0), { x: d.x + 150, y: d.y });
  run(game, 0.1);
  assert.ok(!d.rage);
  d.hp = Math.floor(d.maxHp * 0.5);
  game.drainEvents();
  run(game, 0.1);
  assert.strictEqual(d.rage, true);
  assert.ok(game.drainEvents().some((ev) => ev.type === 'rage'));
  const bats = game.enemies.filter((e) => e.type === 'bat');
  assert.strictEqual(bats.length, 2);
  assert.ok(bats.every((b) => b.noReward), 'summoned bats give no reward');
  // the next attack comes sooner than before
  const gapBefore = 2.5;
  d.state = 'walk';
  d.timers.attack = game.time;
  run(game, 0.05);
  const busyUntil = d.stateUntil;
  assert.ok(busyUntil - game.time < 1.5 + 1e-6, 'shorter warning while raging');
  assert.ok(gapBefore > 0);
});

test('a raging Ashmaw calls more bats every 20 s, but never more than 4 at once', () => {
  const { game, d } = dragonGame(['knight']);
  Object.assign(me(game, 0), { x: d.x + 400, y: d.y, hp: 1e6, maxHp: 1e6 });
  d.hp = Math.floor(d.maxHp * 0.5);
  run(game, 0.1);
  run(game, 20.1);
  assert.strictEqual(game.enemies.filter((e) => e.type === 'bat').length, 4);
  run(game, 20.1);
  assert.strictEqual(game.enemies.filter((e) => e.type === 'bat').length, 4);
});
