// The Hollow King, Floor 3's boss.
//   Royal Sweep: raises his sword for 1 s, then slashes a wide arc in front.
//   Summon Court: calls 3 Gloops in from the room's corners (no gold).
//   Phase 2 (half HP): his crown flares, he moves faster, and he adds
//   Shadow Ring: glows for 1.5 s, then fires 12 bolts outward.
const tiles = require('../shared/tiles');
const { dist, pickTarget, walkToward, contactDamage } = require('./ai');
const { angleDiff } = require('./heroes');

const EPS = 1e-6;
const T = tiles.TILE;
const SWEEP_FIRST = 2;
const SWEEP_EVERY = 4;
const SWEEP_TELL = 1;
const SWEEP_RANGE = 110;
const SWEEP_ARC = 140 * Math.PI / 180;
const COURT_FIRST = 8;
const COURT_EVERY = 20;
const PHASE2_SPEED = 1.4;
const RING_FIRST = 1;      // seconds after the crown flares
const RING_EVERY = 6;
const RING_TELL = 1.5;
const RING_BOLTS = 12;
const BOLT_SPEED = 260;
const BOLT_LIFE = 3;
const BOLT_DAMAGE = 15;

function updateKing(game, e, dt) {
  if (e.timers.sweep === undefined) e.timers.sweep = game.time + SWEEP_FIRST;
  if (e.timers.court === undefined) e.timers.court = game.time + COURT_FIRST;

  if (!e.phase2 && e.hp <= e.maxHp / 2) {
    e.phase2 = true;
    e.speed *= PHASE2_SPEED;
    e.timers.ring = game.time + RING_FIRST;
    game.event({ type: 'crownflare', x: Math.round(e.x), y: Math.round(e.y) });
  }

  if (game.time >= e.timers.court - EPS) {
    e.timers.court = game.time + COURT_EVERY;
    summonCourt(game, e);
  }

  if (e.state === 'raise') {
    if (game.time >= e.stateUntil - EPS) sweep(game, e);
    return;
  }
  if (e.state === 'ring') {
    if (game.time >= e.stateUntil - EPS) shadowRing(game, e);
    return;
  }

  const target = pickTarget(game, e);
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  if (e.phase2 && game.time >= e.timers.ring - EPS) {
    e.state = 'ring';
    e.stateUntil = game.time + RING_TELL;
    e.timers.ring = game.time + RING_TELL + RING_EVERY;
    game.event({ type: 'ringwarn', x: Math.round(e.x), y: Math.round(e.y) });
    return;
  }
  if (game.time >= e.timers.sweep - EPS && dist(e, target) <= SWEEP_RANGE + target.r) {
    e.state = 'raise';
    e.stateUntil = game.time + SWEEP_TELL;
    e.sweepAim = e.facing;
    return;
  }
  e.state = 'walk';
  walkToward(game, e, target, dt);
  contactDamage(game, e);
}

function sweep(game, e) {
  for (const p of game.alivePlayers()) {
    if (dist(p, e) > SWEEP_RANGE + p.r) continue;
    if (angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.sweepAim) > SWEEP_ARC / 2) continue;
    game.damagePlayer(p, e.dmg, e);
  }
  game.event({ type: 'sweep', x: Math.round(e.x), y: Math.round(e.y), aim: Math.round(e.sweepAim * 100) / 100 });
  e.state = 'walk';
  e.timers.sweep = game.time + SWEEP_EVERY;
}

// Three Gloops come in from the corners farthest from the King.
function summonCourt(game, e) {
  const { w, h } = game.room;
  const corners = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]
    .map(([tx, ty]) => ({ x: tx * T + T / 2, y: ty * T + T / 2 }))
    .filter((c) => !tiles.isSolid(tiles.tileAt(game.room, c.x, c.y), {}) && tiles.tileAt(game.room, c.x, c.y) !== 'l')
    .sort((a, b) => dist(b, e) - dist(a, e))
    .slice(0, 3);
  for (const c of corners) game.spawnEnemy('gloop', c.x, c.y, { noReward: true });
  game.event({ type: 'court', x: Math.round(e.x), y: Math.round(e.y), at: corners.map((c) => ({ x: c.x, y: c.y })) });
}

function shadowRing(game, e) {
  for (let i = 0; i < RING_BOLTS; i++) {
    const a = (i / RING_BOLTS) * Math.PI * 2;
    game.addProjectile({
      kind: 'shadowBolt', hostile: true, x: e.x, y: e.y, r: 8, dmg: BOLT_DAMAGE,
      vx: Math.cos(a) * BOLT_SPEED, vy: Math.sin(a) * BOLT_SPEED, until: game.time + BOLT_LIFE
    });
  }
  game.event({ type: 'shadowring', x: Math.round(e.x), y: Math.round(e.y) });
  e.state = 'walk';
}

module.exports = { updateKing };
