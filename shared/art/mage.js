// Mage: pointy hat and robe in the player's color, white beard, staff with a gem.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.mage = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { darken, lighten } = rig;
  const { on, commonAnims } = kit;

  const P = {
    head: [
      '..pp........',
      '...pPP......',
      '....PPp.....',
      '....PLPp....',
      '...PLPPp....',
      '...PLPPPp...',
      '..PLPPPPPp..',
      '..yyyyyyyy..',
      'pPPPPPPPPPPp',
      '...SkSSkS...',
      '...wssssw...',
      '...wwWWww...',
      '....wwww....',
      '.....ww.....'
    ],
    torso: [
      '.pPPPPPPPPp.',
      'pPPPPyPPPPPp',
      'pPPPPyPPPPpp',
      '.pPPPyPPPPp.',
      '.pPPPyPPPPp.',
      '.bbbbbybbbb.',
      '.pPPPyPPPPp.',
      '.pPPPyPPPPPp',
      'pPPPPyPPPPPp',
      'pPPPPyPPPPpp',
      'pPPPPyPPPPpp',
      'pppppyyppppp'
    ],
    arm: [
      '.PP.',
      'PPPp',
      'LPpp',
      'LPpp',
      'Pppp',
      '.ss.',
      '.SS.'
    ],
    staff: [
      '..G..',
      '.GgG.',
      '.ggg.',
      'e.g.e',
      '.eEe.',
      '..E..',
      '..E..',
      '..E..',
      '..E..',
      '..e..',
      '..e..',
      '..e..',
      '..e..',
      '..e..',
      '..e..',
      '..e..'
    ],
    foot: [
      'FFf.',
      'FFFf'
    ],
    zap: [
      '..4..',
      '.454.',
      '45654',
      '.454.',
      '..4..'
    ],
    fire: [
      '..2..',
      '.212.',
      '21312',
      '23332',
      '.232.'
    ],
    heal: [
      '...5...',
      '...6...',
      '.5.6.5.',
      '5666665',
      '.5.6.5.',
      '...6...',
      '...5...'
    ]
  };

  const mageRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: P.foot, pivot: [2, 0], at: [14, 28], z: 1 },
      { name: 'legF', parent: 'root', rows: P.foot, pivot: [2, 0], at: [18, 28], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 23], at: [16, 23] },
      { name: 'armB', parent: 'hip', rows: P.arm, pivot: [2, 1], at: [10, 17], z: 3 },
      { name: 'torso', parent: 'hip', rows: P.torso, pivot: [6, 8], at: [16, 24], z: 4 },
      { name: 'head', parent: 'hip', rows: P.head, pivot: [6, 13], at: [16, 18], z: 6 },
      { name: 'staff', parent: 'armF', rows: P.staff, pivot: [2, 11], at: [2, 6], z: 7 },
      { name: 'zap', parent: 'staff', rows: P.zap, pivot: [2, 2], at: [2, 1], z: 9, hidden: true, outline: false },
      { name: 'fire', parent: 'hip', rows: P.fire, pivot: [2, 2], at: [25, 18], z: 9, hidden: true },
      { name: 'heal', parent: 'staff', rows: P.heal, pivot: [3, 3], at: [2, 3], z: 9, hidden: true, outline: false },
      { name: 'armF', parent: 'hip', rows: P.arm, pivot: [1, 1], at: [21, 17], z: 8 }
    ]
  };

  const rest = { armF: { rot: -20 }, staff: { rot: 20 }, armB: { rot: 6 } };
  const common = commonAnims(rest, { down: { staff: { rot: 60 } } });

  const anims = Object.assign({}, common, {
    // magic bolt: the staff jabs forward
    attack: { fps: 14, frames: on(rest, [
      { armF: { rot: 10 }, staff: { rot: -10 }, hip: { rot: -3 } },
      { armF: { rot: -70 }, staff: { rot: 85 }, zap: { show: true }, hip: { rot: 4, x: 1 }, legF: { x: 1 } },
      { armF: { rot: -60 }, staff: { rot: 78 }, zap: { show: true, sx: 0.6, sy: 0.6 }, hip: { rot: 2, x: 1 } },
      { armF: { rot: -30 }, staff: { rot: 50 } }
    ]) },
    // Fireball: both hands push a fireball forward
    q: { fps: 10, frames: on(rest, [
      { armF: { rot: 40 }, armB: { rot: 30 }, staff: { rot: -40 }, hip: { rot: -5, x: -1 } },
      { armF: { rot: -80 }, armB: { rot: -85, x: 4 }, staff: { rot: 80 }, fire: { show: true }, hip: { rot: 4, x: 1 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -85 }, armB: { rot: -90, x: 4 }, staff: { rot: 85 }, fire: { show: true, sx: 1.4, sy: 1.4, x: 1 }, hip: { rot: 5, x: 2 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -40 }, armB: { rot: -30 }, staff: { rot: 40 } }
    ]) },
    // Heal Circle: staff raised high, glowing
    space: { fps: 8, frames: on(rest, [
      { armF: { rot: -90 }, staff: { rot: 90 }, hip: { y: 1 } },
      { armF: { rot: -120 }, staff: { rot: 120 }, heal: { show: true }, hip: { y: -1 }, armB: { rot: 30 } },
      { armF: { rot: -125 }, staff: { rot: 125 }, heal: { show: true, sx: 1.3, sy: 1.3 }, hip: { y: -2 }, armB: { rot: 35 } },
      { armF: { rot: -120 }, staff: { rot: 120 }, heal: { show: true }, hip: { y: -1 }, armB: { rot: 30 } }
    ]) }
  });

  function palette(hex) {
    return {
      o: '#14101C',
      L: lighten(hex, 0.3), P: hex, p: darken(hex, 0.35),
      y: '#F2C14E', b: '#5C3B1E',
      s: '#E8B48A', S: '#C98E66', k: '#120A16',
      w: '#E9E4D4', W: '#B9B2A0',
      e: '#8A5A2E', E: '#B07A44', g: '#5EC8B8', G: '#B8F0E4',
      F: '#3D3452', f: '#2A2438',
      '1': '#FFF1B8', '2': '#E5622B', '3': '#F2A541',
      '4': '#B8F0E4', '5': '#5EC8B8', '6': '#E8FFF8'
    };
  }

  return { size: 32, rig: mageRig, anims, palette, once: ['attack', 'q', 'space', 'hurt'] };
});
