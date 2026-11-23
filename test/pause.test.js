const test = require('node:test');
const assert = require('node:assert');
const { ONE_GLOOP_ROOMS, EMPTY_ROOMS, makeGame, run } = require('./helpers');

const p = (game, i) => game.players.get('p' + i);

test('pausing freezes the whole game for everyone', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  game.setPaused('p0', true);
  const t = game.time;
  const x = p(game, 1).x;
  game.setInput('p1', { right: true });
  run(game, 1);
  assert.strictEqual(game.time, t);
  assert.strictEqual(p(game, 1).x, x);
});

test('the snapshot says who paused', () => {
  const game = makeGame(['knight', 'archer'], EMPTY_ROOMS);
  game.setPaused('p0', true);
  const s = game.snapshot();
  assert.strictEqual(s.paused, true);
  assert.strictEqual(s.pausedBy, 'P0');
});

test('anyone can resume, and the game runs again', () => {
  const game = makeGame(['knight', 'archer'], EMPTY_ROOMS);
  game.setPaused('p0', true);
  game.setPaused('p1', false);
  assert.strictEqual(game.snapshot().paused, false);
  const x = p(game, 0).x;
  game.setInput('p0', { right: true });
  game.tick(0.05);
  assert.ok(p(game, 0).x > x);
});

test('the game resumes by itself if the player who paused leaves', () => {
  const game = makeGame(['knight', 'archer'], EMPTY_ROOMS);
  game.setPaused('p1', true);
  game.removePlayer('p1');
  assert.strictEqual(game.paused, false);
});

test('pausing only works while playing, not in the shop', () => {
  const game = makeGame(['knight'], [['wwwww', 'wefww', 'wwwww']]);
  game.tick(0.05);
  assert.strictEqual(game.phase, 'shop');
  game.setPaused('p0', true);
  assert.strictEqual(game.paused, false);
});

test('strangers cannot pause', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  game.setPaused('nobody', true);
  assert.strictEqual(game.paused, false);
});
