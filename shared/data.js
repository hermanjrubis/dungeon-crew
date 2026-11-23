// All the game's numbers in one place. Change a number here to rebalance.
// Distances are in pixels (one tile = 48 px), times in seconds.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.data = factory(); }
})(this, function () {
  const TICK_RATE = 20; // server updates per second

  const CLASSES = ['knight', 'archer', 'mage'];

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
    }
  };

  const MONSTERS = {
    gloop: { name: 'Gloop', hp: 20, dmg: 5, speed: 60, r: 16, xp: 10, gold: [2, 4] },
    minigloop: { name: 'Mini Gloop', hp: 8, dmg: 3, speed: 70, r: 10, xp: 3, gold: [1, 1] },
    bat: { name: 'Skitterbat', hp: 12, dmg: 4, speed: 160, r: 14, xp: 8, gold: [3, 6], flying: true },
    mother: { name: 'Gloop Mother', hp: 250, dmg: 10, speed: 40, r: 40, xp: 100, gold: [40, 40], hpPerExtraPlayer: 0.5, boss: true },
    halfmother: { name: 'Half Mother', hp: 60, dmg: 8, speed: 55, r: 26, xp: 0, gold: [0, 0], boss: true }
  };

  // XP needed to reach level 1..8. Each level after 1 gives +10 max HP and +2 damage.
  const LEVELS = [0, 50, 120, 220, 350, 500, 700, 950];
  const LEVEL_HP = 10;
  const LEVEL_DMG = 2;

  const POTION_HEAL = 40;

  // Camp shop after Floor 1. "once" items can only be bought one time.
  const SHOP_ITEMS = [
    { id: 'helm', name: 'Iron Helm', slot: 'Head', price: 40, once: true, effect: { maxHp: 10 }, text: '+10 max HP' },
    { id: 'mail', name: 'Guard Mail', slot: 'Chest', price: 60, once: true, effect: { defense: 3 }, text: '+3 defense' },
    { id: 'boots', name: 'Wader Boots', slot: 'Feet', price: 45, once: true, effect: { speedMul: 0.10 }, text: '+10% move speed' },
    { id: 'weapon', name: 'Class weapon', slot: 'Weapon', price: 70, once: true, effect: { weaponBonus: 8 }, text: '+8 damage' },
    { id: 'potion', name: 'Health Potion', slot: 'Consumable', price: 15, once: false, effect: { potions: 1 }, text: 'Heals 40 HP' },
    { id: 'feather', name: 'Revive Feather', slot: 'Consumable', price: 50, once: false, effect: { feathers: 1 }, text: 'Instantly revives a downed teammate' }
  ];
  const SHOP_WEAPONS = { knight: 'Iron Sword', archer: "Hunter's Bow", mage: 'Oak Staff' };
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
      weapons: { knight: 'Steel Sword', archer: 'Longbow', mage: 'Crystal Staff' }
    }
  };

  return {
    TICK_RATE, CLASSES, COLORS, HEROES, MONSTERS, LEVELS, LEVEL_HP, LEVEL_DMG,
    POTION_HEAL, SHOP_ITEMS, SHOP_WEAPONS, SET_NAME, SET_BONUS, SHOPS
  };
});
