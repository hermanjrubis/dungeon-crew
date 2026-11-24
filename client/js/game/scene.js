// The dungeon, drawn with Phaser. The server sends snapshots 20 times a second;
// this file draws them and sends my keys back. My own hero moves right away on my
// screen (prediction) and is gently pulled to where the server says it is.
(function () {
  const { TILE, parseRoom, moveWithCollision } = DC.tiles;
  const W = DC.tiles.ROOM_W * TILE;
  const H = DC.tiles.ROOM_H * TILE;
  const INTERP_DELAY = 100;
  // Big monsters get a wide health bar higher up: [bar offset, bar width].
  const SHEETS = new Map(); // sheet key -> sheet (from DC.sheets)
  // How far below an entity's position its feet were in the old pictures, so
  // the new art stands in the same spot.
  const footCache = new Map();
  function oldFoot(key) {
    if (footCache.has(key)) return footCache.get(key);
    const old = DC.sprites.spriteFiles().find((s) => s.key === key);
    let v = 18;
    if (old) {
      let last = 0;
      old.rows.forEach((r, i) => { if (/[^.]/.test(r)) last = i; });
      v = Math.round(((last + 1) / 16) * old.size - old.size / 2);
    }
    footCache.set(key, v);
    return v;
  }
  const BIG = { mother: [52, 80], halfmother: [52, 80], queen: [52, 80], king: [56, 90], dragon: [74, 120] }; // ms: draw others slightly in the past so movement is smooth

  let game = null;
  let scene = null;
  let latest = null;         // newest snapshot
  const buffer = [];         // recent snapshots for smoothing { at, snap }
  const pendingEvents = [];

  // ---------- the Phaser scene ----------

  class DungeonScene extends Phaser.Scene {
    constructor() { super('dungeon'); }

    preload() {
      // New part-based art comes as sprite sheets; anything not redrawn yet keeps its old picture.
      for (const sh of DC.sheets.sheetFiles()) {
        SHEETS.set(sh.key, sh);
        this.load.spritesheet(sh.key + '-sheet', 'assets/' + sh.file, { frameWidth: sh.size, frameHeight: sh.size });
      }
      for (const s of DC.sprites.spriteFiles()) if (!SHEETS.has(s.key)) this.load.image(s.key, 'assets/' + s.file);
    }

    // One Phaser animation per sheet and action (walk, attack...).
    makeAnims() {
      for (const sh of SHEETS.values()) {
        for (const [name, a] of Object.entries(sh.anims)) {
          const key = DC.sheets.animKey(sh.key, name);
          if (this.anims.exists(key)) continue;
          this.anims.create({ key, frames: this.anims.generateFrameNumbers(sh.key + '-sheet', { start: a.start, end: a.start + a.count - 1 }), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
        }
      }
    }

    // Clear what's on screen before a new run starts (Play again).
    resetView() {
      for (const s of this.sprites.values()) { s.body.destroy(); if (s.label) s.label.destroy(); s.bar.destroy(); }
      this.sprites.clear();
      for (const c of this.corpses) { this.tweens.killTweensOf(c); c.destroy(); }
      this.corpses = [];
      this.gone.clear();
      this.roomKey = '';
      this.room = null;
      this.me = null;
      this.history = [];
      this.corr = { x: 0, y: 0 };
      this.slashes = [];
    }

    // Start a one-shot action (attack, skill, hit...) on a hero or monster.
    startAction(id, action, time) {
      const s = this.sprites.get(id);
      if (!s || !s.sheet) return;
      const a = s.sheet.anims[action];
      if (!a) return;
      const now = time === undefined ? this.time.now : time;
      if (s.oneShot && s.oneShot.action === action && now - s.oneShot.at < 250) return; // already showing it
      s.oneShot = { action, at: now, until: now + (a.count / a.fps) * 1000 };
      s.body.play(DC.sheets.animKey(s.sheet.key, action));
    }

    // Keep the sprite on the right action; restarts only when the action changes.
    setAction(s, action, time) {
      if (!s.sheet) return;
      if (s.oneShot && time < s.oneShot.until && action !== 'down' && action !== 'death' && action !== 'roll') return;
      s.oneShot = null;
      if (!s.sheet.anims[action]) action = s.sheet.anims.idle ? 'idle' : Object.keys(s.sheet.anims)[0];
      const key = DC.sheets.animKey(s.sheet.key, action);
      if (s.body.anims.currentAnim?.key !== key || !s.body.anims.isPlaying && s.sheet.anims[action].loop) s.body.play(key);
    }

    // Has this sprite moved in the last moment? (walk vs stand)
    moving(s, x, y, time) {
      if (s.lastX !== undefined && Math.hypot(x - s.lastX, y - s.lastY) > 0.35) {
        s.moveUntil = time + 130;
        if (Math.abs(x - s.lastX) > 0.35) s.faceLeft = x < s.lastX;
      }
      s.lastX = x; s.lastY = y;
      return time < (s.moveUntil || 0);
    }

    create() {
      scene = this;
      this.makeAnims();
      this.corpses = [];   // monsters playing their death animation
      this.gone = new Map(); // id -> last look of a sprite that just left (for death animations)
      this.tileLayer = this.add.graphics();
      this.hazardLayer = this.add.graphics(); // lava, geysers, jets and the bridge (animated)
      this.zoneLayer = this.add.graphics();
      this.fxLayer = this.add.graphics().setDepth(5);
      this.shotLayer = this.add.graphics().setDepth(6);
      this.sprites = new Map(); // id -> { body, label, bar }
      this.tileKey = '';
      this.me = null;           // my predicted position { x, y }
      this.room = null;
      this.roomKey = '';
      this.slashes = [];
      this.floaters = [];
      this.fx = new Effects(this);
      this.statusLayer = this.add.graphics().setDepth(6);
      this.darkLayer = this.add.graphics().setDepth(6.5);  // darkness covers monsters and shots
      this.glowLayer = this.add.graphics().setDepth(6.6);  // the Queen's glowing spots show through it
      this.torchHint = this.add.text(0, 0, 'Hold E to light', { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#F2C14E', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(8).setVisible(false);
      this.flashUntil = new Map(); // sprite id -> time the hit flash ends
      this.ghostAt = new Map();    // sprite id -> time of the last afterimage
      this.lastShot = new Map();   // projectile id -> previous position

      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,SPACE,E,ONE,TWO');
      this.input.mouse.disableContextMenu();
      this.sendTimer = this.time.addEvent({ delay: 50, loop: true, callback: () => this.sendInput() });
    }

    currentInput() {
      const k = this.keys;
      const p = this.input.activePointer;
      const from = this.me || { x: W / 2, y: H / 2 };
      return {
        up: k.W.isDown || k.UP.isDown,
        down: k.S.isDown || k.DOWN.isDown,
        left: k.A.isDown || k.LEFT.isDown,
        right: k.D.isDown || k.RIGHT.isDown,
        attack: p.isDown,
        q: k.Q.isDown,
        space: k.SPACE.isDown,
        interact: k.E.isDown,
        use1: k.ONE.isDown,
        use2: k.TWO.isDown,
        aim: Math.atan2(p.worldY - from.y, p.worldX - from.x)
      };
    }

    // Every input gets a number. We remember where we predicted we were when
    // we sent it, so the server's (delayed) position can be compared with
    // where we were back then, not where we are now.
    sendInput() {
      if (App.screen !== 'game') return;
      const input = this.currentInput();
      this.seq = (this.seq || 0) + 1;
      input.seq = this.seq;
      if (this.me) {
        this.history.push({ seq: this.seq, x: this.me.x, y: this.me.y });
        if (this.history.length > 80) this.history.shift();
      }
      Net.sendInput(input);
    }

    update(time, deltaMs) {
      if (!latest) return;
      const dt = Math.min(deltaMs / 1000, 0.1);
      const snap = latest;
      if (snap.room.key !== this.roomKey) {
        // The server picked this room's layout; build it from the rows it sent.
        this.roomKey = snap.room.key;
        this.room = parseRoom(snap.room.rows);
        for (const c of this.corpses) { this.tweens.killTweensOf(c); c.destroy(); }
        this.corpses = [];
        this.gone.clear();
        this.me = null;
      }
      if (App.screen === 'game') localSounds(this.currentInput(), snap);
      this.drawTiles(snap);
      this.drawHazards(snap, time);
      this.predictMe(snap, dt);
      this.drawZones(snap, time);
      this.drawEntities(snap, time);
      this.drawShots(snap);
      this.drawEffects(dt);
      this.drawTorches(snap, time);
      this.drawDarkness(snap, time);
      this.fx.update(dt);
      for (const ev of pendingEvents.splice(0)) {
        playSound(ev);
        this.onEvent(ev, snap);
      }
    }

    // ---------- my own hero ----------

    // My own hero moves the moment I press a key (prediction). The server's
    // position arrives a little late, so we check it against where we predicted
    // we were when we sent that input (by its number), and fix only the real
    // difference, smoothly. (Comparing with where we are *now* made the hero
    // step back and forth whenever the internet was slow.)
    predictMe(snap, dt) {
      const server = snap.players.find((p) => p.id === App.me);
      if (!server) return;
      this.history = this.history || [];
      this.corr = this.corr || { x: 0, y: 0 };
      // Real elapsed time (Phaser smooths its frame time, which would make us
      // walk a little more or less than the server does).
      const now = performance.now();
      dt = this.lastPredict ? Math.min(0.1, (now - this.lastPredict) / 1000) : dt;
      this.lastPredict = now;
      if (!this.me || snap.paused || snap.transition || server.downed || server.rolling || server.stunned) {
        this.resetPrediction(server);
        return;
      }
      const input = this.currentInput();
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        const step = server.speed * dt;
        const pos = moveWithCollision(this.room, this.me.x, this.me.y, (dx / len) * step, (dy / len) * step, 16, { doorOpen: snap.doorOpen });
        this.me.x = pos.x;
        this.me.y = pos.y;
      }

      // A new server answer: compare it with our guess from that moment.
      if (server.seq !== this.lastAck) {
        this.lastAck = server.seq;
        // The server moved one tick with input `seq`; we were at the next entry by then.
        const then = this.history.find((h) => h.seq === server.seq + 1) || this.me;
        const ox = server.x - then.x;
        const oy = server.y - then.y;
        if (Math.hypot(ox, oy) > 96) { this.resetPrediction(server); return; } // teleported (pit, lava, new room)
        this.corr.x += ox;
        this.corr.y += oy;
        for (const h of this.history) if (h.seq > server.seq) { h.x += ox; h.y += oy; }
        this.history = this.history.filter((h) => h.seq > server.seq);
      }
      // Ease the difference in over a few frames.
      const k = Math.min(1, dt * 12);
      this.me.x += this.corr.x * k;
      this.me.y += this.corr.y * k;
      this.corr.x *= 1 - k;
      this.corr.y *= 1 - k;
    }

    resetPrediction(server) {
      this.me = { x: server.x, y: server.y };
      this.history = [];
      this.corr = { x: 0, y: 0 };
      this.lastAck = server.seq;
    }

    // ---------- the room ----------

    drawTiles(snap) {
      const key = [snap.room.key, snap.doorOpen, snap.spikes, snap.broken.join(','), snap.cracking.join(',')].join('|');
      if (key === this.tileKey) return;
      this.tileKey = key;
      const g = this.tileLayer;
      g.clear();
      const room = this.room;
      const broken = new Set(snap.broken);
      const cracking = new Set(snap.cracking);
      // What's on a tile; cracked floor that broke counts as a pit.
      const at = (tx, ty) => {
        if (ty < 0 || ty >= room.h || tx < 0 || tx >= room.w) return 'w';
        return broken.has(ty * room.w + tx) ? 'p' : room.grid[ty][tx];
      };
      const isBorder = (tx, ty) => tx === 0 || ty === 0 || tx === room.w - 1 || ty === room.h - 1;

      // 1) floor under everything except outer walls and pits
      for (let ty = 0; ty < room.h; ty++) {
        for (let tx = 0; tx < room.w; tx++) {
          const ch = at(tx, ty);
          if (ch === 'p' || ch === 'l' || isBorder(tx, ty)) continue;
          drawFloor(g, tx, ty);
        }
      }
      // 2) walls, doors and things lying on the floor
      for (let ty = 0; ty < room.h; ty++) {
        for (let tx = 0; tx < room.w; tx++) {
          const ch = at(tx, ty);
          const x = tx * TILE;
          const y = ty * TILE;
          if (ch === 'w' && isBorder(tx, ty)) drawWall(g, x, y, tx, ty);
          else if (ch === 'j') { drawWall(g, x, y, tx, ty); drawNozzle(g, x, y, tx, ty, room); }
          else if (ch === 'v') drawVent(g, x, y);
          else if (ch === 'r') drawPlatform(g, x, y, tx, ty);
          else if (ch === 'd') drawDoor(g, x, y, snap.doorOpen);
          else if (ch === 'p') drawPit(g, tx, ty, at);
          else if (ch === 'u') drawPool(g, tx, ty, at, 'u', 0x324a66, 0x6b8fb3);
          else if (ch === 'o') drawPool(g, tx, ty, at, 'o', 0x2c5636, 0x9bd17a);
          else if (ch === 'x') drawCracked(g, tx, ty, cracking.has(ty * room.w + tx));
          else if (ch === 's') drawSpikes(g, x, y, snap.spikes);
        }
      }
      // 3) pillars last, so their shadow falls on the floor below them
      for (let ty = 0; ty < room.h; ty++) {
        for (let tx = 0; tx < room.w; tx++) {
          if (at(tx, ty) === 'w' && !isBorder(tx, ty)) drawPillar(g, tx * TILE, ty * TILE, at(tx, ty + 1) === 'w');
        }
      }
    }

    // The last monster fell: banner, gold bursts on the door and the bars slide up.
    roomCleared(ev, snap) {
      const doors = [];
      this.room.grid.forEach((row, ty) => row.forEach((ch, tx) => { if (ch === 'd') doors.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }); }));
      this.doorOpenedAt = this.time.now;
      this.doorTiles = doors;
      for (const d of doors) {
        this.fx.burst(d.x, d.y, 0xf2c14e, 18, 'burst');
        this.fx.ring(d.x, d.y, { from: 10, to: 70, life: 0.5, color: 0xf2a541, width: 5 });
      }
      if (ev.roomIndex < snap.roomCount - 1) Hud.banner('Room cleared! Door open →', 2000);
      if (window.Sound) Sound.play('roomClear');
    }

    // ---------- lava, geysers, flame jets and the bridge (moving every frame) ----------

    drawHazards(snap, time) {
      const g = this.hazardLayer;
      g.clear();
      // door bars sliding up into the wall for 0.7 s after a room is cleared
      const since = this.doorOpenedAt ? time - this.doorOpenedAt : 9999;
      if (since < 700 && this.doorTiles) {
        const k = since / 700;
        for (const d of this.doorTiles) {
          const x = d.x - TILE / 2;
          const y = d.y - TILE / 2 - k * TILE;
          g.fillStyle(0x8c84a3, 1 - k);
          for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 11, Math.max(d.y - TILE / 2 - TILE, y), 5, TILE * (1 - k));
          g.fillStyle(0xf2a541, 0.5 * (1 - k)).fillRect(x, d.y - TILE / 2, TILE, TILE);
        }
      }
      const room = this.room;
      const melted = new Set(snap.melted || []);
      const isLava = (tx, ty) => tx >= 0 && ty >= 0 && tx < room.w && ty < room.h &&
        (room.grid[ty][tx] === 'l' || melted.has(ty * room.w + tx));
      for (let ty = 0; ty < room.h; ty++) {
        for (let tx = 0; tx < room.w; tx++) if (isLava(tx, ty)) drawLava(g, tx, ty, time, isLava);
      }
      for (const idx of snap.crumbling || []) {
        const tx = idx % room.w;
        const ty = Math.floor(idx / room.w);
        const sx = Math.sin(time / 30 + idx) * 2;
        g.fillStyle(0xe5622b, 0.25 + 0.2 * Math.abs(Math.sin(time / 90))).fillRect(tx * TILE + sx, ty * TILE, TILE, TILE);
        g.lineStyle(2, 0xf2a541, 0.9);
        g.lineBetween(tx * TILE + 8 + sx, ty * TILE + 10, tx * TILE + 26 + sx, ty * TILE + 30);
        g.lineBetween(tx * TILE + 26 + sx, ty * TILE + 30, tx * TILE + 40 + sx, ty * TILE + 22);
        if (Math.random() < 0.03) this.fx.burst(tx * TILE + 24, ty * TILE + 24, 0x7a6248, 2, 'rubble', 'fx-square');
      }
      const b = snap.bridge;
      if (b) {
        const a = b.warn ? 0.45 + 0.55 * Math.abs(Math.sin(time / 70)) : 1;
        g.fillStyle(0x000000, 0.35).fillRect(b.x + 4, b.y + 8, b.w, b.h);
        g.fillStyle(0x4a3f3a, a).fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle(0x5e514a, a).fillRect(b.x, b.y, b.w, 6);
        g.lineStyle(2, 0x2a2220, a);
        for (let i = 1; i < 4; i++) g.lineBetween(b.x + 2, b.y + i * (b.h / 4), b.x + b.w - 2, b.y + i * (b.h / 4));
        g.lineStyle(3, b.warn ? 0xf2a541 : 0x1b1725, a).strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      }
      for (const v of snap.vents || []) {
        if (v.state === 'glow') {
          const pulse = 0.5 + 0.5 * Math.sin(time / 80);
          g.fillStyle(0xe5622b, 0.25 + 0.3 * pulse).fillCircle(v.x, v.y, 20 + 6 * pulse);
          g.fillStyle(0xf2a541, 0.8).fillCircle(v.x, v.y, 8);
        } else if (v.state === 'erupt') {
          const wob = Math.sin(time / 50) * 3;
          g.fillStyle(0xe5622b, 0.35).fillCircle(v.x, v.y, 40);
          g.fillStyle(0xe5622b).fillRect(v.x - 14 + wob, v.y - 70, 28, 70);
          g.fillStyle(0xf2a541).fillRect(v.x - 8 + wob, v.y - 76, 16, 76);
          g.fillStyle(0xfff1b8).fillRect(v.x - 3 + wob, v.y - 60, 6, 56);
          g.fillStyle(0xf2a541).fillCircle(v.x + wob, v.y - 76, 12);
          if (Math.random() < 0.5) this.fx.burst(v.x, v.y - 60, 0xf2a541, 2, 'drip');
        }
      }
      for (const j of snap.jets || []) {
        const mx = j.x + j.dx * TILE / 2;
        const my = j.y + j.dy * TILE / 2;
        if (j.state === 'hiss') {
          if (Math.random() < 0.6) this.fx.burst(mx, my, 0xf2a541, 1, 'spark');
          g.fillStyle(0xf2a541, 0.5 + 0.5 * Math.abs(Math.sin(time / 40))).fillCircle(mx, my, 6);
        } else if (j.state === 'fire') {
          const len = j.len * TILE;
          const horiz = j.dx !== 0;
          const x0 = horiz ? (j.dx > 0 ? mx : mx - len) : j.x - 15;
          const y0 = horiz ? j.y - 15 : (j.dy > 0 ? my : my - len);
          const w = horiz ? len : 30;
          const h = horiz ? 30 : len;
          g.fillStyle(0xe5622b, 0.55).fillRect(x0, y0, w, h);
          g.fillStyle(0xf2a541, 0.9).fillRect(horiz ? x0 : x0 + 7, horiz ? y0 + 7 : y0, horiz ? w : 16, horiz ? 16 : h);
          g.fillStyle(0xfff1b8, 0.9).fillRect(horiz ? x0 : x0 + 12, horiz ? y0 + 12 : y0, horiz ? w : 6, horiz ? 6 : h);
          const t = Math.random();
          if (Math.random() < 0.7) this.fx.burst(mx + j.dx * len * t, my + j.dy * len * t, 0xf2a541, 1, 'flame');
        }
      }
    }

    // ---------- skill areas and warnings ----------

    drawZones(snap, time) {
      const g = this.zoneLayer;
      g.clear();
      const pulse = 0.5 + 0.5 * Math.sin(time / 90);
      for (const z of snap.zones) {
        if (z.kind === 'flopShadow') {
          g.fillStyle(0x000000, 0.35 + 0.25 * pulse).fillEllipse(z.x, z.y, z.r * 2, z.r * 1.4);
          g.lineStyle(3, 0xe5534b, 0.9).strokeEllipse(z.x, z.y, z.r * 2, z.r * 1.4);
        } else if (z.kind === 'slime') {
          g.fillStyle(0xa94fc0, 0.35).fillCircle(z.x, z.y, z.r);
          g.fillStyle(0xe3a6ee, 0.35).fillCircle(z.x - z.r * 0.3, z.y - z.r * 0.3, z.r * 0.3);
        } else if (z.kind === 'arrowRain') {
          g.fillStyle(0x5ec8b8, 0.12).fillCircle(z.x, z.y, z.r);
          g.lineStyle(2, 0x5ec8b8, 0.8).strokeCircle(z.x, z.y, z.r);
          g.lineStyle(2, 0xcfc8de, 0.9);
          for (let i = 0; i < 6; i++) {
            const a = i * 1.7 + time / 200;
            const rx = z.x + Math.cos(a) * z.r * 0.6;
            const ry = z.y + Math.sin(a) * z.r * 0.6 + ((time / 3 + i * 20) % 30) - 15;
            g.lineBetween(rx, ry - 10, rx, ry);
          }
          if (Math.random() < 0.35) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * z.r;
            this.fx.burst(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 0xcfc8de, 3, 'spark', 'fx-square');
          }
        } else if (z.kind === 'turret') {
          // a little tower with a spinning dish; faint ring = its range
          g.lineStyle(1, 0xf2c14e, 0.15).strokeCircle(z.x, z.y, z.r);
          g.fillStyle(0x000000, 0.3).fillEllipse(z.x, z.y + 14, 34, 10);
          g.fillStyle(0x4a5a7a).fillRect(z.x - 12, z.y - 4, 24, 16);
          g.fillStyle(0x6e7f9e).fillRect(z.x - 12, z.y - 4, 24, 4);
          g.fillStyle(0xcfc8de).fillCircle(z.x, z.y - 10, 8);
          const a = time / 300;
          g.lineStyle(4, 0x2a2438).lineBetween(z.x, z.y - 10, z.x + Math.cos(a) * 14, z.y - 10 + Math.sin(a) * 6);
          const left = Math.max(0, z.until - snap.t);
          g.fillStyle(left < 2 && Math.floor(time / 150) % 2 ? 0xe5534b : 0xf2c14e).fillCircle(z.x, z.y - 10, 3);
        } else if (z.kind === 'mine') {
          g.fillStyle(0x000000, 0.3).fillEllipse(z.x, z.y + 4, 26, 10);
          g.fillStyle(0x2a2438).fillCircle(z.x, z.y, 11);
          g.lineStyle(2, 0x6e7f9e).strokeCircle(z.x, z.y, 11);
          const blink = z.armed ? Math.floor(time / 250) % 2 === 0 : true;
          g.fillStyle(z.armed ? 0xe5534b : 0xf2c14e, blink ? 1 : 0.3).fillCircle(z.x, z.y - 2, 3.5);
        } else if (z.kind === 'quake') {
          g.lineStyle(4, 0x7a6248, 0.7).strokeCircle(z.x, z.y, z.r);
        } else if (z.kind === 'healCircle') {
          g.fillStyle(0x5ec8b8, 0.18 + 0.08 * pulse).fillCircle(z.x, z.y, z.r);
          g.lineStyle(2, 0x5ec8b8, 0.9).strokeCircle(z.x, z.y, z.r);
          if (Math.random() < 0.5) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * z.r;
            this.fx.burst(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 0x7ee8c8, 1, 'rise', 'fx-plus');
          }
        } else if (z.kind === 'fireBlast') {
          g.fillStyle(0xf2a541, 0.55).fillCircle(z.x, z.y, z.r);
        } else if (z.kind === 'poisonCloud') {
          for (let i = 0; i < 5; i++) {
            const a = time / 700 + i * 1.3;
            g.fillStyle(0x6fa86a, 0.16).fillCircle(z.x + Math.cos(a) * z.r * 0.35, z.y + Math.sin(a) * z.r * 0.35, z.r * 0.7);
          }
          if (Math.random() < 0.4) this.fx.burst(z.x + (Math.random() - 0.5) * z.r, z.y + (Math.random() - 0.5) * z.r, 0x9bd17a, 1, 'rise');
        } else if (z.kind === 'safeCircle') {
          g.fillStyle(0x5ec8b8, 0.18 + 0.12 * pulse).fillCircle(z.x, z.y, z.r);
          g.lineStyle(4, 0xb8f0e4, 0.9).strokeCircle(z.x, z.y, z.r);
        } else if (z.kind === 'vineRing') {
          const left = Math.max(0, (z.until - snap.t) / 1);
          g.lineStyle(4, 0x4f8a6a, 0.9).strokeCircle(z.x, z.y, z.r * (0.6 + 0.4 * left));
          g.lineStyle(2, 0x9bd17a, 0.8).strokeCircle(z.x, z.y, z.r * (0.3 + 0.3 * left));
        } else if (z.kind === 'rockShadow') {
          const grown = 1 - Math.max(0, Math.min(1, (z.until - snap.t) / 1));
          g.fillStyle(0x000000, 0.25 + 0.4 * grown).fillEllipse(z.x, z.y, z.r * 2 * (0.4 + 0.6 * grown), z.r * 1.4 * (0.4 + 0.6 * grown));
          g.lineStyle(2, 0xe5534b, 0.4 + 0.5 * grown).strokeEllipse(z.x, z.y, z.r * 2, z.r * 1.4);
        } else if (z.kind === 'breathWarn') {
          const charge = 1 - Math.max(0, Math.min(1, (z.until - snap.t) / 1.5));
          g.fillStyle(0xe5622b, 0.12 + 0.3 * charge);
          g.slice(z.x, z.y, z.r, z.aim - z.spread / 2, z.aim + z.spread / 2, false).fillPath();
          g.lineStyle(3, 0xe5534b, 0.5 + 0.5 * pulse);
          g.slice(z.x, z.y, z.r, z.aim - z.spread / 2, z.aim + z.spread / 2, false).strokePath();
        } else if (z.kind === 'meteorMark') {
          const left = Math.max(0, Math.min(1, (z.until - snap.t) / 1.5));
          g.fillStyle(0xe5534b, 0.15 + 0.2 * (1 - left)).fillCircle(z.x, z.y, z.r);
          g.lineStyle(3, 0xe5534b, 0.9).strokeCircle(z.x, z.y, z.r);
          g.lineStyle(2, 0xf2a541, 0.9).strokeCircle(z.x, z.y, z.r * left);
        } else if (z.kind === 'taunt') {
          g.lineStyle(4, 0xf2a541, 0.8).strokeCircle(z.x, z.y, z.r * 0.5);
        }
      }
    }

    // ---------- heroes and monsters ----------

    spriteFor(id, key, labelText, labelColor) {
      let s = this.sprites.get(id);
      if (s && s.key !== key && SHEETS.has(key) !== !!s.sheet) {
        // switching between a sheet and an old picture: start over
        s.body.destroy(); if (s.label) s.label.destroy(); s.bar.destroy();
        this.sprites.delete(id); s = null;
      }
      if (!s) {
        const sheet = SHEETS.get(key);
        const body = sheet
          ? this.add.sprite(0, 0, key + '-sheet', 0).setOrigin(sheet.foot[0] / sheet.size, sheet.foot[1] / sheet.size).setDepth(3)
          : this.add.image(0, 0, key).setDepth(3);
        const label = labelText ? this.add.text(0, 0, labelText, { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: 'bold', color: labelColor || '#EDE8F5', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4) : null;
        const bar = this.add.graphics().setDepth(4);
        s = { body, label, bar, key, seen: 0, sheet };
        this.sprites.set(id, s);
      }
      if (s.key !== key) {
        s.key = key;
        if (s.sheet) { s.sheet = SHEETS.get(key); s.body.setTexture(key + '-sheet', 0); s.body.anims.stop(); }
        else s.body.setTexture(key);
      }
      return s;
    }

    drawEntities(snap, time) {
      this.statusLayer.clear();
      const seen = new Set();
      const past = interpolated(snap);

      for (const p of snap.players) {
        const id = 'p:' + p.id;
        seen.add(id);
        const isMe = p.id === App.me;
        const pos = isMe && this.me ? this.me : past.get(id) || p;
        const s = this.spriteFor(id, `${p.heroClass}-${p.color}`, isMe ? p.name + ' (you)' : p.name, DC.data.COLORS[p.color]);
        const walking = this.moving(s, pos.x, pos.y, time);
        if (s.sheet) {
          s.body.setPosition(pos.x, pos.y + oldFoot(s.key)).setFlipX(Math.abs(p.aim) > Math.PI / 2).setScale(2);
          s.body.setAlpha(p.downed ? 0.6 : p.rolling ? 0.85 : 1).setAngle(0);
          const hurt = (this.flashUntil.get(id) || 0) > time;
          this.setAction(s, p.downed ? 'down' : p.rolling ? 'roll' : hurt ? 'hurt' : walking ? 'walk' : 'idle', time);
        } else {
          s.body.setPosition(pos.x, pos.y - 6).setFlipX(Math.abs(p.aim) > Math.PI / 2).setScale(1, 1);
          s.body.setAlpha(p.downed ? 0.35 : p.rolling ? 0.6 : 1).setAngle(p.downed ? 90 : 0);
        }
        if ((this.flashUntil.get(id) || 0) > time) s.body.setTintFill(0xff5a50);
        else if (p.burning) s.body.setTint(Math.floor(time / 120) % 2 ? 0xf2a541 : 0xffffff);
        else if (p.poisoned) s.body.setTint(Math.floor(time / 150) % 2 ? 0x9bd17a : 0xffffff);
        else s.body.clearTint();
        if (p.poisoned && Math.random() < 0.15) this.fx.burst(pos.x, pos.y - 10, 0x9bd17a, 1, 'rise');
        if (p.burning && Math.random() < 0.35) this.fx.burst(pos.x + (Math.random() - 0.5) * 16, pos.y - 4, 0xf2a541, 1, 'rise');
        if (p.rooted) {
          const g = this.statusLayer;
          g.lineStyle(3, 0x4f8a6a, 1);
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + time / 400;
            g.lineBetween(pos.x + Math.cos(a) * 18, pos.y + 14, pos.x + Math.cos(a + 0.6) * 8, pos.y - 6);
          }
        }
        if (p.rolling && time - (this.ghostAt.get(id) || 0) > 35) {
          this.ghostAt.set(id, time);
          this.fx.ghost(s.body, DC.data.COLORS[p.color] ? parseInt(DC.data.COLORS[p.color].slice(1), 16) : 0xffffff);
        }
        s.label.setPosition(pos.x, pos.y - 34);
        s.bar.clear();
        drawBar(s.bar, pos.x, pos.y - 32, p.hp / p.maxHp, 0xe5534b);
        if (p.downed) {
          s.bar.lineStyle(4, 0x5ec8b8, 1);
          s.bar.beginPath();
          s.bar.arc(pos.x, pos.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.revive);
          s.bar.strokePath();
        }
        if (p.swingAt && p.swingAt !== s.lastSwing) {
          s.lastSwing = p.swingAt;
          this.slashes.push({ x: pos.x, y: pos.y, aim: p.aim, life: 0.15 });
        }
      }

      for (const e of snap.enemies) {
        const id = 'e:' + e.id;
        seen.add(id);
        const pos = past.get(id) || e;
        const s = this.spriteFor(id, DC.sprites.enemyTexture(e.type));
        s.body.setVisible(e.state !== 'airborne' && e.state !== 'fly');
        if (e.type === 'dragon') {
          // its shadow on the ground; bigger and softer while it's in the sky
          const lifted = e.sky || e.state === 'fly';
          this.zoneLayer.fillStyle(0x000000, lifted ? 0.25 : 0.35).fillEllipse(pos.x, pos.y + 40, lifted ? 130 : 100, lifted ? 40 : 30);
        }
        let sx = 1;
        let sy = 1;
        let lift = 0;
        const walking = this.moving(s, pos.x, pos.y, time);
        const posed = s.sheet && s.sheet.anims[e.state] && e.state !== 'idle' && e.state !== 'walk';
        if (!posed) {
          if (e.state === 'squish') { sx = 1.25; sy = 0.7; }
          if (e.state === 'swell') { sx = 1.3; sy = 1.3; }
          if (e.type === 'seed' && !s.sheet) { const k = 1 + 0.12 * Math.sin(time / 150); sx = k; sy = k; }
          if (e.state === 'flap') { sx = 1.2 + 0.1 * Math.sin(time / 60); }
        }
        s.body.setAlpha(e.state === 'shimmer' ? 0.25 + 0.5 * Math.abs(Math.sin(time / 60)) : 1);
        if (e.state === 'leap') lift = 18;
        if (e.sky) { lift = 28 + 4 * Math.sin(time / 200); sx *= 1.1; sy *= 1.1; }
        const faceLeft = e.facing !== undefined ? Math.abs(e.facing) > Math.PI / 2 : !!s.faceLeft;
        if (s.sheet) {
          s.body.setPosition(pos.x, pos.y + oldFoot(s.key) - lift).setScale(2 * sx, 2 * sy).setFlipX(faceLeft);
          const hurt = (this.flashUntil.get(id) || 0) > time;
          this.setAction(s, posed ? e.state : hurt && s.sheet.anims.hurt ? 'hurt' : walking ? 'walk' : 'idle', time);
        } else {
          s.body.setPosition(pos.x, pos.y - lift).setScale(sx, sy);
          if (e.type === 'golem' || e.type === 'king' || e.type === 'dragon') s.body.setFlipX(Math.abs(e.facing) > Math.PI / 2);
          if (e.state === 'raise') { sx = 1.1; sy = 1.15; s.body.setScale(sx, sy); }
        }
        const tell = ['screech', 'squish', 'draw', 'swell', 'raise', 'ring', 'flap', 'tail'].includes(e.state) && Math.floor(time / 100) % 2 === 0;
        const hit = (this.flashUntil.get(id) || 0) > time;
        if (hit || tell) s.body.setTintFill(0xffffff);
        else if (e.state === 'swoop') s.body.setTint(0xf2a541);
        else if (e.state === 'storm') s.body.setTint(0x9bd17a);
        else if (e.state === 'ring') s.body.setTint(0xc77dff);
        else if (e.state === 'breathe') s.body.setTint(Math.floor(time / 80) % 2 ? 0xf2a541 : 0xffffff);
        else if (e.stunned) s.body.setTint(0xb8b0d0);
        else if (e.rage) s.body.setTint(Math.floor(time / 300) % 2 ? 0xff9a8a : 0xffffff);
        else s.body.clearTint();
        if (e.state === 'swoop' && time - (this.ghostAt.get(id) || 0) > 40) {
          this.ghostAt.set(id, time);
          this.fx.ghost(s.body, 0xf2a541);
        }
        this.drawStatus(e, pos, time);
        s.bar.clear();
        if (e.state !== 'airborne' && e.state !== 'fly' && e.type !== 'bones' && e.type !== 'seed') {
          const [off, width] = BIG[e.type] || [e.type === 'golem' ? 40 : 30, 36];
          drawBar(s.bar, pos.x, pos.y - off, e.hp / e.maxHp, 0xc76bd9, width);
        }
        if (e.type === 'bones' && e.rebuildAt) {
          // ring that fills up until the archer rebuilds itself
          const done = 1 - Math.max(0, Math.min(1, (e.rebuildAt - snap.t) / 5));
          s.bar.lineStyle(3, 0xe9e4d4, 0.9).beginPath();
          s.bar.arc(pos.x, pos.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done).strokePath();
        }
        if (e.type === 'seed' && e.growAt) {
          const done = 1 - Math.max(0, Math.min(1, (e.growAt - snap.t) / 10));
          s.bar.lineStyle(2, 0x5ec8b8, 0.9).beginPath();
          s.bar.arc(pos.x, pos.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done).strokePath();
        }
      }

      for (const [id, s] of this.sprites) {
        if (seen.has(id)) continue;
        if (s.sheet) this.gone.set(id, { x: s.body.x, y: s.body.y, flip: s.body.flipX, key: s.key, at: time });
        s.body.destroy();
        if (s.label) s.label.destroy();
        s.bar.destroy();
        this.sprites.delete(id);
      }
    }

    // Torches: unlit sticks, or flickering flames once someone lights them.
    drawTorches(snap, time) {
      const g = this.glowLayer;
      g.clear();
      let hint = null;
      for (const t of snap.room.torches) {
        g.fillStyle(0x5c3b1e).fillRect(t.x - 3, t.y - 8, 6, 22);
        if (t.lit) {
          const f = 1 + 0.15 * Math.sin(time / 70 + t.x);
          g.fillStyle(0xf2a541, 0.25).fillCircle(t.x, t.y - 12, 22 * f);
          g.fillStyle(0xf2a541).fillCircle(t.x, t.y - 12, 8 * f);
          g.fillStyle(0xfff1b8).fillCircle(t.x, t.y - 13, 4 * f);
        } else {
          g.fillStyle(0x3a3350).fillCircle(t.x, t.y - 12, 6);
          if (this.me && Math.hypot(this.me.x - t.x, this.me.y - t.y) < 70) hint = t;
        }
      }
      this.torchHint.setVisible(!!hint);
      if (hint) this.torchHint.setPosition(hint.x, hint.y - 34);
      // Warnings must be readable in the dark too.
      for (const z of snap.zones) {
        if (z.kind === 'safeCircle') g.lineStyle(4, 0xb8f0e4, 0.9).strokeCircle(z.x, z.y, z.r);
        if (z.kind === 'vineRing' || z.kind === 'rockShadow') g.lineStyle(2, 0xe5534b, 0.7).strokeCircle(z.x, z.y, z.r);
      }
      // The Queen's glowing spots show even in the dark.
      for (const e of snap.enemies) {
        if (e.type !== 'queen' || e.state === 'shimmer' || !snap.allDark) continue;
        for (const [dx, dy] of [[-14, -22], [10, -26], [0, -12], [-20, -6], [18, -8]]) {
          g.fillStyle(0x5ec8b8, 0.35).fillCircle(e.x + dx, e.y + dy, 7);
          g.fillStyle(0xb8f0e4).fillCircle(e.x + dx, e.y + dy, 3);
        }
      }
    }

    // Dark zones: you only see about 3 tiles around yourself, plus lit torches.
    drawDarkness(snap) {
      const g = this.darkLayer;
      g.clear();
      if (!snap.allDark && !snap.room.dark.length) return;
      const room = this.room;
      const lights = [];
      if (this.me) lights.push({ x: this.me.x, y: this.me.y, r: 144 });
      for (const t of snap.room.torches) if (t.lit) lights.push({ x: t.x, y: t.y, r: 192 });
      const inDark = (tx, ty) => snap.allDark || snap.room.dark.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1);
      for (let ty = 0; ty < room.h; ty++) {
        for (let tx = 0; tx < room.w; tx++) {
          if (!inDark(tx, ty)) continue;
          const cx = tx * TILE + TILE / 2;
          const cy = ty * TILE + TILE / 2;
          let shade = 0.94;
          for (const l of lights) {
            const d = Math.hypot(cx - l.x, cy - l.y);
            shade = Math.min(shade, 0.94 * Math.max(0, Math.min(1, (d - (l.r - 72)) / 72)));
          }
          if (shade > 0.01) g.fillStyle(0x05040a, shade).fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }

    drawShots(snap) {
      const g = this.shotLayer;
      g.clear();
      const alive = new Set();
      for (const pr of snap.projectiles) {
        alive.add(pr.id);
        const prev = this.lastShot.get(pr.id) || pr;
        const ang = Math.atan2(pr.y - prev.y, pr.x - prev.x);
        if (pr.kind === 'enemyArrow') {
          const cx = Math.cos(ang);
          const cy = Math.sin(ang);
          g.lineStyle(2, 0xe5534b, 0.35).lineBetween(pr.x - cx * 30, pr.y - cy * 30, pr.x, pr.y);
          g.lineStyle(3, 0xffb4a8, 1).lineBetween(pr.x - cx * 14, pr.y - cy * 14, pr.x + cx * 6, pr.y + cy * 6);
          g.fillStyle(0xe5534b).fillTriangle(pr.x + cx * 10, pr.y + cy * 10, pr.x - cy * 4, pr.y + cx * 4, pr.x + cy * 4, pr.y - cx * 4);
        } else if (pr.kind === 'arrow') {
          // a little arrow pointing where it flies, with a pale streak behind it
          const cx = Math.cos(ang);
          const cy = Math.sin(ang);
          g.lineStyle(2, 0xcfc8de, 0.35).lineBetween(pr.x - cx * 34, pr.y - cy * 34, pr.x, pr.y);
          g.lineStyle(3, 0xe9e4d4, 1).lineBetween(pr.x - cx * 14, pr.y - cy * 14, pr.x + cx * 6, pr.y + cy * 6);
          g.fillStyle(0xffffff).fillTriangle(pr.x + cx * 10, pr.y + cy * 10, pr.x - cy * 4, pr.y + cx * 4, pr.x + cy * 4, pr.y - cx * 4);
        } else if (pr.kind === 'rock') {
          g.fillStyle(0x000000, 0.25).fillEllipse(pr.x, pr.y + 8, 14, 6);
          g.fillStyle(0x7a6248).fillCircle(pr.x, pr.y, 8);
          g.fillStyle(0xa58a6a).fillCircle(pr.x - 2, pr.y - 2, 4);
          g.lineStyle(1, 0x3e2a19).strokeCircle(pr.x, pr.y, 8);
        } else if (pr.kind === 'boulder') {
          const spin = (this.time.now / 80) % (Math.PI * 2);
          g.fillStyle(0x000000, 0.3).fillEllipse(pr.x, pr.y + 18, 40, 12);
          g.fillStyle(0x6e5a44).fillCircle(pr.x, pr.y, 20);
          g.fillStyle(0x8c7356).fillCircle(pr.x - 5, pr.y - 6, 9);
          g.lineStyle(3, 0x3e2a19).strokeCircle(pr.x, pr.y, 20);
          g.lineStyle(2, 0x3e2a19, 0.8).lineBetween(pr.x, pr.y, pr.x + Math.cos(spin) * 18, pr.y + Math.sin(spin) * 18);
          if (Math.random() < 0.6) this.fx.burst(pr.x, pr.y + 14, 0x7a6248, 1, 'rubble', 'fx-square');
        } else if (pr.kind === 'turretShot') {
          g.fillStyle(0xf2c14e, 0.4).fillCircle(pr.x, pr.y, 8);
          g.fillStyle(0xfff1b8).fillCircle(pr.x, pr.y, 3.5);
        } else if (pr.kind === 'bolt') {
          g.fillStyle(0x6c9bf2, 0.35).fillCircle(pr.x, pr.y, 11);
          g.fillStyle(0xb8d0ff).fillCircle(pr.x, pr.y, 5);
          this.fx.burst(pr.x, pr.y, 0x6c9bf2, 1, 'trail');
        } else if (pr.kind === 'shadowBolt') {
          g.fillStyle(0x5b2a6e, 0.5).fillCircle(pr.x, pr.y, 13);
          g.fillStyle(0xc77dff).fillCircle(pr.x, pr.y, 7);
          g.fillStyle(0xf1dcff).fillCircle(pr.x, pr.y, 3);
          this.fx.burst(pr.x, pr.y, 0xc77dff, 1, 'trail');
        } else if (pr.kind === 'fireball') {
          g.fillStyle(0xe5622b, 0.4).fillCircle(pr.x, pr.y, 15);
          g.fillStyle(0xf2a541).fillCircle(pr.x, pr.y, 9);
          g.fillStyle(0xfff1b8).fillCircle(pr.x, pr.y, 4);
          this.fx.burst(pr.x, pr.y, 0xf2a541, 2, 'trail');
          this.fx.burst(pr.x, pr.y, 0xe5622b, 1, 'trail');
        }
        this.lastShot.set(pr.id, { x: pr.x, y: pr.y });
      }
      for (const id of this.lastShot.keys()) if (!alive.has(id)) this.lastShot.delete(id);
    }

    // Stun stars and "!" warnings above monsters.
    drawStatus(e, pos, time) {
      const g = this.statusLayer;
      const top = pos.y - (BIG[e.type] ? BIG[e.type][0] + 10 : e.type === 'golem' ? 48 : 38);
      if (e.stunned) {
        for (let i = 0; i < 3; i++) {
          const a = time / 180 + (i * Math.PI * 2) / 3;
          g.fillStyle(0xf2c14e).fillCircle(pos.x + Math.cos(a) * 14, top + Math.sin(a) * 4, 3);
        }
      }
      if (e.angry) {
        // angry (shot from far away): little red anger marks that pulse
        const k = 1 + 0.25 * Math.sin(time / 70);
        g.lineStyle(3, 0xe5534b, 1);
        g.lineBetween(pos.x + 12, top + 2, pos.x + 12 + 7 * k, top - 5 * k);
        g.lineBetween(pos.x + 16, top + 6, pos.x + 16 + 8 * k, top + 2);
        g.lineBetween(pos.x + 10, top - 4, pos.x + 12, top - 11 * k);
      }
      if (['squish', 'screech', 'draw', 'swell', 'storm', 'raise', 'ring', 'breathe', 'flap', 'tail'].includes(e.state)) {
        g.fillStyle(0xe5534b).fillRect(pos.x - 3, top - 18, 6, 12).fillRect(pos.x - 3, top - 3, 6, 5);
      }
    }

    // ---------- slashes and floating numbers ----------

    drawEffects(dt) {
      const g = this.fxLayer;
      g.clear();
      this.slashes = this.slashes.filter((s) => (s.life -= dt) > 0);
      for (const s of this.slashes) {
        g.lineStyle(5, 0xffffff, s.life / 0.15);
        g.beginPath();
        g.arc(s.x, s.y, 46, s.aim - 0.8, s.aim + 0.8);
        g.strokePath();
      }
      this.floaters = this.floaters.filter((f) => {
        f.life -= dt;
        f.text.setY(f.text.y - 30 * dt).setAlpha(Math.max(0, f.life / 0.8));
        if (f.life <= 0) { f.text.destroy(); return false; }
        return true;
      });
    }

    floatText(x, y, text, color) {
      const t = this.add.text(x, y, text, { fontFamily: 'Pixelify Sans, monospace', fontSize: '20px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(8);
      this.floaters.push({ text: t, life: 0.8 });
    }

    // How each hero skill looks when it's used.
    castEffect(ev, snap) {
      const fx = this.fx;
      const color = (() => {
        const p = snap.players.find((q) => q.id === ev.by);
        return p ? parseInt(DC.data.COLORS[p.color].slice(1), 16) : 0xffffff;
      })();
      if (ev.skill === 'bash') {
        fx.ring(ev.x, ev.y, { from: 20, to: 100, life: 0.25, color: 0xb8d0ff, width: 10, arc: { aim: ev.aim, spread: 1.05 } });
        fx.ring(ev.x, ev.y, { from: 10, to: 80, life: 0.25, color: 0xffffff, width: 5, arc: { aim: ev.aim, spread: 0.9 }, delay: 0.05 });
        fx.burst(ev.x + Math.cos(ev.aim) * 50, ev.y + Math.sin(ev.aim) * 50, 0xb8d0ff, 14, 'spark', 'fx-square');
        fx.shake(110, 0.006);
      } else if (ev.skill === 'taunt') {
        for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, { from: 20, to: 240, life: 0.6, color: 0xf2a541, width: 6, delay: i * 0.12 });
        fx.burst(ev.x, ev.y, 0xf2a541, 16, 'burst');
        for (const e of snap.enemies) {
          if (Math.hypot(e.x - ev.x, e.y - ev.y) <= 240) this.floatText(e.x, e.y - 44, '!', '#F2A541');
        }
      } else if (ev.skill === 'arrowRain') {
        const tx = ev.x + Math.cos(ev.aim) * 360;
        const ty = ev.y + Math.sin(ev.aim) * 360;
        fx.ring(tx, ty, { from: 96, to: 20, life: 0.3, color: 0x5ec8b8, width: 4 });
        fx.burst(ev.x, ev.y, 0x5ec8b8, 8, 'rise');
      } else if (ev.skill === 'roll') {
        fx.burst(ev.x, ev.y, 0xcfc8de, 10, 'smoke');
      } else if (ev.skill === 'fireball') {
        fx.burst(ev.x + Math.cos(ev.aim) * 24, ev.y + Math.sin(ev.aim) * 24, 0xf2a541, 14, 'flame');
      } else if (ev.skill === 'boulder') {
        fx.burst(ev.x, ev.y, 0x7a6248, 10, 'rubble', 'fx-square');
        fx.shake(80, 0.004);
      } else if (ev.skill === 'quake') {
        fx.ring(ev.x, ev.y, { from: 10, to: 104, life: 0.4, color: 0xa58a6a, width: 10, fill: 0.18 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          fx.burst(ev.x + Math.cos(a) * 70, ev.y + Math.sin(a) * 70, 0x7a6248, 4, 'rubble', 'fx-square');
        }
        fx.burst(ev.x, ev.y, 0x5a5066, 14, 'smoke');
        fx.shake(220, 0.01);
      } else if (ev.skill === 'turret' || ev.skill === 'mine') {
        fx.burst(ev.x, ev.y, 0xf2c14e, 12, 'spark');
        fx.ring(ev.x, ev.y, { from: 6, to: 40, life: 0.3, color: 0xcfc8de, width: 3 });
      } else if (ev.skill === 'heal') {
        fx.ring(ev.x, ev.y, { from: 10, to: 96, life: 0.5, color: 0x7ee8c8, width: 6, fill: 0.2 });
        fx.burst(ev.x, ev.y, 0x7ee8c8, 20, 'rise', 'fx-plus');
      }
      if (color && ev.skill !== 'heal' && ev.skill !== 'taunt') fx.burst(ev.x, ev.y, color, 4, 'spark');
    }

    // A monster that just died plays its death animation where it fell, then fades.
    deathBody(ev) {
      const id = 'e:' + ev.enemyId;
      const last = this.gone.get(id) || this.sprites.get(id) && { x: this.sprites.get(id).body.x, y: this.sprites.get(id).body.y, flip: this.sprites.get(id).body.flipX, key: this.sprites.get(id).key };
      const key = last ? last.key : DC.sheets.enemySheet(ev.enemyType);
      const sheet = SHEETS.get(key);
      this.gone.delete(id);
      if (!sheet || !sheet.anims.death) return;
      const x = last ? last.x : ev.x, y = last ? last.y : ev.y + oldFoot(key);
      const body = this.add.sprite(x, y, key + '-sheet', sheet.anims.death.start)
        .setOrigin(sheet.foot[0] / sheet.size, sheet.foot[1] / sheet.size).setScale(2).setDepth(2).setFlipX(!!(last && last.flip));
      body.play(DC.sheets.animKey(key, 'death'));
      this.corpses.push(body);
      const d = sheet.anims.death;
      this.tweens.add({ targets: body, alpha: 0, delay: (d.count / d.fps) * 1000 + 250, duration: 400,
        onComplete: () => { body.destroy(); this.corpses = this.corpses.filter((c) => c !== body); } });
    }

    onEvent(ev, snap) {
      const fx = this.fx;
      const now = this.time.now;
      const playerAt = (id) => snap.players.find((q) => q.id === id);
      if (ev.type === 'damage') {
        if (ev.enemyId) {
          this.floatText(ev.x, ev.y - 20, String(ev.amount), ev.armored ? '#9A93AD' : '#FFFFFF');
          if (ev.armored) fx.burst(ev.x, ev.y, 0x8c84a3, 4, 'rubble', 'fx-square');
          this.flashUntil.set('e:' + ev.enemyId, now + 90);
          fx.burst(ev.x, ev.y, 0xfff1b8, 6, 'spark', 'fx-square');
        } else {
          const p = playerAt(ev.targetId);
          if (p) {
            this.floatText(p.x, p.y - 40, '-' + ev.amount, '#FF8A80');
            this.flashUntil.set('p:' + p.id, now + 120);
            fx.burst(p.x, p.y, 0xe5534b, 8, 'spark', 'fx-square');
          }
          if (ev.targetId === App.me) {
            fx.shake(120, 0.004);
            Hud.hurt();
          }
        }
      } else if (ev.type === 'cast') {
        const skills = SKILL_SOUND[playerAt(ev.by)?.heroClass] || [];
        const action = skills[0] === ev.skill ? 'q' : skills[1] === ev.skill ? 'space' : null;
        if (action) this.startAction('p:' + ev.by, action, now);
        this.castEffect(ev, snap);
      } else if (ev.type === 'attack') {
        this.startAction('p:' + ev.by, 'attack', now);
      } else if (ev.type === 'explode') {
        fx.ring(ev.x, ev.y, { from: 10, to: ev.r + 10, life: 0.35, color: 0xf2a541, width: 8, fill: 0.35 });
        fx.burst(ev.x, ev.y, 0xf2a541, 26, 'flame');
        fx.burst(ev.x, ev.y, 0xe5622b, 14, 'flame');
        fx.burst(ev.x, ev.y, 0x5a5066, 10, 'smoke');
        fx.shake(160, 0.007);
      } else if (ev.type === 'heal') {
        const p = playerAt(ev.targetId);
        if (p) {
          this.floatText(p.x + 14, p.y - 44, '+' + ev.amount, '#7EE8C8');
          fx.burst(p.x, p.y, 0x7ee8c8, 6, 'rise', 'fx-plus');
        }
      } else if (ev.type === 'land') {
        fx.ring(ev.x, ev.y, { from: 8, to: ev.r + 30, life: 0.3, color: 0xc76bd9, width: 6, fill: 0.25 });
        fx.burst(ev.x, ev.y, 0xc76bd9, 14, 'drip');
      } else if (ev.type === 'bite') {
        fx.clawMarks(ev.x, ev.y);
      } else if (ev.type === 'screech') {
        for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, { from: 10, to: ev.r, life: 0.45, color: 0xb9a6e8, width: 4, delay: i * 0.08 });
        fx.burst(ev.x, ev.y, 0xb9a6e8, 10, 'spark');
      } else if (ev.type === 'rage') {
        fx.ring(ev.x, ev.y, { from: 30, to: 260, life: 0.6, color: 0xe5534b, width: 10, fill: 0.15 });
        fx.burst(ev.x, ev.y, 0xf2a541, 30, 'flame');
        fx.shake(500, 0.012);
        this.floatText(ev.x, ev.y - 110, 'ASHMAW IS ENRAGED!', '#FF8A80');
      } else if (ev.type === 'kill') {
        this.deathBody(ev);
        const color = Effects.MONSTER_COLORS[ev.enemyType] || 0xffffff;
        const big = !!BIG[ev.enemyType];
        fx.burst(ev.x, ev.y, color, big ? 40 : 16, 'drip');
        fx.burst(ev.x, ev.y, 0xffffff, big ? 16 : 6, 'spark');
        fx.burst(ev.x, ev.y, 0x5a5066, big ? 10 : 4, 'smoke');
        if (big) fx.shake(250, 0.01);
      } else if (ev.type === 'flop') {
        fx.ring(ev.x, ev.y, { from: 20, to: 110, life: 0.45, color: 0xffffff, width: 8, fill: 0.2 });
        fx.ring(ev.x, ev.y, { from: 10, to: 80, life: 0.4, color: 0xa94fc0, width: 6, delay: 0.06 });
        fx.burst(ev.x, ev.y, 0xa94fc0, 30, 'drip');
        fx.burst(ev.x, ev.y, 0x7a6248, 16, 'rubble', 'fx-square');
        fx.shake(320, 0.014);
      } else if (ev.type === 'brood') {
        const m = snap.enemies.find((e) => e.id === ev.enemyId);
        if (m) fx.burst(m.x, m.y - 20, 0xc76bd9, 18, 'drip');
      } else if (ev.type === 'spike') {
        fx.burst(ev.x, ev.y, 0xe9e4d4, 8, 'spark', 'fx-square');
      } else if (ev.type === 'rockfall') {
        fx.burst(ev.x, ev.y, 0x8c84a3, 18, 'rubble', 'fx-square');
        fx.burst(ev.x, ev.y, 0x5a5066, 8, 'smoke');
        fx.ring(ev.x, ev.y, { from: 6, to: 44, life: 0.3, color: 0xcfc8de, width: 4 });
        fx.shake(120, 0.005);
      } else if (ev.type === 'bonesBroken') {
        fx.burst(ev.x, ev.y, 0xe9e4d4, 20, 'rubble', 'fx-square');
        this.floatText(ev.x, ev.y - 30, 'Crushed!', '#E9E4D4');
      } else if (ev.type === 'rebuild') {
        fx.ring(ev.x, ev.y, { from: 30, to: 6, life: 0.4, color: 0xe9e4d4, width: 4 });
        this.floatText(ev.x, ev.y - 40, 'Rebuilt!', '#FF8A80');
      } else if (ev.type === 'torchlit') {
        fx.burst(ev.x, ev.y - 10, 0xf2a541, 18, 'flame');
        fx.ring(ev.x, ev.y, { from: 10, to: 120, life: 0.6, color: 0xf2c14e, width: 3 });
      } else if (ev.type === 'darkness') {
        Hud.banner('The lights go out!', 2200);
        fx.shake(300, 0.01);
      } else if (ev.type === 'puff') {
        fx.burst(ev.x, ev.y, 0x9bd17a, 24, 'smoke');
      } else if (ev.type === 'seed') {
        fx.burst(ev.x, ev.y, 0x5ec8b8, 8, 'spark');
      } else if (ev.type === 'sprout') {
        fx.burst(ev.x, ev.y, 0x9bd17a, 14, 'rise');
      } else if (ev.type === 'volley') {
        fx.burst(ev.x, ev.y, 0xffb4a8, 6, 'spark', 'fx-square');
      } else if (ev.type === 'teleport') {
        fx.burst(ev.x, ev.y, 0x8e4fb8, 30, 'burst');
        fx.ring(ev.x, ev.y, { from: 60, to: 10, life: 0.4, color: 0x8e4fb8, width: 6 });
      } else if (ev.type === 'stormwarn') {
        Hud.banner('Get in a glowing circle!', 1800);
      } else if (ev.type === 'storm') {
        for (const p of snap.players) fx.burst(p.x, p.y, 0x9bd17a, 12, 'smoke');
        fx.shake(250, 0.01);
      } else if (ev.type === 'rooted') {
        fx.burst(ev.x, ev.y, 0x4f8a6a, 14, 'rubble', 'fx-square');
      } else if (ev.type === 'guard') {
        fx.burst(ev.x, ev.y, 0x9bd17a, 20, 'rise');
      } else if (ev.type === 'erupt') {
        fx.burst(ev.x, ev.y - 20, 0xf2a541, 24, 'flame');
        fx.burst(ev.x, ev.y, 0xe5622b, 12, 'drip');
        fx.ring(ev.x, ev.y, { from: 10, to: 46, life: 0.3, color: 0xf2a541, width: 5 });
        fx.shake(90, 0.003);
      } else if (ev.type === 'jetfire') {
        fx.burst(ev.x + ev.dx * TILE / 2, ev.y + ev.dy * TILE / 2, 0xf2a541, 12, 'flame');
      } else if (ev.type === 'lavafall') {
        const p = playerAt(ev.targetId);
        if (p) {
          fx.burst(p.x, p.y, 0xf2a541, 20, 'flame');
          this.floatText(p.x, p.y - 40, 'Lava!', '#F2A541');
        }
      } else if (ev.type === 'slam') {
        fx.ring(ev.x, ev.y, { from: 10, to: ev.r, life: 0.35, color: 0xcfc8de, width: 8, fill: 0.2 });
        fx.burst(ev.x, ev.y, 0x8c84a3, 26, 'rubble', 'fx-square');
        fx.burst(ev.x, ev.y, 0x5a5066, 10, 'smoke');
        fx.shake(220, 0.01);
      } else if (ev.type === 'sweep') {
        fx.ring(ev.x, ev.y, { from: 30, to: 120, life: 0.3, color: 0xc77dff, width: 12, arc: { aim: ev.aim, spread: 1.25 } });
        fx.ring(ev.x, ev.y, { from: 20, to: 100, life: 0.3, color: 0xffffff, width: 5, arc: { aim: ev.aim, spread: 1.1 }, delay: 0.04 });
        fx.shake(150, 0.007);
      } else if (ev.type === 'court') {
        for (const c of ev.at || []) {
          fx.ring(c.x, c.y, { from: 40, to: 6, life: 0.4, color: 0xc77dff, width: 4 });
          fx.burst(c.x, c.y, 0xc76bd9, 14, 'drip');
        }
        Hud.banner('The King calls his court!', 1600);
      } else if (ev.type === 'crownflare') {
        fx.burst(ev.x, ev.y - 50, 0xf2c14e, 40, 'burst');
        fx.ring(ev.x, ev.y, { from: 20, to: 200, life: 0.6, color: 0xc77dff, width: 8 });
        fx.shake(350, 0.012);
        Hud.banner("The King's crown flares!", 2200);
      } else if (ev.type === 'ringwarn') {
        fx.ring(ev.x, ev.y, { from: 90, to: 30, life: 1.5, color: 0xc77dff, width: 4 });
      } else if (ev.type === 'shadowring') {
        fx.ring(ev.x, ev.y, { from: 20, to: 150, life: 0.4, color: 0xc77dff, width: 6 });
        fx.burst(ev.x, ev.y, 0xc77dff, 24, 'burst');
      } else if (ev.type === 'turretfire') {
        fx.burst(ev.x + Math.cos(ev.aim) * 14, ev.y - 10 + Math.sin(ev.aim) * 14, 0xf2c14e, 3, 'spark');
      } else if (ev.type === 'mineboom') {
        fx.ring(ev.x, ev.y, { from: 10, to: ev.r + 10, life: 0.35, color: 0xf2a541, width: 8, fill: 0.35 });
        fx.burst(ev.x, ev.y, 0xf2a541, 22, 'flame');
        fx.burst(ev.x, ev.y, 0x5a5066, 10, 'smoke');
        fx.shake(200, 0.01);
      } else if (ev.type === 'breath') {
        for (let i = 0; i < 10; i++) {
          const a = ev.aim + (Math.random() - 0.5) * 1.1;
          const d = 40 + Math.random() * (ev.r - 40);
          fx.burst(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d, i % 2 ? 0xf2a541 : 0xe5622b, 5, 'flame');
        }
        fx.shake(250, 0.01);
      } else if (ev.type === 'flapwarn') {
        Hud.banner('Ashmaw spreads its wings!', 1000);
      } else if (ev.type === 'gust') {
        for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, { from: 40, to: 260, life: 0.5, color: 0xe9e4d4, width: 5, delay: i * 0.08 });
        fx.burst(ev.x, ev.y, 0xcfc8de, 24, 'smoke');
        fx.shake(200, 0.008);
      } else if (ev.type === 'tail') {
        fx.ring(ev.x, ev.y, { from: 30, to: 120, life: 0.3, color: 0xe5622b, width: 10, arc: { aim: ev.aim, spread: 1.6 } });
        fx.shake(150, 0.007);
      } else if (ev.type === 'meteorwarn') {
        Hud.banner('Meteors! Get out of the red circles!', 1400);
      } else if (ev.type === 'meteor') {
        for (const m of ev.marks || []) {
          fx.ring(m.x, m.y, { from: 10, to: 60, life: 0.35, color: 0xf2a541, width: 8, fill: 0.3 });
          fx.burst(m.x, m.y, 0xf2a541, 18, 'flame');
          fx.burst(m.x, m.y, 0x5a5066, 6, 'smoke');
        }
        fx.shake(300, 0.012);
      } else if (ev.type === 'takeoff') {
        fx.burst(ev.x, ev.y, 0xcfc8de, 30, 'smoke');
        Hud.banner('Ashmaw takes to the sky! Only ranged attacks reach it.', 2400);
      } else if (ev.type === 'landed') {
        fx.ring(ev.x, ev.y, { from: 20, to: 140, life: 0.4, color: 0xe9e4d4, width: 8 });
        fx.burst(ev.x, ev.y, 0x7a6248, 24, 'rubble', 'fx-square');
        fx.shake(300, 0.012);
        Hud.banner('Ashmaw is stunned! Attack now!', 2000);
      } else if (ev.type === 'roostcrumble') {
        Hud.banner('The Roost is crumbling!', 2200);
      } else if (ev.type === 'ringfall') {
        fx.shake(300, 0.01);
      } else if (ev.type === 'outofreach') {
        if (!this.lastReach || this.time.now - this.lastReach > 600) {
          this.lastReach = this.time.now;
          this.floatText(ev.x, ev.y - 70, 'Out of reach!', '#CFC8DE');
        }
      } else if (ev.type === 'crumble') {
        fx.burst(ev.x, ev.y, 0x7a6248, 18, 'rubble', 'fx-square');
        fx.burst(ev.x, ev.y, 0x5a5066, 6, 'smoke');
      }
      if (ev.type === 'split') {
        fx.burst(ev.x, ev.y, 0xa94fc0, 50, 'drip');
        fx.ring(ev.x, ev.y, { from: 20, to: 140, life: 0.5, color: 0xe3a6ee, width: 8 });
        fx.shake(300, 0.012);
      } else if (ev.type === 'levelup') {
        const p = playerAt(ev.targetId);
        if (p) {
          fx.ring(p.x, p.y, { from: 10, to: 70, life: 0.6, color: 0xf2c14e, width: 5 });
          fx.burst(p.x, p.y, 0xf2c14e, 24, 'rise');
        }
      } else if (ev.type === 'revived') {
        const p = playerAt(ev.targetId);
        if (p) {
          fx.ring(p.x, p.y, { from: 10, to: 60, life: 0.5, color: 0x5ec8b8, width: 5 });
          fx.burst(p.x, p.y, 0x5ec8b8, 18, 'rise');
        }
      } else if (ev.type === 'fall') {
        const p = playerAt(ev.targetId);
        if (p) fx.burst(p.x, p.y, 0x5a5066, 10, 'smoke');
      } else if (ev.type === 'roomclear') this.roomCleared(ev, snap);
      else if (ev.type === 'floorresults') Results.show(ev.results);
      else if (ev.type === 'levelup' && ev.targetId === App.me) Hud.banner(`Level up! Level ${ev.level}`);
      else if (ev.type === 'split') Hud.banner('She split in two!');
      else if (ev.type === 'resumed') Hud.banner(`Resumed by ${ev.by}`, 1200);
      else if (ev.type === 'fall') {
        const p = snap.players.find((q) => q.id === ev.targetId);
        if (p) this.floatText(p.x, p.y - 40, 'Fell!', '#FF8A80');
      } else if (ev.type === 'revived') {
        const p = snap.players.find((q) => q.id === ev.targetId);
        if (p) this.floatText(p.x, p.y - 40, 'Revived!', '#5EC8B8');
      }
    }
  }

  // ---------- tile art ----------
  // Every trap is drawn on top of the same dungeon floor so it blends in.
  // `hash` gives each tile its own small variation (stable, not random each frame).
  function hash(tx, ty) {
    let h = (tx * 73856093) ^ (ty * 19349663);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  const FLOOR_SHADES = [0x2a2438, 0x2b2539, 0x29233a, 0x2c263b];

  function drawFloor(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const r = hash(tx, ty);
    g.fillStyle(FLOOR_SHADES[Math.floor(r * FLOOR_SHADES.length)]).fillRect(x, y, TILE, TILE);
    g.lineStyle(1, 0x241f30).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    if (r < 0.18) g.fillStyle(0x332c45).fillCircle(x + 10 + r * 120, y + 34 - r * 60, 2).fillCircle(x + 16 + r * 100, y + 38 - r * 50, 1.5);
    else if (r > 0.9) {
      g.lineStyle(1, 0x221d2e);
      g.beginPath(); g.moveTo(x + 8, y + 30); g.lineTo(x + 18, y + 26); g.lineTo(x + 24, y + 32); g.strokePath();
    }
  }

  function drawWall(g, x, y, tx, ty) {
    g.fillStyle(0x3d3452).fillRect(x, y, TILE, TILE);
    g.fillStyle(0x4a4063).fillRect(x, y, TILE, 6);
    g.lineStyle(1, 0x332b45).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    // bricks
    g.lineStyle(1, 0x342c47);
    g.lineBetween(x, y + 24, x + TILE, y + 24);
    const off = (tx + ty) % 2 ? 16 : 32;
    g.lineBetween(x + off, y + 6, x + off, y + 24);
    g.lineBetween(x + (off + 24) % TILE, y + 24, x + (off + 24) % TILE, y + TILE);
  }

  function drawDoor(g, x, y, open) {
    if (open) {
      g.fillStyle(0x2a2438).fillRect(x, y, TILE, TILE);
      g.fillStyle(0xf2a541, 0.35).fillRect(x, y, TILE, TILE);
    } else {
      g.fillStyle(0x1e1a2a).fillRect(x, y, TILE, TILE);
      g.fillStyle(0x8c84a3);
      for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 11, y, 5, TILE);
    }
  }

  // A stone column. It fills its whole tile, the same space it blocks.
  function drawPillar(g, x, y, pillarBelow) {
    if (!pillarBelow) g.fillStyle(0x000000, 0.35).fillRect(x + 2, y + TILE, TILE - 4, 8);
    g.fillStyle(0x3d3452).fillRect(x + 2, y + 12, TILE - 4, TILE - 12);
    g.fillStyle(0x5a4f78).fillRect(x + 2, y + 2, TILE - 4, 12);
    g.fillStyle(0x6e618f).fillRect(x + 4, y + 3, TILE - 8, 2);
    g.lineStyle(1, 0x342c47).lineBetween(x + 2, y + 30, x + TILE - 2, y + 30);
    g.lineBetween(x + 24, y + 14, x + 24, y + 30);
    g.lineStyle(2, 0x1b1725).strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  }

  // A hole in the floor, with a visible far wall and rims that match the floor.
  function drawPit(g, tx, ty, at) {
    const x = tx * TILE;
    const y = ty * TILE;
    const open = (dx, dy) => at(tx + dx, ty + dy) !== 'p';
    g.fillStyle(0x07060b).fillRect(x, y, TILE, TILE);
    if (open(0, -1)) {
      g.fillStyle(0x221d30).fillRect(x, y, TILE, 12);
      g.fillStyle(0x151220).fillRect(x, y + 12, TILE, 8);
      g.fillStyle(0x3a3350).fillRect(x, y, TILE, 2);
    }
    g.fillStyle(0x3a3350);
    if (open(-1, 0)) g.fillRect(x, y, 3, TILE);
    if (open(1, 0)) g.fillRect(x + TILE - 3, y, 3, TILE);
    if (open(0, 1)) g.fillRect(x, y + TILE - 3, TILE, 3);
  }

  // Puddles and poison pools: one smooth pool across neighbouring tiles.
  function drawPool(g, tx, ty, at, me, color, shine) {
    const x = tx * TILE;
    const y = ty * TILE;
    const same = (dx, dy) => at(tx + dx, ty + dy) === me;
    const inset = 5;
    const l = same(-1, 0) ? 0 : inset;
    const r = same(1, 0) ? 0 : inset;
    const t = same(0, -1) ? 0 : inset;
    const b = same(0, 1) ? 0 : inset;
    const round = (a, c) => (a && c ? 14 : 0.01);
    g.fillStyle(color).fillRoundedRect(x + l, y + t, TILE - l - r, TILE - t - b, {
      tl: round(!same(-1, 0), !same(0, -1)), tr: round(!same(1, 0), !same(0, -1)),
      bl: round(!same(-1, 0), !same(0, 1)), br: round(!same(1, 0), !same(0, 1))
    });
    const h = hash(tx, ty);
    if (me === 'u') {
      g.lineStyle(2, shine, 0.55);
      g.lineBetween(x + 10 + h * 12, y + 16 + h * 10, x + 22 + h * 12, y + 16 + h * 10);
      g.lineBetween(x + 20 - h * 8, y + 32 - h * 6, x + 28 - h * 8, y + 32 - h * 6);
    } else {
      g.fillStyle(shine, 0.7).fillCircle(x + 12 + h * 20, y + 14 + h * 14, 4).fillCircle(x + 30 - h * 10, y + 32 - h * 8, 3);
      g.fillStyle(shine, 0.4).fillCircle(x + 22, y + 24 + h * 8, 2);
    }
  }

  // Cracked floor: the same floor with cracks, so it's a warning, not a block.
  function drawCracked(g, tx, ty, cracking) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = hash(tx, ty);
    g.fillStyle(0x6b5640, 0.22).fillRect(x, y, TILE, TILE);
    if (cracking) g.fillStyle(0xf2a541, 0.22).fillRect(x, y, TILE, TILE);
    g.lineStyle(2, cracking ? 0xf2a541 : 0x16121e);
    const cx = x + 18 + h * 12;
    const cy = y + 18 + h * 12;
    g.beginPath();
    g.moveTo(cx, cy); g.lineTo(x + 4, y + 8 + h * 20);
    g.moveTo(cx, cy); g.lineTo(x + 40 - h * 10, y + 4);
    g.moveTo(cx, cy); g.lineTo(x + 30 + h * 10, y + 44);
    g.moveTo(cx + 6, cy + 8); g.lineTo(x + 44, y + 30 - h * 10);
    g.strokePath();
  }

  // A metal trap plate. Holes glow orange just before the spikes come up.
  function drawSpikes(g, x, y, state) {
    g.fillStyle(0x211c2e).fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    g.lineStyle(2, 0x3a3350).strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
    g.fillStyle(0x4a4063);
    for (const [bx, by] of [[8, 8], [40, 8], [8, 40], [40, 40]]) g.fillCircle(x + bx, y + by, 1.5);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cx = x + 14 + i * 10;
        const cy = y + 14 + j * 10;
        if (state === 'up') {
          g.fillStyle(0xcfc8de).fillTriangle(cx - 4, cy + 4, cx + 4, cy + 4, cx, cy - 7);
          g.fillStyle(0x8c84a3).fillTriangle(cx - 4, cy + 4, cx, cy + 4, cx, cy - 7);
        } else if (state === 'rattle') {
          g.fillStyle(0xf2a541).fillCircle(cx, cy, 3);
        } else {
          g.fillStyle(0x0d0b12).fillCircle(cx, cy, 2.5);
        }
      }
    }
  }

  // Lava: a dark red pool with slowly moving bright cracks, and a crust where
  // it meets solid ground.
  function drawLava(g, tx, ty, time, isLava) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = hash(tx, ty);
    g.fillStyle(0x5a1a12).fillRect(x, y, TILE, TILE);
    const k = 0.5 + 0.5 * Math.sin(time / 500 + h * 12);
    g.fillStyle(0xb8381e, 0.7).fillCircle(x + 12 + h * 20, y + 14 + k * 8, 10);
    g.fillStyle(0xe5622b, 0.5 + 0.4 * k).fillCircle(x + 32 - h * 10, y + 32 - k * 6, 7);
    g.fillStyle(0xf2a541, 0.35 + 0.4 * (1 - k)).fillCircle(x + 20 + h * 8, y + 30, 3);
    g.lineStyle(2, 0xe5622b, 0.5 + 0.3 * k);
    g.lineBetween(x + 4, y + 20 + h * 10, x + 22, y + 26 - k * 4);
    g.lineBetween(x + 26, y + 10 + k * 4, x + 44, y + 16 + h * 8);
    g.fillStyle(0x2a1410);
    if (!isLava(tx, ty - 1)) g.fillRect(x, y, TILE, 4);
    if (!isLava(tx, ty + 1)) g.fillRect(x, y + TILE - 4, TILE, 4);
    if (!isLava(tx - 1, ty)) g.fillRect(x, y, 4, TILE);
    if (!isLava(tx + 1, ty)) g.fillRect(x + TILE - 4, y, 4, TILE);
  }

  // A geyser vent: a scorched hole in the floor.
  function drawVent(g, x, y) {
    g.fillStyle(0x1f1812, 0.9).fillCircle(x + 24, y + 24, 17);
    g.lineStyle(3, 0x3a3350).strokeCircle(x + 24, y + 24, 17);
    g.fillStyle(0x3a120c).fillCircle(x + 24, y + 24, 10);
    g.fillStyle(0xb8381e, 0.6).fillCircle(x + 24, y + 24, 4);
  }

  // A flame-jet nozzle set into the wall, its mouth facing into the room.
  function drawNozzle(g, x, y, tx, ty, room) {
    const horiz = tx === 0 || tx === room.w - 1;
    g.fillStyle(0x5e5670).fillRect(horiz ? x + 8 : x + 10, horiz ? y + 10 : y + 8, horiz ? 32 : 28, horiz ? 28 : 32);
    g.fillStyle(0x15121e).fillRect(horiz ? x + 14 : x + 16, horiz ? y + 16 : y + 14, horiz ? 20 : 16, horiz ? 16 : 20);
    g.fillStyle(0x8c84a3);
    for (const [bx, by] of [[12, 12], [36, 12], [12, 36], [36, 36]]) g.fillCircle(x + bx, y + by, 1.5);
  }

  // A stone platform of the Roost: slabs with dark seams.
  function drawPlatform(g, x, y, tx, ty) {
    g.fillStyle(0x3a3046, 0.6).fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    g.lineStyle(1, 0x1b1725).strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    g.fillStyle(0x4a4063, 0.6).fillRect(x + 2, y + 2, TILE - 4, 3);
    if (hash(tx, ty) > 0.6) g.lineStyle(1, 0x1b1725).lineBetween(x + 10, y + 20, x + 22, y + 30);
  }

  // ---------- sound for each thing that happens ----------
  const ATTACK_SOUND = { knight: 'swing', archer: 'arrow', mage: 'bolt', warden: 'rock', engineer: 'wrench' };
  const SKILL_SOUND = { knight: ['bash', 'taunt'], archer: ['arrowRain', 'roll'], mage: ['fireball', 'heal'], warden: ['boulder', 'quake'], engineer: ['turret', 'mine'] };
  const EVENT_SOUND = {
    split: 'slimeSplit', brood: 'slimeSplit', screech: 'batScreech', bite: 'hit',
    spike: 'spike', fall: 'fall', rockfall: 'crumble', crumble: 'crumble', ringfall: 'crumble',
    erupt: 'geyser', jetfire: 'jet', lavafall: 'lava', bridgemove: 'bridge',
    slam: 'slam', land: 'slam', flop: 'slam', landed: 'slam', sweep: 'sweep', tail: 'sweep',
    breath: 'breath', gust: 'gust', meteor: 'meteor', takeoff: 'roar', roostcrumble: 'roar',
    crownflare: 'roar', rage: 'roar', court: 'shadow', shadowring: 'shadow', teleport: 'shadow', darkness: 'shadow',
    storm: 'puff', puff: 'puff', seed: 'puff', sprout: 'puff', explode: 'fireball', volley: 'arrow',
    rebuild: 'bones', bonesBroken: 'bones', outofreach: 'click', torchlit: 'fireball', shoptimeup: 'timeup',
    turretfire: 'turretShot', mineboom: 'mineBoom'
  };
  function playSound(ev) {
    if (!window.Sound) return;
    const me = App.me;
    let name = EVENT_SOUND[ev.type];
    // My own attacks and skills already played the instant I pressed (see localSounds).
    if ((ev.type === 'attack' || ev.type === 'cast') && ev.by === me) return;
    if (ev.type === 'attack') { Sound.play(ATTACK_SOUND[ev.kind], { vol: 0.6 }); return; }
    if (ev.type === 'cast') { Sound.play(ev.skill, { vol: 0.75 }); return; }
    else if (ev.type === 'damage') name = ev.enemyId !== undefined ? 'hit' : ev.targetId === me ? 'hurt' : null;
    else if (ev.type === 'kill') {
      const m = DC.data.MONSTERS[ev.enemyType];
      name = m && m.boss ? 'bossKill' : 'kill';
      if (!ev.noReward) Sound.play('coin');
    } else if (ev.type === 'levelup') name = ev.targetId === me ? 'levelup' : null;
    else if (ev.type === 'downed') name = 'downed';
    else if (ev.type === 'revived') name = 'revive';
    else if (ev.type === 'transition' && ev.kind === 'boss') name = 'roar';
    if (name) Sound.play(name);
  }

  // Play my attack/skill sound the moment I press, if the server will allow it
  // (same cooldowns and mana it uses). The server's echo of it is skipped.
  const localNext = { attack: 0, q: 0, space: 0 };
  const lastLeft = { attack: 0, q: 0, space: 0 };
  const lastPlayed = { attack: -1e9, q: -1e9, space: -1e9 };
  function localSounds(input, snap) {
    if (!window.Sound || !snap) return;
    const me = snap.players.find((p) => p.id === App.me);
    if (!me || me.downed || snap.paused || snap.transition) return;
    const hero = DC.data.HEROES[me.heroClass];
    const now = performance.now();
    const act = (key) => { if (scene) scene.startAction('p:' + App.me, key); };
    const tryPlay = (key, skill, name) => {
      const serverLeft = me.cd ? me.cd[key] : 0;
      const prev = lastLeft[key];
      lastLeft[key] = serverLeft;
      if (serverLeft > prev + 0.2) {
        // The server just fired one. If I didn't already play it, play it now,
        // and follow the server's cooldown from here.
        if (now - lastPlayed[key] > 250) { Sound.play(name); lastPlayed[key] = now; act(key); }
        localNext[key] = now + serverLeft * 1000 - 30;
        return;
      }
      if (!input[key] || now < localNext[key]) return;
      if (skill.mana && (me.mana || 0) < skill.mana) return;
      localNext[key] = now + skill.cd * 1000;
      lastPlayed[key] = now;
      Sound.play(name);
      act(key);
    };
    tryPlay('attack', hero.attack, ATTACK_SOUND[me.heroClass]);
    tryPlay('q', hero.q, SKILL_SOUND[me.heroClass][0]);
    tryPlay('space', hero.space, SKILL_SOUND[me.heroClass][1]);
  }

  function drawBar(g, x, y, frac, color, width = 36) {
    g.fillStyle(0x0d0b12).fillRect(x - width / 2, y, width, 5);
    g.fillStyle(color).fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, frac)), 5);
  }

  // Positions of everyone a moment ago, smoothed between two snapshots.
  function interpolated(snap) {
    const out = new Map();
    const renderAt = performance.now() - INTERP_DELAY;
    let a = null;
    let b = null;
    for (let i = buffer.length - 1; i > 0; i--) {
      if (buffer[i - 1].at <= renderAt) { a = buffer[i - 1]; b = buffer[i]; break; }
    }
    if (!a || a.snap.room.key !== snap.room.key || b.snap.room.key !== snap.room.key) return out;
    const t = Math.max(0, Math.min(1, (renderAt - a.at) / Math.max(1, b.at - a.at)));
    const index = (list, prefix) => new Map(list.map((o) => [prefix + o.id, o]));
    const before = new Map([...index(a.snap.players, 'p:'), ...index(a.snap.enemies, 'e:')]);
    for (const [id, o] of [...index(b.snap.players, 'p:'), ...index(b.snap.enemies, 'e:')]) {
      const prev = before.get(id);
      if (prev) out.set(id, { x: prev.x + (o.x - prev.x) * t, y: prev.y + (o.y - prev.y) * t });
    }
    return out;
  }

  // ---------- starting the game view ----------

  function start() {
    if (game) return;
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-canvas',
      width: W,
      height: H,
      backgroundColor: '#0D0B12',
      pixelArt: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: DungeonScene
    });
  }

  window.GameView = {
    scene: () => scene, // for headless checks
    init() {
      Net.on('game:start', ({ you }) => {
        App.me = you;
        // a new run (Play again): forget everything from the last one
        latest = null;
        buffer.length = 0;
        pendingEvents.length = 0;
        if (scene) scene.resetView();
        if (window.Results) Results.hide();
        App.show('game');
        start();
      });
      Net.on('game:snapshot', (snap) => {
        // Coming back from the shop into the next floor.
        if (App.screen === 'shop' && snap.phase === 'playing') App.show('game');
        latest = snap;
        buffer.push({ at: performance.now(), snap });
        if (buffer.length > 12) buffer.shift();
        Hud.update(snap, App.me);
      });
      Net.on('game:events', (events) => pendingEvents.push(...events));
    }
  };
})();
