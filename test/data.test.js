const test = require('node:test');
const assert = require('node:assert');
const { HEROES } = require('../shared/data');

test('heroes match the character select', () => {
  const total = (h) => h.baseDmg + h.starter.bonus;
  assert.strictEqual(total(HEROES.knight), 14);
  assert.strictEqual(total(HEROES.archer), 10);
  assert.strictEqual(total(HEROES.mage), 18);
  assert.strictEqual(HEROES.knight.hp, 120);
  assert.strictEqual(HEROES.archer.hp, 80);
  assert.strictEqual(HEROES.mage.hp, 70);
});
