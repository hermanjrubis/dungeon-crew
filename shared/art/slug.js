// Acid Slug (Floor 5): a slimy green slug on eye stalks that leaves acid behind it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.slug = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp } = kit;
  // a long low body tapering to the tail, with a rounder head at the front
  let BODY = Array.from({ length: 14 }, () => '.'.repeat(26));
  BODY = stamp(BODY, blob(22, 9, { light: 'L', base: 'g', dark: 'd', flat: 0.9, seed: 2 }), 0, 5);
  BODY = stamp(BODY, blob(10, 11, { light: 'L', base: 'g', dark: 'd', shine: 'W', seed: 3 }), 15, 2);
  BODY = stamp(BODY, ['a', '.', 'a'], 5, 8);
  BODY = stamp(BODY, ['.a', 'aa'], 11, 8);
  BODY = stamp(BODY, ['a'], 17, 9);
  BODY = stamp(BODY, ['m.m'], 22, 8);
  const STALK = ['.ww.', 'wwkw', 'wwkw', '.ww.', '..s.', '..s.', '..s.', '..s.'];
  const DRIP = ['a', 'a', 'A'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'stalkB', parent: 'body', rows: STALK, pivot: [2, 7], at: [18, 3], z: 0 },
      { name: 'body', parent: 'root', rows: BODY, pivot: [13, 13], at: [15, 29], z: 1 },
      { name: 'stalkF', parent: 'body', rows: STALK, pivot: [2, 7], at: [21, 3], z: 2 },
      { name: 'drip', parent: 'body', rows: DRIP, pivot: [0, 0], at: [6, 13], z: 3, hidden: true, outline: false }
    ]
  };
  const anims = {
    idle: { fps: 3, frames: [{}, { stalkF: { rot: 8 }, stalkB: { rot: -6 }, body: { sy: 0.96 } }] },
    walk: { fps: 6, frames: [
      { body: { sx: 1.0, sy: 1.0 } },
      { body: { sx: 1.12, sy: 0.88 }, stalkF: { rot: 10 }, stalkB: { rot: 6 }, drip: { show: true } },
      { body: { sx: 1.18, sy: 0.84 }, stalkF: { rot: 14 }, stalkB: { rot: 10 }, drip: { show: true, y: 1 } },
      { body: { sx: 0.95, sy: 1.04 }, root: { x: 1 } }
    ] },
    hurt: { fps: 8, frames: [{ body: { sx: 1.2, sy: 0.75 }, stalkF: { rot: -30 }, stalkB: { rot: -30 } }] },
    death: { fps: 6, frames: [
      { body: { sx: 1.2, sy: 0.7 }, stalkF: { rot: 40 }, stalkB: { rot: 40 } },
      { body: { sx: 1.4, sy: 0.4 }, stalkF: { rot: 80, y: 3 }, stalkB: { rot: 80, y: 3 } },
      { body: { sx: 1.6, sy: 0.2 }, stalkF: { show: false }, stalkB: { show: false } }
    ] }
  };
  const PAL = { o: '#10240E', L: '#B8F07A', g: '#6EC84A', d: '#3E8A2E', W: '#F0FFE0', a: '#D8F050', A: '#F2FF9A', w: '#FFFFFF', k: '#120A16', s: '#4E9A36', m: '#1E3A14' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
