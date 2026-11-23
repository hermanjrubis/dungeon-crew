// Floor 1: the Sunken Cellar. Edit these rows to change the rooms.
//   w wall   f floor   s spikes   x cracked floor   p pit   u puddle
//   d door (exit, opens when the room is clear)   e where players enter
//   g Gloop   b Skitterbat   M Gloop Mother
// Every row must be exactly 24 letters and every room 13 rows.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.rooms = factory(); }
})(this, function () {
  const FLOOR1 = [
    // Room 1: four Gloops and a few spike traps.
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
    // Room 2: Gloops and bats around a pit ringed with cracked floor.
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
    // Room 3: everything at once.
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
    // Room 4: the Gloop Mother's lair. Puddles slow you down.
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

  return { FLOOR1 };
});
