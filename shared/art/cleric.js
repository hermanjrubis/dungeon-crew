// Cleric: white hooded robe with gold trim, a stole in the player's color, and a
// staff topped with a silver moon.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.cleric = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { darken } = rig;
  const { on, commonAnims } = kit;

  const P = {
    head: [
      '...WWWw...',
      '..WWwwwwv.',
      '.WWwwyyyyv',
      '.Wwwjssssj',
      '.wwwjsksks',
      '.wwwjsssss',
      '.vwwjsSSSs',
      '..vwwjsss.',
      '..vvwwwv..',
      '...vwwv...'
    ],
    torso: [
      '.wWWPPPPWWw.',
      'wWWWPyyPWWWv',
      'wWWWPwwPWWvv',
      '.wWWPwwPWWv.',
      '.wWWPwwPWWv.',
      '.bbbPbybPbb.',
      '.wWWPwwPWWv.',
      '.wWWpwwpWWWv',
      'wWWWpwwpWWWv',
      'wWWWWwwWWWvv',
      'wWWWWwwWWWvv',
      'yyyyyyyyyyyy'
    ],
    arm: [
      '.WW.',
      'WWWv',
      'WWvv',
      'Wwvv',
      'wvvv',
      '.ss.',
      '.SS.'
    ],
    staff: [
      '...M...',
      '..MgM..',
      '.M.g.M.',
      'M..g..m',
      '.m.g.m.',
      '..mym..',
      '...e...',
      '...e...',
      '...e...',
      '...E...',
      '...e...',
      '...e...',
      '...e...',
      '...e...',
      '...E...',
      '...e...'
    ],
    foot: [
      'FFf.',
      'FFFf'
    ],
    glow: [
      '..1..',
      '.121.',
      '12321',
      '.121.',
      '..1..'
    ],
    halo: [
      '.222222.',
      '2......2',
      '.222222.'
    ],
    aura: [
      '....1....1....',
      '..1........1..',
      '1............1',
      '..............',
      '1............1',
      '..............',
      '1............1',
      '..1........1..',
      '....1....1....'
    ]
  };

  const clericRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'aura', parent: 'root', rows: P.aura, pivot: [7, 4], at: [16, 18], z: 0, hidden: true, outline: false },
      { name: 'legB', parent: 'root', rows: P.foot, pivot: [2, 0], at: [14, 28], z: 1 },
      { name: 'legF', parent: 'root', rows: P.foot, pivot: [2, 0], at: [18, 28], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 23], at: [16, 23] },
      { name: 'armB', parent: 'hip', rows: P.arm, pivot: [2, 1], at: [10, 17], z: 3 },
      { name: 'torso', parent: 'hip', rows: P.torso, pivot: [6, 8], at: [16, 24], z: 4 },
      { name: 'head', parent: 'hip', rows: P.head, pivot: [5, 9], at: [16, 17], z: 6 },
      { name: 'halo', parent: 'head', rows: P.halo, pivot: [4, 1], at: [5, -2], z: 6.5, hidden: true, outline: false },
      { name: 'staff', parent: 'armF', rows: P.staff, pivot: [3, 11], at: [2, 6], z: 7 },
      { name: 'glow', parent: 'staff', rows: P.glow, pivot: [2, 2], at: [3, 3], z: 9, hidden: true, outline: false },
      { name: 'armF', parent: 'hip', rows: P.arm, pivot: [1, 1], at: [21, 17], z: 8 }
    ]
  };

  const rest = { armF: { rot: -20 }, staff: { rot: 20 }, armB: { rot: 6 } };
  const common = commonAnims(rest, { down: { staff: { rot: 60 } } });

  const anims = Object.assign({}, common, {
    // a small orb of light from the staff
    attack: { fps: 14, frames: on(rest, [
      { armF: { rot: 10 }, staff: { rot: -10 } },
      { armF: { rot: -70 }, staff: { rot: 80 }, glow: { show: true }, hip: { rot: 3 } },
      { armF: { rot: -60 }, staff: { rot: 72 }, glow: { show: true, sx: 0.6, sy: 0.6 } },
      { armF: { rot: -30 }, staff: { rot: 45 } }
    ]) },
    // Mending Light: staff raised, light pouring out
    q: { fps: 10, frames: on(rest, [
      { armF: { rot: -90 }, staff: { rot: 90 } },
      { armF: { rot: -120 }, staff: { rot: 120 }, glow: { show: true }, hip: { y: -1 }, armB: { rot: 25 } },
      { armF: { rot: -122 }, staff: { rot: 122 }, glow: { show: true, sx: 1.4, sy: 1.4 }, hip: { y: -1 }, armB: { rot: 28 } },
      { armF: { rot: -100 }, staff: { rot: 100 }, glow: { show: true, sx: 0.8, sy: 0.8 } }
    ]) },
    // Moonlight Blessing: arms up, halo and a ring of light, floating a little
    space: { fps: 8, frames: on(rest, [
      { armF: { rot: -150 }, armB: { rot: 150 }, staff: { rot: 150 }, halo: { show: true }, hip: { y: -1 } },
      { armF: { rot: -158 }, armB: { rot: 158 }, staff: { rot: 158 }, halo: { show: true }, aura: { show: true }, glow: { show: true }, hip: { y: -2 }, legF: { y: -1 }, legB: { y: -1 } },
      { armF: { rot: -160 }, armB: { rot: 160 }, staff: { rot: 160 }, halo: { show: true, y: -1 }, aura: { show: true, sx: 1.1, sy: 1.1 }, glow: { show: true, sx: 1.3, sy: 1.3 }, hip: { y: -3 }, legF: { y: -2 }, legB: { y: -2 } },
      { armF: { rot: -158 }, armB: { rot: 158 }, staff: { rot: 158 }, halo: { show: true }, aura: { show: true }, glow: { show: true }, hip: { y: -2 }, legF: { y: -1 }, legB: { y: -1 } }
    ]) }
  });

  function palette(hex) {
    return {
      o: '#14101C',
      W: '#FFFFFF', w: '#E8E4F0', v: '#B8B2CC', j: '#8E88A8',
      y: '#F2C14E', b: '#B8862E',
      P: hex, p: darken(hex, 0.3),
      s: '#E8B48A', S: '#C98E66', k: '#120A16',
      M: '#E8F4FF', m: '#9AD7F0', g: '#5EC8F0', e: '#8A5A2E', E: '#B07A44',
      F: '#8E88A8', f: '#5C5470',
      '1': '#FFF6C8', '2': '#FFE48A', '3': '#FFFFFF'
    };
  }

  return { size: 32, rig: clericRig, anims, palette, once: ['attack', 'q', 'space', 'hurt'] };
});
