// Spore Seed: a little glowing pod that grows into a new Sporecap.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.seed = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const POD = kit.blob(10, 9, { light: 'l', base: 'g', dark: 'd', shine: 'W' });
  const SPROUT = ['t.t', '.t.', '.t.'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'pod', parent: 'root', rows: POD, pivot: [5, 8], at: [16, 28], z: 1 },
      { name: 'sprout', parent: 'pod', rows: SPROUT, pivot: [1, 2], at: [5, 0], z: 2, rigid: true }
    ]
  };
  const pulse = (k) => ({ pod: { sx: k, sy: k } });
  const anims = {
    idle: { fps: 6, frames: [pulse(1), pulse(1.08), pulse(1.14), pulse(1.08)] },
    walk: { fps: 6, frames: [pulse(1), pulse(1.08), pulse(1.14), pulse(1.08)] },
    hurt: { fps: 8, frames: [{ pod: { sx: 1.3, sy: 0.7 } }] },
    death: { fps: 10, frames: [{ pod: { sx: 1.4, sy: 0.6 } }, { pod: { sx: 1.7, sy: 0.3 }, sprout: { show: false } }] }
  };
  const PAL = { o: '#1F3A2E', l: '#B8F0E4', g: '#5EC8B8', d: '#3A8A7C', W: '#FFFFFF', t: '#6FA86A' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
