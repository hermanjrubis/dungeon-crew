const test = require('node:test');
const assert = require('node:assert');
const tiles = require('../shared/tiles');
const { FLOOR1 } = require('../shared/rooms');

const { TILE } = tiles;

// Small hand-made room so the collision tests are easy to read.
const SMALL = [
  'wwwwww',
  'wefffw',
  'wfpffd',
  'wwwwww'
];

test('parseRoom finds entry, door and spawns', () => {
  const room = tiles.parseRoom(FLOOR1[0]);
  const entryTile = FLOOR1[0].findIndex((row) => row.includes('e'));
  const entryCol = FLOOR1[0][entryTile].indexOf('e');
  assert.deepStrictEqual(room.entry, { x: entryCol * TILE + TILE / 2, y: entryTile * TILE + TILE / 2 });
  assert.ok(room.door.length >= 1);
  const gloops = room.spawns.filter((s) => s.type === 'gloop');
  assert.strictEqual(gloops.length, 4);
  for (const s of room.spawns) assert.strictEqual(tiles.tileAt(room, s.x, s.y), 'f');
});

test('every Floor 1 room is 24x13', () => {
  assert.strictEqual(FLOOR1.length, 4);
  for (const rows of FLOOR1) {
    assert.strictEqual(rows.length, 13);
    for (const row of rows) assert.strictEqual(row.length, 24, row);
  }
});

test('walls block movement', () => {
  const room = tiles.parseRoom(SMALL);
  const x = TILE + TILE / 2; // middle of the tile right of the left wall
  const y = TILE + TILE / 2;
  const moved = tiles.moveWithCollision(room, x, y, -200, 0, 16, {});
  assert.ok(moved.x - 16 >= TILE, 'stays out of the wall: ' + moved.x);
});

test('closed door blocks, open door lets through', () => {
  const room = tiles.parseRoom(SMALL);
  const y = 2 * TILE + TILE / 2;
  const x = 4 * TILE + TILE / 2;
  const closed = tiles.moveWithCollision(room, x, y, 60, 0, 16, { doorOpen: false });
  assert.ok(closed.x + 16 <= 5 * TILE, 'blocked by closed door');
  const open = tiles.moveWithCollision(room, x, y, 60, 0, 16, { doorOpen: true });
  assert.ok(open.x + 16 > 5 * TILE, 'walks into open door');
});

test('pits are not solid', () => {
  const room = tiles.parseRoom(SMALL);
  const y = 2 * TILE + TILE / 2;
  const moved = tiles.moveWithCollision(room, 3 * TILE + TILE / 2, y, -TILE, 0, 16, {});
  assert.strictEqual(tiles.tileAt(room, moved.x, moved.y), 'p');
});

test('outside the map counts as wall', () => {
  const room = tiles.parseRoom(SMALL);
  assert.strictEqual(tiles.tileAt(room, -5, -5), 'w');
});

test('in every Floor 1 room the door can be reached from the entry without crossing pits', () => {
  FLOOR1.forEach((rows, i) => {
    const room = tiles.parseRoom(rows);
    const start = [Math.floor(room.entry.x / TILE), Math.floor(room.entry.y / TILE)];
    const seen = new Set([start.join(',')]);
    const queue = [start];
    let found = i === FLOOR1.length - 1; // the boss room has no next room
    while (queue.length && !found) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const ch = room.grid[ny] && room.grid[ny][nx];
        if (!ch || ch === 'w' || ch === 'p' || ch === 'x' || seen.has(nx + ',' + ny)) continue;
        if (ch === 'd') { found = true; break; }
        seen.add(nx + ',' + ny);
        queue.push([nx, ny]);
      }
    }
    assert.ok(found, `room ${i + 1}: no safe path from entry to door`);
  });
});

test('every floor room, recipe shape and fallback is 24x13, and hand-made rooms have a safe path', () => {
  const { FLOORS } = require('../shared/rooms');
  const { reachable } = require('../server/layout');
  for (const floor of FLOORS) {
    floor.rooms.forEach((room, i) => {
      const grids = room.layout ? [room.layout] : [room.recipe.shape, room.recipe.fallback];
      for (const rows of grids) {
        assert.strictEqual(rows.length, 13, `${floor.name} room ${i + 1}`);
        rows.forEach((r) => assert.strictEqual(r.length, 24, `${floor.name} room ${i + 1}: ${r}`));
      }
      const last = i === floor.rooms.length - 1;
      const rows = room.layout || room.recipe.fallback;
      // A lava river with a moving bridge counts as a way across.
      const bridged = room.bridge || (room.recipe && room.recipe.fallbackBridge);
      const grid = rows.map((r) => [...r].map((c) => (bridged && c === 'l' ? 'f' : c)));
      const ey = rows.findIndex((r) => r.includes('e'));
      const reach = reachable(grid, [rows[ey].indexOf('e'), ey]);
      const doorOk = last || rows.some((r, y) => [...r].some((c, x) => c === 'd' && reach.has(x + ',' + y)));
      assert.ok(doorOk, `${floor.name} room ${i + 1} has no safe path`);
    });
  }
});
