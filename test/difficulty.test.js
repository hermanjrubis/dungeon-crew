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

test('bosses get extra HP and damage on top of the floor, more on every floor', () => {
  let prev = { hp: 1, dmg: 1 };
  for (const f of FLOORS) {
    assert.ok(f.bossPower, f.name + ' has bossPower');
    assert.ok(f.bossPower.hp > prev.hp && f.bossPower.dmg > prev.dmg, f.name);
    prev = f.bossPower;
  }
  assert.deepStrictEqual(FLOORS[0].bossPower, { hp: 1.2, dmg: 1.15 });
  assert.deepStrictEqual(FLOORS[5].bossPower, { hp: 1.7, dmg: 1.5 });
});

test('a boss on Floor 4 has floor power times boss power; normal monsters do not', () => {
  const game = new Game(players, { rng: () => 0, transitions: false, seed: 1 });
  game.startFloor(3);
  const f = FLOORS[3];
  const boss = game.spawnEnemy('dragon', 100, 100);
  assert.strictEqual(boss.maxHp, Math.round(MONSTERS.dragon.hp * f.power.hp * f.bossPower.hp));
  assert.strictEqual(boss.dmg, Math.round(MONSTERS.dragon.dmg * f.power.dmg * f.bossPower.dmg));
  const golem = game.spawnEnemy('golem', 100, 100);
  assert.strictEqual(golem.maxHp, Math.round(MONSTERS.golem.hp * f.power.hp));
  assert.strictEqual(game.bossDamage(30), Math.round(30 * f.power.dmg * f.bossPower.dmg));
});

test('floors 1-2 keep their monster count; floor 3 and up bring more and more', () => {
  assert.ok(!(FLOORS[0].crowd > 1) && !(FLOORS[1].crowd > 1));
  let prev = 1;
  for (const f of FLOORS.slice(2)) { assert.ok(f.crowd > prev, f.name); prev = f.crowd; }
  assert.deepStrictEqual(FLOORS.slice(2).map((f) => f.crowd), [1.35, 1.5, 1.65, 1.8]);
});

test('a crowded room adds copies of its normal monsters on open floor near them', () => {
  const tiles = require('../shared/tiles');
  for (const fi of [2, 4]) {
    const game = new Game(players, { rng: () => 0, transitions: false, seed: 1 });
    game.startFloor(fi);
    const normal = game.room.spawns.filter((s) => !MONSTERS[s.type].boss);
    const live = game.enemies.filter((e) => !e.boss && !e.summonedBy);
    assert.strictEqual(live.length, normal.length + Math.round(normal.length * (FLOORS[fi].crowd - 1)), FLOORS[fi].name);
    for (const e of live) assert.ok(!tiles.hits(game.room, e.x, e.y, e.r * 0.5, { flying: e.flying }), `${e.type} stuck in a wall`);
  }
});
