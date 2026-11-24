const test = require('node:test');
const assert = require('node:assert');
const { makeGame, run, ARENA, center } = require('./helpers');

const me = (game, i = 0) => game.players.get('p' + i);
function arena(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  game.enemies = [];
  Object.assign(me(game), center(4, 6));
  return game;
}
const tough = (p) => Object.assign(p, { hp: 1e5, maxHp: 1e5 });

test('a Rotgrub keeps its distance and spits poison that leaves a puddle', () => {
  const game = arena();
  const p = me(game);
  tough(p);
  const g = game.spawnEnemy('rotgrub', p.x + 200, p.y);
  run(game, 4);
  assert.ok(game.drainEvents().some((e) => e.type === 'spit'));
  assert.ok(p.hp < p.maxHp, 'the glob hurt');
  assert.ok(Math.hypot(g.x - p.x, g.y - p.y) > 120, 'stays back');
  // the glob left a puddle (or is still flying)
  const puddles = game.zones.filter((z) => z.kind === 'poisonCloud');
  assert.ok(puddles.length >= 1 || game.projectiles.some((pr) => pr.kind === 'poisonGlob'));
});

test('an Acid Slug leaves acid behind it that poisons and slows', () => {
  const game = arena();
  const p = me(game);
  tough(p);
  game.spawnEnemy('slug', p.x + 300, p.y);
  run(game, 2);
  const acid = game.zones.filter((z) => z.kind === 'acid');
  assert.ok(acid.length >= 2, 'a trail: ' + acid.length);
  Object.assign(p, { x: acid[0].x, y: acid[0].y });
  const hp = p.hp;
  run(game, 1);
  assert.ok(p.hp < hp, 'poisoned');
  assert.ok(game.slowFactor(p) < 1, 'slowed');
});

test('a Rot Hand rises first, then grabs: damage and held in place', () => {
  const game = arena();
  const p = me(game);
  tough(p);
  const h = game.spawnEnemy('rothand', p.x + 30, p.y);
  assert.strictEqual(h.state, 'rise');
  run(game, 0.3);
  assert.strictEqual(p.hp, p.maxHp, 'no grab while rising');
  run(game, 1.2);
  assert.ok(p.hp < p.maxHp);
  assert.ok(p.rootUntil > game.time, 'held');
});

test('the Rotward set: hands cannot hold you, and poison hurts 60% less', () => {
  const game = arena();
  const p = me(game);
  tough(p);
  p.owned.push('helm4', 'plate4', 'boots4');
  assert.strictEqual(game.playerPoisonResist(p), 0.6);
  game.spawnEnemy('rothand', p.x + 30, p.y);
  run(game, 1.5);
  assert.ok(p.hp < p.maxHp);
  assert.ok(!(p.rootUntil > game.time));
});

function wyrmGame() {
  const game = arena(['knight']);
  const p = tough(me(game));
  const w = game.spawnEnemy('wyrm', center(16, 6).x, center(16, 6).y);
  return { game, p, w };
}

test('the Wyrm burrows (can\'t be hit), marks where it will burst out, then erupts', () => {
  const { game, p, w } = wyrmGame();
  let sawUnder = false;
  let warned = false;
  for (let i = 0; i < 400; i++) {
    game.tick(0.05);
    if (w.state === 'under') {
      sawUnder = true;
      assert.strictEqual(game.damageEnemy(w, 50, 'p0'), 0, 'underground: no damage');
    }
    if (game.zones.some((z) => z.kind === 'wyrmWarn')) warned = true;
    if (warned && w.state === 'emerge') break;
  }
  assert.ok(sawUnder && warned);
  assert.ok(game.drainEvents().some((e) => e.type === 'erupt' || e.type === 'wyrmerupt'));
  assert.ok(p.hp <= p.maxHp);
});

test('the Wyrm calls Rot Hands next to players, never more than 6, and they give nothing', () => {
  const { game, w } = wyrmGame();
  run(game, 40);
  const hands = game.enemies.filter((e) => e.type === 'rothand');
  assert.ok(hands.length >= 2 && hands.length <= 6, String(hands.length));
  assert.ok(hands.every((h) => h.noReward));
  assert.ok(w.hp > 0);
});

test('at half HP the Wyrm goes wild: a roar and faster attacks', () => {
  const { game, w } = wyrmGame();
  run(game, 0.1);
  w.hp = Math.floor(w.maxHp * 0.5);
  run(game, 0.1);
  assert.ok(w.p2);
  assert.ok(game.drainEvents().some((e) => e.type === 'wyrmrage'));
});

test('beating the Wyrm opens the Warrens camp shop (Floor 6 is next)', () => {
  const { FLOORS } = require('../shared/rooms');
  const { Game } = require('../server/game');
  const floors = [FLOORS[4]].map((f) => ({ ...f, rooms: [f.rooms[3]] }));
  const game = new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, transitions: false, rng: () => 0 });
  const w = game.enemies.find((e) => e.type === 'wyrm');
  assert.ok(w);
  w.hp = 1;
  w.state = 'idle';
  w.invulnerable = false;
  game.damageEnemy(w, 5, 'p0');
  for (const e of game.enemies.slice()) game.killEnemy(e, { reward: false });
  game.tick(0.05);
  assert.strictEqual(game.phase, 'shop');
});
