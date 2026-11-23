const test = require('node:test');
const assert = require('node:assert');
const { makeGame, run, center } = require('./helpers');

// Rooms with doors so an empty room doesn't end the game.
const OPEN = ['wwwwwwwwww', 'wffffffffw', 'wefffffffd', 'wffffffffw', 'wwwwwwwwww'];
const me = (game) => game.players.get('p0');

// ---------- burning ----------

test('burning deals 3 per second for 3 seconds and ignores defense', () => {
  const game = makeGame(['knight'], [OPEN, OPEN]);
  me(game).defense = 9;
  game.burnPlayer(me(game));
  run(game, 4);
  assert.strictEqual(me(game).hp, 111);
});

test('burning again restarts the timer instead of stacking', () => {
  const game = makeGame(['knight'], [OPEN, OPEN]);
  game.burnPlayer(me(game));
  run(game, 2);
  game.burnPlayer(me(game));
  run(game, 4);
  assert.strictEqual(me(game).hp, 105);
});

test('the full Forgewalker set makes burning last 1 second', () => {
  const game = makeGame(['knight'], [OPEN, OPEN]);
  me(game).owned.push('helm2', 'plate2', 'boots2');
  game.burnPlayer(me(game));
  assert.strictEqual(game.snapshot().players[0].burning, true);
  run(game, 3);
  assert.strictEqual(me(game).hp, 117);
});

// ---------- lava blocks walking monsters ----------

test('walking monsters treat lava as a wall, bats fly over it', () => {
  const RIVER = [
    'wwwwwwwwwwwwww',
    'wffffflffffffw',
    'wefffflffffffd',
    'wffffflffffffw',
    'wwwwwwwwwwwwww'
  ];
  const game = makeGame(['knight'], [RIVER, OPEN]);
  Object.assign(me(game), center(11, 2));
  me(game).invulnUntil = 999; // keep the target standing
  const g = game.spawnEnemy('gloop', center(3, 1).x, center(3, 1).y);
  const b = game.spawnEnemy('bat', center(3, 3).x, center(3, 3).y);
  g.timers.bounce = 999;
  run(game, 3);
  assert.ok(g.x < 6 * 48, 'gloop stays on its side');
  assert.ok(b.x > 7 * 48, 'bat crossed');
});

// ---------- lava, geysers and flame jets ----------
const forge = require('../server/forge');

const LAVA = ['wwwwwwwwww', 'wffffffffw', 'wefflffffd', 'wffffffffw', 'wwwwwwwwww'];
const VENT = ['wwwwwwwwww', 'wffffffffw', 'wefffvfffd', 'wffffffffw', 'wwwwwwwwww'];
const JETS = [
  'wwwwwjwwww',
  'wffffffffw',
  'wffffffffw',
  'wffffffffw',
  'wefffffffd',
  'wffffffffw',
  'wffffffffw',
  'wffffffffw',
  'wwwwwwwwww'
];
const damages = (events, amount) => events.filter((e) => e.type === 'damage' && e.targetId === 'p0' && e.amount === amount).length;

test('stepping in lava costs 50 and sends you to the entrance', () => {
  const game = makeGame(['knight'], [LAVA, OPEN]);
  Object.assign(me(game), center(4, 2));
  game.tick(0.05);
  assert.strictEqual(me(game).hp, 70);
  assert.deepStrictEqual([me(game).x, me(game).y], [center(1, 2).x, center(1, 2).y]);
  assert.ok(game.drainEvents().some((e) => e.type === 'lavafall' && e.targetId === 'p0'));
});

test('rolling over lava still burns you', () => {
  const game = makeGame(['archer'], [LAVA, OPEN]);
  Object.assign(me(game), center(4, 2));
  me(game).invulnUntil = 999;
  game.tick(0.05);
  assert.strictEqual(me(game).hp, 30);
  assert.strictEqual(me(game).x, center(1, 2).x);
});

test('a monster knocked into lava dies without a reward', () => {
  const game = makeGame(['knight'], [LAVA, OPEN]);
  const g = game.spawnEnemy('gloop', center(4, 2).x, center(4, 2).y);
  game.tick(0.05);
  assert.ok(!game.enemies.includes(g));
  assert.strictEqual(me(game).gold, 0);
});

test('a geyser glows for 1.5 s, then erupts for 30 damage and burning', () => {
  const game = makeGame(['knight'], [VENT, OPEN]);
  Object.assign(me(game), center(5, 2));
  run(game, 1.4);
  assert.strictEqual(forge.ventState(game, 0), 'glow');
  assert.strictEqual(me(game).hp, 120);
  run(game, 0.2);
  assert.strictEqual(forge.ventState(game, 0), 'erupt');
  assert.ok(damages(game.drainEvents(), 30) === 1);
  assert.strictEqual(game.snapshot().players[0].burning, true);
  assert.deepStrictEqual(game.snapshot().vents[0], { x: center(5, 2).x, y: center(5, 2).y, state: 'erupt' });
});

test('the Forgewalker set cuts geyser damage to 21', () => {
  const game = makeGame(['knight'], [VENT, OPEN]);
  me(game).owned.push('helm2', 'plate2', 'boots2');
  Object.assign(me(game), center(5, 2));
  run(game, 1.6);
  assert.strictEqual(damages(game.drainEvents(), 21), 1);
});

test('a geyser hits each player once per eruption', () => {
  const game = makeGame(['knight'], [VENT, OPEN]);
  Object.assign(me(game), center(5, 2));
  run(game, 3.4);
  assert.strictEqual(damages(game.drainEvents(), 30), 1);
});

test('jets hiss for 0.5 s, then fire across the room for 15', () => {
  const game = makeGame(['knight', 'mage'], [JETS, OPEN]);
  Object.assign(me(game), center(5, 6));
  Object.assign(game.players.get('p1'), center(7, 6));
  run(game, 0.4);
  assert.strictEqual(forge.jetState(game, 0), 'hiss');
  assert.strictEqual(me(game).hp, 120);
  run(game, 0.3);
  assert.strictEqual(forge.jetState(game, 0), 'fire');
  assert.strictEqual(me(game).hp, 105);
  assert.strictEqual(game.players.get('p1').hp, 70);
  run(game, 0.7);
  assert.strictEqual(me(game).hp, 105, 'only once per firing');
  const jet = game.snapshot().jets[0];
  assert.deepStrictEqual([jet.dx, jet.dy, jet.len], [0, 1, 7]);
});

test('the two jet groups take turns', () => {
  const game = makeGame(['knight'], [JETS, OPEN]);
  run(game, 1.0);
  assert.strictEqual(forge.jetState(game, 0), 'fire');
  assert.strictEqual(forge.jetState(game, 1), 'idle');
  run(game, 1.5);
  assert.strictEqual(forge.jetState(game, 0), 'idle');
  assert.strictEqual(forge.jetState(game, 1), 'fire');
});

test('a pillar stops a jet beam', () => {
  const rows = JETS.slice();
  rows[4] = 'wefffwfffd';
  const game = makeGame(['knight'], [rows, OPEN]);
  Object.assign(me(game), center(5, 6));
  run(game, 3);
  assert.strictEqual(me(game).hp, 120);
  assert.strictEqual(game.snapshot().jets[0].len, 3);
});
