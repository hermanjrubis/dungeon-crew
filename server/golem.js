// The Rubble Golem (Floor 3). Slow and tough.
//   Ground Slam: when a player is close, it raises its fists for 1 s (the
//   warning), then hits everyone within 2 tiles.
//   Stone Skin: hits from the front (the side facing its target) do half
//   damage. One player keeps it busy while another hits its back.
const { dist, pickTarget, walkToward, contactDamage } = require('./ai');
const { angleDiff } = require('./heroes');

const EPS = 1e-6;
const SLAM_FIRST = 2;
const SLAM_EVERY = 5;
const SLAM_TELL = 1;
const SLAM_RADIUS = 96; // 2 tiles

function updateGolem(game, e, dt) {
  if (e.timers.slam === undefined) e.timers.slam = game.time + SLAM_FIRST;
  if (e.state === 'raise') {
    if (game.time >= e.stateUntil - EPS) {
      for (const p of game.alivePlayers()) {
        if (dist(p, e) <= SLAM_RADIUS + p.r * 0.5) game.damagePlayer(p, e.dmg, e);
      }
      game.event({ type: 'slam', x: Math.round(e.x), y: Math.round(e.y), r: SLAM_RADIUS });
      e.state = 'walk';
      e.timers.slam = game.time + SLAM_EVERY;
    }
    return;
  }
  const target = pickTarget(game, e);
  if (!target) { e.state = 'idle'; return; }
  e.facing = Math.atan2(target.y - e.y, target.x - e.x);
  if (game.time >= e.timers.slam - EPS && dist(e, target) <= SLAM_RADIUS + target.r) {
    e.state = 'raise';
    e.stateUntil = game.time + SLAM_TELL;
    return;
  }
  e.state = 'walk';
  walkToward(game, e, target, dt);
  contactDamage(game, e);
}

// 0.5 when the attacking player stands in front of the golem, otherwise 1.
function frontFactor(game, e, byId) {
  const p = byId && game.players.get(byId);
  if (!p || e.facing === undefined) return 1;
  const from = Math.atan2(p.y - e.y, p.x - e.x);
  return angleDiff(from, e.facing) <= Math.PI / 2 + EPS ? 0.5 : 1;
}

module.exports = { updateGolem, frontFactor };
