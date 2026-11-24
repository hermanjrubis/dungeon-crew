// Floor 6, the Crystal Wastes.
//   Crystal Crawler: chases and pinches. When hit it hides in its shell for 1.8 s
//                    (takes 80% less damage), at most once every 5 s.
//   Shard Wisp:      floats 3-6 tiles away; every 3 s it glows (0.8 s), then
//                    fires a fan of 3 crystal shards.
//   Prismaurus (final boss):
//     Stomp:  someone close? lifts a foot (0.9 s) and stamps: a shockwave around it.
//     Tail:   someone behind it? swings its tail (0.6 s) to hit everyone behind.
//     Beam:   every 9 s (6 s when hurt) its spines charge for 1.6 s while a line
//             shows where it aims, then the prism beam sweeps for 1.4 s.
//     Roar:   at 2/3 and 1/3 HP: slows everyone nearby by half for 2.5 s and
//             calls 2 Shard Wisps (no reward; never more than 4).
//   The Prismguard set cuts beam and shard damage by 40% and ignores the roar.
const tiles = require('../shared/tiles');
const { dist, pickTarget, walkToward, contactDamage } = require('./ai');

const EPS = 1e-6;

// ---------- Crystal Crawler ----------
const SHELL_TIME = 1.8;
const SHELL_EVERY = 5;
const SHELL_ARMOR = 0.2;

// ---------- Shard Wisp ----------
const WISP_CLOSE = 160;
const WISP_FAR = 300;
const WISP_FIRST = 1.5;
const WISP_EVERY = 3;
const WISP_TELL = 0.8;
const SHARD_SPEED = 380;
const SHARD_LIFE = 1.4;
const SHARD_FAN = 0.14;

// ---------- Prismaurus ----------
const STOMP_RANGE = 170;
const STOMP_TELL = 0.9;
const STOMP_EVERY = 5;
const STOMP_RADIUS = 170;
const TAIL_RANGE = 160;
const TAIL_TELL = 0.6;
const TAIL_EVERY = 6;
const BEAM_FIRST = 5;
const BEAM_EVERY = [9, 6];
const CHARGE_TIME = 1.6;
const BEAM_TIME = 1.4;
const BEAM_LENGTH = 720;
const BEAM_WIDTH = 30;
const BEAM_SWEEP = 0.5;        // radians it sweeps across while firing
const BEAM_TICK = 0.1;
const BEAM_PER_TICK = 0.35;    // of its damage, every tick
const ROAR_AT = [0.66, 0.33];
const ROAR_TIME = 1.2;
const ROAR_RADIUS = 260;
const ROAR_SLOW = 0.5;
const ROAR_SLOW_TIME = 2.5;
const ROAR_WISPS = 2;
const MAX_WISPS = 4;
const HURT = 0.5;              // below half HP the beam comes more often
const GUARD = 0.6;             // Prismguard set: beam and shards −40%

// ---------- Crawler ----------

function updateCrawler(game, e, dt) {
  if (e.state === 'shell') {
    if (game.time >= e.stateUntil - EPS) e.state = 'idle';
    return;
  }
  const target = pickTarget(game, e);
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  e.state = 'walk';
  walkToward(game, e, target, dt);
  contactDamage(game, e);
}

// Called after a crawler takes a hit: it ducks into its shell.
function crawlerHit(game, e) {
  if (e.state === 'shell' || game.time < (e.timers.shell || 0) - EPS || e.hp <= 0) return;
  e.state = 'shell';
  e.stateUntil = game.time + SHELL_TIME;
  e.timers.shell = game.time + SHELL_EVERY;
}

const armorOf = (e) => (e.type === 'crawler' && e.state === 'shell' ? SHELL_ARMOR : 1);

// ---------- Wisp ----------

