const test = require('node:test');
const assert = require('node:assert');
const { FLOORS } = require('../shared/rooms');
const { Game } = require('../server/game');
const { makeGame, run, ARENA, center } = require('./helpers');

const me = (game, i = 0) => game.players.get('p' + i);
const tough = (p) => Object.assign(p, { hp: 1e5, maxHp: 1e5 });
function arena(classes = ['knight']) {
  const game = makeGame(classes, ARENA);
  game.enemies = [];
  Object.assign(me(game), center(4, 6));
  return game;
}

test('Floor 6 is the Crystal Wastes, the last floor; Floor 5 now has a shop', () => {
  const f6 = FLOORS[5];
  assert.strictEqual(f6.name, 'Crystal Wastes');
  assert.strictEqual(f6.shop, null);
  assert.strictEqual(FLOORS[4].shop, 'warrens');
  assert.ok(f6.rooms[3].layout.some((r) => r.includes('Z')));
});

test('a Crystal Crawler hides in its shell when hit, taking much less damage', () => {
  const game = arena();
  const p = tough(me(game));
  const c = game.spawnEnemy('crawler', p.x + 200, p.y);
  const first = game.damageEnemy(c, 40, 'p0');
  assert.strictEqual(c.state, 'shell');
  const second = game.damageEnemy(c, 40, 'p0');
  assert.ok(second <= first * 0.3, `${first} then ${second}`);
  run(game, 2.5);
  assert.notStrictEqual(c.state, 'shell');
});

test('a Shard Wisp keeps away, glows, then fires a burst of shards', () => {
  const game = arena();
  const p = tough(me(game));
  const w = game.spawnEnemy('wisp', p.x + 250, p.y);
  run(game, 4);
  assert.ok(game.drainEvents().some((e) => e.type === 'shards'));
  assert.ok(p.hp < p.maxHp);
  assert.ok(Math.hypot(w.x - p.x, w.y - p.y) > 120);
});

function prismGame() {
  const game = arena(['knight']);
  const p = tough(me(game));
  const z = game.spawnEnemy('prism', center(16, 6).x, center(16, 6).y);
  return { game, p, z };
}

test('Prismaurus stomps when you are close: a shockwave around it', () => {
  const { game, p, z } = prismGame();
  Object.assign(p, { x: z.x - 120, y: z.y });
  let stomped = false;
  for (let i = 0; i < 60 && !stomped; i++) { game.tick(0.05); stomped = game.drainEvents().some((e) => e.type === 'stomp'); }
  assert.ok(stomped);
  assert.ok(p.hp < p.maxHp);
});

test('Prismaurus charges its spines (warning line), then fires the prism beam', () => {
  const { game, p, z } = prismGame();
  Object.assign(p, { x: z.x - 400, y: z.y });
  let warned = false;
  let beamed = false;
  for (let i = 0; i < 400 && !beamed; i++) {
    game.tick(0.05);
    if (z.state === 'charge' && game.zones.some((q) => q.kind === 'beamWarn')) warned = true;
    if (z.state === 'beam') beamed = true;
  }
  assert.ok(warned && beamed);
  const hp = p.hp;
  run(game, 1);
  assert.ok(p.hp < hp, 'standing in the beam hurts');
});

test('the Prismguard set cuts beam damage by 40%', () => {
  const a = prismGame();
  const b = prismGame();
  b.p.owned.push('helm5', 'plate5', 'boots5');
  for (const g of [a, b]) Object.assign(g.p, { x: g.z.x - 400, y: g.z.y });
  const hurt = (g) => {
    for (let i = 0; i < 400 && g.z.state !== 'beam'; i++) g.game.tick(0.05);
    const hp = g.p.hp;
    run(g.game, 1);
    return hp - g.p.hp;
  };
  const da = hurt(a), db = hurt(b);
  assert.ok(da > 0 && db > 0);
  assert.ok(db <= da * 0.65, `${da} vs ${db}`);
});

test('Prismaurus roars at 2/3 and 1/3 HP: slows everyone nearby and calls Shard Wisps', () => {
  const { game, p, z } = prismGame();
  Object.assign(p, { x: z.x - 150, y: z.y });
  run(game, 0.1);
  z.hp = Math.floor(z.maxHp * 0.66);
  for (let i = 0; i < 40 && z.state !== 'roar'; i++) game.tick(0.05);
  assert.strictEqual(z.state, 'roar');
  run(game, 1.3);
  assert.ok(game.drainEvents().some((e) => e.type === 'roar'));
  assert.ok(game.slowFactor(p) < 1);
  const wisps = game.enemies.filter((e) => e.type === 'wisp');
  assert.strictEqual(wisps.length, 2);
  assert.ok(wisps.every((w) => w.noReward));
});

test('beating Prismaurus ends the run', () => {
  const floors = [FLOORS[5]].map((f) => ({ ...f, rooms: [f.rooms[3]] }));
  const game = new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, transitions: false, rng: () => 0 });
  const z = game.enemies.find((e) => e.type === 'prism');
  assert.ok(z);
  z.hp = 1;
  game.damageEnemy(z, 5, 'p0');
  for (const e of game.enemies.slice()) game.killEnemy(e, { reward: false });
  game.tick(0.05);
  assert.strictEqual(game.phase, 'done');
});

test('the prism beam is one solid strip that stops at the first wall or pillar', () => {
  const pillarRoom = [[
    'wwwwwwwwwwwwwwwwwwwwwwww',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'weffffwffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wwwwwwwwwwwwwwwwwwwwwwww'
  ]];
  const game = makeGame(['knight'], pillarRoom);
  game.enemies = [];
  const p = tough(me(game));
  Object.assign(p, center(3, 6)); // behind the pillar at x=6
  const z = game.spawnEnemy('prism', center(16, 6).x, center(16, 6).y);
  for (let i = 0; i < 400 && z.state !== 'beam'; i++) game.tick(0.05);
  assert.strictEqual(z.state, 'beam');
  z.beamAim = Math.PI; z.beamStart = Math.PI; z.sweepDir = 0; // aim straight at the player
  run(game, 0.3);
  const beam = game.zones.find((q) => q.kind === 'beam');
  assert.ok(beam.r < 16 * 48 - 6 * 48, 'stops at the pillar: ' + beam.r);
  const snapZone = game.snapshot().zones.find((q) => q.kind === 'beam');
  assert.ok(snapZone.width > 0, 'the browser gets the beam width');
  const hp = p.hp;
  run(game, 0.5);
  assert.strictEqual(p.hp, hp, 'safe behind the pillar');
});
