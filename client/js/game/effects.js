// Visual effects: particle bursts, shock rings, slashes, afterimages and screen shake.
// Only looks — nothing here changes the game. The server says WHAT happened
// (an event), and this file decides how it LOOKS.
(function () {
  const PRESETS = {
    // name: particle settings (speed px/s, life ms, size, gravity)
    spark: { speed: { min: 80, max: 220 }, lifespan: 260, scale: { start: 0.9, end: 0 }, blendMode: 'ADD' },
    burst: { speed: { min: 60, max: 260 }, lifespan: 500, scale: { start: 1.3, end: 0 }, blendMode: 'ADD' },
    flame: { speed: { min: 40, max: 320 }, lifespan: 550, scale: { start: 2.2, end: 0 }, blendMode: 'ADD' },
    smoke: { speed: { min: 20, max: 90 }, lifespan: 900, scale: { start: 2.5, end: 4 }, alpha: { start: 0.45, end: 0 } },
    drip: { speed: { min: 60, max: 200 }, lifespan: 600, scale: { start: 1.4, end: 0.2 }, gravityY: 500 },
    rubble: { speed: { min: 40, max: 160 }, lifespan: 700, scale: { start: 1.5, end: 0.5 }, gravityY: 600 },
    rise: { speedY: { min: -90, max: -40 }, speedX: { min: -15, max: 15 }, lifespan: 800, scale: { start: 1, end: 0 }, blendMode: 'ADD' },
    trail: { speed: { min: 0, max: 30 }, lifespan: 260, scale: { start: 1.2, end: 0 }, blendMode: 'ADD' }
  };

  class Effects {
    constructor(scene) {
      this.scene = scene;
      this.layer = scene.add.graphics().setDepth(7);
      this.emitters = new Map();
      this.rings = [];
      this.claws = [];
      this.makeTextures();
    }

    makeTextures() {
      if (this.scene.textures.exists('fx-dot')) return;
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff).fillCircle(4, 4, 4);
      g.generateTexture('fx-dot', 8, 8);
      g.clear();
      g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
      g.generateTexture('fx-square', 4, 4);
      g.clear();
      g.fillStyle(0xffffff).fillRect(3, 0, 2, 8).fillRect(0, 3, 8, 2);
      g.generateTexture('fx-plus', 8, 8);
      g.destroy();
    }

    emitter(preset, color, texture = 'fx-dot') {
      const key = `${preset}|${color}|${texture}`;
      let em = this.emitters.get(key);
      if (!em) {
        em = this.scene.add.particles(0, 0, texture, { ...PRESETS[preset], tint: color, emitting: false }).setDepth(7);
        this.emitters.set(key, em);
      }
      return em;
    }

    // A one-off spray of particles.
    burst(x, y, color, count = 12, preset = 'burst', texture) {
      this.emitter(preset, color, texture).explode(count, x, y);
    }

    // An expanding ring (or part of a ring when `arc` is given).
    ring(x, y, { from = 0, to = 60, life = 0.35, color = 0xffffff, width = 4, fill = 0, arc = null, delay = 0 } = {}) {
      this.rings.push({ x, y, from, to, life, max: life, color, width, fill, arc, delay });
    }

    // Three claw scratches, for bites.
    clawMarks(x, y, color = 0xe5534b) {
      this.claws.push({ x, y, life: 0.35, color });
    }

    shake(ms, strength) {
      this.scene.cameras.main.shake(ms, strength);
    }

    // A fading copy of a sprite, for dodge rolls and swoops.
    ghost(image, tint) {
      const g = this.scene.add.image(image.x, image.y, image.texture.key)
        .setFlipX(image.flipX).setScale(image.scaleX, image.scaleY).setAlpha(0.5).setDepth(2);
      if (tint) g.setTintFill(tint);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }

    update(dt) {
      const g = this.layer;
      g.clear();
      this.rings = this.rings.filter((r) => {
        if (r.delay > 0) { r.delay -= dt; return true; }
        r.life -= dt;
        if (r.life <= 0) return false;
        const t = 1 - r.life / r.max;
        const radius = r.from + (r.to - r.from) * (1 - (1 - t) * (1 - t));
        const alpha = Math.min(1, r.life / r.max * 1.5);
        if (r.fill) g.fillStyle(r.color, r.fill * alpha);
        g.lineStyle(r.width * (1 - t * 0.5), r.color, alpha);
        if (r.arc) {
          g.beginPath();
          g.arc(r.x, r.y, radius, r.arc.aim - r.arc.spread, r.arc.aim + r.arc.spread);
          g.strokePath();
        } else {
          if (r.fill) g.fillCircle(r.x, r.y, radius);
          g.strokeCircle(r.x, r.y, radius);
        }
        return true;
      });
      this.claws = this.claws.filter((c) => {
        c.life -= dt;
        if (c.life <= 0) return false;
        g.lineStyle(4, c.color, c.life / 0.35);
        for (let i = -1; i <= 1; i++) g.lineBetween(c.x - 14 + i * 8, c.y - 16, c.x + 6 + i * 8, c.y + 14);
        return true;
      });
    }
  }

  // Colors for each monster's death burst.
  Effects.MONSTER_COLORS = {
    gloop: 0xc76bd9, minigloop: 0xe3a6ee, bat: 0x8e7bb0, mother: 0xa94fc0, halfmother: 0xa94fc0,
    golem: 0x8c84a3, king: 0xc77dff, dragon: 0xe5622b,
    rotgrub: 0xc9b08a, slug: 0x6ec84a, rothand: 0x8a6a8e, wyrm: 0x8a6a8e, crawler: 0x9ad7f0, wisp: 0xb89af0, prism: 0x6ce8ff
  };

  window.Effects = Effects;
})();
