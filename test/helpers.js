// Small helpers shared by the server tests.
const { Game } = require('../server/game');
const { TILE } = require('../shared/tiles');

// Three tiny rooms with one Gloop each (the last room has no door).
const ONE_GLOOP_ROOMS = [
  ['wwwwwwwwww', 'wffffffffw', 'weffffgffd', 'wffffffffw', 'wwwwwwwwww'],
  ['wwwwwwwwww', 'wffffffffw', 'weffffgffd', 'wffffffffw', 'wwwwwwwwww'],
  ['wwwwwwwwww', 'wffffffffw', 'weffffgffw', 'wffffffffw', 'wwwwwwwwww']
];

// Three empty rooms: no enemies, so nothing attacks during a test.
const EMPTY_ROOMS = [
  ['wwwwwwwwww', 'wffffffffw', 'wefffffffd', 'wffffffffw', 'wwwwwwwwww'],
  ['wwwwwwwwww', 'wffffffffw', 'wefffffffd', 'wffffffffw', 'wwwwwwwwww'],
  ['wwwwwwwwww', 'wffffffffw', 'wefffffffw', 'wffffffffw', 'wwwwwwwwww']
];

// A wide open room with nothing in it, for combat and AI tests.
const ARENA = [[
  'wwwwwwwwwwwwwwwwwwwwwwww',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wefffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wffffffffffffffffffffffw',
  'wwwwwwwwwwwwwwwwwwwwwwww'
], [
  'wwwwwwwwwwwwwwwwwwwwwwww',
  'wefffffffffffffffffffffw',
  'wwwwwwwwwwwwwwwwwwwwwwww'
]];

function makeGame(classes, rooms, opts = {}) {
  const players = classes.map((heroClass, i) => ({
    id: 'p' + i, name: 'P' + i, heroClass, color: ['orange', 'blue', 'teal', 'pink'][i]
  }));
  return new Game(players, { rooms, rng: () => 0, ...opts });
}

// Run the game for `seconds` in 0.05 s ticks.
function run(game, seconds) {
  const n = Math.round(seconds / 0.05);
  for (let i = 0; i < n; i++) game.tick(0.05);
}

const center = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

module.exports = { ONE_GLOOP_ROOMS, EMPTY_ROOMS, ARENA, makeGame, run, center };
