// The online game server, running on Cloudflare.
// The Worker below answers web requests and passes every WebSocket to ONE
// Durable Object (GameServer), which runs all the rooms with the same hub the
// local server uses (server/hub.js). Deploy it with `npx wrangler deploy`
// or by connecting the GitHub repo in the Cloudflare dashboard.
import hubModule from '../server/hub.js';
import dataModule from '../shared/data.js';

const { createHub } = hubModule;
const TICK_MS = 1000 / dataModule.TICK_RATE;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const stub = env.GAME.get(env.GAME.idFromName('main'));
      return stub.fetch(request);
    }
    if (url.pathname === '/') return new Response('Dungeon Crew server is running', { headers: { 'content-type': 'text/plain' } });
    return new Response('Not found', { status: 404 });
  }
};

export class GameServer {
  constructor(state, env) {
    this.state = state;
    this.hub = createHub();
    this.nextId = 1;
    this.open = 0;
    this.loop = null;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const id = 'c' + this.nextId++;
    const sendFrame = (text) => {
      try { server.send(text); } catch (e) { /* already closed */ }
    };
    this.hub.connect(id, (e, d) => sendFrame(JSON.stringify({ e, d })));
    sendFrame(JSON.stringify({ e: 'hello', d: { id } }));
    this.open++;
    this.startLoop();

    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      this.hub.disconnect(id);
      this.open--;
      if (this.open <= 0) this.stopLoop();
    };
    server.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') this.hub.handleFrame(id, ev.data, sendFrame);
    });
    server.addEventListener('close', done);
    server.addEventListener('error', done);

    return new Response(null, { status: 101, webSocket: client });
  }

  // The game loop runs while anyone is connected, 20 times a second.
  startLoop() {
    if (this.loop) return;
    this.loop = setInterval(() => this.hub.tick(Date.now()), TICK_MS);
  }

  stopLoop() {
    clearInterval(this.loop);
    this.loop = null;
  }
}
