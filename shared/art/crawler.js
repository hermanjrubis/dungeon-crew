// Crystal Crawler (Floor 6): a stone crab with crystals growing from its shell.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.crawler = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp } = kit;
  let BODY = Array.from({ length: 15 }, () => '.'.repeat(22));
  BODY = stamp(BODY, blob(20, 10, { light: 'S', base: 's', dark: 'z', seed: 4 }), 1, 5);
  // crystals on the shell
  BODY = stamp(BODY, ['..C..', '.CcC.', '.Ccb.', 'Cccbb'], 4, 1);
  BODY = stamp(BODY, ['.C.', 'Ccb', 'Ccb'], 10, 0);
  BODY = stamp(BODY, ['.C..', 'CcC.', 'Cccb', 'Cccb'], 13, 2);
  BODY = stamp(BODY, ['kE', 'kk'], 17, 8);
  const LEGS = ['..l....l....l...', '.l.l..l.l..l.l..', 'l...ll...ll...l.', 'l....l....l....l'];
  const CLAW = ['..CCCc..', '.CCccc..', 'CCccb...', 'Cccbb..C', 'Ccbb..Cc', '.bbbbCcc', '..bbbcc.'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'legB', parent: 'root', rows: LEGS, pivot: [8, 0], at: [14, 25], z: 0 },
      { name: 'body', parent: 'root', rows: BODY, pivot: [11, 14], at: [15, 27], z: 1 },
      { name: 'legF', parent: 'root', rows: LEGS, pivot: [8, 0], at: [17, 26], z: 2 },
      { name: 'claw', parent: 'body', rows: CLAW, pivot: [0, 4], at: [20, 10], z: 3 }
    ]
  };
  const anims = {
    idle: { fps: 3, frames: [{}, { body: { y: 1 }, claw: { rot: -8 } }] },
    walk: { fps: 10, frames: [
      { legF: { x: 1 }, legB: { x: -1 }, body: { y: 0 } },
      { legF: { y: -1 }, body: { y: -1 }, claw: { rot: -6 } },
      { legF: { x: -1 }, legB: { x: 1 } },
      { legB: { y: -1 }, body: { y: -1 }, claw: { rot: 6 } }
    ] },
    // hunkered down behind its shell (takes less damage)
    shell: { fps: 4, frames: [{ body: { y: 3 }, claw: { rot: -40, y: 2 }, legF: { y: -1 } }, { body: { y: 3, x: 1 }, claw: { rot: -42, y: 2 }, legF: { y: -1 } }] },
    attack: { fps: 10, frames: [{ claw: { rot: -40 } }, { claw: { rot: 25, x: 3 }, body: { x: 1 } }] },
    hurt: { fps: 8, frames: [{ body: { rot: -10, x: -2 }, claw: { rot: 20 } }] },
    death: { fps: 8, frames: [
      { body: { rot: -30, y: -2 }, claw: { rot: 40 } },
      { body: { rot: -120, y: -6 }, claw: { rot: 80 }, legF: { y: -6 }, legB: { y: -6 } },
      { body: { rot: -180, y: -12 }, claw: { rot: 100 }, legF: { y: -12, sy: -1 }, legB: { y: -12, sy: -1 } }
    ] }
  };
  const PAL = { o: '#141020', S: '#6E6488', s: '#4E4664', z: '#332D45', C: '#E8F4FF', c: '#9AD7F0', b: '#5EA8E0', k: '#120A16', E: '#9AF0FF', l: '#8E84A8' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['attack', 'hurt', 'death'] };
});
