// The Bone Archer (Floor 2).
//   Keeps about 5 tiles away and backs off when you get close.
//   Volley: draws back for 1 s (the warning), then fires 3 arrows in a fan.
//   Rattle Back: when killed it falls into bones that rebuild it after 5 s,
//   unless a player stands on the bones, which destroys them for good.
const data = require('../shared/data');
const { dist, pickTarget, walkToward, moveEnemy } = require('./ai');

const EPS = 1e-6;
const TOO_CLOSE = 160;
const TOO_FAR = 280;
const VOLLEY_FIRST = 2;
const VOLLEY_EVERY = 5;
const DRAW_TIME = 1;
const ARROW_SPEED = 420;
const ARROW_LIFE = 1.5;
const FAN = 0.25; // radians between arrows
const REBUILD_TIME = 5;
const STAND_ON = 24;

function updateArcher(game, e, dt) {
  if (e.timers.volley === undefined) e.timers.volley = game.time + VOLLEY_FIRST;
  const target = pickTarget(game, e);

  if (e.state === 'draw') {
    if (game.time >= e.stateUntil - EPS) {
      const aim = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.aim;
      for (const off of [-FAN, 0, FAN]) {
        game.addProjectile({
          kind: 'enemyArrow', hostile: true, x: e.x, y: e.y, r: 6, dmg: e.dmg,
          vx: Math.cos(aim + off) * ARROW_SPEED, vy: Math.sin(aim + off) * ARROW_SPEED, until: game.time + ARROW_LIFE
        });
      }
      game.event({ type: 'volley', enemyId: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      e.state = 'idle';
      e.timers.volley = game.time + VOLLEY_EVERY;
    }
    return;
  }
  if (!target) { e.state = 'idle'; return; }
  e.aim = Math.atan2(target.y - e.y, target.x - e.x);

  if (game.time >= e.timers.volley - EPS) {
    e.state = 'draw';
    e.stateUntil = game.time + DRAW_TIME;
    return;
  }
  const d = dist(e, target);
  if (d < TOO_CLOSE) {
    e.state = 'walk';
    walkToward(game, e, { x: e.x * 2 - target.x, y: e.y * 2 - target.y }, dt);
  } else if (d > TOO_FAR) {
    e.state = 'walk';
    walkToward(game, e, target, dt);
  } else {
    e.state = 'idle';
  }
}

// Bones wait to rebuild; a player standing on them breaks them for good.
function updateBones(game, e) {
  const stomper = game.alivePlayers().find((p) => dist(p, e) <= STAND_ON);
  if (stomper) {
    game.killEnemy(e, { reward: false });
    const reward = data.MONSTERS.archer.reward;
    for (const p of game.players.values()) {
      p.gold += reward.gold[0] + Math.floor(game.rng() * (reward.gold[1] - reward.gold[0] + 1));
      game.addXp(p, reward.xp);
    }
    game.event({ type: 'bonesBroken', x: Math.round(e.x), y: Math.round(e.y) });
    return;
  }
  if (game.time >= e.rebuildAt - EPS) {
    game.killEnemy(e, { reward: false });
    game.spawnEnemy('archer', e.x, e.y);
    game.event({ type: 'rebuild', x: Math.round(e.x), y: Math.round(e.y) });
  }
}

// Called when an archer dies. Killed by a player = bones; fell in a pit = gone.
function onArcherDeath(game, e, { reward }) {
  if (!reward) return;
  const bones = game.spawnEnemy('bones', e.x, e.y);
  bones.invulnerable = true;
  bones.rebuildAt = game.time + REBUILD_TIME;
}

module.exports = { updateArcher, updateBones, onArcherDeath, moveEnemy };
