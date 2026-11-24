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
    const readyLabel = state.nextFloorName ? `On to Floor ${floorNo + 1}` : 'Finish the run';
    const icon = (id, cls, size = 48) => `<img class="px-icon" src="${DC.icons.iconUrl(id, cls)}" width="${size}" height="${size}" alt="">`;
    const readyCount = state.players.filter((p) => p.ready).length;

    const items = state.items.map((item) => {
      const isWeapon = item.slot === 'Weapon';
      const name = isWeapon ? state.weapons[me.heroClass] : item.name;
      const slot = isWeapon ? `${HEROES[me.heroClass].name} weapon` : item.slot;
      const owned = item.once && me.owned.includes(item.id);
      const action = owned
        ? '<span class="owned-tag">Equipped</span>'
        : `<button type="button" class="btn btn-primary btn-price" data-buy="${item.id}" ${me.gold < item.price || busy ? 'disabled' : ''}>${icon('coin', null, 24)}<span>${item.price}</span></button>`;
      return `
        <div class="item${owned ? ' owned' : ''}">
          <div class="item-head">
            <span class="item-icon">${icon(item.id, me.heroClass)}</span>
            <span class="item-title"><span class="item-name">${esc(name)}</span><span class="muted small">${esc(slot)}</span></span>
          </div>
          <span class="item-text">${esc(item.text)}</span>
          ${action}
        </div>`;
    }).join('');

    const team = state.players.map((p) =>
      `<span class="team-slot"><span class="team-dot" style="background:${COLORS[p.color]}"></span>
       <span class="team-name">${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</span>
       <span class="muted small">${p.ready ? 'ready' : 'shopping'}</span></span>`).join('');

    root.innerHTML = `
      <div class="shop-top">
        <div>
          <p class="eyebrow">Camp · after Floor ${floorNo}</p>
          <h1 class="screen-title">The Blacksmith</h1>
        </div>
        <div id="shop-timer" class="shop-timer" role="timer" aria-label="Time left in the shop">
          <span class="shop-timer-text"></span>
          <span class="shop-timer-track"><span class="shop-timer-fill"></span></span>
          <span class="muted small">The crew moves on when time runs out</span>
        </div>
        <span class="shop-gold">${icon('coin', null, 28)}${me.gold}</span>
      </div>
      <div class="shop-body">
        <div class="panel shop-me">
          <img src="assets/${me.heroClass}-${me.color}.png" width="144" height="144" alt="${esc(HEROES[me.heroClass].name)}">
          <b>${esc(me.name)} · ${esc(HEROES[me.heroClass].name)} · Lv ${me.level}</b>
          <span class="muted small">${esc(state.setName)} · ${pieces} of 3 pieces</span>
          <div class="set-bar">${ARMOR.map((id) => `<span class="${me.owned.includes(id) ? 'on' : ''}"></span>`).join('')}</div>
          <div class="set-icons">${ARMOR.map((id) => `<span class="${me.owned.includes(id) ? 'on' : ''}">${icon(id, me.heroClass, 36)}</span>`).join('')}</div>
          <div class="skill"><span><span class="label">Full set bonus</span><span class="skill-text">${esc(state.setBonus)}</span></span></div>
          <div class="stat"><span class="muted">Health</span><span></span><span class="stat-value">${me.maxHp}</span></div>
          <div class="stat"><span class="muted">Damage</span><span></span><span class="stat-value">${me.damage}</span></div>
          <div class="stat"><span class="muted">Defense</span><span></span><span class="stat-value">${me.defense}</span></div>
          <div class="stat"><span class="muted">Weapon</span><span></span><span class="stat-value" style="white-space:nowrap">${esc(me.weaponName)}</span></div>
          <div class="stat"><span class="muted">Bag</span><span></span><span class="stat-value bag">${icon('potion', null, 24)} ${me.potions} ${icon('feather', null, 24)} ${me.feathers}</span></div>
        </div>
        <div class="shop-items">${items}</div>
      </div>
      <p id="shop-error" class="error" role="alert"></p>
      <div class="shop-bottom">
        <div class="team-strip">${team}</div>
        <div class="lobby-actions">
          <span class="muted">${readyCount} of ${state.players.length} ready</span>
          <button type="button" id="shop-ready" class="btn btn-big ${me.ready ? 'btn-outline' : 'btn-teal'}">${me.ready ? 'Wait, not yet' : readyLabel}</button>
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

  const TROPHY_WEAPONS = { knight: 'Dragonfang Sword', archer: 'Emberstorm Bow', mage: 'Wyrmflame Staff', warden: 'Mountainheart', engineer: 'Thunder Gauntlet', cleric: 'Halo of Dawn' };

  // Play again keeps the crew together in the same room; Back to menu leaves it.
  const END_BUTTONS = `
        <div class="end-buttons">
          <button type="button" id="end-again" class="btn btn-primary btn-big">Play again</button>
          <button type="button" id="end-menu" class="btn btn-big">Back to menu</button>
        </div>
        <p class="muted small" id="end-note"></p>`;
  function wireEndButtons(root) {
    root.querySelector('#end-menu').addEventListener('click', () => { location.href = location.pathname; });
    const again = root.querySelector('#end-again');
    again.addEventListener('click', async () => {
      again.disabled = true;
      const res = await Net.again();
      if (!res.ok && App.screen === 'end') {
        again.disabled = false;
        root.querySelector('#end-note').textContent = res.error || 'Could not go back to the lobby.';
      }
    });
  }

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
        ${END_BUTTONS}
      </div>`;
    wireEndButtons(root);
  }

  // The whole dungeon is cleared: the last floor's boss is beaten.
  const FINAL_BOSS = ['the Gloop Mother', 'the Spore Queen', 'the Hollow King', 'Ashmaw', 'the Rothand Wyrm', 'Prismaurus'];
  const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
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
        <h1>${esc(cap(FINAL_BOSS[state.floorIndex] || 'The last boss'))} is defeated!</h1>
        <p class="lead">Your crew cleared all ${COUNT_WORDS[state.floorIndex] || state.floorIndex + 1} floors of the dungeon in ${mins}:${secs}.</p>
        <div class="end-team">${cards}</div>
        <div class="trophies">
          <span class="muted small">The dungeon's hoard</span>
          <span class="trophy">Phoenix Feather</span>
          <span class="trophy">300 gold each</span>
        </div>
        ${END_BUTTONS}
      </div>
      ${Results.confetti(90)}`;
    wireEndButtons(root);
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
