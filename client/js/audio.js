// Sound effects, made in code with the Web Audio API (no sound files).
// Every sound is a small recipe of tones and noise bursts. Browsers only allow
// sound after the first click or key press, so nothing plays before that.
(function () {
  const SAVE_VOL = 'dc-volume';
  const SAVE_MUTE = 'dc-muted';
  const MAX_REPEATS = 4;     // the same sound at most 4 times...
  const REPEAT_WINDOW = 100; // ...per 100 ms

  let ctx = null;
  let master = null;
  let bus = null;     // where the sound being built goes (master, or a quieter gain)
  let noiseBuf = null;
  const recent = new Map();  // name -> recent play times

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  const Sound = window.Sound = {
    volume: Math.max(0, Math.min(1, Number(load(SAVE_VOL, 0.7)))),
    muted: !!load(SAVE_MUTE, false),
    played: {},     // name -> times played (handy for checks)
    requested: {},  // name -> times asked for, even before sound was unlocked

    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
        applyVolume();
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      } catch (e) {
        ctx = null;
      }
    },

    // opts.vol: 0..1 extra loudness for this one play (teammates' sounds are quieter).
    play(name, opts = {}) {
      Sound.requested[name] = (Sound.requested[name] || 0) + 1;
      const recipe = RECIPES[name];
      if (!recipe || !ctx || ctx.state !== 'running' || Sound.muted || Sound.volume <= 0) return;
      const now = performance.now();
      const times = (recent.get(name) || []).filter((t) => now - t < REPEAT_WINDOW);
      if (times.length >= MAX_REPEATS) return;
      times.push(now);
      recent.set(name, times);
      try {
        bus = master;
        if (opts.vol !== undefined && opts.vol < 1) {
          bus = ctx.createGain();
          bus.gain.value = Math.max(0, opts.vol);
          bus.connect(master);
        }
        recipe(ctx.currentTime + 0.005);
        Sound.played[name] = (Sound.played[name] || 0) + 1;
      } catch (e) { /* never let a sound break the game */ }
      bus = master;
    },

    setVolume(v) {
      Sound.volume = Math.max(0, Math.min(1, Number(v) || 0));
      save(SAVE_VOL, Sound.volume);
      applyVolume();
      syncControls();
    },

    setMuted(m) {
      Sound.muted = !!m;
      save(SAVE_MUTE, Sound.muted);
      applyVolume();
      syncControls();
    },

    // A mute button and volume slider. Used on the menu and the pause screen.
    mountControls(host) {
      host.classList.add('sound-ctl');
      host.innerHTML = `
        <span class="label">Sound</span>
        <button type="button" class="btn btn-outline sound-mute" aria-pressed="false">Mute</button>
        <input type="range" class="sound-vol" min="0" max="100" step="5" aria-label="Volume">
        <span class="sound-pct muted small"></span>`;
      host.querySelector('.sound-mute').addEventListener('click', () => {
        Sound.setMuted(!Sound.muted);
        if (!Sound.muted) Sound.play('click');
      });
      host.querySelector('.sound-vol').addEventListener('input', (e) => {
        Sound.setVolume(e.target.value / 100);
        if (Sound.muted && Sound.volume > 0) Sound.setMuted(false);
      });
      host.querySelector('.sound-vol').addEventListener('change', () => Sound.play('coin'));
      syncControls();
    }
  };

  function applyVolume() {
    if (master) master.gain.setValueAtTime(Sound.muted ? 0 : Sound.volume * 0.8, ctx.currentTime);
  }

  function syncControls() {
    for (const host of document.querySelectorAll('.sound-ctl')) {
      const btn = host.querySelector('.sound-mute');
      const slider = host.querySelector('.sound-vol');
      if (!btn || !slider) continue;
      btn.textContent = Sound.muted ? 'Unmute' : 'Mute';
      btn.setAttribute('aria-pressed', String(Sound.muted));
      slider.value = Math.round(Sound.volume * 100);
      host.querySelector('.sound-pct').textContent = Sound.muted ? 'muted' : `${Math.round(Sound.volume * 100)}%`;
    }
  }

  // ---------- building blocks ----------

  // A tone that can slide in pitch: f -> f2 over dur seconds.
  function tone(t, { type = 'square', f = 440, f2 = null, dur = 0.15, vol = 0.2, attack = 0.005, delay = 0 } = {}) {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(bus || master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  // A burst of filtered noise (whooshes, hits, rumbles).
  function noise(t, { dur = 0.2, vol = 0.2, filter = 'lowpass', f = 1000, f2 = null, q = 1, attack = 0.005, delay = 0 } = {}) {
    const start = t + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f, start);
    if (f2) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f2), start + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bq).connect(gain).connect(bus || master);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.02);
  }

  // Notes one after another.
  function notes(t, list, { type = 'square', len = 0.09, gap = 0.07, vol = 0.12 } = {}) {
    list.forEach((f, i) => tone(t, { type, f, dur: len, vol, delay: i * gap }));
  }

  const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568 };

  // ---------- the sounds ----------

  const RECIPES = {
    click: (t) => tone(t, { type: 'triangle', f: 700, dur: 0.05, vol: 0.12 }),
    swing: (t) => noise(t, { filter: 'bandpass', f: 1600, f2: 400, q: 2, dur: 0.13, vol: 0.28 }),
    arrow: (t) => { noise(t, { filter: 'highpass', f: 3000, dur: 0.07, vol: 0.12 }); tone(t, { type: 'triangle', f: 900, f2: 500, dur: 0.08, vol: 0.08 }); },
    bolt: (t) => { tone(t, { type: 'sine', f: 600, f2: 1300, dur: 0.16, vol: 0.14 }); tone(t, { type: 'square', f: 1300, f2: 900, dur: 0.06, vol: 0.04 }); },
    bash: (t) => { noise(t, { f: 700, dur: 0.16, vol: 0.4 }); tone(t, { f: 140, f2: 60, dur: 0.16, vol: 0.22 }); },
    taunt: (t) => { tone(t, { type: 'sawtooth', f: 220, f2: 170, dur: 0.45, vol: 0.18 }); tone(t, { f: 330, f2: 260, dur: 0.35, vol: 0.07 }); },
    arrowRain: (t) => { for (let i = 0; i < 5; i++) noise(t, { filter: 'highpass', f: 2500 + i * 300, dur: 0.07, vol: 0.12, delay: i * 0.06 }); },
    roll: (t) => noise(t, { filter: 'bandpass', f: 700, f2: 2200, q: 1.5, dur: 0.22, vol: 0.16 }),
    fireball: (t) => { noise(t, { f: 400, f2: 1800, dur: 0.35, vol: 0.3 }); tone(t, { type: 'sawtooth', f: 120, f2: 60, dur: 0.35, vol: 0.12 }); },
    heal: (t) => notes(t, [N.C5, N.E5, N.G5, N.C6], { type: 'sine', len: 0.2, gap: 0.07, vol: 0.14 }),
    hit: (t) => { tone(t, { f: 320, f2: 150, dur: 0.06, vol: 0.1 }); noise(t, { f: 2000, dur: 0.04, vol: 0.08 }); },
    hurt: (t) => { tone(t, { type: 'sawtooth', f: 240, f2: 110, dur: 0.16, vol: 0.22 }); noise(t, { f: 900, dur: 0.08, vol: 0.12 }); },
    kill: (t) => { noise(t, { f: 900, f2: 300, dur: 0.14, vol: 0.2 }); tone(t, { f: 420, f2: 90, dur: 0.15, vol: 0.12 }); },
    bossKill: (t) => { noise(t, { f: 400, f2: 80, dur: 1.4, vol: 0.5 }); tone(t, { type: 'sawtooth', f: 90, f2: 30, dur: 1.4, vol: 0.3 }); },
    slimeSplit: (t) => { tone(t, { type: 'sine', f: 250, f2: 700, dur: 0.12, vol: 0.18 }); tone(t, { type: 'sine', f: 300, f2: 800, dur: 0.12, vol: 0.15, delay: 0.08 }); },
    batScreech: (t) => { tone(t, { f: 1800, f2: 2600, dur: 0.12, vol: 0.06 }); tone(t, { f: 2000, f2: 2800, dur: 0.12, vol: 0.05, delay: 0.1 }); },
    bones: (t) => { for (let i = 0; i < 3; i++) noise(t, { filter: 'highpass', f: 2200, dur: 0.04, vol: 0.14, delay: i * 0.05 }); },
    puff: (t) => noise(t, { f: 700, f2: 300, dur: 0.45, vol: 0.2, attack: 0.05 }),
    roar: (t) => { tone(t, { type: 'sawtooth', f: 95, f2: 55, dur: 1.0, vol: 0.3, attack: 0.08 }); noise(t, { f: 500, f2: 200, dur: 1.0, vol: 0.3, attack: 0.08 }); },
    slam: (t) => { noise(t, { f: 260, dur: 0.45, vol: 0.55 }); tone(t, { type: 'sine', f: 75, f2: 35, dur: 0.45, vol: 0.5 }); },
    sweep: (t) => noise(t, { filter: 'bandpass', f: 1800, f2: 400, q: 1.2, dur: 0.28, vol: 0.32 }),
    shadow: (t) => { tone(t, { type: 'sine', f: 300, f2: 900, dur: 0.35, vol: 0.14 }); tone(t, { type: 'triangle', f: 450, f2: 1350, dur: 0.35, vol: 0.08 }); },
    breath: (t) => noise(t, { f: 700, f2: 2600, dur: 1.0, vol: 0.38, attack: 0.1 }),
    gust: (t) => noise(t, { filter: 'bandpass', f: 400, f2: 1300, q: 0.8, dur: 0.8, vol: 0.32, attack: 0.15 }),
    meteor: (t) => { noise(t, { f: 700, f2: 150, dur: 0.6, vol: 0.45 }); tone(t, { type: 'sine', f: 130, f2: 40, dur: 0.6, vol: 0.35 }); },
    spike: (t) => { tone(t, { f: 900, f2: 300, dur: 0.07, vol: 0.1 }); noise(t, { filter: 'highpass', f: 3000, dur: 0.05, vol: 0.1 }); },
    crumble: (t) => noise(t, { f: 500, f2: 120, dur: 0.6, vol: 0.32, attack: 0.02 }),
    fall: (t) => tone(t, { type: 'sine', f: 620, f2: 90, dur: 0.55, vol: 0.18 }),
    geyser: (t) => noise(t, { f: 300, f2: 1400, dur: 0.8, vol: 0.32, attack: 0.05 }),
    jet: (t) => noise(t, { filter: 'highpass', f: 1500, dur: 0.6, vol: 0.16, attack: 0.03 }),
    lava: (t) => { noise(t, { f: 900, dur: 0.35, vol: 0.3 }); tone(t, { type: 'sine', f: 220, f2: 70, dur: 0.35, vol: 0.2 }); },
    bridge: (t) => { tone(t, { type: 'triangle', f: 150, f2: 120, dur: 0.25, vol: 0.1 }); noise(t, { f: 400, dur: 0.25, vol: 0.08 }); },
    coin: (t) => { tone(t, { f: N.B5, dur: 0.06, vol: 0.09 }); tone(t, { f: N.E6, dur: 0.14, vol: 0.09, delay: 0.06 }); },
    buy: (t) => { notes(t, [N.E5, N.G5, N.C6], { len: 0.08, gap: 0.06, vol: 0.11 }); },
    ready: (t) => notes(t, [N.C5, N.G5], { type: 'triangle', len: 0.12, gap: 0.09, vol: 0.14 }),
    levelup: (t) => notes(t, [N.C5, N.E5, N.G5, N.C6, N.E6], { len: 0.1, gap: 0.07, vol: 0.12 }),
    downed: (t) => tone(t, { type: 'sawtooth', f: 420, f2: 70, dur: 0.7, vol: 0.22 }),
    revive: (t) => notes(t, [N.G4, N.C5, N.E5, N.G5], { type: 'sine', len: 0.18, gap: 0.08, vol: 0.15 }),
    roomClear: (t) => { notes(t, [N.E5, N.G5, N.B5, N.E6], { type: 'triangle', len: 0.18, gap: 0.08, vol: 0.15 }); noise(t, { filter: 'highpass', f: 5000, dur: 0.4, vol: 0.05, delay: 0.3 }); },
    fanfare: (t) => {
      const seq = [[N.C5, 0.1], [N.C5, 0.1], [N.C5, 0.1], [N.G5, 0.45], [N.E5, 0.15], [N.G5, 0.15], [N.C6, 0.6]];
      let d = 0;
      for (const [f, len] of seq) { tone(t, { f, dur: len + 0.05, vol: 0.13, delay: d }); tone(t, { type: 'triangle', f: f / 2, dur: len + 0.05, vol: 0.1, delay: d }); d += len + 0.02; }
    },
    star: (t) => { tone(t, { f: N.E6, f2: 1760, dur: 0.12, vol: 0.12 }); tone(t, { type: 'triangle', f: 2637, dur: 0.3, vol: 0.08, delay: 0.06 }); },
    tick: (t) => tone(t, { f: 1000, dur: 0.04, vol: 0.12 }),
    // Stonewarden
    rock: (t) => { noise(t, { filter: 'bandpass', f: 600, f2: 250, q: 1.5, dur: 0.12, vol: 0.3 }); tone(t, { type: 'triangle', f: 180, f2: 90, dur: 0.1, vol: 0.12 }); },
    boulder: (t) => { noise(t, { f: 300, dur: 0.9, vol: 0.35, attack: 0.05 }); tone(t, { type: 'sine', f: 70, f2: 50, dur: 0.9, vol: 0.3, attack: 0.05 }); },
    quake: (t) => { noise(t, { f: 200, dur: 0.7, vol: 0.6 }); tone(t, { type: 'sine', f: 55, f2: 30, dur: 0.7, vol: 0.55 }); for (let i = 0; i < 4; i++) noise(t, { filter: 'bandpass', f: 900, dur: 0.06, vol: 0.18, delay: 0.08 + i * 0.07 }); },
    // Engineer
    wrench: (t) => { noise(t, { filter: 'bandpass', f: 2200, f2: 900, q: 3, dur: 0.1, vol: 0.22 }); tone(t, { f: 1300, f2: 1100, dur: 0.05, vol: 0.05, delay: 0.05 }); },
    turret: (t) => { notes(t, [N.C5, N.G5, N.C6], { len: 0.06, gap: 0.05, vol: 0.09 }); noise(t, { filter: 'highpass', f: 3000, dur: 0.15, vol: 0.08 }); },
    turretShot: (t) => { tone(t, { f: 1500, f2: 700, dur: 0.05, vol: 0.06 }); noise(t, { filter: 'highpass', f: 4000, dur: 0.03, vol: 0.05 }); },
    mine: (t) => { tone(t, { f: 880, dur: 0.05, vol: 0.08 }); tone(t, { f: 880, dur: 0.05, vol: 0.08, delay: 0.12 }); },
    mineBoom: (t) => { noise(t, { f: 900, f2: 120, dur: 0.6, vol: 0.5 }); tone(t, { type: 'sine', f: 110, f2: 35, dur: 0.5, vol: 0.4 }); },
    timeup: (t) => { tone(t, { type: 'sawtooth', f: 440, dur: 0.2, vol: 0.14 }); tone(t, { type: 'sawtooth', f: 330, dur: 0.35, vol: 0.14, delay: 0.2 }); },
    victory: (t) => {
      const seq = [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6, N.E6, N.G6];
      seq.forEach((f, i) => { tone(t, { f, dur: 0.22, vol: 0.12, delay: i * 0.14 }); tone(t, { type: 'triangle', f: f / 2, dur: 0.22, vol: 0.09, delay: i * 0.14 }); });
    }
  };
  Sound.names = Object.keys(RECIPES);
  Object.defineProperty(Sound, 'ctx', { get: () => ctx });

  // Unlock on the first click or key press, and click sounds for buttons.
  const unlock = () => Sound.unlock();
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.btn, .hero-card, .color-dot')) Sound.play('click');
  });
})();