function updateWisp(game, e, dt) {
  if (e.timers.shoot === undefined) e.timers.shoot = game.time + WISP_FIRST;
  const target = pickTarget(game, e);
  if (e.state === 'aim') {
    if (game.time >= e.stateUntil - EPS) {
      const aim = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing || 0;
      for (const off of [-SHARD_FAN, 0, SHARD_FAN]) {
        game.addProjectile({
          kind: 'shard', hostile: true, x: e.x, y: e.y, r: 6, dmg: e.dmg, prismatic: true,
          vx: Math.cos(aim + off) * SHARD_SPEED, vy: Math.sin(aim + off) * SHARD_SPEED, until: game.time + SHARD_LIFE
        });
      }
      game.event({ type: 'shards', enemyId: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      e.state = 'hover';
      e.timers.shoot = game.time + WISP_EVERY;
    }
    return;
  }
  if (!target) { e.state = 'hover'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  if (game.time >= e.timers.shoot - EPS) {
    e.state = 'aim';
    e.stateUntil = game.time + WISP_TELL;
    return;
  }
  const d = dist(e, target);
  e.state = 'hover';
  if (e.angryUntil > game.time && d > WISP_CLOSE * 0.6) walkToward(game, e, target, dt);
  else if (d < WISP_CLOSE) walkToward(game, e, { x: e.x * 2 - target.x, y: e.y * 2 - target.y }, dt);
  else if (d > WISP_FAR) walkToward(game, e, target, dt);
}

// ---------- Prismaurus ----------

function updatePrism(game, e, dt) {
  if (e.timers.beam === undefined) {
    e.timers.beam = game.time + BEAM_FIRST;
    e.timers.stomp = game.time + 1;
    e.timers.tail = game.time + 2;
    e.roars = 0;
  }
  const target = pickTarget(game, e);
  const over = game.time >= e.stateUntil - EPS;

  if (e.state === 'stomp') {
    if (over) {
      for (const p of game.alivePlayers()) if (dist(p, e) <= STOMP_RADIUS + p.r * 0.5) game.damagePlayer(p, Math.round(e.dmg * 1.4), e);
      game.addZone({ kind: 'shockwave', x: e.x, y: e.y + e.r * 0.6, r: STOMP_RADIUS, until: game.time + 0.4 });
      game.event({ type: 'stomp', x: Math.round(e.x), y: Math.round(e.y), r: STOMP_RADIUS });
      e.state = 'idle';
      e.timers.stomp = game.time + STOMP_EVERY;
    }
    return;
  }
  if (e.state === 'tail') {
    if (over) {
      for (const p of game.alivePlayers()) if (dist(p, e) <= TAIL_RANGE + p.r && behind(e, p)) game.damagePlayer(p, Math.round(e.dmg * 1.2), e);
      game.event({ type: 'tail', x: Math.round(e.x), y: Math.round(e.y) });
      e.state = 'idle';
      e.timers.tail = game.time + TAIL_EVERY;
    }
    return;
  }
  if (e.state === 'roar') {
    if (over) e.state = 'idle';
    return;
  }
  if (e.state === 'charge') {
    // the aim follows its target until the last moment
    if (target && game.time < e.stateUntil - 0.4) e.beamAim = Math.atan2(target.y - e.y, target.x - e.x);
    const warn = game.zones.find((z) => z.kind === 'beamWarn' && z.ownerId === e.id);
    if (warn) { warn.aim = e.beamAim; warn.r = beamReach(game, e, e.beamAim); }
    if (over) {
      e.state = 'beam';
      e.stateUntil = game.time + BEAM_TIME;
      e.beamStart = e.beamAim - BEAM_SWEEP / 2 * e.sweepDir;
      e.timers.beamTick = game.time;
      game.event({ type: 'beam', x: Math.round(e.x), y: Math.round(e.y) });
    }
    return;
  }
  if (e.state === 'beam') {
    const k = Math.min(1, 1 - (e.stateUntil - game.time) / BEAM_TIME);
    e.beamAim = e.beamStart + BEAM_SWEEP * k * e.sweepDir;
    e.beamLength = beamReach(game, e, e.beamAim);
    let zone = game.zones.find((z) => z.kind === 'beam' && z.ownerId === e.id);
    if (!zone) zone = game.addZone({ kind: 'beam', ownerId: e.id, x: e.x, y: e.y, r: e.beamLength, width: BEAM_WIDTH, aim: e.beamAim, until: e.stateUntil });
    zone.aim = e.beamAim;
    zone.r = e.beamLength;
    while (e.timers.beamTick <= game.time + EPS) {
      e.timers.beamTick += BEAM_TICK;
      for (const p of game.alivePlayers()) {
        if (!inBeam(e, p)) continue;
        const dmg = Math.max(1, Math.round(e.dmg * BEAM_PER_TICK * (game.prismguardSet(p) ? GUARD : 1)));
        game.damagePlayer(p, dmg, 'beam', { ignoreInvuln: false, noFlinch: true });
      }
    }
    if (over) {
      e.state = 'idle';
      e.timers.beam = game.time + BEAM_EVERY[e.hp <= e.maxHp * HURT ? 1 : 0];
    }
    return;
  }

  // roar at 2/3 and 1/3 HP
  if (e.roars < ROAR_AT.length && e.hp <= e.maxHp * ROAR_AT[e.roars]) {
    e.roars++;
    roar(game, e);
    return;
  }
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  const d = dist(e, target);
  if (game.time >= e.timers.beam - EPS) {
    e.state = 'charge';
    e.stateUntil = game.time + CHARGE_TIME;
    e.beamAim = e.facing;
    e.sweepDir = game.rng() < 0.5 ? -1 : 1;
    game.addZone({ kind: 'beamWarn', ownerId: e.id, x: e.x, y: e.y, r: beamReach(game, e, e.beamAim), width: BEAM_WIDTH, aim: e.beamAim, until: e.stateUntil });
    game.event({ type: 'charge', x: Math.round(e.x), y: Math.round(e.y) });
    return;
  }
  const someoneBehind = game.alivePlayers().find((p) => dist(p, e) <= TAIL_RANGE && behind(e, p));
  if (someoneBehind && game.time >= e.timers.tail - EPS) {
    e.state = 'tail';
    e.stateUntil = game.time + TAIL_TELL;
    return;
  }
  if (d <= STOMP_RANGE && game.time >= e.timers.stomp - EPS) {
    e.state = 'stomp';
    e.stateUntil = game.time + STOMP_TELL;
    return;
  }
  e.state = 'walk';
  if (d > e.r + target.r + 10) walkToward(game, e, target, dt);
  contactDamage(game, e);
}

// Is player p behind Prismaurus (the side its tail is on)?
function behind(e, p) {
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  let diff = Math.abs(a - (e.facing || 0)) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff > Math.PI * 0.6;
}

// How far the beam reaches before it hits a wall or pillar.
function beamReach(game, e, aim) {
  const cx = Math.cos(aim), cy = Math.sin(aim);
  for (let d = e.r; d < BEAM_LENGTH; d += 8) {
    if (tiles.isSolid(tiles.tileAt(game.room, e.x + cx * d, e.y + cy * d), { doorOpen: true })) return d;
  }
  return BEAM_LENGTH;
}

// Is player p inside the beam (a long thin strip from Prismaurus along beamAim)?
function inBeam(e, p) {
  const cx = Math.cos(e.beamAim), cy = Math.sin(e.beamAim);
  const dx = p.x - e.x, dy = p.y - e.y;
  const along = dx * cx + dy * cy;
  const side = Math.abs(-dx * cy + dy * cx);
  return along > 0 && along <= (e.beamLength || BEAM_LENGTH) && side <= BEAM_WIDTH / 2 + p.r;
}

function roar(game, e) {
  e.state = 'roar';
  e.stateUntil = game.time + ROAR_TIME;
  for (const p of game.alivePlayers()) {
    if (dist(p, e) <= ROAR_RADIUS && !game.prismguardSet(p)) game.applySlow(p, 'roar', ROAR_SLOW, ROAR_SLOW_TIME);
  }
  const alive = game.enemies.filter((m) => m.type === 'wisp').length;
  const n = Math.min(ROAR_WISPS, MAX_WISPS - alive);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const w = game.spawnEnemy('wisp', e.x + side * 90, e.y - 60, { noReward: true });
    w.summonedBy = e.id;
  }
  game.event({ type: 'roar', x: Math.round(e.x), y: Math.round(e.y), r: ROAR_RADIUS });
}

module.exports = { updateCrawler, crawlerHit, armorOf, updateWisp, updatePrism, GUARD };
