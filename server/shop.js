// The camp shop after each floor. Each player spends their own gold.
// The floor's `shop` (in shared/rooms.js) picks which shop from shared/data.js.
const data = require('../shared/data');

const shopOf = (game) => data.SHOPS[game.floor.shop] || data.SHOPS.cellar;

function buy(game, playerId, itemId) {
  const p = game.players.get(playerId);
  if (!p) return { ok: false, error: 'Not in this game' };
  if (game.phase !== 'shop') return { ok: false, error: 'Shop is closed' };
  const store = shopOf(game);
  const item = store.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: 'No such item' };
  if (item.once && p.owned.includes(itemId)) return { ok: false, error: 'Already owned' };
  if (p.gold < item.price) return { ok: false, error: 'Not enough gold' };

  p.gold -= item.price;
  if (item.once) p.owned.push(itemId);
  const fx = item.effect;
  if (fx.maxHp) { p.maxHp += fx.maxHp; p.hp += fx.maxHp; }
  if (fx.defense) p.defense += fx.defense;
  if (fx.speedMul) p.speedMul += fx.speedMul;
  if (fx.weaponBonus && fx.weaponBonus > p.weaponBonus) {
    p.weaponBonus = fx.weaponBonus;
    p.weaponName = store.weapons[p.heroClass];
  }
  if (fx.potions) p.potions += fx.potions;
  if (fx.feathers) p.feathers += fx.feathers;
  return { ok: true };
}

function setShopReady(game, playerId, ready) {
  const p = game.players.get(playerId);
  if (!p || game.phase !== 'shop') return;
  p.ready = !!ready;
  checkDone(game);
}

const SHOP_TIME = 45; // seconds the team gets in the camp shop

// Everyone still connected is ready: go to the next floor, or finish.
function checkDone(game) {
  if (game.phase !== 'shop' || game.players.size === 0) return;
  if (![...game.players.values()].every((p) => p.ready)) return;
  startNextFloor(game);
}

// The shop's time is up: move on, ready or not. Purchases are kept.
function timeUp(game) {
  if (game.phase !== 'shop') return;
  game.event({ type: 'shoptimeup' });
  startNextFloor(game);
}

function startNextFloor(game) {
  if (game.floorIndex < game.floors.length - 1) {
    for (const p of game.players.values()) {
      p.ready = false;
      p.downed = false;
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      p.slows = {};
    }
    game.startFloor(game.floorIndex + 1);
    game.event({ type: 'phase', phase: 'playing' });
  } else {
    game.phase = 'done';
    game.event({ type: 'phase', phase: 'done' });
  }
}

function shopState(game) {
  const store = shopOf(game);
  const next = game.floors[game.floorIndex + 1];
  return {
    items: store.items,
    weapons: store.weapons,
    setName: store.setName,
    setBonus: store.setBonus,
    setPieces: store.setPieces,
    floorIndex: game.floorIndex,
    floorName: game.floor.name,
    nextFloorName: next ? next.name : null,
    final: !game.floor.shop && !next, // the whole dungeon is cleared
    timeLeft: game.phase === 'shop' ? Math.max(0, Math.round((game.shopEndsAt - game.time) * 10) / 10) : 0,
    results: game.lastResults || null,
    run: !game.floor.shop && !next ? game.runResults() : null,
    time: Math.round(game.time),
    players: [...game.players.values()].map((p) => ({
      id: p.id, name: p.name, heroClass: p.heroClass, color: p.color,
      gold: p.gold, owned: p.owned, ready: p.ready, potions: p.potions, feathers: p.feathers,
      hp: p.hp, maxHp: p.maxHp, defense: p.defense, speedMul: p.speedMul,
      level: p.level, damage: game.playerDamage(p), weaponName: p.weaponName
    }))
  };
}

module.exports = { buy, setShopReady, checkDone, timeUp, shopState, SHOP_TIME };
