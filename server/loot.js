// Loot that pops out of fallen monsters: coin piles, hearts, potions, feathers.
// It's extra on top of the gold every kill already pays the crew. Whoever touches
// a drop first keeps it all; it fades after LOOT.life seconds or when the room changes.
const data = require('../shared/data');

const REACH = 30;

function drop(game, kind, x, y, amount = 1) {
  const l = { id: game.nextId++, kind, x, y, amount, until: game.time + data.LOOT.life };
  game.loot.push(l);
  return l;
}

// Scatter a drop a little around the body so piles don't stack.
function scatter(game, e, spread) {
  const a = game.rng() * Math.PI * 2;
  const d = spread * game.rng();
  return [e.x + Math.cos(a) * d, e.y + Math.sin(a) * d];
}

function coinValue(game, m) {
  const [lo, hi] = m.gold;
  const base = lo + Math.floor(game.rng() * (hi - lo + 1));
  return Math.max(1, Math.round(base * data.ECONOMY.goldMul * (1 + game.rng())));
}

// Called when a monster dies with a reward.
function roll(game, e) {
  if (e.summonedBy) return;
  const m = data.MONSTERS[e.type];
  if (!m) return;
  if (m.boss) {
    const n = data.LOOT.bossCoins[0] + Math.floor(game.rng() * (data.LOOT.bossCoins[1] - data.LOOT.bossCoins[0] + 1));
    const each = Math.max(5, Math.round((m.gold[0] * data.ECONOMY.goldMul) / n / 2));
    for (let i = 0; i < n; i++) drop(game, 'coins', ...scatter(game, e, 70), each);
    drop(game, 'potion', ...scatter(game, e, 40));
    return;
  }
  const r = game.rng();
  let acc = 0;
  for (const kind of ['feather', 'potion', 'heart', 'coins']) {
    acc += data.LOOT.chance[kind];
    if (r < acc) {
      const amount = kind === 'coins' ? coinValue(game, m) : 1;
      drop(game, kind, ...scatter(game, e, 18), amount);
      return;
    }
  }
}

function give(game, p, l) {
  if (l.kind === 'coins') { p.gold += l.amount; game.addStat(p, 'gold', l.amount); }
  else if (l.kind === 'potion') p.potions += l.amount;
  else if (l.kind === 'feather') p.feathers += l.amount;
  else if (l.kind === 'heart') game.healPlayer(p, Math.round(p.maxHp * data.LOOT.heartHeal));
}

// Every tick: expire old drops, and hand each one to the closest living hero touching it.
function update(game) {
  game.loot = game.loot.filter((l) => l.until > game.time);
  const alive = game.alivePlayers();
  for (const l of game.loot.slice()) {
    let best = null, bestD = REACH;
    for (const p of alive) {
      const d = Math.hypot(p.x - l.x, p.y - l.y);
      if (d <= bestD) { best = p; bestD = d; }
    }
    if (!best) continue;
    game.loot.splice(game.loot.indexOf(l), 1);
    give(game, best, l);
    game.event({ type: 'pickup', id: l.id, kind: l.kind, playerId: best.id, amount: l.amount, x: Math.round(l.x), y: Math.round(l.y) });
  }
}

function snapshot(game) {
  return game.loot.map((l) => ({ id: l.id, kind: l.kind, x: Math.round(l.x), y: Math.round(l.y), until: Math.round(l.until * 100) / 100 }));
}

module.exports = { drop, roll, update, snapshot, REACH };
