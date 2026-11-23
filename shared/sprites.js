// Placeholder pixel art, copied from the design mockups.
// Each sprite is 16x16 letters; each letter is one color from its palette ('.' = see-through).
// `npm run sprites` turns these into PNG files in client/assets/.
// Your art team can replace any PNG with their own drawing of the same name and size.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.sprites = factory(); }
})(this, function () {
  const MAPS = {
    knight: [
      '........pp......', '.......pp.......', '......oooooo....', '.....ohhhhhho...',
      '.....ohvvvvho...', '.....ohhhhhho...', '......oooooo....', '....ooaaaaaaoo..',
      '...oaaaabbaaaao.', '...oaoaaaaaaoao.', '...oao.abba.oao.', '....o..aaaa..o..',
      '......ollllo....', '......ol..lo....', '......of..fo....', '.....off..ffo...'
    ],
    archer: [
      '................', '......oooo......', '.....ohhhho.....', '....ohhhhhho....',
      '....osksskso....', '....ohssssho....', '.....oaaaao...b.', '....oaaaaaao..bt',
      '...oaoaaaaoao.bt', '...os.oaao.so.bt', '......oaao....bt', '......ollo....b.',
      '......ol..lo....', '......ol..lo....', '......of..fo....', '.....off..ffo...'
    ],
    mage: [
      '.......o........', '......oho.......', '......ohho......', '.....ohhhho.....',
      '....ohhhhhho....', '..oohhhhhhhhoo..', '....osksskso....', '....osswwsso..g.',
      '...ohhwwwwhho.g.', '..ohhhhwwhhhhoe.', '..ohshhhhhhshoe.', '...ohhhhhhhho.e.',
      '...ohhhhhhhho.e.', '..ohhhhhhhhhho.e', '..oooooooooooo.e', '....of....fo....'
    ],
    gloop: [
      '................', '................', '................', '................',
      '......oooo......', '....oobbbboo....', '...obblbbbbbo...', '..obllbbbbbbbo..',
      '..obbwkbbwkbbo..', '.obbbkkbbkkbbbo.', '.obbbbbbbbbbbbo.', '.obbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbo.', '..oobbbbbbbboo..', '....oooooooo....', '................'
    ],
    bat: [
      '................', '................', '................', 'o..............o',
      'oo.....oo.....oo', 'owo...obbo...owo', 'owwo.obbbbo.owwo', 'owwwobrbbrbowwwo',
      'owwwwbbbbbbwwwwo', '.owwwbbffbbwwwo.', '..owobbbbbbowo..', '...o.obbbbo.o...',
      '......obbo......', '.......oo.......', '................', '................'
    ],
    mother: [
      '....g..g..g.....', '....gggggggg....', '....oooooooo....', '..oobbbbbbbboo..',
      '.obblbbbbbbbbbo.', '.obllbbbbbbbbbo.', 'obbwkbbbbbbwkbbo', 'obbkkbbbbbbkkbbo',
      'obbbbbbbbbbbbbbo', 'obbbbbmmmmbbbbbo', 'obbbbbbbbbbbbbbo', 'obbnbbbbbbbbnbbo',
      'obbbbbbbbbbbbbbo', '.obbbbbbbbbbbbo.', '..oooooooooooo..', '................'
    ]
  };

  // Heroes wear the player's color.
  function heroPalette(heroClass, hex) {
    if (heroClass === 'knight') return { o: '#14101C', h: '#A7A1B8', v: '#120A16', a: hex, b: '#5C3B1E', l: '#3D3452', f: '#2A2438', p: hex };
    if (heroClass === 'archer') return { o: '#14101C', h: hex, s: '#E8B48A', k: '#120A16', a: '#5A4A3A', l: '#3D3452', f: '#5C3B1E', b: '#8A5A2E', t: '#CFC8DE' };
    return { o: '#14101C', h: hex, s: '#E8B48A', k: '#120A16', w: '#E9E4D4', g: '#5EC8B8', e: '#8A5A2E', f: '#2A2438' };
  }

  const MONSTER_PALETTES = {
    gloop: { o: '#2A1533', b: '#C76BD9', l: '#E3A6EE', w: '#FFFFFF', k: '#120A16' },
    bat: { o: '#1A1024', b: '#5B4A7A', w: '#8E7BB0', r: '#F2A541', f: '#FFFFFF' },
    mother: { o: '#2A1533', b: '#A94FC0', l: '#E3A6EE', w: '#FFFFFF', k: '#120A16', m: '#120A16', g: '#F2A541', n: '#E3A6EE' }
  };

  const COLORS = { orange: '#F2A541', blue: '#6C9BF2', teal: '#5EC8B8', pink: '#E58FB8' };

  // Every PNG the game loads: its file name, map, palette and size in pixels.
  function spriteFiles() {
    const out = [];
    for (const cls of ['knight', 'archer', 'mage']) {
      for (const [color, hex] of Object.entries(COLORS)) {
        out.push({ file: `${cls}-${color}.png`, key: `${cls}-${color}`, rows: MAPS[cls], palette: heroPalette(cls, hex), size: 48 });
      }
    }
    out.push({ file: 'gloop.png', key: 'gloop', rows: MAPS.gloop, palette: MONSTER_PALETTES.gloop, size: 48 });
    out.push({ file: 'minigloop.png', key: 'minigloop', rows: MAPS.gloop, palette: MONSTER_PALETTES.gloop, size: 32 });
    out.push({ file: 'bat.png', key: 'bat', rows: MAPS.bat, palette: MONSTER_PALETTES.bat, size: 48 });
    out.push({ file: 'mother.png', key: 'mother', rows: MAPS.mother, palette: MONSTER_PALETTES.mother, size: 96 });
    out.push({ file: 'halfmother.png', key: 'halfmother', rows: MAPS.mother, palette: MONSTER_PALETTES.mother, size: 64 });
    return out;
  }

  return { MAPS, heroPalette, MONSTER_PALETTES, spriteFiles };
});
