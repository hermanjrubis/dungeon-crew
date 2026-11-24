// Floor tiles, walls, pillars and floor decorations for each of the 6 floors,
// drawn as 24x24 pixel art (shown at 2x = one 48 px game tile).
// Each floor's look follows its monsters: slime-stained cellar stone, fungus and
// bones in the caverns, ember-cracked iron in the forge, scorched stone and ash
// at the roost, mud and roots in the warrens, pale crystal stone in the wastes.
// tileFrames(floorIndex) -> [{ name, grid }] in sheet order (see FRAME).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.terrain = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const S = 24;
  const { hash } = kit;

  // Where each frame sits in a floor's sheet.
  const FRAME = { floor: [0, 1, 2, 3], wall: 4, pillar: 5, deco: [6, 7, 8, 9] };

  const FLOORS = [
    { // 1 · Sunken Cellar: damp grey-violet stone, moss, purple slime stains
      stone: ['#2E2840', '#2A2438', '#262033', '#322B45'], line: '#1C1726', speck: '#3A3350',
      wall: ['#3D3452', '#4A4063', '#2E2740', '#5A4F78'], moss: '#2F4A3A', mossHi: '#3E5E48'
    },
    { // 2 · Fungal Caverns: brown earth, glowing fungus specks
      stone: ['#2E2620', '#2A231D', '#26201A', '#33291F'], line: '#1A1410', speck: '#3E3328',
      wall: ['#3E3226', '#4E3F30', '#2E251C', '#5E4C3A'], moss: '#2E5A50', mossHi: '#5EC8B8'
    },
    { // 3 · Molten Forge: dark iron plates, rivets, ember cracks
      stone: ['#2A2628', '#262224', '#221E20', '#2E2A2C'], line: '#141112', speck: '#3A3436',
      wall: ['#3A3034', '#4A3C40', '#2A2226', '#5A4A4E'], ember: '#E5622B', emberHi: '#F2A541', plates: true
    },
    { // 4 · Dragon's Roost: scorched stone, ash, hot cracks
      stone: ['#2C2422', '#28201E', '#241C1A', '#302725'], line: '#160F0E', speck: '#4A3E3A',
      wall: ['#3E2E2A', '#4E3A34', '#2E211E', '#5E463E'], ember: '#B8381E', emberHi: '#E5622B', ash: '#5A504E'
    },
    { // 5 · Rot Warrens: mud and moss
      stone: ['#252C1F', '#272E20', '#24291D', '#29301F'], line: '#1A1F14', speck: '#3E5A2A',
      wall: ['#3A2E24', '#4A3A2A', '#2A2018', '#5A4632'], moss: '#3E5A2A', mossHi: '#6EA84A'
    },
    { // 6 · Crystal Wastes: pale blue stone, crystal flecks
      stone: ['#2C3246', '#2E3449', '#2A3043', '#30364B'], line: '#20253A', speck: '#4A5878',
      wall: ['#3A3C5A', '#4A4C6E', '#2C2E48', '#6A7AA8'], crystal: '#9AD7F0', crystalHi: '#E8F4FF'
    }
  ];

  const blank = () => Array.from({ length: S }, () => Array(S).fill(null));

  // A floor tile: noisy stone with a dark seam on two edges, plus the floor's own touch.
  function floorTile(f, v, seed) {
    const g = blank();
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = hash(Math.floor(x / 2) + v * 31, Math.floor(y / 2) + seed * 7, 3 + v);
        g[y][x] = f.stone[n < 0.25 ? 2 : n < 0.8 ? (v % 2 ? 1 : 0) : 3];
        if (x === S - 1 || y === S - 1) g[y][x] = f.line;
        if (hash(x, y, 91 + v) < 0.025) g[y][x] = f.speck;
      }
    }
    if (f.plates) {
      // iron plates: a lighter rim and four rivets
      for (let i = 1; i < S - 2; i++) { g[1][i] = f.stone[3]; g[i][1] = f.stone[3]; }
      for (const [x, y] of [[3, 3], [S - 5, 3], [3, S - 5], [S - 5, S - 5]]) g[y][x] = f.speck;
    }
    if (v === 1 || v === 3) {
      // a crack, glowing on the hot floors
      let x = 4 + Math.floor(hash(v, seed, 5) * 12), y = 6;
      for (let i = 0; i < 12; i++) {
        g[y][x] = f.ember && i % 3 ? (i % 2 ? f.ember : f.emberHi) : f.line;
        x += hash(i, v, seed) < 0.5 ? 1 : 0;
        y += 1;
      }
    }
    if (v === 2 && f.moss) {
      // a patch of moss / fungus in one corner
      for (let y = 14; y < 22; y++) for (let x = 2; x < 11; x++) {
        if (hash(x, y, 77) < 0.55 - Math.hypot(x - 6, y - 18) * 0.08) g[y][x] = hash(x, y, 78) < 0.2 ? f.mossHi : f.moss;
      }
    }
    if (v === 2 && f.ash) {
      for (let y = 12; y < 20; y++) for (let x = 10; x < 20; x++) if (hash(x, y, 55) < 0.5 - Math.hypot(x - 15, y - 16) * 0.09) g[y][x] = f.ash;
    }
    if (v === 2 && f.crystal) {
      for (const [x, y] of [[6, 16], [7, 15], [15, 6], [16, 7], [18, 18]]) { g[y][x] = f.crystal; g[y - 1][x] = f.crystalHi; }
    }
    return g;
  }

  // A wall tile: bricks with a lit top edge.
  function wallTile(f) {
    const g = blank();
    const [base, light, dark, top] = f.wall;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 6);
        const off = row % 2 ? 6 : 0;
        const seam = y % 6 === 5 || (x + off) % 12 === 11;
        let c = seam ? dark : hash(Math.floor(x / 3), y, row + 9) < 0.3 ? light : base;
        if (y < 3) c = y === 0 ? top : light;
        g[y][x] = c;
      }
    }
    return g;
  }

  // A pillar standing on the floor: a block with a lit top.
  function pillarTile(f) {
    const g = floorTile(f, 0, 9);
    const [base, light, dark, top] = f.wall;
    for (let y = 1; y < S - 1; y++) {
      for (let x = 2; x < S - 2; x++) {
        let c = y < 7 ? (y < 3 ? top : light) : base;
        if (x === 2 || x === S - 3 || y === S - 2) c = dark;
        if (y >= 7 && (y - 7) % 6 === 5) c = dark;
        g[y][x] = c;
      }
    }
    return g;
  }

  // Decorations: small things lying on the floor (they don't block anything).
  const DECOS = [
    [ // Cellar: slime puddle, pebbles, a drip stain, moss tuft
      { rows: ['..pppp...', '.pPPPpp..', 'pPPpppppp', '.ppppppp.', '...ppp...'], pal: { p: '#8E3FA6', P: '#C76BD9' } },
      { rows: ['.ss..', 'sSs.s', '.s.sS', '...s.'], pal: { s: '#4A4063', S: '#6A5E88' } },
      { rows: ['..d..', '.ddd.', '.ddd.', 'ddddd', '.ddd.'], pal: { d: '#3E3A5A' } },
      { rows: ['.m.m.', 'mMmMm', '.mmm.'], pal: { m: '#2F4A3A', M: '#4E7A58' } }
    ],
    [ // Caverns: glowing mushrooms, bones, a skull, spores
      { rows: ['.cc..CC.', 'cCCc.CC.', '.ss..ss.', '.ss..s..'], pal: { c: '#5EC8B8', C: '#B8F0E4', s: '#CFC8B0' } },
      { rows: ['b.....b', 'bbbbbbb', 'b.....b'], pal: { b: '#E9E4D4' } },
      { rows: ['.www.', 'wkwkw', 'wwwww', '.w.w.'], pal: { w: '#E9E4D4', k: '#1A1410' } },
      { rows: ['g...g', '..G..', 'g...g'], pal: { g: '#5EC8B8', G: '#B8F0E4' } }
    ],
    [ // Forge: a chain, embers, a broken gear, a bolt
      { rows: ['cc.cc.cc', 'c.cc.cc.', 'cc.cc.cc'], pal: { c: '#6E6870' } },
      { rows: ['.e.E.', 'eEeEe', '.eee.'], pal: { e: '#E5622B', E: '#F2A541' } },
      { rows: ['.g.g.', 'ggggg', 'gg.gg', 'ggggg', '.g.g.'], pal: { g: '#5A4A4E' } },
      { rows: ['bb', 'bb', '.b', '.b'], pal: { b: '#8C84A3' } }
    ],
    [ // Roost: bones, ash, a dragon scale, eggshell
      { rows: ['b...b..', 'bbbbb.b', 'b...bbb'], pal: { b: '#E9E4D4' } },
      { rows: ['..aa..', '.aAaa.', 'aaaaaa'], pal: { a: '#5A504E', A: '#7A6E6A' } },
      { rows: ['.rr.', 'rRRr', 'rRrr', '.rr.'], pal: { r: '#B8381E', R: '#E5622B' } },
      { rows: ['.e..e', 'eEe.E', 'eee.e'], pal: { e: '#E9E4D4', E: '#FFFFFF' } }
    ],
    [ // Warrens: grub eggs, a root, a puddle, a small bone
      { rows: ['.oo.o', 'oOooO', '.oo.o'], pal: { o: '#C9B08A', O: '#EAD9B2' } },
      { rows: ['r......', '.rr....', '...rrr.', '......r'], pal: { r: '#5A4632' } },
      { rows: ['.ggggg.', 'gGgggggg', '.ggggg.'].map((r) => r.slice(0, 7)), pal: { g: '#3E7A2A', G: '#6EA84A' } },
      { rows: ['b...b', 'bbbbb', 'b...b'], pal: { b: '#C9C2A0' } }
    ],
    [ // Wastes: a crystal cluster, a shard, frost, sparkle
      { rows: ['..C..C.', '.CcC.Cc', '.Ccb.cb', 'Cccbccb'], pal: { C: '#E8F4FF', c: '#9AD7F0', b: '#5EA8E0' } },
      { rows: ['.C', 'Cc', 'cb'], pal: { C: '#F0E8FF', c: '#B89AF0', b: '#7A5AC8' } },
      { rows: ['.f.f.f', 'ffffff', '.f.f.f'], pal: { f: '#4A5878' } },
      { rows: ['..w..', '.....', 'w.W.w', '.....', '..w..'], pal: { w: '#9AD7F0', W: '#FFFFFF' } }
    ]
  ];

  function decoTile(floorIndex, i) {
    const d = DECOS[floorIndex][i];
    const r = { size: S, parts: [{ name: 'd', rows: d.rows, pivot: [Math.floor(d.rows[0].length / 2), Math.floor(d.rows.length / 2)], at: [12, 12], z: 1 }] };
    return rig.renderFrame(r, {}, Object.assign({ o: '#0B0810' }, d.pal));
  }

  function tileFrames(floorIndex) {
    const f = FLOORS[Math.max(0, Math.min(FLOORS.length - 1, floorIndex))];
    const fi = FLOORS.indexOf(f);
    return [
      ...[0, 1, 2, 3].map((v) => ({ name: 'floor' + v, grid: floorTile(f, v, fi + 1) })),
      { name: 'wall', grid: wallTile(f) },
      { name: 'pillar', grid: pillarTile(f) },
      ...[0, 1, 2, 3].map((i) => ({ name: 'deco' + i, grid: decoTile(fi, i) }))
    ];
  }

  // One sheet per floor; each 24 px frame is saved at 2x so it maps to a 48 px game tile.
  function terrainFiles() {
    return FLOORS.map((_, i) => ({ key: 'terrain-' + (i + 1), file: `terrain-${i + 1}.png`, floorIndex: i, frames: 10, size: S * 2 }));
  }

  return { S, FRAME, FLOORS, tileFrames, terrainFiles, count: FLOORS.length };
});
