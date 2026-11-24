// Every sprite sheet the game uses, made from the part-based art in shared/art/.
// A sheet is one row of frames; each action (walk, attack...) is a run of frames.
// `npm run sprites` draws them into client/assets/<key>-sheet.png, plus a
// single-frame portrait <key>.png for the menus.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const art = {};
    for (const name of ['knight', 'archer', 'mage', 'warden', 'engineer', 'gloop', 'bat', 'bonearcher', 'bones', 'sporecap', 'seed', 'mother', 'queen', 'golem', 'king', 'dragon']) art[name] = require('./' + name);
    module.exports = factory(require('../rig'), art);
  } else {
    root.DC = root.DC || {};
    root.DC.sheets = factory(root.DC.rig, root.DC.art || {});
  }
})(this, function (rig, ART) {
  const HERO_CLASSES = ['knight', 'archer', 'mage', 'warden', 'engineer'];
  const COLORS = { orange: '#F2A541', blue: '#6C9BF2', teal: '#5EC8B8', pink: '#E58FB8' };
  const HERO_ACTIONS = ['idle', 'walk', 'attack', 'q', 'space', 'hurt', 'roll', 'down'];
  const MONSTER_ACTIONS = ['idle', 'walk', 'hurt', 'death'];

  // Monsters whose picture is another monster's art, drawn smaller.
  const VARIANTS = {
    minigloop: { base: 'gloop', scale: 0.7 },
    halfmother: { base: 'mother', scale: 0.67 }
  };
  // The Bone Archer's type is 'archer', which would clash with the Archer hero.
  const ENEMY_ART = { archer: 'bonearcher' };

  function sheetDef(key, artName, palette, scale) {
    const art = ART[artName];
    const frames = [];
    const anims = {};
    for (const [name, def] of Object.entries(art.anims)) {
      anims[name] = { start: frames.length, count: def.frames.length, fps: def.fps, loop: !(art.once || []).includes(name) };
      def.frames.forEach((pose, index) => frames.push({ anim: name, index, pose }));
    }
    const rootPart = art.rig.parts.find((p) => p.name === 'root');
    return {
      key, art: artName, size: art.rig.size, palette, scale: scale || 1,
      file: key + '-sheet.png', portrait: key + '.png',
      foot: rootPart ? rootPart.at : [art.rig.size / 2, art.rig.size - 3],
      frames, anims
    };
  }

  // All sheets whose art exists (characters still on the old pictures are skipped).
  function sheetFiles() {
    const out = [];
    for (const cls of HERO_CLASSES) {
      if (!ART[cls]) continue;
      for (const [color, hex] of Object.entries(COLORS)) out.push(sheetDef(`${cls}-${color}`, cls, ART[cls].palette(hex)));
    }
    for (const name of Object.keys(ART)) {
      if (HERO_CLASSES.includes(name)) continue;
      out.push(sheetDef(name, name, ART[name].palette()));
    }
    for (const [name, v] of Object.entries(VARIANTS)) {
      if (ART[v.base]) out.push(sheetDef(name, v.base, ART[v.base].palette(), v.scale));
    }
    return out;
  }

  // One frame as a grid of colors (null = clear).
  function renderSheetFrame(sheet, i) {
    const art = ART[sheet.art];
    let pose = sheet.frames[i].pose;
    if (sheet.scale !== 1) {
      const r = pose.root || {};
      pose = Object.assign({}, pose, { root: Object.assign({}, r, { sx: (r.sx ?? 1) * sheet.scale, sy: (r.sy ?? 1) * sheet.scale }) });
    }
    return rig.renderFrame(art.rig, pose, sheet.palette);
  }

  const heroSheet = (cls, color) => `${cls}-${color}`;
  const enemySheet = (type) => ENEMY_ART[type] || type;
  const animKey = (sheetKey, action) => sheetKey + ':' + action;

  return { HERO_CLASSES, COLORS, HERO_ACTIONS, MONSTER_ACTIONS, VARIANTS, sheetFiles, renderSheetFrame, heroSheet, enemySheet, animKey };
});
