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
    bonearcher: [
      '....oooooo......', '...owwwwwwo...b.', '...owkwwkwo...bt', '...owwwwwwo..b.t',
      '....owsswo...b.t', '.....oooo....b.t', '...oowwwwoo.b..t', '..owoswswsowwwwt',
      '..ow.owwwo..b..t', '.....oswso...b.t', '.....owwwo...b.t', '....ow.o.wo..b.t',
      '....ow...wo...bt', '....ow...wo...b.', '...oow...woo....', '................'
    ],
    bones: [
      '................', '................', '................', '................',
      '................', '................', '................', '.....oooo.......',
      '....owwwwo......', '....owkwko......', '.....owwo.......', '..oo.......oo...',
      '...owwwwwwwwo...', '..oo.......oo...', '....owo..owo....', '................'
    ],
    sporecap: [
      '..g..........g..', '.....oooooo.....', '...oocccccdoo...', '..ocdcccccccco..',
      '.occcccdddcccco.', '.ocddcccdcccdco.', 'ocdddccccccdddco', 'occdccccccccdcco',
      '.oooooooooooooo.', '....osssssso....', '....osksskso....', '....osssssso....',
      '...ohssssssho...', '...oooooooooo...', '.g............g.', '................'
    ],
    seed: [
      '................', '................', '................', '................',
      '................', '......oooo......', '.....oggggo.....', '....ogglgggo....',
      '....oggggggo....', '....ogggglgo....', '.....oggggo.....', '......oooo......',
      '.......tt.......', '......t..t......', '................', '................'
    ],
    queen: [
      '...oooooooooo...', '.oocccdccccdcoo.', 'occdddccccdddcco', 'occcdccddccdccco',
      'oooooooooooooooo', '...ossssssssso..', '...oskkssskksso.', '...osssmmmsssso.',
      '.vvosssssssssov.', 'v..ossssssssso.v', 'v..ohsssssssho.v', '.v.ohsssssssho.v',
      '..voooooooooov..', '.gvv..g..g..vvg.', 'vv............vv', '................'
    ],
    golem: [
      '................', '.....oooooo.....', '....oddddddo....', '...odeddddedo...',
      '...oddddddddo...', '..ooodccccdooo..', '.oddddddddddddo.', 'odddcddddddcdddo',
      'oddddcddddcddddo', 'oddoddddddddoddo', 'oddoddcdcdddoddo', '.oooddddddddooo.',
      '...oddddddddo...', '...oddo..oddo...', '..odddo..odddo..', '..ooooo..ooooo..'
    ],
    king: [
      '...y..y..y..y...', '...yyyyyyyyyy...', '...oooooooooo...', '...okkkkkkkko...',
      '...okekkkkeko...', '...okkkkkkkko...', '....oooooooo....', '.pooaaaaaaaaoop.',
      'ppoaaaayyaaaaopp', 'ppoaaaaaaaaaaopp', 'ppoaaoaaaaoaaopp', 'pp.oaaaaaaaao.pp',
      'pp.oaaaooaaao.pp', 'p..oaao..oaao..p', '...oaao..oaao...', '...oooo..oooo...'
    ],
    dragon: [
      'w..............w', 'ww....h..h....ww', 'wwo...ohho...oww', 'wwwo.orrrro.owww',
      'wwwworerrerowwww', 'wwwworttttrowwww', 'wwwwoorrrroowwww', '.wwworrbbrrowww.',
      '..wworbbbbroww..', '...worbbbbrow...', '...orrbbbbrro...', '...orrrrrrrro...',
      '..orro....orro..', '..oro......oro..', '........orro....', '.........oo.....'
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
    bonearcher: { o: '#2B2735', w: '#E9E4D4', s: '#B9B2A0', k: '#E5534B', b: '#8A5A2E', t: '#CFC8DE' },
    bones: { o: '#2B2735', w: '#E9E4D4', k: '#E5534B' },
    sporecap: { o: '#2A1A14', c: '#D9734E', d: '#F7E6C9', s: '#EADBC0', h: '#BFAE90', k: '#120A16', g: '#5EC8B8' },
    seed: { o: '#1F3A2E', g: '#5EC8B8', l: '#B8F0E4', t: '#6FA86A' },
    queen: { o: '#2A1A14', c: '#8E4FB8', d: '#5EC8B8', s: '#EADBC0', h: '#BFAE90', k: '#120A16', m: '#7A2E3A', v: '#4F8A6A', g: '#5EC8B8' },
    golem: { o: '#1E1A22', d: '#6E6378', e: '#F2A541', c: '#E5622B' },
    king: { o: '#120E18', y: '#F2C14E', k: '#1B1524', e: '#C77DFF', a: '#4A4063', p: '#5B2A6E' },
    dragon: { o: '#1A0E0C', r: '#B8381E', b: '#F2A541', e: '#FFF1B8', t: '#E9E4D4', w: '#5A1A12', h: '#E9E4D4' },
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
    out.push({ file: 'bonearcher.png', key: 'bonearcher', rows: MAPS.bonearcher, palette: MONSTER_PALETTES.bonearcher, size: 48 });
    out.push({ file: 'bones.png', key: 'bones', rows: MAPS.bones, palette: MONSTER_PALETTES.bones, size: 40 });
    out.push({ file: 'sporecap.png', key: 'sporecap', rows: MAPS.sporecap, palette: MONSTER_PALETTES.sporecap, size: 48 });
    out.push({ file: 'seed.png', key: 'seed', rows: MAPS.seed, palette: MONSTER_PALETTES.seed, size: 32 });
    out.push({ file: 'queen.png', key: 'queen', rows: MAPS.queen, palette: MONSTER_PALETTES.queen, size: 96 });
    out.push({ file: 'golem.png', key: 'golem', rows: MAPS.golem, palette: MONSTER_PALETTES.golem, size: 64 });
    out.push({ file: 'king.png', key: 'king', rows: MAPS.king, palette: MONSTER_PALETTES.king, size: 96 });
    out.push({ file: 'dragon.png', key: 'dragon', rows: MAPS.dragon, palette: MONSTER_PALETTES.dragon, size: 128 });
    out.push({ file: 'halfmother.png', key: 'halfmother', rows: MAPS.mother, palette: MONSTER_PALETTES.mother, size: 64 });
    return out;
  }

  // The picture each monster type uses (the Bone Archer's type is 'archer',
  // which would clash with the Archer hero's pictures).
  function enemyTexture(type) {
    return type === 'archer' ? 'bonearcher' : type;
  }

  return { MAPS, heroPalette, MONSTER_PALETTES, spriteFiles, enemyTexture };
});
