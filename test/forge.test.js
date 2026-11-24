const { ECONOMY } = require('../shared/data');
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, run, center } = require('./helpers');

// Rooms with doors so an empty room doesn't end the game.
const OPEN = ['wwwwwwwwww', 'wffffffffw', 'wefffffffd', 'wffffffffw', 'wwwwwwwwww'];
const me = (game) => game.players.get('p0');

// ---------- burning ----------

test('burning deals 3 per second for 3 seconds and ignores defense', () => {
  const game = makeGame(['knight'], [OPEN, OPEN]);
  me(game).defense = 9;
  game.burnPlayer(me(game));
  run(game, 4);
  assert.strictEqual(me(game).hp, 111);
});

test('burning again restarts the timer instead of stacking', () => {
  const game = makeGame(['knight'], [OPEN, OPEN]);
  game.burnPlayer(me(game));
  run(game, 2);
  game.burnPlayer(me(game));
  run(game, 4);
  assert.strictEqual(me(game).hp, 105);
});

test('the full Forgewalker set makes burning last 1 second', () => {
  const game = makeGame(['knight'], [OPEN, OPEN]);
  me(game).owned.push('helm2', 'plate2', 'boots2');
  game.burnPlayer(me(game));
  assert.strictEqual(game.snapshot().players[0].burning, true);
  run(game, 3);
  assert.strictEqual(me(game).hp, 117);
});

// ---------- lava blocks walking monsters ----------

test('walking monsters treat lava as a wall, bats fly over it', () => {
  const RIVER = [
    'wwwwwwwwwwwwww',
    'wffffflffffffw',
    'wefffflffffffd',
    'wffffflffffffw',
    'wwwwwwwwwwwwww'
  ];
  const game = makeGame(['knight'], [RIVER, OPEN]);
  Object.assign(me(game), center(11, 2));
  me(game).invulnUntil = 999; // keep the target standing
  const g = game.spawnEnemy('gloop', center(3, 1).x, center(3, 1).y);
  const b = game.spawnEnemy('bat', center(3, 3).x, center(3, 3).y);
  g.timers.bounce = 999;
  run(game, 3);
  assert.ok(g.x < 6 * 48, 'gloop stays on its side');
  assert.ok(b.x > 7 * 48, 'bat crossed');
});

// ---------- lava, geysers and flame jets ----------
const forge = require('../server/forge');

const LAVA = ['wwwwwwwwww', 'wffffffffw', 'wefflffffd', 'wffffffffw', 'wwwwwwwwww'];
const VENT = ['wwwwwwwwww', 'wffffffffw', 'wefffvfffd', 'wffffffffw', 'wwwwwwwwww'];
const JETS = [
  'wwwwwjwwww',
  'wffffffffw',
  'wffffffffw',
  'wffffffffw',
  'wefffffffd',
  'wffffffffw',
  'wffffffffw',
  'wffffffffw',
  'wwwwwwwwww'
];
const damages = (events, amount) => events.filter((e) => e.type === 'damage' && e.targetId === 'p0' && e.amount === amount).length;

test('stepping in lava costs 50 and sends you to the entrance', () => {
  const game = makeGame(['knight'], [LAVA, OPEN]);
  Object.assign(me(game), center(4, 2));
  game.tick(0.05);
  assert.strictEqual(me(game).hp, 70);
  assert.deepStrictEqual([me(game).x, me(game).y], [center(1, 2).x, center(1, 2).y]);
  assert.ok(game.drainEvents().some((e) => e.type === 'lavafall' && e.targetId === 'p0'));
});

test('rolling over lava still burns you', () => {
  const game = makeGame(['archer'], [LAVA, OPEN]);
  Object.assign(me(game), center(4, 2));
  me(game).invulnUntil = 999;
  game.tick(0.05);
  assert.strictEqual(me(game).hp, 30);
  assert.strictEqual(me(game).x, center(1, 2).x);
});

