// The floors and their rooms.
//   w wall   f floor   s spikes   x cracked floor   p pit   u puddle   o poison pool
//   d door (exit, opens when the room is clear)   e where players enter
//   g Gloop   b Skitterbat   a Bone Archer   c Sporecap   M Gloop Mother   Q Spore Queen
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
    }
  ];

  return { FLOORS, FLOOR1, FLOOR1_NAME, FLOOR1_ROOM_NAMES, PLAIN };
});
