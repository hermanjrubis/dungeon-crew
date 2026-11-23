// Builds a room from a recipe: the room's fixed shape plus a list of things to
// scatter (traps, pillars, monsters). Every game gets a fresh layout, but the
// rules below make sure every room can always be finished.
//
// Rules:
//   - nothing within 2 tiles of the entrance or the exit door
//   - things don't overlap
//   - monsters start on plain floor, at least 5 tiles from the entrance,
//     somewhere players can walk to
//   - there is always a path from the entrance to the door that never
//     crosses a pit, cracked floor, a geyser vent or lava (the moving bridge
//     counts as a way across a lava river)
// If 50 tries all break a rule, the recipe's hand-made `fallback` is used.

const LETTERS = { spikes: 's', puddle: 'u', poison: 'o', pillar: 'w', vent: 'v' };
const MONSTER_LETTERS = { gloop: 'g', bat: 'b', archer: 'a', sporecap: 'c', golem: 'G' };
const TRIES = 50;
const SPOT_TRIES = 200;
const KEEP_CLEAR = 2;
const MONSTER_MIN_DIST = 5;
const BLOCKING = 'wpxvlj'; // tiles a safe path can't cross

function find(grid, ch) {
  const out = [];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c === ch) out.push([x, y]); }));
  return out;
}

// Every tile you can walk to from `start` without crossing walls, pits or cracks.
function reachable(grid, start) {
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const ch = grid[ny] && grid[ny][nx];
      if (!ch || BLOCKING.includes(ch) || seen.has(nx + ',' + ny)) continue;
      seen.add(nx + ',' + ny);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function tryBuild(recipe, rng) {
  const grid = recipe.shape.map((r) => [...r]);
  const h = grid.length;
  const w = grid[0].length;
  const entry = find(grid, 'e')[0];
  const doors = find(grid, 'd');
  const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

  // Tiles kept empty around the entrance and the door.
  const keep = new Set();
  for (const [kx, ky] of [entry, ...doors]) {
    for (let y = ky - KEEP_CLEAR; y <= ky + KEEP_CLEAR; y++) {
      for (let x = kx - KEEP_CLEAR; x <= kx + KEEP_CLEAR; x++) keep.add(x + ',' + y);
    }
  }
  // A lava river 2 tiles wide, top to bottom, crossed by a moving bridge.
  let bridge = null;
  if (recipe.river) {
    const rx = recipe.river.x;
    for (let y = 1; y < h - 1; y++) { grid[y][rx] = 'l'; grid[y][rx + 1] = 'l'; }
    const stops = [];
    for (let y = 2; y <= h - 4; y++) stops.push(y);
    bridge = { tx: rx, stops };
  }
  // Flame-jet nozzles sit in the top and bottom walls (taking turns), at
  // least 2 columns apart and away from the entrance and door columns.
  if (recipe.jets) {
    let cols = [];
    for (let x = 4; x <= w - 5; x++) cols.push(x);
    for (let i = 0; i < recipe.jets; i++) {
      if (!cols.length) return null;
      const x = cols[Math.floor(rng() * cols.length)];
      grid[i % 2 === 0 ? 0 : h - 1][x] = 'j';
      cols = cols.filter((c) => Math.abs(c - x) >= 2);
    }
  }
  const free = (x, y) => y >= 0 && y < h && x >= 0 && x < w && grid[y][x] === 'f' && !keep.has(x + ',' + y);

  // Scatter traps and pillars.
  for (const item of recipe.scatter || []) {
    const n = Array.isArray(item.count) ? randInt(item.count[0], item.count[1]) : item.count;
    const [sw, sh] = item.size;
    const ring = item.kind === 'pit' ? 1 : 0; // pits get a ring of cracked floor
    for (let i = 0; i < n; i++) {
      let placed = false;
      for (let t = 0; t < SPOT_TRIES && !placed; t++) {
        const x0 = randInt(1, w - 2 - sw - ring * 2 + 1);
        const y0 = randInt(1, h - 2 - sh - ring * 2 + 1);
        let ok = true;
        for (let y = y0; y < y0 + sh + ring * 2 && ok; y++) {
          for (let x = x0; x < x0 + sw + ring * 2 && ok; x++) ok = free(x, y);
        }
        if (!ok) continue;
        for (let y = y0; y < y0 + sh + ring * 2; y++) {
          for (let x = x0; x < x0 + sw + ring * 2; x++) {
            const inner = x >= x0 + ring && x < x0 + ring + sw && y >= y0 + ring && y < y0 + ring + sh;
            grid[y][x] = ring ? (inner ? 'p' : 'x') : LETTERS[item.kind];
          }
        }
        placed = true;
      }
      if (!placed) return null;
    }
  }

  // The door must still be reachable. The bridge reaches every part of the
  // river in time, so for this check the river counts as walkable.
  const walkGrid = bridge ? grid.map((row) => row.map((c) => (c === 'l' ? 'f' : c))) : grid;
  const reach = reachable(walkGrid, entry);
  if (!doors.some(([x, y]) => reach.has(x + ',' + y))) return null;

  // Monsters: plain floor, far enough from the entrance, reachable.
  const spots = [];
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (c === 'f' && !keep.has(x + ',' + y) && reach.has(x + ',' + y) && Math.hypot(x - entry[0], y - entry[1]) >= MONSTER_MIN_DIST) spots.push([x, y]);
  }));
  for (const [type, n] of Object.entries(recipe.monsters || {})) {
    for (let i = 0; i < n; i++) {
      if (!spots.length) return null;
      const [x, y] = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      grid[y][x] = MONSTER_LETTERS[type];
    }
  }

  // Torches go on reachable floor inside the dark area.
  const dark = recipe.dark ? [recipe.dark] : [];
  const torches = [];
  if (recipe.dark && recipe.torches) {
    const [x0, y0, x1, y1] = recipe.dark;
    const inside = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (grid[y][x] === 'f' && reach.has(x + ',' + y)) inside.push([x, y]);
    }
    for (let i = 0; i < recipe.torches; i++) {
      if (!inside.length) return null;
      const [tx, ty] = inside.splice(Math.floor(rng() * inside.length), 1)[0];
      torches.push({ tx, ty });
    }
  }

  return { rows: grid.map((r) => r.join('')), dark, torches, bridge };
}

function buildRoom(recipe, rng) {
  for (let i = 0; i < TRIES; i++) {
    const built = tryBuild(recipe, rng);
    if (built) return { ...built, fallback: false };
  }
  return {
    rows: recipe.fallback.slice(),
    dark: recipe.dark ? [recipe.dark] : [],
    torches: (recipe.fallbackTorches || []).map((t) => ({ ...t })),
    bridge: recipe.fallbackBridge || null,
    fallback: true
  };
}

module.exports = { buildRoom, reachable, MONSTER_LETTERS };
