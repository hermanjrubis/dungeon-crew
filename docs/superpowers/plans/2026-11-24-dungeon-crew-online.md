# Dungeon Crew Online (Vercel + Cloudflare) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the game page from Vercel and run multiplayer on a Cloudflare Durable Object, while `npm start` keeps working locally.

**Architecture:** Pull all room/lobby/game event handling out of the Socket.IO code into a transport-free `server/hub.js`. Both the Node server (`ws` package) and a Cloudflare Worker + Durable Object feed WebSocket messages into the hub using one tiny JSON protocol. The browser's `Net` speaks that protocol over a plain `WebSocket`.

**Tech Stack:** Node 18+, Express, `ws`, Cloudflare Workers + Durable Objects (wrangler), Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-11-24-dungeon-crew-online-design.md`

## Global Constraints

- Protocol: client→server `{ e, d, a? }` (a = reply id); server→client reply `{ r: a, d }`; server event `{ e, d }`. JSON text frames.
- WebSocket path `/ws` on both servers.
- `Net` keeps its functions and the same event names (`lobby:state`, `game:start`, `game:snapshot`, `game:events`, `shop:state`, `game:done`); reply timeout 5 s → `{ ok:false, error:'No answer from the server' }`.
- Game rules files (`game.js`, monsters, rooms, data) do not change.
- No passwords, tokens or keys handled by Claude; deployment is done in Drei's signed-in dashboards.
- Commit trailer on every commit (Co-Authored-By + Claude-Session lines).

## Review Focus

1. A malformed frame (not JSON, missing `e`) must be ignored, never crash the server. (Task 1 test.)
2. A message for a socket that already disconnected must be ignored. (Task 1 test.)
3. The browser must show a clear "Lost connection" message when the socket closes, instead of silently freezing. (Task 2, checked in the headless smoke.)
4. `GAME_SERVER` given as `https://…` or `wss://…`, with or without `/ws`, must all end up as `wss://…/ws`. (Task 4 test.)
5. Vercel must not try to run the Express server (framework detection). (Task 4: `vercel.json` with `"framework": null`.)

---

### Task 1: The hub

**Files:** Create `server/hub.js`. Test `test/hub.test.js`.

**Interfaces — Produces:** `createHub({ debug = {} } = {}) -> hub` with
- `hub.connect(id: string, send: (event, data) => void)`
- `hub.message(id, event: string, payload: any, reply: (data) => void)` — same events and replies as today's Socket.IO handlers (`room:create`, `room:join`, `lobby:pick`, `lobby:lock`, `lobby:start`, `input`, `game:pause`, `shop:buy`, `shop:ready`); a bad payload becomes `{}`; a thrown error replies `{ ok:false, error:'Server error' }`.
- `hub.disconnect(id)`
- `hub.tick(now: number)` — advances every running game, broadcasts `game:snapshot`, `game:events`, `shop:state`, `game:done` exactly like today's loop.
- `hub.hasGames() -> bool`; `hub.size() -> number` (connections).
- `debug: { floor, room, skipToShop }` replaces direct `process.env` reads.
- `hub.handleFrame(id, text, sendFrame)` — parses one JSON frame per the protocol and calls `message`, replying via `sendFrame(JSON)`; ignores bad frames.

- [ ] Tests: `create, join, pick, lock and start send lobby states and game:start to both players`; `tick sends snapshots to everyone in the game`; `a disconnect removes the player from the lobby`; `bad frames and unknown sockets are ignored`; `debug.floor starts on that floor with its gold`.
- [ ] Run → FAIL (`Cannot find module '../server/hub'`).
- [ ] Implement by moving the handler bodies out of `server/index.js`.
- [ ] `npm test` → pass. Commit `refactor: room logic in a transport-free hub`.

### Task 2: Plain WebSocket for the Node server and the browser

