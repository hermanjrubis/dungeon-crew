const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const shop = require('../server/shop');
const { FLOORS } = require('../shared/rooms');
const { buildRoom } = require('../server/layout');
const { makeRng } = require('../server/rng');

// ---------- Floor 3: the Molten Forge ----------

test('Floor 3 is the Molten Forge with 4 rooms and the crown shop', () => {
  const f3 = FLOORS[2];
  assert.strictEqual(f3.name, 'Molten Forge');
  assert.deepStrictEqual(f3.roomNames, ['Ember Gate', 'Lava Run', 'Furnace Hall', "Hollow King's Hall"]);
  assert.strictEqual(f3.shop, 'crown');
  assert.ok(f3.rooms[3].layout.some((r) => r.includes('K')));
  assert.ok(f3.rooms[1].recipe.river);
});

test('Floor 3 recipes build valid rooms for 200 seeds', () => {
  for (const room of FLOORS[2].rooms.filter((r) => r.recipe)) {
    const { recipe } = room;
    for (let seed = 1; seed <= 200; seed++) {
      const built = buildRoom(recipe, makeRng(seed));
      assert.strictEqual(built.fallback, false, 'seed ' + seed);
      const all = built.rows.join('');
      assert.ok(all.includes('v'), 'has vents');
      if (recipe.jets) {
        const edges = built.rows[0] + built.rows[built.rows.length - 1];
        assert.strictEqual([...edges].filter((c) => c === 'j').length, recipe.jets);
        assert.strictEqual([...built.rows.slice(1, -1).join('')].filter((c) => c === 'j').length, 0);
      }
      if (recipe.river) assert.ok(built.bridge);
    }
  }
});

// ---------- the Hollow Crown shop and its set bonus ----------

const TINY = ['wwwww', 'wefww', 'wwwww'];
function crownGame(classes) {
  const players = classes.map((heroClass, i) => ({ id: 'p' + i, name: 'P' + i, heroClass, color: 'orange' }));
  const floors = [{ name: 'Forge', roomNames: [], shop: 'crown', rooms: [{ layout: TINY }] }];
  const game = new Game(players, { floors, transitions: false, rng: () => 0 });
  game.tick(0.05);
  return game;
}

test('the crown shop sells the Hollow Crown set and tier-3 weapons', () => {
  const game = crownGame(['knight']);
  assert.strictEqual(game.phase, 'shop');
  const state = shop.shopState(game);
  assert.deepStrictEqual(state.items.map((i) => i.id), ['helm3', 'plate3', 'boots3', 'weapon3', 'potion', 'feather']);
  assert.strictEqual(state.setName, 'Hollow Crown Set');
  const me = game.players.get('p0');
  me.gold = 1000;
  shop.buy(game, 'p0', 'weapon3');
  assert.strictEqual(me.weaponBonus, 22);
  assert.strictEqual(me.weaponName, 'Ember Blade');
  shop.buy(game, 'p0', 'helm3');
  shop.buy(game, 'p0', 'plate3');
  shop.buy(game, 'p0', 'boots3');
  assert.strictEqual(me.maxHp, 150);
  assert.strictEqual(me.defense, 9);
  assert.ok(Math.abs(me.speedMul - 0.2) < 1e-9);
});

test('the full crown set gives the whole team +10% damage while the wearer is alive', () => {
  const game = crownGame(['knight', 'mage']);
  const knight = game.players.get('p0');
  const mage = game.players.get('p1');
  assert.strictEqual(game.playerDamage(mage), 18);
  knight.owned.push('helm3', 'plate3', 'boots3');
  assert.strictEqual(game.playerDamage(mage), 20);
  knight.downed = true;
  assert.strictEqual(game.playerDamage(mage), 18);
});

test("a second wearer doesn't stack it", () => {
  const game = crownGame(['knight', 'mage']);
  for (const p of game.players.values()) p.owned.push('helm3', 'plate3', 'boots3');
  assert.strictEqual(game.playerDamage(game.players.get('p1')), 20);
});

// ---------- Floor 4: the Dragon's Roost ----------

test('Floor 4 is two rooms ending in the Roost, with no shop', () => {
  const f4 = FLOORS[3];
  assert.strictEqual(f4.name, "Dragon's Roost");
  assert.deepStrictEqual(f4.roomNames, ['Ashen Stair', "Dragon's Roost"]);
  assert.strictEqual(f4.shop, null);
  const roost = f4.rooms[1];
  assert.ok(roost.layout.some((r) => r.includes('D')));
  assert.deepStrictEqual(roost.core, [8, 4, 15, 8]);
  assert.ok(!roost.layout.some((r) => r.includes('d')), 'no exit door');
});

test('Ashen Stair builds valid rooms for 200 seeds', () => {
  const { recipe } = FLOORS[3].rooms[0];
  for (let seed = 1; seed <= 200; seed++) {
    const built = buildRoom(recipe, makeRng(seed));
    assert.strictEqual(built.fallback, false, 'seed ' + seed);
  }
});

test('clearing the last floor ends the run without a shop', () => {
  const floors = [{ name: 'End', roomNames: [], shop: null, rooms: [{ layout: TINY }] }];
  const game = new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, rng: () => 0 });
  for (let i = 0; i < 120; i++) game.tick(0.05);
  assert.strictEqual(game.phase, 'done');
  assert.ok(game.drainEvents().some((e) => e.type === 'phase' && e.phase === 'done'));
});
