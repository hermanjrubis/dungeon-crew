const { ECONOMY } = require('../shared/data');
const test = require('node:test');
const assert = require('node:assert');
const { ONE_GLOOP_ROOMS, EMPTY_ROOMS, makeGame, run, center } = require('./helpers');
const { TILE } = require('../shared/tiles');

const p = (game, i) => game.players.get('p' + i);

// Kill every monster, including the Mini Gloops a Gloop splits into.
function killAll(game) {
  while (game.enemies.length) game.damageEnemy(game.enemies[0], 999, 'p0');
}

test('players start at the room entry', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  assert.strictEqual(p(game, 0).x, game.room.entry.x);
  assert.strictEqual(p(game, 1).y, game.room.entry.y);
  assert.strictEqual(game.enemies.length, 1);
});

test('moving right changes x by speed times dt', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const x0 = p(game, 0).x;
  game.setInput('p0', { right: true });
  game.tick(0.05);
  assert.ok(Math.abs(p(game, 0).x - (x0 + 150 * 0.05)) < 0.001, String(p(game, 0).x));
});

test('tick(2) moves no more than 0.1 s worth and cannot pass through a wall', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const x0 = p(game, 0).x;
  game.setInput('p0', { right: true });
  game.tick(2);
  assert.ok(p(game, 0).x - x0 <= 15.001);
  game.setInput('p0', { left: true });
  game.tick(2); game.tick(2); game.tick(2);
  assert.ok(p(game, 0).x - p(game, 0).r >= TILE);
});

test('malformed input is ignored', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const { x, y } = p(game, 0);
  game.setInput('p0', { up: 'yes', right: 1, aim: NaN });
  game.setInput('p0', null);
  game.setInput('nobody', { right: true });
  game.setInput('p0', { up: 'yes', aim: 'left' });
  game.tick(0.05);
  assert.strictEqual(p(game, 0).x, x);
  assert.strictEqual(p(game, 0).y, y);
  assert.strictEqual(p(game, 0).aim, 0);
});

test('killing the last enemy opens the door and gives gold and xp to everyone', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  assert.strictEqual(game.doorOpen, false);
  killAll(game);
  game.tick(0.05);
  assert.strictEqual(game.doorOpen, true);
  for (const pl of game.players.values()) {
    assert.strictEqual(pl.gold, 8 + ECONOMY.roomBonus[0]); // (Gloop 2 + two Mini Gloops 1 each) doubled, plus the room bonus
    assert.strictEqual(pl.xp, 16);
  }
  assert.ok(game.drainEvents().some((e) => e.type === 'roomclear'));
});

test('touching the open door moves everyone to the next room', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  killAll(game);
  game.tick(0.05);
  Object.assign(p(game, 0), center(9, 2));
  p(game, 1).x += 100;
  game.tick(0.05);
  assert.strictEqual(game.roomIndex, 1);
  assert.strictEqual(game.doorOpen, false);
  assert.strictEqual(game.enemies.length, 1);
  for (const pl of game.players.values()) assert.deepStrictEqual({ x: pl.x, y: pl.y }, game.room.entry);
  assert.ok(game.drainEvents().some((e) => e.type === 'nextroom'));
});

test('downed players come back at 30% when the team moves on', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  game.damagePlayer(p(game, 1), 999);
  killAll(game);
  game.tick(0.05);
  Object.assign(p(game, 0), center(9, 2));
  game.tick(0.05);
  assert.strictEqual(p(game, 1).downed, false);
  assert.strictEqual(p(game, 1).hp, 24);
});

test('clearing the last room switches to shop', () => {
  const game = makeGame(['knight'], [ONE_GLOOP_ROOMS[2]]);
  killAll(game);
  game.tick(0.05);
  assert.strictEqual(game.phase, 'shop');
});

test('holding E for 3 s next to a downed teammate revives them at 30%', () => {
  const game = makeGame(['knight', 'knight'], EMPTY_ROOMS);
  game.damagePlayer(p(game, 1), 999);
  assert.strictEqual(p(game, 1).downed, true);
  game.setInput('p0', { interact: true });
  run(game, 2.9);
  assert.strictEqual(p(game, 1).downed, true);
  run(game, 0.15);
  assert.strictEqual(p(game, 1).downed, false);
  assert.strictEqual(p(game, 1).hp, 36);
});

test('revive progress is lost when you let go of E', () => {
  const game = makeGame(['knight', 'knight'], EMPTY_ROOMS);
  game.damagePlayer(p(game, 1), 999);
  game.setInput('p0', { interact: true });
  run(game, 2);
  game.setInput('p0', {});
  game.tick(0.05);
  game.setInput('p0', { interact: true });
  run(game, 2);
  assert.strictEqual(p(game, 1).downed, true);
});

