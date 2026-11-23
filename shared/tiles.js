// Tiles, room parsing and collision.
// Works in Node (require) and in the browser (window.DC.tiles), so the server
// and the players' browsers always agree on where the walls are.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.tiles = factory(); }
})(this, function () {
  const TILE = 48;   // size of one tile in pixels
  const ROOM_W = 24; // tiles across
  const ROOM_H = 13; // tiles down

  // Letters that mark where things start. They become plain floor after parsing.
  const SPAWN_LETTERS = { g: 'gloop', b: 'bat', M: 'mother' };

  // Turn a list of text rows into a room object.
  //   w wall, f floor, s spikes, x cracked floor, p pit, u puddle, d door, e entry
  function parseRoom(rows) {
    const grid = [];
    const spawns = [];
    const door = [];
    let entry = null;
    for (let ty = 0; ty < rows.length; ty++) {
      const line = [];
      for (let tx = 0; tx < rows[ty].length; tx++) {
        let ch = rows[ty][tx];
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        if (SPAWN_LETTERS[ch]) {
          spawns.push({ type: SPAWN_LETTERS[ch], x: cx, y: cy });
          ch = 'f';
        } else if (ch === 'e') {
          entry = { x: cx, y: cy };
          ch = 'f';
        } else if (ch === 'd') {
          door.push({ tx, ty });
        }
        line.push(ch);
      }
      grid.push(line);
    }
    return { w: grid[0].length, h: grid.length, grid, entry, door, spawns };
  }

  // Which tile letter is under a pixel position. Outside the room counts as wall.
  function tileAt(room, px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (ty < 0 || ty >= room.h || tx < 0 || tx >= room.w) return 'w';
    return room.grid[ty][tx];
  }

  // Can nothing walk or fly through this tile?
  function isSolid(ch, opts) {
    if (ch === 'w') return true;
    if (ch === 'd') return !(opts && opts.doorOpen);
    return false;
  }

  // Does a box of half-size r centred on (x, y) touch a solid tile?
  function hits(room, x, y, r, opts) {
    const e = 0.001; // so touching an edge exactly is not a hit
    return isSolid(tileAt(room, x - r + e, y - r + e), opts) ||
      isSolid(tileAt(room, x + r - e, y - r + e), opts) ||
      isSolid(tileAt(room, x - r + e, y + r - e), opts) ||
      isSolid(tileAt(room, x + r - e, y + r - e), opts);
  }

  // Move by (dx, dy), sliding along walls. Moves in small steps so even a big
  // jump can never skip through a wall.
  function moveWithCollision(room, x, y, dx, dy, r, opts) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0 && !hits(room, x + sx, y, r, opts)) x += sx;
      if (sy !== 0 && !hits(room, x, y + sy, r, opts)) y += sy;
    }
    return { x, y };
  }

  function tileIndex(room, px, py) {
    return Math.floor(py / TILE) * room.w + Math.floor(px / TILE);
  }

  return { TILE, ROOM_W, ROOM_H, parseRoom, tileAt, isSolid, moveWithCollision, tileIndex };
});
