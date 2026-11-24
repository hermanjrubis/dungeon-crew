// Rubble Golem: a walking pile of rock with lava glowing in its cracks.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.golem = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp, mirror } = kit;
  const rock = (w, h, seed) => blob(w, h, { light: 'L', base: 'd', dark: 'D', rough: 0.5, seed, speckle: 0.07, speck: 'D' });
  let BODY = rock(26, 20, 3);
  BODY = stamp(BODY, ['c....', '.c...', '.cC..', '..cc.', '....c'], 8, 6);
  BODY = stamp(BODY, ['..c', '.c.', 'cC.', 'c..'], 17, 9);
  let HEAD = rock(13, 11, 5);
  HEAD = stamp(HEAD, ['EE...EE', 'ee...ee'], 3, 4);
  // an arm: a thick upper rock ending in a big fist
  const armRows = (seed) => {
    let a = Array.from({ length: 18 }, () => '.'.repeat(10));
    a = stamp(a, rock(7, 11, seed), 1, 0);
    a = stamp(a, rock(10, 9, seed + 1), 0, 9);
    return a;
  };
  let ARM = stamp(armRows(8), ['c.', '.c', 'cC'], 4, 11);
  const ARML = mirror(armRows(11));
  const LEG = rock(8, 8, 13);
  const RUBBLE = ['.L.....dd....L..d.', 'Ldd..LdDd..dLd.dDd'];
  const r = {
    size: 48,
    parts: [
      { name: 'root', pivot: [24, 45], at: [24, 45] },
      { name: 'legB', parent: 'root', rows: LEG, pivot: [4, 1], at: [19, 38], z: 1 },
      { name: 'legF', parent: 'root', rows: LEG, pivot: [4, 1], at: [29, 38], z: 2 },
      { name: 'hip', parent: 'root', pivot: [24, 38], at: [24, 38] },
      { name: 'armB', parent: 'hip', rows: ARML, pivot: [5, 2], at: [13, 23], z: 3 },
      { name: 'body', parent: 'hip', rows: BODY, pivot: [13, 18], at: [24, 40], z: 4 },
      { name: 'head', parent: 'hip', rows: HEAD, pivot: [6, 9], at: [25, 24], z: 5 },
      { name: 'armF', parent: 'hip', rows: ARM, pivot: [4, 2], at: [35, 23], z: 6 },
      { name: 'rubble', parent: 'root', rows: RUBBLE, pivot: [9, 1], at: [24, 45], z: 7, hidden: true }
    ]
  };
  const anims = {
    idle: { fps: 2, frames: [{}, { hip: { y: 1 }, armF: { rot: 3 }, armB: { rot: -3 } }] },
    walk: { fps: 6, frames: [
      { legF: { x: 2 }, legB: { x: -2 }, armF: { rot: -10 }, armB: { rot: 10 }, hip: { rot: 3 } },
      { legB: { y: -3 }, hip: { y: -1 } },
      { legF: { x: -2 }, legB: { x: 2 }, armF: { rot: 10 }, armB: { rot: -10 }, hip: { rot: -3 } },
      { legF: { y: -3 }, hip: { y: -1 } }
    ] },
    // fists raised before a ground slam
    raise: { fps: 8, frames: [
      { armF: { rot: -160 }, armB: { rot: 160 }, hip: { y: -2, rot: -4 }, head: { y: -1 } },
      { armF: { rot: -168 }, armB: { rot: 168 }, hip: { y: -3, rot: -5 }, head: { y: -1 } }
    ] },
    slam: { fps: 10, frames: [{ armF: { rot: -40, y: 6 }, armB: { rot: 40, y: 6 }, hip: { y: 3, rot: 6 }, rubble: { show: true } }] },
    hurt: { fps: 8, frames: [{ hip: { rot: -6, x: -2 }, head: { x: -1 }, armF: { rot: 15 } }] },
    // crumbles into rubble
    death: { fps: 8, frames: [
      { hip: { y: 2 }, head: { y: 3, rot: -15 }, armF: { rot: 30, y: 3 }, armB: { rot: -30, y: 3 } },
      { hip: { y: 6 }, head: { y: 10, x: -4, rot: -40 }, armF: { rot: 70, y: 10, x: 4 }, armB: { rot: -70, y: 10, x: -4 }, body: { sy: 0.8 }, rubble: { show: true } },
      { hip: { y: 10 }, head: { y: 15, x: -7, rot: -80 }, armF: { rot: 90, y: 14, x: 8 }, armB: { rot: -90, y: 14, x: -8 }, body: { sy: 0.5 }, legF: { x: 3 }, legB: { x: -3 }, rubble: { show: true, sx: 1.4 } }
    ] }
  };
  const PAL = { o: '#1E1A22', L: '#8E8399', d: '#6E6378', D: '#4E4558', c: '#E5622B', C: '#F2A541', E: '#FFF1B8', e: '#F2A541' };
  return { size: 48, rig: r, anims, palette: () => PAL, once: ['slam', 'hurt', 'death'] };
});
