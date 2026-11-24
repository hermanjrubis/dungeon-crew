// Camp shop after Floor 1, and the end screen.
(function () {
  const { HEROES, COLORS } = DC.data;
  let busy = false;
  let lastKey = '';
  let deadline = 0;     // when the shop closes, in this browser's clock
  let timerLoop = null;
  let lastTickSecond = null;
  let timeUpPlayed = false;

  // The shop countdown bar, updated 10 times a second between server updates.
  function updateTimer() {
    const bar = document.getElementById('shop-timer');
    if (!bar) return;
    const left = Math.max(0, (deadline - performance.now()) / 1000);
    const secs = Math.ceil(left);
    bar.querySelector('.shop-timer-fill').style.width = (left / 45) * 100 + '%';
    bar.querySelector('.shop-timer-text').textContent = `${secs}s left`;
    bar.classList.toggle('urgent', left <= 10);
    if (left <= 10 && left > 0 && secs !== lastTickSecond) {
      lastTickSecond = secs;
      if (window.Sound) Sound.play('tick');
    }
    if (left <= 0 && !timeUpPlayed) {
      timeUpPlayed = true;
      if (window.Sound) Sound.play('timeup');
    }
    if (left > 0) timeUpPlayed = false;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(state) {
    const me = state.players.find((p) => p.id === App.me);
    if (!me) return;
    deadline = performance.now() + state.timeLeft * 1000;
    if (!timerLoop) timerLoop = setInterval(() => { if (App.screen === 'shop') updateTimer(); }, 100);
    // Only the clock changed: don't rebuild the page (keeps buttons steady).
    const key = JSON.stringify({ ...state, timeLeft: 0 });
    if (key === lastKey && document.getElementById('shop-timer')) { updateTimer(); return; }
    lastKey = key;
    const root = document.getElementById('shop');
    const ARMOR = state.setPieces;
    const pieces = ARMOR.filter((id) => me.owned.includes(id)).length;
    const floorNo = state.floorIndex + 1;
    const readyLabel = state.nextFloorName ? `Ready for Floor ${floorNo + 1}` : 'Finish the run';
    const readyCount = state.players.filter((p) => p.ready).length;

    const items = state.items.map((item) => {
      const isWeapon = item.slot === 'Weapon';
      const name = isWeapon ? state.weapons[me.heroClass] : item.name;
      const slot = isWeapon ? `${HEROES[me.heroClass].name} weapon` : item.slot;
      const owned = item.once && me.owned.includes(item.id);
      const action = owned
        ? '<span class="owned-tag">Owned · equipped</span>'
        : `<button type="button" class="btn btn-primary" data-buy="${item.id}" ${me.gold < item.price || busy ? 'disabled' : ''}>Buy · ${item.price}g</button>`;
      return `
        <div class="item${owned ? ' owned' : ''}">
          <span class="item-name">${esc(name)}</span>
          <span class="muted small">${esc(slot)}</span>
          <span>${esc(item.text)}</span>
          ${action}
        </div>`;
    }).join('');

    const team = state.players.map((p) =>
      `<span class="team-slot"><span class="team-dot" style="background:${COLORS[p.color]}"></span>
       <span class="team-name">${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</span>
       <span class="muted small">${p.ready ? 'ready' : 'shopping…'}</span></span>`).join('');

    root.innerHTML = `
      <div class="shop-top">
        <div>
          <p class="eyebrow">Floor ${floorNo} cleared · Camp</p>
          <h1 class="screen-title">Blacksmith's Shop</h1>
        </div>
        <div id="shop-timer" class="shop-timer" role="timer" aria-label="Time left in the shop">
          <span class="shop-timer-text"></span>
          <span class="shop-timer-track"><span class="shop-timer-fill"></span></span>
          <span class="muted small">Next floor starts automatically</span>
        </div>
        <span class="shop-gold">${me.gold} gold</span>
      </div>
      <div class="shop-body">
        <div class="panel shop-me">
          <img src="assets/${me.heroClass}-${me.color}.png" width="144" height="144" alt="${esc(HEROES[me.heroClass].name)}">
          <b>${esc(me.name)} · ${esc(HEROES[me.heroClass].name)} · Lv ${me.level}</b>
          <span class="muted small">${esc(state.setName)} · ${pieces} of 3 pieces</span>
          <div class="set-bar">${ARMOR.map((id) => `<span class="${me.owned.includes(id) ? 'on' : ''}"></span>`).join('')}</div>
          <div class="skill"><span><span class="label">Set bonus · all 3 pieces</span><span class="skill-text">${esc(state.setBonus)}</span></span></div>
          <div class="stat"><span class="muted">Health</span><span></span><span class="stat-value">${me.maxHp}</span></div>
          <div class="stat"><span class="muted">Damage</span><span></span><span class="stat-value">${me.damage}</span></div>
          <div class="stat"><span class="muted">Defense</span><span></span><span class="stat-value">${me.defense}</span></div>
          <div class="stat"><span class="muted">Weapon</span><span></span><span class="stat-value" style="white-space:nowrap">${esc(me.weaponName)}</span></div>
          <div class="stat"><span class="muted">Items</span><span></span><span class="stat-value">${me.potions} potion(s) · ${me.feathers} feather(s)</span></div>
        </div>
        <div class="shop-items">${items}</div>
      </div>
      <p id="shop-error" class="error" role="alert"></p>
      <div class="shop-bottom">
        <div class="team-strip">${team}</div>
        <div class="lobby-actions">
          <span class="muted">${readyCount} of ${state.players.length} ready</span>
          <button type="button" id="shop-ready" class="btn btn-big ${me.ready ? 'btn-outline' : 'btn-teal'}">${me.ready ? 'Not ready yet' : readyLabel}</button>
        </div>
      </div>`;

    for (const btn of root.querySelectorAll('[data-buy]')) {
      btn.addEventListener('click', async () => {
        busy = true;
        const res = await Net.buy(btn.dataset.buy);
        busy = false;
        if (window.Sound) Sound.play(res.ok ? 'buy' : 'click');
        if (!res.ok) document.getElementById('shop-error').textContent = res.error;
      });
    }
    root.querySelector('#shop-ready').addEventListener('click', () => {
      if (!me.ready && window.Sound) Sound.play('ready');
      Net.ready(!me.ready);
    });
    updateTimer();
  }

  const TROPHY_WEAPONS = { knight: 'Dragonfang Sword', archer: 'Emberstorm Bow', mage: 'Wyrmflame Staff', warden: 'Mountainheart', engineer: 'Thunder Gauntlet' };

  function renderEnd(state) {
    if (state.final) { renderVictory(state); return; }
    const root = document.getElementById('end');
    const cards = state.players.map((p) => `
      <div class="panel">
        <img src="assets/${p.heroClass}-${p.color}.png" width="96" height="96" alt="">
        <b>${esc(p.name)}</b>
        <span class="muted small">${esc(HEROES[p.heroClass].name)} · Level ${p.level}</span>
        <span class="hud-gold">${p.gold} gold</span>
      </div>`).join('');
    root.innerHTML = `
      <div class="end-card">
        <p class="eyebrow">Victory</p>
        <h1>Floor ${state.floorIndex + 1} cleared!</h1>
        <p class="lead">${esc(state.floorName)} is beaten. Floor ${state.floorIndex + 2} is coming soon.</p>
        <div class="end-team">${cards}</div>
        <button type="button" id="end-menu" class="btn btn-primary btn-big">Back to menu</button>
      </div>`;
    root.querySelector('#end-menu').addEventListener('click', () => { location.href = location.pathname; });
  }

  // The whole dungeon is cleared: Ashmaw is beaten.
  function renderVictory(state) {
    const root = document.getElementById('end');
    const mins = Math.floor(state.time / 60);
    const secs = String(state.time % 60).padStart(2, '0');
    const run = state.run || { players: [] };
    const cards = state.players.map((p) => {
      const r = run.players.find((q) => q.id === p.id) || { kills: 0, damage: 0, gold: 0, downs: 0, revives: 0, badges: [] };
      return `
      <div class="panel">
        <img src="assets/${p.heroClass}-${p.color}.png" width="96" height="96" alt="">
        <b>${esc(p.name)}</b>
        <span class="muted small">${esc(HEROES[p.heroClass].name)} · Level ${p.level}</span>
        <span class="hud-gold">${p.gold} gold</span>
        <div class="res-stats">${Results.STATS.map(([k, label]) => `<span class="muted small">${label}</span><span class="res-num">${r[k] || 0}</span>`).join('')}</div>
        <div class="res-badges">${(r.badges || []).map((b) => `<span class="badge badge-${b}">${Results.BADGES[b].label}</span>`).join('')}</div>
        <span class="trophy">${esc(TROPHY_WEAPONS[p.heroClass])}<span class="muted small"> · Legendary</span></span>
      </div>`;
    }).join('');
    root.innerHTML = `
      <div class="end-card victory">
        <p class="eyebrow">Victory</p>
        <h1>Ashmaw is defeated!</h1>
        <p class="lead">Your crew cleared all four floors of the dungeon in ${mins}:${secs}.</p>
        <div class="end-team">${cards}</div>
        <div class="trophies">
          <span class="muted small">Dragon's hoard</span>
          <span class="trophy">Phoenix Feather</span>
          <span class="trophy">300 gold each</span>
        </div>
        <button type="button" id="end-menu" class="btn btn-primary btn-big">Back to menu</button>
      </div>
      ${Results.confetti(90)}`;
    root.querySelector('#end-menu').addEventListener('click', () => { location.href = location.pathname; });
    if (window.Sound) Sound.play('victory');
  }

  window.Shop = {
    init() {
      Net.on('shop:state', (state) => {
        if (App.screen === 'end') return;
        if (App.screen !== 'shop') App.show('shop');
        render(state);
      });
      Net.on('game:done', (state) => {
        renderEnd(state);
        App.show('end');
      });
    }
  };
})();
