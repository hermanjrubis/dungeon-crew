const test = require('node:test');
const assert = require('node:assert');
const terrain = require('../shared/art/terrain');

test('every floor has 4 floor tiles, a wall, a pillar and 4 decorations, all 24x24', () => {
  assert.strictEqual(terrain.count, 6);
  for (let f = 0; f < 6; f++) {
    const frames = terrain.tileFrames(f);
    assert.deepStrictEqual(frames.map((x) => x.name), ['floor0', 'floor1', 'floor2', 'floor3', 'wall', 'pillar', 'deco0', 'deco1', 'deco2', 'deco3']);
    for (const fr of frames) {
      assert.strictEqual(fr.grid.length, 24, `${f} ${fr.name}`);
      for (const row of fr.grid) assert.strictEqual(row.length, 24);
    }
  }
});

test('floor, wall and pillar tiles cover their whole tile; decorations are small and see-through', () => {
  for (let f = 0; f < 6; f++) {
    const frames = terrain.tileFrames(f);
    for (const fr of frames.slice(0, 6)) assert.ok(fr.grid.every((r) => r.every(Boolean)), `${f} ${fr.name} has holes`);
    for (const fr of frames.slice(6)) {
      const filled = fr.grid.flat().filter(Boolean).length;
      assert.ok(filled > 4 && filled < 24 * 24 / 2, `${f} ${fr.name} filled ${filled}`);
    }
  }
});

test('each floor looks different', () => {
  const looks = new Set();
  for (let f = 0; f < 6; f++) looks.add(JSON.stringify(terrain.tileFrames(f)[0].grid));
  assert.strictEqual(looks.size, 6);
});

test('terrain sheets are listed for the sprite builder: one file per floor', () => {
  const files = terrain.terrainFiles();
  assert.deepStrictEqual(files.map((x) => x.file), [1, 2, 3, 4, 5, 6].map((n) => `terrain-${n}.png`));
  assert.ok(files.every((x) => x.frames === 10 && x.size === 48));
});