test('feather revives the nearest downed teammate at 50%', () => {
  const game = makeGame(['knight', 'knight'], EMPTY_ROOMS);
  p(game, 0).feathers = 1;
  game.damagePlayer(p(game, 1), 999);
  game.setInput('p0', { use2: true });
  game.tick(0.05);
  assert.strictEqual(p(game, 1).downed, false);
  assert.strictEqual(p(game, 1).hp, 60);
  assert.strictEqual(p(game, 0).feathers, 0);
});

test('a held potion key drinks only one potion', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const me = p(game, 0);
  me.potions = 2;
  me.hp = 50;
  game.setInput('p0', { use1: true });
  run(game, 0.5);
  assert.strictEqual(me.hp, 90);
  assert.strictEqual(me.potions, 1);
});

test('everyone downed resets the room', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  const gloop = game.enemies[0];
  gloop.hp = 3;
  game.damagePlayer(p(game, 0), 999);
  game.damagePlayer(p(game, 1), 999);
  game.tick(0.05);
  assert.strictEqual(game.enemies.length, 1);
  assert.strictEqual(game.enemies[0].hp, 20);
  for (const pl of game.players.values()) {
    assert.strictEqual(pl.downed, false);
    assert.strictEqual(pl.hp, pl.maxHp);
    assert.deepStrictEqual({ x: pl.x, y: pl.y }, game.room.entry);
  }
  assert.ok(game.drainEvents().some((e) => e.type === 'reset'));
});

test('disconnected player does not block reset or count as alive', () => {
  const game = makeGame(['knight', 'archer'], ONE_GLOOP_ROOMS);
  game.damagePlayer(p(game, 0), 999);
  game.removePlayer('p1');
  game.tick(0.05);
  assert.strictEqual(game.players.size, 1);
  assert.strictEqual(p(game, 0).downed, false);
  assert.ok(game.drainEvents().some((e) => e.type === 'reset'));
});

test('defense reduces damage but never below 1', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const me = p(game, 0);
  me.defense = 3;
  game.damagePlayer(me, 2);
  assert.strictEqual(me.hp, 119);
  game.damagePlayer(me, 10);
  assert.strictEqual(me.hp, 112);
});

test('xp levels you up: +10 max HP and +2 damage', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const me = p(game, 0);
  const dmg = game.playerDamage(me);
  game.addXp(me, 50);
  assert.strictEqual(me.level, 2);
  assert.strictEqual(me.maxHp, 130);
  assert.strictEqual(game.playerDamage(me), dmg + 2);
  game.addXp(me, 10000);
  assert.strictEqual(me.level, 10); // the level cap is 10 since Slice 3
});

test('boss HP scales with extra players', () => {
  const game = makeGame(['knight', 'mage'], [['wwwwwww', 'weffMfw', 'wwwwwww']]);
  assert.strictEqual(game.enemies[0].hp, 375);
  assert.strictEqual(game.enemies[0].maxHp, 375);
});

test('snapshot has rounded positions and room info', () => {
  const game = makeGame(['knight'], ONE_GLOOP_ROOMS);
  game.setInput('p0', { right: true });
  game.tick(0.03);
  const s = game.snapshot();
  assert.strictEqual(s.phase, 'playing');
  assert.strictEqual(s.roomCount, 3);
  assert.strictEqual(s.players.length, 1);
  assert.ok(Number.isInteger(s.players[0].x));
  assert.strictEqual(s.enemies[0].type, 'gloop');
});

test('snapshot tells each browser its current walking speed for smooth movement', () => {
  const game = makeGame(['knight'], EMPTY_ROOMS);
  const me = p(game, 0);
  assert.strictEqual(game.snapshot().players[0].speed, 150);
  me.speedMul = 0.1;
  game.applySlow(me, 'test', 0.5, 10);
  assert.strictEqual(game.snapshot().players[0].speed, 83);
});

test('the server remembers the last input number it used and reports it', () => {
  const { Game } = require('../server/game');
  const game = new Game([{ id: 'p0', name: 'Kai', heroClass: 'knight', color: 'orange' }], {
    rooms: [['wwwww', 'wefdw', 'wwwww'], ['wwwww', 'wefdw', 'wwwww']], transitions: false, rng: () => 0
  });
  game.setInput('p0', { right: true, seq: 41 });
  game.setInput('p0', { right: true, seq: 'x' }); // junk is ignored
  game.tick(0.05);
  assert.strictEqual(game.snapshot().players[0].seq, 41);
});
