// Ashmaw: a big red dragon. Walks, flaps its wings, swipes its tail, breathes fire.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.dragon = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp, on } = kit;
  const grid = (w, h) => Array.from({ length: h }, () => '.'.repeat(w));
  const scale = (o) => blob(o.w, o.h, { light: 'R', base: 'r', dark: 'd', shine: o.shine, seed: o.seed });

  // body with a striped golden belly
  let BODY = scale({ w: 34, h: 22, shine: 'E' });
  BODY = BODY.map((row, y) => (y < 13 ? row : row.replace(/[rdR]/g, (ch, x) => (x > 6 && x < 28 && (y < 21) ? ((y % 3 === 0) ? 'B' : 'b') : ch))));

  // head: skull + snout, horns, glowing eye
  let HEAD = grid(22, 14);
  HEAD = stamp(HEAD, scale({ w: 13, h: 11, seed: 2 }), 0, 3);
  HEAD = stamp(HEAD, scale({ w: 12, h: 7, seed: 3 }), 9, 6);
  HEAD = stamp(HEAD, ['hh....', '.hhh..', '..hhh.', '...hh.'], 0, 0);
  HEAD = stamp(HEAD, ['.hh', 'hh.'], 7, 1);
  HEAD = stamp(HEAD, ['ke', 'kk'], 8, 6);
  HEAD = stamp(HEAD, ['k'], 19, 8);
  HEAD = stamp(HEAD, ['t.t.t.t'], 12, 12);
  const JAW = ['dddddddddd..', '.ddddddddd..', '..t.t.t.t...'];
  const NECK = scale({ w: 10, h: 17, seed: 4 });

  // wing: three bony fingers from the shoulder with skin between them
  function wing(w, h, shoulder, tips) {
    const rows = [];
    const inTri = (px, py, a, b, c) => {
      const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
      const d1 = s([px, py], a, b), d2 = s([px, py], b, c), d3 = s([px, py], c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    const nearLine = (px, py, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)) < 0.9;
    };
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        const px = x + 0.5, py = y + 0.5;
        let ch = '.';
        for (let i = 0; i < tips.length - 1; i++) {
          const a = tips[i], b = tips[i + 1];
          if (inTri(px, py, shoulder, a, b)) {
            // scalloped edge between finger tips
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + 3;
            ch = Math.hypot(px - mx, py - my) < 3.2 ? '.' : (py < (a[1] + b[1]) / 2 + 6 ? 'W' : 'w');
          }
        }
        for (const t of tips) if (nearLine(px, py, shoulder, t)) ch = 'v';
        row += ch;
      }
      rows.push(row);
    }
    return rows;
  }
  const WING = wing(30, 24, [27, 22], [[1, 9], [6, 1], [16, 0], [26, 3]]);

  // tail: thick at the body, thin to a spade tip
  const TAIL = grid(24, 12).map((row, y) => [...row].map((_, x) => {
    const mid = 6 + Math.sin(x / 5) * 2, half = 1 + x * 0.15;
    if (x < 5) return Math.abs(y - 6) <= 4 - Math.abs(x - 2) ? 'h' : '.';
    return Math.abs(y + 0.5 - mid) <= half ? (y + 0.5 < mid - half / 2 ? 'R' : y + 0.5 > mid + half / 2 ? 'd' : 'r') : '.';
  }).join(''));

  let LEG = stamp(scale({ w: 10, h: 12, seed: 5 }), ['t.t.t'], 4, 11);
  LEG.push('...t.t.t..');
  const FIRE = grid(12, 9).map((row, y) => [...row].map((_, x) => {
    const half = 1 + x * 0.33, d = Math.abs(y + 0.5 - 4.5);
    if (d > half) return '.';
    const k = d / half;
    return k < 0.35 ? '1' : k < 0.7 ? '2' : '3';
  }).join(''));

  const r = {
    size: 80,
    parts: [
      { name: 'root', pivot: [40, 76], at: [40, 76] },
      { name: 'wingB', parent: 'body', rows: WING, pivot: [27, 22], at: [20, 4], z: 0 },
      { name: 'tail', parent: 'body', rows: TAIL, pivot: [23, 6], at: [3, 13], z: 1 },
      { name: 'legB', parent: 'root', rows: LEG, pivot: [5, 1], at: [30, 62], z: 2 },
      { name: 'body', parent: 'root', rows: BODY, pivot: [17, 21], at: [38, 66], z: 3 },
      { name: 'legF', parent: 'root', rows: LEG, pivot: [5, 1], at: [46, 63], z: 4 },
      { name: 'neck', parent: 'body', rows: NECK, pivot: [5, 16], at: [27, 8], z: 5 },
      { name: 'jaw', parent: 'head', rows: JAW, pivot: [1, 0], at: [9, 11], z: 5.5 },
      { name: 'head', parent: 'neck', rows: HEAD, pivot: [4, 9], at: [6, 3], z: 6 },
      { name: 'fire', parent: 'head', rows: FIRE, pivot: [0, 4], at: [20, 11], z: 7, hidden: true, outline: false },
      { name: 'wingF', parent: 'body', rows: WING, pivot: [27, 22], at: [24, 6], z: 8 }
    ]
  };
  const rest = { neck: { rot: 18 }, head: { rot: -18 }, wingF: { rot: 8 }, wingB: { rot: 2 } };
  const wings = (a) => ({ wingF: { rot: a }, wingB: { rot: a * 0.8 } });
  const anims = {
    idle: { fps: 3, frames: on(rest, [{}, { body: { sy: 1.02 }, neck: { rot: -2 }, tail: { rot: -4 }, wingF: { rot: -3 } }, { neck: { rot: -3 }, tail: { rot: -6 } }]) },
    walk: { fps: 6, frames: on(rest, [
      { legF: { x: 3 }, legB: { x: -3 }, tail: { rot: 6 }, body: { y: 0 } },
      { legB: { y: -3 }, body: { y: -1 }, tail: { rot: 0 }, neck: { rot: -3 } },
      { legF: { x: -3 }, legB: { x: 3 }, tail: { rot: -6 } },
      { legF: { y: -3 }, body: { y: -1 }, tail: { rot: 0 }, neck: { rot: -3 } }
    ]) },
    // big wing beats (takeoff, gusts)
    flap: { fps: 9, frames: on(rest, [
      Object.assign(wings(-30), { body: { y: -2 } }),
      Object.assign(wings(5), { body: { y: -1 } }),
      Object.assign(wings(35), { body: { y: 1 }, legF: { y: -2 }, legB: { y: -2 } }),
      Object.assign(wings(5), { body: { y: -1 } })
    ]) },
    // tail swipe: spins round, tail sweeping
    tail: { fps: 9, frames: on(rest, [
      { tail: { rot: 30 }, body: { rot: -4 }, neck: { rot: -10 } },
      { tail: { rot: -35 }, body: { rot: 4 }, neck: { rot: 6 }, legF: { x: 2 } },
      { tail: { rot: -55 }, body: { rot: 6 }, neck: { rot: 10 }, legF: { x: 3 } }
    ]) },
    // fire breath: head low and forward, jaw open, flames
    breathe: { fps: 10, frames: on(rest, [
      { neck: { rot: 25 }, head: { rot: 10 }, jaw: { rot: 25 }, fire: { show: true }, wingF: { rot: -10 } },
      { neck: { rot: 27 }, head: { rot: 8 }, jaw: { rot: 30 }, fire: { show: true, sy: 1.15, x: 1 }, wingF: { rot: -12 } }
    ]) },
    hurt: { fps: 8, frames: on(rest, [{ neck: { rot: -20 }, head: { rot: -10 }, jaw: { rot: 20 }, body: { rot: -3, x: -2 }, wingF: { rot: -15 } }]) },
    // collapses: legs give way, wings fall, head hits the floor
    death: { fps: 4, frames: on(rest, [
      { neck: { rot: -10 }, jaw: { rot: 30 }, wingF: { rot: -20 }, wingB: { rot: -20 } },
      { body: { y: 4 }, legF: { y: -2 }, legB: { y: -2 }, neck: { rot: 30 }, head: { rot: 10 }, jaw: { rot: 20 }, wingF: { rot: 30 }, wingB: { rot: 30 } },
      { body: { y: 9, rot: 4 }, legF: { y: -5, x: 3 }, legB: { y: -5, x: -3 }, neck: { rot: 40 }, head: { rot: 20 }, wingF: { rot: 60 }, wingB: { rot: 50 }, tail: { rot: 10 } },
      { body: { y: 11, rot: 6 }, legF: { y: -6, x: 4 }, legB: { y: -6, x: -4 }, neck: { rot: 45 }, head: { rot: 20 }, wingF: { rot: 70 }, wingB: { rot: 60 }, tail: { rot: 15 } }
    ]) }
  };
  anims.fly = anims.flap;
  const PAL = { o: '#1A0E0C', R: '#D8553A', r: '#B8381E', d: '#7E2414', E: '#F28A6A', b: '#F2A541', B: '#C77A2E', e: '#FFF1B8', k: '#1A0E0C', t: '#E9E4D4', h: '#E9E4D4', w: '#8A2A1A', W: '#A83A26', v: '#4A1810', '1': '#FFF1B8', '2': '#F2A541', '3': '#E5622B' };
  return { size: 80, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
