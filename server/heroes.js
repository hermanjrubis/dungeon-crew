// Heroes: movement, basic attacks, Q and Space skills, projectiles and
// skill zones. All numbers come from shared/data.js.
const tiles = require('../shared/tiles');
const data = require('../shared/data');

const EPS = 1e-6;
const DEG = Math.PI / 180;

// Smallest difference between two angles, in radians (0..PI).
function angleDiff(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

function ready(game, p, key) {
  return game.time >= p.cd[key] - EPS;
}

function updatePlayer(game, p, dt) {
  if (p.downed) return;
  const hero = data.HEROES[p.heroClass];
  if (hero.manaRegen) p.mana = Math.min(p.maxMana, p.mana + hero.manaRegen * dt);
  if (game.time < p.stunUntil) return;

  const { input } = p;
  if (input.attack && ready(game, p, 'attack')) basicAttack(game, p, hero);
  if (input.q && ready(game, p, 'q')) skillQ(game, p, hero);
  if (input.space && ready(game, p, 'space')) skillSpace(game, p, hero);

  const rooted = game.time < (p.rootUntil || 0);
  if (rooted) p.roll = null; // vines hold you in place, but you can still fight
  else if (p.roll) roll(game, p, dt);
  else move(game, p, dt);
}

// ---------- movement ----------

function moveDir(input) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  return len ? { dx: dx / len, dy: dy / len } : null;
}

function move(game, p, dt) {
  const dir = moveDir(p.input);
  if (!dir) return;
  const speed = data.HEROES[p.heroClass].speed * (1 + p.speedMul) * game.slowFactor(p);
  const pos = tiles.moveWithCollision(game.room, p.x, p.y, dir.dx * speed * dt, dir.dy * speed * dt, p.r, { doorOpen: game.doorOpen });
  p.x = pos.x;
  p.y = pos.y;
}

// Archer dodge roll: a fixed-distance dash.
function roll(game, p, dt) {
  const step = Math.min(p.roll.left, p.roll.speed * dt);
  const pos = tiles.moveWithCollision(game.room, p.x, p.y, p.roll.dx * step, p.roll.dy * step, p.r, { doorOpen: game.doorOpen });
  p.x = pos.x;
  p.y = pos.y;
  p.roll.left -= step;
  if (p.roll.left <= EPS) p.roll = null;
}

// ---------- attacks ----------

function basicAttack(game, p, hero) {
  const a = hero.attack;
  if (a.mana) {
    if (p.mana < a.mana) return;
    p.mana -= a.mana;
  }
  p.cd.attack = game.time + a.cd;
  if (a.kind === 'swing') {
    p.swingAt = game.time;
    for (const e of game.enemies.slice()) {
      if (inArc(p, e, a.range, a.arc)) game.damageEnemy(e, game.playerDamage(p), p.id);
    }
  } else {
    shoot(game, p, a.kind, a.speed, a.ttl, game.playerDamage(p));
  }
}

function inArc(p, e, range, arcDeg) {
  const dist = Math.hypot(e.x - p.x, e.y - p.y);
  if (dist > range + e.r) return false;
  if (dist < 1) return true;
  return angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim) <= (arcDeg * DEG) / 2;
}

function shoot(game, p, kind, speed, ttl, dmg, extra = {}) {
  return game.addProjectile({
    kind, ownerId: p.id, x: p.x, y: p.y, r: 6,
    vx: Math.cos(p.aim) * speed, vy: Math.sin(p.aim) * speed,
    until: game.time + ttl, dmg, ...extra
  });
}

// Tell every browser a skill was used, so it can draw the effect.
function announce(game, p, skill) {
  game.event({ type: 'cast', by: p.id, skill, x: Math.round(p.x), y: Math.round(p.y), aim: Math.round(p.aim * 100) / 100 });
}

const SKILL_NAMES = {
  knight: { q: 'bash', space: 'taunt' },
  archer: { q: 'arrowRain', space: 'roll' },
  mage: { q: 'fireball', space: 'heal' }
};

function skillQ(game, p, hero) {
  const s = hero.q;
  if (s.mana && p.mana < s.mana) return;
  if (s.mana) p.mana -= s.mana;
  p.cd.q = game.time + s.cd;
  announce(game, p, SKILL_NAMES[p.heroClass].q);

  if (p.heroClass === 'knight') {
    // Shield Bash: hit, push back and stun everything in front.
    p.swingAt = game.time;
    for (const e of game.enemies.slice()) {
      if (!inArc(p, e, s.range, s.arc)) continue;
      game.damageEnemy(e, s.dmg, p.id);
      if (e.hp <= 0) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      const pos = tiles.moveWithCollision(game.room, e.x, e.y, Math.cos(ang) * s.push, Math.sin(ang) * s.push, e.r, {});
      e.x = pos.x;
      e.y = pos.y;
      e.stunUntil = game.time + s.stun;
    }
  } else if (p.heroClass === 'archer') {
    // Arrow Rain: a circle of falling arrows where you aim.
    game.addZone({
      kind: 'arrowRain', ownerId: p.id,
      x: p.x + Math.cos(p.aim) * s.reach, y: p.y + Math.sin(p.aim) * s.reach,
      r: s.radius, until: game.time + s.duration, nextTick: game.time + s.every, every: s.every, dmg: s.dmg
    });
  } else if (p.heroClass === 'mage') {
    shoot(game, p, 'fireball', s.speed, s.ttl, s.dmg, { blast: s.radius });
  }
}

