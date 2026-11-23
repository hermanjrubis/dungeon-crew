// The dungeon, drawn with Phaser. The server sends snapshots 20 times a second;
// this file draws them and sends my keys back. My own hero moves right away on my
// screen (prediction) and is gently pulled to where the server says it is.
(function () {
  const { TILE, parseRoom, moveWithCollision } = DC.tiles;
  const { FLOOR1 } = DC.rooms;
  const W = DC.tiles.ROOM_W * TILE;
  const H = DC.tiles.ROOM_H * TILE;
  const INTERP_DELAY = 100; // ms: draw others slightly in the past so movement is smooth

  let game = null;
  let scene = null;
  let latest = null;         // newest snapshot
  const buffer = [];         // recent snapshots for smoothing { at, snap }
  const pendingEvents = [];

  // ---------- the Phaser scene ----------

  class DungeonScene extends Phaser.Scene {
    constructor() { super('dungeon'); }

    preload() {
      for (const s of DC.sprites.spriteFiles()) this.load.image(s.key, 'assets/' + s.file);
    }

    create() {
      scene = this;
      this.tileLayer = this.add.graphics();
      this.zoneLayer = this.add.graphics();
      this.fxLayer = this.add.graphics().setDepth(5);
      this.shotLayer = this.add.graphics().setDepth(6);
      this.sprites = new Map(); // id -> { body, label, bar }
      this.tileKey = '';
      this.me = null;           // my predicted position { x, y }
      this.room = null;
      this.roomIndex = -1;
      this.slashes = [];
      this.floaters = [];
      this.fx = new Effects(this);
      this.statusLayer = this.add.graphics().setDepth(6);
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

    sendInput() {
      if (App.screen !== 'game') return;
      Net.sendInput(this.currentInput());
    }

    update(time, deltaMs) {
      if (!latest) return;
      const dt = Math.min(deltaMs / 1000, 0.1);
      const snap = latest;
      if (snap.roomIndex !== this.roomIndex) {
        this.roomIndex = snap.roomIndex;
        this.room = parseRoom(FLOOR1[snap.roomIndex]);
        this.me = null;
      }
      this.drawTiles(snap);
      this.predictMe(snap, dt);
      this.drawZones(snap, time);
      this.drawEntities(snap, time);
      this.drawShots(snap);
      this.drawEffects(dt);
      this.fx.update(dt);
      for (const ev of pendingEvents.splice(0)) this.onEvent(ev, snap);
    }

    // ---------- my own hero ----------

    predictMe(snap, dt) {
      const server = snap.players.find((p) => p.id === App.me);
      if (!server) return;
      if (!this.me || snap.paused || server.downed || server.rolling || server.stunned) {
        this.me = { x: server.x, y: server.y };
        return;
      }
      const input = this.currentInput();
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        const len = Math.hypot(dx, dy);
        const step = server.speed * dt;
        const pos = moveWithCollision(this.room, this.me.x, this.me.y, (dx / len) * step, (dy / len) * step, 16, { doorOpen: snap.doorOpen });
        this.me.x = pos.x;
        this.me.y = pos.y;
      }
      const err = Math.hypot(server.x - this.me.x, server.y - this.me.y);
      if (err > 96) { this.me.x = server.x; this.me.y = server.y; }
      else if (!moving || err > 32) {
        const pull = moving ? 0.08 : 0.2;
        this.me.x += (server.x - this.me.x) * pull;
        this.me.y += (server.y - this.me.y) * pull;
      }
    }

    // ---------- the room ----------

    drawTiles(snap) {
      const key = [snap.roomIndex, snap.doorOpen, snap.spikes, snap.broken.join(','), snap.cracking.join(',')].join('|');
      if (key === this.tileKey) return;
      this.tileKey = key;
      const g = this.tileLayer;
      g.clear();
      const room = this.room;
      const broken = new Set(snap.broken);
      const cracking = new Set(snap.cracking);
      for (let ty = 0; ty < room.h; ty++) {
        for (let tx = 0; tx < room.w; tx++) {
          const x = tx * TILE;
          const y = ty * TILE;
          const idx = ty * room.w + tx;
          let ch = room.grid[ty][tx];
          if (broken.has(idx)) ch = 'p';
          this.drawTile(g, ch, x, y, snap, cracking.has(idx));
        }
      }
    }

    drawTile(g, ch, x, y, snap, isCracking) {
      const floor = () => {
        g.fillStyle(0x2a2438).fillRect(x, y, TILE, TILE);
        g.lineStyle(1, 0x241f30).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      };
      if (ch === 'w') {
        g.fillStyle(0x3d3452).fillRect(x, y, TILE, TILE);
        g.fillStyle(0x4a4063).fillRect(x, y, TILE, 6);
        g.lineStyle(1, 0x332b45).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (ch === 'd') {
        if (snap.doorOpen) {
          g.fillStyle(0x2a2438).fillRect(x, y, TILE, TILE);
          g.fillStyle(0xf2a541, 0.35).fillRect(x, y, TILE, TILE);
        } else {
          g.fillStyle(0x1e1a2a).fillRect(x, y, TILE, TILE);
          g.fillStyle(0x8c84a3);
          for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 11, y, 5, TILE);
        }
      } else if (ch === 'p') {
        g.fillStyle(0x08070c).fillRect(x, y, TILE, TILE);
      } else if (ch === 'u') {
        g.fillStyle(0x3e5c7a).fillRect(x, y, TILE, TILE);
        g.lineStyle(2, 0x5b7d9e, 0.6).strokeEllipse(x + 24, y + 26, 26, 10);
      } else if (ch === 'x') {
        g.fillStyle(isCracking ? 0x9a7a52 : 0x7a6248).fillRect(x, y, TILE, TILE);
        g.lineStyle(2, 0x3e2a19);
        g.beginPath(); g.moveTo(x + 8, y + 10); g.lineTo(x + 24, y + 24); g.lineTo(x + 18, y + 40); g.moveTo(x + 24, y + 24); g.lineTo(x + 40, y + 18); g.strokePath();
      } else if (ch === 's') {
        floor();
        const state = snap.spikes;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const cx = x + 10 + i * 14;
            const cy = y + 10 + j * 14;
            if (state === 'up') {
              g.fillStyle(0xe9e4d4).fillTriangle(cx - 5, cy + 5, cx + 5, cy + 5, cx, cy - 7);
            } else {
              g.fillStyle(state === 'rattle' ? 0xf2a541 : 0x15121e).fillCircle(cx, cy, state === 'rattle' ? 4 : 3);
            }
          }
        }
      } else {
        floor();
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
        } else if (z.kind === 'taunt') {
          g.lineStyle(4, 0xf2a541, 0.8).strokeCircle(z.x, z.y, z.r * 0.5);
        }
      }
    }

    // ---------- heroes and monsters ----------

    spriteFor(id, key, labelText, labelColor) {
      let s = this.sprites.get(id);
      if (!s) {
        const body = this.add.image(0, 0, key).setDepth(3);
        const label = labelText ? this.add.text(0, 0, labelText, { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: 'bold', color: labelColor || '#EDE8F5', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4) : null;
        const bar = this.add.graphics().setDepth(4);
        s = { body, label, bar, key, seen: 0 };
        this.sprites.set(id, s);
      }
      if (s.key !== key) { s.body.setTexture(key); s.key = key; }
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
        s.body.setPosition(pos.x, pos.y - 6).setFlipX(Math.abs(p.aim) > Math.PI / 2).setScale(1, 1);
        s.body.setAlpha(p.downed ? 0.35 : p.rolling ? 0.6 : 1).setAngle(p.downed ? 90 : 0);
        if ((this.flashUntil.get(id) || 0) > time) s.body.setTintFill(0xff5a50); else s.body.clearTint();
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
        const s = this.spriteFor(id, e.type);
        s.body.setVisible(e.state !== 'airborne');
        let sx = 1;
        let sy = 1;
        let lift = 0;
        if (e.state === 'squish') { sx = 1.25; sy = 0.7; }
        if (e.state === 'leap') lift = 18;
        s.body.setPosition(pos.x, pos.y - lift).setScale(sx, sy);
        const tell = (e.state === 'screech' || e.state === 'squish') && Math.floor(time / 100) % 2 === 0;
        const hit = (this.flashUntil.get(id) || 0) > time;
        if (hit || tell) s.body.setTintFill(0xffffff);
        else if (e.state === 'swoop') s.body.setTint(0xf2a541);
        else if (e.stunned) s.body.setTint(0xb8b0d0);
        else s.body.clearTint();
        if (e.state === 'swoop' && time - (this.ghostAt.get(id) || 0) > 40) {
          this.ghostAt.set(id, time);
          this.fx.ghost(s.body, 0xf2a541);
        }
        this.drawStatus(e, pos, time);
        s.bar.clear();
        if (e.state !== 'airborne') {
          const big = e.type === 'mother' || e.type === 'halfmother';
          drawBar(s.bar, pos.x, pos.y - (big ? 52 : 30), e.hp / e.maxHp, 0xc76bd9, big ? 80 : 36);
        }
      }

      for (const [id, s] of this.sprites) {
        if (seen.has(id)) continue;
        s.body.destroy();
        if (s.label) s.label.destroy();
        s.bar.destroy();
        this.sprites.delete(id);
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
        if (pr.kind === 'arrow') {
          // a little arrow pointing where it flies, with a pale streak behind it
          const cx = Math.cos(ang);
          const cy = Math.sin(ang);
          g.lineStyle(2, 0xcfc8de, 0.35).lineBetween(pr.x - cx * 34, pr.y - cy * 34, pr.x, pr.y);
          g.lineStyle(3, 0xe9e4d4, 1).lineBetween(pr.x - cx * 14, pr.y - cy * 14, pr.x + cx * 6, pr.y + cy * 6);
          g.fillStyle(0xffffff).fillTriangle(pr.x + cx * 10, pr.y + cy * 10, pr.x - cy * 4, pr.y + cx * 4, pr.x + cy * 4, pr.y - cx * 4);
        } else if (pr.kind === 'bolt') {
          g.fillStyle(0x6c9bf2, 0.35).fillCircle(pr.x, pr.y, 11);
          g.fillStyle(0xb8d0ff).fillCircle(pr.x, pr.y, 5);
          this.fx.burst(pr.x, pr.y, 0x6c9bf2, 1, 'trail');
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
      const big = e.type === 'mother' || e.type === 'halfmother';
      const top = pos.y - (big ? 62 : 38);
      if (e.stunned) {
        for (let i = 0; i < 3; i++) {
          const a = time / 180 + (i * Math.PI * 2) / 3;
          g.fillStyle(0xf2c14e).fillCircle(pos.x + Math.cos(a) * 14, top + Math.sin(a) * 4, 3);
        }
      }
      if (e.state === 'squish' || e.state === 'screech') {
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
      } else if (ev.skill === 'heal') {
        fx.ring(ev.x, ev.y, { from: 10, to: 96, life: 0.5, color: 0x7ee8c8, width: 6, fill: 0.2 });
        fx.burst(ev.x, ev.y, 0x7ee8c8, 20, 'rise', 'fx-plus');
      }
      if (color && ev.skill !== 'heal' && ev.skill !== 'taunt') fx.burst(ev.x, ev.y, color, 4, 'spark');
    }

    onEvent(ev, snap) {
      const fx = this.fx;
      const now = this.time.now;
      const playerAt = (id) => snap.players.find((q) => q.id === id);
      if (ev.type === 'damage') {
        if (ev.enemyId) {
          this.floatText(ev.x, ev.y - 20, String(ev.amount), '#FFFFFF');
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
      } else if (ev.type === 'cast') this.castEffect(ev, snap);
      else if (ev.type === 'explode') {
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
      } else if (ev.type === 'kill') {
        const color = Effects.MONSTER_COLORS[ev.enemyType] || 0xffffff;
        const big = ev.enemyType === 'mother' || ev.enemyType === 'halfmother';
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
      } else if (ev.type === 'roomclear') Hud.banner(ev.roomIndex === snap.roomCount - 1 ? 'Floor 1 cleared!' : 'Room clear! Door open →');
      else if (ev.type === 'nextroom') Hud.banner(ev.roomIndex === snap.roomCount - 1 ? 'Boss room: Gloop Mother!' : `Room ${ev.roomIndex + 1}`);
      else if (ev.type === 'reset') Hud.banner('Everyone fell! Room restarts', 2400);
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
    if (!a || a.snap.roomIndex !== snap.roomIndex || b.snap.roomIndex !== snap.roomIndex) return out;
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
    init() {
      Net.on('game:start', ({ you }) => {
        App.me = you;
        App.show('game');
        start();
      });
      Net.on('game:snapshot', (snap) => {
        latest = snap;
        buffer.push({ at: performance.now(), snap });
        if (buffer.length > 12) buffer.shift();
        Hud.update(snap, App.me);
      });
      Net.on('game:events', (events) => pendingEvents.push(...events));
    }
  };
})();
