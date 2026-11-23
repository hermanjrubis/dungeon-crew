// The floors and their rooms.
//   w wall   f floor   s spikes   x cracked floor   p pit   u puddle   o poison pool
//   d door (exit, opens when the room is clear)   e where players enter
//   l lava   v geyser vent   j flame-jet nozzle (in a wall)   r crumbling platform
//   g Gloop   b Skitterbat   a Bone Archer   c Sporecap   M Gloop Mother   Q Spore Queen
//   G Rubble Golem   K Hollow King   D Ashmaw
// Every row must be exactly 24 letters and every room 13 rows.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.rooms = factory(); }
})(this, function () {
  // The fixed shape every normal room starts from: walls around, the entrance
  // on the left (e) and a 3-tile exit door on the right (d).
  const PLAIN = [
    'wwwwwwwwwwwwwwwwwwwwwwww',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffd',
    'wefffffffffffffffffffffd',
    'wffffffffffffffffffffffd',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wffffffffffffffffffffffw',
    'wwwwwwwwwwwwwwwwwwwwwwww'
  ];

  // ---------- Floor 1: the Sunken Cellar ----------

  const FLOOR1_NAME = 'Sunken Cellar';
  const FLOOR1_ROOM_NAMES = ['The Damp Entrance', 'The Sinkhole', 'Hall of Traps', "Gloop Mother's Lair"];

  // Hand-made versions of Floor 1. Room 4 is always this lair; rooms 1-3 use
  // these only if the random builder ever fails.
  const FLOOR1 = [
    [
      'wwwwwwwwwwwwwwwwwwwwwwww',
      'wffffffffffffffffffffffw',
      'wffffffffffffffffffffffw',
      'wffffssffffffffffgfffffw',
      'wffffssffffffffffffffffw',
      'wfffffffffgffffffffffffd',
      'weffffffffffffssfffffffd',
      'wfffffffffffffssfgfffffd',
      'wffffffffffffffffffffffw',
      'wffffssffffffffffffffffw',
      'wffffssfffffffffffgffffw',
      'wffffffffffffffffffffffw',
      'wwwwwwwwwwwwwwwwwwwwwwww'
    ],
    [
      'wwwwwwwwwwwwwwwwwwwwwwww',
      'wffffffffffffffffffffffw',
      'wfffffffbfffffffffffbffw',
      'wffffffxxxxxxfffffffgffw',
      'wffffffxppppxffffffffffw',
      'wffffffxppppxffffffffffd',
      'wefffffxxxxxxffffgfffffd',
      'wffffffffffffffffffffffd',
      'wffffuufffffffffffffgffw',
      'wffffuuffffffffffffffffw',
      'wffffffffffffffffffffffw',
      'wffffffffffffffffffffffw',
      'wwwwwwwwwwwwwwwwwwwwwwww'
    ],
    [
      'wwwwwwwwwwwwwwwwwwwwwwww',
      'wffffffffffffffffffffffw',
      'wffbffffffffffffbfffffbw',
      'wffffssffffxxxffffffgffw',
      'wffffssffffxppxffffffffw',
      'wfffffffgffxppxffssffffd',
      'wefffffffffxxxxffssffffd',
      'wffffuufffffffffffffgffd',
      'wffffuufffssfffffffffffw',
      'wfffffffffssffffgffffffw',
      'wffffffffffffffffffffffw',
      'wffffffffffffffffffffffw',
      'wwwwwwwwwwwwwwwwwwwwwwww'
    ],
    [
      'wwwwwwwwwwwwwwwwwwwwwwww',
      'wffffffffffffffffffffffw',
      'wffuufffffffffffffffuufw',
      'wffuuffffffffffffffuuffw',
      'wffffffffffffffffffffffw',
      'wffffffffffffffffffffffd',
      'weffffffffffffMffffffffd',
      'wffffffffffffffffffffffd',
      'wffffffffffffffffffffffw',
      'wffuuffffffffffffffuuffw',
      'wffuufffffffffffffffuufw',
      'wffffffffffffffffffffffw',
      'wwwwwwwwwwwwwwwwwwwwwwww'
    ]
  ];

  // Copy a room shape and put letters on some tiles: paint(PLAIN, [[x, y, 'a'], ...]).
  function paint(shape, marks) {
    const grid = shape.map((r) => [...r]);
    for (const [x, y, ch] of marks) grid[y][x] = ch;
    return grid.map((r) => r.join(''));
  }

  // ---------- Floor 2: the Fungal Caverns ----------

  const FLOOR2_NAME = 'Fungal Caverns';
  const FLOOR2_ROOM_NAMES = ['Glowing Tunnels', 'Mushroom Grove', 'The Dark Hollow', "Spore Queen's Lair"];
  const SPORE_LAIR = paint(PLAIN, [
    [3, 2, 'o'], [4, 2, 'o'], [3, 3, 'o'], [4, 3, 'o'],
    [19, 9, 'o'], [20, 9, 'o'], [19, 10, 'o'], [20, 10, 'o'],
    [7, 3, 'w'], [16, 3, 'w'], [7, 9, 'w'], [16, 9, 'w'],
    [14, 6, 'Q']
  ]);

  // ---------- Floor 3: the Molten Forge ----------

  const FLOOR3_NAME = 'Molten Forge';
  const FLOOR3_ROOM_NAMES = ['Ember Gate', 'Lava Run', 'Furnace Hall', "Hollow King's Hall"];

  // A lava river 2 tiles wide down columns x and x+1.
  function river(shape, x) {
    const marks = [];
    for (let y = 1; y < shape.length - 1; y++) marks.push([x, y, 'l'], [x + 1, y, 'l']);
    return paint(shape, marks);
  }
  const RIVER_STOPS = [2, 3, 4, 5, 6, 7, 8, 9];

  const KINGS_HALL = paint(PLAIN, [
    [6, 3, 'v'], [17, 3, 'v'], [6, 9, 'v'], [17, 9, 'v'],
    [9, 2, 'w'], [14, 2, 'w'], [9, 10, 'w'], [14, 10, 'w'],
    [11, 0, 'j'], [18, 12, 'j'],
    [14, 6, 'K']
  ]);

  // ---------- Floor 4: the Dragon's Roost ----------

  const FLOOR4_NAME = "Dragon's Roost";
  const FLOOR4_ROOM_NAMES = ['Ashen Stair', "Dragon's Roost"];

  // A stone island in a sea of lava. The core (columns 8-15, rows 4-8) never
  // falls; the rings of platforms (r) around it crumble in the dragon's last phase.
  const ROOST_CORE = [8, 4, 15, 8];
  const ROOST = (() => {
    const rows = [];
    for (let y = 0; y < 13; y++) {
      let row = '';
      for (let x = 0; x < 24; x++) {
        if (y === 0 || y === 12 || x === 0 || x === 23) row += 'w';
        else if (x <= 4 || x >= 19) row += 'l';
        else if (x >= 8 && x <= 15 && y >= 4 && y <= 8) row += 'f';
        else row += 'r';
      }
      rows.push(row);
    }
    return paint(rows, [[6, 6, 'e'], [12, 6, 'D']]);
  })();

  // A floor = a name, room names, the shop after it, and its rooms.
  // A room is either { recipe } (traps placed at random every game) or
  // { layout } (hand-made, always the same; used for boss rooms).
  // Recipe "scatter" kinds: spikes, pit (gets a ring of cracked floor), puddle,
  // poison, pillar. count is a number or [min, max]; size is [width, height] in tiles.
  const FLOORS = [
    {
      name: FLOOR1_NAME,
      roomNames: FLOOR1_ROOM_NAMES,
      shop: 'cellar',
      stalactites: false,
      rooms: [
        { recipe: { shape: PLAIN, fallback: FLOOR1[0],
          scatter: [{ kind: 'spikes', count: 3, size: [2, 2] }, { kind: 'pillar', count: [1, 3], size: [1, 1] }],
          monsters: { gloop: 4 } } },
        { recipe: { shape: PLAIN, fallback: FLOOR1[1],
          scatter: [{ kind: 'pit', count: 1, size: [3, 2] }, { kind: 'puddle', count: 1, size: [2, 2] }, { kind: 'pillar', count: [1, 3], size: [1, 1] }],
          monsters: { gloop: 3, bat: 2 } } },
        { recipe: { shape: PLAIN, fallback: FLOOR1[2],
          scatter: [{ kind: 'spikes', count: 3, size: [2, 2] }, { kind: 'pit', count: 1, size: [2, 2] }, { kind: 'puddle', count: 1, size: [2, 2] }, { kind: 'pillar', count: [2, 4], size: [1, 1] }],
          monsters: { gloop: 4, bat: 3 } } },
        { layout: FLOOR1[3] }
      ]
    },
    {
      name: FLOOR2_NAME,
      roomNames: FLOOR2_ROOM_NAMES,
      shop: 'forge',
      stalactites: true,
      rooms: [
        { recipe: { shape: PLAIN,
          fallback: paint(PLAIN, [[12, 2, 'b'], [16, 9, 'b'], [19, 4, 'b'], [18, 3, 'a'], [18, 9, 'a']]),
          scatter: [{ kind: 'poison', count: 2, size: [2, 2] }, { kind: 'pillar', count: [3, 5], size: [1, 1] }],
          monsters: { bat: 3, archer: 2 } } },
        { recipe: { shape: PLAIN,
          fallback: paint(PLAIN, [[17, 2, 'a'], [19, 6, 'a'], [17, 10, 'a'], [10, 3, 'c'], [12, 9, 'c'], [15, 6, 'c']]),
          scatter: [{ kind: 'poison', count: 1, size: [2, 2] }, { kind: 'puddle', count: 2, size: [2, 1] }, { kind: 'pillar', count: [2, 4], size: [1, 1] }],
          monsters: { archer: 3, sporecap: 3 } } },
        { recipe: { shape: PLAIN, dark: [12, 1, 22, 11], torches: 3, fallbackTorches: [{ tx: 13, ty: 2 }, { tx: 18, ty: 6 }, { tx: 13, ty: 10 }],
          fallback: paint(PLAIN, [[10, 2, 'b'], [10, 10, 'b'], [17, 3, 'a'], [17, 9, 'a'], [15, 6, 'c'], [20, 2, 'c']]),
          scatter: [{ kind: 'poison', count: 1, size: [2, 2] }, { kind: 'pillar', count: [2, 4], size: [1, 1] }],
          monsters: { bat: 2, archer: 2, sporecap: 2 } } },
        { layout: SPORE_LAIR, torches: [{ tx: 2, ty: 1 }, { tx: 21, ty: 1 }, { tx: 2, ty: 11 }, { tx: 21, ty: 11 }] }
      ]
    },
    {
      name: FLOOR3_NAME,
      roomNames: FLOOR3_ROOM_NAMES,
      shop: 'crown',
      stalactites: false,
      rooms: [
        { recipe: { shape: PLAIN,
          fallback: paint(PLAIN, [[8, 3, 'v'], [8, 9, 'v'], [15, 6, 'v'], [14, 3, 'g'], [14, 9, 'g'], [18, 6, 'g'], [12, 6, 'G'], [19, 3, 'G']]),
          scatter: [{ kind: 'vent', count: [3, 4], size: [1, 1] }, { kind: 'pit', count: 1, size: [2, 2] }, { kind: 'pillar', count: [2, 4], size: [1, 1] }],
          monsters: { gloop: 3, golem: 2 } } },
        { recipe: { shape: PLAIN, river: { x: 11 },
          fallback: paint(river(PLAIN, 11), [[7, 3, 'v'], [16, 2, 'b'], [16, 10, 'b'], [8, 9, 'b'], [19, 4, 'a'], [19, 8, 'a'], [17, 6, 'G']]),
          fallbackBridge: { tx: 11, stops: RIVER_STOPS },
          scatter: [{ kind: 'vent', count: [1, 2], size: [1, 1] }, { kind: 'pillar', count: [2, 3], size: [1, 1] }],
          monsters: { bat: 3, archer: 2, golem: 1 } } },
        { recipe: { shape: PLAIN, jets: 4,
          fallback: paint(PLAIN, [[6, 0, 'j'], [10, 12, 'j'], [14, 0, 'j'], [18, 12, 'j'], [8, 4, 'v'], [16, 8, 'v'],
            [13, 3, 'G'], [13, 9, 'G'], [19, 4, 'a'], [19, 8, 'a'], [11, 6, 'b'], [17, 6, 'b']]),
          scatter: [{ kind: 'vent', count: 2, size: [1, 1] }, { kind: 'pillar', count: [2, 3], size: [1, 1] }],
          monsters: { golem: 2, archer: 2, bat: 2 } } },
        { layout: KINGS_HALL }
      ]
    },
    {
      name: FLOOR4_NAME,
      roomNames: FLOOR4_ROOM_NAMES,
      shop: null, // the last floor: beating Ashmaw ends the run
      stalactites: false,
      rooms: [
        { recipe: { shape: PLAIN, jets: 2,
          fallback: paint(PLAIN, [[8, 0, 'j'], [15, 12, 'j'], [10, 4, 'v'], [14, 8, 'v'], [17, 3, 'G'], [17, 9, 'G'], [20, 4, 'a'], [20, 8, 'a'], [12, 2, 'b'], [12, 10, 'b']]),
          scatter: [{ kind: 'vent', count: [2, 3], size: [1, 1] }, { kind: 'pillar', count: [2, 3], size: [1, 1] }],
          monsters: { golem: 2, archer: 2, bat: 2 } } },
        { layout: ROOST, core: ROOST_CORE }
      ]
    }
  ];

  return { FLOORS, ROOST, ROOST_CORE, FLOOR4_NAME, FLOOR4_ROOM_NAMES, FLOOR3_NAME, FLOOR3_ROOM_NAMES, RIVER_STOPS, FLOOR1, FLOOR1_NAME, FLOOR1_ROOM_NAMES, FLOOR2_NAME, FLOOR2_ROOM_NAMES, PLAIN };
});
