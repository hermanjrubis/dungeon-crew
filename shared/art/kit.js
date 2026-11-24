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

  return { add, on, commonAnims };
});
