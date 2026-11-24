// Ashmaw, the Ember Dragon: the final boss on the Dragon's Roost.
//   Fire Breath: rears back while its throat glows for 1.5 s, then breathes a
//                cone of fire (35 damage + burning).
//   Wing Gust:   flaps twice (1 s), then blows every player 4 tiles away,
//                toward the lava.
//   Tail Swipe:  if anyone stands behind it, the tail glows, then it swipes
//                a half circle behind itself (25 damage).
//   Meteor Rain: flies up out of reach; red circles mark the floor for 1.5 s,
//                then fireballs land in them (30 damage).
//   Phase 2 (60% HP): it stays in the sky, where only ranged attacks reach it.
//                After each Meteor Rain it lands, stunned for 3 s.
//   Phase 3 (25% HP): the outer rings of the island crumble, one every 15 s.
//   Rage (50% HP): roars, calls 2 Skitterbats (and 2 more every 20 s, up to 4),
//                attacks come faster and with shorter warnings, more meteors.
// The full Hollow Crown set cuts its fire damage by 40%.
const tiles = require('../shared/tiles');
const forge = require('./forge');
const { dist, pickTarget, walkToward, contactDamage } = require('./ai');
const { angleDiff } = require('./heroes');

const EPS = 1e-6;
const T = tiles.TILE;
const DEG = Math.PI / 180;

const FIRST_ATTACK = 2;
const ATTACK_GAP = 2.5;          // rest between attacks
const GROUND_ORDER = ['breath', 'gust', 'breath', 'meteor'];
const SKY_ORDER = ['breath', 'meteor'];
const KEEP_DISTANCE = 100;

const BREATH_TELL = 1.5;
const BREATH_RANGE = 280;
const BREATH_SPREAD = 70 * DEG;
const BREATH_DAMAGE = 35;
const GUST_TELL = 1;
const GUST_PUSH = 192;           // 4 tiles
const TAIL_FIRST = 3;
const TAIL_EVERY = 5;
const TAIL_TELL = 0.8;
const TAIL_RANGE = 110;
const TAIL_DAMAGE = 25;
const METEOR_TELL = 1.5;
const METEOR_RADIUS = 48;
const METEOR_DAMAGE = 30;
const METEOR_EXTRA = 3;          // marks on random tiles, besides one on each player
const LANDED_STUN = 3;
const PHASE2 = 0.6;
const PHASE3 = 0.25;
const CRUMBLE_EVERY = 15;
const CROWN_FIRE = 0.6;          // Hollow Crown set: dragon fire −40%
const RAGE = 0.5;
const RAGE_GAP = 1.5;            // rest between attacks while raging
const RAGE_TELL = 0.7;           // warnings are 30% shorter while raging
const RAGE_METEORS = 3;          // extra meteor marks while raging
const RAGE_SUMMON_EVERY = 20;
const RAGE_BATS = 2;
const MAX_BATS = 4;

const fireDamage = (game, p, amount) => Math.round(amount * (game.crownSet(p) ? CROWN_FIRE : 1));

