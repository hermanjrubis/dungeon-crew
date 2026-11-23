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
