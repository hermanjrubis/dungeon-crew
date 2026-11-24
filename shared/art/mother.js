// Gloop Mother: a huge crowned slime. Half Mother (after she splits) is the same, smaller.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.mother = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp } = kit;
  let BODY = blob(46, 32, { light: 'L', base: 'b', dark: 'd', shine: 'W', flat: 0.7 });
  // little bubbles inside the slime
  BODY = stamp(BODY, ['.L.', 'LWL', '.L.'], 30, 20);
  BODY = stamp(BODY, ['L'], 12, 22);
  BODY = stamp(BODY, ['.L', 'LL'], 36, 12);
  const CROWN = [
    'G.....G.....G',
    'GG...GGG...GG',
    'GGG.GGgGG.GGG',
    'GGGGGGgGGGGGG',
    'gGrGGgggGGrGg',
    'ggggggggggggg'
  ];
  const EYES = [
    '.wwww......wwww.',
    'wwwwwW....wwwwwW',
    'wwwkkW....wwwkkW',
    'wwwkkW....wwwkkW',
    'wwwwwW....wwwwwW',
    '.WWWW......WWWW.'
  ];
  const MOUTH = ['m......m', '.mmmmmm.'];
  const MAW = ['.mmmmmmmm.', 'mmrrrrrrmm', 'mmrrrrrrmm', '.mmmmmmmm.'];
  const r = {
    size: 64,
    parts: [
      { name: 'root', pivot: [32, 60], at: [32, 60] },
      { name: 'body', parent: 'root', rows: BODY, pivot: [23, 31], at: [32, 60], z: 1 },
      { name: 'crown', parent: 'body', rows: CROWN, pivot: [6, 5], at: [23, 3], z: 2, rigid: true },
      { name: 'eyes', parent: 'body', rows: EYES, pivot: [8, 3], at: [23, 13], z: 3, rigid: true },
      { name: 'mouth', parent: 'body', rows: MOUTH, pivot: [4, 0], at: [23, 20], z: 3, rigid: true, outline: false },
      { name: 'maw', parent: 'body', rows: MAW, pivot: [5, 1], at: [23, 21], z: 4, rigid: true, hidden: true }
    ]
  };
  const anims = {
    idle: { fps: 4, frames: [{}, { body: { sx: 1.03, sy: 0.97 } }, { body: { sx: 1.05, sy: 0.95 }, eyes: { y: 1 } }, { body: { sx: 1.03, sy: 0.97 } }] },
    walk: { fps: 6, frames: [
      { body: { sx: 1.12, sy: 0.86 }, eyes: { y: 2 }, crown: { y: 2 } },
      { body: { sx: 0.94, sy: 1.08 }, root: { y: -3 }, crown: { y: -1 } },
      { body: { sx: 0.97, sy: 1.04 }, root: { y: -5 }, crown: { y: -2 } },
      { body: { sx: 1.15, sy: 0.84 }, eyes: { y: 2 }, crown: { y: 3 } }
    ] },
    // getting ready to jump
    squish: { fps: 8, frames: [{ body: { sx: 1.2, sy: 0.78 }, eyes: { y: 3 }, crown: { y: 4 }, maw: { show: true }, mouth: { show: false } }] },
    hurt: { fps: 8, frames: [{ body: { sx: 1.15, sy: 0.85, rot: -4 }, root: { x: -2 }, eyes: { sy: 0.5 }, maw: { show: true }, mouth: { show: false } }] },
    // melts into a puddle, crown tumbling off
    death: { fps: 6, frames: [
      { body: { sx: 1.2, sy: 0.75 }, eyes: { sy: 0.6, y: 3 }, crown: { y: 4, rot: -10 }, maw: { show: true }, mouth: { show: false } },
      { body: { sx: 1.3, sy: 0.5 }, eyes: { sy: 0.4, y: 8 }, crown: { y: 10, x: -6, rot: -40 }, mouth: { show: false } },
      { body: { sx: 1.35, sy: 0.3 }, eyes: { show: false }, crown: { y: 15, x: -12, rot: -90 }, mouth: { show: false } },
      { body: { sx: 1.4, sy: 0.16 }, eyes: { show: false }, crown: { y: 16, x: -14, rot: -100 }, mouth: { show: false } }
    ] }
  };
  const PAL = { o: '#2A1533', L: '#D08AE0', b: '#A94FC0', d: '#7A3290', W: '#F4D8FA', G: '#F2C14E', g: '#B8862E', r: '#E5534B', w: '#FFFFFF', k: '#120A16', m: '#3A0F2A' };
  return { size: 64, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
