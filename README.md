# Dungeon Crew

A co-op dungeon crawler for 2–4 players that runs in the browser. Friends join a
room with a 4-letter code, pick a hero (Knight, Archer or Mage), and fight
through four floors:

- **Floor 1 · Sunken Cellar** — Gloops, Skitterbats, spike traps, crumbling floors, puddles, and the **Gloop Mother**.
- **Floor 2 · Fungal Caverns** — Bone Archers, Sporecaps, poison pools, falling stalactites, dark rooms lit with torches, and the **Spore Queen**.
- **Floor 3 · Molten Forge** — Rubble Golems (hit them from behind), lava geysers, a lava river crossed on a moving bridge, flame jets, burning, and **the Hollow King**.
- **Floor 4 · Dragon's Roost** — one last room of mixed monsters, then **Ashmaw, the Ember Dragon** on an island in a lava sea. Beat it to win.

After each floor there's a camp shop. Your level, gold and gear carry over.
**The traps move:** every new game places the spikes, pits, puddles, poison pools,
pillars and monsters differently (the room walls and the boss rooms stay the same).

Lava costs 50 HP and sends you back to the start of the room. Every attack and
hazard warns you first: watch for glowing vents, hissing nozzles, a flickering
bridge, raised fists and swords, and red circles on the floor.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open <http://localhost:3000>, type a name and press **Create room**.

### Play with friends on the same Wi-Fi

1. Run `npm start` on one laptop.
2. Find that laptop's IP address (Windows: `ipconfig`, Mac: System Settings → Wi-Fi → Details). It looks like `192.168.1.23`.
3. Friends open `http://192.168.1.23:3000` and type your room code, or you press **Copy invite link** in the lobby and send it to them.

If friends can't connect, allow Node.js through the laptop's firewall. Some school
networks block devices from talking to each other; then use the online option below.

### Put it online (Vercel + Cloudflare, free)

The game page is hosted on **Vercel**; the multiplayer server runs on
**Cloudflare** (a Worker with one Durable Object, `cloud/worker.js`). Neither sleeps.

1. **Cloudflare (the game server):** make a free account at
   [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** →
   **Import a repository** → pick this repo. Keep the deploy command `npx wrangler deploy`.
   When it's done you get an address like `https://dungeon-crew.<you>.workers.dev`
   (open it: it should say "Dungeon Crew server is running").
   *(Or from your laptop: `npx wrangler login` then `npm run cloud:deploy`.)*
2. **Vercel (the page):** [vercel.com](https://vercel.com) → **Add New → Project** → import
   this repo. Under **Environment Variables** add `GAME_SERVER` = your Cloudflare address
   from step 1. Deploy. Share the `https://….vercel.app` link.

`vercel.json` tells Vercel to run `npm run build:web`, which copies the page into `dist/`
and points it at `GAME_SERVER`. To try the online setup on your own computer:
`npm run cloud:dev` (server on port 8787), then `GAME_SERVER=http://localhost:8787 npm run build:web`
and open `dist/` with any static file server.

## Controls

| Key | What it does |
|---|---|
| W A S D | Move |
| Mouse click | Attack toward the mouse |
| Q | Main skill (Shield Bash / Arrow Rain / Fireball) |
| Space | Second skill (Taunt / Dodge Roll / Heal Circle) |
| E (hold) | Revive a downed teammate next to you (3 seconds), or light a torch |
| 1 | Drink a Health Potion |
| 2 | Use a Revive Feather on the nearest downed teammate |
| Esc or the ⏸ button | Pause for the whole team (anyone can resume) |

If everyone goes down, the room starts over.

## How the code is organized

```
server/          runs on the computer that hosts the game
  index.js       local web server + WebSocket, 20 updates per second
  hub.js         rooms, lobby and game messages (shared by the local and online servers)
  lobby.js       room codes, players, hero and color picks, host, start
  game.js        one game: rooms, doors, gold, XP, levels, reviving, room reset
  heroes.js      hero movement, attacks and skills
  enemies.js     Gloop and Skitterbat behaviour
  boss.js        Gloop Mother
  ai.js          helpers every monster uses (targeting, moving, touch damage)
  hazards.js     spikes, cracked floor, pits, puddles, poison, stalactites, torches
  forge.js       Floor 3-4 hazards: lava, the moving bridge, geysers, flame jets, crumbling platforms
  layout.js      builds random rooms from recipes (and checks they can be finished)
  archer.js, sporecap.js, queen.js     Floor 2 monsters
  golem.js, king.js, dragon.js         Floor 3-4 monsters
  shop.js        the camp shop
cloud/worker.js  the online server on Cloudflare (uses server/hub.js)
tools/           build-web.js (the Vercel page), make-sprites.js
shared/          used by BOTH the server and the browser
  data.js        every number: HP, damage, speeds, cooldowns, prices
  rooms.js       the room layouts, drawn with letters
  tiles.js       walls and collision
  sprites.js     the placeholder pixel art
client/          what the players' browsers load
  index.html     all the screens
  css/style.css  the look
  js/            menu, lobby, HUD, shop, and the Phaser dungeon scene
  assets/        sprite PNGs
test/            automated tests (npm test)
```

**The server is the referee.** Browsers only send which keys are pressed; the
server moves everyone, decides every hit and hands out gold. That keeps all
players' screens the same and makes cheating hard.

## Changing the game

- **Balance:** edit the numbers in `shared/data.js` (hero HP, damage, cooldowns, monster stats, shop prices).
- **Rooms:** `shared/rooms.js` holds the floors. Normal rooms are *recipes*: a fixed shape plus what to
  scatter at random (`spikes`, `pit`, `puddle`, `poison`, `pillar`) and which monsters to place. Boss rooms are
  hand-drawn letter grids (24 letters × 13 rows): `w` wall, `f` floor, `s` spikes, `x` cracked floor, `p` pit,
  `u` puddle, `o` poison pool, `d` door, `e` entry, `g` Gloop, `b` Skitterbat, `a` Bone Archer, `c` Sporecap,
  `M` Gloop Mother, `Q` Spore Queen. The random builder (`server/layout.js`) always keeps a safe path to the door.
- **Art:** replace any PNG in `client/assets/` with your own drawing of the same file name and size
  (heroes 48×48, Gloop and bat 48×48, Mini Gloop 32×32, Gloop Mother 96×96, Half Mother 64×64).
  `npm run sprites` rebuilds the placeholder art from `shared/sprites.js` (it overwrites the PNGs).

## Tests

```bash
npm test
```

The tests check the game rules (combat, monsters, hazards, the boss, the shop, the lobby)
and start a real server with two fake players to check the multiplayer connection.

Testing shortcuts (set before `npm start`):

- `DEBUG_SKIP_TO_SHOP=1` — jump straight to the shop with 150 gold.
- `DEBUG_FLOOR=2` — start on Floor 2 with 300 gold (`3` gives 500 gold, `4` gives 900).
- `DEBUG_ROOM=3` — start in room 4 of that floor (counting from 0), e.g. the boss.

On Windows PowerShell: `$env:DEBUG_FLOOR=2; npm start`.
