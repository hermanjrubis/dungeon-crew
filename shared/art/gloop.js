// Gloop: a purple slime. Mini Gloop is the same slime, drawn smaller.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.gloop = factory(root.DC.rig); }
})(this, function (rig) {
  const { darken, lighten } = rig;
  // ---------------- Gloop ----------------
  const GLOOP_PARTS = {
    body: [
      '.......bbbbbb.......',
      '.....bbLLbbbbbb.....',
      '....bLWLbbbbbbbb....',
      '...bLLbbbbbbbbbbb...',
      '..bLLbbbbbbbbbbbbd..',
      '..bLbbbbbbbbbbbbbd..',
      '.bbbbbbbbbbbbbbbbdd.',
      '.bbbbbbbbbbbbbbbbdd.',
      'bbbbbbbbbbbbbbbbbbdd',
      'bbbbbbbbbbbbbbbbbddd',
      'bbbLbbbbbbbbbbbbbddd',
      'dbbbbbbbbbbbbbbbdddd',
      '.ddbbbbbbbbbbbbdddd.',
      '..dddddddddddddddd..'
    ],
    eyes: [
      '.ww....ww.',
      'wwkw..wwkw',
      'wwkw..wwkw',
      '.ww....ww.'
    ],
    mouth: [
      'kkkkkk',
      'kmmmmk',
      '.kkkk.'
    ],
    drip: [
      'b',
      'b',
      'd'
    ]
  };

  const gloopRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'body', parent: 'root', rows: GLOOP_PARTS.body, pivot: [10, 13], at: [16, 29], z: 1 },
      { name: 'eyes', parent: 'body', rows: GLOOP_PARTS.eyes, pivot: [5, 2], at: [11, 6], z: 2, rigid: true },
      { name: 'mouth', parent: 'body', rows: GLOOP_PARTS.mouth, pivot: [3, 1], at: [11, 10], z: 3, hidden: true, outline: false },
      { name: 'drip', parent: 'body', rows: GLOOP_PARTS.drip, pivot: [0, 0], at: [4, 12], z: 0, hidden: true }
    ]
  };

  const gloopAnims = {
    idle: { fps: 4, frames: [
      {},
      { body: { sx: 1.05, sy: 0.95 } },
      { body: { sx: 1.08, sy: 0.92 }, eyes: { y: 1 } },
      { body: { sx: 1.04, sy: 0.96 } }
    ] },
    walk: { fps: 8, frames: [
      { body: { sx: 1.18, sy: 0.8 }, eyes: { y: 1 } },
      { body: { sx: 0.88, sy: 1.15 }, root: { y: -3 }, eyes: { x: 1 } },
      { body: { sx: 0.95, sy: 1.05 }, root: { y: -6 }, eyes: { x: 1 }, drip: { show: true } },
      { body: { sx: 1.22, sy: 0.78 }, eyes: { y: 1 } }
    ] },
    attack: { fps: 10, loopPause: 0.4, frames: [
      { body: { sx: 1.25, sy: 0.75 }, eyes: { y: 1 } },
      { body: { sx: 1.3, sy: 0.7 }, root: { x: -1 }, eyes: { y: 1, sy: 0.5 } },
      { body: { sx: 0.85, sy: 1.15, rot: 10 }, root: { x: 3, y: -4 }, mouth: { show: true }, eyes: { y: -1 } },
      { body: { sx: 1.1, sy: 0.9 }, root: { x: 3 }, mouth: { show: true } }
    ] },
    // about to jump: squashing down, eyes narrowed
    squish: { fps: 10, frames: [
      { body: { sx: 1.25, sy: 0.75 }, eyes: { y: 1 } },
      { body: { sx: 1.32, sy: 0.68 }, root: { x: -1 }, eyes: { y: 1, sy: 0.5 } }
    ] },
    // in the air (the game lifts it too)
    leap: { fps: 8, frames: [
      { body: { sx: 0.85, sy: 1.18 }, mouth: { show: true }, eyes: { y: -1 } },
      { body: { sx: 0.9, sy: 1.12 }, mouth: { show: true }, eyes: { y: -1 }, drip: { show: true } }
    ] },
    hurt: { fps: 6, loopPause: 0.5, frames: [
      { body: { sx: 1.25, sy: 0.75, rot: -8 }, root: { x: -2 }, eyes: { sy: 0.5 } }
    ] },
    death: { fps: 6, frames: [
      { body: { sx: 1.4, sy: 0.5 }, eyes: { sy: 0.5 } },
      { body: { sx: 1.6, sy: 0.3 }, eyes: { show: false } },
      { body: { sx: 1.8, sy: 0.18 }, eyes: { show: false } }
    ] }
  };

  const GLOOP_PALETTE = { o: '#2A1533', b: '#C76BD9', L: '#E3A6EE', W: '#FFFFFF', d: '#8E3FA6', w: '#FFFFFF', k: '#120A16', m: '#E5534B' };

  return { size: 32, rig: gloopRig, anims: gloopAnims, palette: () => GLOOP_PALETTE, once: ['attack', 'hurt', 'death'] };
});
