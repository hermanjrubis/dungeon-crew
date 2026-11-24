const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const { run, center } = require('./helpers');

const OPEN = ['wwwwwwwwww', 'wffffffffw', 'wefffffffd', 'wffffffffw', 'wwwwwwwwww'];
const LAST = ['wwwwwwwwww', 'wffffffffw', 'wefffffffw', 'wffffffffw', 'wwwwwwwwww'];

function game2(opts = {}) {
  const players = [
    { id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' },
    { id: 'p1', name: 'Mira', heroClass: 'mage', color: 'teal' }
  ];
  const floors = opts.floors || [
    { name: 'One', roomNames: [], shop: 'cellar', targetTime: 240, rooms: [{ layout: OPEN }, { layout: LAST }] },
    { name: 'Two', roomNames: [], shop: 'forge', targetTime: 300, rooms: [{ layout: OPEN }, { layout: LAST }] }
  ];
  return new Game(players, { floors, transitions: opts.transitions || false, rng: () => 0 });
}
const p = (game, i) => game.players.get('p' + i);

test('kills, damage and gold earned are counted for the player who landed the hit', () => {
  const game = game2();
  const g = game.spawnEnemy('gloop', 200, 100);
  game.damageEnemy(g, 10, 'p1');
  game.damageEnemy(g, 100, 'p0');
  assert.strictEqual(p(game, 0).stats.kills, 1);
  assert.strictEqual(p(game, 1).stats.kills, 0);
  assert.strictEqual(p(game, 0).stats.damage, 100);
  assert.strictEqual(p(game, 1).stats.damage, 10);
  assert.strictEqual(p(game, 0).stats.gold, p(game, 0).gold);
  assert.ok(p(game, 0).stats.gold > 0);
});

test('downs and revives are counted, feathers and holding E both credit the reviver', () => {
  const game = game2();
  game.spawnEnemy('gloop', 400, 200).timers.bounce = 999; // keep the room going
  Object.assign(p(game, 1), center(3, 2));
  Object.assign(p(game, 0), center(4, 2));
  game.damagePlayer(p(game, 1), 999, 'test');
  assert.strictEqual(p(game, 1).stats.downs, 1);
  p(game, 0).input.interact = true;
  run(game, 3.1);
  assert.strictEqual(p(game, 1).downed, false);
  assert.strictEqual(p(game, 0).stats.revives, 1);
  p(game, 0).input.interact = false;
  game.damagePlayer(p(game, 1), 999, 'test');
  p(game, 0).feathers = 1;
  game.setInput('p0', { use2: true }); // a fresh press, the way the browser sends it
  game.tick(0.05);
  assert.strictEqual(p(game, 0).stats.revives, 2);
  assert.strictEqual(p(game, 1).stats.downs, 2);
});

test('stats reset each floor, run totals keep adding up', () => {
  const game = game2();
  const g = game.spawnEnemy('gloop', 200, 100);
  game.damageEnemy(g, 100, 'p0');
  game.startFloor(1);
  assert.strictEqual(p(game, 0).stats.kills, 0);
  assert.strictEqual(p(game, 0).runStats.kills, 1);
  const g2 = game.spawnEnemy('gloop', 200, 100);
  game.damageEnemy(g2, 100, 'p0');
  assert.strictEqual(p(game, 0).runStats.kills, 2);
  assert.strictEqual(game.runResults().players[0].kills, 2);
});

test('three stars for a fast floor with nobody downed', () => {
  const game = game2();
  game.time = 100;
  const r = game.floorResults();
  assert.strictEqual(r.stars, 3);
  assert.deepStrictEqual(r.starReasons, { cleared: true, noDowns: true, fast: true });
  assert.strictEqual(r.targetTime, 240);
});

test('one star when someone was downed and the floor was slow', () => {
  const game = game2();
  game.damagePlayer(p(game, 1), 999, 'test');
  game.time = 500;
  const r = game.floorResults();
  assert.strictEqual(r.stars, 1);
  assert.deepStrictEqual(r.starReasons, { cleared: true, noDowns: false, fast: false });
});

test('MVP goes to the most damage, Lifesaver only appears if someone revived, Untouchable for everyone never downed', () => {
  const game = game2();
  const g = game.spawnEnemy('golem', 200, 100);
  game.damageEnemy(g, 30, 'p1');
  game.damageEnemy(g, 10, 'p0');
  let r = game.floorResults();
  assert.deepStrictEqual(r.players.map((q) => q.badges), [['untouchable'], ['mvp', 'untouchable']]);
  game.damagePlayer(p(game, 1), 999, 'test');
  game.revive(p(game, 1), 0.3, 'p0');
  r = game.floorResults();
  assert.deepStrictEqual(r.players.map((q) => q.badges), [['lifesaver', 'untouchable'], ['mvp']]);
});

test('clearing the last room sends the results with the card', () => {
  const floors = [{ name: 'One', roomNames: [], shop: 'cellar', targetTime: 240, rooms: [{ layout: LAST }] }];
  const game = game2({ floors, transitions: true });
  for (let i = 0; i < 60; i++) game.tick(0.05);
  const ev = game.drainEvents().find((e) => e.type === 'floorresults');
  assert.ok(ev);
  assert.strictEqual(ev.results.stars, 3);
  assert.strictEqual(ev.results.players.length, 2);
  assert.strictEqual(game.transition.kind, 'floorclear');
  assert.ok(game.transition.until - game.time > 6);
});
