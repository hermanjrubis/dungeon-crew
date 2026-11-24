// One running game for one lobby room. The server is the referee:
// it moves everyone, decides every hit, and hands out gold and XP.
// Browsers only send their key presses (setInput) and draw snapshot().
const tiles = require('../shared/tiles');
const data = require('../shared/data');
const { FLOORS } = require('../shared/rooms');
const { buildRoom } = require('./layout');
const { makeRng } = require('./rng');

// How long each title card stays up, in seconds. The game is frozen meanwhile.
const CARD_TIME = { start: 2, room: 1.6, boss: 2.2, reset: 1.6, floorclear: 7 }; // floorclear = the results screen
const blankStats = () => ({ kills: 0, damage: 0, gold: 0, downs: 0, revives: 0 });
const heroes = require('./heroes');
const enemies = require('./enemies');
const warrens = require('./warrens');
const wastes = require('./wastes');
const hazards = require('./hazards');
const shop = require('./shop');
const forge = require('./forge');
const golem = require('./golem');

const REVIVE_RANGE = 48;
const REVIVE_TIME = 3;
const FEATHER_RANGE = 96;

const BOOL_KEYS = ['up', 'down', 'left', 'right', 'attack', 'q', 'space', 'interact', 'use1', 'use2'];

// Turn whatever a browser sent into a safe input object.
function sanitizeInput(raw) {
  const input = { aim: 0 };
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const k of BOOL_KEYS) input[k] = src[k] === true;
  if (typeof src.aim === 'number' && Number.isFinite(src.aim)) input.aim = src.aim;
  return input;
}

const ANGRY_RANGE = 200; // hit from farther than this, a monster goes for the shooter
const ANGRY_TIME = 2;

class Game {
  // `rooms` (a list of hand-made room rows) makes a one-floor game, used by tests.
  constructor(players, { floors = FLOORS, rooms = null, rng = Math.random, seed = null, transitions = true } = {}) {
    this.rng = rng;
    this.seed = seed === null ? Math.floor(Math.random() * 2 ** 31) : seed;
    this.transitionsOn = transitions;
    this.transition = null; // the title card on screen: { kind, title, subtitle, until }
    this.shopAt = null;     // when the floor-cleared card ends and the shop opens
    this.floors = rooms
      ? [{ ...FLOORS[0], power: null, rooms: rooms.map((layout) => ({ layout })) }]
      : floors;
    this.roomIndex = 0;
    this.time = 0;
    this.phase = 'playing';
    this.paused = false;
    this.pausedBy = null; // id of the player who paused
    this.nextId = 1;
    this.events = [];
    this.players = new Map();
    this.startCount = players.length; // boss HP is scaled by the starting team size
    for (const info of players) this.players.set(info.id, this.makePlayer(info));
    this.startFloor(0);
  }

  // Build this floor's rooms (random ones get a fresh layout) and enter room 1.
  startFloor(index) {
    this.floorIndex = index;
    this.floor = this.floors[index];
    this.layouts = this.floor.rooms.map((r, k) => {
      if (r.layout) return { rows: r.layout, dark: r.dark ? [r.dark] : [], torches: (r.torches || []).map((t) => ({ ...t })), bridge: r.bridge || null, core: r.core || null };
      return buildRoom(r.recipe, makeRng(this.seed + index * 1000 + k));
    });
    this.roomIndex = 0;
    this.phase = 'playing';
    this.floorStart = this.time;
    for (const p of this.players.values()) p.stats = blankStats();
    this.loadRoom();
    this.showCard('start', `Floor ${index + 1} · ${this.floor.name}`, `Room 1 of ${this.layouts.length} · ${this.roomName(0)}`);
  }

  roomName(i) {
    return (this.floor.roomNames && this.floor.roomNames[i]) || '';
  }

  // Put up a title card. While it's showing, nothing moves.
  showCard(kind, title, subtitle) {
    if (!this.transitionsOn) return;
    this.transition = { kind, title, subtitle, until: this.time + CARD_TIME[kind] };
    this.event({ type: 'transition', kind, title, subtitle });
  }

