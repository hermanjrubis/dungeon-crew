const test = require('node:test');
const assert = require('node:assert');
const sprites = require('../shared/sprites');
const { COLORS, CLASSES } = require('../shared/data');

test('every map is 16 rows of 16 chars and every letter has a palette color', () => {
  for (const [name, rows] of Object.entries(sprites.MAPS)) {
    assert.strictEqual(rows.length, 16, name);
    const pals = CLASSES.includes(name)
      ? Object.values(COLORS).map((hex) => sprites.heroPalette(name, hex))
      : [sprites.MONSTER_PALETTES[name]];
    for (const row of rows) {
      assert.strictEqual(row.length, 16, `${name}: ${row}`);
      for (const ch of row) {
        if (ch === '.') continue;
        for (const pal of pals) assert.ok(pal[ch], `${name} letter ${ch}`);
      }
    }
  }
});

test('every sprite file has a map, a palette and a size', () => {
  const files = sprites.spriteFiles();
  assert.strictEqual(files.length, 5 * 4 + 5 + 5 + 2 + 1); // the 5 first heroes x 4 colors, Floor 1, 2, 3 monsters and Ashmaw (old pictures)
  assert.ok(files.some((f) => f.file === 'knight-orange.png' && f.size === 48));
  assert.ok(files.some((f) => f.file === 'mother.png' && f.size === 96));
  for (const f of files) assert.ok(f.rows && f.palette && f.size > 0, f.file);
});
