// Switches between screens and listens to the server.
(function () {
  const SCREENS = ['menu', 'lobby', 'game', 'shop', 'end'];

  const App = {
    me: null,      // my connection id once the game starts
    screen: 'menu',
    show(id) {
      App.screen = id;
      for (const s of SCREENS) document.getElementById(s).classList.toggle('hidden', s !== id);
    }
  };
  window.App = App;

  // The Settings window (music and effects volume, mute).
  window.Settings = {
    open() { document.getElementById('settings').classList.remove('hidden'); if (window.Sound) Sound.play('click'); },
    close() { document.getElementById('settings').classList.add('hidden'); }
  };
  Sound.mountControls(document.getElementById('settings-sound'));
  document.getElementById('settings-close').addEventListener('click', () => Settings.close());
  document.getElementById('settings').addEventListener('click', (e) => { if (e.target.id === 'settings') Settings.close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('settings').classList.contains('hidden')) Settings.close(); });
  document.getElementById('menu-settings').addEventListener('click', () => Settings.open());
  Menu.init();
  Lobby.init();

  Net.on('lobby:state', (state) => {
    Lobby.render(state);
    // also after Play again: the whole crew goes back to the room's lobby
    if (state.phase === 'lobby' && (App.screen === 'menu' || App.screen === 'end')) App.show('lobby');
  });

  Net.on('disconnect', () => {
    App.show('menu');
    Menu.showError('Lost connection to the server. Refresh the page to try again.');
  });

  // ---------- background music: pick the song for what's on screen ----------
  const FLOOR_SONGS = ['cellar', 'caverns', 'forge', 'roost', 'warrens', 'wastes'];
  let lastSnap = null;
  let lastWanted = null;
  Net.on('game:snapshot', (s) => { lastSnap = s; });
  function wantedSong() {
    if (App.screen === 'menu' || App.screen === 'lobby') return 'menu';
    if (App.screen === 'shop') return 'shop';
    if (App.screen === 'end') return 'victory';
    const results = document.getElementById('results');
    if (results && !results.classList.contains('hidden')) return 'victory';
    if (!lastSnap) return null;
    const boss = lastSnap.enemies.some((e) => DC.data.MONSTERS[e.type] && DC.data.MONSTERS[e.type].boss);
    if (boss || (lastSnap.transition && lastSnap.transition.kind === 'boss')) return 'boss';
    return FLOOR_SONGS[lastSnap.floorIndex] || 'cellar';
  }
  // Only switch when the wanted song changes (so the one-time Victory tune isn't restarted).
  setInterval(() => {
    const want = wantedSong();
    if (want === lastWanted) return;
    lastWanted = want;
    if (want) Music.play(want);
    else Music.stop();
  }, 400);

  if (window.GameView) GameView.init();
  if (window.Shop) Shop.init();
})();