**Files:** Modify `server/index.js` (Express static + `ws` `WebSocketServer({ server, path:'/ws' })` → hub; `setInterval(hub.tick, 50)`; env → `debug`), `client/js/net.js` (WebSocket, reply ids, queue until open, "Lost connection" banner on close), `client/index.html` (drop `/socket.io/socket.io.js`, add `config.js` before `net.js`), create `client/config.js` (`window.DC_SERVER = window.DC_SERVER || null;`), `package.json` (`ws` dependency; drop `socket.io`, `socket.io-client`), `test/integration.test.js` (ws client helper `test/wsclient.js`), `.superpowers/tmp/smokes2.js` (Net helpers instead of `Net.socket`).

**Interfaces — Produces:** `Net.on(event, fn)`, `Net.once(event) -> Promise` (used by smokes), `window.DC_SERVER` (null → same host `/ws`).

- [ ] Rewrite `test/integration.test.js` against `ws` first; run → FAIL (server still Socket.IO).
- [ ] Implement. `npm test` → pass.
- [ ] Headless smoke (`smokes2.js`): two browsers create/join/start, `errors: []`, snapshot rows equal on both screens.
- [ ] Commit `feat: plain WebSocket protocol for server and browser`.

### Task 3: Cloudflare Worker + Durable Object

**Files:** Create `cloud/worker.js`, `wrangler.toml` (name `dungeon-crew`, main `cloud/worker.js`, DO binding `GAME` → class `GameServer`, migration `v1` `new_sqlite_classes = ["GameServer"]`), add `wrangler` devDependency and script `"cloud:dev": "wrangler dev"`, `"cloud:deploy": "wrangler deploy"`.

- Worker: `GET /` → text `Dungeon Crew server is running`; `/ws` with `Upgrade: websocket` → `env.GAME.get(env.GAME.idFromName('main')).fetch(request)`; else 404.
- `GameServer`: one hub; on each WebSocket: `WebSocketPair`, `accept()`, id `c<n>`, frames → `hub.handleFrame`; close/error → `hub.disconnect`; a 50 ms interval runs `hub.tick(Date.now())` while any connection is open and stops when none are.
- [ ] Verify: `npx wrangler dev --port 8787` starts; `node .superpowers/tmp/cloudcheck.js ws://localhost:8787/ws` creates a room, joins with a second socket, starts, and prints `snapshots: N>0`.
- [ ] Commit `feat: cloudflare worker and durable object game server`.

### Task 4: Vercel build

**Files:** Create `tools/build-web.js` (exports `serverUrl(raw) -> string|null` and `build(outDir, gameServer)`), `vercel.json` (`{"framework": null, "installCommand": "npm install", "buildCommand": "npm run build:web", "outputDirectory": "dist"}`), `.gitignore` adds `dist/` and `.wrangler/`, script `"build:web": "node tools/build-web.js"`. Test `test/build-web.test.js`.

- `serverUrl`: `https://x.workers.dev` → `wss://x.workers.dev/ws`; `wss://x/ws` unchanged; `http://localhost:8787` → `ws://localhost:8787/ws`; empty → null.
- `build`: copies `client/` → `dist/`, `shared/` → `dist/shared/`, Phaser → `dist/vendor/phaser.min.js`, writes `dist/config.js` with `window.DC_SERVER = "<url>";`.
- [ ] Tests: `serverUrl turns any address form into a ws url`; `build writes the page, shared files, phaser and config`.
- [ ] Run → FAIL; implement; `npm test` → pass.
- [ ] Headless: serve `dist/` (built with `GAME_SERVER=http://localhost:8787`) on another port while `wrangler dev` runs; two browsers play; `errors: []`.
- [ ] Commit `feat: vercel build for the game page`.

### Task 5: Docs and push

- [ ] README: "Put it online (Vercel + Cloudflare)" steps; remove Render section.
- [ ] Final self-review; `npm test` green; merge `online` into `slice-3` line and push to `main`.