  makePlayer({ id, name, heroClass, color }) {
    const hero = data.HEROES[heroClass] || data.HEROES.knight;
    return {
      id, name, heroClass: data.HEROES[heroClass] ? heroClass : 'knight', color,
      x: 0, y: 0, r: 16,
      hp: hero.hp, maxHp: hero.hp, mana: hero.mana, maxMana: hero.mana,
      level: 1, xp: 0, gold: 0,
      defense: 0, speedMul: 0,
      weaponName: hero.starter.name, weaponBonus: hero.starter.bonus,
      potions: 1, feathers: 0, owned: [], ready: false,
      downed: false, reviveProgress: 0,
      stats: blankStats(), runStats: blankStats(), // this floor / the whole run
      cd: { attack: 0, q: 0, space: 0 },
      slows: {}, stunUntil: 0, invulnUntil: 0,
      aim: 0, input: sanitizeInput(null), prevInput: sanitizeInput(null)
    };
  }

  // ---------- rooms ----------

  loadRoom() {
    const layout = this.layouts[this.roomIndex];
    this.room = tiles.parseRoom(layout.rows);
    this.dark = layout.dark;
    this.torches = layout.torches.map((t) => ({ x: t.tx * tiles.TILE + tiles.TILE / 2, y: t.ty * tiles.TILE + tiles.TILE / 2, lit: false }));
    this.allDark = false;
    this.nextRock = undefined; // first stalactite is scheduled when the room starts
    this.rocks = [];           // falling rocks: { x, y, at }
    this.doorOpen = false;
    this.enemies = [];
    this.projectiles = [];
    this.zones = [];
    this.broken = new Set();     // cracked tiles that became pits
    this.cracking = new Map();   // tile index -> time it breaks
    this.tauntBy = null;
    forge.reset(this, layout);
    for (const s of this.room.spawns) this.spawnEnemy(s.type, s.x, s.y);
    for (const p of this.players.values()) {
      p.x = this.room.entry.x;
      p.y = this.room.entry.y;
      p.reviveProgress = 0;
    }
  }

  nextRoom() {
    for (const p of this.players.values()) {
      if (p.downed) this.revive(p, 0.3);
    }
    this.roomIndex++;
    this.loadRoom();
    this.event({ type: 'nextroom', roomIndex: this.roomIndex });
    const n = this.layouts.length;
    if (this.roomIndex === n - 1) this.showCard('boss', 'Boss room', `Room ${n} of ${n} · ${this.roomName(this.roomIndex)}`);
    else this.showCard('room', `Room ${this.roomIndex + 1} of ${n}`, this.roomName(this.roomIndex));
  }

  resetRoom() {
    this.loadRoom();
    for (const p of this.players.values()) {
      p.downed = false;
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      p.slows = {};
      p.stunUntil = 0;
    }
    this.event({ type: 'reset' });
    this.showCard('reset', 'Everyone fell!', 'Try the room again');
  }

  // ---------- players ----------

  setInput(id, raw) {
    const p = this.players.get(id);
    if (!p) return;
    p.input = sanitizeInput(raw);
    p.aim = p.input.aim;
    // The browser numbers its inputs so it can line up its own prediction
    // with where the server has actually moved it.
    if (raw && Number.isInteger(raw.seq) && raw.seq >= 0) p.lastSeq = raw.seq;
  }

