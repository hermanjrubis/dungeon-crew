// The camp shop after Floor 1. Each player spends their own gold.
const data = require('../shared/data');

function buy(game, playerId, itemId) {
  const p = game.players.get(playerId);
  if (!p) return { ok: false, error: 'Not in this game' };
  if (game.phase !== 'shop') return { ok: false, error: 'Shop is closed' };
  const item = data.SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: 'No such item' };
  if (item.once && p.owned.includes(itemId)) return { ok: false, error: 'Already owned' };
  if (p.gold < item.price) return { ok: false, error: 'Not enough gold' };

  p.gold -= item.price;
  if (item.once) p.owned.push(itemId);
  const fx = item.effect;
  if (fx.maxHp) { p.maxHp += fx.maxHp; p.hp += fx.maxHp; }
  if (fx.defense) p.defense += fx.defense;
  if (fx.speedMul) p.speedMul += fx.speedMul;
  if (fx.weaponBonus) {
    p.weaponBonus = fx.weaponBonus;
    p.weaponName = data.SHOP_WEAPONS[p.heroClass];
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

// Everyone still connected is ready: Floor 1 is finished.
function checkDone(game) {
  if (game.phase !== 'shop' || game.players.size === 0) return;
  if ([...game.players.values()].every((p) => p.ready)) {
    game.phase = 'done';
    game.event({ type: 'phase', phase: 'done' });
  }
}

function shopState(game) {
  return {
    items: data.SHOP_ITEMS,
    weapons: data.SHOP_WEAPONS,
    setName: data.SET_NAME,
    setBonus: data.SET_BONUS,
    players: [...game.players.values()].map((p) => ({
      id: p.id, name: p.name, heroClass: p.heroClass, color: p.color,
      gold: p.gold, owned: p.owned, ready: p.ready, potions: p.potions, feathers: p.feathers,
      hp: p.hp, maxHp: p.maxHp, defense: p.defense, speedMul: p.speedMul,
      level: p.level, damage: game.playerDamage(p), weaponName: p.weaponName
    }))
  };
}

module.exports = { buy, setShopReady, checkDone, shopState };
