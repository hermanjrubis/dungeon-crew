// Title cards between stages. The game freezes while a card is showing.
const test = require('node:test');
const assert = require('node:assert');
const { ONE_GLOOP_ROOMS, makeGame, run, center } = require('./helpers');

const withCards = (classes, rooms) => makeGame(classes, rooms, { transitions: true });
const p = (game, i) => game.players.get('p' + i);
function killAll(game) {
  while (game.enemies.length) game.damageEnemy(game.enemies[0], 999, 'p0');
}

test('the game starts with a floor title card and nobody moves during it', () => {
  const game = withCards(['knight'], ONE_GLOOP_ROOMS);
  const s = game.snapshot();
  assert.strictEqual(s.transition.kind, 'start');
  assert.strictEqual(s.transition.title, 'Floor 1 · Sunken Cellar');
  const x = p(game, 0).x;
  const g = { x: game.enemies[0].x };
  game.setInput('p0', { right: true });
  run(game, 1.5);
  assert.strictEqual(p(game, 0).x, x);
  assert.strictEqual(game.enemies[0].x, g.x);
  run(game, 0.6);
  assert.strictEqual(game.snapshot().transition, null);
  assert.ok(p(game, 0).x > x);
});

test('going through the door shows the next room card and monsters wait', () => {
  const game = withCards(['knight'], ONE_GLOOP_ROOMS);
  run(game, 2.1);
  killAll(game);
  game.tick(0.05);
  Object.assign(p(game, 0), center(9, 2));
  game.tick(0.05);
  const t = game.snapshot().transition;
  assert.strictEqual(t.kind, 'room');
  assert.strictEqual(t.title, 'Room 2 of 3');
  const gx = game.enemies[0].x;
  run(game, 1.4);
  assert.strictEqual(game.enemies[0].x, gx);
  run(game, 0.5);
  assert.strictEqual(game.snapshot().transition, null);
});

test('the last room gets a boss card', () => {
  const game = withCards(['knight'], ONE_GLOOP_ROOMS);
  run(game, 2.1);
  for (let room = 0; room < 2; room++) {
    killAll(game);
    game.tick(0.05);
    Object.assign(p(game, 0), center(9, 2));
    game.tick(0.05);
    run(game, 2);
  }
  assert.strictEqual(game.roomIndex, 2);
  assert.ok(game.drainEvents().some((e) => e.type === 'transition' && e.kind === 'boss'));
});

test('clearing the last room shows a floor-cleared card, then opens the shop', () => {
  const game = withCards(['knight'], [ONE_GLOOP_ROOMS[2]]);
  run(game, 2.1);
  killAll(game);
  game.tick(0.05);
  assert.strictEqual(game.phase, 'playing');
  assert.strictEqual(game.snapshot().transition.kind, 'floorclear');
  run(game, 2.4);
  assert.strictEqual(game.phase, 'playing');
  run(game, 0.2);
  assert.strictEqual(game.phase, 'shop');
});

test('everyone falling shows a try-again card', () => {
  const game = withCards(['knight'], ONE_GLOOP_ROOMS);
  run(game, 2.1);
  game.damagePlayer(p(game, 0), 999);
  game.tick(0.05);
  assert.strictEqual(game.snapshot().transition.kind, 'reset');
});

test('a paused game keeps the card on screen until it resumes', () => {
  const game = withCards(['knight'], ONE_GLOOP_ROOMS);
  game.setPaused('p0', true);
  run(game, 5);
  assert.strictEqual(game.snapshot().transition.kind, 'start');
});
