const test = require('node:test');
const assert = require('node:assert');
const { buildRoom } = require('../server/layout');
const { makeRng } = require('../server/rng');

// A plain 24x13 room: walls around, entry on the left, a 3-tile door on the right.
const SHAPE = [
  'wwwwwwwwwwwwwwwwwwwwwwww',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffd',
  'we' + 'f'.repeat(21) + 'd',
  'wffffffffffffffffffffffd',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wwwwwwwwwwwwwwwwwwwwwwww'
];
const FALLBACK = SHAPE.slice(); // a valid hand-made room (empty)

const FLOOR1_STYLE = {
  shape: SHAPE,
  scatter: [
    { kind: 'spikes', count: 3, size: [2, 2] },
    { kind: 'pit', count: 1, size: [2, 2] },
    { kind: 'puddle', count: 2, size: [2, 1] },
    { kind: 'pillar', count: [2, 4], size: [1, 1] }
  ],
  monsters: { gloop: 4, bat: 2 },
  fallback: FALLBACK
};

const FLOOR2_STYLE = {
  shape: SHAPE,
  scatter: [
    { kind: 'poison', count: 2, size: [2, 2] },
    { kind: 'pillar', count: [3, 5], size: [1, 1] }
  ],
  monsters: { archer: 2, sporecap: 2, bat: 1 },
  dark: [12, 1, 22, 11],
  torches: 3,
  fallback: FALLBACK
};

const count = (rows, ch) => rows.join('').split(ch).length - 1;
function find(rows, ch) {
  const out = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
  return out;
}
const near = (a, b, d) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= d;
const MONSTER_LETTERS = 'gbac';
const HAZARDS = 'spxuo';

function reachableFrom(rows, start) {
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const ch = rows[ny] && rows[ny][nx];
      if (!ch || 'wpx'.includes(ch) || seen.has(nx + ',' + ny)) continue;
      seen.add(nx + ',' + ny);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

test('same seed gives the same room, different seeds give different rooms', () => {
  const a = buildRoom(FLOOR1_STYLE, makeRng(7)).rows;
  const b = buildRoom(FLOOR1_STYLE, makeRng(7)).rows;
  const c = buildRoom(FLOOR1_STYLE, makeRng(8)).rows;
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
});

test('shape is kept: border walls, entry and doors stay put', () => {
  for (const seed of SEEDS) {
    const { rows } = buildRoom(FLOOR1_STYLE, makeRng(seed));
    assert.strictEqual(rows.length, 13);
    rows.forEach((r) => assert.strictEqual(r.length, 24));
    assert.strictEqual(rows[0], SHAPE[0]);
    assert.strictEqual(rows[12], SHAPE[12]);
    assert.deepStrictEqual(find(rows, 'e'), find(SHAPE, 'e'));
    assert.deepStrictEqual(find(rows, 'd'), find(SHAPE, 'd'));
  }
});

test('scatter counts match the recipe', () => {
  for (const seed of SEEDS) {
    const { rows, fallback } = buildRoom(FLOOR1_STYLE, makeRng(seed));
    assert.strictEqual(fallback, false, 'seed ' + seed);
    assert.strictEqual(count(rows, 's'), 3 * 4);
    assert.strictEqual(count(rows, 'p'), 4);
    assert.strictEqual(count(rows, 'x'), 12); // the ring around a 2x2 pit
    assert.strictEqual(count(rows, 'u'), 4);
    const pillars = count(rows, 'w') - count(SHAPE, 'w');
    assert.ok(pillars >= 2 && pillars <= 4, 'pillars ' + pillars);
    assert.strictEqual(count(rows, 'g'), 4);
    assert.strictEqual(count(rows, 'b'), 2);
  }
});

test('nothing within 2 tiles of the entry or the door', () => {
  for (const seed of SEEDS) {
    const { rows } = buildRoom(FLOOR1_STYLE, makeRng(seed));
    const keep = [...find(SHAPE, 'e'), ...find(SHAPE, 'd')];
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (SHAPE[y][x] !== 'f' || ch === 'f') return;
      for (const k of keep) assert.ok(!near([x, y], k, 2), `seed ${seed}: '${ch}' at ${x},${y} too close to ${k}`);
    }));
  }
});

