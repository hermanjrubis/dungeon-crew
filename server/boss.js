// The Gloop Mother, Floor 1's boss.
//   Belly Flop: a shadow marks the spot for 1.5 s (she can't be hit while in
//               the air), then she lands on it.
//   Brood:      spits out 2 Gloops every 12 s (they give no gold and don't split).
//   Slime Trail: leaves sticky slime that slows players by 40%.
//   At half HP she splits into two Half Mothers. Her gold and XP are given
//   when the last half dies.
const data = require('../shared/data');
const { dist, pickTarget, walkToward, contactDamage } = require('./ai');

const EPS = 1e-6;
const FLOP_EVERY = 6;
const FLOP_TELL = 1.5;
const BROOD_EVERY = 12;
const SLIME_EVERY = 0.5;
const SLIME_LIFE = 4;
const SLIME_RADIUS = 24;

function updateBoss(game, e, dt) {
  if (e.timers.flop === undefined) e.timers.flop = game.time + 3;
  if (e.timers.brood === undefined) e.timers.brood = e.type === 'mother' ? game.time + 6 : Infinity;
  if (e.timers.slime === undefined) e.timers.slime = game.time + SLIME_EVERY;

  if (e.state === 'airborne') {
    if (game.time >= e.stateUntil - EPS) land(game, e);
    return;
  }

  // Phase 2: split in two at half HP.
  if (e.type === 'mother' && e.hp <= e.maxHp / 2) {
    split(game, e);
    return;
  }

  const target = pickTarget(game, e);
  if (!target) return;

  if (game.time >= e.timers.flop - EPS) {
    startFlop(game, e, target);
    return;
  }
  if (game.time >= e.timers.brood - EPS) {
    for (const off of [-1, 1]) game.spawnEnemy('gloop', e.x + off * (e.r + 20), e.y, { noReward: true });
    e.timers.brood = game.time + BROOD_EVERY;
    game.event({ type: 'brood', enemyId: e.id });
  }

  e.state = 'walk';
  walkToward(game, e, target, dt);
  contactDamage(game, e);
  if (game.time >= e.timers.slime - EPS) {
    game.addZone({ kind: 'slime', x: e.x, y: e.y, r: SLIME_RADIUS, until: game.time + SLIME_LIFE });
    e.timers.slime = game.time + SLIME_EVERY;
  }
}

function flopRadius(e) {
  return e.type === 'mother' ? 72 : 56;
}

function startFlop(game, e, target) {
  e.state = 'airborne';
  e.invulnerable = true;
  e.stateUntil = game.time + FLOP_TELL;
  e.flopAt = { x: target.x, y: target.y };
  game.addZone({ kind: 'flopShadow', x: target.x, y: target.y, r: flopRadius(e), until: e.stateUntil });
}

function land(game, e) {
  e.x = e.flopAt.x;
  e.y = e.flopAt.y;
  e.invulnerable = false;
  e.state = 'walk';
  e.timers.flop = game.time + FLOP_EVERY;
  for (const p of game.alivePlayers()) {
    if (dist(p, e) <= flopRadius(e)) {
      game.damagePlayer(p, e.dmg * 2, e);
      e.hitAt[p.id] = game.time + 0.8; // no extra touch damage right after landing
    }
  }
  game.event({ type: 'flop', x: Math.round(e.x), y: Math.round(e.y) });
}

function split(game, e) {
  const { x, y } = e;
  game.killEnemy(e, { reward: false });
  for (const off of [-1, 1]) {
    const half = game.spawnEnemy('halfmother', x + off * 40, y);
    half.timers.flop = game.time + 2 + (off > 0 ? 1.5 : 0); // don't flop together
  }
  game.event({ type: 'split', x: Math.round(x), y: Math.round(y) });
}

// When the last Half Mother dies, pay out the Gloop Mother's reward.
function onBossDeath(game, e, { reward }) {
  if (e.type !== 'halfmother' || !reward) return;
  if (game.enemies.some((o) => o.type === 'halfmother')) return;
  const m = data.MONSTERS.mother;
  for (const p of game.players.values()) {
    p.gold += m.gold[0];
    game.addXp(p, m.xp);
  }
}

module.exports = { updateBoss, onBossDeath };
