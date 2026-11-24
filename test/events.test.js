// The server announces every big moment so browsers can draw an effect for it.
const test = require('node:test');
const assert = require('node:assert');
const { ARENA, makeGame, run, center } = require('./helpers');

function place(game, i, x, y) {
  const me = game.players.get('p' + i);
  me.x = x; me.y = y;
  return me;
}
const events = (game, type) => game.drainEvents().filter((e) => e.type === type);
function castOf(classes, keys) {
  const game = makeGame(classes, ARENA);
  place(game, 0, 400, 312);
  game.setInput('p0', { aim: 0, ...keys });
  game.tick(0.05);
  return events(game, 'cast');
}

test('every skill announces a cast with where and which way', () => {
  assert.strictEqual(castOf(['knight'], { q: true })[0].skill, 'bash');
  assert.strictEqual(castOf(['knight'], { space: true })[0].skill, 'taunt');
  assert.strictEqual(castOf(['archer'], { q: true })[0].skill, 'arrowRain');
  assert.strictEqual(castOf(['archer'], { space: true })[0].skill, 'roll');
  assert.strictEqual(castOf(['mage'], { q: true })[0].skill, 'fireball');
  const meteors = castOf(['mage'], { space: true })[0];
  assert.strictEqual(meteors.skill, 'meteors');
  assert.deepStrictEqual([meteors.by, meteors.x, meteors.y, meteors.aim], ['p0', 400, 312, 0]);
  assert.strictEqual(castOf(['cleric'], { q: true })[0].skill, 'mend');
  assert.strictEqual(castOf(['cleric'], { space: true })[0].skill, 'blessing');
});

test('fireballs announce their explosion', () => {
  const game = makeGame(['mage'], ARENA);
  place(game, 0, 400, 312);
  game.spawnEnemy('mother', 520, 312);
  game.setInput('p0', { aim: 0, q: true });
  game.tick(0.05);
  game.setInput('p0', {});
  run(game, 0.4);
  const ex = events(game, 'explode');
  assert.strictEqual(ex.length, 1);
  assert.strictEqual(ex[0].r, 64);
});

test('healing announces how much each player got', () => {
  const game = makeGame(['cleric'], ARENA);
  const me = place(game, 0, 400, 312);
  me.hp = 40;
  game.setInput('p0', { q: true });
  game.tick(0.05);
  game.setInput('p0', {});
  run(game, 0.5);
  const heals = events(game, 'heal');
  assert.ok(heals.length >= 1);
  assert.deepStrictEqual([heals[0].targetId, heals[0].amount], ['p0', 32]);
});

test('drinking a potion announces a heal', () => {
  const game = makeGame(['knight'], ARENA);
  const me = place(game, 0, 400, 312);
  me.hp = 50;
  game.setInput('p0', { use1: true });
  game.tick(0.05);
  assert.deepStrictEqual(events(game, 'heal').map((e) => e.amount), [40]);
});

test('a gloop landing announces where it hit', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 400, 312);
  game.spawnEnemy('gloop', 520, 312);
  run(game, 1.6);
  const lands = events(game, 'land');
  assert.strictEqual(lands.length, 1);
  assert.ok(Math.abs(lands[0].x - 400) < 40);
});

test('bat bites and screeches are announced', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 400, 312);
  const bat = game.spawnEnemy('bat', 560, 312);
  bat.timers.screech = 999;
  bat.timers.swoop = game.time;
  run(game, 0.6);
  assert.strictEqual(events(game, 'bite').length, 1);
  bat.state = 'hover';
  bat.timers.swoop = 999;
  bat.timers.screech = game.time;
  bat.x = 450;
  run(game, 0.8);
  const s = events(game, 'screech');
  assert.strictEqual(s.length, 1);
  assert.strictEqual(s[0].r, 144);
});

test('kills say what died so the burst can match its color', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 100, 600);
  const bat = game.spawnEnemy('bat', 600, 312);
  game.damageEnemy(bat, 999, 'p0');
  assert.strictEqual(events(game, 'kill')[0].enemyType, 'bat');
});

test('stunned monsters show as stunned in the snapshot', () => {
  const game = makeGame(['knight'], ARENA);
  place(game, 0, 600, 312);
  game.spawnEnemy('mother', 650, 312);
  game.setInput('p0', { aim: 0, q: true });
  game.tick(0.05);
  assert.strictEqual(game.snapshot().enemies[0].stunned, true);
});

test('spikes and breaking floor are announced', () => {
  const rooms = [['wwwwwwwwww', 'wffffffffw', 'wefsfxfffw', 'wffffffffw', 'wwwwwwwwww'], ARENA[1]];
  const game = makeGame(['knight'], rooms);
  const me = game.players.get('p0');
  Object.assign(me, center(5, 2));
  game.tick(0.05);
  Object.assign(me, center(3, 2));
  run(game, 2.6);
  const all = game.drainEvents();
  assert.strictEqual(all.filter((e) => e.type === 'crumble').length, 1);
  assert.strictEqual(all.filter((e) => e.type === 'spike').length, 1);
});
