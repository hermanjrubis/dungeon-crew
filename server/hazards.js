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
  // Cracked tiles that were stepped on 1 s ago break now.
  for (const [idx, at] of game.cracking) {
    if (game.time >= at - 1e-6) {
      game.cracking.delete(idx);
      game.broken.add(idx);
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
    standOn(game, p, ch, spikesUp, cycle, () => game.damagePlayer(p, SPIKE_DAMAGE, 'spikes'));
  }

  for (const e of game.enemies.slice()) {
    if (e.flying || e.invulnerable) continue;
    const ch = tileUnder(game, e.x, e.y);
    if (ch === 'p') {
      game.killEnemy(e, { reward: false });
      continue;
    }
    standOn(game, e, ch, spikesUp, cycle, () => game.damageEnemy(e, SPIKE_DAMAGE, null));
  }
}

function standOn(game, ent, ch, spikesUp, cycle, hurt) {
  if (ch === 's' && spikesUp && ent.spikeCycle !== cycle) {
    ent.spikeCycle = cycle;
    hurt();
  } else if (ch === 'x') {
    const idx = tiles.tileIndex(game.room, ent.x, ent.y);
    if (!game.cracking.has(idx) && !game.broken.has(idx)) game.cracking.set(idx, game.time + CRACK_TIME);
  } else if (ch === 'u') {
    game.applySlow(ent, 'puddle', PUDDLE_SLOW, 0.1);
  }
}

module.exports = { updateHazards, spikeState, tileUnder };
