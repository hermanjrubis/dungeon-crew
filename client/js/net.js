// Talking to the server. Every function here just sends a message;
// the server decides what actually happens.
(function () {
  const socket = io();

  // Send a message and wait for the server's answer.
  function ask(event, payload) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'No answer from the server' }), 5000);
      socket.emit(event, payload, (res) => {
        clearTimeout(timer);
        resolve(res || { ok: false, error: 'No answer from the server' });
      });
    });
  }

  window.Net = {
    socket,
    create: (name) => ask('room:create', { name }),
    join: (name, code) => ask('room:join', { name, code }),
    pick: (choice) => ask('lobby:pick', choice),
    lock: (locked) => socket.emit('lobby:lock', { locked }),
    start: () => ask('lobby:start', {}),
    sendInput: (input) => socket.emit('input', input),
    buy: (itemId) => ask('shop:buy', { itemId }),
    ready: (ready) => socket.emit('shop:ready', { ready }),
    pause: (paused) => socket.emit('game:pause', { paused }),
    on: (event, fn) => socket.on(event, fn)
  };
})();
