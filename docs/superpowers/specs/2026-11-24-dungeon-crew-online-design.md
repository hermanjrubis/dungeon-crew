# Dungeon Crew — Online Hosting Design (Vercel + Cloudflare)

Date: 2026-11-24
Status: draft, waiting for Drei's approval

## Intent

Drei wants a link anyone can open to play, on Vercel (`*.vercel.app`), without Render's 50-second wake-up. Vercel can't hold our rooms (players can land on different instances, and long runs get cut off), so the game page goes on Vercel and the multiplayer server goes on Cloudflare Durable Objects, which is free and has no cold start.

Success: Drei sends one `.vercel.app` link; 2–4 players on different networks create and join a room and play a full run. `npm start` still works for local and LAN play.

## Approaches

1. **Pure Vercel, host's browser is the server (WebRTC).** No backend, but the host's tab must stay open and some school networks block it.
2. **Vercel page + Cloudflare Durable Objects server (chosen by Drei).** Free, fast, works on any network.
3. **Render / Azure behind Vercel.** Render sleeps; Azure needs the Student Pack set up first.

## How it works (decided)

- **One message format for both servers.** Socket.IO doesn't run on Cloudflare, so the game talks over a plain WebSocket with a tiny JSON format: `{ e: event, d: data, a: replyId }`. The browser's `Net` keeps the same functions (`create`, `join`, `on`…), so no UI code changes.
- **The room logic moves into one shared module (`server/hub.js`).** Today it lives inside the Socket.IO handlers. Both servers use the hub:
  - `npm start` (Node, uses the `ws` package): local and LAN play, and the tests.
  - Cloudflare Worker + one Durable Object (`cloud/worker.js`): online play.
  The game itself (floors, monsters, bosses, shop) doesn't change at all.
- **One Durable Object runs every room**, the same as the Node server does today. That's plenty for a class project, and it keeps the port simple. The game loop keeps ticking 20 times a second while a game is running.
- **The Vercel site is built from the repo.** `npm run build:web` copies the page, the shared files and Phaser into `dist/`, plus a `config.js` with the game server's address (from a Vercel setting called `GAME_SERVER`). `vercel.json` points Vercel at it.
- **Invite links** use the Vercel address (`…vercel.app/?room=ABCD`), as they already do.

## What Drei does (you sign in; Claude never handles passwords or keys)

1. Cloudflare: make a free account, then connect the GitHub repo in Workers & Pages (Workers Builds). It deploys the Worker and gives an address like `dungeon-crew.<you>.workers.dev`.
2. Vercel: import the repo, set `GAME_SERVER` to that Cloudflare address, and deploy.

Claude can do the clicking in the browser after you sign in.

## Non-goals

Accounts and saved progress, reconnecting into a game after your connection drops (you rejoin from the menu), and more than a handful of rooms at once.

## Anti-goals

- Breaking local play (`npm start`) or any existing test.
- Players on the Vercel link seeing a different game than the server runs. The server still decides everything.

## Calls Claude made (check these)

- One Durable Object for all rooms instead of one per room. It's simpler and enough for school; it can be split later.
- If the connection drops mid-game, that player leaves the game, like closing the tab today.

## Left to the builder

The exact folder names, the reply timeout, and how the local server serves the page.
