// The HUD drawn over the game: my health, the team, the room, gold and the hotbar.
// Plain HTML so it's easy to restyle in css/style.css.
(function () {
  const { HEROES, LEVELS, COLORS } = DC.data;
  const hud = () => document.getElementById('hud');
  let built = false;
  let bannerTimer = null;
  let lastSnap = null;
  const refs = {};

  function build() {
    hud().innerHTML = `
      <div class="hud-box hud-me">
        <img data-r="meImg" alt="">
        <div class="hud-bars">
          <span><b data-r="meName"></b> <span class="muted" data-r="meLevel"></span></span>
          <div class="hud-bar hp"><i data-r="hpFill"></i><b data-r="hpText"></b></div>
          <div class="hud-bar mana" data-r="manaBar"><i data-r="manaFill"></i><b data-r="manaText"></b></div>
          <div class="hud-bar xp"><i data-r="xpFill"></i></div>
        </div>
      </div>
      <div class="hud-box hud-team" data-r="team"></div>
      <button type="button" class="hud-pause-btn" data-r="pauseBtn" aria-label="Pause (Esc)" title="Pause (Esc)">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
      </button>
      <div class="hud-box hud-room">
        <span class="room-title" data-r="roomTitle"></span>
        <div class="room-dots" data-r="roomDots"></div>
        <span class="hud-gold" data-r="gold"></span>
      </div>
      <div class="hud-box hud-hotbar">
        <div class="slot"><span class="key">Click</span><span data-r="atkName"></span><span class="cd hidden" data-r="atkCd"></span></div>
        <div class="slot"><span class="key">Q</span><span data-r="qName"></span><span class="cd hidden" data-r="qCd"></span></div>
        <div class="slot"><span class="key">Space</span><span data-r="spName"></span><span class="cd hidden" data-r="spCd"></span></div>
        <div class="slot"><span class="key">1</span>Potion<span class="count" data-r="potions"></span></div>
        <div class="slot"><span class="key">2</span>Feather<span class="count" data-r="feathers"></span></div>
      </div>
      <div class="hud-box hud-help">Hold <b>E</b> next to a downed friend to revive them.</div>
      <div class="hud-down hidden" data-r="down">You're down!<br><span class="muted">A teammate can hold E next to you to revive you.</span></div>
      <div class="hud-banner hidden" data-r="banner"></div>
      <div class="hud-hurt" data-r="hurt"></div>
      <div class="stage-card" data-r="card" aria-live="polite">
        <span class="stage-eyebrow" data-r="cardEyebrow"></span>
        <span class="stage-title" data-r="cardTitle"></span>
        <span class="stage-line"></span>
        <span class="stage-sub" data-r="cardSub"></span>
      </div>
      <div class="pause-overlay hidden" data-r="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="pause-card">
          <h2 id="pause-title">Paused</h2>
          <p class="muted" data-r="pausedBy"></p>
          <button type="button" class="btn btn-primary btn-big" data-r="resumeBtn">Resume</button>
          <ul class="keys">
            <li><kbd>W A S D</kbd><span>Move</span></li>
            <li><kbd>Click</kbd><span>Attack toward the mouse</span></li>
            <li><kbd>Q</kbd><span>Main skill</span></li>
            <li><kbd>Space</kbd><span>Second skill</span></li>
            <li><kbd>E</kbd><span>Hold next to a downed friend to revive</span></li>
            <li><kbd>1 · 2</kbd><span>Health Potion · Revive Feather</span></li>
            <li><kbd>Esc</kbd><span>Pause / resume</span></li>
          </ul>
          <button type="button" class="btn btn-outline" data-r="leaveBtn">Leave game</button>
        </div>
      </div>`;
    for (const n of hud().querySelectorAll('[data-r]')) refs[n.dataset.r] = n;
    refs.pauseBtn.addEventListener('click', () => Net.pause(true));
    refs.resumeBtn.addEventListener('click', () => Net.pause(false));
    refs.leaveBtn.addEventListener('click', () => {
      if (confirm('Leave this game? Your team keeps playing without you.')) location.href = location.pathname;
    });
    // Esc pauses, and Esc again resumes.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || App.screen !== 'game' || !lastSnap) return;
      Net.pause(!lastSnap.paused);
    });
    built = true;
  }

  // Title card between stages. The server freezes the game while it's up.
  const EYEBROWS = { start: 'Dungeon Crew', room: 'Next room', boss: 'Warning', reset: 'Oh no', floorclear: 'Victory' };
  let cardKey = '';
  function showCard(snap) {
    const t = snap.transition;
    if (!t || (t.kind === 'floorclear' && !document.getElementById('results').classList.contains('hidden'))) {
      refs.card.className = 'stage-card';
      cardKey = '';
      return;
    }
    const key = t.kind + t.until;
    if (key !== cardKey) {
      cardKey = key;
      refs.cardEyebrow.textContent = EYEBROWS[t.kind] || '';
      refs.cardTitle.textContent = t.title;
      refs.cardSub.textContent = t.subtitle;
    }
    const leaving = t.until - snap.t < 0.45;
    refs.card.className = `stage-card show kind-${t.kind}${leaving ? ' leaving' : ''}`;
  }

  function bar(fill, text, value, max) {
    fill.style.width = (max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0) + '%';
    if (text) text.textContent = `${Math.round(value)}/${max}`;
  }

  function cooldown(node, seconds) {
    node.classList.toggle('hidden', !(seconds > 0.05));
    node.textContent = seconds >= 1 ? Math.ceil(seconds) : seconds.toFixed(1);
  }

  window.Hud = {
    update(snap, meId) {
      if (!built) build();
      lastSnap = snap;
      showCard(snap);
      const wasPaused = !refs.pause.classList.contains('hidden');
      refs.pause.classList.toggle('hidden', !snap.paused);
      refs.pausedBy.textContent = snap.pausedBy ? `${snap.pausedBy} paused the game for everyone. Anyone can resume.` : '';
      if (snap.paused && !wasPaused) refs.resumeBtn.focus();
      const me = snap.players.find((p) => p.id === meId);
      if (!me) return;
      const hero = HEROES[me.heroClass];

      refs.meImg.src = `assets/${me.heroClass}-${me.color}.png`;
      refs.meName.textContent = me.name;
      refs.meLevel.textContent = `· Lv ${me.level} ${hero.name}`;
      bar(refs.hpFill, refs.hpText, me.hp, me.maxHp);
      refs.manaBar.classList.toggle('hidden', !me.maxMana);
      bar(refs.manaFill, refs.manaText, me.mana, me.maxMana);
      const lo = LEVELS[me.level - 1];
      const hi = LEVELS[me.level];
      refs.xpFill.style.width = hi === undefined ? '100%' : ((me.xp - lo) / (hi - lo)) * 100 + '%';

      const mates = snap.players.filter((p) => p.id !== meId);
      refs.team.classList.toggle('hidden', mates.length === 0);
      refs.team.innerHTML = mates.map((p) => `
        <div class="hud-mate">
          <span class="team-dot" style="background:${COLORS[p.color]};width:16px;height:16px"></span>
          <span style="width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</span>
          ${p.downed ? '<b style="color:#FF8A80">DOWN</b>' : `<div class="hud-bar hp"><i style="width:${(p.hp / p.maxHp) * 100}%"></i></div>`}
        </div>`).join('');

      refs.roomTitle.textContent = `Floor ${snap.floorIndex + 1} · Room ${snap.roomIndex + 1} of ${snap.roomCount}`;
      refs.roomDots.innerHTML = Array.from({ length: snap.roomCount }, (_, i) => {
        const cls = [i < snap.roomIndex ? 'done' : i === snap.roomIndex ? 'here' : '', i === snap.roomCount - 1 ? 'boss' : ''].join(' ');
        return `<span class="${cls}" title="${i === snap.roomCount - 1 ? 'Boss room' : 'Room ' + (i + 1)}"></span>`;
      }).join('');
      refs.gold.textContent = `${me.gold} gold`;

      refs.atkName.textContent = me.heroClass === 'knight' ? 'Sword' : me.heroClass === 'archer' ? 'Arrow' : 'Bolt';
      refs.qName.textContent = hero.q.name;
      refs.spName.textContent = hero.space.name;
      cooldown(refs.atkCd, me.cd.attack);
      cooldown(refs.qCd, me.cd.q);
      cooldown(refs.spCd, me.cd.space);
      refs.potions.textContent = me.potions;
      refs.feathers.textContent = me.feathers;
      refs.down.classList.toggle('hidden', !me.downed);
    },

    // A quick red glow around the screen when you get hit.
    hurt() {
      if (!built) build();
      refs.hurt.classList.remove('show');
      void refs.hurt.offsetWidth; // restart the fade
      refs.hurt.classList.add('show');
    },

    banner(text, ms = 1800) {
      if (!built) build();
      refs.banner.textContent = text;
      refs.banner.classList.remove('hidden');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => refs.banner.classList.add('hidden'), ms);
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
