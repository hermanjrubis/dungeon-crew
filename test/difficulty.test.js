const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const { FLOORS } = require('../shared/rooms');
const { MONSTERS } = require('../shared/data');
const { makeGame, run, ARENA, center } = require('./helpers');

const players = [{ id: 'a', name: 'A', heroClass: 'archer', color: 'orange' }];

test('every floor makes monsters tougher and hit harder than the last', () => {
  let prev = { hp: 1, dmg: 1 };
  for (const f of FLOORS) {
    assert.ok(f.power, 'floor has a power setting');
    assert.ok(f.power.hp > prev.hp && f.power.dmg > prev.dmg, f.name);
    prev = f.power;
  }
  assert.deepStrictEqual(FLOORS[0].power, { hp: 1.5, dmg: 1.3 });
});

test('a monster on Floor 3 gets that floor\'s extra HP and damage', () => {
  const game = new Game(players, { rng: () => 0, transitions: false, seed: 1 });
  game.startFloor(2);
  const e = game.spawnEnemy('golem', 100, 100);
  assert.strictEqual(e.maxHp, Math.round(MONSTERS.golem.hp * FLOORS[2].power.hp));
  assert.strictEqual(e.dmg, Math.round(MONSTERS.golem.dmg * FLOORS[2].power.dmg));
  assert.strictEqual(game.monsterDamage(30), Math.round(30 * FLOORS[2].power.dmg));
});

test('a monster shot from far away gets angry: it goes for the shooter, faster', () => {
  const game = makeGame(['archer', 'knight'], ARENA);
  const shooter = game.players.get('p0');
  const close = game.players.get('p1');
  Object.assign(shooter, center(2, 6));
  Object.assign(close, center(14, 6));
  game.enemies = [];
  const e = game.spawnEnemy('gloop', center(16, 6).x, center(16, 6).y);
  game.damageEnemy(e, 1, 'p0');
  assert.ok(e.angryUntil > game.time, 'angry');
  const before = e.x;
  run(game, 0.5);
  assert.ok(e.x < before, 'walks toward the far shooter, not the close knight');
  const moved = before - e.x;
  assert.ok(moved > MONSTERS.gloop.speed * 0.5 * 1.25, 'faster than normal: ' + moved);
});

test('a monster hit up close does not get angry', () => {
  const game = makeGame(['knight'], ARENA);
  const p = game.players.get('p0');
  Object.assign(p, center(10, 6));
  game.enemies = [];
  const e = game.spawnEnemy('gloop', p.x + 40, p.y);
  game.damageEnemy(e, 1, 'p0');
  assert.ok(!(e.angryUntil > game.time));
});
