// Knight: armored, sword + shield in the player's color.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.knight = factory(root.DC.rig); }
})(this, function (rig) {
  const { darken, lighten } = rig;
  // ---------------- Knight ----------------
  const KNIGHT_PARTS = {
    head: [
      '...PPP....',
      '..PAAa....',
      '..HHHHHHh.',
      '.HHHhhhhhi',
      '.Hhhhhhhhi',
      '.hvvvvvvvi',
      '.hvVvvvVvi',
      '.ihhhhhhii',
      '..iiijiii.',
      '...jjjj...'
    ],
    torso: [
      '.iHHAAAAHhi.',
      'ihHHAPAAHhhi',
      'ihhhAAAAhhii',
      '.ihhAaaAhii.',
      '.iihAAAAhii.',
      '..bbbbybbb..',
      '..AAAAAAAa..',
      '..AAaAAAaa..',
      '..Aa....Aa..'
    ],
    arm: [
      '.Hh.',
      'HHhi',
      'hhii',
      '.li.',
      '.lk.',
      '.hi.',
      '.ii.'
    ],
    shield: [
      'iHHHHHi',
      'iHAAAhi',
      'iHAyAhi',
      'iHyyyhi',
      'iHAyAhi',
      'iHAAAhi',
      '.ihAhi.',
      '..ihi..',
      '...i...'
    ],
    sword: [
      '..s..',
      '..sS.',
      '..sS.',
      '..sS.',
      '..sS.',
      '..sS.',
      '..sS.',
      '..sS.',
      '..sS.',
      'gggGG',
      '..w..',
      '..w..',
      '..g..'
    ],
    leg: [
      'lllk',
      'lllk',
      'lllk',
      'llkk',
      'FFFf',
      'FFFf'
    ],
    smear: [
      'ee........',
      '.eee......',
      '..eeE.....',
      '...eEE....',
      '....eEE...',
      '.....eEE..',
      '.....eEE..',
      '......eE..',
      '......eE..',
      '.....eEE..',
      '.....eEE..',
      '....eEE...',
      '...eEE....',
      '..eeE.....',
      '.eee......',
      'ee........'
    ],
    shout: [
      '..e...e...e..',
      '...e..e..e...',
      '.............',
      'ee.........ee'
    ]
  };

  const knightRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: KNIGHT_PARTS.leg, pivot: [2, 0], at: [14, 24], z: 1 },
      { name: 'legF', parent: 'root', rows: KNIGHT_PARTS.leg, pivot: [2, 0], at: [18, 24], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 23], at: [16, 23] },
      { name: 'armB', parent: 'hip', rows: KNIGHT_PARTS.arm, pivot: [2, 1], at: [10, 17], z: 3 },
      { name: 'torso', parent: 'hip', rows: KNIGHT_PARTS.torso, pivot: [6, 8], at: [16, 24], z: 4 },
      { name: 'shield', parent: 'armB', rows: KNIGHT_PARTS.shield, pivot: [3, 3], at: [2, 6], z: 5 },
      { name: 'head', parent: 'hip', rows: KNIGHT_PARTS.head, pivot: [5, 9], at: [16, 17], z: 6 },
      { name: 'sword', parent: 'armF', rows: KNIGHT_PARTS.sword, pivot: [2, 11], at: [2, 6], z: 7 },
      { name: 'armF', parent: 'hip', rows: KNIGHT_PARTS.arm, pivot: [1, 1], at: [21, 17], z: 8 },
      { name: 'smear', parent: 'hip', rows: KNIGHT_PARTS.smear, pivot: [0, 8], at: [22, 17], z: 9, hidden: true, outline: false },
      { name: 'shout', parent: 'hip', rows: KNIGHT_PARTS.shout, pivot: [6, 3], at: [16, 6], z: 9, hidden: true, outline: false }
    ]
  };

  const SWORD_REST = 40;
  const knightAnims = {
    idle: { fps: 3, frames: [
      { sword: { rot: SWORD_REST } },
      { hip: { y: 1 }, sword: { rot: SWORD_REST }, armF: { rot: -4 }, armB: { rot: 4 } }
    ] },
    walk: { fps: 9, frames: [
      { legF: { x: 2 }, legB: { x: -2 }, armF: { rot: -18 }, armB: { rot: 14 }, sword: { rot: SWORD_REST } },
      { legB: { y: -2 }, hip: { y: -1 }, sword: { rot: SWORD_REST } },
      { legF: { x: -2 }, legB: { x: 2 }, armF: { rot: 18 }, armB: { rot: -14 }, sword: { rot: SWORD_REST } },
      { legF: { y: -2 }, hip: { y: -1 }, sword: { rot: SWORD_REST } }
    ] },
    attack: { fps: 14, loopPause: 0.4, frames: [
      { hip: { rot: -6, x: -1 }, armF: { rot: -135 }, sword: { rot: 175 }, legF: { x: 1 } },
      { hip: { rot: 4, x: 1 }, armF: { rot: -95 }, sword: { rot: 175 }, smear: { show: true }, legF: { x: 2 }, legB: { x: -1 } },
      { hip: { rot: 8, x: 1 }, armF: { rot: -45 }, sword: { rot: 165 }, legF: { x: 2 }, legB: { x: -1 } },
      { hip: { rot: 3 }, armF: { rot: -20 }, sword: { rot: 100 }, legF: { x: 1 } }
    ] },
    q: { fps: 12, loopPause: 0.4, frames: [
      { hip: { x: -1 }, armB: { rot: 40, z: 9 }, shield: { z: 10 }, sword: { rot: SWORD_REST } },
      { hip: { x: 2, rot: 6 }, armB: { rot: -80, x: 8, z: 9 }, shield: { z: 10 }, legF: { x: 3 }, legB: { x: 0 }, sword: { rot: SWORD_REST } },
      { hip: { x: 2, rot: 6 }, armB: { rot: -85, x: 9, z: 9 }, shield: { z: 10 }, legF: { x: 3 }, legB: { x: 0 }, sword: { rot: SWORD_REST } },
      { hip: { x: 1 }, armB: { rot: -30, x: 3, z: 9 }, shield: { z: 10 }, legF: { x: 1 }, sword: { rot: SWORD_REST } }
    ] },
    space: { fps: 8, loopPause: 0.3, frames: [
      { hip: { y: 1 }, armF: { rot: -60 }, sword: { rot: 30 } },
      { hip: { y: -1 }, armF: { rot: -130 }, sword: { rot: 170 }, armB: { rot: 30 }, shout: { show: true }, legF: { x: 1 }, legB: { x: -1 } },
      { hip: { y: -2 }, armF: { rot: -135 }, sword: { rot: 172 }, armB: { rot: 35 }, shout: { show: true, y: -1 }, legF: { x: 1 }, legB: { x: -1 } },
      { hip: { y: -1 }, armF: { rot: -130 }, sword: { rot: 170 }, armB: { rot: 30 }, shout: { show: true }, legF: { x: 1 }, legB: { x: -1 } }
    ] },
    hurt: { fps: 6, loopPause: 0.5, frames: [
      { hip: { rot: -12, x: -2 }, head: { y: 1 }, armF: { rot: 30 }, armB: { rot: -30 }, sword: { rot: SWORD_REST }, legF: { x: -1 } }
    ] },
    roll: { fps: 16, frames: [0, 90, 180, 270].map((d) => ({ root: rig.spin(d, 12), hip: { y: 3 }, head: { y: 2 }, legF: { y: -3, x: -1 }, legB: { y: -3, x: 1 }, armF: { rot: -60 }, armB: { rot: 60 }, sword: { rot: 150 } })) },
    down: { fps: 2, frames: [
      { root: { rot: -90, x: 11, y: -6 }, sword: { rot: 180 }, armF: { rot: -10 } }
    ] }
  };

  function knightPalette(hex) {
    return {
      o: '#14101C',
      H: '#D6D1E2', h: '#A7A1B8', i: '#6E6884', j: '#4A4560',
      v: '#120A16', V: '#5C5470',
      P: lighten(hex, 0.3), A: hex, a: darken(hex, 0.35),
      b: '#5C3B1E', y: '#F2C14E',
      l: '#3D3452', k: '#2A2438', F: '#5A4E6E', f: '#2A2438',
      s: '#F4F1E8', S: '#B9B2C8', g: '#F2C14E', G: '#B8862E', w: '#7A4E2A',
      e: '#FFFFFF', E: lighten(hex, 0.55)
    };
  }

  return { size: 32, rig: knightRig, anims: knightAnims, palette: knightPalette, once: ['attack', 'q', 'space', 'hurt'] };
});
