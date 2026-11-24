// Rotgrub (Floor 5): a fat segmented grub that spits poison.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.rotgrub = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp } = kit;
  const seg = (w, h, seed) => stamp(blob(w, h, { light: 'L', base: 'b', dark: 'd', seed }), ['.s', 'ss'], Math.floor(w / 2) - 1, Math.floor(h / 2) - 1);
  let HEAD = blob(11, 10, { light: 'L', base: 'b', dark: 'd', shine: 'W' });
  HEAD = stamp(HEAD, ['.kk..', 'kKk..', '.kk..'], 5, 2);
  HEAD = stamp(HEAD, ['mm', '.m'], 8, 6);
  const JAW = ['p..', 'pp.', '.pp'];
  const SPIT = ['..g..', '.gGg.', 'gGWGg', '.gGg.', '..g..'];
  const r = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'tail', parent: 'root', rows: seg(7, 6, 3), pivot: [3, 5], at: [8, 29], z: 1 },
      { name: 'seg2', parent: 'root', rows: seg(9, 8, 4), pivot: [4, 7], at: [12, 29], z: 2 },
      { name: 'seg1', parent: 'root', rows: seg(10, 9, 5), pivot: [5, 8], at: [17, 29], z: 3 },
      { name: 'head', parent: 'root', rows: HEAD, pivot: [5, 9], at: [22, 29], z: 4 },
      { name: 'jaw', parent: 'head', rows: JAW, pivot: [0, 0], at: [9, 6], z: 5 },
      { name: 'spit', parent: 'head', rows: SPIT, pivot: [2, 2], at: [13, 6], z: 6, hidden: true, outline: false }
    ]
  };
  const crawl = (a) => ({ tail: { y: -a, x: a }, seg2: { y: a ? 0 : -2 }, seg1: { y: -a, x: a ? 0 : 1 }, head: { y: a ? 0 : -1, x: a ? 1 : 0 } });
  const anims = {
    idle: { fps: 3, frames: [{}, { seg1: { y: -1 }, head: { y: 1 } }] },
    walk: { fps: 8, frames: [crawl(0), crawl(1), crawl(2), crawl(1)] },
    spit: { fps: 10, frames: [
      { head: { rot: -20, x: -1 }, jaw: { rot: -30 }, seg1: { y: -1 } },
      { head: { rot: 10, x: 2 }, jaw: { rot: 30 }, spit: { show: true } },
      { head: { rot: 5, x: 1 }, jaw: { rot: 20 } }
    ] },
    hurt: { fps: 8, frames: [{ head: { rot: -15, x: -2 }, seg1: { sy: 0.85 } }] },
    death: { fps: 8, frames: [
      { head: { rot: 30, y: 1 }, seg1: { sy: 0.8 }, seg2: { sy: 0.8 } },
      { head: { rot: 80, y: 3 }, seg1: { sy: 0.5, sx: 1.2 }, seg2: { sy: 0.5 }, tail: { sy: 0.6 } },
      { head: { rot: 100, y: 4, sy: 0.6 }, seg1: { sy: 0.3, sx: 1.3 }, seg2: { sy: 0.3 }, tail: { sy: 0.4 } }
    ] }
  };
  const PAL = { o: '#1E2414', L: '#EAD9B2', b: '#C9B08A', d: '#8E765A', s: '#7EA84A', W: '#FFFFFF', k: '#120A16', K: '#E5534B', m: '#3A2A1E', p: '#5A3A2A', g: '#7EC850', G: '#B8F07A' };
  return { size: 32, rig: r, anims, palette: () => PAL, once: ['spit', 'hurt', 'death'] };
});
