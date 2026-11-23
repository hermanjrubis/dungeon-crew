// Floor 3 and 4 hazards: lava, geyser vents and flame jets.
// Every one of them warns first (a glow or a hiss) so players can learn it.
// Walking monsters get hurt too, so players can lure them in.
const tiles = require('../shared/tiles');

const T = tiles.TILE;
const EPS = 1e-6;

const LAVA_DAMAGE = 50;

const VENT_CYCLE = 6;     // seconds for one idle -> glow -> erupt loop
const VENT_OFFSET = 1.5;  // vents take turns: each starts this much later
const VENT_GLOW = 1.5;    // the warning
const VENT_ERUPT = 2;     // how long the lava column stays up
const VENT_RADIUS = 40;
const VENT_DAMAGE = 30;
const FORGE_GEYSER = 0.7; // Forgewalker set: geysers deal 30% less

const JET_CYCLE = 3;      // two groups, each fires once per cycle
const JET_HISS = 0.5;
const JET_FIRE = 1;
const JET_DAMAGE = 15;
const JET_HALF_WIDTH = 24;

const BRIDGE_STAY = 3;    // the bridge rests this long...
const BRIDGE_WARN = 1;    // ...then flickers this long...
const BRIDGE_GLIDE = 0.5; // ...then slides to its next stop

// Called whenever a room loads: find this room's vents and jets.
function reset(game, layout = {}) {
  game.forgeStart = game.time;
  // The bridge over a lava river: 2 tiles wide, 2 tiles tall, carries riders.
  const b = layout.bridge;
  game.bridge = b ? {
    x: b.tx * T, y: b.stops[0] * T, w: 2 * T, h: 2 * T,
    stops: b.stops.map((s) => s * T), stop: 0, arrivedAt: game.time, glide: null
  } : null;
  game.vents = [];
  game.jets = [];
  const { grid, w, h } = game.room;
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const ch = grid[ty][tx];
      if (ch === 'v') game.vents.push({ tx, ty, i: game.vents.length, x: tx * T + T / 2, y: ty * T + T / 2 });
      if (ch === 'j') {
        // A nozzle fires away from the wall it sits in.
        const dir = tx === 0 ? { x: 1, y: 0 } : tx === w - 1 ? { x: -1, y: 0 } : ty === 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
        let len = 0;
        while (true) {
          const c = grid[ty + dir.y * (len + 1)] && grid[ty + dir.y * (len + 1)][tx + dir.x * (len + 1)];
          if (!c || c === 'w' || c === 'j' || c === 'd') break;
          len++;
        }
        game.jets.push({ tx, ty, dir, len, group: game.jets.length % 2, x: tx * T + T / 2, y: ty * T + T / 2 });
      }
    }
  }
}

const elapsed = (game) => game.time - (game.forgeStart || 0);
const mod = (a, n) => ((a % n) + n) % n;

function ventPhase(game, i) {
  const t = elapsed(game) - i * VENT_OFFSET;
  return { t: mod(t, VENT_CYCLE), cycle: Math.floor(t / VENT_CYCLE) };
}

function ventState(game, i) {
  const { t } = ventPhase(game, i);
  if (t < VENT_GLOW - EPS) return 'glow';
  if (t < VENT_GLOW + VENT_ERUPT - EPS) return 'erupt';
  return 'idle';
}

function jetState(game, group) {
  const t = mod(elapsed(game) - group * (JET_CYCLE / 2), JET_CYCLE);
  if (t < JET_HISS - EPS) return 'hiss';
  if (t < JET_HISS + JET_FIRE - EPS) return 'fire';
  return 'idle';
}

// Where a player goes after falling in lava.
function respawnPoint(game) {
  return { x: game.room.entry.x, y: game.room.entry.y };
}

