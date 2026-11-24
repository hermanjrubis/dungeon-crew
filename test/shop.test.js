const test = require('node:test');
const assert = require('node:assert');
const { makeGame } = require('./helpers');
const shop = require('../server/shop');

const ONE_ROOM = [['wwwwww', 'wefffw', 'wwwwww']];

// A game that has already reached the shop, everyone with `gold`.
function inShop(classes, gold) {
  const game = makeGame(classes, ONE_ROOM);
  game.tick(0.05); // empty room: clears at once and opens the shop
  for (const p of game.players.values()) p.gold = gold;
  return game;
}
const me = (game, i = 0) => game.players.get('p' + i);

test('the shop opens after the last room', () => {
  const game = inShop(['knight'], 0);
  assert.strictEqual(game.phase, 'shop');
});

test('buying deducts gold and applies stats', () => {
  const game = inShop(['knight'], 150);
  assert.deepStrictEqual(shop.buy(game, 'p0', 'mail'), { ok: true });
  assert.strictEqual(me(game).gold, 90);
  assert.strictEqual(me(game).defense, 3);
  shop.buy(game, 'p0', 'helm');
  assert.strictEqual(me(game).maxHp, 130);
  assert.strictEqual(me(game).hp, 130);
  shop.buy(game, 'p0', 'boots');
  assert.ok(Math.abs(me(game).speedMul - 0.1) < 1e-9);
  assert.deepStrictEqual(me(game).owned.sort(), ['boots', 'helm', 'mail']);
});

test('cannot buy without enough gold', () => {
  const game = inShop(['knight'], 30);
  assert.deepStrictEqual(shop.buy(game, 'p0', 'helm'), { ok: false, error: 'Not enough gold' });
  assert.strictEqual(me(game).gold, 30);
});

test('armor and weapon can be bought once; potions many times', () => {
  const game = inShop(['knight'], 500);
  shop.buy(game, 'p0', 'helm');
  assert.deepStrictEqual(shop.buy(game, 'p0', 'helm'), { ok: false, error: 'Already owned' });
  shop.buy(game, 'p0', 'potion');
  shop.buy(game, 'p0', 'potion');
  assert.strictEqual(me(game).potions, 3);
  shop.buy(game, 'p0', 'feather');
  assert.strictEqual(me(game).feathers, 1);
});

test("weapon is the buyer's class weapon", () => {
  const game = inShop(['archer'], 100);
  shop.buy(game, 'p0', 'weapon');
  assert.strictEqual(me(game).weaponName, "Hunter's Bow");
  assert.strictEqual(me(game).weaponBonus, 8);
  assert.strictEqual(game.playerDamage(me(game)), 15);
});

test('unknown items and buying outside the shop are refused', () => {
  const game = inShop(['knight'], 100);
  assert.strictEqual(shop.buy(game, 'p0', 'dragon').ok, false);
  assert.strictEqual(shop.buy(game, 'nobody', 'helm').ok, false);
  const playing = makeGame(['knight'], [['wwwww', 'wegfw', 'wwwww']]);
  playing.players.get('p0').gold = 100;
  assert.deepStrictEqual(shop.buy(playing, 'p0', 'helm'), { ok: false, error: 'Shop is closed' });
});

test('all connected players ready -> done; a disconnected player does not block it', () => {
  const game = inShop(['knight', 'mage', 'archer'], 0);
  shop.setShopReady(game, 'p0', true);
  shop.setShopReady(game, 'p1', true);
  assert.strictEqual(game.phase, 'shop');
  game.removePlayer('p2');
  shop.checkDone(game);
  assert.strictEqual(game.phase, 'done');
});

test('shop state lists items with the class weapon name and each player', () => {
  const game = inShop(['mage', 'knight'], 70);
  const s = shop.shopState(game);
  assert.strictEqual(s.items.length, 6);
  assert.strictEqual(s.players.length, 2);
  assert.strictEqual(s.players[0].gold, 70);
  assert.deepStrictEqual(s.weapons, { knight: 'Iron Sword', archer: "Hunter's Bow", mage: 'Oak Staff', warden: 'Iron Sling', engineer: 'Steel Wrench', cleric: 'Silver Rod' });
});

test('a player leaving the shop lets the others finish', () => {
  const game = inShop(['knight', 'mage'], 0);
  game.setShopReady('p0', true);
  game.removePlayer('p1');
  assert.strictEqual(game.phase, 'done');
});
