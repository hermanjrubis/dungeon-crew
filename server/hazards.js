// Floor hazards: spike traps, cracked floor that breaks, pits and puddles.
// Hazards hurt walking monsters too, so players can lure enemies into them.
// Flying monsters (Skitterbats) ignore all of them.
const tiles = require('../shared/tiles');

const SPIKE_CYCLE = 3;     // seconds for one down -> rattle -> up loop
const SPIKE_RATTLE = 1.5;  // rattle (the warning) starts here
const SPIKE_UP = 2.0;      // spikes are up from here until the cycle ends
const SPIKE_DAMAGE = 10;
const CRACK_TIME = 1;      // cracked floor breaks this long after being stepped on
const FALL_DAMAGE = 15;
const PUDDLE_SLOW = 0.4;   // 40% slower = 60% speed
const POOL_POISON = 4;     // poison pools, per second
const ROCK_EVERY = [3, 5]; // seconds between stalactites (random in this range)
const ROCK_TELL = 1;       // the shadow grows for this long
const ROCK_RADIUS = 32;
const ROCK_DAMAGE = 15;
const ROCK_SPREAD = 16;    // how far from the player the shadow can land
const TORCH_REACH = 48;

function spikeState(time) {
  const t = ((time % SPIKE_CYCLE) + SPIKE_CYCLE) % SPIKE_CYCLE;
  if (t < SPIKE_RATTLE) return 'down';
  if (t < SPIKE_UP) return 'rattle';
  return 'up';
}

// The tile under a position, counting broken cracked tiles as pits.
function tileUnder(game, x, y) {
  if (game.broken.has(tiles.tileIndex(game.room, x, y))) return 'p';
  return tiles.tileAt(game.room, x, y);
}

function updateHazards(game, dt) {
  updateStalactites(game);
  updateTorches(game);

  // Cracked tiles that were stepped on 1 s ago break now.
  for (const [idx, at] of game.cracking) {
    if (game.time >= at - 1e-6) {
      game.cracking.delete(idx);
      game.broken.add(idx);
      const tx = idx % game.room.w;
      const ty = Math.floor(idx / game.room.w);
      game.event({ type: 'crumble', x: tx * tiles.TILE + tiles.TILE / 2, y: ty * tiles.TILE + tiles.TILE / 2 });
    }
  }

  const spikesUp = spikeState(game.time) === 'up';
  const cycle = Math.floor(game.time / SPIKE_CYCLE);

  for (const p of game.players.values()) {
    if (p.downed) continue;
    const ch = tileUnder(game, p.x, p.y);
    if (ch === 'p') {
      p.x = game.room.entry.x;
      p.y = game.room.entry.y;
      p.roll = null;
      game.damagePlayer(p, FALL_DAMAGE, 'pit');
      game.event({ type: 'fall', targetId: p.id });
      continue;
    }
    if (ch === 'o') game.poisonPlayer(p, POOL_POISON, dt);
    standOn(game, p, ch, spikesUp, cycle, () => game.damagePlayer(p, SPIKE_DAMAGE, 'spikes'));
  }

  for (const e of game.enemies.slice()) {
    if (e.flying || e.invulnerable) continue;
    const ch = tileUnder(game, e.x, e.y);
    if (ch === 'p') {
      game.killEnemy(e, { reward: false });
      continue;
    }
    if (ch === 'o') {
      e.poisonAcc = (e.poisonAcc || 0) + POOL_POISON * dt;
      if (e.poisonAcc >= 1) {
        const whole = Math.floor(e.poisonAcc);
        e.poisonAcc -= whole;
        game.damageEnemy(e, whole, null);
        if (!game.enemies.includes(e)) continue;
      }
    }
    standOn(game, e, ch, spikesUp, cycle, () => game.damageEnemy(e, SPIKE_DAMAGE, null));
  }
}

// Floor 2: every few seconds a shadow grows under a random player for 1 s,
// then a rock falls there. Not in boss rooms.
function updateStalactites(game) {
  const bossRoom = game.roomIndex === game.layouts.length - 1;
  if (!game.floor.stalactites || bossRoom) return;
  if (game.nextRock === undefined) game.nextRock = game.time + nextGap(game);
  for (const z of game.rocks.slice()) {
    if (game.time < z.at - 1e-6) continue;
    game.rocks.splice(game.rocks.indexOf(z), 1);
    for (const p of game.alivePlayers()) {
      if (Math.hypot(p.x - z.x, p.y - z.y) <= ROCK_RADIUS + p.r * 0.5) game.damagePlayer(p, ROCK_DAMAGE, 'rock');
    }
    for (const e of game.enemies.slice()) {
      if (!e.flying && !e.invulnerable && Math.hypot(e.x - z.x, e.y - z.y) <= ROCK_RADIUS + e.r * 0.5) game.damageEnemy(e, ROCK_DAMAGE, null);
    }
    game.event({ type: 'rockfall', x: Math.round(z.x), y: Math.round(z.y) });
  }
  if (game.time < game.nextRock - 1e-6) return;
  game.nextRock = game.time + nextGap(game);
  const alive = game.alivePlayers();
  if (!alive.length) return;
  const p = alive[Math.floor(game.rng() * alive.length)];
  let x = p.x + (game.rng() * 2 - 1) * ROCK_SPREAD;
  let y = p.y + (game.rng() * 2 - 1) * ROCK_SPREAD;
  if (tiles.isSolid(tiles.tileAt(game.room, x, y), {})) { x = p.x; y = p.y; }
  // The shadow is what players see; the rock itself is tracked separately.
  game.addZone({ kind: 'rockShadow', x, y, r: ROCK_RADIUS, until: game.time + ROCK_TELL });
  game.rocks.push({ x, y, at: game.time + ROCK_TELL });
}

function nextGap(game) {
  return ROCK_EVERY[0] + game.rng() * (ROCK_EVERY[1] - ROCK_EVERY[0]);
}

// Hold E next to an unlit torch to light it for the whole team.
function updateTorches(game) {
  for (const t of game.torches) {
    if (t.lit) continue;
    const lighter = game.alivePlayers().find((p) => p.input.interact && Math.hypot(p.x - t.x, p.y - t.y) <= TORCH_REACH);
    if (lighter) {
      t.lit = true;
      game.event({ type: 'torchlit', x: Math.round(t.x), y: Math.round(t.y), by: lighter.id });
    }
  }
}

function standOn(game, ent, ch, spikesUp, cycle, hurt) {
  if (ch === 's' && spikesUp && ent.spikeCycle !== cycle) {
    ent.spikeCycle = cycle;
    game.event({ type: 'spike', x: Math.round(ent.x), y: Math.round(ent.y) });
    hurt();
  } else if (ch === 'x') {
    const idx = tiles.tileIndex(game.room, ent.x, ent.y);
    if (!game.cracking.has(idx) && !game.broken.has(idx)) game.cracking.set(idx, game.time + CRACK_TIME);
  } else if (ch === 'u') {
    game.applySlow(ent, 'puddle', PUDDLE_SLOW, 0.1);
  }
}

module.exports = { updateHazards, spikeState, tileUnder };
