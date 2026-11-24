// All the game's numbers in one place. Change a number here to rebalance.
// Distances are in pixels (one tile = 48 px), times in seconds.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.data = factory(); }
})(this, function () {
  const TICK_RATE = 20; // server updates per second

  const CLASSES = ['knight', 'archer', 'mage', 'warden', 'engineer'];

  const COLORS = {
    orange: '#F2A541',
    blue: '#6C9BF2',
    teal: '#5EC8B8',
    pink: '#E58FB8'
  };

  // Damage shown on the character select = baseDmg + starter weapon bonus.
  const HEROES = {
    knight: {
      name: 'Knight', hp: 120, baseDmg: 10, speed: 150, mana: 0,
      starter: { name: 'Wooden Sword', bonus: 4 },
      attack: { kind: 'swing', arc: 90, range: 64, cd: 0.5 },
      q: { name: 'Shield Bash', cd: 6, arc: 120, range: 72, push: 96, stun: 1, dmg: 8 },
      space: { name: 'Taunt', cd: 12, range: 240, duration: 3 }
    },
    archer: {
      name: 'Archer', hp: 80, baseDmg: 7, speed: 210, mana: 0,
      starter: { name: 'Training Bow', bonus: 3 },
      attack: { kind: 'arrow', speed: 600, ttl: 1.2, cd: 0.4 },
      q: { name: 'Arrow Rain', cd: 10, radius: 96, reach: 360, duration: 2, dmg: 5, every: 0.25 },
      space: { name: 'Dodge Roll', cd: 4, distance: 160, duration: 0.25 }
    },
    mage: {
      name: 'Mage', hp: 70, baseDmg: 13, speed: 180, mana: 100, manaRegen: 8,
      starter: { name: 'Apprentice Staff', bonus: 5 },
      attack: { kind: 'bolt', speed: 480, ttl: 0.9, cd: 0.6, mana: 5 },
      q: { name: 'Fireball', cd: 3, mana: 20, speed: 420, ttl: 1.2, radius: 64, dmg: 24 },
      space: { name: 'Heal Circle', cd: 12, mana: 30, radius: 96, perSecond: 10, duration: 3 }
    },
    // Tank. Passive Thick Skin: takes 30% less damage, Wing Gust pushes him half as far.
    warden: {
      name: 'Stonewarden', hp: 170, baseDmg: 11, speed: 125, mana: 0, thickSkin: 0.7,
      starter: { name: 'Cracked Sling', bonus: 4 },
      attack: { kind: 'rock', speed: 380, ttl: 0.75, cd: 0.7, r: 9 },
      q: { name: 'Boulder Toss', cd: 8, speed: 300, ttl: 2, r: 20, dmg: 22, push: 48, stun: 0.3 },
      space: { name: 'Quake Stomp', cd: 12, radius: 96, dmg: 14, stun: 1.2, bossSlow: 0.5, bossSlowTime: 2 }
    },
    // Builder. Passive Scrapper: +10% gold from every kill.
    engineer: {
      name: 'Engineer', hp: 95, baseDmg: 9, speed: 175, mana: 0, goldBonus: 0.1,
      starter: { name: 'Rusty Wrench', bonus: 3 },
      attack: { kind: 'swing', arc: 80, range: 56, cd: 0.45 },
      q: { name: 'Turret', cd: 12, duration: 10, range: 300, every: 0.6, dmg: 7, speed: 520, ttl: 0.8 },
      space: { name: 'Mine', cd: 6, armTime: 0.5, trigger: 28, radius: 72, dmg: 30, duration: 20, max: 2 }
    }
  };

  const MONSTERS = {
    gloop: { name: 'Gloop', hp: 20, dmg: 5, speed: 60, r: 16, xp: 10, gold: [2, 4] },
    minigloop: { name: 'Mini Gloop', hp: 8, dmg: 3, speed: 70, r: 10, xp: 3, gold: [1, 1] },
    bat: { name: 'Skitterbat', hp: 12, dmg: 4, speed: 160, r: 14, xp: 8, gold: [3, 6], flying: true, overLava: true },
    mother: { name: 'Gloop Mother', hp: 250, dmg: 10, speed: 40, r: 40, xp: 100, gold: [40, 40], hpPerExtraPlayer: 0.5, boss: true },
    // Floor 2. The Bone Archer's reward is paid when its bones are destroyed.
    archer: { name: 'Bone Archer', hp: 30, dmg: 8, speed: 90, r: 16, xp: 0, gold: [0, 0], reward: { xp: 15, gold: [5, 8] } },
    bones: { name: 'Bones', hp: 1, dmg: 0, speed: 0, r: 14, xp: 0, gold: [0, 0], flying: true },
    sporecap: { name: 'Sporecap', hp: 40, dmg: 0, speed: 0, r: 18, xp: 12, gold: [4, 6] },
    seed: { name: 'Spore Seed', hp: 1, dmg: 0, speed: 0, r: 8, xp: 0, gold: [0, 0] },
    queen: { name: 'Spore Queen', hp: 400, dmg: 12, speed: 0, r: 36, xp: 150, gold: [70, 70], hpPerExtraPlayer: 0.5, boss: true },
    halfmother: { name: 'Half Mother', hp: 60, dmg: 8, speed: 55, r: 26, xp: 0, gold: [0, 0], boss: true },
    // Floor 3 and 4.
    golem: { name: 'Rubble Golem', hp: 120, dmg: 20, speed: 35, r: 22, xp: 25, gold: [10, 15] },
    king: { name: 'The Hollow King', hp: 600, dmg: 25, speed: 70, r: 36, xp: 200, gold: [100, 100], hpPerExtraPlayer: 0.25, boss: true },
    dragon: { name: 'Ashmaw', hp: 1200, dmg: 35, speed: 60, r: 44, xp: 0, gold: [300, 300], hpPerExtraPlayer: 0.25, boss: true, flying: true }
  };

  // XP needed to reach level 1..10. Each level after 1 gives +10 max HP and +2 damage.
  const LEVELS = [0, 50, 120, 220, 350, 500, 700, 950, 1250, 1600];
  const LEVEL_HP = 10;
  const LEVEL_DMG = 2;

  const POTION_HEAL = 40;

  // Burning (Floor 3 and the dragon): damage per second, how long it lasts,
  // and how long it lasts with the full Forgewalker set.
  const BURN = { perSecond: 3, duration: 3, forgeDuration: 1 };

  // Camp shop after Floor 1. "once" items can only be bought one time.
  const SHOP_ITEMS = [
    { id: 'helm', name: 'Iron Helm', slot: 'Head', price: 40, once: true, effect: { maxHp: 10 }, text: '+10 max HP' },
    { id: 'mail', name: 'Guard Mail', slot: 'Chest', price: 60, once: true, effect: { defense: 3 }, text: '+3 defense' },
    { id: 'boots', name: 'Wader Boots', slot: 'Feet', price: 45, once: true, effect: { speedMul: 0.10 }, text: '+10% move speed' },
    { id: 'weapon', name: 'Class weapon', slot: 'Weapon', price: 70, once: true, effect: { weaponBonus: 8 }, text: '+8 damage' },
    { id: 'potion', name: 'Health Potion', slot: 'Consumable', price: 15, once: false, effect: { potions: 1 }, text: 'Heals 40 HP' },
    { id: 'feather', name: 'Revive Feather', slot: 'Consumable', price: 50, once: false, effect: { feathers: 1 }, text: 'Instantly revives a downed teammate' }
  ];
  const SHOP_WEAPONS = { knight: 'Iron Sword', archer: "Hunter's Bow", mage: 'Oak Staff', warden: 'Iron Sling', engineer: 'Steel Wrench' };
  const SET_NAME = 'Cellar Guard Set';
  const SET_BONUS = 'Poison damage −50%. Useful in Floor 2.';

  // One shop per floor (the floor's `shop` in rooms.js picks which).
  const SHOPS = {
    cellar: {
      setName: SET_NAME, setBonus: SET_BONUS, setPieces: ['helm', 'mail', 'boots'],
      items: SHOP_ITEMS, weapons: SHOP_WEAPONS
    },
    forge: {
      setName: 'Forgewalker Set',
      setBonus: 'Less damage from lava and burning. Built for Floor 3.',
      setPieces: ['helm2', 'plate2', 'boots2'],
      items: [
        { id: 'helm2', name: 'Copper Helm', slot: 'Head', price: 80, once: true, effect: { maxHp: 20 }, text: '+20 max HP' },
        { id: 'plate2', name: 'Forge Plate', slot: 'Chest', price: 110, once: true, effect: { defense: 6 }, text: '+6 defense' },
        { id: 'boots2', name: 'Ashstep Boots', slot: 'Feet', price: 90, once: true, effect: { speedMul: 0.15 }, text: '+15% move speed' },
        { id: 'weapon2', name: 'Class weapon', slot: 'Weapon', price: 120, once: true, effect: { weaponBonus: 14 }, text: '+14 damage' },
        { id: 'potion', name: 'Health Potion', slot: 'Consumable', price: 15, once: false, effect: { potions: 1 }, text: 'Heals 40 HP' },
        { id: 'feather', name: 'Revive Feather', slot: 'Consumable', price: 50, once: false, effect: { feathers: 1 }, text: 'Instantly revives a downed teammate' }
      ],
      weapons: { knight: 'Steel Sword', archer: 'Longbow', mage: 'Crystal Staff', warden: 'Granite Sling', engineer: 'Arc Wrench' }
    },
    crown: {
      setName: 'Hollow Crown Set',
      setBonus: "Dragon fire damage −40%, and the whole team deals +10% damage while you're alive. Built for Floor 4.",
      setPieces: ['helm3', 'plate3', 'boots3'],
      items: [
        { id: 'helm3', name: 'Crown Helm', slot: 'Head', price: 150, once: true, effect: { maxHp: 30 }, text: '+30 max HP' },
        { id: 'plate3', name: 'Royal Plate', slot: 'Chest', price: 200, once: true, effect: { defense: 9 }, text: '+9 defense' },
        { id: 'boots3', name: 'Shadow Greaves', slot: 'Feet', price: 160, once: true, effect: { speedMul: 0.20 }, text: '+20% move speed' },
        { id: 'weapon3', name: 'Class weapon', slot: 'Weapon', price: 200, once: true, effect: { weaponBonus: 22 }, text: '+22 damage' },
        { id: 'potion', name: 'Health Potion', slot: 'Consumable', price: 15, once: false, effect: { potions: 1 }, text: 'Heals 40 HP' },
        { id: 'feather', name: 'Revive Feather', slot: 'Consumable', price: 50, once: false, effect: { feathers: 1 }, text: 'Instantly revives a downed teammate' }
      ],
      weapons: { knight: 'Ember Blade', archer: 'Shadow Bow', mage: "King's Scepter", warden: 'Magma Sling', engineer: 'Forgemaster Wrench' }
    }
  };

  return {
    TICK_RATE, CLASSES, COLORS, HEROES, MONSTERS, LEVELS, LEVEL_HP, LEVEL_DMG,
    POTION_HEAL, BURN, SHOP_ITEMS, SHOP_WEAPONS, SET_NAME, SET_BONUS, SHOPS
  };
});
