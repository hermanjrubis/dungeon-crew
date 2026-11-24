// Rot Hand (Floor 5): a poisonous hand that claws up out of the ground.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.rothand = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const ARM = ['.bbbbbd.', 'bbbbbbdd', '.bbbbbd.', '.bbbbbd.', '.bbbbbd.', '.bbbbbd.', '.bbbbbd.', '.bbbbbd.', 'bbbbbbdd', 'bbbbbbdd'];
  // fingers spread wide, poison claws up
  const OPEN = [
    'G..G.....G..G',
    'g..g.....g..g',
    'b..bb...bb..b',
    'bb.bb...bb.bb',
    '.bbbbb.bbbbb.',
    '..bbbbbbbbb..',
    '...bbbbbbd...',
    '...bbbbbbd...'
  ];
  // clenched: a wide knuckly fist with claws curled in
  const SHUT = [
    '...bbbbbbbb..',
    '..bbdbbdbbdd.',
    '..bbbbbbbbbd.',
    '..gbgbgbgbbd.',
    '...bbbbbbbd..',
    '...bbbbbbd...'
  ];
  const MOUND = ['....hhhhhhhh....', '.hhhkkkkkkkkhhh.', 'hkkkkkkkkkkkkkkh'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'arm', parent: 'root', rows: ARM, pivot: [4, 9], at: [16, 28], z: 1 },
      { name: 'open', parent: 'arm', rows: OPEN, pivot: [6, 7], at: [4, 0], z: 2 },
      { name: 'shut', parent: 'arm', rows: SHUT, pivot: [6, 5], at: [4, 0], z: 2, hidden: true },
      { name: 'mound', parent: 'root', rows: MOUND, pivot: [8, 2], at: [16, 29], z: 3 }
    ]
  };
  const shut = { open: { show: false }, shut: { show: true } };
  const anims = {
    idle: { fps: 4, frames: [{ arm: { rot: -6 } }, { arm: { rot: 0, y: -1 } }, { arm: { rot: 6 } }, { arm: { rot: 0, y: -1 } }] },
    walk: { fps: 4, frames: [{ arm: { rot: -6 } }, { arm: { rot: 6 } }] },
    // rising out of the ground
    rise: { fps: 10, frames: [{ arm: { y: 16 }, open: { show: false } }, { arm: { y: 10 } }, { arm: { y: 4 } }] },
    // snapping shut on someone
    grab: { fps: 10, frames: [{ arm: { y: -2, sy: 1.1 } }, kit.add({ arm: { y: -3 } }, shut), kit.add({ arm: { y: -1 } }, shut)] },
    hurt: { fps: 8, frames: [{ arm: { rot: -20 } }] },
    death: { fps: 8, frames: [kit.add({ arm: { y: 5 } }, shut), kit.add({ arm: { y: 11 } }, shut), { arm: { y: 18 }, open: { show: false } }] }
  };
  const PAL = { o: '#1A0F1C', b: '#8A6A8E', d: '#5A3E60', g: '#B8F07A', h: '#5A4A2E', k: '#1E140E' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['rise', 'grab', 'hurt', 'death'] };
});
