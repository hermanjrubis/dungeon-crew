const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run } = require('./helpers');

function setup(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  const players = classes.map((_, i) => game.players.get('p' + i));
  players.forEach((p, i) => { p.x = 200; p.y = 150 + i * 60; });
  const q = game.spawnEnemy('queen', 700, 312);
  for (const k of ['teleport', 'storm', 'vine', 'guard']) q.timers[k] = 999;
  return { game, players, q };
}

test('queen HP scales with players', () => {
  const { q } = setup(['knight', 'mage']);
  assert.strictEqual(q.hp, 600);
});

test('shimmer then teleport somewhere far from players', () => {
  const { game, players, q } = setup();
  q.timers.teleport = game.time;
  game.tick(0.05);
  assert.strictEqual(q.state, 'shimmer');
  assert.strictEqual(q.invulnerable, true);
  run(game, 0.6);
  assert.strictEqual(q.invulnerable, false);
  assert.ok(q.x !== 700 || q.y !== 312, 'she moved');
  for (const p of players) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 4 * 48);
});

test('spore storm spares players in a safe circle', () => {
  const { game, players, q } = setup(['knight', 'knight']);
  q.timers.storm = game.time;
  game.tick(0.05);
  const circles = game.zones.filter((z) => z.kind === 'safeCircle');
  assert.strictEqual(circles.length, 3);
  const [safe, open] = players;
  safe.x = circles[0].x; safe.y = circles[0].y;
  // find a floor spot far from every circle for the other player
  let spot = null;
  for (let y = 72; y < 600 && !spot; y += 48) {
    for (let x = 72; x < 1100 && !spot; x += 48) {
      if (circles.every((c) => Math.hypot(c.x - x, c.y - y) > c.r + 40) && Math.hypot(q.x - x, q.y - y) > 120) spot = { x, y };
    }
  }
  open.x = spot.x; open.y = spot.y;
  run(game, 1.9);
  assert.strictEqual(open.hp, 120);
  run(game, 0.15);
  assert.strictEqual(safe.hp, 120);
  assert.strictEqual(open.hp, 105);
});

test('vine grab roots the player after 1 s', () => {
  const { game, players, q } = setup();
  q.timers.vine = game.time;
  game.tick(0.05);
  assert.ok(game.zones.some((z) => z.kind === 'vineRing'));
  run(game, 0.9);
  assert.strictEqual(players[0].hp, 120);
  run(game, 0.15);
  assert.strictEqual(players[0].hp, 114);
  assert.ok(players[0].rootUntil > game.time + 1.3);
});

test('royal guard grows 2 sporecaps', () => {
  const { game, q } = setup();
  q.timers.guard = game.time;
  game.tick(0.05);
  const caps = game.enemies.filter((e) => e.type === 'sporecap');
  assert.strictEqual(caps.length, 2);
  assert.ok(caps.every((c) => c.noReward));
});

test('the lair goes dark at half HP', () => {
  const { game, q } = setup();
  assert.strictEqual(game.allDark, false);
  game.damageEnemy(q, 200, 'p0');
  game.tick(0.05);
  assert.strictEqual(game.allDark, true);
  assert.ok(game.drainEvents().some((e) => e.type === 'darkness'));
});

test('beating the queen pays 70 gold and 150 XP', () => {
  const { game, players, q } = setup();
  game.damageEnemy(q, 9999, 'p0');
  assert.strictEqual(players[0].gold, 70);
  assert.strictEqual(players[0].xp, 150);
});
