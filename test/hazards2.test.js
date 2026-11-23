const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const { makeGame, run, center } = require('./helpers');

const ROOM = ['wwwwwwwwww', 'wffffffffw', 'wefofffffw', 'wffffffffw', 'wwwwwwwwww'];
function caveGame(rooms, stalactites = true) {
  const floors = [{ name: 'Cave', roomNames: [], shop: 'forge', stalactites, rooms }];
  return new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], { floors, transitions: false, rng: () => 0 });
}
const me = (game) => game.players.get('p0');

test('poison pools hurt 4 per second', () => {
  const game = makeGame(['knight'], [ROOM, ROOM]);
  Object.assign(me(game), center(3, 2));
  run(game, 1);
  assert.strictEqual(me(game).hp, 116);
});

test('a stalactite shadow shows for 1 s, then the rock hits for 15', () => {
  const game = caveGame([{ layout: ROOM }, { layout: ROOM }]);
  Object.assign(me(game), center(6, 2));
  game.nextRock = game.time;
  game.tick(0.05);
  const shadow = game.zones.find((z) => z.kind === 'rockShadow');
  assert.ok(shadow);
  assert.ok(Math.hypot(shadow.x - me(game).x, shadow.y - me(game).y) < 32);
  run(game, 0.9);
  assert.strictEqual(me(game).hp, 120);
  run(game, 0.15);
  assert.strictEqual(me(game).hp, 105);
  assert.ok(game.drainEvents().some((e) => e.type === 'rockfall'));
});

test('rocks hurt monsters too', () => {
  const game = caveGame([{ layout: ROOM }, { layout: ROOM }]);
  Object.assign(me(game), center(6, 2));
  const m = game.spawnEnemy('mother', center(6, 2).x, center(6, 2).y);
  m.stunUntil = 999;
  game.nextRock = game.time;
  run(game, 1.1);
  assert.strictEqual(m.hp, 235);
});

test("stalactites don't fall in boss rooms or on floors without them", () => {
  const boss = caveGame([{ layout: ROOM }]);
  run(boss, 10);
  assert.ok(!boss.drainEvents().some((e) => e.type === 'rockfall'));
  const calm = caveGame([{ layout: ROOM }, { layout: ROOM }], false);
  run(calm, 10);
  assert.ok(!calm.drainEvents().some((e) => e.type === 'rockfall'));
});

test('holding E next to a torch lights it for everyone', () => {
  const game = caveGame([{ layout: ROOM, torches: [{ tx: 7, ty: 1 }] }, { layout: ROOM }], false);
  assert.strictEqual(game.snapshot().room.torches[0].lit, false);
  Object.assign(me(game), center(7, 2));
  game.setInput('p0', { interact: true });
  game.tick(0.05);
  assert.strictEqual(game.snapshot().room.torches[0].lit, true);
  assert.ok(game.drainEvents().some((e) => e.type === 'torchlit'));
});