function onBridge(game, x, y) {
  const b = game.bridge;
  return !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// Is this spot lava right now? (Lava under the bridge is safe.)
function isLava(game, x, y) {
  return tiles.tileAt(game.room, x, y) === 'l' && !onBridge(game, x, y);
}

function updateBridge(game) {
  const b = game.bridge;
  if (!b) return;
  const riders = game.alivePlayers().filter((p) => onBridge(game, p.x, p.y));
  const before = b.y;
  if (!b.glide && game.time >= b.arrivedAt + BRIDGE_STAY + BRIDGE_WARN - EPS) {
    const others = b.stops.map((_, i) => i).filter((i) => i !== b.stop);
    const next = others[Math.floor(game.rng() * others.length)];
    b.glide = { from: b.y, to: b.stops[next], start: game.time, next };
    game.event({ type: 'bridgemove', x: b.x, y: b.stops[next] });
  }
  if (b.glide) {
    const t = Math.min(1, (game.time - b.glide.start) / BRIDGE_GLIDE);
    b.y = b.glide.from + (b.glide.to - b.glide.from) * t;
    if (t >= 1 - EPS) {
      b.y = b.glide.to;
      b.stop = b.glide.next;
      b.glide = null;
      b.arrivedAt = game.time;
    }
  }
  for (const p of riders) p.y += b.y - before;
}

function bridgeWarn(game) {
  const b = game.bridge;
  return !!b && !b.glide && game.time >= b.arrivedAt + BRIDGE_STAY - EPS;
}

function update(game, dt) {
  if (!game.vents) reset(game);
  const hurtable = game.enemies.filter((e) => !e.flying && !e.invulnerable);
  updateBridge(game);

  // Lava
  for (const p of game.alivePlayers()) {
    if (!isLava(game, p.x, p.y)) continue;
    const to = respawnPoint(game);
    p.x = to.x;
    p.y = to.y;
    p.roll = null;
    game.damagePlayer(p, LAVA_DAMAGE, 'lava', { ignoreDefense: true, ignoreInvuln: true });
    game.event({ type: 'lavafall', targetId: p.id });
  }
  for (const e of hurtable) {
    if (isLava(game, e.x, e.y)) game.killEnemy(e, { reward: false });
  }

  // Geysers
  for (const v of game.vents) {
    const state = ventState(game, v.i);
    const { cycle } = ventPhase(game, v.i);
    if (state === 'erupt' && v.erupted !== cycle) {
      v.erupted = cycle;
      game.event({ type: 'erupt', x: v.x, y: v.y });
    }
    if (state !== 'erupt') continue;
    const key = 'vent' + v.i;
    for (const p of game.alivePlayers()) {
      if (Math.hypot(p.x - v.x, p.y - v.y) > VENT_RADIUS || (p.hitBy || {})[key] === cycle) continue;
      (p.hitBy = p.hitBy || {})[key] = cycle;
      game.damagePlayer(p, Math.round(VENT_DAMAGE * (game.forgeSet(p) ? FORGE_GEYSER : 1)), 'geyser');
      game.burnPlayer(p);
    }
    for (const e of game.enemies.filter((o) => !o.flying && !o.invulnerable)) {
      if (Math.hypot(e.x - v.x, e.y - v.y) > VENT_RADIUS || (e.hitBy || {})[key] === cycle) continue;
      (e.hitBy = e.hitBy || {})[key] = cycle;
      game.damageEnemy(e, VENT_DAMAGE, null);
    }
  }

  // Flame jets
  const firing = Math.floor((elapsed(game) + JET_CYCLE) / JET_CYCLE); // a new number each cycle
  for (const [k, j] of game.jets.entries()) {
    if (jetState(game, j.group) !== 'fire') continue;
    const key = 'jet' + k;
    if (j.fired !== firing) {
      j.fired = firing;
      game.event({ type: 'jetfire', x: j.x, y: j.y, dx: j.dir.x, dy: j.dir.y, len: j.len });
    }
    const inBeam = (o) => {
      const along = (o.x - j.x) * j.dir.x + (o.y - j.y) * j.dir.y;
      const across = Math.abs((o.x - j.x) * j.dir.y - (o.y - j.y) * j.dir.x);
      return across <= JET_HALF_WIDTH && along >= T / 2 - EPS && along <= T / 2 + j.len * T + EPS;
    };
    for (const p of game.alivePlayers()) {
      if (!inBeam(p) || (p.hitBy || {})[key] === firing) continue;
      (p.hitBy = p.hitBy || {})[key] = firing;
      game.damagePlayer(p, JET_DAMAGE, 'jet');
    }
    for (const e of game.enemies.filter((o) => !o.flying && !o.invulnerable)) {
      if (!inBeam(e) || (e.hitBy || {})[key] === firing) continue;
      (e.hitBy = e.hitBy || {})[key] = firing;
      game.damageEnemy(e, JET_DAMAGE, null);
    }
  }
}

function snapshot(game) {
  const b = game.bridge;
  return {
    bridge: b ? { x: b.x, y: Math.round(b.y), w: b.w, h: b.h, warn: bridgeWarn(game) } : null,
    vents: (game.vents || []).map((v) => ({ x: v.x, y: v.y, state: ventState(game, v.i) })),
    jets: (game.jets || []).map((j) => ({ x: j.x, y: j.y, dx: j.dir.x, dy: j.dir.y, len: j.len, state: jetState(game, j.group) }))
  };
}

module.exports = { reset, update, snapshot, ventState, jetState, respawnPoint, isLava, onBridge };
