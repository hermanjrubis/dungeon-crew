const test = require('node:test');
const assert = require('node:assert');
const { makeGame, run, center } = require('./helpers');
const { spikeState } = require('../server/hazards');
const tiles = require('../shared/tiles');

// Row 2: spikes at x=3, cracked at x=5, pit at x=7, puddle at x=4 on row 1.
const HAZARD_ROOMS = [
  ['wwwwwwwwww', 'wfffuffffw', 'wefsfxfpfw', 'wffffffffw', 'wwwwwwwwww'],
  ['wwwwwwwwww', 'wefffffffw', 'wwwwwwwwww']
];
const me = (game) => game.players.get('p0');

// Wait until the spikes are in a given state (spikes cycle every 3 s).
function waitFor(game, state) {
  for (let i = 0; i < 200 && spikeState(game.time) !== state; i++) game.tick(0.05);
}

test('spike cycle timing', () => {
  assert.strictEqual(spikeState(1.0), 'down');
  assert.strictEqual(spikeState(1.7), 'rattle');
  assert.strictEqual(spikeState(2.5), 'up');
  assert.strictEqual(spikeState(3.2), 'down');
});

test('spikes hit a player once per up phase', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(3, 2));
  waitFor(game, 'up');
  run(game, 0.9);
  assert.strictEqual(me(game).hp, 110);
  waitFor(game, 'down');
  waitFor(game, 'up');
  game.tick(0.05);
  assert.strictEqual(me(game).hp, 100);
});

test('spikes do not hurt while down or rattling', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(3, 2));
  run(game, 1.9);
  assert.strictEqual(me(game).hp, 120);
});

test('cracked tile breaks 1 s after being stepped on', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  const tile = tiles.tileIndex(game.room, center(5, 2).x, center(5, 2).y);
  Object.assign(me(game), center(5, 2));
  game.tick(0.05);
  Object.assign(me(game), center(5, 1));
  assert.ok(game.cracking.has(tile));
  run(game, 0.9);
  assert.ok(!game.broken.has(tile));
  run(game, 0.15);
  assert.ok(game.broken.has(tile));
});

test('falling in a pit sends the player to entry with -15 HP', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(7, 2));
  game.tick(0.05);
  assert.deepStrictEqual({ x: me(game).x, y: me(game).y }, game.room.entry);
  assert.strictEqual(me(game).hp, 105);
});

test('standing on a broken tile is the same as a pit', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(5, 2));
  run(game, 1.1);
  assert.strictEqual(me(game).hp, 105);
});

test('gloop pushed into a pit dies and gives no gold', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(1, 3));
  const g = game.spawnEnemy('gloop', center(7, 2).x, center(7, 2).y);
  game.tick(0.05);
  assert.ok(!game.enemies.includes(g));
  assert.strictEqual(game.enemies.length, 0);
  assert.strictEqual(me(game).gold, 0);
});

test('bats are not hurt by spikes or pits', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(1, 3));
  const bat = game.spawnEnemy('bat', center(7, 2).x, center(7, 2).y);
  bat.timers.swoop = 999;
  bat.timers.screech = 999;
  game.tick(0.05);
  assert.ok(game.enemies.includes(bat));
});

test('spikes hurt walking monsters too', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(1, 3));
  const g = game.spawnEnemy('mother', center(3, 2).x, center(3, 2).y);
  g.stunUntil = 999;
  waitFor(game, 'up');
  game.tick(0.05);
  assert.strictEqual(g.hp, 240);
});

test('puddle slows walking to 60%', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(4, 1));
  game.tick(0.05);
  assert.ok(Math.abs(game.slowFactor(me(game)) - 0.6) < 1e-9);
  const x0 = me(game).x;
  game.setInput('p0', { right: true });
  game.tick(0.05);
  assert.ok(Math.abs(me(game).x - x0 - 150 * 0.6 * 0.05) < 0.01, String(me(game).x - x0));
});

test('room reset restores broken tiles', () => {
  const game = makeGame(['knight'], HAZARD_ROOMS);
  Object.assign(me(game), center(5, 2));
  game.tick(0.05);
  Object.assign(me(game), center(1, 3));
  run(game, 1.1);
  assert.strictEqual(game.broken.size, 1);
  game.damagePlayer(me(game), 999);
  game.tick(0.05);
  assert.strictEqual(game.broken.size, 0);
});
