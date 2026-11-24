// Engineer: cap and shirt in the player's color, goggles, overalls, big wrench.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.engineer = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { darken, lighten } = rig;
  const { on, commonAnims } = kit;

  const P = {
    head: [
      '..CCCc....',
      '.CCcccx...',
      '.Ccccccx..',
      '.xxxxxxxxx',
      '.nGgnnGgn.',
      '.ssksskss.',
      '.sssssssS.',
      '..sSSSSs..',
      '...ssss...',
      '...SSSS...'
    ],
    torso: [
      '.bbaAAAAabb.',
      'bbbaAAAAabbb',
      '.bbaAyyAabb.',
      '..zaAAAAaz..',
      '..zaAAAAaz..',
      '..yYyyyYyy..',
      '..aAAAAAAa..',
      '..aAAzAAAa..',
      '..za....az..'
    ],
    arm: [
      '.bb.',
      'bbbx',
      'bbxx',
      '.sS.',
      '.sS.',
      '.FF.',
      '.ff.'
    ],
    leg: [
      'aAAz',
      'aAAz',
      'aAzz',
      'azzz',
      'FFFf',
      'FFFf'
    ],
    wrench: [
      'w...w',
      'Ww.wV',
      'WwwwV',
      '.WwV.',
      '..wV.',
      '..wV.',
      '..wV.',
      '..wV.',
      '..wV.',
      '..ww.',
      '..VV.'
    ],
    mine: [
      '..rr..',
      '.VVVV.',
      'VWWWWV',
      '.VVVV.'
    ],
    spark: [
      '1...1',
      '.1.1.',
      '..2..',
      '.1.1.',
      '1...1'
    ],
    smear: [
      'ee.......',
      '.eee.....',
      '..eeE....',
      '...eEE...',
      '....eEE..',
      '....eEE..',
      '.....eE..',
      '.....eE..',
      '....eEE..',
      '...eEE...',
      '.eeeE....',
      'ee.......'
    ]
  };

  const engRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: P.leg, pivot: [2, 0], at: [14, 24], z: 1 },
      { name: 'legF', parent: 'root', rows: P.leg, pivot: [2, 0], at: [18, 24], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 23], at: [16, 23] },
      { name: 'armB', parent: 'hip', rows: P.arm, pivot: [2, 1], at: [10, 17], z: 3 },
      { name: 'torso', parent: 'hip', rows: P.torso, pivot: [6, 8], at: [16, 24], z: 4 },
      { name: 'head', parent: 'hip', rows: P.head, pivot: [4, 9], at: [15, 17], z: 6 },
      { name: 'wrench', parent: 'armF', rows: P.wrench, pivot: [2, 9], at: [2, 6], z: 7 },
      { name: 'held', parent: 'armF', rows: P.mine, pivot: [3, 1], at: [2, 7], z: 9, hidden: true },
      { name: 'armF', parent: 'hip', rows: P.arm, pivot: [1, 1], at: [21, 17], z: 8 },
      { name: 'mine', parent: 'root', rows: P.mine, pivot: [3, 3], at: [25, 29], z: 9, hidden: true },
      { name: 'spark', parent: 'root', rows: P.spark, pivot: [2, 4], at: [26, 28], z: 10, hidden: true, outline: false },
      { name: 'smear', parent: 'hip', rows: P.smear, pivot: [0, 6], at: [22, 17], z: 10, hidden: true, outline: false }
    ]
  };

  const rest = { armF: { rot: -10 }, wrench: { rot: 30 }, armB: { rot: 6 } };
  const common = commonAnims(rest, { down: { wrench: { rot: 120 } } });

  const anims = Object.assign({}, common, {
    // wrench swing
    attack: { fps: 14, frames: on(rest, [
      { armF: { rot: -125 }, wrench: { rot: 145 }, hip: { rot: -5, x: -1 } },
      { armF: { rot: -85 }, wrench: { rot: 145 }, smear: { show: true }, hip: { rot: 4, x: 1 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -35 }, wrench: { rot: 135 }, hip: { rot: 6, x: 1 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -10 }, wrench: { rot: 70 }, hip: { rot: 2 } }
    ]) },
    // Turret: kneel and bang it together
    q: { fps: 10, frames: on(rest, [
      { hip: { y: 3, x: 1 }, legF: { x: 2, y: -1 }, armF: { rot: -150 }, wrench: { rot: 150 } },
      { hip: { y: 3, x: 1, rot: 8 }, legF: { x: 2, y: -1 }, armF: { rot: -30 }, wrench: { rot: 130 }, spark: { show: true } },
      { hip: { y: 3, x: 1 }, legF: { x: 2, y: -1 }, armF: { rot: -150 }, wrench: { rot: 150 } },
      { hip: { y: 3, x: 1, rot: 8 }, legF: { x: 2, y: -1 }, armF: { rot: -30 }, wrench: { rot: 130 }, spark: { show: true, sx: 1.3, sy: 1.3 } }
    ]) },
    // Mine: crouch and set a mine on the floor
    space: { fps: 8, frames: on(rest, [
      { hip: { y: 1 }, armF: { rot: -40 }, held: { show: true }, wrench: { show: false } },
      { hip: { y: 3, rot: 10, x: 1 }, armF: { rot: -20 }, held: { show: true }, wrench: { show: false }, legF: { x: 2 } },
      { hip: { y: 3, rot: 10, x: 1 }, armF: { rot: -15 }, mine: { show: true }, wrench: { show: false }, legF: { x: 2 } },
      { hip: { y: 1 }, mine: { show: true } }
    ]) }
  });

  function palette(hex) {
    return {
      o: '#14101C',
      C: lighten(hex, 0.3), c: hex, x: darken(hex, 0.35), b: hex,
      n: '#3D3452', g: '#9AD7F0', G: '#E8F8FF',
      s: '#E8B48A', S: '#C98E66', k: '#120A16',
      A: '#5E7096', a: '#4A5A7A', z: '#36425C',
      y: '#F2C14E', Y: '#B8862E',
      F: '#6B4A2E', f: '#4A321E',
      W: '#F4F1E8', w: '#CFC8DE', V: '#8C84A3', r: '#E5534B',
      e: '#FFFFFF', E: lighten(hex, 0.55), '1': '#FFF1B8', '2': '#F2A541'
    };
  }

  return { size: 32, rig: engRig, anims, palette, once: ['attack', 'q', 'space', 'hurt'] };
});
