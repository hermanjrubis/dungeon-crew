// Lobby + character select: pick a hero and a color, lock in, host starts.
(function () {
  const $ = (id) => document.getElementById(id);
  const { HEROES, COLORS, CLASSES } = DC.data;

  // Words and bars shown on the character select (bars are out of 5).
  const INFO = {
    knight: {
      role: 'Tank · close range',
      desc: 'Gets up close and keeps enemies off the team. Tough enough to stand in front of the boss.',
      stats: [['Health', 4], ['Damage', 3], ['Speed', 2], ['Range', 1]],
      skills: [
        ['Q', 'Shield Bash', 'every 6s', 'Pushes enemies back and stuns them for 1s.'],
        ['Space', 'Taunt', 'every 12s', 'Nearby enemies attack only you for 3s.']
      ]
    },
    archer: {
      role: 'Damage · long range',
      desc: 'Fast and fragile. Shoots from far away and rolls out of danger.',
      stats: [['Health', 2], ['Damage', 3], ['Speed', 5], ['Range', 5]],
      skills: [
        ['Q', 'Arrow Rain', 'every 10s', 'Arrows fall on a circle where you aim for 2s.'],
        ['Space', 'Dodge Roll', 'every 4s', 'A quick roll. You can’t be hit while rolling.']
      ]
    },
    mage: {
      role: 'Support · medium range',
      desc: 'Hits hardest and keeps the team alive, but has the least health. Uses mana.',
      stats: [['Health', 1], ['Damage', 5], ['Speed', 3], ['Range', 3]],
      skills: [
        ['Q', 'Fireball', 'every 3s · 20 mana', 'Explodes in a small area on impact.'],
        ['Space', 'Heal Circle', 'every 12s · 30 mana', 'Teammates inside heal 30 HP over 3s.']
      ]
    }
  };
  const STAT_VALUES = {
    knight: ['120', '14', 'Slow', 'Melee'],
    archer: ['80', '10', 'Fast', 'Far'],
    mage: ['70', '18', 'Normal', 'Medium']
  };

  let state = null;

  const me = () => state && state.players.find((p) => p.id === Net.id);
  const img = (cls, color) => `assets/${cls}-${color}.png`;

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) node.append(c);
    return node;
  }

  async function pick(choice) {
    const res = await Net.pick(choice);
    $('lobby-error').textContent = res.ok ? '' : res.error;
  }

  function render(s) {
    state = s;
    const mine = me();
    if (!mine) return;
    const hero = mine.heroClass;
    const locked = mine.locked;
    const isHost = s.hostId === mine.id;

    $('room-code').textContent = s.code;

    // Hero cards
    const list = $('hero-list');
    list.replaceChildren(...CLASSES.map((cls) => el('button', {
      type: 'button',
      class: 'hero-card' + (cls === hero ? ' selected' : ''),
      'aria-pressed': String(cls === hero),
      onclick: () => !locked && pick({ heroClass: cls })
    }, [
      el('img', { src: img(cls, mine.color), alt: '', width: 64, height: 64 }),
      el('span', { class: 'hero-card-text' }, [
        el('span', { class: 'hero-card-name', text: HEROES[cls].name }),
        el('span', { class: 'muted small', text: INFO[cls].role })
      ])
    ])));
    list.classList.toggle('locked', locked);

    // Colors (each color once per room)
    const takenBy = {};
    for (const p of s.players) if (p.id !== mine.id) takenBy[p.color] = p.name;
    $('color-list').replaceChildren(...Object.entries(COLORS).map(([name, hex]) => el('button', {
      type: 'button',
      class: 'swatch' + (name === mine.color ? ' selected' : ''),
      style: `background:${hex}`,
      'aria-label': name + (takenBy[name] ? ` (taken by ${takenBy[name]})` : ''),
      ...(takenBy[name] || locked ? { disabled: '' } : {}),
      onclick: () => pick({ color: name })
    })));
    const taken = Object.entries(takenBy).map(([c, n]) => `${c} is taken by ${n}`);
    $('color-note').textContent = taken.join(' · ');

    // Big preview
    $('preview-img').src = img(hero, mine.color);
    $('preview-img').alt = `${HEROES[hero].name} in ${mine.color}`;
    $('preview-name').textContent = HEROES[hero].name;
    $('preview-name').style.color = COLORS[mine.color];
    document.documentElement.style.setProperty('--me', COLORS[mine.color]);

    // Details
    $('hero-desc').textContent = INFO[hero].desc;
    $('hero-stats').replaceChildren(...INFO[hero].stats.map(([label, n], i) => el('div', { class: 'stat' }, [
      el('span', { class: 'muted', text: label }),
      el('span', { class: 'bars' }, Array.from({ length: 5 }, (_, b) => el('span', { class: 'bar' + (b < n ? ' on' : '') }))),
      el('span', { class: 'stat-value', text: STAT_VALUES[hero][i] })
    ])));
    $('hero-skills').replaceChildren(...INFO[hero].skills.map(([key, name, cd, text]) => el('div', { class: 'skill' }, [
      el('kbd', { text: key }),
      el('span', {}, [
        el('span', { class: 'skill-name', text: name + ' ' }),
        el('span', { class: 'muted small', text: cd }),
        el('span', { class: 'skill-text', text })
      ])
    ])));

    // Team strip
    const slots = s.players.map((p) => el('div', { class: 'team-slot' }, [
      el('span', { class: 'team-dot', style: `background:${COLORS[p.color]}` }),
      el('span', { class: 'team-name', text: p.id === mine.id ? `${p.name} (you)` : p.name }),
      el('span', { class: 'muted small', text: `${HEROES[p.heroClass].name} · ${p.locked ? 'ready' : 'choosing…'}${p.id === s.hostId ? ' · host' : ''}` })
    ]));
    for (let i = s.players.length; i < 4; i++) slots.push(el('div', { class: 'team-slot empty', text: 'Open slot' }));
    $('team-strip').replaceChildren(...slots);

    // Buttons
    $('lock-btn').textContent = locked ? 'Change hero' : 'Lock in';
    $('lock-btn').classList.toggle('btn-primary', !locked);
    $('lock-btn').classList.toggle('btn-outline', locked);
    const allLocked = s.players.every((p) => p.locked);
    $('start-btn').classList.toggle('hidden', !isHost);
    $('start-btn').disabled = !allLocked;
    $('start-btn').title = allLocked ? '' : 'Start unlocks when everyone is locked in';
  }

  window.Lobby = {
    init() {
      $('lock-btn').addEventListener('click', () => {
        const mine = me();
        if (mine) Net.lock(!mine.locked);
      });
      $('start-btn').addEventListener('click', async () => {
        const res = await Net.start();
        $('lobby-error').textContent = res.ok ? '' : res.error;
      });
      $('leave-btn').addEventListener('click', () => { location.href = location.pathname; });
      $('copy-link').addEventListener('click', async () => {
        const link = `${location.origin}${location.pathname}?room=${state.code}`;
        try {
          await navigator.clipboard.writeText(link);
          $('copy-link').textContent = 'Copied!';
        } catch (e) {
          $('copy-link').textContent = link;
        }
        setTimeout(() => { $('copy-link').textContent = 'Copy invite link'; }, 2000);
      });
    },
    render
  };
})();
