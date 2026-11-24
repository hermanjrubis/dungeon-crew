const test = require('node:test');
const assert = require('node:assert');
const { HEROES, CLASSES, SHOPS, SHOP_WEAPONS } = require('../shared/data');
const { makeGame, run, ARENA, center } = require('./helpers');

const me = (game, i = 0) => game.players.get('p' + i);
const press = (game, id, keys) => game.setInput(id, { aim: 0, ...keys });
function tap(game, id, keys) { press(game, id, keys); game.tick(0.05); press(game, id, {}); }

test('the Mage\'s Space is now Meteor Shower: fireballs fall where you aim', () => {
  assert.strictEqual(HEROES.mage.space.name, 'Meteor Shower');
  const game = makeGame(['mage'], ARENA);
  game.enemies = [];
  Object.assign(me(game), center(4, 6));
  const g = game.spawnEnemy('golem', center(9, 6).x, center(9, 6).y);
  g.hp = g.maxHp = 1000;
  tap(game, 'p0', { space: true, dist: 240 });
  const zone = game.zones.find((z) => z.kind === 'meteorShower');
  assert.ok(zone);
  assert.ok(Math.abs(zone.x - (me(game).x + 240)) < 2, 'lands at the cursor');
  run(game, 2.5);
  assert.ok(g.hp < 1000);
  assert.ok(game.drainEvents().filter((e) => e.type === 'meteorhit').length >= 4);
});

test('skills land at the cursor, but never farther than their reach', () => {
  const game = makeGame(['archer'], ARENA);
  game.enemies = [];
  Object.assign(me(game), center(4, 6));
  tap(game, 'p0', { q: true, dist: 90 });
  const rain = game.zones.find((z) => z.kind === 'arrowRain');
  assert.ok(Math.abs(rain.x - (me(game).x + 90)) < 2);
  const g2 = makeGame(['archer'], ARENA);
  g2.enemies = [];
  Object.assign(me(g2), center(4, 6));
  tap(g2, 'p0', { q: true, dist: 5000 });
  const far = g2.zones.find((z) => z.kind === 'arrowRain');
  assert.ok(far.x - me(g2).x <= HEROES.archer.q.reach + 1);
});

test('the Cleric is a 6th hero with a full kit, sold in every shop', () => {
  assert.ok(CLASSES.includes('cleric'));
  const c = HEROES.cleric;
  assert.strictEqual(c.q.name, 'Mending Light');
  assert.strictEqual(c.space.name, 'Moonlight Blessing');
  assert.ok(SHOP_WEAPONS.cleric);
  for (const s of Object.values(SHOPS)) assert.ok(s.weapons.cleric);
});

test('Mending Light heals every ally nearby, the Cleric included', () => {
  const game = makeGame(['cleric', 'knight', 'archer'], ARENA);
  game.enemies = [];
  Object.assign(me(game, 0), center(6, 6), { hp: 40 });
  Object.assign(me(game, 1), center(7, 6), { hp: 40 });
  Object.assign(me(game, 2), center(20, 6), { hp: 40 });
  tap(game, 'p0', { q: true });
  assert.ok(me(game, 0).hp > 40);
  assert.ok(me(game, 1).hp > 40);
  assert.strictEqual(me(game, 2).hp, 40, 'too far away');
});

test('Moonlight Blessing links to every ally in range and heals them for 6 s', () => {
  const game = makeGame(['cleric', 'knight', 'archer', 'mage'], ARENA);
  game.enemies = [];
  Object.assign(me(game, 0), center(10, 6));
  Object.assign(me(game, 1), center(4, 3), { hp: 20 });
  Object.assign(me(game, 2), center(16, 9), { hp: 20 });
  Object.assign(me(game, 3), center(10, 6), { hp: 1, downed: true });
  tap(game, 'p0', { space: true });
  const z = game.zones.find((q) => q.kind === 'blessing');
  assert.ok(z);
  run(game, 1);
  assert.ok(me(game, 1).hp > 20 && me(game, 2).hp > 20);
  const after1 = me(game, 1).hp;
  run(game, 3);
  assert.ok(me(game, 1).hp > after1, 'keeps healing');
  assert.ok(me(game, 3).downed, 'it does not revive the downed');
  run(game, 3);
  assert.ok(!game.zones.some((q) => q.kind === 'blessing'), 'over after 6 s');
});

test('the Cleric revives teammates twice as fast', () => {
  const game = makeGame(['cleric', 'knight'], ARENA);
  game.enemies = [];
  Object.assign(me(game, 0), center(6, 6));
  Object.assign(me(game, 1), center(7, 6), { hp: 0, downed: true, reviveProgress: 0 });
  press(game, 'p0', { interact: true });
  run(game, 1.6);
  assert.ok(!me(game, 1).downed, 'revived in about half the time');
});