function updateDragon(game, e, dt) {
  if (e.timers.attack === undefined) e.timers.attack = game.time + FIRST_ATTACK;
  if (e.timers.tail === undefined) e.timers.tail = game.time + TAIL_FIRST;
  e.attackIdx = e.attackIdx || 0;
  e.skyIdx = e.skyIdx || 0;

  phases(game, e);

  if (e.state === 'breathe') { if (game.time >= e.stateUntil - EPS) breath(game, e); return; }
  if (e.state === 'flap') { if (game.time >= e.stateUntil - EPS) gust(game, e); return; }
  if (e.state === 'tail') { if (game.time >= e.stateUntil - EPS) tailSwipe(game, e); return; }
  if (e.state === 'fly') { if (game.time >= e.stateUntil - EPS) meteors(game, e); return; }

  const target = pickTarget(game, e);
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);

  if (!e.sky && game.time >= e.timers.tail - EPS) {
    const behind = game.alivePlayers().some((p) => dist(p, e) <= TAIL_RANGE + p.r && isBehind(e, p));
    if (behind) {
      e.state = 'tail';
      e.stateUntil = game.time + tell(e, TAIL_TELL);
      e.timers.tail = game.time + TAIL_EVERY;
      return;
    }
  }

  if (game.time >= e.timers.attack - EPS) {
    const next = e.sky ? SKY_ORDER[e.skyIdx++ % SKY_ORDER.length] : GROUND_ORDER[e.attackIdx++ % GROUND_ORDER.length];
    if (next === 'breath') startBreath(game, e);
    else if (next === 'gust') startGust(game, e);
    else startMeteors(game, e);
    return;
  }

  e.state = 'walk';
  if (dist(e, target) > KEEP_DISTANCE) walkToward(game, e, target, dt);
  if (!e.sky) contactDamage(game, e);
}

function isBehind(e, p) {
  return angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.facing) > Math.PI / 2;
}

function phases(game, e) {
  // Back in the air once the landing stun wears off.
  if (e.p2 && !e.sky && e.state !== 'fly' && e.landedUntil !== undefined && game.time >= e.landedUntil - EPS) {
    e.landedUntil = undefined;
    takeOff(game, e);
  }
  if (!e.p2 && e.hp <= e.maxHp * PHASE2) {
    e.p2 = true;
    takeOff(game, e);
  }
  if (!e.p3 && e.hp <= e.maxHp * PHASE3) {
    e.p3 = true;
    forge.crumbleRing(game);
    e.timers.crumble = game.time + CRUMBLE_EVERY;
    game.event({ type: 'roostcrumble' });
  }
  if (!e.rage && e.hp <= e.maxHp * RAGE) {
    e.rage = true;
    game.event({ type: 'rage', x: Math.round(e.x), y: Math.round(e.y) });
    summonBats(game, e);
  }
  if (e.rage && game.time >= e.timers.summon - EPS) summonBats(game, e);
  if (e.p3 && game.time >= e.timers.crumble - EPS) {
    forge.crumbleRing(game);
    e.timers.crumble = game.time + CRUMBLE_EVERY;
  }
}

// Calls Skitterbats to help (no reward for them), never more than MAX_BATS at once.
function summonBats(game, e) {
  e.timers.summon = game.time + RAGE_SUMMON_EVERY;
  const alive = game.enemies.filter((m) => m.type === 'bat').length;
  const n = Math.min(RAGE_BATS, MAX_BATS - alive);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    game.spawnEnemy('bat', e.x + side * 70, e.y - 40, { noReward: true }).summonedBy = e.id;
  }
  if (n > 0) game.event({ type: 'screech', x: Math.round(e.x), y: Math.round(e.y) });
}

const tell = (e, seconds) => seconds * (e.rage ? RAGE_TELL : 1);

function takeOff(game, e) {
  e.sky = true;
  game.event({ type: 'takeoff', x: Math.round(e.x), y: Math.round(e.y) });
}

function done(game, e) {
  e.state = 'walk';
  e.timers.attack = game.time + (e.rage ? RAGE_GAP : ATTACK_GAP);
}

// ---------- Fire Breath ----------

function startBreath(game, e) {
  e.state = 'breathe';
  e.stateUntil = game.time + tell(e, BREATH_TELL);
  e.breathAim = e.facing;
  game.addZone({ kind: 'breathWarn', x: e.x, y: e.y, r: BREATH_RANGE, aim: e.breathAim, spread: BREATH_SPREAD, until: e.stateUntil });
}

function breath(game, e) {
  for (const p of game.alivePlayers()) {
    if (dist(p, e) > BREATH_RANGE + p.r) continue;
    if (angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.breathAim) > BREATH_SPREAD / 2) continue;
    if (game.damagePlayer(p, fireDamage(game, p, game.monsterDamage(BREATH_DAMAGE)), 'dragonfire') > 0) game.burnPlayer(p);
  }
  game.event({ type: 'breath', x: Math.round(e.x), y: Math.round(e.y), aim: Math.round(e.breathAim * 100) / 100, r: BREATH_RANGE });
  done(game, e);
}

