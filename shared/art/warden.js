// Stonewarden: a big armored tank. Visor and chest stone glow in the player's color.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.warden = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { darken, lighten } = rig;
  const { on, commonAnims } = kit;

  const P = {
    head: [
      '...hHHHh....',
      '..hHHHHHhi..',
      '.hHHhhhhhhi.',
      '.hHhhhhhhhi.',
      '.hkKkkkkkhi.',
      '.hhhhhhhhhi.',
      '.ihhhhhhhii.',
      '..iiiiiiiii.',
      '...jjjjjj...',
      '....jjjj....'
    ],
    torso: [
      '..dDDAAAAAADDd..',
      '.dDDAAAAAAAADDd.',
      '.dDAAAkKKkAAADd.',
      '.ddAAAkkkkAAAdd.',
      '..cAAAAkkAAAAc..',
      '..cAAAAAAAAAAc..',
      '..bbbbbBbbbbbb..',
      '..cAAAAccAAAAc..',
      '..cAAAc..cAAAc..',
      '...ccc....ccc...'
    ],
    arm: [
      '.XXx..',
      'XXXxxi',
      'Xxxxxi',
      '.aAc..',
      '.aAc..',
      '.hhhi.',
      '.hhhi.',
      '..ii..'
    ],
    leg: [
      'llllm',
      'llllm',
      'lllmm',
      'FFFFf',
      'FFFFf',
      'FFFFf'
    ],
    rock: [
      '.RRr.',
      'RRrrq',
      'Rrrrq',
      'rrrqq',
      '.qqq.'
    ],
    boulder: [
      '...RRRrr...',
      '.RRRrrrrrq.',
      'RRRrrrrrrqq',
      'RRrrrrrrqqq',
      'Rrrrrrrrqqq',
      'rrrrrrrqqqq',
      'rrrrrrqqqqq',
      '.rrrqqqqqq.',
      '..qqqqqqq..'
    ],
    dust: [
      '..7.....8......8.....7..',
      '.787...878....878...787.',
      '78887.88888..88888.78887'
    ]
  };

  const wardenRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: P.leg, pivot: [2, 0], at: [13, 24], z: 1 },
      { name: 'legF', parent: 'root', rows: P.leg, pivot: [2, 0], at: [19, 24], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 23], at: [16, 23] },
      { name: 'armB', parent: 'hip', rows: P.arm, pivot: [3, 1], at: [9, 16], z: 3 },
      { name: 'torso', parent: 'hip', rows: P.torso, pivot: [8, 9], at: [16, 24], z: 4 },
      { name: 'head', parent: 'hip', rows: P.head, pivot: [6, 9], at: [16, 16], z: 6 },
      { name: 'boulder', parent: 'hip', rows: P.boulder, pivot: [5, 8], at: [16, 6], z: 7, hidden: true },
      { name: 'rock', parent: 'armF', rows: P.rock, pivot: [2, 2], at: [3, 7], z: 9, hidden: true },
      { name: 'armF', parent: 'hip', rows: P.arm, pivot: [2, 1], at: [23, 16], z: 8 },
      { name: 'dust', parent: 'root', rows: P.dust, pivot: [12, 2], at: [16, 29], z: 10, hidden: true, outline: false }
    ]
  };

  const rest = { armF: { rot: -6 }, armB: { rot: 6 } };
  const common = commonAnims(rest, { rollCenter: 11 });

  const anims = Object.assign({}, common, {
    // sling a rock
    attack: { fps: 12, frames: on(rest, [
      { armF: { rot: 140 }, rock: { show: true }, hip: { rot: -5, x: -1 } },
      { armF: { rot: -170 }, rock: { show: true }, hip: { rot: -2 } },
      { armF: { rot: -95 }, hip: { rot: 5, x: 1 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -40 }, hip: { rot: 2 } }
    ]) },
    // Boulder Toss: heave a boulder over the head and throw it
    q: { fps: 8, frames: on(rest, [
      { armF: { rot: -165 }, armB: { rot: 165 }, boulder: { show: true, y: 3 }, hip: { y: 2 } },
      { armF: { rot: -170 }, armB: { rot: 170 }, boulder: { show: true }, hip: { y: 0, rot: -6, x: -1 } },
      { armF: { rot: -100 }, armB: { rot: -100, x: 6 }, hip: { rot: 6, x: 2 }, legF: { x: 3 }, legB: { x: -1 } },
      { armF: { rot: -50 }, armB: { rot: -30, x: 2 }, hip: { rot: 2, x: 1 } }
    ]) },
    // Quake Stomp: jump and slam the ground
    space: { fps: 10, frames: on(rest, [
      { hip: { y: 2 }, armF: { rot: -150 }, armB: { rot: 150 } },
      { root: { y: -5 }, armF: { rot: -165 }, armB: { rot: 165 }, legF: { y: -2 }, legB: { y: -2 } },
      { hip: { y: 3 }, armF: { rot: -20 }, armB: { rot: 20 }, legF: { x: 2 }, legB: { x: -2 }, dust: { show: true } },
      { hip: { y: 2 }, armF: { rot: -10 }, armB: { rot: 10 }, legF: { x: 2 }, legB: { x: -2 }, dust: { show: true, sx: 1.3, y: -1 } }
    ]) }
  });

  function palette(hex) {
    return {
      o: '#14101C',
      H: '#B9B2C8', h: '#8C84A3', i: '#5C5470', j: '#3D3650',
      k: hex, K: lighten(hex, 0.5), X: lighten(hex, 0.15), x: darken(hex, 0.3),
      D: '#CFC8DE', d: '#A79FBC', A: '#857B90', a: '#6E6378', c: '#4E4558',
      b: darken(hex, 0.25), B: '#F2C14E',
      l: '#3D3452', m: '#2A2438', F: '#5A4E6E', f: '#2A2438',
      R: '#A08466', r: '#7A6248', q: '#55432F',
      '7': '#8C84A3', '8': '#B9B2C8'
    };
  }

  return { size: 32, rig: wardenRig, anims, palette, once: ['attack', 'q', 'space', 'hurt'] };
});
