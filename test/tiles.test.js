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
