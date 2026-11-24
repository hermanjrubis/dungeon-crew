// Background music: small chiptune songs played by code (Web Audio), no files.
// Each song = tempo + 8 bars of chords + a melody (one token per 8th note:
// a note like 'E5', '-' to hold the last note, '.' for silence) + drums.
// Music.play('forge') crossfades to that song; Music.stop() fades out.
(function () {
  const SAVE_VOL = 'dc-music-volume';
  const LOOKAHEAD = 0.12;   // schedule notes this far ahead (seconds)
  const FADE = 1;           // crossfade time (seconds)

  const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) {
    const m = /^([A-G][b#]?)(-?\d)$/.exec(name);
    if (!m) return null;
    const midi = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // 'Cm' -> root C, minor triad; 'G' major; 'Bdim'; 'E' etc.
  function chordNotes(sym, octave) {
    const m = /^([A-G][b#]?)(m|dim)?$/.exec(sym);
    const root = NOTE_INDEX[m[1]];
    const third = m[2] === 'm' || m[2] === 'dim' ? 3 : 4;
    const fifth = m[2] === 'dim' ? 6 : 7;
    const base = (octave + 1) * 12 + root;
    return [base, base + third, base + fifth].map((n) => 440 * Math.pow(2, (n - 69) / 12));
  }

  // ---------- the songs ----------
  const SONGS = {
    menu: {
      title: 'Dungeon Crew (menu)', bpm: 104, lead: 'square', leadVol: 0.07, bassStyle: 'quarter', arp: true,
      chords: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Bb', 'G'],
      melody: 'G4 . C5 D5 Eb5 - D5 C5 | Eb5 - - C5 Ab4 - C5 Eb5 | G5 - F5 Eb5 D5 - Eb5 F5 | D5 - - - Bb4 - . . | ' +
              'G4 . C5 D5 Eb5 - G5 - | Ab5 - G5 F5 Eb5 - C5 - | D5 - Eb5 F5 D5 - Bb4 - | B4 - - - D5 - G4 .',
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }
    },
    shop: {
      title: 'Camp Shop', bpm: 92, lead: 'triangle', leadVol: 0.12, bassStyle: 'quarter', arp: true,
      chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'],
      melody: 'A4 - C5 - F5 - E5 D5 | D5 - - A4 F4 - A4 - | Bb4 - D5 - F5 - D5 Bb4 | C5 - - - G4 - . . | ' +
              'A4 - C5 - F5 - A5 G5 | E5 - - C5 A4 - C5 E5 | D5 - F5 - Bb5 - A5 G5 | G5 - - - E5 - C5 .',
      drums: { k: 'x...............', s: '................', h: '..x...x...x...x.' }
    },
    cellar: {
      title: 'Floor 1 · Sunken Cellar', bpm: 84, lead: 'square', leadVol: 0.05, bassStyle: 'half', arp: true,
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'E'],
      melody: 'E5 - - - - - A4 - | C5 - - - B4 - A4 - | G4 - - - C5 - - - | B4 - - - - - . . | ' +
              'E5 - - - D5 - C5 - | A4 - - - C5 - F5 - | E5 - - - G#4 - B4 - | A4 - - - - - . .',
      drums: { k: 'x.......x.......', s: '................', h: '....x.......x...' }
    },
    caverns: {
      title: 'Floor 2 · Fungal Caverns', bpm: 76, lead: 'sine', leadVol: 0.13, bassStyle: 'half', arp: false, echo: true,
      chords: ['Em', 'F', 'Em', 'Dm', 'Em', 'F', 'G', 'F'],
      melody: 'B4 . . E5 . . F5 . | E5 - - - C5 - - - | B4 . . G4 . . A4 . | B4 - - - - - . . | ' +
              'E5 . . G5 . . F5 . | E5 - - - D5 - C5 - | B4 - D5 - C5 - B4 - | A4 - - - - - . .',
      drums: { k: 'x...............', s: '............x...', h: '................' }
    },
    forge: {
      title: 'Floor 3 · Molten Forge', bpm: 132, lead: 'square', leadVol: 0.06, bassStyle: 'eighths', arp: false,
      chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'],
      melody: 'D5 . D5 F5 . A5 . G5 | F5 - E5 - D5 - . . | D5 . D5 F5 . Bb5 . A5 | G5 - - - E5 - . . | ' +
              'A5 . A5 C6 . A5 . G5 | F5 - G5 - A5 - D5 - | Bb5 - A5 - G5 - F5 - | E5 - - - C#5 - . .',
      drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }
    },
    roost: {
      title: "Floor 4 · Dragon's Roost", bpm: 112, lead: 'sawtooth', leadVol: 0.05, bassStyle: 'eighths', arp: true,
      chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G'],
      melody: 'C5 - - - G5 - - - | Ab5 - G5 - F5 - Eb5 - | F5 - - - C5 - - - | D5 - - - B4 - - - | ' +
              'C5 - Eb5 - G5 - C6 - | Ab5 - - - G5 - F5 - | F5 - G5 - Ab5 - Bb5 - | B5 - - - G5 - - -',
      drums: { k: 'x.....x...x.....', s: '........x.......', h: 'x...x...x...x...', t: '..........x.x.x.' }
    },
    boss: {
      title: 'Boss Fight', bpm: 150, lead: 'square', leadVol: 0.06, bassStyle: 'eighths', arp: false,
      chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
      melody: 'E5 E5 . G5 . E5 F#5 G5 | B5 - A5 - G5 - F#5 - | E5 E5 . G5 . E5 F#5 G5 | A5 - - - B5 - . . | ' +
              'E6 - D6 - B5 - G5 - | E5 - G5 - B5 - D6 - | C6 - B5 - A5 - G5 - | F#5 - - - D#5 - . .',
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }
    },
    victory: {
      title: 'Victory', bpm: 130, lead: 'square', leadVol: 0.08, bassStyle: 'quarter', arp: true, once: true,
      chords: ['C', 'F', 'G', 'C'],
      melody: 'C5 E5 G5 C6 - - G5 - | A5 - F5 - C6 - A5 - | B5 - G5 - D6 - B5 - | C6 - - - - - . .',
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }
    }
  };

  // ---------- the player ----------
  let ctx = null;
  let out = null;       // master music gain (volume)
  let echoIn = null;    // a send into a simple echo, for the cave song
  let noiseBuf = null;
  let current = null;   // { name, song, gain, step, nextTime, timer }

  const Music = window.Music = {
    SONGS,
    volume: load(SAVE_VOL, 0.4),
    muted: false,
    current: () => (current ? current.name : null),

    // Use the same AudioContext as the sound effects when there is one.
    attach(audioCtx) {
      if (ctx || !audioCtx) return;
      ctx = audioCtx;
      out = ctx.createGain();
      out.connect(ctx.destination);
      Music.output = out; // so a page can listen in (e.g. a visualizer)
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.33;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      echoIn = ctx.createGain();
      echoIn.gain.value = 0.5;
      echoIn.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(out);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolume();
      if (Music.wanted) Music.play(Music.wanted);
    },

    play(name) {
      Music.wanted = name;
      if (!ctx || ctx.state !== 'running') return;
      if (current && current.name === name) return;
      const song = SONGS[name];
      if (!song) return;
      fadeOutCurrent();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE);
      gain.connect(out);
      const track = { name, song, gain, step: 0, nextTime: ctx.currentTime + 0.05 };
      track.timer = setInterval(() => schedule(track), 25);
      current = track;
      schedule(track);
    },

    stop() {
      Music.wanted = null;
      fadeOutCurrent();
    },

    setVolume(v) {
      Music.volume = Math.max(0, Math.min(1, Number(v) || 0));
      save(SAVE_VOL, Music.volume);
      applyVolume();
    },

    setMuted(m) {
      Music.muted = !!m;
      applyVolume();
    }
  };

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  function applyVolume() {
    if (out) out.gain.setValueAtTime(Music.muted ? 0 : Music.volume * 0.9, ctx.currentTime);
  }

  function fadeOutCurrent() {
    if (!current) return;
    const t = current;
    current = null;
    clearInterval(t.timer);
    t.gain.gain.cancelScheduledValues(ctx.currentTime);
    t.gain.gain.setValueAtTime(Math.max(0.0001, t.gain.gain.value), ctx.currentTime);
    t.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE);
    setTimeout(() => t.gain.disconnect(), (FADE + 0.2) * 1000);
  }

  // Parse a song once: melody tokens -> notes with lengths (in 16th steps).
  function prepare(song) {
    if (song.prepared) return song.prepared;
    const tokens = song.melody.replace(/\|/g, ' ').trim().split(/\s+/);
    const notes = [];
    tokens.forEach((tok, i) => {
      if (tok === '-') { if (notes.length && notes[notes.length - 1].end === i) notes[notes.length - 1].end = i + 1; return; }
      if (tok === '.') return;
      notes.push({ start: i, end: i + 1, f: freq(tok) });
    });
    const melodyAt = new Map(notes.map((n) => [n.start * 2, { f: n.f, steps: (n.end - n.start) * 2 }]));
    song.prepared = { melodyAt, bars: song.chords.length, steps: song.chords.length * 16 };
    return song.prepared;
  }

  function schedule(track) {
    if (!ctx) return;
    const { song } = track;
    const p = prepare(song);
    const stepLen = 60 / song.bpm / 4;
    while (track.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (song.once && track.step >= p.steps) { if (current === track) Music.stop(); return; }
      playStep(track, track.step % p.steps, track.nextTime, stepLen, p);
      track.step++;
      track.nextTime += stepLen;
    }
  }

  function playStep(track, step, t, stepLen, p) {
    const { song, gain } = track;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = song.chords[bar];

    // melody
    const m = p.melodyAt.get(step);
    if (m) {
      voice(gain, t, { type: song.lead, f: m.f, dur: m.steps * stepLen * 0.92, vol: song.leadVol, vibrato: m.steps >= 4 });
      if (song.echo) voice(echoIn, t, { type: song.lead, f: m.f, dur: m.steps * stepLen * 0.9, vol: song.leadVol * 0.8 });
    }
    // bass
    const root = chordNotes(chord, 2)[0];
    const bassEvery = { quarter: 4, half: 8, eighths: 2 }[song.bassStyle] || 4;
    if (s % bassEvery === 0) {
      const f = song.bassStyle === 'eighths' && s % 4 === 2 ? root * 2 : root;
      voice(gain, t, { type: 'triangle', f, dur: stepLen * bassEvery * 0.85, vol: 0.16 });
    }
    // arpeggio
    if (song.arp && s % 2 === 0) {
      const tones = chordNotes(chord, 4);
      voice(gain, t, { type: 'square', f: tones[(s / 2) % 3], dur: stepLen * 1.6, vol: 0.022 });
    }
    // drums
    const d = song.drums || {};
    if (d.k && d.k[s] === 'x') kick(gain, t);
    if (d.s && d.s[s] === 'x') snare(gain, t);
    if (d.h && d.h[s] === 'x') hat(gain, t, s % 4 === 0 ? 0.05 : 0.03);
    if (d.t && d.t[s] === 'x') tom(gain, t, 110 - s * 2);
  }

  function voice(dest, t, { type, f, dur, vol, vibrato = false }) {
    if (!f) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = f * 0.012;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t + 0.12);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function kick(dest, t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  function noiseHit(dest, t, { filter, f, dur, vol }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
  const snare = (dest, t) => { noiseHit(dest, t, { filter: 'bandpass', f: 1800, dur: 0.12, vol: 0.12 }); };
  const hat = (dest, t, vol) => noiseHit(dest, t, { filter: 'highpass', f: 7000, dur: 0.04, vol });
  function tom(dest, t, f) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.2);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.24);
  }
})();
