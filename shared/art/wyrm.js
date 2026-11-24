// The Rothand Wyrm (Floor 5 boss): a giant worm bursting from the ground,
// with grasping poison-clawed hands down its body and a ring of teeth.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.wyrm = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp, mirror } = kit;
  const ring = (w, h, seed) => {
    let s = blob(w, h, { light: 'L', base: 'b', dark: 'd', seed, speckle: 0.05, speck: 'd' });
    // bristles along the top of the segment
    s = stamp(s, [Array.from({ length: w }, (_, x) => (x > 3 && x < w - 4 && x % 4 === 1 ? 'p' : '.')).join('')], 0, 1);
    // a pale band around each segment
    return s.map((row, y) => (y === h - 3 || y === h - 4 ? row.replace(/[Lbd]/g, (ch) => (ch === 'd' ? 'n' : 'N')) : row));
  };
  // head seen from the front: three eyes over a round mouth full of teeth
  let HEAD = blob(36, 30, { light: 'L', base: 'b', dark: 'd', shine: 'W', seed: 9, speckle: 0.04, speck: 'd' });
  for (const [x, y] of [[7, 5], [15, 2], [23, 5], [11, 9], [20, 9]]) HEAD = stamp(HEAD, ['.yy.', 'yYky', '.yy.'], x, y);
  HEAD = stamp(HEAD, ['p......................p', 'pp....................pp', '.pp..................pp.'], 6, 12);
  const MAW_SHUT = [
    '....tttttttt....',
    '..ttmmmmmmmmtt..',
    '.tmmmmmmmmmmmmt.',
    '..ttmmmmmmmmtt..',
    '....tttttttt....'
  ];
  const MAW_OPEN = [
    '.....t.t.t.t.t.....',
    '...tttmmmmmmmttt...',
    '..tmmmmmmmmmmmmmt..',
    '.tmmmrrrrrrrrrmmmt.',
    'tmmmrrrrrrrrrrrmmmt',
    'tmmrrrrRRRRRrrrrmmt',
    'tmmmrrrrrrrrrrrmmmt',
    '.tmmmrrrrrrrrrmmmt.',
    '..tmmmmmmmmmmmmmt..',
    '...tttmmmmmmmttt...',
    '.....t.t.t.t.t.....'
  ];
  // an arm: thin and bony, ending in a three-clawed hand with poison tips
  const ARM = [
    '.bbb.......',
    'bbbbd......',
    '.bbbd......',
    '.bbbd......',
    '..bbbd.....',
    '..bbbd.....',
    '...bbd.....',
    '...bbbd....',
    '...bbbd....',
    '...bbbbd...',
    '..bbbbbbd..',
    '.bbbbbbbbd.',
    'bbbbbbbbbbd',
    'bb.bb.bb.bd',
    'b..b..b..b.',
    'g..g..g..g.',
    'G..G..G..G.'
  ];
  const HOLE = kit.blob(54, 12, { light: 'h', base: 'k', dark: 'k' });
  // the near edge of the hole, drawn in front so the worm comes out of it
  const LIP = HOLE.slice(6).map((row, y) => row.replace(/k/g, y < 2 ? '.' : 'h'));
  const SPIT = ['..gg..', '.gGGg.', 'gGWWGg', 'gGWWGg', '.gGGg.', '..gg..'];
  const r = {
    size: 96,
    parts: [
      { name: 'root', pivot: [48, 90], at: [48, 90] },
      { name: 'hole', parent: 'root', rows: HOLE, pivot: [27, 6], at: [48, 88], z: 0 },
      { name: 'rise', parent: 'root', pivot: [48, 88], at: [48, 88] },
      { name: 'seg0', parent: 'rise', rows: ring(34, 17, 1), pivot: [17, 15], at: [48, 90], z: 2 },
      { name: 'seg1', parent: 'seg0', rows: ring(32, 17, 2), pivot: [16, 15], at: [17, 3], z: 3 },
      { name: 'seg2', parent: 'seg1', rows: ring(30, 16, 3), pivot: [15, 14], at: [16, 3], z: 4 },
      { name: 'seg3', parent: 'seg2', rows: ring(28, 16, 4), pivot: [14, 14], at: [15, 3], z: 5 },
      { name: 'armL0', parent: 'seg0', rows: mirror(ARM), pivot: [10, 1], at: [3, 6], z: 1 },
      { name: 'armR0', parent: 'seg0', rows: ARM, pivot: [0, 1], at: [31, 6], z: 1 },
      { name: 'armL1', parent: 'seg1', rows: mirror(ARM), pivot: [10, 1], at: [2, 6], z: 1 },
      { name: 'armR1', parent: 'seg1', rows: ARM, pivot: [0, 1], at: [30, 6], z: 1 },
      { name: 'armL2', parent: 'seg2', rows: mirror(ARM), pivot: [10, 1], at: [2, 6], z: 6 },
      { name: 'armR2', parent: 'seg2', rows: ARM, pivot: [0, 1], at: [28, 6], z: 6 },
      { name: 'head', parent: 'seg3', rows: HEAD, pivot: [18, 25], at: [14, 4], z: 7 },
      { name: 'maw', parent: 'head', rows: MAW_SHUT, pivot: [8, 2], at: [18, 19], z: 8 },
      { name: 'mawOpen', parent: 'head', rows: MAW_OPEN, pivot: [9, 5], at: [18, 18], z: 9, hidden: true },
      { name: 'spit', parent: 'head', rows: SPIT, pivot: [3, 3], at: [18, 26], z: 10, hidden: true, outline: false },
      { name: 'lip', parent: 'root', rows: LIP, pivot: [27, 0], at: [48, 88], z: 20 }
    ]
  };
  const open = { maw: { show: false }, mawOpen: { show: true, sx: 1, sy: 1 } };
  const sway = (a, h) => ({ maw: { show: false }, mawOpen: { show: true, sx: 0.85, sy: 0.55 }, seg1: { rot: a }, seg2: { rot: a }, seg3: { rot: -a }, head: { rot: -a },
    armL0: { rot: 35 - h }, armR0: { rot: -35 + h },
    armL1: { rot: 20 + h }, armR1: { rot: -20 - h }, armL2: { rot: -10 - h }, armR2: { rot: 10 + h } });
  const rest = (o) => kit.add(sway(0, 0), o);
  const anims = {
    idle: { fps: 5, frames: [sway(-3, 0), sway(0, 10), sway(3, 0), sway(0, -10)] },
    walk: { fps: 5, frames: [sway(-3, 0), sway(0, 10), sway(3, 0), sway(0, -10)] },
    // bursting up out of the ground
    emerge: { fps: 10, frames: [
      rest({ rise: { y: 70 } }),
      rest({ rise: { y: 46 }, ...open }),
      rest({ rise: { y: 22 }, ...open }),
      rest({ rise: { y: -4 }, ...open })
    ] },
    // sinking back down
    burrow: { fps: 10, frames: [
      rest({ rise: { y: 12 } }),
      rest({ rise: { y: 34 } }),
      rest({ rise: { y: 56 } }),
      rest({ rise: { y: 80 } })
    ] },
    // lunging down to bite
    slam: { fps: 9, frames: [
      { ...sway(-6, 20), ...open },
      kit.add(sway(0, 0), { seg1: { rot: 14 }, seg2: { rot: 18 }, seg3: { rot: 22 }, head: { rot: 10 } }, open),
      kit.add(sway(0, 0), { seg1: { rot: 18 }, seg2: { rot: 24 }, seg3: { rot: 26 }, head: { rot: 14 } }, open)
    ] },
    // spitting a poison glob
    spit: { fps: 8, frames: [
      kit.add(sway(-8, 10), { head: { y: -2 } }),
      kit.add(sway(4, -10), open, { spit: { show: true } }),
      kit.add(sway(2, 0), open)
    ] },
    hurt: { fps: 8, frames: [kit.add(sway(-8, 25), { head: { x: -3 } }, open)] },
    // topples over and sinks
    death: { fps: 5, frames: [
      kit.add(sway(-10, 30), open),
      kit.add(sway(-20, 40), { seg0: { rot: -15 } }, open),
      kit.add(sway(-25, 50), { seg0: { rot: -35 }, rise: { y: 10 } }, open),
      kit.add(sway(-28, 55), { seg0: { rot: -50 }, rise: { y: 22 } })
    ] }
  };
  const PAL = { o: '#1A0F1C', L: '#B898B8', b: '#8A6A8E', d: '#5A3E60', N: '#D8B0B0', n: '#A07878', W: '#E8D8EC',
    y: '#6E9A20', Y: '#D8FF5A', t: '#E9E4D4', m: '#3A0F1A', r: '#8A2A3A', g: '#7EC850', G: '#D8FF8A',
    h: '#5A4A2E', k: '#1E140E', p: '#3E2A42', R: '#C94A5A' };
  return { size: 96, rig: r, anims, palette: () => PAL, once: ['emerge', 'burrow', 'slam', 'spit', 'hurt', 'death'] };
});
