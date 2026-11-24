// Shard Wisp (Floor 6): a floating crystal with one eye that fires shards.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.wisp = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const CORE = [
    '......C......',
    '.....CCc.....',
    '....CCccb....',
    '...CCcccbb...',
    '..CCcccccbb..',
    '.CCcwwwwwcbb.',
    'CCccwwkkwccbb',
    '.Cccwwkkwcbb.',
    '..cccwwwccb..',
    '...ccccccb...',
    '....cccbb....',
    '.....ccb.....',
    '......b......'
  ];
  const SHARD = ['.C.', 'CCc', 'Ccb', '.b.'];
  const GLOW = ['..v..', '.vVv.', 'vVWVv', '.vVv.', '..v..'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'core', parent: 'root', rows: CORE, pivot: [6, 6], at: [16, 15], z: 2 },
      { name: 's1', parent: 'core', rows: SHARD, pivot: [1, 1], at: [4, -4], z: 3 },
      { name: 's2', parent: 'core', rows: SHARD, pivot: [1, 1], at: [11, 7], z: 1 },
      { name: 's3', parent: 'core', rows: SHARD, pivot: [1, 1], at: [-3, 7], z: 3 },
      { name: 'glow', parent: 'core', rows: GLOW, pivot: [2, 2], at: [6, 6], z: 4, hidden: true, outline: false }
    ]
  };
  // the three little shards circle the core
  const orbit = (k, y) => {
    const p = (i) => { const a = (k + i / 3) * Math.PI * 2; return { x: Math.round(Math.cos(a) * 11), y: Math.round(Math.sin(a) * 6) }; };
    const at = [[4, -4], [11, 7], [-3, 7]];
    const pose = { core: { y } };
    ['s1', 's2', 's3'].forEach((n, i) => { const q = p(i); pose[n] = { x: q.x + 6 - at[i][0], y: q.y + 6 - at[i][1], z: q.y < 0 ? 1 : 3 }; });
    return pose;
  };
  const anims = {
    idle: { fps: 8, frames: [orbit(0, 0), orbit(0.25, -1), orbit(0.5, -1), orbit(0.75, 0)] },
    walk: { fps: 8, frames: [orbit(0, 0), orbit(0.25, -1), orbit(0.5, -1), orbit(0.75, 0)] },
    hover: { fps: 8, frames: [orbit(0, 0), orbit(0.25, -1), orbit(0.5, -1), orbit(0.75, 0)] },
    // charging a shot: shards pull in, the core glows
    aim: { fps: 10, frames: [kit.add(orbit(0, 0), { glow: { show: true } }), kit.add(orbit(0.5, 0), { glow: { show: true, sx: 1.3, sy: 1.3 } })] },
    hurt: { fps: 8, frames: [kit.add(orbit(0.1, 0), { core: { rot: -20, x: -2 } })] },
    // shatters
    death: { fps: 10, frames: [
      kit.add(orbit(0, 0), { core: { sx: 1.2, sy: 1.2 }, glow: { show: true } }),
      { core: { show: false }, s1: { x: -6, y: -6 }, s2: { x: 8, y: 2 }, s3: { x: -8, y: 4 } },
      { core: { show: false }, s1: { x: -10, y: -10 }, s2: { x: 12, y: 4 }, s3: { x: -12, y: 8 } }
    ] }
  };
  const PAL = { o: '#141020', C: '#F0E8FF', c: '#B89AF0', b: '#7A5AC8', w: '#FFFFFF', k: '#2A1A4A', v: '#B89AF0', V: '#E8D8FF', W: '#FFFFFF' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