// ---------- Wing Gust ----------

function startGust(game, e) {
  e.state = 'flap';
  e.stateUntil = game.time + tell(e, GUST_TELL);
  game.event({ type: 'flapwarn', x: Math.round(e.x), y: Math.round(e.y) });
}

function gust(game, e) {
  for (const p of game.alivePlayers()) {
    const d = dist(p, e) || 1;
    const push = GUST_PUSH * (p.heroClass === 'warden' ? 0.5 : 1); // Thick Skin: half as far
    // Walls stop you; lava doesn't.
    const pos = tiles.moveWithCollision(game.room, p.x, p.y, ((p.x - e.x) / d) * push, ((p.y - e.y) / d) * push, p.r, { doorOpen: game.doorOpen });
    p.x = pos.x;
    p.y = pos.y;
    p.roll = null;
  }
  game.event({ type: 'gust', x: Math.round(e.x), y: Math.round(e.y) });
  done(game, e);
}

// ---------- Tail Swipe ----------

function tailSwipe(game, e) {
  for (const p of game.alivePlayers()) {
    if (dist(p, e) <= TAIL_RANGE + p.r && isBehind(e, p)) game.damagePlayer(p, game.monsterDamage(TAIL_DAMAGE), e);
  }
  game.event({ type: 'tail', x: Math.round(e.x), y: Math.round(e.y), aim: Math.round((e.facing + Math.PI) * 100) / 100 });
  e.state = 'walk';
}

// ---------- Meteor Rain ----------

function standingSpots(game) {
  const out = [];
  game.room.grid.forEach((row, ty) => row.forEach((ch, tx) => {
    const x = tx * T + T / 2;
    const y = ty * T + T / 2;
    if ((ch === 'f' || ch === 'r') && !forge.isLava(game, x, y)) out.push({ x, y });
  }));
  return out;
}

function startMeteors(game, e) {
  e.state = 'fly';
  e.invulnerable = true;
  e.stateUntil = game.time + tell(e, METEOR_TELL);
  e.takeoffFrom = { x: e.x, y: e.y };
  e.marks = game.alivePlayers().map((p) => ({ x: p.x, y: p.y }));
  const spots = standingSpots(game);
  for (let i = 0; i < METEOR_EXTRA + (e.rage ? RAGE_METEORS : 0) && spots.length; i++) e.marks.push(spots.splice(Math.floor(game.rng() * spots.length), 1)[0]);
  for (const m of e.marks) game.addZone({ kind: 'meteorMark', x: m.x, y: m.y, r: METEOR_RADIUS, until: e.stateUntil });
  game.event({ type: 'meteorwarn', x: Math.round(e.x), y: Math.round(e.y) });
}

function meteors(game, e) {
  for (const p of game.alivePlayers()) {
    if (e.marks.some((m) => dist(p, m) <= METEOR_RADIUS)) game.damagePlayer(p, fireDamage(game, p, game.monsterDamage(METEOR_DAMAGE)), 'meteor');
  }
  game.event({ type: 'meteor', marks: e.marks.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y) })) });
  // Land in the middle of the island (or where it took off).
  const to = game.core ? forge.respawnPoint(game) : e.takeoffFrom;
  e.x = to.x;
  e.y = to.y;
  e.invulnerable = false;
  done(game, e);
  if (e.p2) {
    e.sky = false;
    e.stunUntil = game.time + LANDED_STUN;
    e.landedUntil = game.time + LANDED_STUN;
    e.timers.attack = game.time + LANDED_STUN + ATTACK_GAP;
    game.event({ type: 'landed', x: Math.round(e.x), y: Math.round(e.y) });
  }
}

module.exports = { updateDragon, phases };
