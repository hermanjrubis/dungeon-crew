// Talking to the server over a WebSocket. Every function here just sends a
// message; the server decides what actually happens.
//   sent:      { e: 'room:create', d: { name }, a: 3 }   (a = reply id)
//   received:  { r: 3, d: {...} } a reply,  { e: 'lobby:state', d: {...} } an event
(function () {
  const url = window.DC_SERVER ||
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  const ws = new WebSocket(url);
  const listeners = new Map();
  const waiting = new Map();
  const queue = [];       // messages sent before the connection opened
  let nextReply = 1;

  function emit(e, d, onReply) {
    const msg = { e, d };
    if (onReply) { msg.a = nextReply++; waiting.set(msg.a, onReply); }
    const text = JSON.stringify(msg);
    if (ws.readyState === WebSocket.OPEN) ws.send(text);
    else if (ws.readyState === WebSocket.CONNECTING) queue.push(text);
  }

  function fire(e, d) {
    for (const fn of (listeners.get(e) || []).slice()) fn(d);
  }

  // Send a message and wait for the server's answer.
  function ask(event, payload) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'No answer from the server' }), 5000);
      emit(event, payload, (res) => {
        clearTimeout(timer);
        resolve(res || { ok: false, error: 'No answer from the server' });
      });
    });
  }

  ws.addEventListener('open', () => {
    for (const text of queue.splice(0)) ws.send(text);
  });
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.r !== undefined) {
      const cb = waiting.get(msg.r);
      waiting.delete(msg.r);
      if (cb) cb(msg.d);
    } else if (msg.e === 'hello') {
      Net.id = msg.d.id;
      fire('connect', msg.d);
    } else {
      fire(msg.e, msg.d);
    }
  });
  ws.addEventListener('close', () => fire('disconnect'));

  const Net = window.Net = {
    id: null, // my connection id, set as soon as the server says hello
    create: (name) => ask('room:create', { name }),
    join: (name, code) => ask('room:join', { name, code }),
    pick: (choice) => ask('lobby:pick', choice),
    lock: (locked) => emit('lobby:lock', { locked }),
    start: () => ask('lobby:start', {}),
    again: () => ask('room:again', {}),
    sendInput: (input) => emit('input', input),
    buy: (itemId) => ask('shop:buy', { itemId }),
    ready: (ready) => emit('shop:ready', { ready }),
    pause: (paused) => emit('game:pause', { paused }),
    on: (event, fn) => {
      (listeners.get(event) || listeners.set(event, []).get(event)).push(fn);
    },
    // Pretend the server sent this (for headless checks of screens and effects).
    fireLocal: (event, data) => fire(event, data),
    // Resolves with the next message of this kind (handy for tests).
    once: (event) => new Promise((resolve) => {
      const fn = (d) => {
        listeners.set(event, listeners.get(event).filter((f) => f !== fn));
        resolve(d);
      };
      Net.on(event, fn);
    })
  };
})();
