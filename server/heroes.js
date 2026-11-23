// Heroes: movement now; attacks and skills are added in the combat step.
const tiles = require('../shared/tiles');
const data = require('../shared/data');

function updatePlayer(game, p, dt) {
  if (p.downed || game.time < p.stunUntil) return;
  move(game, p, dt);
}

// Walk in the direction of the pressed keys, sliding along walls.
function move(game, p, dt) {
  const { input } = p;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  const speed = data.HEROES[p.heroClass].speed * (1 + p.speedMul) * game.slowFactor(p);
  const pos = tiles.moveWithCollision(game.room, p.x, p.y, dx * speed * dt, dy * speed * dt, p.r, { doorOpen: game.doorOpen });
  p.x = pos.x;
  p.y = pos.y;
}

function updateProjectiles(game, dt) {}

function updateZones(game, dt) {}

module.exports = { updatePlayer, updateProjectiles, updateZones };
