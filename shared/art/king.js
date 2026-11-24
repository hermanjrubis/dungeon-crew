// The Hollow King: a dark armored king with a crown, purple cape and a shadow blade.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.king = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { blob, stamp, plate, mirror } = kit;
  const armor = (w, h, round) => plate(w, h, { light: 'A', base: 'a', dark: 'c', round });
  let TORSO = armor(22, 18, 2);
  TORSO = stamp(TORSO, ['..yyyy..', '.yeeeey.', '..yyyy..'], 7, 4);
  TORSO = stamp(TORSO, ['b'.repeat(22)], 0, 13);
  TORSO = stamp(TORSO, ['..Y...'], 8, 13);
  let HEAD = blob(16, 15, { light: 'K', base: 'k', dark: 'j' });
  HEAD = stamp(HEAD, ['EE....EE', 'ee....ee'], 4, 7);
  const CROWN = [
    'Y...Y...Y...Y...',
    'YY..YY.YY..YY..Y',
    'YyY.YyYyY.YyY.Yy',
    'YyyYYyeyYYyyYYyy',
    'yyyyyyyyyyyyyyyy'
  ];
  // cape: wider toward the bottom, with dark folds
  const CAPE = Array.from({ length: 32 }, (_, y) => {
    const w = 18 + Math.round(y * 0.45), pad = Math.floor((34 - w) / 2);
    let row = '';
    for (let x = 0; x < 34; x++) {
      if (x < pad || x >= pad + w) { row += '.'; continue; }
      const i = x - pad;
      row += i % 5 === 0 ? 'q' : i < 3 ? 'P' : 'p';
    }
    return row;
  });
  let ARM = Array.from({ length: 17 }, () => '.'.repeat(9));
  ARM = stamp(ARM, armor(9, 6, 2), 0, 0);
  ARM = stamp(ARM, armor(5, 9, 1), 2, 5);
  ARM = stamp(ARM, armor(6, 4, 1), 1, 13);
  const LEG = stamp(armor(7, 12, 1), armor(8, 4, 1).map((r) => r.slice(0, 7)), 0, 9);
  const SWORD = [
    '...e...',
    '..eSe..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    '..eSs..',
    'yyyYyyy',
    'y.yYy.y',
    '...g...',
    '...g...',
    '...g...',
    '..yYy..'
  ];
  const RING = kit.blob(40, 14, { light: 'R', base: '.', dark: 'R' }).map((r, y, all) => r.replace(/./g, (ch, x) => {
    const inside = (rr, xx) => rr !== undefined && rr[xx] !== undefined && rr[xx] !== '.';
    if (ch === '.' ) return '.';
    const edge = !inside(all[y - 1] && all[y - 1], x) || !inside(all[y + 1], x) || !inside(r, x - 1) || !inside(r, x + 1);
    return edge ? 'R' : '.';
  }));
  const r = {
    size: 64,
    parts: [
      { name: 'root', pivot: [32, 60], at: [32, 60] },
      { name: 'ring', parent: 'root', rows: RING, pivot: [20, 7], at: [32, 56], z: 0, hidden: true, outline: false },
      { name: 'hip', parent: 'root', pivot: [32, 46], at: [32, 46] },
      { name: 'cape', parent: 'hip', rows: CAPE, pivot: [17, 0], at: [32, 26], z: 0 },
      { name: 'legB', parent: 'root', rows: LEG, pivot: [3, 0], at: [28, 47], z: 1 },
      { name: 'legF', parent: 'root', rows: LEG, pivot: [3, 0], at: [36, 47], z: 2 },
      { name: 'armB', parent: 'hip', rows: mirror(ARM), pivot: [5, 2], at: [21, 28], z: 3 },
      { name: 'torso', parent: 'hip', rows: TORSO, pivot: [11, 17], at: [32, 47], z: 4 },
      { name: 'head', parent: 'hip', rows: HEAD, pivot: [8, 14], at: [32, 31], z: 5 },
      { name: 'crown', parent: 'head', rows: CROWN, pivot: [8, 4], at: [8, 3], z: 6 },
      { name: 'sword', parent: 'armF', rows: SWORD, pivot: [3, 21], at: [4, 15], z: 7 },
      { name: 'armF', parent: 'hip', rows: ARM, pivot: [3, 2], at: [43, 28], z: 8 }
    ]
  };
  const rest = { sword: { rot: 20 }, armF: { rot: -10 } };
  const anims = {
    idle: { fps: 3, frames: kit.on(rest, [{}, { hip: { y: 1 }, cape: { sx: 1.04 } }]) },
    walk: { fps: 7, frames: kit.on(rest, [
      { legF: { x: 3 }, legB: { x: -3 }, cape: { rot: 4 }, armB: { rot: 10 } },
      { legB: { y: -3 }, hip: { y: -1 }, cape: { rot: 2 } },
      { legF: { x: -3 }, legB: { x: 3 }, cape: { rot: 4 }, armB: { rot: -10 } },
      { legF: { y: -3 }, hip: { y: -1 }, cape: { rot: 6 } }
    ]) },
    // calls his court: blade raised high
    raise: { fps: 6, frames: kit.on(rest, [
      { armF: { rot: -145 }, sword: { rot: 140 }, armB: { rot: 40 }, hip: { y: -1 } },
      { armF: { rot: -150 }, sword: { rot: 145 }, armB: { rot: 45 }, hip: { y: -2 }, head: { y: -1 } }
    ]) },
    // shadow ring: arms spread, a ring of darkness on the floor
    ring: { fps: 8, frames: kit.on(rest, [
      { armF: { rot: -100 }, armB: { rot: 100 }, sword: { rot: 100 }, ring: { show: true }, cape: { sx: 1.15 } },
      { armF: { rot: -105 }, armB: { rot: 105 }, sword: { rot: 105 }, ring: { show: true, sx: 1.15, sy: 1.15 }, cape: { sx: 1.2 }, hip: { y: -1 } }
    ]) },
    hurt: { fps: 8, frames: kit.on(rest, [{ hip: { rot: -6, x: -2 }, head: { rot: -8 }, armF: { rot: 20 } }]) },
    // kneels, drops the blade, the crown rolls away
    death: { fps: 4, frames: kit.on(rest, [
      { hip: { y: 4, rot: 4 }, legF: { y: -3, x: 2 }, armF: { rot: 30 }, head: { rot: 10 } },
      { hip: { y: 8, rot: 10 }, legF: { y: -5, x: 3 }, legB: { y: -2 }, armF: { rot: 60 }, sword: { rot: 80 }, head: { rot: 20, y: 1 } },
      { hip: { y: 12, rot: -60, x: -6 }, legF: { show: false }, legB: { rot: -60, x: 4, y: -2 }, armF: { rot: 80 }, sword: { rot: 90 }, crown: { y: 8, x: 10, rot: 90 } },
      { hip: { y: 13, rot: -85, x: -8 }, legF: { show: false }, legB: { rot: -85, x: 6, y: -3 }, armF: { rot: 90 }, sword: { rot: 90 }, crown: { y: 10, x: 16, rot: 100 } }
    ]) }
  };
  const PAL = { o: '#120E18', A: '#6A5E88', a: '#4A4063', c: '#2F2842', b: '#2A2238', y: '#F2C14E', Y: '#FFE48A', e: '#C77DFF', E: '#F0D8FF', K: '#2E2540', k: '#1B1524', j: '#0F0B16', P: '#7A3A90', p: '#5B2A6E', q: '#3E1A4C', S: '#C77DFF', s: '#2A2238', g: '#5C3B1E', R: '#C77DFF' };
  return { size: 64, rig: r, anims, palette: () => PAL, once: ['hurt', 'death'] };
});
