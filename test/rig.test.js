const test = require('node:test');
const assert = require('node:assert');
const rig = require('../shared/rig');

const PAL = { o: '#000000', a: '#FF0000', b: '#00FF00' };
const dot = { size: 8, parts: [{ name: 'dot', rows: ['a'], pivot: [0, 0], at: [4, 4], z: 1 }] };

test('a part is drawn with a dark outline around it', () => {
  const g = rig.renderFrame(dot, {}, PAL);
  assert.strictEqual(g.length, 8);
  assert.strictEqual(g[0].length, 8);
  assert.strictEqual(g[4][4], '#FF0000');
  for (const [x, y] of [[3, 4], [5, 4], [4, 3], [4, 5]]) assert.strictEqual(g[y][x], '#000000');
  assert.strictEqual(g[3][3], null);
});

test('a pose moves a part by whole pixels', () => {
  const g = rig.renderFrame(dot, { dot: { x: 2, y: -1 } }, PAL);
  assert.strictEqual(g[3][6], '#FF0000');
  assert.strictEqual(g[4][4], null);
});

test('hidden parts only draw when a pose shows them', () => {
  const r = { size: 8, parts: [{ name: 'fx', rows: ['b'], pivot: [0, 0], at: [2, 2], z: 1, hidden: true, outline: false }] };
  assert.strictEqual(rig.renderFrame(r, {}, PAL)[2][2], null);
  assert.strictEqual(rig.renderFrame(r, { fx: { show: true } }, PAL)[2][2], '#00FF00');
});

test('a rigid child follows its parent but is not stretched by it', () => {
  const r = { size: 16, parts: [
    { name: 'body', rows: ['aaaa', 'aaaa'], pivot: [2, 2], at: [8, 12], z: 1, outline: false },
    { name: 'eye', parent: 'body', rows: ['b'], pivot: [0, 0], at: [1, 0], z: 2, rigid: true, outline: false }
  ] };
  const g = rig.renderFrame(r, { body: { sx: 2, sy: 2 } }, PAL);
  const eyes = g.flat().filter((c) => c === '#00FF00').length;
  assert.strictEqual(eyes, 1);
});

test('later parts (higher z) draw on top', () => {
  const r = { size: 4, parts: [
    { name: 'top', rows: ['b'], pivot: [0, 0], at: [1, 1], z: 2, outline: false },
    { name: 'under', rows: ['a'], pivot: [0, 0], at: [1, 1], z: 1, outline: false }
  ] };
  assert.strictEqual(rig.renderFrame(r, {}, PAL)[1][1], '#00FF00');
  assert.strictEqual(rig.renderFrame(r, { under: { z: 3 } }, PAL)[1][1], '#FF0000');
});
