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

// ---------- moving from floor to floor ----------
const shop = require('../server/shop');
const TINY = ['wwwww', 'wefww', 'wwwww'];
const TWO_FLOORS = [
  { name: 'Alpha', roomNames: [], shop: 'cellar', rooms: [{ layout: TINY }] },
  { name: 'Beta', roomNames: [], shop: 'forge', rooms: [{ layout: TINY }] }
];
function twoFloorGame(classes = ['knight']) {
  const players = classes.map((heroClass, i) => ({ id: 'p' + i, name: 'P' + i, heroClass, color: 'orange' }));
  const game = new Game(players, { floors: TWO_FLOORS, transitions: false, rng: () => 0 });
  game.tick(0.05); // empty room: cleared at once, shop opens
  return game;
}

test('ready in the Floor 1 shop starts Floor 2 with level, gold and gear kept and full HP', () => {
  const game = twoFloorGame();
  const me = game.players.get('p0');
  assert.strictEqual(game.phase, 'shop');
  me.gold = 100;
  game.addXp(me, 60);
  shop.buy(game, 'p0', 'helm');
  me.hp = 10;
  assert.strictEqual(shop.shopState(game).nextFloorName, 'Beta');
  shop.setShopReady(game, 'p0', true);
  assert.strictEqual(game.phase, 'playing');
  assert.strictEqual(game.floorIndex, 1);
  assert.strictEqual(me.level, 2);
  assert.strictEqual(me.gold, 60);
  assert.ok(me.owned.includes('helm'));
  assert.strictEqual(me.hp, me.maxHp);
  assert.strictEqual(me.ready, false);
});

test('the Floor 2 shop sells the Forgewalker set and tier-2 weapons', () => {
  const game = twoFloorGame(['archer']);
  shop.setShopReady(game, 'p0', true);
  game.tick(0.05);
  assert.strictEqual(game.phase, 'shop');
  const state = shop.shopState(game);
  assert.deepStrictEqual(state.items.map((i) => i.id), ['helm2', 'plate2', 'boots2', 'weapon2', 'potion', 'feather']);
  assert.strictEqual(state.setName, 'Forgewalker Set');
  assert.strictEqual(state.nextFloorName, null);
  const me = game.players.get('p0');
  me.gold = 500;
  shop.buy(game, 'p0', 'weapon2');
  assert.strictEqual(me.weaponBonus, 14);
  assert.strictEqual(me.weaponName, 'Longbow');
  shop.buy(game, 'p0', 'helm2');
  assert.strictEqual(me.maxHp, 100);
});

test("after the last floor's shop the game is done", () => {
  const game = twoFloorGame();
  shop.setShopReady(game, 'p0', true);
  game.tick(0.05);
  shop.setShopReady(game, 'p0', true);
  assert.strictEqual(game.phase, 'done');
});

test('a player leaving during the Floor 1 shop lets the others go on to Floor 2', () => {
  const game = twoFloorGame(['knight', 'mage']);
  shop.setShopReady(game, 'p0', true);
  game.removePlayer('p1');
  assert.strictEqual(game.phase, 'playing');
  assert.strictEqual(game.floorIndex, 1);
});

test('level 8 needs 950 XP', () => {
  const game = twoFloorGame();
  const me = game.players.get('p0');
  game.addXp(me, 949);
  assert.strictEqual(me.level, 7);
  game.addXp(me, 1);
  assert.strictEqual(me.level, 8);
});