test('a monster knocked into lava dies without a reward (only the room bonus)', () => {
  const game = makeGame(['knight'], [LAVA, OPEN]);
  const g = game.spawnEnemy('gloop', center(4, 2).x, center(4, 2).y);
  game.tick(0.05);
  assert.ok(!game.enemies.includes(g));
  assert.ok(me(game).gold === 0 || me(game).gold === ECONOMY.roomBonus[0]);
});

test('a geyser glows for 1.5 s, then erupts for 30 damage and burning', () => {
  const game = makeGame(['knight'], [VENT, OPEN]);
  Object.assign(me(game), center(5, 2));
  run(game, 1.4);
  assert.strictEqual(forge.ventState(game, 0), 'glow');
  assert.strictEqual(me(game).hp, 120);
  run(game, 0.2);
  assert.strictEqual(forge.ventState(game, 0), 'erupt');
  assert.ok(damages(game.drainEvents(), 30) === 1);
  assert.strictEqual(game.snapshot().players[0].burning, true);
  assert.deepStrictEqual(game.snapshot().vents[0], { x: center(5, 2).x, y: center(5, 2).y, state: 'erupt' });
});

test('the Forgewalker set cuts geyser damage to 21', () => {
  const game = makeGame(['knight'], [VENT, OPEN]);
  me(game).owned.push('helm2', 'plate2', 'boots2');
  Object.assign(me(game), center(5, 2));
  run(game, 1.6);
  assert.strictEqual(damages(game.drainEvents(), 21), 1);
});

test('a geyser hits each player once per eruption', () => {
  const game = makeGame(['knight'], [VENT, OPEN]);
  Object.assign(me(game), center(5, 2));
  run(game, 3.4);
  assert.strictEqual(damages(game.drainEvents(), 30), 1);
});

test('jets hiss for 0.5 s, then fire across the room for 15', () => {
  const game = makeGame(['knight', 'mage'], [JETS, OPEN]);
  Object.assign(me(game), center(5, 6));
  Object.assign(game.players.get('p1'), center(7, 6));
  run(game, 0.4);
  assert.strictEqual(forge.jetState(game, 0), 'hiss');
  assert.strictEqual(me(game).hp, 120);
  run(game, 0.3);
  assert.strictEqual(forge.jetState(game, 0), 'fire');
  assert.strictEqual(me(game).hp, 105);
  assert.strictEqual(game.players.get('p1').hp, 70);
  run(game, 0.7);
  assert.strictEqual(me(game).hp, 105, 'only once per firing');
  const jet = game.snapshot().jets[0];
  assert.deepStrictEqual([jet.dx, jet.dy, jet.len], [0, 1, 7]);
});

test('the two jet groups take turns', () => {
  const game = makeGame(['knight'], [JETS, OPEN]);
  run(game, 1.0);
  assert.strictEqual(forge.jetState(game, 0), 'fire');
  assert.strictEqual(forge.jetState(game, 1), 'idle');
  run(game, 1.5);
  assert.strictEqual(forge.jetState(game, 0), 'idle');
  assert.strictEqual(forge.jetState(game, 1), 'fire');
});

test('a pillar stops a jet beam', () => {
  const rows = JETS.slice();
  rows[4] = 'wefffwfffd';
  const game = makeGame(['knight'], [rows, OPEN]);
  Object.assign(me(game), center(5, 6));
  run(game, 3);
  assert.strictEqual(me(game).hp, 120);
  assert.strictEqual(game.snapshot().jets[0].len, 3);
});

// ---------- the moving bridge ----------
const { Game } = require('../server/game');
const RIVER_ROOM = [
  'wwwwwwwwww',
  'wfffllfffw',
  'wfffllfffw',
  'wfffllfffw',
  'wfffllfffw',
  'wfffllfffw',
  'wfffllfffw',
  'wwwwwwwwww'
];
RIVER_ROOM[3] = 'weffllfffd';
function bridgeGame() {
  const floors = [{ name: 'Forge', roomNames: [], shop: 'crown', rooms: [{ layout: RIVER_ROOM, bridge: { tx: 4, stops: [1, 3, 5] } }, { layout: OPEN }] }];
  return new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, transitions: false, rng: () => 0 });
}

