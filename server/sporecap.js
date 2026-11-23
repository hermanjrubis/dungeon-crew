// The Sporecap (Floor 2). It never moves.
//   Poison Puff: when a player comes within 2 tiles, its cap swells (the warning),
//   then it releases a poison cloud for 3 s.
//   Spore Seed: every 15 s it spits a seed that grows into a new Sporecap after
//   10 s unless someone breaks it. A room never holds more than 6 of them.
const tiles = require('../shared/tiles');
const { dist } = require('./ai');

const EPS = 1e-6;
const PUFF_RANGE = 96;
const PUFF_EVERY = 4;
const SWELL_TIME = 0.6;
const CLOUD_RADIUS = 72;
const CLOUD_TIME = 3;
const CLOUD_POISON = 3; // per second
const SEED_FIRST = 8;
const SEED_EVERY = 15;
const SEED_RANGE = 3;   // tiles
const GROW_TIME = 10;
const MAX_PER_ROOM = 6;

function updateSporecap(game, e) {
  if (e.timers.puff === undefined) e.timers.puff = game.time;
  if (e.timers.seed === undefined) e.timers.seed = game.time + SEED_FIRST;

  if (e.state === 'swell') {
    if (game.time >= e.stateUntil - EPS) {
      game.addZone({ kind: 'poisonCloud', x: e.x, y: e.y, r: CLOUD_RADIUS, until: game.time + CLOUD_TIME, perSecond: CLOUD_POISON });
      game.event({ type: 'puff', x: Math.round(e.x), y: Math.round(e.y) });
      e.state = 'idle';
      e.timers.puff = game.time + PUFF_EVERY;
    }
    return;
  }
  const close = game.alivePlayers().some((p) => dist(p, e) <= PUFF_RANGE);
  if (close && game.time >= e.timers.puff - EPS) {
    e.state = 'swell';
    e.stateUntil = game.time + SWELL_TIME;
    return;
  }
  if (game.time >= e.timers.seed - EPS) {
    e.timers.seed = game.time + SEED_EVERY;
    spitSeed(game, e);
  }
}

function spitSeed(game, e) {
  const crowd = game.enemies.filter((o) => o.type === 'sporecap' || o.type === 'seed').length;
  if (crowd >= MAX_PER_ROOM) return;
  // Pick a random plain-floor tile within 3 tiles that nobody is standing on.
  const T = tiles.TILE;
  const cx = Math.floor(e.x / T);
  const cy = Math.floor(e.y / T);
  const spots = [];
  for (let ty = cy - SEED_RANGE; ty <= cy + SEED_RANGE; ty++) {
    for (let tx = cx - SEED_RANGE; tx <= cx + SEED_RANGE; tx++) {
      const x = tx * T + T / 2;
      const y = ty * T + T / 2;
      const d = Math.hypot(x - e.x, y - e.y);
      if (d < T * 0.9 || d > SEED_RANGE * T + 1) continue;
      if (tiles.tileAt(game.room, x, y) !== 'f') continue;
      if (game.enemies.some((o) => Math.hypot(o.x - x, o.y - y) < T * 0.8)) continue;
      spots.push({ x, y });
    }
  }
  if (!spots.length) return;
  const { x, y } = spots[Math.floor(game.rng() * spots.length)];
  const seed = game.spawnEnemy('seed', x, y, { noReward: true });
  seed.growAt = game.time + GROW_TIME;
  game.event({ type: 'seed', fromX: Math.round(e.x), fromY: Math.round(e.y), x, y });
}

function updateSeed(game, e) {
  if (!e.growAt) e.growAt = game.time + GROW_TIME;
  if (game.time < e.growAt - EPS) return;
  game.killEnemy(e, { reward: false });
  game.spawnEnemy('sporecap', e.x, e.y, { noReward: true });
  game.event({ type: 'sprout', x: Math.round(e.x), y: Math.round(e.y) });
}

module.exports = { updateSporecap, updateSeed, MAX_PER_ROOM };
