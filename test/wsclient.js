// A tiny test client that speaks the game's WebSocket protocol, like client/js/net.js.
const WebSocket = require('ws');

function connect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const listeners = new Map();
    const waiting = new Map();
    let nextId = 1;
    const client = {
      id: null,
      emit(e, d, cb) {
        const msg = { e, d };
        if (cb) { msg.a = nextId++; waiting.set(msg.a, cb); }
        ws.send(JSON.stringify(msg));
      },
      raw(text) { ws.send(text); },
      on(e, fn) { (listeners.get(e) || listeners.set(e, []).get(e)).push(fn); },
      once(e) {
        return new Promise((done) => {
          const fn = (d) => { listeners.set(e, listeners.get(e).filter((f) => f !== fn)); done(d); };
          client.on(e, fn);
        });
      },
      close() { ws.close(); }
    };
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.r !== undefined) {
        const cb = waiting.get(msg.r);
        waiting.delete(msg.r);
        if (cb) cb(msg.d);
      } else if (msg.e === 'hello') {
        client.id = msg.d.id;
        resolve(client);
      } else {
        for (const fn of (listeners.get(msg.e) || []).slice()) fn(msg.d);
      }
    });
    ws.on('error', reject);
  });
}

const emit = (s, ev, payload) => new Promise((resolve) => s.emit(ev, payload, resolve));
const once = (s, ev) => s.once(ev);

module.exports = { connect, emit, once };
