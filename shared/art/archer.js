// Archer: hooded ranger in the player's color, bow in hand, quiver on the back.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.archer = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { darken, lighten } = rig;
  const { on, add, commonAnims } = kit;

  const P = {
    head: [
      '...HHHh...',
      '..HHhhhhi.',
      '.HHhhjjjhi',
      '.Hhhjssssj',
      '.hhhjsksks',
      '.hhhjsssss',
      '.ihhjsSSSs',
      '..ihhjsss.',
      '..iihhhi..',
      '...ihhi...'
    ],
    torso: [
      '..hhAAAAhh..',
      '.ihAAaAAAhi.',
      '.iAAAbaAAAi.',
      '..cAAAbAAc..',
      '..cAAAAbAc..',
      '..bbbbybbb..',
      '..aAAAAAAa..',
      '..aAAaAAAa..',
      '..ca....ac..'
    ],
    arm: [
      '.hh.',
      'hhhi',
      'Aaci',
      '.Ac.',
      '.Ac.',
      '.sS.',
      '.SS.'
    ],
    quiver: [
      'r.rr',
      'rere',
      '.ee.',
      'qQqq',
      'qQqq',
      'qQqq',
      'qQqq',
      'qqqq',
      '.qq.'
    ],
    bow: [
      'W.....',
      '.W....',
      '..W...',
      '..Ww..',
      '...W..',
      '...Ww.',
      '...Ww.',
      '...Ww.',
      '...Ww.',
      '...W..',
      '..Ww..',
      '..W...',
      '.W....',
      'W.....'
    ],
    string: ['t', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't'],
    arrow: [
      'r..........',
      'reeeeeeeepp',
      'r..........'
    ],
    leg: [
      'lllm',
      'lllm',
      'lllm',
      'llmm',
      'FFFf',
      'FFFf'
    ],
    twang: [
      '1.1',
      '.1.',
      '1.1'
    ]
  };

  const archerRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: P.leg, pivot: [2, 0], at: [14, 24], z: 1 },
      { name: 'legF', parent: 'root', rows: P.leg, pivot: [2, 0], at: [18, 24], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 23], at: [16, 23] },
      { name: 'quiver', parent: 'hip', rows: P.quiver, pivot: [2, 4], at: [11, 19], z: 0 },
      { name: 'armB', parent: 'hip', rows: P.arm, pivot: [2, 1], at: [10, 17], z: 3 },
      { name: 'torso', parent: 'hip', rows: P.torso, pivot: [6, 8], at: [16, 24], z: 4 },
      { name: 'head', parent: 'hip', rows: P.head, pivot: [5, 9], at: [16, 17], z: 6 },
      { name: 'armF', parent: 'hip', rows: P.arm, pivot: [1, 1], at: [21, 17], z: 8 },
      // the bow stays upright however the arm turns (it is turned on its own)
      { name: 'bow', parent: 'armF', rows: P.bow, pivot: [4, 7], at: [2, 6], z: 9, rigid: true },
      { name: 'string', parent: 'bow', rows: P.string, pivot: [0, 0], at: [0, 0], z: 9.5, outline: false },
      { name: 'arrow', parent: 'bow', rows: P.arrow, pivot: [0, 1], at: [0, 7], z: 10, hidden: true },
      { name: 'twang', parent: 'bow', rows: P.twang, pivot: [1, 1], at: [-1, 7], z: 11, hidden: true, outline: false }
    ]
  };

  const rest = { armF: { rot: -25 }, armB: { rot: 8 }, quiver: { rot: -20 } };
  const common = commonAnims(rest, { tuck: { bow: { show: false }, string: { show: false } }, down: { bow: { rot: -90, x: -4, y: 4 } } });

  const anims = Object.assign({}, common, {
    attack: { fps: 14, frames: on(rest, [
      { armF: { rot: -50 }, armB: { rot: -40 }, arrow: { show: true, x: 1 } },
      { armF: { rot: -65 }, armB: { rot: -75, x: 2 }, arrow: { show: true, x: -2 }, hip: { rot: -3 }, legF: { x: 1 } },
      { armF: { rot: -65 }, armB: { rot: -45 }, twang: { show: true }, hip: { rot: 2 }, legF: { x: 1 } },
      { armF: { rot: -40 }, armB: { rot: -10 } }
    ]) },
    q: { fps: 10, frames: on(rest, [
      { armF: { rot: -100 }, armB: { rot: -80 }, bow: { rot: -45 }, arrow: { show: true, x: -1 }, hip: { rot: -4 } },
      { armF: { rot: -130 }, armB: { rot: -110, x: 1 }, bow: { rot: -60 }, arrow: { show: true, x: -3 }, hip: { rot: -8, y: -1 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -130 }, armB: { rot: -80 }, bow: { rot: -60 }, twang: { show: true }, hip: { rot: -6, y: -1 }, legF: { x: 2 }, legB: { x: -1 } },
      { armF: { rot: -70 }, armB: { rot: -20 }, bow: { rot: -20 } }
    ]) },
    // Dodge Roll is the Space skill
    space: { fps: 16, frames: common.roll.frames }
  });

  function palette(hex) {
    return {
      o: '#14101C',
      H: lighten(hex, 0.3), h: hex, i: darken(hex, 0.35), j: darken(hex, 0.7),
      s: '#E8B48A', S: '#C98E66', k: '#120A16',
      A: '#8A7552', a: '#6B5A3E', c: '#4A3D2A', b: '#3D2A1A', y: '#F2C14E',
      l: '#3D3452', m: '#2A2438', F: '#6B4A2E', f: '#4A321E',
      W: '#B07A44', w: '#8A5A2E', t: '#D8D2C4',
      e: '#CFC8DE', r: '#E5534B', p: '#F4F1E8',
      q: '#5C3B1E', Q: '#7A5232', '1': '#FFF1B8'
    };
  }

  return { size: 32, rig: archerRig, anims, palette, once: ['attack', 'q', 'space', 'hurt'] };
});