function skillSpace(game, p, hero) {
  const s = hero.space;
  if (s.mana && p.mana < s.mana) return;
  if (s.mana) p.mana -= s.mana;
  p.cd.space = game.time + s.cd;
  announce(game, p, SKILL_NAMES[p.heroClass].space);

  if (p.heroClass === 'knight') {
    game.tauntBy = { id: p.id, until: game.time + s.duration, range: s.range };
    game.addZone({ kind: 'taunt', ownerId: p.id, x: p.x, y: p.y, r: s.range, until: game.time + 0.4 });
  } else if (p.heroClass === 'archer') {
    const dir = moveDir(p.input) || { dx: Math.cos(p.aim), dy: Math.sin(p.aim) };
    p.roll = { dx: dir.dx, dy: dir.dy, left: s.distance, speed: s.distance / s.duration };
    p.invulnUntil = game.time + s.duration;
  } else if (p.heroClass === 'mage') {
    const every = 0.5;
    game.addZone({
      kind: 'healCircle', ownerId: p.id, x: p.x, y: p.y, r: s.radius,
      until: game.time + s.duration, nextTick: game.time + every, every, heal: s.perSecond * every
    });
  }
}

// ---------- projectiles ----------

function updateProjectiles(game, dt) {
  for (const pr of game.projectiles.slice()) {
    if (game.time >= pr.until - EPS) {
      finishProjectile(game, pr);
      continue;
    }
    const steps = Math.max(1, Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 10));
    for (let i = 0; i < steps; i++) {
      pr.x += (pr.vx * dt) / steps;
      pr.y += (pr.vy * dt) / steps;
      if (tiles.isSolid(tiles.tileAt(game.room, pr.x, pr.y), { doorOpen: game.doorOpen })) {
        finishProjectile(game, pr);
        break;
      }
      if (pr.hostile) {
        // A monster's shot: hits players, flies past monsters.
        const victim = [...game.players.values()].find((p) => !p.downed && game.time >= p.invulnUntil &&
          Math.hypot(p.x - pr.x, p.y - pr.y) <= p.r + pr.r);
        if (victim) {
          game.damagePlayer(victim, pr.dmg, 'arrow');
          removeProjectile(game, pr);
          break;
        }
        continue;
      }
      const target = game.enemies.find((e) => !e.invulnerable && Math.hypot(e.x - pr.x, e.y - pr.y) <= e.r + pr.r);
      if (target) {
        if (pr.blast) finishProjectile(game, pr);
        else {
          game.damageEnemy(target, pr.dmg, pr.ownerId);
          removeProjectile(game, pr);
        }
        break;
      }
    }
  }
}

function removeProjectile(game, pr) {
  const i = game.projectiles.indexOf(pr);
  if (i !== -1) game.projectiles.splice(i, 1);
}

// Fireballs explode when they hit something or run out; arrows just vanish.
function finishProjectile(game, pr) {
  removeProjectile(game, pr);
  if (!pr.blast) return;
  for (const e of game.enemies.slice()) {
    if (Math.hypot(e.x - pr.x, e.y - pr.y) <= pr.blast + e.r) game.damageEnemy(e, pr.dmg, pr.ownerId);
  }
  game.addZone({ kind: 'fireBlast', x: pr.x, y: pr.y, r: pr.blast, until: game.time + 0.3 });
  game.event({ type: 'explode', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.blast });
}

// ---------- zones ----------

function updateZones(game, dt) {
  for (const z of game.zones) {
    if (z.kind === 'arrowRain') {
      while (z.nextTick <= game.time + EPS && z.nextTick <= z.until + EPS) {
        for (const e of game.enemies.slice()) {
          if (Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.r) game.damageEnemy(e, z.dmg, z.ownerId);
        }
        z.nextTick += z.every;
      }
    } else if (z.kind === 'slime') {
      for (const p of game.players.values()) {
        if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r) game.applySlow(p, 'slime', 0.4, 0.1);
      }
    } else if (z.kind === 'healCircle') {
      while (z.nextTick <= game.time + EPS && z.nextTick <= z.until + EPS) {
        for (const p of game.players.values()) {
          if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r) game.healPlayer(p, z.heal);
        }
        z.nextTick += z.every;
      }
    }
  }
  game.zones = game.zones.filter((z) => z.until > game.time + EPS);
}

module.exports = { updatePlayer, updateProjectiles, updateZones, angleDiff };
