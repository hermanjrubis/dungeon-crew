// Sporecap: a grumpy mushroom that swells up and puffs out spores.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.sporecap = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp } = kit;
  // a dome: the top half of a round blob, with spots and a gill rim underneath
  let CAP = blob(20, 16, { light: 'C', base: 'c', dark: 'x', shine: 'W' }).slice(0, 9);
  CAP = stamp(CAP, ['dd', 'ddd'], 6, 3);
  CAP = stamp(CAP, ['.d', 'dd'], 12, 2);
  CAP = stamp(CAP, ['dd'], 15, 6);
  CAP = stamp(CAP, ['d'], 3, 6);
  CAP.push('.hhhhhhhhhhhhhhhhhh.');
  const STEM = [
    '.ssssssss.',
    'ssssssssSs',
    'skkssskkSS',
    'sKkssKksSS',
    'ssssssssSS',
    'sssmmmmsSS',
    'hssssssSSh',
    '.hhhhhhhh.'
  ];
  const SPORES = [
    '..g.......G.......g.',
    'G.....g........G....',
    '....G.....g.......G.',
    '.g.......G....g.....',
    '......g.......G...g.',
    'G..........g........'
  ];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'stem', parent: 'root', rows: STEM, pivot: [5, 7], at: [16, 29], z: 1 },
      { name: 'cap', parent: 'stem', rows: CAP, pivot: [10, 9], at: [5, 0], z: 2 },
      { name: 'spores', parent: 'root', rows: SPORES, pivot: [10, 3], at: [16, 12], z: 3, hidden: true, outline: false }
    ]
  };
  const anims = {
    idle: { fps: 3, frames: [{}, { cap: { y: 1 }, stem: { sy: 0.95 } }] },
    walk: { fps: 3, frames: [{}, { cap: { y: 1 }, stem: { sy: 0.95 } }] },
    // swelling up before a spore burst
    swell: { fps: 10, frames: [
      { cap: { sx: 1.12, sy: 1.15, y: -1 }, stem: { sx: 1.08 }, spores: { show: true } },
      { cap: { sx: 1.2, sy: 1.25, y: -2 }, stem: { sx: 1.12 }, spores: { show: true, y: -2, x: 1 } }
    ] },
    hurt: { fps: 8, frames: [{ cap: { rot: -10, x: -1 }, stem: { sx: 1.15, sy: 0.85 } }] },
    // wilts and puffs its last spores
    death: { fps: 8, frames: [
      { cap: { rot: -15, y: 1 }, stem: { sy: 0.85 }, spores: { show: true } },
      { cap: { rot: -40, y: 2, x: -2 }, stem: { sy: 0.6, rot: -20 }, spores: { show: true, y: -3 } },
      { cap: { rot: -70, y: 3, x: -4 }, stem: { sy: 0.4, rot: -60 } }
    ] }
  };
  const PAL = { o: '#2A1A14', C: '#F09A72', c: '#D9734E', x: '#A84F33', W: '#FFE2CF', d: '#F7E6C9', h: '#BFAE90', s: '#EADBC0', S: '#C9B898', k: '#120A16', K: '#FFFFFF', m: '#5A2A1E', g: '#5EC8B8', G: '#B8F0E4' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
