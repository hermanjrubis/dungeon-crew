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

  Menu.init();
  Lobby.init();

  Net.on('lobby:state', (state) => {
    Lobby.render(state);
    if (state.phase === 'lobby' && App.screen === 'menu') App.show('lobby');
  });

  Net.on('disconnect', () => {
    App.show('menu');
    Menu.showError('Lost connection to the server. Refresh the page to try again.');
  });

  if (window.GameView) GameView.init();
  if (window.Shop) Shop.init();
})();
