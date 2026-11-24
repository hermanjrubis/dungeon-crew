// Bones: what is left of a Bone Archer. Rattles as it tries to rebuild.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.bones = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const SKULL = ['..wwww..', '.wwwwwW.', 'wkkwwkkW', 'wKkwwKkW', '.wwssww.', '..tWtW..'];
  const BONE = ['ww......ww', 'wWwwwwwwWw', 'ww......ww'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'boneA', parent: 'root', rows: BONE, pivot: [5, 1], at: [15, 25], z: 1 },
      { name: 'boneB', parent: 'root', rows: BONE, pivot: [5, 1], at: [17, 24], z: 2 },
      { name: 'skull', parent: 'root', rows: SKULL, pivot: [4, 5], at: [14, 25], z: 3 }
    ]
  };
  const base = { boneA: { rot: 20 }, boneB: { rot: -25 } };
  const pose = (o) => kit.add(base, o);
  const anims = {
    idle: { fps: 6, frames: [pose({}), pose({ skull: { x: 1, rot: 6 } }), pose({}), pose({ boneB: { rot: 6 } })] },
    walk: { fps: 6, frames: [pose({}), pose({ skull: { x: 1, rot: 6 } })] },
    hurt: { fps: 8, frames: [pose({ skull: { y: -3, rot: -20 }, boneA: { rot: 20 } })] },
    death: { fps: 10, frames: [
      pose({ skull: { y: -4, x: -3, rot: -40 }, boneA: { x: -4, rot: 40 }, boneB: { x: 4, rot: -40 } }),
      pose({ skull: { y: -2, x: -6, rot: -90 }, boneA: { x: -8, y: 1, rot: 80 }, boneB: { x: 8, y: 1, rot: -80 } }),
      pose({ skull: { y: 2, x: -8, rot: -160 }, boneA: { x: -10, y: 2, rot: 120 }, boneB: { x: 10, y: 2, rot: -120 } })
    ] }
  };
  const PAL = { o: '#2B2735', w: '#E9E4D4', W: '#B9B2A0', s: '#6E685A', k: '#120A16', K: '#E5534B', t: '#CFC8DE' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
