// One running game for one lobby room. The server is the referee:
// it moves everyone, decides every hit, and hands out gold and XP.
// Browsers only send their key presses (setInput) and draw snapshot().
const tiles = require('../shared/tiles');
const data = require('../shared/data');
const { FLOOR1, FLOOR1_NAME, FLOOR1_ROOM_NAMES } = require('../shared/rooms');

// How long each title card stays up, in seconds. The game is frozen meanwhile.
const CARD_TIME = { start: 2, room: 1.6, boss: 2.2, reset: 1.6, floorclear: 2.5 };
const heroes = require('./heroes');
const enemies = require('./enemies');
const hazards = require('./hazards');
const shop = require('./shop');

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

class Game {
  constructor(players, { rooms = FLOOR1, rng = Math.random, transitions = true, roomNames = FLOOR1_ROOM_NAMES } = {}) {
    this.rng = rng;
    this.transitionsOn = transitions;
    this.roomNames = roomNames;
    this.transition = null; // the title card on screen: { kind, title, subtitle, until }
    this.shopAt = null;     // when the floor-cleared card ends and the shop opens
    this.roomDefs = rooms;
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
    this.loadRoom();
    this.showCard('start', `Floor 1 · ${FLOOR1_NAME}`, `Room 1 of ${this.roomDefs.length} · ${this.roomName(0)}`);
  }