test('the bridge stays 3 s, flickers 1 s, then moves to another stop', () => {
  const game = bridgeGame();
  run(game, 2.9);
  assert.deepStrictEqual(game.snapshot().bridge, { x: 192, y: 48, w: 96, h: 96, warn: false });
  run(game, 0.2);
  assert.strictEqual(game.snapshot().bridge.warn, true);
  run(game, 1.5);
  assert.deepStrictEqual(game.snapshot().bridge, { x: 192, y: 144, w: 96, h: 96, warn: false });
});

test('bridge carries riders', () => {
  const game = bridgeGame();
  Object.assign(me(game), { x: 240, y: 96 });
  run(game, 4.6);
  assert.deepStrictEqual([me(game).x, me(game).y], [240, 192]);
  assert.strictEqual(me(game).hp, 120);
});

test('standing on lava under the bridge is safe', () => {
  const game = bridgeGame();
  Object.assign(me(game), { x: 220, y: 80 });
  run(game, 1);
  assert.strictEqual(me(game).hp, 120);
  assert.ok(forge.onBridge(game, 220, 80));
});

// ---------- the Roost crumbles ----------
const { FLOORS } = require('../shared/rooms');
function roostGame() {
  const floors = [{ name: 'Roost', roomNames: [], shop: null, rooms: [{ layout: FLOORS[3].rooms[1].layout.map((r) => r.replace('D', 'r')), core: [8, 4, 15, 8] }] }];
  const game = new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, transitions: false, rng: () => 0 });
  // A monster that does nothing, so the room doesn't count as cleared.
  game.enemies.push({ id: 999, type: 'dummy', x: 0, y: 0, r: 1, hp: 1, maxHp: 1, flying: true, invulnerable: true, timers: {}, hitAt: {}, slows: {}, stunUntil: 0 });
  return game;
}
const T = 48;

test('crumbling warns for 2 s, then the outer ring is lava', () => {
  const game = roostGame();
  Object.assign(me(game), center(12, 6));
  assert.strictEqual(forge.ringOf(game, 5, 1), 3);
  assert.strictEqual(forge.ringOf(game, 12, 6), 0);
  assert.strictEqual(forge.crumbleRing(game), true);
  const idx = 1 * game.room.w + 5;
  assert.ok(game.snapshot().crumbling.includes(idx));
  run(game, 1.9);
  assert.ok(!forge.isLava(game, 5 * T + 24, 1 * T + 24));
  run(game, 0.2);
  assert.ok(forge.isLava(game, 5 * T + 24, 1 * T + 24));
  assert.ok(game.snapshot().melted.includes(idx));
  assert.ok(!forge.isLava(game, 6 * T + 24, 2 * T + 24), 'ring 2 still stands');
});

test('crumbling stops after 3 rings and never touches the core', () => {
  const game = roostGame();
  Object.assign(me(game), center(12, 6));
  for (let i = 0; i < 3; i++) { assert.strictEqual(forge.crumbleRing(game), true); run(game, 2.1); }
  assert.strictEqual(forge.crumbleRing(game), false);
  assert.ok(forge.isLava(game, 7 * T + 24, 6 * T + 24));
  assert.ok(!forge.isLava(game, 8 * T + 24, 4 * T + 24));
  assert.strictEqual(me(game).hp, 120);
});

test('a player on a crumbled tile takes lava damage and lands on the core', () => {
  const game = roostGame();
  Object.assign(me(game), center(5, 6));
  forge.crumbleRing(game);
  run(game, 2.1);
  assert.strictEqual(me(game).hp, 70);
  assert.deepStrictEqual([me(game).x, me(game).y], [12 * T, 6.5 * T]);
});
