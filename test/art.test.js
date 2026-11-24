const test = require('node:test');
const assert = require('node:assert');
const sheets = require('../shared/art');
const { ENEMIES, HEROES } = require('../shared/data');

const all = sheets.sheetFiles();
const byKey = new Map(all.map((s) => [s.key, s]));

test('every hero sheet has every action a hero can do', () => {
  for (const s of all.filter((s) => sheets.HERO_CLASSES.includes(s.art))) {
    for (const a of sheets.HERO_ACTIONS) assert.ok(s.anims[a], `${s.key} is missing ${a}`);
  }
});

test('every monster sheet has idle, walk, hurt and death', () => {
  for (const s of all.filter((s) => !sheets.HERO_CLASSES.includes(s.art))) {
    for (const a of sheets.MONSTER_ACTIONS) assert.ok(s.anims[a], `${s.key} is missing ${a}`);
  }
});

test('one-shot actions do not loop; walking and standing do', () => {
  const k = byKey.get('knight-orange');
  assert.strictEqual(k.anims.attack.loop, false);
  assert.strictEqual(k.anims.hurt.loop, false);
  assert.strictEqual(k.anims.walk.loop, true);
  assert.strictEqual(k.anims.idle.loop, true);
});

test('every frame draws at its sheet size', () => {
  for (const s of all) {
    s.frames.forEach((_, i) => {
      const g = sheets.renderSheetFrame(s, i);
      assert.strictEqual(g.length, s.size, s.key);
      assert.strictEqual(g[0].length, s.size, s.key);
      assert.ok(g.flat().some(Boolean) || s.frames[i].anim === 'death', `${s.key} frame ${i} is empty`);
    });
  }
});

test('each player color gives the hero different colors', () => {
  const a = sheets.renderSheetFrame(byKey.get('knight-orange'), 0).flat().join();
  const b = sheets.renderSheetFrame(byKey.get('knight-blue'), 0).flat().join();
  assert.notStrictEqual(a, b);
});

test('Mini Gloop is drawn smaller than the Gloop', () => {
  const count = (k) => sheets.renderSheetFrame(byKey.get(k), 0).flat().filter(Boolean).length;
  assert.ok(count('minigloop') < count('gloop') * 0.7);
});

test('every hero and monster in the game has new art', { todo: 'filled in by the art tasks' }, () => {
  for (const cls of Object.keys(HEROES)) assert.ok(byKey.get(sheets.heroSheet(cls, 'orange')), cls);
  for (const type of Object.keys(ENEMIES)) assert.ok(byKey.get(sheets.enemySheet(type)), type);
});