  roomName(i) {
    return this.roomNames[i] || '';
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
      cd: { attack: 0, q: 0, space: 0 },
      slows: {}, stunUntil: 0, invulnUntil: 0,
      aim: 0, input: sanitizeInput(null), prevInput: sanitizeInput(null)
    };
  }

  // ---------- rooms ----------

  loadRoom() {
    this.room = tiles.parseRoom(this.roomDefs[this.roomIndex]);
    this.doorOpen = false;
    this.enemies = [];
    this.projectiles = [];
    this.zones = [];
    this.broken = new Set();     // cracked tiles that became pits
    this.cracking = new Map();   // tile index -> time it breaks
    this.tauntBy = null;
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
    const n = this.roomDefs.length;
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

  playerDamage(p) {
    const hero = data.HEROES[p.heroClass];
    return hero.baseDmg + p.weaponBonus + data.LEVEL_DMG * (p.level - 1);
  }

  damagePlayer(p, amount, source) {
    if (!p || p.downed || this.time < p.invulnUntil) return 0;
    const dealt = Math.max(1, Math.round(amount - p.defense));
    p.hp = Math.max(0, p.hp - dealt);
    this.event({ type: 'damage', targetId: p.id, amount: dealt });
    if (p.hp <= 0) {
      p.downed = true;
      p.reviveProgress = 0;
      this.event({ type: 'downed', targetId: p.id });
    }
    return dealt;
  }

  healPlayer(p, amount) {
    if (!p || p.downed) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (p.hp > before) this.event({ type: 'heal', targetId: p.id, amount: p.hp - before });
  }

  revive(p, fraction) {
    p.downed = false;
    p.reviveProgress = 0;
    p.hp = Math.max(1, Math.round(p.maxHp * fraction));
    this.event({ type: 'revived', targetId: p.id });
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
            this.revive(target, 0.5);
          }
        }
      }
      p.prevInput = p.input;
    }
    for (const d of this.players.values()) {
      if (!d.downed) continue;
      const helping = this.alivePlayers().some((h) => h.input.interact &&
        Math.hypot(h.x - d.x, h.y - d.y) <= REVIVE_RANGE);
      d.reviveProgress = helping ? d.reviveProgress + dt : 0;
      if (d.reviveProgress >= REVIVE_TIME - 1e-9) this.revive(d, 0.3);
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

  spawnEnemy(type, x, y, opts = {}) {
    const m = data.MONSTERS[type];
    let hp = m.hp;
    if (m.hpPerExtraPlayer) hp = Math.round(hp * (1 + m.hpPerExtraPlayer * (this.startCount - 1)));
    const e = {
      id: this.nextId++, type, x, y, r: m.r, hp, maxHp: hp, dmg: m.dmg, speed: m.speed,
      flying: !!m.flying, boss: !!m.boss, state: 'idle', stateUntil: 0, targetId: null,
      noReward: !!opts.noReward, invulnerable: false, stunUntil: 0, hitAt: {}, slows: {},
      timers: {}
    };
    this.enemies.push(e);
    return e;
  }

  damageEnemy(e, amount, byId) {
    if (!e || e.hp <= 0 || e.invulnerable || !this.enemies.includes(e)) return 0;
    const dealt = Math.max(1, Math.round(amount));
    e.hp -= dealt;
    this.event({ type: 'damage', enemyId: e.id, amount: dealt, x: Math.round(e.x), y: Math.round(e.y) });
    if (e.hp <= 0) this.killEnemy(e, { reward: true, byId });
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
        p.gold += lo + Math.floor(this.rng() * (hi - lo + 1));
        this.addXp(p, m.xp);
      }
    }
    this.event({ type: 'kill', enemyId: e.id, enemyType: e.type, x: Math.round(e.x), y: Math.round(e.y) });
    enemies.onEnemyDeath(this, e, { reward });
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
    if (!(dt > 0) || this.phase !== 'playing' || this.paused || this.players.size === 0) return;
    this.time += dt;

    // A title card is up: everything waits.
    if (this.transition) {
      if (this.time < this.transition.until - 1e-9) return;
      this.transition = null;
    }
    if (this.shopAt !== null) {
      this.shopAt = null;
      this.phase = 'shop';
      this.event({ type: 'phase', phase: 'shop' });
      return;
    }

    for (const p of this.players.values()) heroes.updatePlayer(this, p, dt);
    heroes.updateProjectiles(this, dt);
    heroes.updateZones(this, dt);
    hazards.updateHazards(this, dt);
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
      if (this.roomIndex === this.roomDefs.length - 1) {
        if (this.transitionsOn) {
          this.showCard('floorclear', 'Floor 1 cleared!', 'Heading to the camp shop…');
          this.shopAt = this.transition.until;
        } else {
          this.phase = 'shop';
          this.event({ type: 'phase', phase: 'shop' });
        }
        return;
      }
    }

    // Walk through the open door: everyone goes to the next room.
    if (this.doorOpen && this.roomIndex < this.roomDefs.length - 1) {
      const atDoor = this.alivePlayers().some((p) => tiles.tileAt(this.room, p.x, p.y) === 'd');
      if (atDoor) this.nextRoom();
    }
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
      roomCount: this.roomDefs.length,
      doorOpen: this.doorOpen,
      broken: [...this.broken],
      cracking: [...this.cracking.keys()],
      spikes: hazards.spikeState(this.time),
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, heroClass: p.heroClass, color: p.color,
        x: r(p.x), y: r(p.y), aim: Math.round(p.aim * 100) / 100,
        hp: p.hp, maxHp: p.maxHp, mana: r(p.mana), maxMana: p.maxMana,
        level: p.level, xp: p.xp, gold: p.gold, potions: p.potions, feathers: p.feathers,
        downed: p.downed, revive: Math.round((p.reviveProgress / REVIVE_TIME) * 100) / 100,
        rolling: this.time < p.invulnUntil, stunned: this.time < p.stunUntil,
        cd: { attack: Math.max(0, r((p.cd.attack - this.time) * 10) / 10),
          q: Math.max(0, r((p.cd.q - this.time) * 10) / 10),
          space: Math.max(0, r((p.cd.space - this.time) * 10) / 10) },
        weaponName: p.weaponName, swingAt: p.swingAt || 0,
        speed: Math.round(data.HEROES[p.heroClass].speed * (1 + p.speedMul) * this.slowFactor(p))
      })),
      enemies: this.enemies.map((e) => ({
        id: e.id, type: e.type, x: r(e.x), y: r(e.y), hp: e.hp, maxHp: e.maxHp, state: e.state,
        stunned: this.time < e.stunUntil
      })),
      projectiles: this.projectiles.map((pr) => ({ id: pr.id, kind: pr.kind, x: r(pr.x), y: r(pr.y) })),
      zones: this.zones.map((z) => ({ id: z.id, kind: z.kind, x: r(z.x), y: r(z.y), r: z.r, until: z.until }))
    };
  }
}

module.exports = { Game, sanitizeInput, REVIVE_TIME };
