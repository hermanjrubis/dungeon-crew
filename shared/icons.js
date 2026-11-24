// Little pixel icons for shop items, consumables and gold, drawn with the same
// part engine as the characters (so they get the same dark outline).
// iconFor(itemId, heroClass) -> { rows, palette }; iconGrid(...) -> 16x16 colors.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rig'));
  else { root.DC = root.DC || {}; root.DC.icons = factory(root.DC.rig); }
})(this, function (rig) {
  const SHAPES = {
    helm: [
      '...LLLLL....',
      '..LLmmmmm...',
      '.LLmmmmmmd..',
      '.Lmmmmmmmdd.',
      '.Lmmmmmmmmd.',
      '.mmkkkkkkmd.',
      '.mmkkkkkkmd.',
      '.mmmmkkmmmd.',
      '.mmmmkkmmdd.',
      '..mmmkkmmd..',
      '..ddd..ddd..'
    ],
    chest: [
      '..LL....LL..',
      '.LLmm..mmdd.',
      'LLmmmmmmmmdd',
      'Lmmmmmmmmmmd',
      '.mmmmmmmmmd.',
      '.mmmLLmmmmd.',
      '.mmmmmmmmmd.',
      '.mmmmmmmmmd.',
      '.dmmmmmmmdd.',
      '..ddddddddd.'
    ],
    boots: [
      '..LLm.......',
      '..Lmm.......',
      '..Lmm..Lmm..',
      '..mmm..Lmm..',
      '..mmm..mmm..',
      '.Lmmm..mmm..',
      'Lmmmmd.mmm..',
      'mmmmmd.mmmm.',
      'ddddddLmmmmd',
      '......mmmmmd',
      '......dddddd'
    ],
    sword: [
      '..........LL',
      '.........Lmd',
      '........Lmd.',
      '.......Lmd..',
      '......Lmd...',
      '.....Lmd....',
      '..g.Lmd.....',
      '..ggmd......',
      '...gg.......',
      '..wwgg......',
      '.ww..g......',
      'ww..........'
    ],
    bow: [
      '...mmL......',
      '..m...t.....',
      '.m.....t....',
      '.m.....t....',
      'm.......t...',
      'm.......t...',
      'm.......t...',
      'm.......t...',
      '.m.....t....',
      '.m.....t....',
      '..m...t.....',
      '...mmd......'
    ],
    staff: [
      '........ggg.',
      '.......gGGgg',
      '.......gGgg.',
      '......w.gg..',
      '.....w......',
      '....w.......',
      '...w........',
      '..w.........',
      '.w..........',
      'w...........'
    ],
    sling: [
      '..ww....ww..',
      '.w..w..w..w.',
      'w....ww....w',
      'w..........w',
      '.w..mmm...w.',
      '..wmLLmm.w..',
      '...mLmmmw...',
      '....mmm.....'
    ],
    wrench: [
      'mm....mm....',
      'Lmm..mmd....',
      '.Lmmmmd.....',
      '..Lmmd......',
      '...mmd......',
      '....mmd.....',
      '.....mmd....',
      '......mmd...',
      '.......mmd..',
      '........mmd.',
      '.........mm.'
    ],
    rod: [
      '.....LL.....',
      '....L..m....',
      '...L....m...',
      '...L.g..m...',
      '....m..m....',
      '.....mm.....',
      '.....yy.....',
      '.....ww.....',
      '.....ww.....',
      '.....ww.....',
      '.....ww.....',
      '.....ww.....'
    ],
    potion: [
      '....ww....',
      '....LL....',
      '...LrrL...',
      '..LrRRrL..',
      '.LrRRRrrL.',
      '.LrrRrrrL.',
      '.LrrrrrrL.',
      '..LrrrrL..',
      '...LLLL...'
    ],
    feather: [
      '.......fff',
      '......fFFf',
      '.....fFFf.',
      '....fFFf..',
      '...fFFf...',
      '..fFFf....',
      '..fFf.....',
      '.fff......',
      '.w........',
      'w.........'
    ],
    coin: [
      '..yyyy..',
      '.yYYYyy.',
      'yYyyyyYy',
      'yYyYYyYy',
      'yYyyyyYy',
      '.yYYYyy.',
      '..yyyy..'
    ]
  };

  // Metal colors for each shop's gear (light, base, dark), Floor 1 first.
  const TIERS = [
    ['#C9C9D6', '#8C8CA0', '#5A5A6E'], // iron (Floor 1 shop)
    ['#F2A56A', '#C77A3A', '#7A4420'], // copper
    ['#FFE48A', '#F2C14E', '#B8862E'], // crown gold
    ['#F28A6A', '#C9543A', '#7E2414'], // dragonscale
    ['#B898B8', '#8A6A8E', '#5A3E60']  // chitin
  ];
  const WEAPON_SHAPE = { knight: 'sword', archer: 'bow', mage: 'staff', warden: 'sling', engineer: 'wrench', cleric: 'rod' };

  function palette(tier) {
    const [L, m, d] = TIERS[Math.max(0, Math.min(TIERS.length - 1, tier))];
    return {
      o: '#0D0A12', L, m, d, k: '#120A16',
      g: '#F2C14E', G: '#FFF1B8', w: '#8A5A2E', t: '#E9E4D4', y: '#F2C14E', Y: '#FFE48A',
      r: '#E5534B', R: '#FF8A80', f: '#C77DFF', F: '#F0D8FF'
    };
  }

  // Which icon an item gets. Gear ids end in their shop's number: helm, helm2 ... helm5.
  function iconFor(itemId, heroClass) {
    const id = String(itemId);
    const tier = /\d$/.test(id) ? Number(id.slice(-1)) - 1 : 0;
    const base = id.replace(/\d$/, '');
    let shape = { helm: 'helm', mail: 'chest', plate: 'chest', boots: 'boots', potion: 'potion', feather: 'feather', coin: 'coin' }[base];
    if (base === 'weapon') shape = WEAPON_SHAPE[heroClass] || 'sword';
    if (!shape) shape = 'coin';
    return { rows: SHAPES[shape], palette: palette(tier) };
  }

  // A 16x16 grid of colors (null = clear), the icon centered with its outline.
  function iconGrid(itemId, heroClass) {
    const { rows, palette: pal } = iconFor(itemId, heroClass);
    const w = rows[0].length, h = rows.length;
    const r = { size: 16, parts: [{ name: 'icon', rows, pivot: [Math.floor(w / 2), Math.floor(h / 2)], at: [8, 8], z: 1 }] };
    return rig.renderFrame(r, {}, pal);
  }

  // Browser only: the icon as an image URL (cached).
  const cache = new Map();
  function iconUrl(itemId, heroClass) {
    const key = itemId + '|' + (heroClass || '');
    if (cache.has(key)) return cache.get(key);
    const grid = iconGrid(itemId, heroClass);
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    grid.forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
  }

  return { SHAPES, TIERS, iconFor, iconGrid, iconUrl };
});
