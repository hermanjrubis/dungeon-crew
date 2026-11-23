// Monster AI for Floor 1: Gloop, Mini Gloop and Skitterbat.
// Every attack has a "tell" state (squish, screech) so players can react.
const boss = require('./boss');
const { dist, pickTarget, moveEnemy, walkToward, contactDamage } = require('./ai');

const EPS = 1e-6;

// Gloop numbers
const BOUNCE_EVERY = 4;
const BOUNCE_RANGE = 192; // 4 tiles
const SQUISH_TIME = 1;
const LEAP_TIME = 0.4;
const LEAP_MAX = 144;     // 3 tiles
const LANDING_RADIUS = 30;

// Skitterbat numbers
const SWOOP_EVERY = 3;
const SWOOP_SPEED = 380;
const SWOOP_TIME = 0.5;
const RETREAT_TIME = 2;
const SCREECH_EVERY = 8;
const SCREECH_TELL = 0.6;
const SCREECH_RANGE = 144;
const SCREECH_SLOW = 0.3;
const SCREECH_SLOW_TIME = 2;
const HOVER_DISTANCE = 192;

// ---------- Gloop and Mini Gloop ----------

function updateGloop(game, e, dt) {
  if (e.state === 'squish') {
    if (game.time >= e.stateUntil - EPS) startLeap(game, e);
    else contactDamage(game, e);
    return;
  }
  if (e.state === 'leap') {
    leap(game, e);
    return;
  }
  const target = pickTarget(game, e);
  if (!target) { e.state = 'idle'; return; }
  const ready = game.time >= (e.timers.bounce || 0) - EPS;
  if (e.type === 'gloop' && ready && dist(e, target) <= BOUNCE_RANGE) {
    e.state = 'squish';
    e.stateUntil = game.time + SQUISH_TIME;
    e.targetId = target.id;
    return;
  }
  e.state = 'walk';
  walkToward(game, e, target, dt);
  contactDamage(game, e);
}

function startLeap(game, e) {
  const target = game.players.get(e.targetId);
  let to = target && !target.downed ? { x: target.x, y: target.y } : { x: e.x, y: e.y };
  const d = dist(e, to);
  if (d > LEAP_MAX) to = { x: e.x + ((to.x - e.x) / d) * LEAP_MAX, y: e.y + ((to.y - e.y) / d) * LEAP_MAX };
  e.state = 'leap';
  e.leap = { fromX: e.x, fromY: e.y, toX: to.x, toY: to.y, start: game.time };
  e.stateUntil = game.time + LEAP_TIME;
}

function leap(game, e) {
  const l = e.leap;
  const t = Math.min(1, (game.time - l.start) / LEAP_TIME);
  const nx = l.fromX + (l.toX - l.fromX) * t;
  const ny = l.fromY + (l.toY - l.fromY) * t;
  moveEnemy(game, e, nx - e.x, ny - e.y);
  if (t >= 1 - EPS) {
    for (const p of game.alivePlayers()) {
      if (dist(p, e) <= LANDING_RADIUS + p.r) game.damagePlayer(p, e.dmg, e);
    }
    e.state = 'walk';
    e.leap = null;
    e.timers.bounce = game.time + BOUNCE_EVERY;
  }
}

// ---------- Skitterbat ----------

function updateBat(game, e, dt) {
  if (e.timers.swoop === undefined) e.timers.swoop = game.time + 1.5;
  if (e.timers.screech === undefined) e.timers.screech = game.time + 4;
  const target = pickTarget(game, e);

  if (e.state === 'screech') {
    if (game.time >= e.stateUntil - EPS) {
      for (const p of game.alivePlayers()) {
        if (dist(p, e) <= SCREECH_RANGE) game.applySlow(p, 'screech', SCREECH_SLOW, SCREECH_SLOW_TIME);
      }
      e.state = 'hover';
    }
    return;
  }

  if (e.state === 'swoop') {
    const step = SWOOP_SPEED * dt;
    moveEnemy(game, e, e.swoopDir.x * step, e.swoopDir.y * step);
    const bitten = game.alivePlayers().find((p) => dist(p, e) <= p.r + e.r);
    if (bitten) game.damagePlayer(bitten, e.dmg, e);
    if (bitten || game.time >= e.stateUntil - EPS) {
      e.state = 'retreat';
      e.stateUntil = game.time + RETREAT_TIME;
    }
    return;
  }

  if (e.state === 'retreat') {
    if (target) {
      const away = { x: e.x * 2 - target.x, y: e.y * 2 - target.y };
      walkToward(game, e, away, dt);
    }
    if (game.time >= e.stateUntil - EPS) e.state = 'hover';
    return;
  }

  e.state = 'hover';
  if (!target) return;
  const d = dist(e, target);
  if (game.time >= e.timers.screech - EPS && d <= SCREECH_RANGE) {
    e.state = 'screech';
    e.stateUntil = game.time + SCREECH_TELL;
    e.timers.screech = game.time + SCREECH_EVERY;
    return;
  }
  if (game.time >= e.timers.swoop - EPS) {
    e.state = 'swoop';
    e.swoopDir = { x: (target.x - e.x) / (d || 1), y: (target.y - e.y) / (d || 1) };
    e.stateUntil = game.time + SWOOP_TIME;
    e.timers.swoop = game.time + SWOOP_EVERY;
    return;
  }
  // Circle around the target at a safe distance.
  if (d > HOVER_DISTANCE + 20) walkToward(game, e, target, dt);
  else if (d < HOVER_DISTANCE - 20) walkToward(game, e, { x: e.x * 2 - target.x, y: e.y * 2 - target.y }, dt);
  else {
    const side = { x: e.x - (target.y - e.y) * 0.5, y: e.y + (target.x - e.x) * 0.5 };
    walkToward(game, e, side, dt, e.speed * 0.5);
  }
}

// ---------- dispatch ----------

function updateEnemy(game, e, dt) {
  if (game.time < e.stunUntil) return;
  if (e.type === 'gloop' || e.type === 'minigloop') updateGloop(game, e, dt);
  else if (e.type === 'bat') updateBat(game, e, dt);
  else if (e.boss) boss.updateBoss(game, e, dt);
}

// A Gloop killed by a player splits into two Mini Gloops.
// (Gloops that fall into pits or came from the boss's Brood don't split.)
function onEnemyDeath(game, e, { reward }) {
  if (e.type === 'gloop' && reward && !e.noReward) {
    for (const off of [-12, 12]) {
      const mini = game.spawnEnemy('minigloop', e.x, e.y);
      moveEnemy(game, mini, off, 0);
    }
  }
  if (e.boss) boss.onBossDeath(game, e, { reward });
}

module.exports = { updateEnemy, onEnemyDeath, pickTarget, contactDamage, walkToward, moveEnemy };
