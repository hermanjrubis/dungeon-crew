// Rig: draws a character from separate pixel-art parts (head, body, arms, legs,
// weapon...) and poses those parts into real pixel frames.
// Each part is rows of letters; each letter is a color from the palette ('.' = clear).
// Parts hang off a parent at a point, and a pose can move, turn or stretch any part.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.rig = factory(); }
})(this, function () {
  // ---------- colors ----------
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, k) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
  }
  const darken = (hex, k) => mix(hex, '#14101C', k);
  const lighten = (hex, k) => mix(hex, '#FFFFFF', k);

  // ---------- matrices (a, b, c, d, e, f) = [a c e; b d f] ----------
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  const move = (x, y) => [1, 0, 0, 1, x, y];
  const turn = (deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
  const stretch = (x, y) => [x, 0, 0, y, 0, 0];
  function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
      (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  }
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  // ---------- smooth enlarging (EPX), used so turned parts keep clean lines ----------
  function epx(grid) {
    const h = grid.length, w = grid[0].length;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : grid[y][x]);
    const out = Array.from({ length: h * 2 }, () => new Array(w * 2));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = grid[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        let p1 = p, p2 = p, p3 = p, p4 = p;
        if (C === A && C !== D && A !== B) p1 = A;
        if (A === B && A !== C && B !== D) p2 = B;
        if (D === C && D !== B && C !== A) p3 = C;
        if (B === D && B !== A && D !== C) p4 = D;
        out[y * 2][x * 2] = p1; out[y * 2][x * 2 + 1] = p2;
        out[y * 2 + 1][x * 2] = p3; out[y * 2 + 1][x * 2 + 1] = p4;
      }
    }
    return out;
  }

  // Turns a part's letter rows into a grid of letters (null = clear), plus a 4x smooth copy.
  const cache = new Map();
  function prepare(rows) {
    let p = cache.get(rows);
    if (!p) {
      const grid = rows.map((r) => [...r].map((ch) => (ch === '.' ? null : ch)));
      p = { grid, big: epx(epx(grid)), w: rows[0].length, h: rows.length };
      cache.set(rows, p);
    }
    return p;
  }

  // ---------- drawing one frame ----------
  // rig: { size, parts: [{ name, parent?, rows?, pivot:[x,y], at:[x,y], z, hidden?, outline? }] }
  // pose: { partName: { x, y, rot, sx, sy, show } }
  // Returns size x size grid of hex colors (null = clear).
  function renderFrame(rig, pose, palette) {
    const size = rig.size;
    const W = rig.width || size, H = rig.height || size;
    const out = Array.from({ length: H }, () => new Array(W).fill(null));
    const world = new Map();
    const byName = new Map(rig.parts.map((p) => [p.name, p]));
    function matrixOf(part) {
      if (world.has(part.name)) return world.get(part.name);
      const q = pose[part.name] || {};
      const parent = part.parent ? matrixOf(byName.get(part.parent)) : [1, 0, 0, 1, 0, 0];
      const ax = part.at[0] + (q.x || 0), ay = part.at[1] + (q.y || 0);
      // a rigid part (like eyes) follows its parent around but is never stretched by it
      let m = part.rigid ? move(...apply(parent, ax, ay)) : mul(parent, move(ax, ay));
      if (q.rot) m = mul(m, turn(q.rot));
      if (q.sx !== undefined || q.sy !== undefined) m = mul(m, stretch(q.sx ?? 1, q.sy ?? 1));
      m = mul(m, move(-part.pivot[0], -part.pivot[1]));
      world.set(part.name, m);
      return m;
    }
    const outlineColor = palette.o || '#14101C';
    const order = rig.parts.filter((p) => p.rows).slice().sort((a, b) => (pose[a.name]?.z ?? a.z) - (pose[b.name]?.z ?? b.z));
    for (const part of order) {
      const q = pose[part.name] || {};
      const visible = q.show !== undefined ? q.show : !part.hidden;
      if (!visible) continue;
      const m = matrixOf(part);
      const inv = invert(m);
      const src = prepare(part.rows);
      const plain = Math.abs(m[0] - 1) < 1e-6 && Math.abs(m[3] - 1) < 1e-6 && Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6;
      // where the part lands
      const corners = [[0, 0], [src.w, 0], [0, src.h], [src.w, src.h]].map(([x, y]) => apply(m, x, y));
      const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))) - 1);
      const x1 = Math.min(W - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))) - 1);
      const y1 = Math.min(H - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))) + 1);
      const layer = new Map();
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const [u, v] = apply(inv, x + 0.5, y + 0.5);
          if (u < 0 || v < 0 || u >= src.w || v >= src.h) continue;
          const ch = plain ? src.grid[Math.floor(v)][Math.floor(u)] : src.big[Math.floor(v * 4)][Math.floor(u * 4)];
          if (ch) layer.set(y * W + x, ch);
        }
      }
      // dark outline around the part (also over parts behind it, to keep them apart)
      if ((q.outline ?? part.outline) !== false) {
        for (const key of layer.keys()) {
          const x = key % W, y = (key - x) / W;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (!layer.has(ny * W + nx)) out[ny][nx] = outlineColor;
          }
        }
      }
      for (const [key, ch] of layer) {
        const x = key % W, y = (key - x) / W;
        const color = palette[ch];
        if (color) out[y][x] = color;
      }
    }
    return out;
  }

  // All frames of every animation, in order: [{ anim, index, grid }]
  function renderAll(rig, anims, palette) {
    const frames = [];
    for (const [anim, def] of Object.entries(anims)) {
      def.frames.forEach((pose, index) => frames.push({ anim, index, grid: renderFrame(rig, pose, palette) }));
    }
    return frames;
  }

  // Root pose that spins a character about a point `up` pixels above its feet
  // (used for dodge rolls): { rot, x, y }.
  function spin(deg, up) {
    const r = deg * Math.PI / 180;
    return { rot: deg, x: Math.round(-up * Math.sin(r)), y: Math.round(-up + up * Math.cos(r)) };
  }

  return { renderFrame, renderAll, spin, darken, lighten, mix };
});