  // Pause or resume for the whole team. Anyone in the game can do either.
  setPaused(id, paused) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'playing') return;
    this.paused = !!paused;
    this.pausedBy = this.paused ? id : null;
    this.event({ type: this.paused ? 'paused' : 'resumed', by: p.name });
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.pausedBy === id) { this.paused = false; this.pausedBy = null; }
    shop.checkDone(this); // a player leaving the shop shouldn't block the others
  }

  buy(id, itemId) {
    return shop.buy(this, id, itemId);
  }

  setShopReady(id, ready) {
    shop.setShopReady(this, id, ready);
  }

  shopState() {
    return shop.shopState(this);
  }

  alivePlayers() {
    return [...this.players.values()].filter((p) => !p.downed);
  }

  // The Hollow Crown set gives the whole team +10% damage while a wearer
  // is standing. Two wearers don't stack it.
  playerDamage(p) {
    const hero = data.HEROES[p.heroClass];
    const base = hero.baseDmg + p.weaponBonus + data.LEVEL_DMG * (p.level - 1);
    const crown = this.alivePlayers().some((q) => this.crownSet(q));
    return crown ? Math.round(base * 1.1) : base;
  }

  damagePlayer(p, amount, source, { ignoreDefense = false, ignoreInvuln = false } = {}) {
    if (!p || p.downed || (!ignoreInvuln && this.time < p.invulnUntil)) return 0;
    let dealt = Math.max(1, Math.round(amount - (ignoreDefense ? 0 : p.defense)));
    // Stonewarden's Thick Skin (poison and burning are cut where they build up).
    const skin = data.HEROES[p.heroClass].thickSkin;
    if (skin && source !== 'poison' && source !== 'burn') dealt = Math.max(1, Math.round(dealt * skin));
    p.hp = Math.max(0, p.hp - dealt);
    this.event({ type: 'damage', targetId: p.id, amount: dealt });
    if (p.hp <= 0) {
      p.downed = true;
      p.reviveProgress = 0;
      this.addStat(p, 'downs', 1);
      this.event({ type: 'downed', targetId: p.id });
    }
    return dealt;
  }

  // Poison builds up a little every tick and hurts in whole points.
  // Armor doesn't stop it, but the full Cellar Guard set halves it.
  poisonPlayer(p, perSecond, dt) {
    if (!p || p.downed || this.time < p.invulnUntil) return;
    p.poisonAcc = (p.poisonAcc || 0) + perSecond * dt * (1 - this.playerPoisonResist(p)) * (data.HEROES[p.heroClass].thickSkin || 1);
    p.poisonedUntil = this.time + 0.5;
    const whole = Math.floor(p.poisonAcc + 1e-9);
    if (whole >= 1) {
      p.poisonAcc -= whole;
      this.damagePlayer(p, whole, 'poison', { ignoreDefense: true });
    }
  }

  playerPoisonResist(p) {
    if (this.rotwardSet(p)) return 0.6;
    return this.hasSet(p, ['helm', 'mail', 'boots']) ? 0.5 : 0;
  }

  // Prismguard set (Floor 6): beam and shards −40%, and the roar can't slow you.
  prismguardSet(p) {
    return this.hasSet(p, ['helm5', 'plate5', 'boots5']);
  }

  // Rotward set (Floor 5): poison −60%, and Rot Hands can't hold you.
  rotwardSet(p) {
    return this.hasSet(p, ['helm4', 'plate4', 'boots4']);
  }

  hasSet(p, ids) {
    return ids.every((id) => p.owned.includes(id));
  }

  forgeSet(p) {
    return this.hasSet(p, ['helm2', 'plate2', 'boots2']);
  }

  crownSet(p) {
    return this.hasSet(p, ['helm3', 'plate3', 'boots3']);
  }

  // Set on fire: 3 damage a second for 3 s (1 s with the Forgewalker set).
  // Getting burned again restarts the timer; it never stacks.
  burnPlayer(p) {
    if (!p || p.downed) return;
    p.burnUntil = this.time + (this.forgeSet(p) ? data.BURN.forgeDuration : data.BURN.duration);
  }

  updateBurning(dt) {
    for (const p of this.players.values()) {
      if (p.downed || !(this.time < (p.burnUntil || 0) + 1e-9)) continue;
      p.burnAcc = (p.burnAcc || 0) + data.BURN.perSecond * dt * (data.HEROES[p.heroClass].thickSkin || 1);
      const whole = Math.floor(p.burnAcc + 1e-9);
      if (whole >= 1) {
        p.burnAcc -= whole;
        this.damagePlayer(p, whole, 'burn', { ignoreDefense: true });
      }
    }
  }

  healPlayer(p, amount) {
    if (!p || p.downed) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (p.hp > before) this.event({ type: 'heal', targetId: p.id, amount: p.hp - before });
  }

  // byId: who brought them back (for the results screen).
  revive(p, fraction, byId = null) {
    if (byId) this.addStat(this.players.get(byId), 'revives', 1);
    p.downed = false;
    p.reviveProgress = 0;
    p.hp = Math.max(1, Math.round(p.maxHp * fraction));
    this.event({ type: 'revived', targetId: p.id });
  }

  // ---------- results screen ----------

  addStat(p, key, n) {
    if (!p || !p.stats) return;
    p.stats[key] += n;
    p.runStats[key] += n;
  }

  // Badges, given out by the same rules on every screen.
  badges(rows) {
    const out = rows.map(() => []);
    let mvp = -1;
    rows.forEach((r, i) => { if (r.damage > 0 && (mvp === -1 || r.damage > rows[mvp].damage)) mvp = i; });
    if (mvp >= 0) out[mvp].push('mvp');
    let saver = -1;
    rows.forEach((r, i) => { if (r.revives > 0 && (saver === -1 || r.revives > rows[saver].revives)) saver = i; });
    if (saver >= 0) out[saver].push('lifesaver');
    rows.forEach((r, i) => { if (r.downs === 0) out[i].push('untouchable'); });
    return out;
  }

  resultRows(key) {
    const rows = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, heroClass: p.heroClass, color: p.color, level: p.level, ...p[key]
    }));
    const badges = this.badges(rows);
    return rows.map((r, i) => ({ ...r, badges: badges[i] }));
  }

  // Stars: 1 for clearing, +1 if nobody went down, +1 if under the target time.
  floorResults() {
    const players = this.resultRows('stats');
    const time = Math.round(this.time - (this.floorStart || 0));
    const targetTime = this.floor.targetTime || 300;
    const noDowns = players.every((p) => p.downs === 0);
    const fast = time <= targetTime;
    return {
      floorIndex: this.floorIndex, floorName: this.floor.name, time, targetTime,
      stars: 1 + (noDowns ? 1 : 0) + (fast ? 1 : 0),
      starReasons: { cleared: true, noDowns, fast },
      players
    };
  }

  // This floor's entry in an ECONOMY bonus list.
  bonusFor(list) {
    const l = data.ECONOMY[list];
    return l[Math.min(this.floorIndex, l.length - 1)];
  }

  payEveryone(gold, type) {
    if (!gold) return;
    for (const p of this.players.values()) {
      p.gold += gold;
      this.addStat(p, 'gold', gold);
    }
    this.event({ type, gold });
  }

  runResults() {
    return { time: Math.round(this.time), players: this.resultRows('runStats') };
  }

  addXp(p, amount) {
    p.xp += amount;
    while (p.level < data.LEVELS.length && p.xp >= data.LEVELS[p.level]) {
      p.level++;
      p.maxHp += data.LEVEL_HP;
      p.hp += data.LEVEL_HP;
      this.event({ type: 'levelup', targetId: p.id, level: p.level });
    }
  }

  // Potions, feathers and reviving teammates by holding E.
  updateTeamwork(dt) {
    for (const p of this.players.values()) {
      const pressed = (k) => p.input[k] && !p.prevInput[k];
      if (!p.downed) {
        if (pressed('use1') && p.potions > 0 && p.hp < p.maxHp) {
          p.potions--;
          this.healPlayer(p, data.POTION_HEAL);
        }
        if (pressed('use2') && p.feathers > 0) {
          const target = this.closestDowned(p, FEATHER_RANGE);
          if (target) {
            p.feathers--;
            this.revive(target, 0.5, p.id);
          }
        }
      }
      p.prevInput = p.input;
    }
    for (const d of this.players.values()) {
      if (!d.downed) continue;
      const helper = this.alivePlayers().find((h) => h.input.interact &&
        Math.hypot(h.x - d.x, h.y - d.y) <= REVIVE_RANGE);
      d.reviveProgress = helper ? d.reviveProgress + dt : 0;
      if (helper && d.reviveProgress >= REVIVE_TIME - 1e-9) this.revive(d, 0.3, helper.id);
    }
  }

  closestDowned(p, range) {
    let best = null;
    let bestDist = range;
    for (const d of this.players.values()) {
      if (!d.downed) continue;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (dist <= bestDist) { best = d; bestDist = dist; }
    }
    return best;
  }

  // ---------- enemies ----------

  // How much tougher monsters are on this floor: { hp, dmg } multipliers.
  power() {
    return (this.floor && this.floor.power) || { hp: 1, dmg: 1 };
  }

  // A monster's damage number scaled for this floor (for bosses' special attacks).
  monsterDamage(amount) {
    return Math.round(amount * this.power().dmg);
  }

  spawnEnemy(type, x, y, opts = {}) {
    const m = data.MONSTERS[type];
    const power = this.power();
    let hp = m.hp > 1 ? Math.round(m.hp * power.hp) : m.hp;
    if (m.hpPerExtraPlayer) hp = Math.round(hp * (1 + m.hpPerExtraPlayer * (this.startCount - 1)));
    const e = {
      id: this.nextId++, type, x, y, r: m.r, hp, maxHp: hp, dmg: Math.round(m.dmg * power.dmg), speed: m.speed,
      flying: !!m.flying, boss: !!m.boss, state: 'idle', stateUntil: 0, targetId: null,
      noReward: !!opts.noReward, invulnerable: false, stunUntil: 0, hitAt: {}, slows: {},
      timers: {}
    };
    this.enemies.push(e);
    if (type === 'rothand') warrens.initHand(this, e);
    return e;
  }

  // opts.melee: a sword hit. Ashmaw in the sky can't be reached by those.
  damageEnemy(e, amount, byId, opts = {}) {
    if (!e || e.hp <= 0 || e.invulnerable || !this.enemies.includes(e)) return 0;
    if (e.sky && opts.melee) {
      this.event({ type: 'outofreach', enemyId: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      return 0;
    }
    // Shot from far away: it gets angry and rushes the shooter.
    const shooter = this.players.get(byId);
    if (shooter && !e.boss && Math.hypot(shooter.x - e.x, shooter.y - e.y) > ANGRY_RANGE) {
      e.angryAt = byId;
      e.angryUntil = this.time + ANGRY_TIME;
    }
    const armor = e.type === 'golem' ? golem.frontFactor(this, e, byId) : wastes.armorOf(e);
    const dealt = Math.max(1, Math.round(amount * armor));
    e.hp -= dealt;
    this.addStat(this.players.get(byId), 'damage', dealt);
    const ev = { type: 'damage', enemyId: e.id, amount: dealt, x: Math.round(e.x), y: Math.round(e.y) };
    if (armor < 1) ev.armored = true;
    this.event(ev);
    if (e.hp <= 0) {
      this.addStat(this.players.get(byId), 'kills', 1);
      this.killEnemy(e, { reward: true, byId });
    } else if (e.type === 'crawler') wastes.crawlerHit(this, e);
    return dealt;
  }

  killEnemy(e, { reward }) {
    const i = this.enemies.indexOf(e);
    if (i === -1) return;
    this.enemies.splice(i, 1);
    e.hp = 0;
    if (reward && !e.noReward) {
      const m = data.MONSTERS[e.type];
      for (const p of this.players.values()) {
        const [lo, hi] = m.gold;
        const roll = (lo + Math.floor(this.rng() * (hi - lo + 1))) * data.ECONOMY.goldMul;
        const gold = Math.round(roll * (1 + (data.HEROES[p.heroClass].goldBonus || 0))); // Engineer's Scrapper
        p.gold += gold;
        this.addStat(p, 'gold', gold);
        this.addXp(p, m.xp);
      }
    }
    this.event({ type: 'kill', enemyId: e.id, enemyType: e.type, x: Math.round(e.x), y: Math.round(e.y), noReward: !reward || !!e.noReward });
    enemies.onEnemyDeath(this, e, { reward });
    // a boss's helpers (Ashmaw's bats, the Wyrm's hands) go when it does
    for (const m of this.enemies.slice()) if (m.summonedBy === e.id) this.killEnemy(m, { reward: false });
  }

  // ---------- projectiles and zones (used by heroes and monsters) ----------

  addProjectile(obj) {
    const pr = { id: this.nextId++, ...obj };
    this.projectiles.push(pr);
    return pr;
  }

  addZone(obj) {
    const z = { id: this.nextId++, ...obj };
    this.zones.push(z);
    return z;
  }

  // Slows from different sources don't add up: the strongest one wins.
  applySlow(ent, source, amount, duration) {
    ent.slows[source] = { amount, until: this.time + duration };
  }

  slowFactor(ent) {
    let worst = 0;
    for (const s of Object.values(ent.slows)) {
      if (s.until > this.time && s.amount > worst) worst = s.amount;
    }
    return 1 - worst;
  }

  event(obj) {
    this.events.push(obj);
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------- the main loop ----------

  tick(dt) {
    dt = Math.min(dt, 0.1);
    // In the shop only the clock runs, until its time is up.
    if (dt > 0 && this.phase === 'shop' && this.players.size > 0) {
      this.time += dt;
      if (this.time >= this.shopEndsAt - 1e-9) shop.timeUp(this);
      return;
    }
    if (!(dt > 0) || this.phase !== 'playing' || this.paused || this.players.size === 0) return;
    this.time += dt;

    // A title card is up: everything waits.
    if (this.transition) {
      if (this.time < this.transition.until - 1e-9) return;
      this.transition = null;
    }
    if (this.shopAt !== null) {
      this.shopAt = null;
      this.openShopOrFinish();
      return;
    }

    for (const p of this.players.values()) heroes.updatePlayer(this, p, dt);
    heroes.updateProjectiles(this, dt);
    heroes.updateZones(this, dt);
    hazards.updateHazards(this, dt);
    forge.update(this, dt);
    this.updateBurning(dt);
    for (const e of this.enemies.slice()) {
      if (this.enemies.includes(e)) enemies.updateEnemy(this, e, dt);
    }
    this.updateTeamwork(dt);

    // Everyone down? Start the room again.
    if (this.alivePlayers().length === 0) {
      this.resetRoom();
      return;
    }

    // Room clear: open the door, or go to the shop after the last room.
    if (!this.doorOpen && this.enemies.length === 0) {
      this.doorOpen = true;
      this.event({ type: 'roomclear', roomIndex: this.roomIndex });
      this.payEveryone(this.bonusFor('roomBonus'), 'roombonus');
      if (this.roomIndex === this.layouts.length - 1) {
        this.lastResults = this.floorResults();
        this.lastResults.starGold = this.lastResults.stars * this.bonusFor('starBonus');
        this.payEveryone(this.lastResults.starGold, 'stargold');
        this.event({ type: 'floorresults', results: this.lastResults });
        if (this.transitionsOn) {
          if (this.floor.shop) this.showCard('floorclear', `Floor ${this.floorIndex + 1} cleared!`, 'Heading to the camp shop…');
          else this.showCard('floorclear', 'Victory!', 'The dungeon is cleared!');
          this.shopAt = this.transition.until;
        } else {
          this.openShopOrFinish();
        }
        return;
      }
    }

    // Walk through the open door: everyone goes to the next room.
    if (this.doorOpen && this.roomIndex < this.layouts.length - 1) {
      const atDoor = this.alivePlayers().some((p) => tiles.tileAt(this.room, p.x, p.y) === 'd');
      if (atDoor) this.nextRoom();
    }
  }

  // After a floor: its camp shop, or the end of the run if it has none.
  openShopOrFinish() {
    if (this.floor.shop) this.enterShop();
    else {
      this.phase = 'done';
      this.event({ type: 'phase', phase: 'done' });
    }
  }

  // The camp shop is open for SHOP_TIME seconds.
  enterShop() {
    this.phase = 'shop';
    this.shopEndsAt = this.time + shop.SHOP_TIME;
    this.event({ type: 'phase', phase: 'shop' });
  }

  snapshot() {
    const r = Math.round;
    return {
      t: Math.round(this.time * 1000) / 1000,
      phase: this.phase,
      paused: this.paused,
      pausedBy: this.paused && this.players.has(this.pausedBy) ? this.players.get(this.pausedBy).name : null,
      transition: this.transition ? { ...this.transition } : null,
      roomIndex: this.roomIndex,
      roomCount: this.layouts.length,
      floorIndex: this.floorIndex,
      floorName: this.floor.name,
      floorCount: this.floors.length,
      room: {
        key: `${this.floorIndex}:${this.roomIndex}`,
        rows: this.layouts[this.roomIndex].rows,
        dark: this.dark,
        torches: this.torches.map((t) => ({ x: t.x, y: t.y, lit: t.lit }))
      },
      allDark: this.allDark,
      doorOpen: this.doorOpen,
      broken: [...this.broken],
      cracking: [...this.cracking.keys()],
      spikes: hazards.spikeState(this.time),
      ...forge.snapshot(this),
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, heroClass: p.heroClass, color: p.color,
        x: r(p.x), y: r(p.y), aim: Math.round(p.aim * 100) / 100,
        hp: p.hp, maxHp: p.maxHp, mana: r(p.mana), maxMana: p.maxMana, seq: p.lastSeq || 0,
        level: p.level, xp: p.xp, gold: p.gold, potions: p.potions, feathers: p.feathers,
        downed: p.downed, revive: Math.round((p.reviveProgress / REVIVE_TIME) * 100) / 100,
        rolling: this.time < p.invulnUntil, stunned: this.time < p.stunUntil,
        rooted: this.time < (p.rootUntil || 0), poisoned: this.time < (p.poisonedUntil || 0),
        burning: this.time < (p.burnUntil || 0),
        cd: { attack: Math.max(0, r((p.cd.attack - this.time) * 10) / 10),
          q: Math.max(0, r((p.cd.q - this.time) * 10) / 10),
          space: Math.max(0, r((p.cd.space - this.time) * 10) / 10) },
        weaponName: p.weaponName, swingAt: p.swingAt || 0,
        speed: Math.round(data.HEROES[p.heroClass].speed * (1 + p.speedMul) * this.slowFactor(p))
      })),
      enemies: this.enemies.map((e) => ({
        id: e.id, type: e.type, x: r(e.x), y: r(e.y), hp: e.hp, maxHp: e.maxHp, state: e.state,
        rebuildAt: e.rebuildAt || 0, growAt: e.growAt || 0,
        facing: e.facing === undefined ? 0 : Math.round(e.facing * 100) / 100,
        stunned: this.time < e.stunUntil, sky: !!e.sky, angry: e.angryUntil > this.time, rage: !!e.rage
      })),
      // `aim` = the way it's flying, so arrows always point forward on screen
      projectiles: this.projectiles.map((pr) => ({ id: pr.id, kind: pr.kind, x: r(pr.x), y: r(pr.y), aim: Math.round(Math.atan2(pr.vy, pr.vx) * 100) / 100 })),
      zones: this.zones.map((z) => {
        const out = { id: z.id, kind: z.kind, x: r(z.x), y: r(z.y), r: z.r, until: z.until };
        if (z.aim !== undefined) out.aim = Math.round(z.aim * 100) / 100;
        if (z.spread !== undefined) out.spread = Math.round(z.spread * 100) / 100;
        if (z.width !== undefined) out.width = z.width;
        if (z.armAt !== undefined) out.armed = this.time >= z.armAt;
        if (z.ownerId) out.ownerId = z.ownerId;
        return out;
      })
    };
  }
}

module.exports = { Game, sanitizeInput, REVIVE_TIME };
