const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const { FLOORS } = require('../shared/rooms');

const team = [{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }];
const newGame = (seed) => new Game(team, { seed, transitions: false });

test('two games with different seeds lay out room 1 differently; the same seed lays it out the same', () => {
  assert.notDeepStrictEqual(newGame(1).layouts[0].rows, newGame(2).layouts[0].rows);
  assert.deepStrictEqual(newGame(5).layouts[0].rows, newGame(5).layouts[0].rows);
});

test('the snapshot sends the rows the server is using', () => {
  const game = newGame(3);
  const snap = game.snapshot();
  assert.deepStrictEqual(snap.room.rows, game.layouts[game.roomIndex].rows);
  assert.strictEqual(snap.room.key, '0:0');
  assert.strictEqual(snap.floorName, 'Sunken Cellar');
  assert.strictEqual(snap.floorIndex, 0);
});

test('everyone falling keeps the same layout', () => {
  const game = newGame(4);
  const before = game.snapshot().room.rows;
  game.damagePlayer(game.players.get('p0'), 999);
  game.tick(0.05);
  assert.ok(game.drainEvents().some((e) => e.type === 'reset'));
  assert.deepStrictEqual(game.snapshot().room.rows, before);
});

test('boss room is always the hand-made lair', () => {
  for (const seed of [1, 2, 3]) {
    const game = newGame(seed);
    const last = FLOORS[0].rooms.length - 1;
    assert.deepStrictEqual(game.layouts[last].rows, FLOORS[0].rooms[last].layout);
  }
});

test('random rooms keep their monster count', () => {
  const game = newGame(9);
  const recipe = FLOORS[0].rooms[0].recipe;
  const wanted = Object.values(recipe.monsters).reduce((a, b) => a + b, 0);
  assert.strictEqual(game.enemies.length, wanted);
});
