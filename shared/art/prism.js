// Prismaurus (Floor 6 boss): a towering lizard giant with crystal spines that
// glow before it fires a prism beam. Stomps, tail sweeps, roars.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.prism = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp, on } = kit;
  const grid = (w, h) => Array.from({ length: h }, () => '.'.repeat(w));
  const hide = (w, h, seed, shine) => blob(w, h, { light: 'S', base: 's', dark: 'z', seed, shine, speckle: 0.05, speck: 'z' });

  // body with belly plates down the front
  let BODY = hide(34, 44, 2, 'L');
  BODY = BODY.map((row, y) => [...row].map((ch, x) => (ch !== '.' && y > 8 && y < 41 && x > 21 && x < 31 && row[x + 2] && row[x + 2] !== '.' ? (y % 4 === 0 ? 'p' : 'P') : ch)).join(''));
  // crystal spines along the back: shards growing up-and-back from the body's edge.
  // Drawn in body coordinates shifted 14 to the right (the grid starts 14 left of the body).
  function spines(c, mid, edge) {
    const W = 50, H = 58, OX = 14, OY = 12;
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const shards = [[3, 15], [8, 19], [13, 20], [18, 19], [23, 17], [28, 14], [33, 11], [38, 8]];
    for (const [y, L] of shards) {
      const ny = (y + 0.5 - 22) / 22;
      const ex = Math.round(17 - 17 * Math.sqrt(Math.max(0, 1 - ny * ny))) + OX + 2;
      const dx = -0.75, dy = -0.66;
      for (let t = 0; t <= L; t++) {
        const half = Math.max(0, Math.round((1 - t / L) * 3.4));
        for (let k = -half; k <= half; k++) {
          const x = Math.round(ex + dx * t + dy * k), yy = Math.round(OY + y + dy * t - dx * k);
          if (x >= 0 && x < W && yy >= 0 && yy < H) g[yy][x] = k < 0 ? c : k > 0 ? edge : mid;
        }
      }
    }
    return g.map((r) => r.join(''));
  }
  const SPINES = spines('C', 'c', 'b');
  const SPINES_GLOW = spines('G', 'g', 'B');
  let HEAD = grid(26, 16);
  HEAD = stamp(HEAD, hide(16, 14, 5, 'L'), 0, 0);
  HEAD = stamp(HEAD, hide(14, 9, 6), 11, 4);
  HEAD = stamp(HEAD, ['.ee', 'eEk', '.ee'], 11, 3);
  HEAD = stamp(HEAD, ['tt.t.tt.t.'], 13, 12);
  HEAD = stamp(HEAD, ['..C', '.Cc', 'Ccb'], 2, 0);
  const JAW = ['zzzzzzzzzzzz..', '.zzzzzzzzzzz..', '..t.t.t.t.t...'];
  const MOUTH_GLOW = ['..BBB..', '.BgggB.', 'BgGGGgB', '.BgggB.', '..BBB..'];
  const ARM = ['.ss.', 'sSss', 'sssz', '.ssz', '.ssz', '.sz.', 'sssz', 'k.k.'];
  let LEG = grid(18, 24);
  LEG = stamp(LEG, hide(16, 18, 7), 1, 0);
  LEG = stamp(LEG, hide(18, 7, 8), 0, 16);
  LEG = stamp(LEG, ['k..k..k..k'], 6, 23);
  // tail: thick at the body, tapering away, crystals along the top
  const TAIL = grid(44, 16).map((row, y) => [...row].map((_, x) => {
    const half = 1 + x * 0.16, mid = 9 - x * 0.08;
    if (Math.abs(y + 0.5 - mid) > half) return '.';
    return y + 0.5 < mid - half * 0.4 ? 'S' : y + 0.5 > mid + half * 0.5 ? 'z' : 's';
  }).join(''));
  const TAIL2 = stamp(stamp(stamp(TAIL, ['.C', 'Cb'], 10, 3), ['.C.', 'Ccb'], 20, 1), ['.C.', 'Ccb'], 30, 0);
  const BEAM = grid(30, 9).map((row, y) => [...row].map(() => { const d = Math.abs(y - 4); return d === 0 ? '1' : d === 1 ? '1' : d === 2 ? '2' : d === 3 ? '3' : '.'; }).join(''));
  const QUAKE = ['....7......8.......8......7....', '..787....878.....878....787....', '.78887..88888...88888..78887...'];

  const r = {
    size: 96,
    parts: [
      { name: 'root', pivot: [48, 92], at: [48, 92] },
      { name: 'tail', parent: 'body', rows: TAIL2, pivot: [43, 9], at: [6, 36], z: 0 },
      { name: 'legB', parent: 'root', rows: LEG, pivot: [9, 1], at: [40, 69], z: 1 },
      { name: 'armB', parent: 'body', rows: ARM, pivot: [2, 1], at: [26, 18], z: 1.5 },
      { name: 'spines', parent: 'body', rows: SPINES, pivot: [14, 12], at: [0, 0], z: 2 },
      { name: 'spinesGlow', parent: 'body', rows: SPINES_GLOW, pivot: [14, 12], at: [0, 0], z: 2.1, hidden: true },
      { name: 'body', parent: 'root', rows: BODY, pivot: [17, 43], at: [46, 76], z: 3 },
      { name: 'legF', parent: 'root', rows: LEG, pivot: [9, 1], at: [52, 70], z: 4 },
      { name: 'jaw', parent: 'head', rows: JAW, pivot: [1, 0], at: [12, 11], z: 5 },
      { name: 'head', parent: 'body', rows: HEAD, pivot: [5, 12], at: [26, 6], z: 6 },
      { name: 'glow', parent: 'head', rows: MOUTH_GLOW, pivot: [3, 2], at: [24, 11], z: 7, hidden: true, outline: false },
      { name: 'beam', parent: 'head', rows: BEAM, pivot: [0, 4], at: [25, 11], z: 7, hidden: true, outline: false },
      { name: 'armF', parent: 'body', rows: ARM, pivot: [2, 1], at: [29, 20], z: 8 },
      { name: 'quake', parent: 'root', rows: QUAKE, pivot: [15, 2], at: [52, 92], z: 9, hidden: true, outline: false }
    ]
  };
  const rest = { head: { rot: 4 }, armF: { rot: -20 }, armB: { rot: -10 } };
  const glow = { spines: { show: false }, spinesGlow: { show: true } };
  const anims = {
    idle: { fps: 3, frames: on(rest, [{}, { body: { y: 1 }, tail: { rot: -3 }, head: { rot: 2 } }]) },
    walk: { fps: 5, frames: on(rest, [
      { legF: { x: 3 }, legB: { x: -3 }, tail: { rot: 4 }, body: { rot: 2 } },
      { legB: { y: -4 }, body: { y: -2 }, tail: { rot: 0 } },
      { legF: { x: -3 }, legB: { x: 3 }, tail: { rot: -4 }, body: { rot: -2 } },
      { legF: { y: -4 }, body: { y: -2 }, tail: { rot: 0 } }
    ]) },
    // lifts a foot and stamps the ground
    stomp: { fps: 7, frames: on(rest, [
      { legF: { y: -10, x: 2 }, body: { rot: -5, y: -3 }, head: { rot: -8 } },
      { legF: { y: -12, x: 3 }, body: { rot: -6, y: -4 }, head: { rot: -10 } },
      { legF: { x: 3 }, body: { rot: 4, y: 1 }, quake: { show: true } },
      { legF: { x: 3 }, body: { rot: 2 }, quake: { show: true, sx: 1.3, y: -1 } }
    ]) },
    // swings round with its tail
    tail: { fps: 8, frames: on(rest, [
      { tail: { rot: 25 }, body: { rot: -6 } },
      { tail: { rot: -20 }, body: { rot: 6 }, legF: { x: 2 } },
      { tail: { rot: -40 }, body: { rot: 8 }, legF: { x: 3 } }
    ]) },
    // spines light up, one after another (getting ready to fire)
    charge: { fps: 8, frames: on(rest, [
      kit.add({ body: { y: 2 }, head: { rot: 10 } }, glow),
      kit.add({ body: { y: 2 }, head: { rot: 10 }, glow: { show: true } }, { spines: { show: true } }),
      kit.add({ body: { y: 2 }, head: { rot: 10 }, glow: { show: true } }, glow)
    ]) },
    // the prism beam
    beam: { fps: 10, frames: on(rest, [
      kit.add({ head: { rot: 12 }, jaw: { rot: 28 }, beam: { show: true }, body: { rot: 3 } }, glow),
      kit.add({ head: { rot: 12 }, jaw: { rot: 30 }, beam: { show: true, sy: 1.25 }, body: { rot: 3 } }, glow)
    ]) },
    roar: { fps: 8, frames: on(rest, [
      { head: { rot: -25 }, jaw: { rot: 35 }, body: { rot: -4 }, armF: { rot: -50 }, armB: { rot: -40 } },
      { head: { rot: -28 }, jaw: { rot: 38 }, body: { rot: -5, x: -1 }, armF: { rot: -55 }, armB: { rot: -45 } }
    ]) },
    hurt: { fps: 8, frames: on(rest, [{ head: { rot: -15 }, jaw: { rot: 20 }, body: { rot: -5, x: -2 }, tail: { rot: 10 } }]) },
    // topples backwards; the spines go dark
    death: { fps: 4, frames: on(rest, [
      { head: { rot: -20 }, jaw: { rot: 30 }, body: { rot: -6 } },
      { head: { rot: -30 }, jaw: { rot: 30 }, body: { rot: -25, y: 4 }, legF: { y: -2 } },
      { head: { rot: -20 }, jaw: { rot: 20 }, body: { rot: -55, y: 12, x: -6 }, legF: { show: false }, legB: { show: false } },
      { head: { rot: -10 }, jaw: { rot: 10 }, body: { rot: -78, y: 18, x: -10 }, legF: { show: false }, legB: { show: false } }
    ]) }
  };
  const PAL = { o: '#0E1418', S: '#5E8A96', s: '#3E6470', z: '#26404A', L: '#8AB4BE', p: '#7E9A90', P: '#A8C0B0',
    C: '#E8F4FF', c: '#9AD7F0', b: '#5EA8E0', G: '#FFFFFF', g: '#C8FAFF', B: '#6CE8FF',
    e: '#4ACFF0', E: '#E8FFFF', k: '#E9E4D4', t: '#E9E4D4', '1': '#FFFFFF', '2': '#9AF0FF', '3': '#4ACFF0', '7': '#8C84A3', '8': '#B9B2C8' };
  return { size: 96, rig: r, anims, palette: () => PAL, once: ['stomp', 'tail', 'roar', 'hurt', 'death'] };
});
