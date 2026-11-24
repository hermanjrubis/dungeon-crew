// Floor 5, the Rot Warrens.
//   Rotgrub:   keeps 3-5 tiles away; every 3 s it rears up (0.7 s) and spits a
//              poison glob that leaves a poison puddle where it lands.
//   Acid Slug: crawls after you, leaving a trail of acid that poisons and slows.
//   Rot Hand:  claws up out of the ground (0.5 s, harmless), then grabs anyone
//              close: damage and held in place for 1 s (not with the Rotward set).
//   The Rothand Wyrm (boss):
//     Spit:   rears up (0.6 s), spits a fan of 3 poison globs (5 when wild).
//     Bite:   someone close? lunges (0.8 s warning) and bites the ground ahead.
//     Hands:  every 9 s (6 s when wild) Rot Hands claw up next to players (max 6).
//     Burrow: every 11 s (8 s when wild) it digs in and can't be hit, tunnels
//             toward a player, marks the spot for 1 s, then bursts out of it.
//     Wild (50% HP): roars; everything above comes faster.
const tiles = require('../shared/tiles');
const { dist, pickTarget, walkToward, contactDamage } = require('./ai');

const EPS = 1e-6;

// ---------- Rotgrub ----------
const GRUB_CLOSE = 140;
const GRUB_FAR = 260;
const GRUB_FIRST = 1.5;
const GRUB_EVERY = 3.2;
const GRUB_TELL = 0.7;
const GLOB_SPEED = 300;
const GLOB_LIFE = 1.6;
const PUDDLE = { r: 34, perSecond: 6, duration: 2.5 };

// ---------- Acid Slug ----------
const ACID_EVERY = 0.45;
const ACID = { r: 20, perSecond: 6, duration: 4, slow: 0.35 };

// ---------- Rot Hand ----------
const RISE_TIME = 0.5;
const GRAB_REACH = 44;
const GRAB_TELL = 0.45;
const GRAB_EVERY = 2.2;
const HOLD_TIME = 1;

// ---------- the Wyrm ----------
const SPIT_EVERY = [3.2, 2.2];
const SPIT_TELL = 0.6;
const SPIT_GLOBS = [3, 5];
const SPIT_FAN = 0.22;
const BITE_RANGE = 150;
const BITE_TELL = 0.8;
const BITE_EVERY = 4;
const BITE_REACH = 60;
const BITE_RADIUS = 100;
const HANDS_EVERY = [9, 6];
const HANDS_EACH = [2, 3];
const HANDS_MAX = 6;
const HAND_LIFE = 12;
const DIVE_FIRST = 6;
const DIVE_EVERY = [11, 8];
const BURROW_TIME = 0.6;
const UNDER_TIME = 2.5;
const WARN_TIME = 1;
const EMERGE_TIME = 0.5;
const ERUPT_RADIUS = 80;
const WILD = 0.5;

const phase = (e) => (e.p2 ? 1 : 0);

// A monster's poison glob: hurts whoever it hits and leaves a poison puddle.
function spitGlob(game, e, aim, dmg) {
  game.addProjectile({
    kind: 'poisonGlob', hostile: true, x: e.x, y: e.y, r: 9, dmg,
    vx: Math.cos(aim) * GLOB_SPEED, vy: Math.sin(aim) * GLOB_SPEED, until: game.time + GLOB_LIFE,
    splash: { r: PUDDLE.r, perSecond: game.monsterDamage(PUDDLE.perSecond), duration: PUDDLE.duration }
  });
}

