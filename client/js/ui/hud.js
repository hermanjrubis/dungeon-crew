// The HUD drawn over the game: my health, the team, the room, gold and the hotbar.
// Plain HTML so it's easy to restyle in css/style.css.
(function () {
  const { HEROES, LEVELS, COLORS } = DC.data;
  const hud = () => document.getElementById('hud');
  let built = false;
  let bannerTimer = null;
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
      <div class="hud-hurt" data-r="hurt"></div>`;
    for (const n of hud().querySelectorAll('[data-r]')) refs[n.dataset.r] = n;
    built = true;
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

      refs.roomTitle.textContent = `Floor 1 · Room ${snap.roomIndex + 1} of ${snap.roomCount}`;
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
