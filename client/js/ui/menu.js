// Main menu: type a name, then create a room or join one with a code.
(function () {
  const $ = (id) => document.getElementById(id);

  function savedName() {
    try { return localStorage.getItem('dc-name') || ''; } catch (e) { return ''; }
  }
  function saveName(name) {
    try { localStorage.setItem('dc-name', name); } catch (e) { /* private mode: ignore */ }
  }

  function setBusy(busy) {
    $('create-btn').disabled = busy;
    $('join-btn').disabled = busy;
  }

  async function create() {
    const name = $('name-input').value.trim();
    saveName(name);
    setBusy(true);
    const res = await Net.create(name);
    setBusy(false);
    $('menu-error').textContent = res.ok ? '' : res.error;
  }

  async function join(event) {
    event.preventDefault();
    const name = $('name-input').value.trim();
    const code = $('code-input').value.trim();
    if (!code) {
      $('menu-error').textContent = 'Type the 4-letter room code first.';
      return;
    }
    saveName(name);
    setBusy(true);
    const res = await Net.join(name, code);
    setBusy(false);
    $('menu-error').textContent = res.ok ? '' : res.error;
  }

  window.Menu = {
    init() {
      $('name-input').value = savedName();
      // An invite link looks like /?room=K7QF
      const fromLink = new URLSearchParams(location.search).get('room');
      if (fromLink) $('code-input').value = fromLink.toUpperCase().slice(0, 4);
      $('create-btn').addEventListener('click', create);
      $('menu-form').addEventListener('submit', join);
      $('code-input').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
    },
    showError(text) {
      $('menu-error').textContent = text;
    }
  };
})();
