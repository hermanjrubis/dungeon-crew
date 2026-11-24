const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const shop = require('../server/shop');
const { run } = require('./helpers');

const LAST = ['wwwwwwwwww', 'wffffffffw', 'wefffffffw', 'wffffffffw', 'wwwwwwwwww'];
const GUARDED = ['wwwwwwwwwwwwwwwwwwww', 'wfffffffffffffffffgw', 'wefffffffffffffffffw', 'wffffffffffffffffffw', 'wwwwwwwwwwwwwwwwwwww'];
function shopGame(n = 2) {
  const players = ['knight', 'mage', 'archer'].slice(0, n).map((heroClass, i) => ({ id: 'p' + i, name: 'P' + i, heroClass, color: 'orange' }));
  const floors = [
    { name: 'One', roomNames: [], shop: 'cellar', rooms: [{ layout: LAST }] },
    { name: 'Two', roomNames: [], shop: 'forge', rooms: [{ layout: GUARDED }] } // a monster keeps it going
  ];
  const game = new Game(players, { floors, transitions: false, rng: () => 0 });
  game.tick(0.05); // the empty room clears: off to the shop
  return game;
}

test('the shop gives 45 seconds', () => {
  const game = shopGame();
  assert.strictEqual(game.phase, 'shop');
  assert.strictEqual(shop.shopState(game).timeLeft, 45);
  run(game, 10);
  assert.ok(Math.abs(shop.shopState(game).timeLeft - 35) < 0.11);
});

test('when time runs out the next floor starts even if nobody is ready', () => {
  const game = shopGame();
  run(game, 44.9);
  assert.strictEqual(game.phase, 'shop');
  run(game, 0.2);
  assert.strictEqual(game.phase, 'playing');
  assert.strictEqual(game.floorIndex, 1);
  assert.ok(game.drainEvents().some((e) => e.type === 'phase' && e.phase === 'playing'));
});

test('everyone ready still starts right away', () => {
  const game = shopGame();
  game.setShopReady('p0', true);
  game.setShopReady('p1', true);
  assert.strictEqual(game.phase, 'playing');
  assert.strictEqual(game.floorIndex, 1);
});

test("a player leaving doesn't stop the timer", () => {
  const game = shopGame();
  game.setShopReady('p0', true);
  game.removePlayer('p1');
  // p0 was the only one left and ready: the next floor starts
  assert.strictEqual(game.phase, 'playing');
  const g2 = shopGame(3);
  g2.removePlayer('p2');
  run(g2, 45.1);
  assert.strictEqual(g2.phase, 'playing');
});

test("the timer doesn't run while playing", () => {
  const game = shopGame();
  run(game, 45.1);
  assert.strictEqual(game.phase, 'playing');
  assert.strictEqual(shop.shopState(game).timeLeft, 0);
});

test('purchases are kept when the timer ends', () => {
  const game = shopGame();
  const me = game.players.get('p0');
  me.gold = 100;
  assert.strictEqual(game.buy('p0', 'helm').ok, true);
  run(game, 45.1);
  assert.ok(me.owned.includes('helm'));
  assert.strictEqual(game.phase, 'playing');
});
