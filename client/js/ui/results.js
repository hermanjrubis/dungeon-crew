// The results screen after each floor: stars, everyone's stats counting up,
// badges and confetti. The server sends the numbers (same for everyone) in a
// `floorresults` event; the screen stays up while the 7 s card runs.
(function () {
  const { HEROES, COLORS } = DC.data;
  const SHOW_MS = 7000;
  const BADGES = {
    mvp: { label: 'MVP', title: 'Most damage dealt' },
    lifesaver: { label: 'Lifesaver', title: 'Most revives' },
    untouchable: { label: 'Untouchable', title: 'Never went down' }
  };
  const STATS = [
    ['kills', 'Monsters slain'],
    ['damage', 'Damage dealt'],
    ['gold', 'Gold earned'],
    ['downs', 'Times downed'],
    ['revives', 'Revives']
  ];
  let hideTimer = null;
  let root = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const sound = (name) => window.Sound && Sound.play(name);

  function confetti(n = 70) {
    const colors = ['#F2A541', '#5EC8B8', '#6C9BF2', '#E5534B', '#F2C14E', '#C77DFF'];
    let out = '';
    for (let i = 0; i < n; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 1.2;
      const dur = 2.4 + Math.random() * 2;
      const size = 6 + Math.random() * 8;
      const spin = Math.random() < 0.5 ? -1 : 1;
      out += `<i style="left:${left}%;width:${size}px;height:${size * 0.5}px;background:${colors[i % colors.length]};` +
        `animation-delay:${delay}s;animation-duration:${dur}s;--spin:${spin * (360 + Math.random() * 720)}deg"></i>`;
    }
    return `<div class="confetti" aria-hidden="true">${out}</div>`;
  }

  // Numbers count up from 0 over 1.2 s.
  function countUp(nodes) {
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 1200);
      const ease = 1 - Math.pow(1 - k, 3);
      for (const n of nodes) n.textContent = Math.round(Number(n.dataset.to) * ease);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function show(r) {
    root = root || document.getElementById('results');
    clearTimeout(hideTimer);
    const reasons = [
      { on: true, text: 'Floor cleared' },
      { on: r.starReasons.noDowns, text: 'Nobody went down' },
      { on: r.starReasons.fast, text: `Under ${clock(r.targetTime)}` }
    ];
    const stars = reasons.map((s, i) => `
      <div class="res-star ${s.on ? 'on' : 'off'}" style="animation-delay:${0.6 + i * 0.4}s">
        <span class="res-star-icon">★</span>
        <span class="res-star-text">${esc(s.text)}</span>
      </div>`).join('');
    const cards = r.players.map((p, i) => `
      <div class="res-card${p.id === App.me ? ' me' : ''}" style="animation-delay:${0.9 + i * 0.12}s; border-color:${COLORS[p.color]}">
        <div class="res-who">
          <img src="assets/${p.heroClass}-${p.color}.png" width="56" height="56" alt="">
          <span><b>${esc(p.name)}</b><span class="muted small">${esc(HEROES[p.heroClass].name)} · Lv ${p.level}</span></span>
        </div>
        <div class="res-stats">
          ${STATS.map(([k, label]) => `<span class="muted small">${label}</span><span class="res-num" data-to="${p[k] || 0}">0</span>`).join('')}
        </div>
        <div class="res-badges">${p.badges.map((b) => `<span class="badge badge-${b}" title="${BADGES[b].title}">${BADGES[b].label}</span>`).join('')}</div>
      </div>`).join('');

    root.innerHTML = `
      ${confetti()}
      <div class="res-inner">
        <p class="res-eyebrow">${esc(r.floorName)} · ${clock(r.time)}</p>
        <h1 class="res-title">FLOOR ${r.floorIndex + 1} CLEARED!</h1>
        <div class="res-stars">${stars}</div>
        <div class="res-cards">${cards}</div>
      </div>`;
    root.classList.remove('hidden', 'leaving');
    countUp(root.querySelectorAll('.res-num'));

    sound('fanfare');
    reasons.forEach((s, i) => setTimeout(() => sound(s.on ? 'star' : 'click'), 600 + i * 400));
    hideTimer = setTimeout(hide, SHOW_MS);
  }

  function hide() {
    if (!root || root.classList.contains('hidden')) return;
    root.classList.add('leaving');
    setTimeout(() => root.classList.add('hidden'), 400);
  }

  window.Results = { show, hide, confetti, BADGES, STATS };
})();
