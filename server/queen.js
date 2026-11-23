// The Spore Queen, Floor 2's boss. She doesn't walk; she teleports.
//   Teleport: shimmers for 0.6 s (can't be hit), then reappears far from players.
//   Spore Storm: 3 safe circles glow for 2 s, then spores hit everyone outside them.
//   Vine Grab: a ring appears under a player; 1 s later vines hold them for 1.5 s.
//   Royal Guard: grows 2 Sporecaps next to her.
//   At half HP the whole lair goes dark.
const tiles = require('../shared/tiles');
const { dist, contactDamage, moveEnemy } = require('./ai');
const { MAX_PER_ROOM } = require('./sporecap');

const EPS = 1e-6;
const T = tiles.TILE;
const TIMERS = { teleport: [8, 8], storm: [6, 14], vine: [3, 7], guard: [10, 15] }; // [first, every]
const SHIMMER = 0.6;
const TELEPORT_MIN = 4 * T;
const STORM_TELL = 2;
const SAFE_RADIUS = 64;
const STORM_DAMAGE = 15;
const VINE_TELL = 1;
const VINE_RADIUS = 40;
const VINE_DAMAGE = 6;
const ROOT_TIME = 1.5;

// Centers of every plain floor tile in the room.
function floorSpots(game) {
  const out = [];
  game.room.grid.forEach((row, ty) => row.forEach((ch, tx) => {
    if (ch === 'f') out.push({ x: tx * T + T / 2, y: ty * T + T / 2 });
  }));
  return out;
}

function updateQueen(game, e, dt) {
  for (const [k, [first]] of Object.entries(TIMERS)) if (e.timers[k] === undefined) e.timers[k] = game.time + first;
  e.vines = e.vines || [];
  landVines(game, e);

  if (e.state === 'shimmer') {
    if (game.time >= e.stateUntil - EPS) teleport(game, e);
    return;
  }
  if (e.state === 'storm' && game.time >= e.stateUntil - EPS) releaseStorm(game, e);

  if (!game.allDark && e.hp <= e.maxHp / 2) {
    game.allDark = true;
    game.event({ type: 'darkness' });
  }
  contactDamage(game, e);

  const ready = (k) => game.time >= e.timers[k] - EPS;
  const again = (k) => { e.timers[k] = game.time + TIMERS[k][1]; };

  if (ready('vine')) {
    again('vine');
    const alive = game.alivePlayers();
    if (alive.length) {
      const p = alive[Math.floor(game.rng() * alive.length)];
      game.addZone({ kind: 'vineRing', x: p.x, y: p.y, r: VINE_RADIUS, until: game.time + VINE_TELL });
      e.vines.push({ x: p.x, y: p.y, at: game.time + VINE_TELL });
    }
  }
  if (ready('guard')) {
    again('guard');
    for (const off of [-1, 1]) {
      const crowd = game.enemies.filter((o) => o.type === 'sporecap' || o.type === 'seed').length;
      if (crowd >= MAX_PER_ROOM) break; // same limit as seeds: never more than 6
      const cap = game.spawnEnemy('sporecap', e.x, e.y, { noReward: true });
      moveEnemy(game, cap, off * (e.r + 30), 0);
    }
    game.event({ type: 'guard', x: Math.round(e.x), y: Math.round(e.y) });
  }
  if (e.state !== 'storm' && ready('storm')) {
    again('storm');
    startStorm(game, e);
    return;
  }
  if (e.state !== 'storm' && ready('teleport')) {
    again('teleport');
    e.state = 'shimmer';
    e.invulnerable = true;
    e.stateUntil = game.time + SHIMMER;
  }
}

function teleport(game, e) {
  const players = game.alivePlayers();
  const spots = floorSpots(game).filter((s) => players.every((p) => dist(p, s) >= TELEPORT_MIN));
  if (spots.length) {
    const s = spots[Math.floor(game.rng() * spots.length)];
    e.x = s.x;
    e.y = s.y;
  }
  e.invulnerable = false;
  e.state = 'idle';
  game.event({ type: 'teleport', x: Math.round(e.x), y: Math.round(e.y) });
}

function startStorm(game, e) {
  let spots = floorSpots(game);
  e.safeCircles = [];
  for (let i = 0; i < 3 && spots.length; i++) {
    const s = spots[Math.floor(game.rng() * spots.length)];
    game.addZone({ kind: 'safeCircle', x: s.x, y: s.y, r: SAFE_RADIUS, until: game.time + STORM_TELL });
    e.safeCircles.push({ x: s.x, y: s.y, r: SAFE_RADIUS });
    spots = spots.filter((o) => dist(o, s) > SAFE_RADIUS * 2.5); // keep the circles apart
  }
  e.state = 'storm';
  e.stateUntil = game.time + STORM_TELL;
  game.event({ type: 'stormwarn', x: Math.round(e.x), y: Math.round(e.y) });
}

// Spores hit everyone outside the circles. It counts as poison, so the
// Cellar Guard set halves it.
function releaseStorm(game, e) {
  const circles = e.safeCircles || [];
  for (const p of game.alivePlayers()) {
    if (circles.some((c) => dist(p, c) <= c.r)) continue;
    const dmg = Math.round(STORM_DAMAGE * (1 - game.playerPoisonResist(p)));
    game.damagePlayer(p, dmg, 'spores', { ignoreDefense: true });
  }
  e.state = 'idle';
  game.event({ type: 'storm', x: Math.round(e.x), y: Math.round(e.y) });
}

function landVines(game, e) {
  for (const v of e.vines.slice()) {
    if (game.time < v.at - EPS) continue;
    e.vines.splice(e.vines.indexOf(v), 1);
    for (const p of game.alivePlayers()) {
      if (dist(p, v) > VINE_RADIUS) continue;
      game.damagePlayer(p, VINE_DAMAGE, 'vines');
      p.rootUntil = game.time + ROOT_TIME;
      game.event({ type: 'rooted', targetId: p.id, x: Math.round(p.x), y: Math.round(p.y) });
    }
  }
}

module.exports = { updateQueen };
