const test = require('node:test');
const assert = require('node:assert');
const icons = require('../shared/icons');
const { SHOPS, CLASSES } = require('../shared/data');

test('every shop item and every class weapon has an icon', () => {
  for (const shop of Object.values(SHOPS)) {
    for (const item of shop.items) {
      for (const cls of CLASSES) {
        const g = icons.iconGrid(item.id, cls);
        assert.strictEqual(g.length, 16);
        assert.ok(g.flat().filter(Boolean).length > 20, item.id);
      }
    }
  }
});

test('gear from later shops looks different (another metal)', () => {
  const a = icons.iconGrid('helm', 'knight').flat().join();
  const b = icons.iconGrid('helm3', 'knight').flat().join();
  assert.notStrictEqual(a, b);
});

test('the weapon icon matches the hero', () => {
  assert.strictEqual(icons.iconFor('weapon2', 'archer').rows, icons.SHAPES.bow);
  assert.strictEqual(icons.iconFor('weapon', 'cleric').rows, icons.SHAPES.rod);
});

test('loot on the floor has icons, including a heart', () => {
  assert.strictEqual(icons.iconFor('heart').rows, icons.SHAPES.heart);
  assert.strictEqual(icons.iconFor('coins').rows, icons.SHAPES.coin);
  for (const k of ['heart', 'coins', 'potion', 'feather']) assert.ok(icons.iconGrid(k).flat().filter(Boolean).length > 20, k);
});