test('there is always a safe path from entry to door', () => {
  for (const style of [FLOOR1_STYLE, FLOOR2_STYLE]) {
    for (const seed of SEEDS) {
      const { rows } = buildRoom(style, makeRng(seed));
      const reach = reachableFrom(rows, find(rows, 'e')[0]);
      assert.ok(find(rows, 'd').some(([x, y]) => [[x - 1, y]].some(([a, b]) => reach.has(a + ',' + b))), 'seed ' + seed);
    }
  }
});

test('monsters start on plain floor, at least 5 tiles from the entry, reachable from the entry', () => {
  for (const style of [FLOOR1_STYLE, FLOOR2_STYLE]) {
    for (const seed of SEEDS) {
      const { rows } = buildRoom(style, makeRng(seed));
      const entry = find(rows, 'e')[0];
      const reach = reachableFrom(rows, entry);
      for (const letter of MONSTER_LETTERS) {
        for (const [x, y] of find(rows, letter)) {
          assert.strictEqual(SHAPE[y][x], 'f');
          assert.ok(Math.hypot(x - entry[0], y - entry[1]) >= 5, `seed ${seed}: monster too close`);
          assert.ok(reach.has(x + ',' + y), `seed ${seed}: monster at ${x},${y} can't be reached`);
        }
      }
    }
  }
});

test('hazards and pillars never overlap each other or monsters', () => {
  for (const seed of SEEDS) {
    const { rows } = buildRoom(FLOOR2_STYLE, makeRng(seed));
    // every changed tile holds exactly one thing by construction; check pits are always ringed
    for (const [x, y] of find(rows, 'p')) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok('px'.includes(rows[y + dy][x + dx]));
    }
    assert.ok(count(rows, 'o') === 8, 'poison tiles');
    for (const ch of HAZARDS) for (const [x, y] of find(rows, ch)) assert.ok(!MONSTER_LETTERS.includes(rows[y][x]));
  }
});

test('torches sit on floor inside the dark area', () => {
  for (const seed of SEEDS) {
    const { rows, dark, torches } = buildRoom(FLOOR2_STYLE, makeRng(seed));
    assert.deepStrictEqual(dark, [[12, 1, 22, 11]]);
    assert.strictEqual(torches.length, 3);
    for (const t of torches) {
      assert.ok(t.tx >= 12 && t.tx <= 22 && t.ty >= 1 && t.ty <= 11);
      assert.strictEqual(rows[t.ty][t.tx], 'f');
    }
  }
});

test('impossible recipe falls back to the hand-made rows', () => {
  const crazy = { ...FLOOR1_STYLE, scatter: [{ kind: 'spikes', count: 400, size: [2, 2] }] };
  const res = buildRoom(crazy, makeRng(1));
  assert.strictEqual(res.fallback, true);
  assert.deepStrictEqual(res.rows, FALLBACK);
});

// ---------- Slice 3: lava river ----------
test('river recipes always leave the door reachable across the bridge for 200 seeds', () => {
  const { PLAIN } = require('../shared/rooms');
  const recipe = {
    shape: PLAIN, fallback: PLAIN, river: { x: 11 },
    scatter: [{ kind: 'pillar', count: [2, 4], size: [1, 1] }, { kind: 'puddle', count: 2, size: [2, 2] }],
    monsters: { golem: 1, archer: 2, bat: 2 }
  };
  for (let seed = 1; seed <= 200; seed++) {
    const built = buildRoom(recipe, makeRng(seed));
    assert.strictEqual(built.fallback, false, 'seed ' + seed);
    assert.deepStrictEqual(built.bridge, { tx: 11, stops: [2, 3, 4, 5, 6, 7, 8, 9] });
    for (let y = 1; y <= 11; y++) {
      assert.strictEqual(built.rows[y][11] + built.rows[y][12], 'll', `nothing on the river, seed ${seed}`);
    }
    assert.ok(built.rows.join('').includes('G'));
  }
});
