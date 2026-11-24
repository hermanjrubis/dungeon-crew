// Bone Archer: a skeleton with a bow. When it falls apart it leaves Bones,
// which rebuild unless someone smashes them.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.bonearcher = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { on } = kit;
  const P = {
    skull: [
      '..wwww..',
      '.wwwwwW.',
      'wwwwwwWW',
      'wkkwwkkW',
      'wKkwwKkW',
      'wwwsswwW',
      '.wtWtWt.',
      '..wWwW..'
    ],
    ribs: [
      '...ww...',
      '.wwwwww.',
      'w..ww..W',
      '.wwwwwW.',
      'w..ww..W',
      '.wwwwwW.',
      '...ww...',
      '...ww...',
      '.wwWWww.'
    ],
    arm: ['.w.', '.w.', '.W.', 'www', '.w.', '.w.', '.W.', 'w.w'],
    leg: ['.w.', '.w.', '.W.', 'www', '.w.', '.w.', '.W.', 'wwW'],
    bow: [
      'b.....',
      '.b....',
      '..bB..',
      '...b..',
      '...bB.',
      '...bB.',
      '...bB.',
      '...bB.',
      '...b..',
      '..bB..',
      '.b....',
      'b.....'
    ],
    string: ['t', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't'],
    arrow: ['r.........', 'reeeeeeepp', 'r.........']
  };
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: P.leg, pivot: [1, 0], at: [14, 22], z: 1 },
      { name: 'legF', parent: 'root', rows: P.leg, pivot: [1, 0], at: [18, 22], z: 2 },
      { name: 'hip', parent: 'root', pivot: [16, 21], at: [16, 21] },
      { name: 'armB', parent: 'hip', rows: P.arm, pivot: [1, 0], at: [12, 14], z: 3 },
      { name: 'torso', parent: 'hip', rows: P.ribs, pivot: [4, 8], at: [16, 22], z: 4 },
      { name: 'head', parent: 'hip', rows: P.skull, pivot: [4, 7], at: [16, 14], z: 6 },
      { name: 'armF', parent: 'hip', rows: P.arm, pivot: [1, 0], at: [20, 14], z: 8 },
      { name: 'bow', parent: 'armF', rows: P.bow, pivot: [4, 6], at: [1, 7], z: 9, rigid: true },
      { name: 'string', parent: 'bow', rows: P.string, pivot: [0, 0], at: [0, 0], z: 9.5, outline: false },
      { name: 'arrow', parent: 'bow', rows: P.arrow, pivot: [0, 1], at: [0, 6], z: 10, hidden: true }
    ]
  };
  const rest = { armF: { rot: -20 }, armB: { rot: 10 } };
  const anims = {
    idle: { fps: 3, frames: on(rest, [{}, { head: { y: 1 } }]) },
    walk: { fps: 8, frames: on(rest, [
      { legF: { x: 2 }, legB: { x: -2 }, armB: { rot: 15 } },
      { legB: { y: -2 }, hip: { y: -1 }, head: { x: 1 } },
      { legF: { x: -2 }, legB: { x: 2 }, armB: { rot: -15 } },
      { legF: { y: -2 }, hip: { y: -1 }, head: { x: -1 } }
    ]) },
    // drawing the bow: shaking a little as it aims
    draw: { fps: 8, frames: on(rest, [
      { armF: { rot: -70 }, armB: { rot: -95, x: 2 }, arrow: { show: true, x: -2 }, hip: { rot: -3 }, head: { x: 1 } },
      { armF: { rot: -70 }, armB: { rot: -98, x: 2 }, arrow: { show: true, x: -3 }, hip: { rot: -4 }, head: { x: 1, y: 1 } }
    ]) },
    hurt: { fps: 8, frames: on(rest, [{ head: { x: -2, rot: -15 }, torso: { rot: -8 }, armF: { rot: 30 }, armB: { rot: -30 } }]) },
    // falls apart into a pile
    death: { fps: 10, frames: on(rest, [
      { head: { y: 3, x: -2, rot: -20 }, torso: { y: 2, rot: -10 }, armF: { rot: 60 }, armB: { rot: -60 }, bow: { rot: 30 } },
      { head: { y: 9, x: -4, rot: -60 }, torso: { y: 6, rot: -50 }, armF: { rot: 100, y: 5 }, armB: { rot: -100, y: 5 }, legF: { rot: 40 }, legB: { rot: -40 }, bow: { rot: 80, y: 6 } },
      { head: { y: 13, x: -5, rot: -90 }, torso: { y: 9, rot: -90 }, armF: { rot: 90, y: 9 }, armB: { rot: -90, y: 9 }, legF: { rot: 90, y: 4 }, legB: { rot: -90, y: 4 }, bow: { rot: 90, y: 10, x: 4 } }
    ]) }
  };
  const PAL = { o: '#2B2735', w: '#E9E4D4', W: '#B9B2A0', s: '#6E685A', k: '#120A16', K: '#E5534B', t: '#CFC8DE', b: '#8A5A2E', B: '#B07A44', e: '#CFC8DE', r: '#E5534B', p: '#F4F1E8' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