function updateRotgrub(game, e, dt) {
  if (e.timers.spit === undefined) e.timers.spit = game.time + GRUB_FIRST;
  const target = pickTarget(game, e);
  if (e.state === 'spit') {
    if (game.time >= e.stateUntil - EPS) {
      const aim = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing || 0;
      spitGlob(game, e, aim, e.dmg);
      game.event({ type: 'spit', enemyId: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      e.state = 'idle';
      e.timers.spit = game.time + GRUB_EVERY;
    }
    return;
  }
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  if (game.time >= e.timers.spit - EPS) {
    e.state = 'spit';
    e.stateUntil = game.time + GRUB_TELL;
    return;
  }
  const d = dist(e, target);
  if (e.angryUntil > game.time && d > GRUB_CLOSE * 0.6) { e.state = 'walk'; walkToward(game, e, target, dt); }
  else if (d < GRUB_CLOSE) { e.state = 'walk'; walkToward(game, e, { x: e.x * 2 - target.x, y: e.y * 2 - target.y }, dt); }
  else if (d > GRUB_FAR) { e.state = 'walk'; walkToward(game, e, target, dt); }
  else e.state = 'idle';
  contactDamage(game, e);
}

function updateSlug(game, e, dt) {
  if (e.timers.acid === undefined) e.timers.acid = game.time + ACID_EVERY;
  const target = pickTarget(game, e);
  if (game.time >= e.timers.acid - EPS) {
    e.timers.acid = game.time + ACID_EVERY;
    game.addZone({ kind: 'acid', x: e.x, y: e.y + e.r * 0.4, r: ACID.r, perSecond: game.monsterDamage(ACID.perSecond), slow: ACID.slow, until: game.time + ACID.duration });
  }
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  e.state = 'walk';
  walkToward(game, e, target, dt);
  contactDamage(game, e);
}

// Called when a Rot Hand appears: it spends a moment clawing out of the ground.
function initHand(game, e) {
  e.state = 'rise';
  e.stateUntil = game.time + RISE_TIME;
  e.timers.grab = game.time + RISE_TIME;
}

function updateRotHand(game, e) {
  if (e.dieAt !== undefined && game.time >= e.dieAt - EPS) {
    game.killEnemy(e, { reward: false });
    return;
  }
  if (e.state === 'rise') {
    if (game.time >= e.stateUntil - EPS) e.state = 'idle';
    return;
  }
  if (e.state === 'grab') {
    if (game.time >= e.stateUntil - EPS) {
      for (const p of game.alivePlayers()) {
        if (dist(p, e) > GRAB_REACH + 6 + p.r) continue;
        game.damagePlayer(p, e.dmg, e);
        if (!game.rotwardSet(p)) p.rootUntil = game.time + HOLD_TIME;
        game.event({ type: 'grab', targetId: p.id, x: Math.round(p.x), y: Math.round(p.y) });
      }
      e.state = 'idle';
      e.timers.grab = game.time + GRAB_EVERY;
    }
    return;
  }
  const near = game.alivePlayers().some((p) => dist(p, e) <= GRAB_REACH + p.r);
  if (near && game.time >= e.timers.grab - EPS) {
    e.state = 'grab';
    e.stateUntil = game.time + GRAB_TELL;
    return;
  }
  e.state = 'idle';
}

// ---------- the Wyrm ----------

function updateWyrm(game, e, dt) {
  if (e.timers.spit === undefined) {
    e.timers.spit = game.time + 2;
    e.timers.bite = game.time;
    e.timers.hands = game.time + 4;
    e.timers.dive = game.time + DIVE_FIRST;
  }
  if (!e.p2 && e.hp <= e.maxHp * WILD) {
    e.p2 = true;
    game.event({ type: 'wyrmrage', x: Math.round(e.x), y: Math.round(e.y) });
    e.timers.hands = Math.min(e.timers.hands, game.time + 1);
  }
  if (e.state !== 'under' && e.state !== 'surfacing' && game.time >= e.timers.hands - EPS) callHands(game, e);

  const target = pickTarget(game, e);
  const busyUntil = game.time >= e.stateUntil - EPS;

  if (e.state === 'spit') {
    if (busyUntil) {
      const aim = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing || 0;
      const n = SPIT_GLOBS[phase(e)];
      for (let i = 0; i < n; i++) spitGlob(game, e, aim + (i - (n - 1) / 2) * SPIT_FAN, Math.round(e.dmg * 0.6));
      game.event({ type: 'spit', enemyId: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      e.state = 'idle';
      e.timers.spit = game.time + SPIT_EVERY[phase(e)];
    }
    return;
  }
  if (e.state === 'slam') {
    if (busyUntil) {
      const at = { x: e.x + Math.cos(e.facing) * BITE_REACH, y: e.y + Math.sin(e.facing) * BITE_REACH };
      for (const p of game.alivePlayers()) if (dist(p, at) <= BITE_RADIUS + p.r * 0.5) game.damagePlayer(p, Math.round(e.dmg * 1.5), e);
      game.event({ type: 'slam', x: Math.round(at.x), y: Math.round(at.y), r: BITE_RADIUS });
      e.state = 'idle';
      e.timers.bite = game.time + BITE_EVERY;
    }
    return;
  }
  if (e.state === 'burrow') {
    if (busyUntil) {
      e.state = 'under';
      e.stateUntil = game.time + UNDER_TIME;
    }
    return;
  }
  if (e.state === 'under') {
    if (target) walkToward(game, e, target, dt);
    if (busyUntil) {
      e.state = 'surfacing';
      e.stateUntil = game.time + WARN_TIME;
      game.addZone({ kind: 'wyrmWarn', x: e.x, y: e.y, r: ERUPT_RADIUS, until: e.stateUntil });
    }
    return;
  }
  if (e.state === 'surfacing') {
    if (busyUntil) {
      e.state = 'emerge';
      e.stateUntil = game.time + EMERGE_TIME;
      e.invulnerable = false;
      for (const p of game.alivePlayers()) if (dist(p, e) <= ERUPT_RADIUS + p.r * 0.5) game.damagePlayer(p, Math.round(e.dmg * 1.6), e);
      game.event({ type: 'wyrmerupt', x: Math.round(e.x), y: Math.round(e.y), r: ERUPT_RADIUS });
    }
    return;
  }
  if (e.state === 'emerge') {
    if (busyUntil) e.state = 'idle';
    return;
  }

  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  if (game.time >= e.timers.dive - EPS) {
    e.state = 'burrow';
    e.stateUntil = game.time + BURROW_TIME;
    e.invulnerable = true;
    e.timers.dive = game.time + DIVE_EVERY[phase(e)];
    game.event({ type: 'wyrmburrow', x: Math.round(e.x), y: Math.round(e.y) });
    return;
  }
  if (dist(e, target) <= BITE_RANGE && game.time >= e.timers.bite - EPS) {
    e.state = 'slam';
    e.stateUntil = game.time + BITE_TELL;
    return;
  }
  if (game.time >= e.timers.spit - EPS) {
    e.state = 'spit';
    e.stateUntil = game.time + SPIT_TELL;
    return;
  }
  e.state = 'idle';
  contactDamage(game, e);
}

// Rot Hands claw up next to players (they give no reward and sink after a while).
function callHands(game, e) {
  e.timers.hands = game.time + HANDS_EVERY[phase(e)];
  const alive = game.enemies.filter((m) => m.type === 'rothand').length;
  const n = Math.min(HANDS_EACH[phase(e)], HANDS_MAX - alive);
  const players = game.alivePlayers();
  if (n <= 0 || players.length === 0) return;
  for (let i = 0; i < n; i++) {
    const p = players[i % players.length];
    const a = game.rng() * Math.PI * 2 + i * 2.1;
    let x = p.x + Math.cos(a) * 50;
    let y = p.y + Math.sin(a) * 50;
    if (tiles.isSolid(tiles.tileAt(game.room, x, y), {})) { x = p.x; y = p.y; }
    const h = game.spawnEnemy('rothand', x, y, { noReward: true });
    h.dieAt = game.time + HAND_LIFE;
    h.summonedBy = e.id;
  }
  game.event({ type: 'hands', x: Math.round(e.x), y: Math.round(e.y) });
}

module.exports = { updateRotgrub, updateSlug, updateRotHand, updateWyrm, initHand };
