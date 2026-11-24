// Helpers shared by the hero art: poses are written as changes from a resting
// pose, and every hero gets the same idle, walk, hurt, roll and down moves.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'));
  else { root.DC = root.DC || {}; root.DC.artKit = factory(root.DC.rig); }
})(this, function (rig) {
  // rest + change: x, y and rot add up; everything else (show, z, sx, sy) is replaced.
  function add(...poses) {
    const out = {};
    for (const p of poses) {
      if (!p) continue;
      for (const [part, v] of Object.entries(p)) {
        const o = Object.assign({}, out[part]);
        for (const [k, val] of Object.entries(v)) {
          o[k] = (k === 'x' || k === 'y' || k === 'rot') && typeof o[k] === 'number' ? o[k] + val : val;
        }
        out[part] = o;
      }
    }
    return out;
  }

  // Every frame of an animation built on top of the resting pose.
  const on = (rest, list) => list.map((d) => add(rest, d));

  // The moves every hero shares. `legs` = [back leg, front leg] part names.
  function commonAnims(rest, opts = {}) {
    const up = opts.rollCenter || 12;
    const tuck = opts.tuck || {};
    return {
      idle: { fps: 3, frames: on(rest, [{}, { hip: { y: 1 }, armF: { rot: -4 }, armB: { rot: 4 } }]) },
      walk: { fps: 9, frames: on(rest, [
        { legF: { x: 2 }, legB: { x: -2 }, armF: { rot: -18 }, armB: { rot: 14 } },
        { legB: { y: -2 }, hip: { y: -1 } },
        { legF: { x: -2 }, legB: { x: 2 }, armF: { rot: 18 }, armB: { rot: -14 } },
        { legF: { y: -2 }, hip: { y: -1 } }
      ]) },
      hurt: { fps: 6, frames: on(rest, [{ hip: { rot: -12, x: -2 }, head: { y: 1 }, armF: { rot: 30 }, armB: { rot: -30 }, legF: { x: -1 } }]) },
      roll: { fps: 16, frames: [0, 90, 180, 270].map((d) => add(rest, { root: rig.spin(d, up), hip: { y: 3 }, head: { y: 2 }, legF: { y: -3, x: -1 }, legB: { y: -3, x: 1 }, armF: { rot: -10 }, armB: { rot: 10 } }, tuck)) },
      down: { fps: 2, frames: on(rest, [add({ root: { rot: -90, x: 11, y: -6 }, armF: { rot: -10 } }, opts.down)]) }
    };
  }

  // Pixel noise that is the same every time (so the art never changes between builds).
  function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // A rounded body as letter rows, lit from the top-left:
  // `light` near the top-left, `base` in the middle, `dark` toward the bottom-right.
  // opts: { light, base, dark, shine, flat (0..1 flattens the bottom), rough (0..1 bumpy edge), seed, speckle, speck }
  function blob(w, h, opts) {
    const o = Object.assign({ light: 'L', base: 'b', dark: 'd', flat: 0, rough: 0, seed: 1 }, opts);
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        const nx = (x + 0.5 - w / 2) / (w / 2);
        let ny = (y + 0.5 - h / 2) / (h / 2);
        if (o.flat && ny > 0) ny *= 1 - o.flat * 0.5;
        const edge = 1 - o.rough * 0.35 * hash(Math.floor(x / 2), Math.floor(y / 2), o.seed);
        const d = nx * nx + ny * ny;
        if (d > edge) { row += '.'; continue; }
        const lit = nx * 0.55 + ny * 0.85;
        let ch = lit < -0.66 ? o.light : lit > 0.45 ? o.dark : o.base;
        if (o.shine && nx > -0.62 && nx < -0.38 && ny > -0.72 && ny < -0.5) ch = o.shine;
        if (o.speckle && ch === o.base && hash(x, y, o.seed + 7) < o.speckle) ch = o.speck || o.dark;
        row += ch;
      }
      rows.push(row);
    }
    return rows;
  }

  // Draw `art` rows on top of `rows` at (x, y); '.' in art leaves what is there.
  function stamp(rows, art, x, y) {
    const out = rows.slice();
    art.forEach((line, j) => {
      const r = out[y + j];
      if (r === undefined) return;
      let chars = [...r];
      [...line].forEach((ch, i) => { if (ch !== '.' && x + i >= 0 && x + i < chars.length) chars[x + i] = ch; });
      out[y + j] = chars.join('');
    });
    return out;
  }

  const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

  // A rounded box (armor plates, legs, arms): lit on the left, shaded on the right.
  function plate(w, h, opts) {
    const o = Object.assign({ light: 'L', base: 'b', dark: 'd', round: 1 }, opts);
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        const corner = (x < o.round || x >= w - o.round) && (y < o.round || y >= h - o.round);
        if (corner) { row += '.'; continue; }
        row += x < Math.max(1, Math.round(w * 0.22)) || y === 0 ? o.light : x >= w - Math.max(1, Math.round(w * 0.25)) || y === h - 1 ? o.dark : o.base;
      }
      rows.push(row);
    }
    return rows;
  }

  return { add, on, commonAnims, hash, blob, stamp, mirror, plate };
});
