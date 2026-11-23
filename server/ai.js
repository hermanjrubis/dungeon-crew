// Helpers every monster uses: choosing a target, moving and touch damage.
const tiles = require('../shared/tiles');

const EPS = 1e-6;
const CONTACT_COOLDOWN = 0.8;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Who should this monster chase? A taunting knight in range first,
// otherwise the closest player who is still standing.
function pickTarget(game, e) {
  const t = game.tauntBy;
  if (t && t.until > game.time) {
    const knight = game.players.get(t.id);
    if (knight && !knight.downed && dist(knight, e) <= t.range) return knight;
  }
  let best = null;
  for (const p of game.alivePlayers()) {
    if (!best || dist(p, e) < dist(best, e)) best = p;
  }
  return best;
}

function moveEnemy(game, e, dx, dy) {
  const pos = tiles.moveWithCollision(game.room, e.x, e.y, dx, dy, e.r, { doorOpen: false });
  e.x = pos.x;
  e.y = pos.y;
}

function walkToward(game, e, target, dt, speed = e.speed) {
  const d = dist(e, target);
  if (d < 1) return;
  const step = Math.min(d, speed * game.slowFactor(e) * dt);
  moveEnemy(game, e, ((target.x - e.x) / d) * step, ((target.y - e.y) / d) * step);
}

// Touching a monster hurts, but only once every 0.8 s per player.
function contactDamage(game, e) {
  for (const p of game.alivePlayers()) {
    if (dist(p, e) > p.r + e.r) continue;
    if ((e.hitAt[p.id] || 0) > game.time + EPS) continue;
    game.damagePlayer(p, e.dmg, e);
    e.hitAt[p.id] = game.time + CONTACT_COOLDOWN;
  }
}

module.exports = { dist, pickTarget, moveEnemy, walkToward, contactDamage };
