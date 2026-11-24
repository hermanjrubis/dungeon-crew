// Spore Queen: a giant crowned mushroom with vine arms. Calls spore storms.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.queen = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp, mirror } = kit;
  let CAP = blob(50, 40, { light: 'C', base: 'c', dark: 'x', shine: 'W' }).slice(0, 20);
  for (const [x, y, w] of [[10, 6, 4], [22, 3, 5], [34, 7, 4], [6, 13, 3], [17, 12, 4], [29, 14, 5], [41, 13, 3]]) {
    CAP = stamp(CAP, ['.' + 'D'.repeat(w - 2) + '.', 'D'.repeat(w), 'd'.repeat(w), '.' + 'd'.repeat(w - 2) + '.'], x, y);
  }
  CAP.push('..' + 'h'.repeat(46) + '..');
  CAP.push('....' + 'H'.repeat(42) + '....');
  const FACE = [
    '..ssssssssssssssss..',
    '.ssssssssssssssssSS.',
    'ssssssssssssssssssSS',
    'ssk.kssssssssk.kssSS',
    'sskkkksssssskkkksSSS',
    'sskKkkssssssskKkksSS',
    'sssskkssssssskksssSS',
    'ssssssssssssssssssSS',
    'ssssssssssssssssssSS',
    'sssssssmmmmmmssssSSS',
    'ssssssmrrrrrrmsssSSS',
    'sssssssmmmmmmsssSSSS',
    '.sssssssssssssssSSS.',
    '..SSSSSSSSSSSSSSSS..'
  ];
  const CROWN = ['y..y..y', 'yy.y.yy', 'yyyYyyy', 'YyYYYyY'];
  const VINE = [
    'vVv.............',
    'vvvvVv..........',
    '.vvvvvvVv.......',
    '....vvvvvvv.....',
    '.......vvvvv....',
    '.........vvvv..g',
    '...........vvvgG',
    '.............vg.'
  ];
  const ROOTS = [
    '...vv......vvv.......vv......vvv...',
    '.vvVvv...vvvVvv....vvVvvv..vvvVvv..',
    'vv...vvvvv....vvvvvv....vvvv....vvv'
  ];
  const STORM = [
    'g......G.......g.......G......g.',
    '...G.......g........G......g....',
    'G......g.......G........g.....G.',
    '....g......G........g.......G...',
    '.G........g.....G.........g.....',
    '......G.......g.......G.......g.'
  ];
  const r = {
    size: 64,
    parts: [
      { name: 'root', pivot: [32, 60], at: [32, 60] },
      { name: 'roots', parent: 'root', rows: ROOTS, pivot: [17, 2], at: [32, 60], z: 0 },
      { name: 'face', parent: 'root', rows: FACE, pivot: [10, 13], at: [32, 58], z: 2 },
      { name: 'vineL', parent: 'face', rows: mirror(VINE), pivot: [15, 1], at: [1, 8], z: 1 },
      { name: 'vineR', parent: 'face', rows: VINE, pivot: [0, 1], at: [18, 8], z: 1 },
      { name: 'cap', parent: 'face', rows: CAP, pivot: [25, 21], at: [10, 1], z: 3 },
      { name: 'crown', parent: 'cap', rows: CROWN, pivot: [3, 3], at: [25, 0], z: 4 },
      { name: 'storm', parent: 'root', rows: STORM, pivot: [16, 3], at: [32, 12], z: 5, hidden: true, outline: false }
    ]
  };
  const sway = (a, y) => ({ vineL: { rot: -a }, vineR: { rot: a }, cap: { y } });
  const anims = {
    idle: { fps: 4, frames: [sway(0, 0), sway(6, 0), sway(10, 1), sway(6, 0)] },
    walk: { fps: 4, frames: [sway(0, 0), sway(6, 0), sway(10, 1), sway(6, 0)] },
    // fading away to move
    shimmer: { fps: 8, frames: [sway(-20, -1), sway(-25, -2)] },
    // spore storm: vines raised, spores everywhere
    storm: { fps: 8, frames: [
      { vineL: { rot: 50 }, vineR: { rot: -50 }, cap: { y: -2 }, storm: { show: true } },
      { vineL: { rot: 60 }, vineR: { rot: -60 }, cap: { y: -3 }, storm: { show: true, x: 2, y: -2 } }
    ] },
    hurt: { fps: 8, frames: [{ cap: { rot: -6, x: -2 }, face: { sx: 1.08, sy: 0.92 }, vineL: { rot: 20 }, vineR: { rot: 20 } }] },
    // wilts: cap droops, vines fall, she sinks
    death: { fps: 5, frames: [
      { cap: { rot: 8, y: 2 }, vineL: { rot: -30 }, vineR: { rot: 30 }, storm: { show: true } },
      { cap: { rot: 18, y: 6, x: 3 }, face: { sy: 0.8 }, vineL: { rot: -60 }, vineR: { rot: 60 } },
      { cap: { rot: 30, y: 10, x: 6 }, face: { sy: 0.55 }, vineL: { rot: -80 }, vineR: { rot: 80 }, crown: { y: 6, x: 8, rot: 60 } },
      { cap: { rot: 40, y: 14, x: 8 }, face: { sy: 0.35 }, vineL: { rot: -90 }, vineR: { rot: 90 }, crown: { y: 10, x: 10, rot: 90 } }
    ] }
  };
  const PAL = { o: '#2A1A14', C: '#B07AD6', c: '#8E4FB8', x: '#62307F', W: '#E2C8F2', D: '#B8F0E4', d: '#5EC8B8', h: '#BFAE90', H: '#9A8A70', s: '#EADBC0', S: '#C9B898', k: '#120A16', K: '#FFFFFF', m: '#7A2E3A', r: '#E5534B', v: '#4F8A6A', V: '#7EC08E', g: '#5EC8B8', G: '#B8F0E4', y: '#F2C14E', Y: '#B8862E' };
  return { size: 64, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
